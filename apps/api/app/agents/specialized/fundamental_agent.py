"""
基本面Agent实现

专注于公司基本面、财务数据、行业分析
"""

from typing import Any, Dict, List, Optional

from app.agents.base.agent import BaseAgent, AgentDecision, DecisionType
from app.agents.prompts.fundamental_prompt import FUNDAMENTAL_SYSTEM_PROMPT
from app.agents.registry import registry


@registry.register
class FundamentalAgent(BaseAgent):
    """
    基本面Agent

    通过公司财务数据、行业地位、基本面变化来预测涨停概率
    """

    name: str = "基本面Agent"
    agent_type: str = "fundamental"
    version: str = "1.0.0"
    description: str = "分析公司基本面、财务数据、行业地位"

    def get_system_prompt(self) -> str:
        """返回基本面Agent的系统提示词"""
        return FUNDAMENTAL_SYSTEM_PROMPT

    async def gather_information(self, stock_codes: List[str]) -> Dict[str, Any]:
        """
        收集基本面相关信息

        Args:
            stock_codes: 股票代码列表

        Returns:
            基本面信息字典
        """
        self.logger.info(f"收集 {len(stock_codes)} 只股票的基本面信息")

        information = {
            "financial_data": {},
            "industry_info": {},
            "company_events": {},
            "research_reports": {},
        }

        for code in stock_codes:
            information["financial_data"][code] = await self._get_financial_data(code)
            information["industry_info"][code] = await self._get_industry_info(code)
            information["company_events"][code] = await self._get_company_events(code)
            information["research_reports"][code] = await self._get_research_reports(code)

        return information

    async def analyze(
        self,
        stock_codes: List[str],
        information: Dict[str, Any],
        market_context: Optional[Dict] = None
    ) -> List[AgentDecision]:
        """
        执行基本面分析

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
        # 获取基本面数据
        financial = information.get("financial_data", {}).get(code, {})
        industry = information.get("industry_info", {}).get(code, {})
        events = information.get("company_events", {}).get(code, [])
        reports = information.get("research_reports", {}).get(code, [])

        # 计算基本面得分
        fundamental_score = self._calculate_fundamental_score(
            financial, industry, events, reports
        )

        # 根据得分确定决策
        if fundamental_score >= 0.8:
            decision = DecisionType.STRONG_BUY
            confidence = fundamental_score
        elif fundamental_score >= 0.6:
            decision = DecisionType.BUY
            confidence = fundamental_score
        elif fundamental_score >= 0.4:
            decision = DecisionType.HOLD
            confidence = 0.5
        elif fundamental_score >= 0.2:
            decision = DecisionType.SELL
            confidence = 1 - fundamental_score
        else:
            decision = DecisionType.STRONG_SELL
            confidence = 1 - fundamental_score

        # 构建理由和信号
        reasoning = self._build_reasoning(code, financial, industry, events, fundamental_score)
        signals = self._build_signals(financial, industry, events, reports)
        risk_factors = self._build_risk_factors(financial, events)

        return AgentDecision(
            stock_code=code,
            decision=decision,
            confidence=confidence,
            reasoning=reasoning,
            signals=signals,
            risk_factors=risk_factors,
            time_horizon="medium"  # 基本面分析偏向中长期
        )

    def _calculate_fundamental_score(
        self,
        financial: Dict,
        industry: Dict,
        events: List[Dict],
        reports: List[Dict]
    ) -> float:
        """计算基本面得分 (0-1)"""
        score = 0.5  # 基准分

        # 业绩基本面 (40%)
        earnings_score = self._evaluate_earnings(financial)
        score += (earnings_score - 0.5) * 0.40

        # 估值水平 (25%)
        valuation_score = self._evaluate_valuation(financial)
        score += (valuation_score - 0.5) * 0.25

        # 行业景气度 (20%)
        industry_score = self._evaluate_industry(industry)
        score += (industry_score - 0.5) * 0.20

        # 催化事件 (15%)
        catalyst_score = self._evaluate_catalysts(events, reports)
        score += (catalyst_score - 0.5) * 0.15

        return max(0.0, min(1.0, score))

    def _evaluate_earnings(self, financial: Dict) -> float:
        """评估业绩基本面"""
        score = 0.5

        # 营收增长
        revenue_growth = financial.get("revenue_growth_yoy", 0)
        if revenue_growth > 0.5:  # 50%增长
            score += 0.15
        elif revenue_growth > 0.3:
            score += 0.1
        elif revenue_growth < 0:
            score -= 0.1

        # 净利润增长
        profit_growth = financial.get("profit_growth_yoy", 0)
        if profit_growth > 1.0:  # 100%增长
            score += 0.2
        elif profit_growth > 0.5:
            score += 0.15
        elif profit_growth > 0.2:
            score += 0.1
        elif profit_growth < 0:
            score -= 0.15

        # ROE
        roe = financial.get("roe", 0)
        if roe > 0.15:  # ROE > 15%
            score += 0.1
        elif roe < 0.05:
            score -= 0.1

        # 毛利率
        gross_margin = financial.get("gross_margin", 0)
        if gross_margin > 0.4:
            score += 0.05

        return max(0.0, min(1.0, score))

    def _evaluate_valuation(self, financial: Dict) -> float:
        """评估估值水平"""
        score = 0.5

        # PE估值
        pe = financial.get("pe_ttm", 0)
        pe_history = financial.get("pe_history", [])
        if pe > 0 and pe_history:
            pe_percentile = sum(1 for p in pe_history if p < pe) / len(pe_history)
            if pe_percentile < 0.3:  # 处于历史低位
                score += 0.2
            elif pe_percentile > 0.7:  # 处于历史高位
                score -= 0.15

        # PB估值
        pb = financial.get("pb", 0)
        if 0 < pb < 2:
            score += 0.1
        elif pb > 10:
            score -= 0.1

        # PEG
        peg = financial.get("peg", 1.0)
        if 0 < peg < 1:
            score += 0.1
        elif peg > 2:
            score -= 0.1

        return max(0.0, min(1.0, score))

    def _evaluate_industry(self, industry: Dict) -> float:
        """评估行业景气度"""
        score = 0.5

        # 行业排名
        rank = industry.get("rank_in_industry", 50)
        if rank <= 5:
            score += 0.2
        elif rank <= 10:
            score += 0.15
        elif rank <= 20:
            score += 0.1
        elif rank > 50:
            score -= 0.1

        # 行业景气度
        prosperity = industry.get("prosperity_index", 0.5)
        score += (prosperity - 0.5) * 0.2

        # 行业增速
        industry_growth = industry.get("industry_growth", 0)
        if industry_growth > 0.3:
            score += 0.1
        elif industry_growth < 0.1:
            score -= 0.1

        return max(0.0, min(1.0, score))

    def _evaluate_catalysts(self, events: List[Dict], reports: List[Dict]) -> float:
        """评估催化事件"""
        score = 0.5

        # 分析事件
        for event in events[:3]:  # 只看前3个事件
            event_type = event.get("type", "")
            importance = event.get("importance", 0.5)

            if event_type in ["业绩预增", "重大合同", "并购重组", "新产品"]:
                score += importance * 0.1
            elif event_type in ["股东减持", "业绩预减", "监管问询"]:
                score -= importance * 0.1

        # 分析研报
        for report in reports[:3]:
            rating = report.get("rating", "")
            if rating in ["买入", "强烈推荐"]:
                score += 0.05
            elif rating == "卖出":
                score -= 0.05

        return max(0.0, min(1.0, score))

    def _build_reasoning(
        self,
        code: str,
        financial: Dict,
        industry: Dict,
        events: List[Dict],
        score: float
    ) -> str:
        """构建分析理由"""
        reasons = []

        # 业绩理由
        profit_growth = financial.get("profit_growth_yoy", 0)
        if profit_growth != 0:
            reasons.append(f"净利润同比增长: {profit_growth*100:.1f}%")

        roe = financial.get("roe", 0)
        if roe > 0:
            reasons.append(f"ROE: {roe*100:.1f}%")

        # 估值理由
        pe = financial.get("pe_ttm", 0)
        if pe > 0:
            reasons.append(f"PE-TTM: {pe:.1f}")

        # 行业理由
        industry_name = industry.get("name", "")
        rank = industry.get("rank_in_industry", 0)
        if industry_name:
            if rank > 0:
                reasons.append(f"行业地位: {industry_name}行业排名第{rank}")
            else:
                reasons.append(f"所属行业: {industry_name}")

        # 事件理由
        important_events = [e for e in events if e.get("importance", 0) > 0.7]
        if important_events:
            reasons.append(f"催化事件: {important_events[0].get('title', '')[:20]}")

        # 综合评分
        reasons.append(f"基本面得分: {score:.2f}")

        return "; ".join(reasons) if reasons else "基本面分析中性"

    def _build_signals(
        self,
        financial: Dict,
        industry: Dict,
        events: List[Dict],
        reports: List[Dict]
    ) -> List[str]:
        """构建关键信号列表"""
        signals = []

        # 业绩信号
        profit_growth = financial.get("profit_growth_yoy", 0)
        if profit_growth > 0.5:
            signals.append(f"业绩信号: 净利润增长{profit_growth*100:.0f}%")

        # 估值信号
        pe = financial.get("pe_ttm", 0)
        pe_history = financial.get("pe_history", [])
        if pe > 0 and pe_history:
            pe_percentile = sum(1 for p in pe_history if p < pe) / len(pe_history)
            if pe_percentile < 0.3:
                signals.append(f"估值信号: PE处于历史低位")

        # 行业信号
        rank = industry.get("rank_in_industry", 0)
        if rank <= 10:
            signals.append(f"行业地位: 行业前{rank}")

        # 事件信号
        for event in events[:1]:
            if event.get("importance", 0) > 0.8:
                signals.append(f"事件催化: {event.get('title', '')[:20]}...")

        return signals

    def _build_risk_factors(
        self,
        financial: Dict,
        events: List[Dict]
    ) -> List[str]:
        """构建风险因素列表"""
        risks = []

        # 业绩风险
        profit_growth = financial.get("profit_growth_yoy", 0)
        if profit_growth < 0:
            risks.append(f"业绩风险: 净利润同比下滑{abs(profit_growth)*100:.1f}%")

        # 估值风险
        pe = financial.get("pe_ttm", 0)
        if pe > 100:
            risks.append(f"估值风险: PE高达{pe:.1f}倍")

        # 事件风险
        negative_events = [e for e in events if e.get("type", "") in ["股东减持", "业绩预减"]]
        if negative_events:
            risks.append(f"事件风险: {negative_events[0].get('title', '')[:20]}...")

        return risks if risks else ["暂无显著基本面风险"]

    # ========== 数据获取方法（后续接入真实数据源）==========

    async def _get_financial_data(self, code: str) -> Dict:
        """获取财务数据"""
        # TODO: 接入真实数据源（东方财富、同花顺等）
        return {
            "revenue_growth_yoy": 0.45,
            "profit_growth_yoy": 1.20,
            "roe": 0.18,
            "gross_margin": 0.35,
            "pe_ttm": 25.5,
            "pb": 3.2,
            "peg": 0.85,
            "pe_history": [30, 28, 26, 25, 27, 29, 26, 25, 24, 26],
        }

    async def _get_industry_info(self, code: str) -> Dict:
        """获取行业信息"""
        # TODO: 接入真实数据源
        return {
            "name": "新能源",
            "rank_in_industry": 5,
            "market_share": 0.08,
            "prosperity_index": 0.75,
            "industry_growth": 0.35,
            "industry_pe_avg": 35.0,
        }

    async def _get_company_events(self, code: str) -> List[Dict]:
        """获取公司事件"""
        # TODO: 接入真实数据源
        return [
            {
                "type": "业绩预增",
                "title": "预计前三季度净利润同比增长100%-150%",
                "date": "2024-01-15",
                "importance": 0.9,
            },
            {
                "type": "重大合同",
                "title": "签订10亿元大单合同",
                "date": "2024-01-10",
                "importance": 0.85,
            },
        ]

    async def _get_research_reports(self, code: str) -> List[Dict]:
        """获取研报数据"""
        # TODO: 接入真实数据源
        return [
            {
                "institution": "中信证券",
                "rating": "买入",
                "target_price": 25.0,
                "date": "2024-01-12",
            },
            {
                "institution": "中金公司",
                "rating": "推荐",
                "target_price": 24.0,
                "date": "2024-01-08",
            },
        ]
