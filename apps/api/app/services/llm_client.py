"""
LLM 客户端
支持多家国内厂商：阿里云、DeepSeek、智谱等
"""

import os
from typing import Optional, AsyncGenerator, List, Dict, Any
import httpx
from openai import AsyncOpenAI, APIError

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class LLMClient:
    """统一 LLM 客户端"""

    def __init__(self, provider: Optional[str] = None):
        self.provider = provider or settings.LLM_PROVIDER

        # 根据提供商初始化
        if self.provider == "aliyun":
            self._init_aliyun()
        elif self.provider == "deepseek":
            self._init_deepseek()
        elif self.provider == "openai":
            self._init_openai()
        else:
            raise ValueError(f"不支持的 LLM 提供商: {self.provider}")

        logger.info(f"LLM 客户端初始化完成: {self.provider}")

    def _init_aliyun(self):
        """初始化阿里云 DashScope"""
        api_key = settings.ALIYUN_API_KEY or os.getenv("ALIYUN_API_KEY")
        if not api_key:
            raise ValueError("请设置 ALIYUN_API_KEY 环境变量")

        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=settings.ALIYUN_BASE_URL,
            timeout=60.0,
        )
        self.model = settings.LLM_MODEL
        self.model_advanced = settings.LLM_MODEL_ADVANCED
        logger.info(f"阿里云模型: default={self.model}, advanced={self.model_advanced}")

    def _init_deepseek(self):
        """初始化 DeepSeek"""
        api_key = os.getenv("DEEPSEEK_API_KEY")
        if not api_key:
            raise ValueError("请设置 DEEPSEEK_API_KEY 环境变量")

        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com/v1",
            timeout=60.0,
        )
        self.model = "deepseek-chat"
        self.model_advanced = "deepseek-chat"
        logger.info(f"DeepSeek模型: {self.model}")

    def _init_openai(self):
        """初始化 OpenAI"""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("请设置 OPENAI_API_KEY 环境变量")

        self.client = AsyncOpenAI(
            api_key=api_key,
            timeout=60.0,
        )
        self.model = "gpt-3.5-turbo"
        self.model_advanced = "gpt-4"
        logger.info(f"OpenAI模型: default={self.model}, advanced={self.model_advanced}")

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        stream: bool = False,
    ) -> str:
        """
        对话

        Args:
            messages: 消息列表
            model: 指定模型，None则使用默认
            temperature: 温度（创造性）
            max_tokens: 最大返回长度
            stream: 是否流式输出

        Returns:
            模型回复内容
        """
        model = model or self.model

        try:
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=stream,
            )

            if stream:
                return self._process_stream(response)

            return response.choices[0].message.content

        except APIError as e:
            logger.error(f"LLM API 错误: {e}")
            raise
        except Exception as e:
            logger.error(f"LLM 调用失败: {e}")
            raise

    def _process_stream(self, response) -> str:
        """处理流式响应"""
        content_parts = []
        for chunk in response:
            if chunk.choices[0].delta.content:
                content_parts.append(chunk.choices[0].delta.content)
        return "".join(content_parts)

    async def analyze_stock(
        self,
        code: str,
        name: str,
        indicators: Dict[str, Any],
        agent_type: str = "analyzer",
    ) -> Dict[str, Any]:
        """
        分析股票

        Args:
            code: 股票代码
            name: 股票名称
            indicators: 技术指标
            agent_type: agent类型 (analyzer/decision/replay)

        Returns:
            {
                "conclusion": "看涨/看跌/观望",
                "confidence": 0.85,
                "reason": "分析理由",
                "model": "使用的模型"
            }
        """
        # 根据 agent 类型选择模型
        if agent_type == "analyzer":
            model = self.model  # 普通模型，高频调用
            temperature = 0.3
        else:
            model = self.model_advanced  # 高级模型，决策/复盘
            temperature = 0.5

        # 构建系统提示词
        system_prompt = self._get_system_prompt(agent_type)

        # 构建用户提示词
        user_prompt = self._build_stock_prompt(code, name, indicators)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        try:
            response = await self.chat(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=800,
            )

            # 解析响应
            result = self._parse_response(response)
            result["model"] = model
            result["provider"] = self.provider

            return result

        except Exception as e:
            logger.error(f"股票分析失败 {code}: {e}")
            return {
                "conclusion": "观望",
                "confidence": 0.5,
                "reason": f"分析失败: {str(e)}",
                "error": True,
                "model": model,
            }

    def _get_system_prompt(self, agent_type: str) -> str:
        """获取系统提示词"""
        prompts = {
            "analyzer": """你是一位专业的股票技术分析专家。
请根据提供的技术指标，独立分析该股票的涨跌潜力。

输出要求：
1. 分析结论：看涨/看跌/观望
2. 置信度：0-1之间的小数
3. 理由：简洁说明（50字以内）
4. 关键指标：列出影响判断的主要指标

请严格按JSON格式输出：
{
    "conclusion": "看涨",
    "confidence": 0.85,
    "reason": "MACD金叉，成交量放大1.8倍",
    "key_indicators": ["MACD", "成交量"]
}""",
            "decision": """你是一位资深的投资决策专家。
请综合多个Agent的分析观点，给出最终的投资决策。

你需要：
1. 权衡各个Agent的观点（考虑其专长和历史准确率）
2. 识别观点间的矛盾点
3. 给出明确的最终决策

输出格式：
{
    "decision": "买入/卖出/观望",
    "confidence": 0.82,
    "reason": "综合3个Agent的看涨信号，趋势明确",
    "risk_level": "低/中/高",
    "suggested_position": "建议仓位比例"
}""",
            "replay": """你是一位专业的交易复盘分析师。
请回顾当天的交易信号和市场表现，总结经验教训。

分析维度：
1. 信号准确率
2.  missed opportunities（错过机会）
3.  false positives（误报）
4. 改进建议

输出格式：
{
    "summary": "今日整体表现",
    "accuracy": 0.75,
    "lessons": ["教训1", "教训2"],
    "improvements": ["改进建议1"]
}""",
        }
        return prompts.get(agent_type, prompts["analyzer"])

    def _build_stock_prompt(
        self, code: str, name: str, indicators: Dict[str, Any]
    ) -> str:
        """构建股票分析提示词"""
        return f"""股票基本信息：
- 代码: {code}
- 名称: {name}
- 当前价格: {indicators.get('current_price', 'N/A')}
- 涨跌幅: {indicators.get('change_pct', 'N/A')}%
- 时间: {indicators.get('timestamp', 'N/A')}

技术指标：
- MA5: {indicators.get('ma5', 'N/A')}
- MA10: {indicators.get('ma10', 'N/A')}
- MA20: {indicators.get('ma20', 'N/A')}
- MACD DIF: {indicators.get('macd_dif', 'N/A')}
- MACD DEA: {indicators.get('macd_dea', 'N/A')}
- MACD Histogram: {indicators.get('macd_hist', 'N/A')}
- KDJ K: {indicators.get('kdj_k', 'N/A')}
- KDJ D: {indicators.get('kdj_d', 'N/A')}
- KDJ J: {indicators.get('kdj_j', 'N/A')}
- RSI(6): {indicators.get('rsi_6', 'N/A')}
- RSI(12): {indicators.get('rsi_12', 'N/A')}
- 成交量比: {indicators.get('volume_ratio', 'N/A')}
- 换手率: {indicators.get('turnover_rate', 'N/A')}%

请给出分析结果。"""

    def _parse_response(self, response: str) -> Dict[str, Any]:
        """解析模型响应"""
        import json
        import re

        try:
            # 尝试直接解析JSON
            return json.loads(response)
        except json.JSONDecodeError:
            # 尝试从文本中提取JSON
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except:
                    pass

            # 解析失败，返回文本
            return {
                "conclusion": "观望",
                "confidence": 0.5,
                "reason": response[:200] if response else "解析失败",
            }


# 全局 LLM 客户端实例
llm_client: Optional[LLMClient] = None


async def get_llm_client() -> LLMClient:
    """获取 LLM 客户端（单例）"""
    global llm_client
    if llm_client is None:
        llm_client = LLMClient()
    return llm_client
