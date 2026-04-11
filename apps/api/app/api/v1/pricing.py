"""
会员定价 API
提供动态定价配置和订阅管理
"""

from datetime import datetime, timedelta
from typing import Optional, List
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import current_active_user
from app.models.user import User
from app.middleware import limiter
from app.services.agent_market_service import get_agent_rebate_service

router = APIRouter()


# ============ 数据模型 ============

class PriceDetail(BaseModel):
    """价格详情"""
    original_price: float      # 原价
    discounted_price: float    # 折扣价
    discount_rate: float       # 折扣率
    discount_label: str        # 折扣标签
    save_amount: float         # 节省金额


class MembershipPlan(BaseModel):
    """会员方案"""
    tier: str
    name: str
    description: str
    icon: str
    color: str
    badge: Optional[str] = None
    features: List[str]
    highlights: List[str]
    prices: dict              # BillingCycle -> PriceDetail
    is_popular: bool = False


class CycleConfig(BaseModel):
    """周期配置"""
    cycle: str
    label: str
    unit: str
    months: int


class PricingConfigResponse(BaseModel):
    """定价配置响应"""
    plans: List[MembershipPlan]
    cycles: List[CycleConfig]
    global_discount: Optional[dict] = None


class CreateOrderRequest(BaseModel):
    """创建订单请求"""
    tier: str
    cycle: str
    coupon_code: Optional[str] = None


class CreateOrderResponse(BaseModel):
    """创建订单响应"""
    order_id: str
    tier: str
    cycle: str
    original_amount: float
    discount_amount: float
    final_amount: float
    pay_url: str
    expires_at: str


class UserMembership(BaseModel):
    """用户会员信息"""
    tier: str
    status: str
    start_date: str
    end_date: str
    auto_renew: bool
    next_billing_date: Optional[str] = None


# ============ 定价配置（可从数据库或配置中心读取）===========

# 基础定价配置
BASE_PRICES = {
    "vip": {
        "monthly": 68,
        "quarterly": 188,
        "yearly": 588,
    },
    "svip": {
        "monthly": 168,
        "quarterly": 468,
        "yearly": 1488,
    }
}

# 周期折扣配置
CYCLE_DISCOUNTS = {
    "monthly": {"rate": 1.0, "label": ""},
    "quarterly": {"rate": 0.9, "label": "9折"},
    "yearly": {"rate": 0.7, "label": "7折"},
}

# 全局折扣（可动态调整）
GLOBAL_DISCOUNT = {
    "enabled": True,
    "rate": 0.85,           # 额外85折
    "label": "限时85折",
    "valid_until": (datetime.now() + timedelta(days=7)).isoformat(),
}


# ============ API 路由 ============

