"""
资金Agent实现

专注于资金流向、主力动向、成交量分析
"""

from typing import Any, Dict, List, Optional

from app.agents.base.agent import BaseAgent, AgentDecision, DecisionType
from app.agents.prompts.capital_prompt import CAPITAL_SYSTEM_PROMPT
from app.agents.registry import registry


@registry.register
class CapitalAgent(BaseAgent):
    """
    资金Agent

    通过主力资金动向、龙虎榜数据、成交量分析来预测涨停概率
    """

    name: str = "资金Agent"
    agent_type: str = "capital"
    version: str = "1.0.0"
    description: str = "分析资金流向、主力动向、龙虎榜数据"

    def get_system_prompt(self) -> str:
        """返回资金Agent的系统提示词"""
        return CAPITAL_SYSTEM_PROMPT

    async def gather_information(self, stock_codes: List[str]) -> Dict[str, Any]:
        """
        收集资金相关信息

        Args:
            stock_codes: 股票代码列表

        Returns:
            资金信息字典
        """
        self.logger.info(f"收集 {len(stock_codes)} 只股票的资金信息")

        information = {
            "capital_flow": {},
            "dragon_list": {},
            "main_holders": {},
            "institution_holdings": {},
        }

        for code in stock_codes:
            information["capital_flow"][code] = await self._get_capital_flow(code)
            information["dragon_list"][code] = await self._get_dragon_list(code)
            information["main_holders"][code] = await self._get_main_holders(code)
            information["institution_holdings"][code] = await self._get_institution_holdings(code)

        return information

    async def analyze(
        self,
        stock_codes: List[str],
        information: Dict[str, Any],
        market_context: Optional[Dict] = None
    ) -> List[AgentDecision]:
        """
        执行资金分析

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
        # 获取资金数据
        flow = information.get("capital_flow", {}).get(code, {})
        dragon = information.get("dragon_list", {}).get(code, {})
        holders = information.get("main_holders", {}).get(code, {})
        institution = information.get("institution_holdings", {}).get(code, {})

        # 计算资金得分
        capital_score = self._calculate_capital_score(
            flow, dragon, holders, institution
        )

        # 根据得分确定决策
        if capital_score >= 0.8:
            decision = DecisionType.STRONG_BUY
            confidence = capital_score
        elif capital_score >= 0.6:
            decision = DecisionType.BUY
            confidence = capital_score
        elif capital_score >= 0.4:
            decision = DecisionType.HOLD
            confidence = 0.5
        elif capital_score >= 0.2:
            decision = DecisionType.SELL
            confidence = 1 - capital_score
        else:
            decision = DecisionType.STRONG_SELL
            confidence = 1 - capital_score

        # 构建理由和信号
        reasoning = self._build_reasoning(code, flow, dragon, holders, capital_score)
        signals = self._build_signals(flow, dragon, holders, institution)
        risk_factors = self._build_risk_factors(flow, dragon)

        return AgentDecision(
            stock_code=code,
            decision=decision,
            confidence=confidence,
            reasoning=reasoning,
            signals=signals,
            risk_factors=risk_factors,
            time_horizon="short"
        )

    def _calculate_capital_score(
        self,
        flow: Dict,
        dragon: Dict,
        holders: Dict,
        institution: Dict
    ) -> float:
        """计算资金得分 (0-1)"""
        score = 0.5  # 基准分

        # 主力资金流入 (40%)
        main_fund_score = self._evaluate_main_fund(flow)
        score += (main_fund_score - 0.5) * 0.40

        # 龙虎榜质量 (25%)
        dragon_score = self._evaluate_dragon_list(dragon)
        score += (dragon_score - 0.5) * 0.25

        # 成交量健康度 (20%)
        volume_score = self._evaluate_volume_health(flow)
        score += (volume_score - 0.5) * 0.20

        # 资金成本分析 (15%)
        cost_score = self._evaluate_cost(holders, institution)
        score += (cost_score - 0.5) * 0.15

        return max(0.0, min(1.0, score))

    def _evaluate_main_fund(self, flow: Dict) -> float:
        """评估主力资金"""
        score = 0.5

        # 近5日净流入
        net_inflow_5d = flow.get("net_inflow_5d", 0)
        if net_inflow_5d > 100000000:  # 1亿
            score += 0.3
        elif net_inflow_5d > 50000000:  # 5000万
            score += 0.2
        elif net_inflow_5d < -50000000:
            score -= 0.2

        # 大单买入占比
        big_order_ratio = flow.get("big_order_ratio", 0.5)
        if big_order_ratio > 0.6:
            score += 0.1
        elif big_order_ratio < 0.4:
            score -= 0.1

        # 资金流入持续性
        inflow_days = flow.get("consecutive_inflow_days", 0)
        if inflow_days >= 3:
            score += 0.1

        return max(0.0, min(1.0, score))

    def _evaluate_dragon_list(self, dragon: Dict) -> float:
        """评估龙虎榜"""
        score = 0.5

        if not dragon.get("on_list", False):
            return score  # 无龙虎榜数据

        # 知名游资参与
        famous_youzi = dragon.get("famous_youzi", [])
        if len(famous_youzi) >= 2:
            score += 0.2
        elif len(famous_youzi) == 1:
            score += 0.1

        # 机构买入
        institution_buy = dragon.get("institution_buy", 0)
        if institution_buy > 50000000:
            score += 0.15

        # 买卖比
        buy_sell_ratio = dragon.get("buy_sell_ratio", 1.0)
        if buy_sell_ratio > 2.0:
            score += 0.1
        elif buy_sell_ratio < 0.5:
            score -= 0.15

        # 一家独大风险
        max_buy_ratio = dragon.get("max_buy_ratio", 0)
        if max_buy_ratio > 0.4:  # 单一席位买入超过40%
            score -= 0.15

        return max(0.0, min(1.0, score))

    def _evaluate_volume_health(self, flow: Dict) -> float:
        """评估成交量健康度"""
        score = 0.5

        # 换手率
        turnover = flow.get("turnover_rate", 0)
        if 0.05 < turnover < 0.25:
            score += 0.15
        elif turnover > 0.40:
            score -= 0.15

        # 量比
        volume_ratio = flow.get("volume_ratio", 1.0)
        if 1.5 < volume_ratio < 5.0:
            score += 0.1
        elif volume_ratio > 10:
            score -= 0.1

        # 涨停封单
        bid_amount = flow.get("limit_up_bid_amount", 0)
        if bid_amount > 100000000:
            score += 0.1

        return max(0.0, min(1.0, score))

    def _evaluate_cost(self, holders: Dict, institution: Dict) -> float:
        """评估资金成本"""
        score = 0.5

        # 近期平均成本
        avg_cost = holders.get("avg_cost", 0)
        current_price = holders.get("current_price", avg_cost)

        if avg_cost > 0 and current_price > 0:
            profit_ratio = (current_price - avg_cost) / avg_cost
            if 0 < profit_ratio < 0.2:  # 主力微利，有动力继续拉升
                score += 0.15
            elif profit_ratio > 0.5:  # 主力获利丰厚，可能出货
                score -= 0.1

        # 机构持仓变化
        inst_change = institution.get("holding_change", 0)
        if inst_change > 0:
            score += 0.1
        elif inst_change < 0:
            score -= 0.1

        return max(0.0, min(1.0, score))

    def _build_reasoning(
        self,
        code: str,
        flow: Dict,
        dragon: Dict,
        holders: Dict,
        score: float
    ) -> str:
        """构建分析理由"""
        reasons = []

        # 资金流入理由
        net_inflow = flow.get("net_inflow_5d", 0)
        if net_inflow != 0:
            reasons.append(f"近5日主力净流入: {net_inflow/10000:.0f}万")

        big_order = flow.get("big_order_ratio", 0)
        if big_order > 0:
            reasons.append(f"大单买入占比: {big_order*100:.1f}%")

        # 龙虎榜理由
        if dragon.get("on_list", False):
            famous = dragon.get("famous_youzi", [])
            if famous:
                reasons.append(f"龙虎榜: {', '.join(famous[:2])}参与")

            inst_buy = dragon.get("institution_buy", 0)
            if inst_buy > 0:
                reasons.append(f"机构买入: {inst_buy/10000:.0f}万")

        # 成本理由
        avg_cost = holders.get("avg_cost", 0)
        if avg_cost > 0:
            reasons.append(f"主力成本区: {avg_cost:.2f}")

        # 综合评分
        reasons.append(f"资金得分: {score:.2f}")

        return "; ".join(reasons) if reasons else "资金分析中性"

    def _build_signals(
        self,
        flow: Dict,
        dragon: Dict,
        holders: Dict,
        institution: Dict
    ) -> List[str]:
        """构建关键信号列表"""
        signals = []

        # 资金信号
        net_inflow = flow.get("net_inflow_5d", 0)
        if net_inflow > 100000000:
            signals.append(f"资金信号: 近5日净流入{net_inflow/10000:.0f}万")

        # 龙虎榜信号
        if dragon.get("on_list", False):
            famous = dragon.get("famous_youzi", [])
            if famous:
                signals.append(f"游资信号: {famous[0]}等买入")

            buy_sell = dragon.get("buy_sell_ratio", 0)
            if buy_sell > 2:
                signals.append(f"龙虎榜: 买/卖比{buy_sell:.1f}")

        # 机构信号
        inst_change = institution.get("holding_change", 0)
        if inst_change > 0:
            signals.append(f"机构信号: 持仓增加{inst_change*100:.1f}%")

        return signals

    def _build_risk_factors(
        self,
        flow: Dict,
        dragon: Dict
    ) -> List[str]:
        """构建风险因素列表"""
        risks = []

        # 资金流出风险
        net_inflow = flow.get("net_inflow_5d", 0)
        if net_inflow < -50000000:
            risks.append(f"资金风险: 近5日净流出{abs(net_inflow)/10000:.0f}万")

        # 龙虎榜风险
        if dragon.get("on_list", False):
            # 一家独大
            max_ratio = dragon.get("max_buy_ratio", 0)
            if max_ratio > 0.4:
                risks.append(f"龙虎榜风险: 单一席位买入占比{max_ratio*100:.1f}%")

            # 买卖比过低
            buy_sell = dragon.get("buy_sell_ratio", 1.0)
            if buy_sell < 0.5:
                risks.append(f"龙虎榜风险: 卖出意愿强于买入")

        # 高换手风险
        turnover = flow.get("turnover_rate", 0)
        if turnover > 0.40:
            risks.append(f"换手风险: 换手率高达{turnover*100:.1f}%")

        return risks if risks else ["暂无显著资金风险"]

    # ========== 数据获取方法（后续接入真实数据源）==========

    async def _get_capital_flow(self, code: str) -> Dict:
        """获取资金流向数据"""
        # TODO: 接入真实数据源（东方财富、同花顺等）
        return {
            "net_inflow_5d": 80000000,
            "net_inflow_10d": 120000000,
            "big_order_ratio": 0.65,
            "consecutive_inflow_days": 3,
            "turnover_rate": 0.18,
            "volume_ratio": 3.2,
            "limit_up_bid_amount": 200000000,
        }

    async def _get_dragon_list(self, code: str) -> Dict:
        """获取龙虎榜数据"""
        # TODO: 接入真实数据源
        return {
            "on_list": True,
            "famous_youzi": ["章盟主", "方新侠"],
            "institution_buy": 80000000,
            "institution_sell": 20000000,
            "buy_sell_ratio": 2.5,
            "max_buy_ratio": 0.25,
            "total_buy": 300000000,
            "total_sell": 120000000,
        }

    async def _get_main_holders(self, code: str) -> Dict:
        """获取主力持仓数据"""
        # TODO: 接入真实数据源
        return {
            "avg_cost": 15.5,
            "current_price": 18.2,
            "profit_ratio": 0.17,
            "chip_concentration": 0.35,
        }

    async def _get_institution_holdings(self, code: str) -> Dict:
        """获取机构持仓数据"""
        # TODO: 接入真实数据源
        return {
            "institution_count": 45,
            "total_holding_ratio": 0.35,
            "holding_change": 0.02,
        }
