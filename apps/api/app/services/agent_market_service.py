"""
Agent 市场服务
实现 Agent 市场、用户自定义 Agent 和按用户隔离的决策引擎
"""

import math
import random
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import List, Dict, Optional, Any, Tuple
from dataclasses import dataclass

from sqlalchemy import select, func, desc, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_market import (
    AgentTemplate,
    UserAgent,
    UserAgentHistory,
    UserAgentDecision,
    UserAgentMarketFavorite,
    AgentMarketReview,
)
from app.models.user import User
from app.core.sensitive_words import validate_sensitive_words


class APIKeyEncryption:
    """API Key 加密/解密（简单实现，生产环境应使用更安全的方案）"""

    @staticmethod
    def encrypt(api_key: str, user_id: uuid.UUID) -> str:
        """加密 API Key"""
        # TODO: 使用 Fernet 或 AES 加密
        # 临时方案：前缀标识 + base64
        import base64
        prefix = f"enc:{user_id}:"
        encoded = base64.b64encode(api_key.encode()).decode()
        return f"{prefix}{encoded}"

    @staticmethod
    def decrypt(encrypted_key: str, user_id: uuid.UUID) -> str:
        """解密 API Key"""
        import base64
        if encrypted_key.startswith("enc:"):
            parts = encrypted_key.split(":", 2)
            if len(parts) == 3:
                encoded = parts[2]
                return base64.b64decode(encoded.encode()).decode()
        return encrypted_key

    @staticmethod
    def mask_for_display(encrypted_key: str) -> str:
        """脱敏显示"""
        if encrypted_key.startswith("enc:"):
            return "********"
        if len(encrypted_key) > 8:
            return encrypted_key[:4] + "****" + encrypted_key[-4:]
        return "****"