@router.get("/config", response_model=PricingConfigResponse)
async def get_pricing_config():
    """
    获取定价配置
    返回所有会员方案的定价信息（含折扣）
    """
    # 计算各方案各周期的价格
    def calculate_price(tier: str, cycle: str) -> PriceDetail:
        base_price = BASE_PRICES.get(tier, {}).get(cycle, 0)
        cycle_discount = CYCLE_DISCOUNTS.get(cycle, {"rate": 1.0, "label": ""})

        # 先应用周期折扣
        discounted = base_price * cycle_discount["rate"]

        # 再应用全局折扣
        if GLOBAL_DISCOUNT["enabled"]:
            discounted = discounted * GLOBAL_DISCOUNT["rate"]

        return PriceDetail(
            original_price=base_price,
            discounted_price=round(discounted, 2),
            discount_rate=cycle_discount["rate"] * (GLOBAL_DISCOUNT["rate"] if GLOBAL_DISCOUNT["enabled"] else 1.0),
            discount_label=f"{cycle_discount['label']}+{GLOBAL_DISCOUNT['label']}" if cycle_discount["label"] and GLOBAL_DISCOUNT["enabled"] else (cycle_discount["label"] or (GLOBAL_DISCOUNT["label"] if GLOBAL_DISCOUNT["enabled"] else "")),
            save_amount=round(base_price - discounted, 2),
        )

    plans = [
        MembershipPlan(
            tier="basic",
            name="基础版",
            description="适合个人投资者入门使用",
            icon="star",
            color="blue",
            features=[
                "实时行情数据（延迟15分钟）",
                "基础K线图表",
                "每日5只股票监控",
                "基础技术指标（MA、MACD）",
                "社区浏览权限",
                "邮件通知",
            ],
            highlights=["永久免费", "基础功能齐全"],
            prices={
                "monthly": PriceDetail(original_price=0, discounted_price=0, discount_rate=1.0, discount_label="", save_amount=0),
                "quarterly": PriceDetail(original_price=0, discounted_price=0, discount_rate=1.0, discount_label="", save_amount=0),
                "yearly": PriceDetail(original_price=0, discounted_price=0, discount_rate=1.0, discount_label="", save_amount=0),
            },
        ),
        MembershipPlan(
            tier="vip",
            name="VIP会员",
            description="适合专业投资者，解锁核心功能",
            icon="crown",
            color="gold",
            badge="最受欢迎",
            is_popular=True,
            features=[
                "实时行情数据（Level-2）",
                "高级K线图表（支持画线）",
                "每日50只股票监控",
                "全部技术指标（20+种）",
                "基础Agent信号推送",
                "每日复盘报告",
                "微信实时通知",
                "数据导出（CSV）",
            ],
            highlights=["实时Level-2数据", "Agent智能信号", "50只票监控"],
            prices={
                cycle: calculate_price("vip", cycle)
                for cycle in ["monthly", "quarterly", "yearly"]
            },
        ),
        MembershipPlan(
            tier="svip",
            name="SVIP会员",
            description="适合机构用户，尊享全部特权",
            icon="thunderbolt",
            color="purple",
            badge="尊享服务",
            features=[
                "VIP全部功能",
                "毫秒级实时推送",
                "无限股票监控",
                "多Agent协同决策",
                "涨停预测算法",
                "专属复盘分析",
                "1对1客服支持",
                "API接口访问",
                "自定义策略回测",
                "机构版数据导出",
            ],
            highlights=["涨停预测", "多Agent决策", "API接入", "专属客服"],
            prices={
                cycle: calculate_price("svip", cycle)
                for cycle in ["monthly", "quarterly", "yearly"]
            },
        ),
    ]

    cycles = [
        CycleConfig(cycle="monthly", label="月付", unit="/月", months=1),
        CycleConfig(cycle="quarterly", label="季付", unit="/季", months=3),
        CycleConfig(cycle="yearly", label="年付", unit="/年", months=12),
    ]

    return PricingConfigResponse(
        plans=plans,
        cycles=cycles,
        global_discount=GLOBAL_DISCOUNT if GLOBAL_DISCOUNT["enabled"] else None,
    )


