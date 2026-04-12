"""
Agent API 路由

提供多Agent分析相关的API端点
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.services.agent_service import get_agent_service, AgentService
from app.agents.coordinator import MultiAgentCoordinator, get_coordinator
from app.agents.registry import registry


router = APIRouter(prefix="/agents", tags=["agents"])


# ========== 数据模型 ==========

class StockAnalysisRequest(BaseModel):
    """股票分析请求"""
    stock_codes: List[str]
    market_context: Optional[dict] = None


class AgentDecisionResponse(BaseModel):
    """Agent决策响应"""
    agent_type: str
    agent_name: str
    decision: str
    confidence: float
    reasoning: str
    signals: List[str]
    risk_factors: List[str]


class StockAnalysisResponse(BaseModel):
    """股票分析响应"""
    stock_code: str
    final_decision: str
    final_confidence: float
    reasoning: str
    bullish_agents: List[str]
    bearish_agents: List[str]
    agent_results: dict


class AgentInfoResponse(BaseModel):
    """Agent信息响应"""
    type: str
    name: str
    description: str
    version: str


class AgentStatusResponse(BaseModel):
    """Agent状态响应"""
    total_agents: int
    agents: List[AgentInfoResponse]
    active_agent_types: List[str]


# ========== API端点 ==========

@router.post("/analyze", response_model=List[StockAnalysisResponse])
async def analyze_stocks(
    request: StockAnalysisRequest,
    agent_service: AgentService = Depends(get_agent_service)
):
    """
    使用多Agent分析股票列表

    每个Agent根据自己的特色分析股票，最终返回综合决策结果
    """
    if not request.stock_codes:
        raise HTTPException(status_code=400, detail="股票代码列表不能为空")

    if len(request.stock_codes) > 20:
        raise HTTPException(status_code=400, detail="一次最多分析20只股票")

    results = await agent_service.analyze_stocks(
        stock_codes=request.stock_codes,
        market_context=request.market_context
    )

    return [
        StockAnalysisResponse(
            stock_code=code,
            final_decision=r.final_decision.value,
            final_confidence=r.final_confidence,
            reasoning=r.reasoning,
            bullish_agents=r.get_bullish_agents(),
            bearish_agents=r.get_bearish_agents(),
            agent_results={
                agent_type: {
                    "decision": d.decision.value,
                    "confidence": d.confidence,
                    "reasoning": d.reasoning,
                    "signals": d.signals,
                    "risk_factors": d.risk_factors,
                }
                for agent_type, d in r.agent_results.items()
            }
        )
        for code, r in results.items()
    ]


@router.get("/status", response_model=AgentStatusResponse)
async def get_agent_status(
    agent_service: AgentService = Depends(get_agent_service)
):
    """获取所有Agent的状态信息"""
    status = agent_service.get_agent_status()

    return AgentStatusResponse(
        total_agents=status["total_agents"],
        agents=[
            AgentInfoResponse(**agent)
            for agent in status["agents"]
        ],
        active_agent_types=status["active_agent_types"]
    )


@router.get("/list", response_model=List[AgentInfoResponse])
async def list_agents():
    """列出所有可用的Agent"""
    agents = registry.list_agents()
    return [AgentInfoResponse(**agent) for agent in agents]


@router.post("/analyze/{agent_type}", response_model=List[AgentDecisionResponse])
async def analyze_with_single_agent(
    agent_type: str,
    request: StockAnalysisRequest
):
    """
    使用单个Agent分析股票

    - **agent_type**: Agent类型 (sentiment/technical/capital/fundamental)
    """
    agent = registry.get(agent_type)
    if not agent:
        raise HTTPException(
            status_code=404,
            detail=f"Agent类型 '{agent_type}' 不存在"
        )

    from app.agents.base.agent import AgentInput

    input_data = AgentInput(
        stock_codes=request.stock_codes,
        market_context=request.market_context
    )

    result = await agent.run(input_data)

    return [
        AgentDecisionResponse(
            agent_type=result.agent_type,
            agent_name=result.agent_name,
            decision=d.decision.value,
            confidence=d.confidence,
            reasoning=d.reasoning,
            signals=d.signals,
            risk_factors=d.risk_factors
        )
        for d in result.decisions
    ]
