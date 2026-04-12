"""
技术Agent实现

专注于技术指标、K线形态、趋势分析
"""

from typing import Any, Dict, List, Optional

from app.agents.base.agent import BaseAgent, AgentDecision, AgentInput, AgentOutput, DecisionType
from app.agents.prompts.technical_prompt import TECHNICAL_SYSTEM_PROMPT
from app.agents.registry import registry


@registry.register
class TechnicalAgent(BaseAgent):
    """
    技术Agent

    通过技术指标、K线形态、量价关系来预测涨停概率
    """

    name: str = "技术Agent"
    agent_type: str = "technical"
    version: str = "1.0.0"
    description: str = "分析技术指标、K线形态、量价关系"

    def get_system_prompt(self) -> str:
        """返回技术Agent的系统提示词"""
        return TECHNICAL_SYSTEM_PROMPT

    async def gather_information(self, stock_codes: List[str]) -> Dict[str, Any]:
        """
        收集技术相关信息

        Args:
            stock_codes: 股票代码列表

        Returns:
            技术信息字典
        """
        self.logger.info(f"收集 {len(stock_codes)} 只股票的技术信息")

        information = {
            "kline_data": {},
            "technical_indicators": {},
            "volume_analysis": {},
            "price_levels": {},
        }

        for code in stock_codes:
            information["kline_data"][code] = await self._get_kline_data(code)
            information["technical_indicators"][code] = await self._get_technical_indicators(code)
            information["volume_analysis"][code] = await self._get_volume_analysis(code)
            information["price_levels"][code] = await self._get_price_levels(code)

        return information

    async def analyze(
        self,
        stock_codes: List[str],
        information: Dict[str, Any],
        market_context: Optional[Dict] = None
    ) -> List[AgentDecision]:
        """
        执行技术分析

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
        # 获取技术数据
        kline = information.get("kline_data", {}).get(code, {})
        indicators = information.get("technical_indicators", {}).get(code, {})
        volume = information.get("volume_analysis", {}).get(code, {})
        price_levels = information.get("price_levels", {}).get(code, {})

        # 计算技术得分
        tech_score = self._calculate_technical_score(
            kline, indicators, volume, price_levels
        )

        # 根据得分确定决策
        if tech_score >= 0.8:
            decision = DecisionType.STRONG_BUY
            confidence = tech_score
        elif tech_score >= 0.6:
            decision = DecisionType.BUY
            confidence = tech_score
        elif tech_score >= 0.4:
            decision = DecisionType.HOLD
            confidence = 0.5
        elif tech_score >= 0.2:
            decision = DecisionType.SELL
            confidence = 1 - tech_score
        else:
            decision = DecisionType.STRONG_SELL
            confidence = 1 - tech_score

        # 构建理由和信号
        reasoning = self._build_reasoning(code, kline, indicators, volume, tech_score)
        signals = self._build_signals(kline, indicators, volume, price_levels)
        risk_factors = self._build_risk_factors(kline, volume, indicators)

        return AgentDecision(
            stock_code=code,
            decision=decision,
            confidence=confidence,
            reasoning=reasoning,
            signals=signals,
            risk_factors=risk_factors,
            time_horizon="short"
        )

    def _calculate_technical_score(
        self,
        kline: Dict,
        indicators: Dict,
        volume: Dict,
        price_levels: Dict
    ) -> float:
        """计算技术得分 (0-1)"""
        score = 0.5  # 基准分

        # 涨停形态 (35%)
        pattern_score = self._evaluate_pattern(kline)
        score += (pattern_score - 0.5) * 0.35

        # 趋势结构 (25%)
        trend_score = self._evaluate_trend(kline, indicators)
        score += (trend_score - 0.5) * 0.25

        # 量价配合 (25%)
        volume_score = self._evaluate_volume(kline, volume)
        score += (volume_score - 0.5) * 0.25

        # 技术指标 (15%)
        indicator_score = self._evaluate_indicators(indicators)
        score += (indicator_score - 0.5) * 0.15

        return max(0.0, min(1.0, score))

    def _evaluate_pattern(self, kline: Dict) -> float:
        """评估K线形态"""
        score = 0.5

        # 涨停板类型
        limit_type = kline.get("limit_up_type", "")
        if limit_type == "一字板":
            score += 0.3
        elif limit_type == "T字板":
            score += 0.2
        elif limit_type == "早盘板":
            score += 0.15

        # 是否有上影线
        if kline.get("has_upper_shadow", False):
            score -= 0.1

        # 近期连板数
        consecutive_limits = kline.get("consecutive_limits", 0)
        if consecutive_limits >= 3:
            score -= 0.1  # 高位风险
        elif consecutive_limits == 1:
            score += 0.1  # 首板加分

        return max(0.0, min(1.0, score))

    def _evaluate_trend(self, kline: Dict, indicators: Dict) -> float:
        """评估趋势"""
        score = 0.5

        # 均线排列
        ma_trend = indicators.get("ma_trend", "neutral")
        if ma_trend == "bullish":
            score += 0.2
        elif ma_trend == "bearish":
            score -= 0.2

        # 股价位置
        position = kline.get("price_position", "middle")
        if position == "low":
            score += 0.15
        elif position == "high":
            score -= 0.1

        # 趋势角度
        trend_angle = kline.get("trend_angle", 0)
        if trend_angle > 45:
            score += 0.1

        return max(0.0, min(1.0, score))

    def _evaluate_volume(self, kline: Dict, volume: Dict) -> float:
        """评估量价关系"""
        score = 0.5

        # 换手率
        turnover = volume.get("turnover_rate", 0)
        if 0.05 < turnover < 0.25:  # 5%-25% 理想
            score += 0.15
        elif turnover > 0.40:  # 超过40% 风险
            score -= 0.15
        elif turnover < 0.02:  # 低于2% 不活跃
            score -= 0.1

        # 量比
        volume_ratio = volume.get("volume_ratio", 1.0)
        if 1.5 < volume_ratio < 5.0:
            score += 0.1
        elif volume_ratio > 10:  # 放量过大
            score -= 0.1

        # 涨停封单质量
        bid_amount = volume.get("limit_up_bid_amount", 0)
        if bid_amount > 100000000:  # 封单金额 > 1亿
            score += 0.1

        return max(0.0, min(1.0, score))

    def _evaluate_indicators(self, indicators: Dict) -> float:
        """评估技术指标"""
        score = 0.5

        # MACD
        macd = indicators.get("macd", {})
        if macd.get("signal") == "golden_cross":
            score += 0.1
        elif macd.get("signal") == "death_cross":
            score -= 0.1

        # KDJ
        kdj = indicators.get("kdj", {})
        if kdj.get("k", 50) > kdj.get("d", 50) and kdj.get("k", 50) < 80:
            score += 0.1
        elif kdj.get("k", 50) > 80:
            score -= 0.05  # 超买

        # RSI
        rsi = indicators.get("rsi", 50)
        if 40 < rsi < 70:
            score += 0.05
        elif rsi > 80:
            score -= 0.1

        return max(0.0, min(1.0, score))

    def _build_reasoning(
        self,
        code: str,
        kline: Dict,
        indicators: Dict,
        volume: Dict,
        score: float
    ) -> str:
        """构建分析理由"""
        reasons = []

        # 涨停形态理由
        limit_type = kline.get("limit_up_type", "")
        if limit_type:
            reasons.append(f"涨停类型: {limit_type}")

        consecutive = kline.get("consecutive_limits", 0)
        if consecutive > 0:
            reasons.append(f"连板数: {consecutive}连板")

        # 技术指标理由
        ma_trend = indicators.get("ma_trend", "")
        if ma_trend == "bullish":
            reasons.append("均线多头排列")

        macd_signal = indicators.get("macd", {}).get("signal", "")
        if macd_signal == "golden_cross":
            reasons.append("MACD金叉")

        # 量价理由
        turnover = volume.get("turnover_rate", 0)
        if turnover > 0:
            reasons.append(f"换手率: {turnover*100:.1f}%")

        bid_amount = volume.get("limit_up_bid_amount", 0)
        if bid_amount > 0:
            reasons.append(f"涨停封单: {bid_amount/10000:.0f}万")

        # 综合评分
        reasons.append(f"技术得分: {score:.2f}")

        return "; ".join(reasons) if reasons else "技术分析中性"

    def _build_signals(
        self,
        kline: Dict,
        indicators: Dict,
        volume: Dict,
        price_levels: Dict
    ) -> List[str]:
        """构建关键信号列表"""
        signals = []

        # 形态信号
        limit_type = kline.get("limit_up_type", "")
        if limit_type in ["一字板", "T字板"]:
            signals.append(f"强势涨停: {limit_type}")

        # 趋势信号
        if indicators.get("ma_trend") == "bullish":
            signals.append("趋势信号: 均线多头排列")

        # 突破信号
        if price_levels.get("breakout", False):
            resistance = price_levels.get("resistance_price", 0)
            signals.append(f"突破信号: 突破压力位{resistance:.2f}")

        # 量能信号
        volume_ratio = volume.get("volume_ratio", 0)
        if volume_ratio > 2:
            signals.append(f"量能信号: 量比{volume_ratio:.1f}倍")

        return signals

    def _build_risk_factors(
        self,
        kline: Dict,
        volume: Dict,
        indicators: Dict
    ) -> List[str]:
        """构建风险因素列表"""
        risks = []

        # 高位风险
        consecutive = kline.get("consecutive_limits", 0)
        if consecutive >= 4:
            risks.append(f"高位风险: 已连续{consecutive}个涨停")

        # 放量风险
        turnover = volume.get("turnover_rate", 0)
        if turnover > 0.40:
            risks.append(f"放量风险: 换手率高达{turnover*100:.1f}%")

        # 技术指标风险
        kdj = indicators.get("kdj", {})
        if kdj.get("k", 0) > 85:
            risks.append("超买风险: KDJ进入超买区域")

        # 上影线风险
        if kline.get("has_upper_shadow", False):
            shadow_ratio = kline.get("upper_shadow_ratio", 0)
            if shadow_ratio > 0.03:
                risks.append(f"抛压风险: 上影线占比{shadow_ratio*100:.1f}%")

        return risks if risks else ["暂无显著技术风险"]

    # ========== 数据获取方法（后续接入真实数据源）==========

    async def _get_kline_data(self, code: str) -> Dict:
        """获取K线数据"""
        # TODO: 接入真实数据源
        return {
            "limit_up_type": "早盘板",
            "has_upper_shadow": False,
            "consecutive_limits": 1,
            "price_position": "low",
            "trend_angle": 30,
        }

    async def _get_technical_indicators(self, code: str) -> Dict:
        """获取技术指标"""
        # TODO: 接入真实数据源
        return {
            "ma_trend": "bullish",
            "macd": {"signal": "golden_cross", "diff": 0.5, "dea": 0.3},
            "kdj": {"k": 65, "d": 55, "j": 85},
            "rsi": 60,
        }

    async def _get_volume_analysis(self, code: str) -> Dict:
        """获取成交量分析"""
        # TODO: 接入真实数据源
        return {
            "turnover_rate": 0.15,
            "volume_ratio": 2.5,
            "limit_up_bid_amount": 150000000,
        }

    async def _get_price_levels(self, code: str) -> Dict:
        """获取价格水平"""
        # TODO: 接入真实数据源
        return {
            "support_price": 10.0,
            "resistance_price": 12.0,
            "breakout": True,
        }
