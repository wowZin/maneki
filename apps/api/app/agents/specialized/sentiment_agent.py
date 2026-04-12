"""
情绪Agent实现

专注于市场情绪、新闻资讯、舆情分析
"""

import json
from typing import Any, Dict, List, Optional

from app.agents.base.agent import BaseAgent, AgentDecision, AgentInput, AgentOutput, DecisionType
from app.agents.prompts.sentiment_prompt import SENTIMENT_SYSTEM_PROMPT
from app.agents.registry import registry


@registry.register
class SentimentAgent(BaseAgent):
    """
    情绪Agent

    通过新闻舆情、社交媒体情绪、市场情绪指标来预测涨停概率
    """

    name: str = "情绪Agent"
    agent_type: str = "sentiment"
    version: str = "1.0.0"
    description: str = "分析市场情绪、新闻资讯、舆情热度"

    def get_system_prompt(self) -> str:
        """返回情绪Agent的系统提示词"""
        return SENTIMENT_SYSTEM_PROMPT

    async def gather_information(self, stock_codes: List[str]) -> Dict[str, Any]:
        """
        收集情绪相关信息

        Args:
            stock_codes: 股票代码列表

        Returns:
            情绪信息字典
        """
        self.logger.info(f"收集 {len(stock_codes)} 只股票的情绪信息")

        information = {
            "market_sentiment": await self._get_market_sentiment(),
            "stock_news": {},
            "social_sentiment": {},
            "sector_sentiment": {},
        }

        # 获取每只股票的信息
        for code in stock_codes:
            information["stock_news"][code] = await self._get_stock_news(code)
            information["social_sentiment"][code] = await self._get_social_sentiment(code)
            information["sector_sentiment"][code] = await self._get_sector_sentiment(code)

        return information

    async def analyze(
        self,
        stock_codes: List[str],
        information: Dict[str, Any],
        market_context: Optional[Dict] = None
    ) -> List[AgentDecision]:
        """
        执行情绪分析

        Args:
            stock_codes: 股票代码列表
            information: 收集的信息
            market_context: 市场环境信息

        Returns:
            决策列表
        """
        decisions = []

        for code in stock_codes:
            try:
                decision = await self._analyze_single_stock(
                    code, information, market_context
                )
                decisions.append(decision)
            except Exception as e:
                self.logger.error(f"分析 {code} 时出错: {e}")
                decisions.append(AgentDecision(
                    stock_code=code,
                    decision=DecisionType.ABSTAIN,
                    confidence=0.0,
                    reasoning=f"分析失败: {str(e)}"
                ))

        return decisions

    async def _analyze_single_stock(
        self,
        code: str,
        information: Dict[str, Any],
        market_context: Optional[Dict]
    ) -> AgentDecision:
        """分析单只股票"""
        # 获取该股票的相关信息
        news = information.get("stock_news", {}).get(code, [])
        social = information.get("social_sentiment", {}).get(code, {})
        sector = information.get("sector_sentiment", {}).get(code, {})
        market = information.get("market_sentiment", {})

        # 计算情绪得分
        sentiment_score = self._calculate_sentiment_score(
            news, social, sector, market
        )

        # 根据得分确定决策
        if sentiment_score >= 0.8:
            decision = DecisionType.STRONG_BUY
            confidence = sentiment_score
        elif sentiment_score >= 0.6:
            decision = DecisionType.BUY
            confidence = sentiment_score
        elif sentiment_score >= 0.4:
            decision = DecisionType.HOLD
            confidence = 0.5
        elif sentiment_score >= 0.2:
            decision = DecisionType.SELL
            confidence = 1 - sentiment_score
        else:
            decision = DecisionType.STRONG_SELL
            confidence = 1 - sentiment_score

        # 构建理由和信号
        reasoning = self._build_reasoning(code, news, social, sector, sentiment_score)
        signals = self._build_signals(news, social, sector)
        risk_factors = self._build_risk_factors(news, social)

        return AgentDecision(
            stock_code=code,
            decision=decision,
            confidence=confidence,
            reasoning=reasoning,
            signals=signals,
            risk_factors=risk_factors,
            time_horizon="short"
        )

    def _calculate_sentiment_score(
        self,
        news: List[Dict],
        social: Dict,
        sector: Dict,
        market: Dict
    ) -> float:
        """计算情绪得分 (0-1)"""
        score = 0.5  # 基准分

        # 新闻因素 (40%)
        news_score = self._evaluate_news(news)
        score += (news_score - 0.5) * 0.4

        # 社交媒体情绪 (30%)
        social_score = social.get("sentiment_score", 0.5)
        heat_score = social.get("heat_score", 0.5)
        score += (social_score - 0.5) * 0.15
        score += (heat_score - 0.5) * 0.15

        # 板块情绪 (20%)
        sector_score = sector.get("sentiment", 0.5)
        score += (sector_score - 0.5) * 0.2

        # 市场情绪 (10%)
        market_score = market.get("overall_sentiment", 0.5)
        score += (market_score - 0.5) * 0.1

        return max(0.0, min(1.0, score))

    def _evaluate_news(self, news: List[Dict]) -> float:
        """评估新闻情绪"""
        if not news:
            return 0.5

        positive = sum(1 for n in news if n.get("sentiment") == "positive")
        negative = sum(1 for n in news if n.get("sentiment") == "negative")
        total = len(news)

        if total == 0:
            return 0.5

        return (positive + 0.5 * (total - positive - negative)) / total

    def _build_reasoning(
        self,
        code: str,
        news: List[Dict],
        social: Dict,
        sector: Dict,
        score: float
    ) -> str:
        """构建分析理由"""
        reasons = []

        # 新闻理由
        important_news = [n for n in news if n.get("importance", 0) > 0.7]
        if important_news:
            reasons.append(f"重要新闻: {important_news[0].get('title', '')}")

        # 社交媒体理由
        heat = social.get("heat_score", 0)
        if heat > 0.8:
            reasons.append(f"社交媒体热度极高(热度分: {heat:.2f})")
        elif heat > 0.6:
            reasons.append(f"社交媒体热度较高(热度分: {heat:.2f})")

        # 板块理由
        sector_name = sector.get("name", "")
        sector_sentiment = sector.get("sentiment", 0.5)
        if sector_sentiment > 0.7:
            reasons.append(f"所属{sector_name}板块情绪高涨")

        # 综合评分
        reasons.append(f"综合情绪得分: {score:.2f}")

        return "; ".join(reasons) if reasons else "情绪分析中性"

    def _build_signals(
        self,
        news: List[Dict],
        social: Dict,
        sector: Dict
    ) -> List[str]:
        """构建关键信号列表"""
        signals = []

        # 新闻信号
        for n in news[:2]:  # 只取前2条重要新闻
            if n.get("sentiment") == "positive":
                signals.append(f"利好: {n.get('title', '')[:30]}...")

        # 社交媒体信号
        heat = social.get("heat_score", 0)
        if heat > 0.8:
            signals.append(f"舆情热度: 热度排名前10")

        # 板块信号
        sector_name = sector.get("name", "")
        sector_change = sector.get("change_pct", 0)
        if sector_change > 3:
            signals.append(f"板块效应: {sector_name}板块涨幅{sector_change:.1f}%")

        return signals

    def _build_risk_factors(
        self,
        news: List[Dict],
        social: Dict
    ) -> List[str]:
        """构建风险因素列表"""
        risks = []

        # 负面新闻
        negative_news = [n for n in news if n.get("sentiment") == "negative"]
        if negative_news:
            risks.append(f"存在负面新闻: {negative_news[0].get('title', '')[:20]}...")

        # 情绪过热风险
        heat = social.get("heat_score", 0)
        if heat > 0.9:
            risks.append("情绪极度过热，存在一致性预期风险")

        # 一致性风险
        sentiment = social.get("sentiment_score", 0.5)
        if sentiment > 0.9 or sentiment < 0.1:
            risks.append("市场情绪过于一致，注意反向风险")

        return risks if risks else ["暂无显著风险"]

    # ========== 数据获取方法（后续接入真实数据源）==========

    async def _get_market_sentiment(self) -> Dict:
        """获取市场整体情绪"""
        # TODO: 接入真实数据源
        return {
            "overall_sentiment": 0.6,
            "limit_up_count": 50,
            "limit_down_count": 5,
            "up_down_ratio": 2.5,
        }

    async def _get_stock_news(self, code: str) -> List[Dict]:
        """获取股票新闻"""
        # TODO: 接入真实数据源（东方财富、同花顺等）
        return []

    async def _get_social_sentiment(self, code: str) -> Dict:
        """获取社交媒体情绪"""
        # TODO: 接入真实数据源（雪球、股吧等）
        return {
            "sentiment_score": 0.6,
            "heat_score": 0.5,
            "mention_count": 100,
        }

    async def _get_sector_sentiment(self, code: str) -> Dict:
        """获取板块情绪"""
        # TODO: 接入真实数据源
        return {
            "name": "科技",
            "sentiment": 0.6,
            "change_pct": 2.5,
        }