class AgentMarketService:
    """Agent 市场服务"""

    # 评分算法权重配置
    RATING_ALGORITHM_CONFIG = {
        "avg_rating_weight": 0.4,      # 平均评分权重
        "rating_count_weight": 0.2,    # 评分数量权重
        "usage_weight": 0.2,           # 使用次数权重
        "recency_weight": 0.1,         # 最近评分权重
        "dimension_weight": 0.1,       # 维度评分权重
        "min_reviews_for_count": 5,    # 评分数量生效最小阈值
        "max_count_boost": 100,        # 评分数量最大加成
        "decay_hours": 168,            # 热度衰减时间（7天）
    }

    def __init__(self, db: AsyncSession):
        self.db = db

    # ========== Agent Template (市场) ==========

    async def create_template(
        self,
        creator_id: uuid.UUID,
        name: str,
        description: Optional[str],
        category: str,
        tags: Optional[List[str]],
        is_public: bool,
        is_featured: bool,
        data_sources: List[Dict],
        prompt: Dict,
        llm_config: Dict,
        reasoning_config: Optional[Dict]
    ) -> AgentTemplate:
        """创建 Agent 模板"""
        # 敏感词校验
        validate_sensitive_words(name, "模板名称")
        validate_sensitive_words(description, "模板描述")
        validate_sensitive_words(prompt.get("system_prompt", ""), "系统提示词")
        validate_sensitive_words(prompt.get("user_prompt_template", ""), "用户提示词模板")

        template = AgentTemplate(
            id=uuid.uuid4(),
            name=name,
            description=description,
            category=category,
            tags=tags or [],
            is_public=is_public,
            is_featured=is_featured,
            creator_id=creator_id,
            usage_count=0,
            rating=Decimal("5.00"),
            rating_count=0,
            config={
                "data_sources": data_sources,
                "prompt": prompt,
                "llm_config": llm_config,
                "reasoning_config": reasoning_config,
            },
            data_sources=data_sources,
            prompt_template=prompt.get("system_prompt", ""),
            llm_config=llm_config,
        )
        self.db.add(template)
        await self.db.commit()
        await self.db.refresh(template)
        return template

    async def get_template(self, template_id: uuid.UUID) -> Optional[AgentTemplate]:
        """获取模板详情"""
        result = await self.db.execute(
            select(AgentTemplate).where(AgentTemplate.id == template_id)
        )
        return result.scalar_one_or_none()

    async def list_templates(
        self,
        user_id: uuid.UUID,
        category: Optional[str] = None,
        search: Optional[str] = None,
        featured_only: bool = False,
        sort_by: str = "rating",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[AgentTemplate], int]:
        """列出市场模板

        Args:
            featured_only: 只显示精选模板（免费用户可用）
        """
        # 基础查询：公开的或自己创建的
        query = select(AgentTemplate).where(
            or_(
                AgentTemplate.is_public == True,
                AgentTemplate.creator_id == user_id
            )
        )

        # 只显示精选模板
        if featured_only:
            query = query.where(AgentTemplate.is_featured == True)

        # 筛选
        if category:
            query = query.where(AgentTemplate.category == category)
        if search:
            query = query.where(
                or_(
                    AgentTemplate.name.ilike(f"%{search}%"),
                    AgentTemplate.description.ilike(f"%{search}%")
                )
            )

        # 排序
        if sort_by == "rating":
            order_col = AgentTemplate.rating
        elif sort_by == "usage":
            order_col = AgentTemplate.usage_count
        else:
            order_col = AgentTemplate.created_at

        if sort_order == "desc":
            query = query.order_by(desc(order_col))
        else:
            query = query.order_by(order_col)

        # 分页
        total_result = await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = total_result.scalar()

        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        templates = result.scalars().all()

        return templates, total

    async def update_template(
        self,
        template_id: uuid.UUID,
        user_id: uuid.UUID,
        updates: Dict[str, Any]
    ) -> Optional[AgentTemplate]:
        """更新模板（仅创建者可更新）"""
        template = await self.get_template(template_id)
        if not template or template.creator_id != user_id:
            return None

        for key, value in updates.items():
            if hasattr(template, key):
                setattr(template, key, value)

        await self.db.commit()
        await self.db.refresh(template)
        return template

    async def delete_template(self, template_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """删除模板"""
        template = await self.get_template(template_id)
        if not template or template.creator_id != user_id:
            return False

        await self.db.delete(template)
        await self.db.commit()
        return True

    async def add_review(
        self,
        template_id: uuid.UUID,
        user_id: uuid.UUID,
        rating: int,
        comment: Optional[str],
        accuracy_rating: Optional[int] = None,
        speed_rating: Optional[int] = None,
        usability_rating: Optional[int] = None,
        tags: Optional[List[str]] = None,
    ) -> AgentMarketReview:
        """添加评价"""
        # 检查是否已评价
        result = await self.db.execute(
            select(AgentMarketReview).where(
                and_(
                    AgentMarketReview.template_id == template_id,
                    AgentMarketReview.user_id == user_id
                )
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.rating = rating
            existing.comment = comment
            existing.accuracy_rating = accuracy_rating
            existing.speed_rating = speed_rating
            existing.usability_rating = usability_rating
            existing.tags = tags
            existing.updated_at = datetime.utcnow()
        else:
            review = AgentMarketReview(
                template_id=template_id,
                user_id=user_id,
                rating=rating,
                comment=comment,
                accuracy_rating=accuracy_rating,
                speed_rating=speed_rating,
                usability_rating=usability_rating,
                tags=tags,
            )
            self.db.add(review)

        # 更新模板评分
        await self._update_template_rating(template_id)
        await self.db.commit()
        return existing or review

    async def _update_template_rating(self, template_id: uuid.UUID):
        """更新模板平均评分"""
        result = await self.db.execute(
            select(
                func.avg(AgentMarketReview.rating).label("avg_rating"),
                func.count().label("count")
            ).where(AgentMarketReview.template_id == template_id)
        )
        row = result.one()

        template = await self.get_template(template_id)
        if template:
            template.rating = Decimal(str(row.avg_rating or 5.0))
            template.rating_count = row.count

    async def calculate_template_rating_stats(self, template_id: uuid.UUID) -> Optional["AgentTemplateRatingStats"]:
        """
        计算并更新模板的评分统计数据
        使用综合算法计算排名分数
        """
        from app.models.agent_market import AgentTemplateRatingStats, AgentMarketReview
        from datetime import datetime, timedelta
        import math

        # 获取该模板的所有评价
        result = await self.db.execute(
            select(AgentMarketReview).where(AgentMarketReview.template_id == template_id)
        )
        reviews = result.scalars().all()

        if not reviews:
            return None

        # 基础统计
        ratings = [r.rating for r in reviews]
        avg_rating = Decimal(str(sum(ratings) / len(ratings)))
        rating_count = len(reviews)

        # 评分分布
        distribution = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
        for r in ratings:
            distribution[str(r)] = distribution.get(str(r), 0) + 1

        # 维度评分
        accuracy_ratings = [r.accuracy_rating for r in reviews if r.accuracy_rating]
        speed_ratings = [r.speed_rating for r in reviews if r.speed_rating]
        usability_ratings = [r.usability_rating for r in reviews if r.usability_rating]

        avg_accuracy = Decimal(str(sum(accuracy_ratings) / len(accuracy_ratings))) if accuracy_ratings else None
        avg_speed = Decimal(str(sum(speed_ratings) / len(speed_ratings))) if speed_ratings else None
        avg_usability = Decimal(str(sum(usability_ratings) / len(usability_ratings))) if usability_ratings else None

        # 获取模板使用次数
        template = await self.get_template(template_id)
        usage_count = template.usage_count if template else 0

        # 计算综合排名分数
        composite_score = self._calculate_composite_score(
            avg_rating=float(avg_rating),
            rating_count=rating_count,
            usage_count=usage_count,
            reviews=reviews,
            avg_accuracy=float(avg_accuracy) if avg_accuracy else None,
            avg_speed=float(avg_speed) if avg_speed else None,
            avg_usability=float(avg_usability) if avg_usability else None,
        )

        # 计算热度分数
        hot_score = self._calculate_hot_score(rating_count, usage_count, reviews)

        # 更新或创建统计记录
        result = await self.db.execute(
            select(AgentTemplateRatingStats).where(AgentTemplateRatingStats.template_id == template_id)
        )
        stats = result.scalar_one_or_none()

        if stats:
            stats.avg_rating = avg_rating
            stats.rating_count = rating_count
            stats.rating_distribution = distribution
            stats.avg_accuracy = avg_accuracy
            stats.avg_speed = avg_speed
            stats.avg_usability = avg_usability
            stats.composite_score = Decimal(str(composite_score))
            stats.hot_score = Decimal(str(hot_score))
            stats.last_review_at = max(r.created_at for r in reviews)
            stats.calculated_at = datetime.utcnow()
        else:
            stats = AgentTemplateRatingStats(
                template_id=template_id,
                avg_rating=avg_rating,
                rating_count=rating_count,
                rating_distribution=distribution,
                avg_accuracy=avg_accuracy,
                avg_speed=avg_speed,
                avg_usability=avg_usability,
                composite_score=Decimal(str(composite_score)),
                hot_score=Decimal(str(hot_score)),
                last_review_at=max(r.created_at for r in reviews),
            )
            self.db.add(stats)

        # 同时更新模板的评分字段
        if template:
            template.rating = avg_rating
            template.rating_count = rating_count

        await self.db.commit()
        await self.db.refresh(stats)
        return stats

    def _calculate_composite_score(
        self,
        avg_rating: float,
        rating_count: int,
        usage_count: int,
        reviews: list,
        avg_accuracy: Optional[float] = None,
        avg_speed: Optional[float] = None,
        avg_usability: Optional[float] = None,
    ) -> float:
        """
        计算综合排名分数

        算法：
        1. 平均评分 (40%): 使用 Wilson Score Interval 处理小样本偏差
        2. 评分数量 (20%): 数量越多分数越高，但有上限
        3. 使用次数 (20%): 实际使用量反映受欢迎程度
        4. 最近评分 (10%): 近期评分权重更高
        5. 维度评分 (10%): 准确性、速度、易用性的综合
        """
        config = self.RATING_ALGORITHM_CONFIG

        # 1. Wilson Score Interval (处理小样本偏差)
        # 95% confidence interval
        z = 1.96
        n = rating_count
        p = avg_rating / 5.0  # 归一化到 0-1

        if n == 0:
            wilson_score = 0
        else:
            wilson_score = (
                (p + z**2 / (2 * n) - z * math.sqrt((p * (1 - p) + z**2 / (4 * n)) / n))
                / (1 + z**2 / n)
            )
        rating_component = wilson_score * config["avg_rating_weight"]

        # 2. 评分数量加成 (对数增长，有上限)
        min_reviews = config["min_reviews_for_count"]
        max_boost = config["max_count_boost"]
        if rating_count >= min_reviews:
            count_boost = math.log(1 + rating_count / min_reviews) / math.log(1 + max_boost / min_reviews)
        else:
            count_boost = 0
        count_component = count_boost * config["rating_count_weight"]

        # 3. 使用次数加成 (同样使用对数增长)
        usage_boost = math.log(1 + usage_count) / math.log(1 + max_boost * 2)  # 使用次数可以更多
        usage_component = min(usage_boost, 1.0) * config["usage_weight"]

        # 4. 最近评分权重 (时间衰减)
        if reviews:
            now = datetime.utcnow()
            decay_hours = config["decay_hours"]
            recent_score = 0
            for review in reviews:
                hours_ago = (now - review.created_at).total_seconds() / 3600
                weight = math.exp(-hours_ago / decay_hours)  # 指数衰减
                recent_score += review.rating / 5.0 * weight
            recency_component = (recent_score / len(reviews)) * config["recency_weight"]
        else:
            recency_component = 0

        # 5. 维度评分
        dimension_scores = [s for s in [avg_accuracy, avg_speed, avg_usability] if s]
        if dimension_scores:
            avg_dimension = sum(dimension_scores) / len(dimension_scores) / 5.0
            dimension_component = avg_dimension * config["dimension_weight"]
        else:
            dimension_component = 0

        # 综合分数 (0-1范围)
        total_score = rating_component + count_component + usage_component + recency_component + dimension_component

        # 归一化到 0-10000 便于排序
        return round(total_score * 10000, 4)

    def _calculate_hot_score(self, rating_count: int, usage_count: int, reviews: list) -> float:
        """
        计算热度分数
        基于：最近7天的活动（评分、使用）的加权得分
        """
        from datetime import datetime, timedelta
        import math

        if not reviews:
            return 0.0

        now = datetime.utcnow()
        seven_days_ago = now - timedelta(days=7)

        # 近期评分权重
        recent_reviews = [r for r in reviews if r.created_at > seven_days_ago]
        recent_rating_score = sum(r.rating for r in recent_reviews) * 10  # 评分权重

        # 时间衰减因子 (越新的评分权重越高)
        time_decay = 0
        for review in recent_reviews:
            hours_ago = (now - review.created_at).total_seconds() / 3600
            time_decay += 1 / (1 + hours_ago / 24)  # 24小时半衰期

        # 热度 = 近期评分活动 + 使用时间衰减
        hot_score = recent_rating_score * (1 + time_decay)

        return round(hot_score, 4)

    async def get_ranked_templates(
        self,
        user_id: uuid.UUID,
        sort_by: str = "composite",  # composite/hot/rating/usage
        category: Optional[str] = None,
        featured_only: bool = False,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[AgentTemplate], int]:
        """
        获取排名后的模板列表

        Args:
            sort_by: 排序方式
                - composite: 综合排名分数（默认）
                - hot: 热度分数
                - rating: 平均评分
                - usage: 使用次数
        """
        from app.models.agent_market import AgentTemplateRatingStats

        # 基础查询
        query = select(
            AgentTemplate,
            AgentTemplateRatingStats.composite_score,
            AgentTemplateRatingStats.hot_score,
        ).outerjoin(
            AgentTemplateRatingStats,
            AgentTemplate.id == AgentTemplateRatingStats.template_id
        ).where(
            or_(
                AgentTemplate.is_public == True,
                AgentTemplate.creator_id == user_id
            )
        )

        if featured_only:
            query = query.where(AgentTemplate.is_featured == True)

        if category:
            query = query.where(AgentTemplate.category == category)

        # 排序
        if sort_by == "composite":
            query = query.order_by(desc(AgentTemplateRatingStats.composite_score))
        elif sort_by == "hot":
            query = query.order_by(desc(AgentTemplateRatingStats.hot_score))
        elif sort_by == "rating":
            query = query.order_by(desc(AgentTemplate.rating))
        elif sort_by == "usage":
            query = query.order_by(desc(AgentTemplate.usage_count))
        else:
            query = query.order_by(desc(AgentTemplate.created_at))

        # 分页
        total_result = await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = total_result.scalar()

        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        rows = result.all()

        templates = [row[0] for row in rows]
        return templates, total


class UserAgentService:
    """用户 Agent 服务 - 按用户隔离"""

    # 默认 Agent 套装
    DEFAULT_AGENTS = [
        {
            "agent_key": "trend_follower",
            "name": "趋势跟随者",
            "description": "基于均线系统判断趋势方向",
            "category": "trend",
            "icon": "📈",
            "color": "#1890ff",
            "data_sources": [{"source": "kline", "enabled": True}, {"source": "indicator", "enabled": True}],
            "system_prompt": "你是一个趋势分析专家，基于均线系统判断股票趋势。",
            "user_prompt_template": "分析股票 {code} 的 {period} K线数据，MA5={ma5}, MA10={ma10}, MA20={ma20}，给出买入/卖出/持有建议。",
        },
        {
            "agent_key": "volume_analyzer",
            "name": "量能分析者",
            "description": "分析成交量变化，识别放量突破",
            "category": "volume",
            "icon": "📊",
            "color": "#52c41a",
            "data_sources": [{"source": "kline", "enabled": True}],
            "system_prompt": "你是一个量能分析专家，关注成交量变化和价格配合。",
            "user_prompt_template": "分析股票 {code} 的成交量数据，今日量能 vs 5日均量，判断是否放量。",
        },
        {
            "agent_key": "breakout_hunter",
            "name": "突破猎手",
            "description": "识别价格突破关键阻力位的信号",
            "category": "breakout",
            "icon": "🎯",
            "color": "#faad14",
            "data_sources": [{"source": "kline", "enabled": True}, {"source": "indicator", "enabled": True}],
            "system_prompt": "你是一个突破策略专家，识别价格突破关键阻力位的信号。",
            "user_prompt_template": "分析股票 {code} 是否突破近期高点，阻力位 {resistance}，当前价 {price}。",
        },
        {
            "agent_key": "news_sentiment",
            "name": "情绪分析师",
            "description": "分析新闻和公告的情感倾向",
            "category": "sentiment",
            "icon": "📰",
            "color": "#722ed1",
            "data_sources": [{"source": "news", "enabled": True}],
            "system_prompt": "你是一个市场情绪分析师，分析新闻和公告的情感倾向。",
            "user_prompt_template": "分析以下关于 {code} 的新闻：{news_content}，判断情感倾向。",
        },
    ]

    def __init__(self, db: AsyncSession):
        self.db = db

    # ========== 用户 Agent CRUD ==========

    async def initialize_default_agents(
        self,
        user_id: uuid.UUID,
        llm_config: Optional[Dict] = None
    ) -> List[UserAgent]:
        """为用户初始化默认 Agent 套装"""
        agents = []

        # 默认模型配置
        default_model = llm_config or {
            "provider": "openai",
            "base_url": "https://api.openai.com/v1",
            "api_key": "",  # 需要用户自己配置
            "model_name": "gpt-3.5-turbo",
            "temperature": 0.7,
            "max_tokens": 2000,
            "timeout": 30,
        }

        for idx, default in enumerate(self.DEFAULT_AGENTS):
            agent = UserAgent(
                id=uuid.uuid4(),
                user_id=user_id,
                agent_key=default["agent_key"],
                name=default["name"],
                description=default["description"],
                category=default["category"],
                icon=default["icon"],
                color=default["color"],
                data_sources=default["data_sources"],
                system_prompt=default["system_prompt"],
                user_prompt_template=default["user_prompt_template"],
                prompt_variables=[],
                llm_config=default_model.copy(),
                manual_weight_score=100,
                use_manual_weight=False,
                auto_weight_score=100,
                is_active=True,
                sort_order=idx,
            )
            self.db.add(agent)
            agents.append(agent)

        await self.db.commit()
        for agent in agents:
            await self.db.refresh(agent)
        return agents

    async def create_agent(
        self,
        user_id: uuid.UUID,
        name: str,
        description: Optional[str],
        category: str,
        data_sources: List[Dict],
        prompt: Dict,
        llm_config: Dict,
        manual_weight_score: int = 100,
        use_manual_weight: bool = False,
        **kwargs
    ) -> UserAgent:
        """创建用户自定义 Agent"""
        # 生成 agent_key
        agent_key = self._generate_agent_key(name)

        # 检查名称是否重复
        existing = await self.get_agent_by_name(user_id, name)
        if existing:
            raise ValueError(f"Agent 名称 '{name}' 已存在")

        # 敏感词校验
        validate_sensitive_words(name, "Agent名称")
        validate_sensitive_words(description, "Agent描述")
        validate_sensitive_words(prompt.get("system_prompt", ""), "系统提示词")
        validate_sensitive_words(prompt.get("user_prompt_template", ""), "用户提示词模板")

        # 加密 API Key
        encrypted_api_key = APIKeyEncryption.encrypt(
            llm_config.get("api_key", ""),
            user_id
        )
        llm_config["api_key"] = encrypted_api_key

        agent = UserAgent(
            id=uuid.uuid4(),
            user_id=user_id,
            agent_key=agent_key,
            name=name,
            description=description,
            category=category,
            data_sources=data_sources,
            system_prompt=prompt.get("system_prompt", ""),
            user_prompt_template=prompt.get("user_prompt_template", ""),
            prompt_variables=prompt.get("variables", []),
            llm_config=llm_config,
            manual_weight_score=manual_weight_score,
            use_manual_weight=use_manual_weight,
            auto_weight_score=100,
            is_active=True,
            **kwargs
        )
        self.db.add(agent)
        await self.db.commit()
        await self.db.refresh(agent)
        return agent

    async def clone_from_template(
        self,
        user_id: uuid.UUID,
        template_id: uuid.UUID,
        user_vip_level: int = 0,
        custom_name: Optional[str] = None,
        custom_llm_config: Optional[Dict] = None,
        customizations: Optional[Dict] = None
    ) -> UserAgent:
        """从市场模板克隆 Agent"""
        from app.services.agent_market_service import AgentMarketService
        from app.core.vip import VIPLevel

        market_service = AgentMarketService(self.db)
        template = await market_service.get_template(template_id)

        if not template:
            raise ValueError("模板不存在")

        # 检查是否有权使用该模板
        # 1. 自己的模板始终可用
        if template.creator_id == user_id:
            pass  # 允许
        # 2. 非公开模板不可用
        elif not template.is_public:
            raise ValueError("无权使用该模板")
        # 3. 精选模板对所有人开放
        elif template.is_featured:
            pass  # 允许
        # 4. 普通公开模板需要 SVIP
        elif user_vip_level < VIPLevel.SVIP:
            raise ValueError("克隆普通模板需要SVIP权限，免费用户只能使用精选模板")

        # 生成名称
        name = custom_name or f"{template.name} (副本)"

        # 检查名称是否重复
        existing = await self.get_agent_by_name(user_id, name)
        if existing:
            name = f"{name} {datetime.now().strftime('%m%d%H%M')}"

        # 应用自定义修改
        config = template.config.copy()
        if customizations:
            config.update(customizations)

        # 处理模型配置：优先使用用户传入的 llm_config
        llm_config = config.get("llm_config", {})
        if custom_llm_config:
            # 用户传入了自己的模型配置，进行合并
            llm_config.update(custom_llm_config)
            # 重新加密 API Key
            if llm_config.get("api_key"):
                llm_config["api_key"] = APIKeyEncryption.encrypt(
                    llm_config["api_key"],
                    user_id
                )
        if llm_config.get("api_key"):
            llm_config["api_key"] = APIKeyEncryption.encrypt(
                llm_config["api_key"],
                user_id
            )

        agent = UserAgent(
            id=uuid.uuid4(),
            user_id=user_id,
            template_id=template_id,
            agent_key=self._generate_agent_key(name),
            name=name,
            description=template.description,
            category=template.category,
            data_sources=config.get("data_sources", []),
            system_prompt=config.get("prompt", {}).get("system_prompt", ""),
            user_prompt_template=config.get("prompt", {}).get("user_prompt_template", ""),
            prompt_variables=config.get("prompt", {}).get("variables", []),
            llm_config=llm_config,
            manual_weight_score=100,
            use_manual_weight=False,
            auto_weight_score=100,
            is_active=True,
        )
        self.db.add(agent)

        # 更新模板使用计数
        template.usage_count += 1

        await self.db.commit()
        await self.db.refresh(agent)
        return agent

    async def get_agent(self, agent_id: uuid.UUID, user_id: uuid.UUID) -> Optional[UserAgent]:
        """获取用户 Agent（带权限检查）"""
        result = await self.db.execute(
            select(UserAgent).where(
                and_(
                    UserAgent.id == agent_id,
                    UserAgent.user_id == user_id
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_agent_by_name(self, user_id: uuid.UUID, name: str) -> Optional[UserAgent]:
        """按名称获取 Agent"""
        result = await self.db.execute(
            select(UserAgent).where(
                and_(
                    UserAgent.user_id == user_id,
                    UserAgent.name == name
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_agents(
        self,
        user_id: uuid.UUID,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
        is_favorite: Optional[bool] = None,
        search: Optional[str] = None
    ) -> List[UserAgent]:
        """列出用户的所有 Agent"""
        query = select(UserAgent).where(UserAgent.user_id == user_id)

        if category:
            query = query.where(UserAgent.category == category)
        if is_active is not None:
            query = query.where(UserAgent.is_active == is_active)
        if is_favorite is not None:
            query = query.where(UserAgent.is_favorite == is_favorite)
        if search:
            query = query.where(
                or_(
                    UserAgent.name.ilike(f"%{search}%"),
                    UserAgent.description.ilike(f"%{search}%")
                )
            )

        query = query.order_by(UserAgent.sort_order, UserAgent.created_at)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_active_agents(self, user_id: uuid.UUID) -> List[UserAgent]:
        """获取用户可用的 Agent（激活且未淘汰）"""
        result = await self.db.execute(
            select(UserAgent).where(
                and_(
                    UserAgent.user_id == user_id,
                    UserAgent.is_active == True,
                    UserAgent.is_active == True
                )
            ).order_by(desc(UserAgent.current_weight))
        )
        return result.scalars().all()

    async def update_agent(
        self,
        agent_id: uuid.UUID,
        user_id: uuid.UUID,
        updates: Dict[str, Any]
    ) -> Optional[UserAgent]:
        """更新 Agent"""
        agent = await self.get_agent(agent_id, user_id)
        if not agent:
            return None

        # 特殊处理名称唯一性
        if "name" in updates:
            existing = await self.get_agent_by_name(user_id, updates["name"])
            if existing and existing.id != agent_id:
                raise ValueError(f"Agent 名称 '{updates['name']}' 已存在")
            # 更新 agent_key
            agent.agent_key = self._generate_agent_key(updates["name"])
            # 敏感词校验
            validate_sensitive_words(updates["name"], "Agent名称")

        # 敏感词校验 - 描述
        if "description" in updates and updates["description"]:
            validate_sensitive_words(updates["description"], "Agent描述")

        # 敏感词校验 - 提示词
        if "prompt" in updates:
            prompt = updates["prompt"]
            if prompt.get("system_prompt"):
                validate_sensitive_words(prompt["system_prompt"], "系统提示词")
            if prompt.get("user_prompt_template"):
                validate_sensitive_words(prompt["user_prompt_template"], "用户提示词模板")

        # 加密 API Key
        if "llm_config" in updates and updates["llm_config"].get("api_key"):
            updates["llm_config"]["api_key"] = APIKeyEncryption.encrypt(
                updates["llm_config"]["api_key"],
                user_id
            )

        for key, value in updates.items():
            if hasattr(agent, key):
                setattr(agent, key, value)

        await self.db.commit()
        await self.db.refresh(agent)
        return agent

    async def update_weight(
        self,
        agent_id: uuid.UUID,
        user_id: uuid.UUID,
        manual_weight_score: int,
        use_manual_weight: bool
    ) -> Optional[UserAgent]:
        """更新 Agent 权重分"""
        agent = await self.get_agent(agent_id, user_id)
        if not agent:
            return None

        agent.manual_weight_score = manual_weight_score
        agent.use_manual_weight = use_manual_weight

        await self.db.commit()
        await self.db.refresh(agent)
        return agent

    async def delete_agent(self, agent_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """删除 Agent"""
        agent = await self.get_agent(agent_id, user_id)
        if not agent:
            return False

        await self.db.delete(agent)
        await self.db.commit()
        return True

    def _generate_agent_key(self, name: str) -> str:
        """生成 agent_key"""
        import re
        # 转小写，替换空格为下划线，移除特殊字符
        key = re.sub(r'[^\w\s-]', '', name.lower())
        key = re.sub(r'[-\s]+', '_', key)
        # 添加随机后缀避免冲突
        suffix = uuid.uuid4().hex[:6]
        return f"{key}_{suffix}"

    # ========== 决策引擎（按用户隔离） ==========

    async def calculate_weighted_decision(
        self,
        user_id: uuid.UUID,
        stock_code: str,
        agent_ids: Optional[List[uuid.UUID]] = None,
        temperature: float = 1.0,
        randomness: float = 0.1,
        min_confidence: float = 0.5,
        input_data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        计算加权决策结果（按用户隔离）

        流程：
        1. 获取用户指定的 Agent 列表
        2. 对每个 Agent 调用 LLM 获取决策
        3. 使用 Softmax 计算权重
        4. 综合决策结果
        """
        start_time = datetime.utcnow()

        # 获取 Agent 列表
        if agent_ids:
            agents = []
            for aid in agent_ids:
                agent = await self.get_agent(aid, user_id)
                if agent and agent.is_available:
                    agents.append(agent)
        else:
            agents = await self.get_active_agents(user_id)

        if not agents:
            raise ValueError("没有可用的 Agent")

        # 调用每个 Agent 进行决策（模拟，实际需要实现 LLM 调用）
        agent_votes = []
        for agent in agents:
            vote = await self._call_agent_decision(
                agent, stock_code, input_data
            )
            agent_votes.append(vote)

        # 计算加权决策
        result = self._compute_weighted_decision(
            agent_votes,
            temperature=temperature,
            randomness=randomness
        )

        execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000

        return {
            "final_decision": result["decision"],
            "confidence": result["confidence"],
            "total_votes": len(agent_votes),
            "vote_breakdown": result["vote_breakdown"],
            "weighted_scores": result["weighted_scores"],
            "agent_votes": agent_votes,
            "algorithm_version": f"user_weighted_v1.0_temp{temperature}",
            "execution_time_ms": int(execution_time),
        }

    async def _call_agent_decision(
        self,
        agent: UserAgent,
        stock_code: str,
        input_data: Optional[Dict]
    ) -> Dict:
        """调用单个 Agent 进行决策"""
        import time

        start = time.time()

        # TODO: 实际调用 LLM
        # 这里模拟决策结果
        decisions = ["buy", "sell", "hold"]
        decision = random.choice(decisions)
        confidence = random.uniform(0.5, 0.95)

        inference_time = int((time.time() - start) * 1000)

        return {
            "agent_id": agent.id,
            "agent_name": agent.name,
            "agent_key": agent.agent_key,
            "decision": decision,
            "confidence": confidence,
            "reasoning": f"基于{agent.category}分析",
            "weight_contribution": 0.0,  # 后续计算
            "weight_score": agent.current_weight,
            "model_used": agent.llm_config.get("model_name", "unknown"),
            "inference_time_ms": inference_time,
        }

    def _compute_weighted_decision(
        self,
        votes: List[Dict],
        temperature: float = 1.0,
        randomness: float = 0.1
    ) -> Dict:
        """计算加权决策"""
        if not votes:
            raise ValueError("投票列表为空")

        # 获取权重分
        weights = {v["agent_id"]: v["weight_score"] for v in votes}

        # Softmax 归一化
        normalized = self._softmax_normalize(weights, temperature)

        # 计算各决策的加权得分
        decision_scores = {"buy": 0.0, "sell": 0.0, "hold": 0.0}

        for vote in votes:
            weight = normalized.get(vote["agent_id"], 0)
            contribution = weight * vote["confidence"]
            decision_scores[vote["decision"]] += contribution
            vote["weight_contribution"] = contribution

        # 添加随机扰动
        if randomness > 0:
            for decision in decision_scores:
                noise = random.uniform(-randomness, randomness) * 0.1
                decision_scores[decision] += noise

        # 选择最终决策
        final_decision = max(decision_scores, key=decision_scores.get)
        total_score = sum(decision_scores.values())
        confidence = decision_scores[final_decision] / total_score if total_score > 0 else 0

        # 统计票数
        vote_breakdown = {}
        for v in votes:
            vote_breakdown[v["decision"]] = vote_breakdown.get(v["decision"], 0) + 1

        return {
            "decision": final_decision,
            "confidence": min(confidence, 1.0),
            "vote_breakdown": vote_breakdown,
            "weighted_scores": decision_scores,
        }

    def _softmax_normalize(
        self,
        weights: Dict[uuid.UUID, int],
        temperature: float = 1.0
    ) -> Dict[uuid.UUID, float]:
        """Softmax 归一化"""
        if not weights:
            return {}

        scores = [s / temperature for s in weights.values()]
        max_score = max(scores)
        exp_scores = [math.exp(s - max_score) for s in scores]
        sum_exp = sum(exp_scores)

        return {k: exp_scores[i] / sum_exp for i, k in enumerate(weights.keys())}

    # ========== 每日复盘评估（按用户隔离） ==========

    async def evaluate_daily_performance(
        self,
        user_id: uuid.UUID,
        evaluation_date: Optional[date] = None
    ) -> List[UserAgentHistory]:
        """
        用户维度的每日复盘评估
        """
        eval_date = evaluation_date or date.today()

        # 获取用户的所有活跃 Agent
        agents = await self.get_active_agents(user_id)
        if len(agents) < 2:
            return []

        # 统计各 Agent 表现
        performance_list = []
        for agent in agents:
            stats = await self._get_agent_daily_stats(agent.id, eval_date)
            performance_list.append({"agent": agent, **stats})

        # 按成功率排序
        performance_list.sort(
            key=lambda x: (x["success_rate"] or 0, x["total_signals"]),
            reverse=True
        )

        histories = []
        total_agents = len(performance_list)

        for rank, perf in enumerate(performance_list, 1):
            agent = perf["agent"]
            is_last = (rank == total_agents)

            old_score = agent.auto_weight_score

            if is_last and perf["total_signals"] > 0:
                # 排名末尾扣分
                new_score = max(0, old_score - 1)
                score_change = -1
                reason = f"当日排名末尾（{rank}/{total_agents}），成功率 {perf['success_rate']:.1f}%"
            else:
                new_score = old_score
                score_change = 0
                reason = f"当日排名 {rank}/{total_agents}，保持分数"

            # 检查预警（替换自动淘汰）
            if new_score < 60:
                if not agent.is_at_risk:
                    agent.is_at_risk = True
                    agent.last_risk_warning_at = datetime.utcnow()
                    agent.risk_warning_count = 1
                else:
                    agent.risk_warning_count += 1
            else:
                # 分数恢复，清除预警
                agent.is_at_risk = False
                agent.risk_warning_count = 0

            # 更新 Agent
            agent.auto_weight_score = new_score
            agent.total_signals += perf["total_signals"]
            agent.success_count += perf["success_count"]
            agent.failure_count += perf["failure_count"]
            if agent.total_signals > 0:
                agent.success_rate = Decimal(
                    agent.success_count / agent.total_signals * 100
                )

            # 创建历史记录
            history = UserAgentHistory(
                agent_id=agent.id,
                user_id=user_id,
                evaluation_date=eval_date,
                daily_signals=perf["total_signals"],
                daily_success=perf["success_count"],
                daily_failure=perf["failure_count"],
                daily_success_rate=Decimal(perf["success_rate"]) if perf["success_rate"] else None,
                daily_rank=rank,
                total_active_agents=total_agents,
                score_before=old_score,
                score_after=new_score,
                score_change=score_change,
                adjustment_reason=reason,
            )
            self.db.add(history)
            histories.append(history)

        await self.db.commit()
        return histories

    async def _get_agent_daily_stats(
        self,
        agent_id: uuid.UUID,
        eval_date: date
    ) -> Dict:
        """获取 Agent 当日统计"""
        # 查询 UserAgentDecision 表
        result = await self.db.execute(
            select(
                func.count(UserAgentDecision.id).label("total"),
                func.sum(func.case((UserAgentDecision.decision == "buy", 1), else_=0)).label("buy_count"),
            ).where(
                UserAgentDecision.agent_id == agent_id,
                func.date(UserAgentDecision.created_at) == eval_date
            )
        )
        row = result.one()

        # 简化处理，实际需要关联复盘结果
        total = row.total or 0
        success = int(total * 0.6)  # 模拟

        return {
            "total_signals": total,
            "success_count": success,
            "failure_count": total - success,
            "success_rate": (success / total * 100) if total > 0 else 0,
        }

    # ========== 统计与排名 ==========

    async def get_user_stats(self, user_id: uuid.UUID) -> Dict:
        """获取用户的 Agent 统计"""
        result = await self.db.execute(
            select(
                func.count().label("total"),
                func.sum(func.case((UserAgent.is_active == True, 1), else_=0)).label("active"),
                func.sum(func.case((UserAgent.is_at_risk == True, 1), else_=0)).label("at_risk"),
                func.avg(UserAgent.current_weight).label("avg_weight"),
                func.sum(UserAgent.total_signals).label("total_signals"),
            ).where(UserAgent.user_id == user_id)
        )
        stats = result.one()

        # 获取表现最好和最差的 Agent
        top_result = await self.db.execute(
            select(UserAgent).where(
                and_(UserAgent.user_id == user_id, UserAgent.is_active == True)
            ).order_by(desc(UserAgent.success_rate)).limit(3)
        )
        top_agents = top_result.scalars().all()

        at_risk_result = await self.db.execute(
            select(UserAgent).where(
                and_(
                    UserAgent.user_id == user_id,
                    UserAgent.is_active == True,
                    UserAgent.current_weight < 70
                )
            ).order_by(UserAgent.current_weight).limit(3)
        )
        at_risk = at_risk_result.scalars().all()

        return {
            "total_agents": stats.total or 0,
            "active_agents": stats.active or 0,
            "at_risk_agents": stats.at_risk or 0,
            "avg_weight_score": round(float(stats.avg_weight or 0), 2),
            "total_signals_generated": stats.total_signals or 0,
            "top_performers": [
                {"id": a.id, "name": a.name, "success_rate": float(a.success_rate or 0)}
                for a in top_agents
            ],
            "at_risk_agents_list": [
                {"id": a.id, "name": a.name, "current_weight": a.current_weight}
                for a in at_risk
            ],
        }


# 便捷函数
def get_user_agent_service(db: AsyncSession) -> UserAgentService:
    """获取 UserAgentService 实例"""
    return UserAgentService(db)


def get_agent_market_service(db: AsyncSession) -> AgentMarketService:
    """获取 AgentMarketService 实例"""
    return AgentMarketService(db)


class AgentRebateService:
    """Agent 订阅返佣服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_rebate(
        self,
        subscription_id: str,
        owner_id: uuid.UUID,
        subscriber_id: uuid.UUID,
        template_id: uuid.UUID,
        subscription_amount: Decimal,
        subscription_days: int,
    ) -> "AgentSubscriptionRebate":
        """
        创建返佣记录

        规则：
        1. 检查返佣是否启用
        2. 检查订阅天数是否满足最小要求
        3. 计算返佣金额（可配置固定金额或比例）
        4. 设置结算时间（退款期后）
        """
        from app.models.agent_market import AgentSubscriptionRebate
        from app.core.config import settings

        # 检查返佣是否启用
        if not settings.AGENT_SUBSCRIPTION_REBATE_ENABLED:
            raise ValueError("返佣功能未启用")

        # 检查订阅天数是否满足最小要求
        if subscription_days < settings.AGENT_SUBSCRIPTION_REBATE_MIN_VIP_DAYS:
            raise ValueError(
                f"订阅天数不足，需要至少 {settings.AGENT_SUBSCRIPTION_REBATE_MIN_VIP_DAYS} 天才能触发返佣"
            )

        # 计算返佣金额（固定金额）
        rebate_amount = Decimal(str(settings.AGENT_SUBSCRIPTION_REBATE_AMOUNT))

        # 计算结算时间（退款期后）
        settlement_at = datetime.utcnow() + timedelta(
            days=settings.AGENT_SUBSCRIPTION_REBATE_SETTLEMENT_DAYS
        )

        # 检查是否已存在
        result = await self.db.execute(
            select(AgentSubscriptionRebate).where(
                AgentSubscriptionRebate.subscription_id == subscription_id
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            raise ValueError(f"返佣记录已存在: {subscription_id}")

        # 创建返佣记录
        rebate = AgentSubscriptionRebate(
            subscription_id=subscription_id,
            owner_id=owner_id,
            subscriber_id=subscriber_id,
            template_id=template_id,
            rebate_amount=rebate_amount,
            subscription_amount=subscription_amount,
            subscription_days=subscription_days,
            status="pending",
            settlement_at=settlement_at,
        )
        self.db.add(rebate)

        # 更新 Owner 统计
        await self._update_owner_stats_on_new_rebate(owner_id, rebate_amount)

        await self.db.commit()
        await self.db.refresh(rebate)
        return rebate

    async def _update_owner_stats_on_new_rebate(
        self, owner_id: uuid.UUID, rebate_amount: Decimal
    ):
        """更新 Owner 统计（新增返佣时）"""
        from app.models.agent_market import AgentOwnerStats

        result = await self.db.execute(
            select(AgentOwnerStats).where(AgentOwnerStats.owner_id == owner_id)
        )
        stats = result.scalar_one_or_none()

        if stats:
            stats.total_rebate_earned += rebate_amount
            stats.pending_rebate += rebate_amount
            stats.total_subscribers += 1
            stats.this_month_rebate += rebate_amount
            stats.this_month_subscribers += 1
            stats.last_updated = datetime.utcnow()
        else:
            stats = AgentOwnerStats(
                owner_id=owner_id,
                total_rebate_earned=rebate_amount,
                pending_rebate=rebate_amount,
                settled_rebate=Decimal("0"),
                cancelled_rebate=Decimal("0"),
                total_subscribers=1,
                active_subscribers=0,  # 需要额外计算
                this_month_rebate=rebate_amount,
                this_month_subscribers=1,
            )
            self.db.add(stats)

    async def settle_rebate(self, rebate_id: int) -> "AgentSubscriptionRebate":
        """结算返佣（退款期过后）"""
        from app.models.agent_market import AgentSubscriptionRebate, AgentOwnerStats

        result = await self.db.execute(
            select(AgentSubscriptionRebate).where(AgentSubscriptionRebate.id == rebate_id)
        )
        rebate = result.scalar_one_or_none()

        if not rebate:
            raise ValueError("返佣记录不存在")

        if rebate.status != "pending":
            raise ValueError(f"返佣状态不正确: {rebate.status}")

        # 更新返佣状态
        rebate.status = "settled"
        rebate.settled_at = datetime.utcnow()

        # 更新 Owner 统计
        result = await self.db.execute(
            select(AgentOwnerStats).where(AgentOwnerStats.owner_id == rebate.owner_id)
        )
        stats = result.scalar_one_or_none()
        if stats:
            stats.pending_rebate -= rebate.rebate_amount
            stats.settled_rebate += rebate.rebate_amount
            stats.last_updated = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(rebate)
        return rebate

    async def cancel_rebate_on_refund(
        self, subscription_id: str, refund_amount: Decimal
    ) -> "AgentSubscriptionRebate":
        """用户退款时取消返佣"""
        from app.models.agent_market import AgentSubscriptionRebate, AgentOwnerStats

        result = await self.db.execute(
            select(AgentSubscriptionRebate).where(
                AgentSubscriptionRebate.subscription_id == subscription_id
            )
        )
        rebate = result.scalar_one_or_none()

        if not rebate:
            raise ValueError("返佣记录不存在")

        if rebate.status == "settled":
            # 已结算的返佣需要追回
            # 这里可以实现扣除逻辑或标记为待追回
            pass

        # 更新返佣状态
        old_status = rebate.status
        rebate.status = "refunded"
        rebate.refunded_at = datetime.utcnow()
        rebate.refund_amount = refund_amount

        # 更新 Owner 统计
        result = await self.db.execute(
            select(AgentOwnerStats).where(AgentOwnerStats.owner_id == rebate.owner_id)
        )
        stats = result.scalar_one_or_none()
        if stats:
            if old_status == "pending":
                stats.pending_rebate -= rebate.rebate_amount
            elif old_status == "settled":
                stats.settled_rebate -= rebate.rebate_amount
            stats.cancelled_rebate += rebate.rebate_amount
            stats.total_subscribers -= 1
            stats.last_updated = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(rebate)
        return rebate

    async def get_owner_rebates(
        self,
        owner_id: uuid.UUID,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ):
        """获取 Owner 的返佣记录"""
        from app.models.agent_market import AgentSubscriptionRebate

        query = select(AgentSubscriptionRebate).where(
            AgentSubscriptionRebate.owner_id == owner_id
        )

        if status:
            query = query.where(AgentSubscriptionRebate.status == status)

        query = query.order_by(desc(AgentSubscriptionRebate.created_at))

        total_result = await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = total_result.scalar()

        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        rebates = result.scalars().all()

        return rebates, total

    async def get_owner_stats(self, owner_id: uuid.UUID) -> Dict:
        """获取 Owner 的收益统计"""
        from app.models.agent_market import AgentOwnerStats

        result = await self.db.execute(
            select(AgentOwnerStats).where(AgentOwnerStats.owner_id == owner_id)
        )
        stats = result.scalar_one_or_none()

        if not stats:
            return {
                "total_agents": 0,
                "public_agents": 0,
                "featured_agents": 0,
                "total_subscribers": 0,
                "active_subscribers": 0,
                "total_rebate_earned": 0,
                "pending_rebate": 0,
                "settled_rebate": 0,
                "this_month_rebate": 0,
                "this_month_subscribers": 0,
            }

        return {
            "total_agents": stats.total_agents,
            "public_agents": stats.public_agents,
            "featured_agents": stats.featured_agents,
            "total_subscribers": stats.total_subscribers,
            "active_subscribers": stats.active_subscribers,
            "total_rebate_earned": float(stats.total_rebate_earned),
            "pending_rebate": float(stats.pending_rebate),
            "settled_rebate": float(stats.settled_rebate),
            "this_month_rebate": float(stats.this_month_rebate),
            "this_month_subscribers": stats.this_month_subscribers,
        }

    async def process_pending_settlements(self):
        """
        处理待结算的返佣（定时任务调用）
        结算所有 settlement_at 已到期的 pending 返佣
        """
        from app.models.agent_market import AgentSubscriptionRebate

        now = datetime.utcnow()

        result = await self.db.execute(
            select(AgentSubscriptionRebate).where(
                and_(
                    AgentSubscriptionRebate.status == "pending",
                    AgentSubscriptionRebate.settlement_at <= now,
                )
            )
        )
        pending_rebates = result.scalars().all()

        settled_count = 0
        for rebate in pending_rebates:
            try:
                await self.settle_rebate(rebate.id)
                settled_count += 1
            except Exception as e:
                # 记录错误，继续处理下一个
                print(f"结算返佣失败 {rebate.id}: {e}")

        await self.db.commit()
        return settled_count


# 便捷函数
def get_agent_rebate_service(db: AsyncSession) -> AgentRebateService:
    """获取 AgentRebateService 实例"""
    return AgentRebateService(db)
