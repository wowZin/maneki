# 会员定价系统对接指南

> 本文档汇总了会员定价系统所有需要对接的第三方服务和内部模块

---

## 1. 支付系统对接

### 1.1 支付宝

**官方文档**: https://opendocs.alipay.com/

**需要申请**: 
- 支付宝商家账号
- 应用 AppID
- 应用私钥 + 支付宝公钥

**对接文件**: `apps/api/app/api/v1/pricing.py`
- `create_order()` - 生成支付链接
- `alipay_callback()` - 支付回调处理

**前端对接**: `apps/web/src/pages/Pricing/index.tsx`
- `handleSubscribe()` - 跳转支付宝收银台

**示例代码**:
```python
from alipay import AliPay

alipay = AliPay(
    appid=settings.ALIPAY_APP_ID,
    app_notify_url=f"{settings.API_HOST}/api/v1/pricing/callback/alipay",
    app_private_key_string=settings.ALIPAY_PRIVATE_KEY,
    alipay_public_key_string=settings.ALIPAY_PUBLIC_KEY,
    sign_type="RSA2",
)

# 创建网页支付
order_string = alipay.api_alipay_trade_page_pay(
    out_trade_no=order_id,
    total_amount=str(final_amount),
    subject=f"Maneki {data.tier}会员",
    return_url=f"{settings.FRONTEND_URL}/pricing/success",
)
pay_url = f"https://openapi.alipay.com/gateway.do?{order_string}"
```

**配置项** (添加到 `.env`):
```ini
ALIPAY_APP_ID=your-app-id
ALIPAY_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----
ALIPAY_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----
```

---

### 1.2 微信支付

**官方文档**: https://pay.weixin.qq.com/wiki/

**需要申请**:
- 微信商户号 (mch_id)
- API 密钥 (mch_key)
- 公众号/小程序 AppID

**对接文件**: 
- `apps/api/app/api/v1/pricing.py`
- `apps/web/src/pages/Pricing/index.tsx`

**示例代码**:
```python
import wechatpay

wxpay = wechatpay.WeChatPay(
    appid=settings.WECHAT_PAY_APP_ID,
    mch_id=settings.WECHAT_PAY_MCH_ID,
    mch_key=settings.WECHAT_PAY_MCH_KEY,
)

# Native 支付 (扫码)
result = wxpay.order.create(
    body=f"Maneki {data.tier}会员",
    out_trade_no=order_id,
    total_fee=int(final_amount * 100),  # 单位: 分
    spbill_create_ip=request.client.host,
    notify_url=f"{settings.API_HOST}/api/v1/pricing/callback/wechat",
    trade_type='NATIVE',
)
qr_code_url = result['code_url']  # 前端生成二维码
```

**配置项**:
```ini
WECHAT_PAY_APP_ID=wx...
WECHAT_PAY_MCH_ID=1234567890
WECHAT_PAY_MCH_KEY=your-api-key
```

---

## 2. 数据库表创建

执行以下 SQL 创建必要的表：

```sql
-- 订单表
CREATE TABLE orders (
    id VARCHAR(32) PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    tier VARCHAR(20) NOT NULL, -- basic, vip, svip
    cycle VARCHAR(20) NOT NULL, -- monthly, quarterly, yearly
    original_amount DECIMAL(10,2),
    discount_amount DECIMAL(10,2),
    final_amount DECIMAL(10,2),
    coupon_code VARCHAR(32),
    status VARCHAR(20) DEFAULT 'pending', -- pending, paid, cancelled, refunded
    pay_channel VARCHAR(20), -- alipay, wechat
    pay_trade_no VARCHAR(64), -- 第三方订单号
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- 会员信息表
CREATE TABLE user_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) UNIQUE,
    tier VARCHAR(20) NOT NULL DEFAULT 'basic',
    status VARCHAR(20) DEFAULT 'inactive', -- active, expired, cancelled
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    auto_renew BOOLEAN DEFAULT FALSE,
    next_billing_date TIMESTAMP,
    alipay_agreement_no VARCHAR(64), -- 支付宝签约号
    wechat_contract_id VARCHAR(64), -- 微信委托代扣协议号
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 优惠券表
CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(32) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'fixed', 'percentage'
    value DECIMAL(10,2) NOT NULL,
    min_amount DECIMAL(10,2) DEFAULT 0,
    max_discount DECIMAL(10,2),
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    usage_limit INTEGER DEFAULT 1,
    usage_count INTEGER DEFAULT 0,
    per_user_limit INTEGER DEFAULT 1,
    applicable_tiers VARCHAR(20)[],
    applicable_cycles VARCHAR(20)[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 优惠券使用记录
CREATE TABLE coupon_uses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID REFERENCES coupons(id),
    user_id UUID REFERENCES users(id),
    order_id VARCHAR(32),
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 支付交易记录表 (用于对账)
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(32) REFERENCES orders(id),
    channel VARCHAR(20) NOT NULL, -- alipay, wechat
    trade_no VARCHAR(64) NOT NULL, -- 第三方流水号
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    raw_response JSONB, -- 保存原始回调数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_coupon_uses_code ON coupon_uses(coupon_id, user_id);
```