@router.get("/membership", response_model=Optional[UserMembership])
async def get_user_membership(
    current_user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    获取当前用户的会员信息

    TODO: 会员系统数据库对接
    需要的表结构:

    CREATE TABLE user_memberships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) UNIQUE,
        tier VARCHAR(20) NOT NULL DEFAULT 'basic', -- basic, vip, svip
        status VARCHAR(20) DEFAULT 'inactive', -- active, expired, cancelled
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        auto_renew BOOLEAN DEFAULT FALSE,
        next_billing_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    自动续费实现:
    1. 创建定时任务 (Celery Beat) 每天检查即将到期的会员
    2. 对于 auto_renew=true 的用户，提前3天发起自动扣款
    3. 扣款成功: 延长会员有效期
    4. 扣款失败: 发送通知，标记 auto_renew=false

    支付宝自动续费签约:
    - https://opendocs.alipay.com/open/02fkan

    微信自动续费签约:
    - https://pay.weixin.qq.com/wiki/doc/api/wxpay_v2/contract/chapter3_1.shtml
    """
    # TODO: 从 user_memberships 表查询实际数据
    # query = select(UserMembership).where(UserMembership.user_id == current_user.id)
    # result = await db.execute(query)
    # membership = result.scalar_one_or_none()
    # return membership

    # 示例数据（开发阶段使用）
    return UserMembership(
        tier="vip",
        status="active",
        start_date=datetime.now().isoformat(),
        end_date=(datetime.now() + timedelta(days=30)).isoformat(),
        auto_renew=True,
        next_billing_date=(datetime.now() + timedelta(days=30)).isoformat(),
    )


@router.post("/order", response_model=CreateOrderResponse)
@limiter.limit("10/minute")
async def create_order(
    request,
    data: CreateOrderRequest,
    current_user: User = Depends(current_active_user),
):
    """
    创建订阅订单

    TODO: 对接支付系统
    1. 接入支付宝 SDK - https://opendocs.alipay.com/
    2. 接入微信支付 SDK - https://pay.weixin.qq.com/wiki/
    3. 保存订单到数据库 (orders 表)
    4. 实现支付回调处理 (/pricing/callback/alipay, /pricing/callback/wechat)
    """
    # 获取定价配置计算价格
    config = await get_pricing_config()

    plan = next((p for p in config.plans if p.tier == data.tier), None)
    if not plan:
        raise HTTPException(status_code=400, detail="无效的会员等级")

    price_detail = plan.prices.get(data.cycle)
    if not price_detail:
        raise HTTPException(status_code=400, detail="无效的计费周期")

    original_amount = price_detail.original_price
    discount_amount = price_detail.save_amount
    final_amount = price_detail.discounted_price

    # ============================================
    # TODO: 优惠券系统对接
    # ============================================
    # 优惠券验证流程:
    # 1. 查询优惠券表 (coupons) 验证 code 有效性
    # 2. 检查使用次数限制、有效期、适用范围
    # 3. 计算最终价格
    # 4. 标记优惠券为已使用
    if data.coupon_code:
        # 示例代码:
        # coupon = await db.get(Coupon, data.coupon_code)
        # if coupon and coupon.is_valid():
        #     final_amount = coupon.apply_discount(final_amount)
        #     discount_amount += coupon.discount_value
        pass

    # ============================================
    # TODO: 订单持久化
    # ============================================
    # 需要创建的订单表结构:
    # CREATE TABLE orders (
    #     id VARCHAR(32) PRIMARY KEY,
    #     user_id UUID REFERENCES users(id),
    #     tier VARCHAR(20) NOT NULL,
    #     cycle VARCHAR(20) NOT NULL,
    #     original_amount DECIMAL(10,2),
    #     discount_amount DECIMAL(10,2),
    #     final_amount DECIMAL(10,2),
    #     status VARCHAR(20) DEFAULT 'pending', -- pending, paid, cancelled, refunded
    #     pay_channel VARCHAR(20), -- alipay, wechat
    #     pay_trade_no VARCHAR(64), -- 第三方支付单号
    #     paid_at TIMESTAMP,
    #     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    #     expires_at TIMESTAMP
    # );
    order_id = f"ORD{datetime.now().strftime('%Y%m%d%H%M%S')}{current_user.id[:8]}"

    # ============================================
    # TODO: 支付系统对接 - 生成支付链接
    # ============================================
    # 支付宝对接示例:
    # from alipay import AliPay
    # alipay = AliPay(
    #     appid=settings.ALIPAY_APP_ID,
    #     app_notify_url=f"{settings.API_HOST}/api/v1/pricing/callback/alipay",
    #     app_private_key_string=settings.ALIPAY_PRIVATE_KEY,
    #     alipay_public_key_string=settings.ALIPAY_PUBLIC_KEY,
    #     sign_type="RSA2",
    # )
    # order_string = alipay.api_alipay_trade_page_pay(
    #     out_trade_no=order_id,
    #     total_amount=str(final_amount),
    #     subject=f"Maneki {data.tier}会员",
    #     return_url=f"{settings.FRONTEND_URL}/pricing/success",
    # )
    # pay_url = f"https://openapi.alipay.com/gateway.do?{order_string}"
    #
    # 微信支付对接示例:
    # import wechatpay
    # wxpay = wechatpay.WeChatPay(
    #     appid=settings.WECHAT_PAY_APP_ID,
    #     mch_id=settings.WECHAT_PAY_MCH_ID,
    #     mch_key=settings.WECHAT_PAY_MCH_KEY,
    # )
    # result = wxpay.order.create(
    #     body=f"Maneki {data.tier}会员",
    #     out_trade_no=order_id,
    #     total_fee=int(final_amount * 100),  # 单位为分
    #     spbill_create_ip=request.client.host,
    #     notify_url=f"{settings.API_HOST}/api/v1/pricing/callback/wechat",
    #     trade_type='NATIVE',  # 或 'JSAPI' for 微信内支付
    # )
    # pay_url = result.get('code_url')  # 扫码支付链接

    pay_url = f"/api/v1/pricing/pay/{order_id}"  # 预留链接

    return CreateOrderResponse(
        order_id=order_id,
        tier=data.tier,
        cycle=data.cycle,
        original_amount=original_amount,
        discount_amount=discount_amount,
        final_amount=final_amount,
        pay_url=pay_url,
        expires_at=(datetime.now() + timedelta(hours=2)).isoformat(),
    )


@router.post("/coupon/validate")
async def validate_coupon(
    coupon_code: str,
    tier: str,
    cycle: str,
):
    """
    验证优惠券

    TODO: 优惠券系统对接
    需要的表结构:

    CREATE TABLE coupons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(32) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL, -- 'fixed' (固定金额) or 'percentage' (百分比)
        value DECIMAL(10,2) NOT NULL, -- 折扣值
        min_amount DECIMAL(10,2) DEFAULT 0, -- 最低消费金额
        max_discount DECIMAL(10,2), -- 最大折扣金额 (百分比类型时有效)
        valid_from TIMESTAMP,
        valid_until TIMESTAMP,
        usage_limit INTEGER DEFAULT 1, -- 总使用次数限制
        usage_count INTEGER DEFAULT 0, -- 已使用次数
        per_user_limit INTEGER DEFAULT 1, -- 每个用户可用次数
        applicable_tiers VARCHAR(20)[], -- 适用会员等级 ['vip', 'svip']
        applicable_cycles VARCHAR(20)[], -- 适用计费周期 ['monthly', 'yearly']
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE coupon_uses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        coupon_id UUID REFERENCES coupons(id),
        user_id UUID REFERENCES users(id),
        order_id VARCHAR(32),
        used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    优惠券发放渠道:
    1. 运营后台手动生成 (promo codes)
    2. 新用户注册赠送 (new user)
    3. 活动发放 (event/affiliate)
    4. 退款补偿 (refund compensation)
    """
    # TODO: 实现优惠券验证逻辑
    # 1. 查询优惠券是否存在且有效
    # 2. 检查使用次数限制
    # 3. 检查用户已使用次数
    # 4. 检查适用范围 (tier, cycle)
    # 5. 计算折扣金额

    return {
        "valid": False,
        "discount_amount": 0,
        "message": "优惠券功能开发中",
    }


@router.get("/order/{order_id}/status")
async def get_order_status(
    order_id: str,
    current_user: User = Depends(current_active_user),
):
    """
    查询订单支付状态
    """
    # TODO: 从 orders 表查询订单状态
    # query = select(Order).where(Order.id == order_id, Order.user_id == current_user.id)
    # order = await db.execute(query).scalar_one_or_none()
    # if not order:
    #     raise HTTPException(status_code=404, detail="订单不存在")
    # return {"status": order.status, "paid_at": order.paid_at}

    return {
        "status": "pending",
    }


# ============================================
# TODO: 支付回调接口
# ============================================

@router.post("/callback/alipay")
async def alipay_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    支付宝支付回调

    TODO: 支付宝异步通知处理
    文档: https://opendocs.alipay.com/open/02fkan

    处理流程:
    1. 验证签名 (防止伪造)
    2. 检查订单号是否存在
    3. 验证金额是否匹配
    4. 更新订单状态为 'paid'
    5. 激活/延长用户会员有效期
    6. 触发 Agent 订阅返佣 (如果是通过 Agent 订阅)
    7. 发送通知 (邮件/微信)
    8. 返回 'success' 给支付宝

    Agent 订阅返佣触发:
    如果订单关联了 Agent 模板（通过 agent_template_id 字段），
    支付成功后需要触发返佣给 Agent Owner:

    ```python
    if order.agent_template_id:
        template = await db.get(AgentTemplate, order.agent_template_id)
        if template and template.creator_id:
            rebate_service = get_agent_rebate_service(db)
            await rebate_service.create_rebate(
                subscription_id=order.id,
                owner_id=template.creator_id,
                subscriber_id=order.user_id,
                template_id=template.id,
                subscription_amount=order.final_amount,
                subscription_days=get_subscription_days(order.cycle),
            )
    ```
    """
    # data = await request.form()
    # sign = data.get('sign')
    # trade_status = data.get('trade_status')  # TRADE_SUCCESS
    # out_trade_no = data.get('out_trade_no')  # 我们的订单号
    # trade_no = data.get('trade_no')  # 支付宝订单号
    # total_amount = data.get('total_amount')

    # if trade_status == 'TRADE_SUCCESS':
    #     # 更新订单
    #     order = await db.get(Order, out_trade_no)
    #     order.status = 'paid'
    #     order.pay_trade_no = trade_no
    #     order.paid_at = datetime.now()
    #     await db.commit()
    #
    #     # 激活会员
    #     await activate_membership(order.user_id, order.tier, order.cycle)
    #
    #     # 触发 Agent 订阅返佣
    #     if order.agent_template_id:
    #         from app.services.agent_market_service import get_agent_rebate_service
    #         from app.models.agent_market import AgentTemplate
    #
    #         template = await db.get(AgentTemplate, order.agent_template_id)
    #         if template and template.creator_id:
    #             rebate_service = get_agent_rebate_service(db)
    #             await rebate_service.create_rebate(
    #                 subscription_id=order.id,
    #                 owner_id=template.creator_id,
    #                 subscriber_id=order.user_id,
    #                 template_id=template.id,
    #                 subscription_amount=order.final_amount,
    #                 subscription_days=get_subscription_days(order.cycle),
    #             )

    return PlainTextResponse("success")


@router.post("/callback/wechat")
async def wechat_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    微信支付回调

    TODO: 微信支付异步通知处理
    文档: https://pay.weixin.qq.com/wiki/doc/api/wxpay_v2/contract/chapter3_1.shtml

    处理流程同支付宝回调
    """
    # body = await request.body()
    # xml_data = xmltodict.parse(body)
    # result_code = xml_data['xml']['result_code']  # SUCCESS
    # out_trade_no = xml_data['xml']['out_trade_no']

    return PlainTextResponse("<xml><return_code><![CDATA[SUCCESS]]></return_code></xml>")


@router.post("/subscription/cancel")
async def cancel_subscription(
    current_user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    取消自动续费

    TODO: 取消自动续费协议

    支付宝解约流程:
    1. 调用 alipay.user.agreement.unsign
    2. 更新 user_memberships.auto_renew = false

    微信解约流程:
    1. 调用 委托代扣解约 API
    2. 更新 user_memberships.auto_renew = false

    注意: 取消自动续费不影响当前会员有效期
    """
    # TODO: 调用支付平台解约接口
    # TODO: 更新数据库 auto_renew = false
    return {"success": True, "message": "已取消自动续费 (开发中)"}
