"""
多Agent系统测试脚本
"""

import asyncio
import sys
from datetime import datetime

# 设置路径
sys.path.insert(0, '/Users/zhangying/projects/maneki/apps/api')

from app.agents import (
    SentimentAgent,
    TechnicalAgent,
    CapitalAgent,
    FundamentalAgent,
)
from app.agents.base.agent import AgentInput
from app.agents.registry import registry
from app.agents.coordinator import MultiAgentCoordinator
from app.services.agent_service import get_agent_service, analyze_with_agents


async def test_single_agents():
    """测试单个Agent"""
    print("=" * 60)
    print("测试单个Agent")
    print("=" * 60)

    # 测试股票
    stock_codes = ["000001.SZ", "600519.SH", "300750.SZ"]

    # 创建Agent
    sentiment_agent = SentimentAgent()
    technical_agent = TechnicalAgent()
    capital_agent = CapitalAgent()
    fundamental_agent = FundamentalAgent()

    agents = [
        ("情绪Agent", sentiment_agent),
        ("技术Agent", technical_agent),
        ("资金Agent", capital_agent),
        ("基本面Agent", fundamental_agent),
    ]

    for name, agent in agents:
        print(f"\n{'='*40}")
        print(f"测试 {name}")
        print(f"{'='*40}")

        # 创建输入
        agent_input = AgentInput(
            stock_codes=stock_codes,
            market_context={"market_sentiment": "bullish"}
        )

        # 运行Agent
        result = await agent.run(agent_input)

        print(f"Agent: {result.agent_name}")
        print(f"类型: {result.agent_type}")
        print(f"处理时间: {result.metadata.get('processing_time_seconds', 0):.2f}秒")
        print(f"\n决策结果:")

        for decision in result.decisions:
            print(f"\n  股票: {decision.stock_code}")
            print(f"  决策: {decision.decision.value}")
            print(f"  置信度: {decision.confidence:.2%}")
            print(f"  理由: {decision.reasoning[:100]}...")
            if decision.signals:
                print(f"  关键信号: {', '.join(decision.signals[:3])}")


async def test_coordinator():
    """测试多Agent协调器"""
    print("\n\n")
    print("=" * 60)
    print("测试多Agent协调器")
    print("=" * 60)

    # 测试股票
    stock_codes = ["000001.SZ", "600519.SH"]

    # 创建协调器
    coordinator = MultiAgentCoordinator()

    # 运行分析
    results = await coordinator.analyze(
        stock_codes=stock_codes,
        market_context={"market_sentiment": "bullish"}
    )

    for code, result in results.items():
        print(f"\n{'='*40}")
        print(f"股票: {code}")
        print(f"{'='*40}")
        print(f"最终决策: {result.final_decision.value}")
        print(f"最终置信度: {result.final_confidence:.2%}")
        print(f"聚合方法: {result.aggregation_method}")
        print(f"\n综合理由:\n{result.reasoning}")

        print(f"\n各Agent详细结果:")
        for agent_type, decision in result.agent_results.items():
            print(f"  [{agent_type}]")
            print(f"    决策: {decision.decision.value}")
            print(f"    置信度: {decision.confidence:.2%}")
            if decision.signals:
                print(f"    信号: {', '.join(decision.signals[:2])}")


async def test_agent_service():
    """测试Agent服务"""
    print("\n\n")
    print("=" * 60)
    print("测试Agent服务")
    print("=" * 60)

    # 测试股票
    stock_codes = ["000001.SZ", "600519.SH", "300750.SZ"]

    # 使用便捷函数
    results = await analyze_with_agents(stock_codes)

    print(f"分析了 {len(results)} 只股票\n")

    for code, result in results.items():
        print(f"{'='*40}")
        print(f"股票: {code}")
        print(f"{'='*40}")
        print(f"决策: {result['final_decision']}")
        print(f"置信度: {result['final_confidence']:.2%}")
        print(f"看涨Agent: {', '.join(result['bullish_agents'])}")
        print(f"看跌Agent: {', '.join(result['bearish_agents'])}")

    # 获取服务状态
    service = get_agent_service()
    status = service.get_agent_status()
    print(f"\n\nAgent状态:")
    print(f"总Agent数: {status['total_agents']}")
    print(f"活跃Agent: {', '.join(status['active_agent_types'])}")


async def main():
    """主函数"""
    print("\n")
    print("*" * 60)
    print("多Agent系统测试")
    print("*" * 60)
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("*" * 60)

    try:
        # 测试1: 单个Agent
        await test_single_agents()

        # 测试2: 协调器
        await test_coordinator()

        # 测试3: Agent服务
        await test_agent_service()

        print("\n\n")
        print("=" * 60)
        print("所有测试通过!")
        print("=" * 60)

    except Exception as e:
        print(f"\n\n测试失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