---

## 3. 自动续费对接

### 3.1 支付宝周期扣款

**文档**: https://opendocs.alipay.com/open/02fkan

**流程**:
1. 用户首次支付时签约周期扣款协议
2. 保存 `agreement_no` 到 `user_memberships.alipay_agreement_no`
3. 定时任务每天检查即将到期的会员
4. 调用 `alipay.user.agreement.execution.plan` 执行扣款

### 3.2 微信委托代扣

**文档**: https://pay.weixin.qq.com/wiki/doc/api/wxpay_v2/contract/chapter3_1.shtml

**流程类似支付宝**:
1. 签约获取 `contract_id`
2. 到期前调用扣款接口

---

## 4. 定时任务配置

**文件**: `apps/api/celery_app.py`

添加以下定时任务：

```python
from celery import Celery
from celery.schedules import crontab

app = Celery('maneki')

app.conf.beat_schedule = {
    # 每天检查即将到期的会员
    'check-expiring-memberships': {
        'task': 'app.tasks.pricing.check_expiring_memberships',
        'schedule': crontab(hour=9, minute=0),  # 每天上午9点
    },
    # 自动续费扣款
    'process-auto-renewal': {
        'task': 'app.tasks.pricing.process_auto_renewal',
        'schedule': crontab(hour=10, minute=0),
    },
    # 同步支付状态 (补偿机制)
    'sync-payment-status': {
        'task': 'app.tasks.pricing.sync_payment_status',
        'schedule': 300.0,  # 每5分钟
    },
}
```

---

## 5. 前端页面待开发

### 5.1 订单详情页
**路径**: `/order/:orderId`

**功能**:
- 显示订单信息
- 支付二维码 (支付宝/微信)
- 支付状态轮询
- 支付成功/失败提示

### 5.2 支付结果页
**路径**: `/pricing/success` 和 `/pricing/fail`

### 5.3 会员中心
**路径**: `/membership`

**功能**:
- 当前会员状态展示
- 到期时间提醒
- 自动续费开关
- 历史订单列表
- 升级/降级会员

---

## 6. 配置文件更新

在 `.env` 中添加：

```ini
# 支付配置
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=

WECHAT_PAY_APP_ID=
WECHAT_PAY_MCH_ID=
WECHAT_PAY_MCH_KEY=

# 支付回调地址 (部署后填写实际域名)
API_HOST=https://api.maneki.example.com
FRONTEND_URL=https://maneki.example.com
```

---

## 7. 测试账号

### 支付宝沙箱
- 沙箱环境: https://open.alipay.com/develop/sandbox/app
- 沙箱账号在控制台查看

### 微信支付测试
- 使用微信提供的测试商户号
- 金额 0.01 元用于测试

---

## 8. 对接检查清单

- [ ] 支付宝/微信商户申请完成
- [ ] 数据库表创建完成
- [ ] 支付回调地址配置正确 (公网可访问)
- [ ] 签名验证逻辑正确
- [ ] 订单状态流转正确
- [ ] 会员有效期计算正确
- [ ] 自动续费逻辑测试通过
- [ ] 退款流程测试通过
- [ ] 并发支付场景处理

---

*文档版本: v1.0*
*更新日期: 2026-04-11*
