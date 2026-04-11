# 本地开源模型部署方案

> 替代 OpenAI/Claude API，降低 Agent 推理成本

---

## 方案概览

### 成本对比

| 方案 | 月调用量 | 费用 | 延迟 | 质量 |
|-----|---------|------|-----|------|
| **OpenAI GPT-4** | 10万次 | ¥2000-3000 | 1-3s | ⭐⭐⭐⭐⭐ |
| **OpenAI GPT-3.5** | 10万次 | ¥500-800 | 0.5-1s | ⭐⭐⭐⭐ |
| **本地 7B 模型** | 无限 | ¥0（电费~¥50）| 1-5s | ⭐⭐⭐ |
| **本地 13B 模型** | 无限 | ¥0（电费~¥100）| 2-8s | ⭐⭐⭐⭐ |

**结论**：本地部署适合**中等复杂度**的 Agent 任务，可节省 90%+ 的模型调用成本。

---

## 模型选型

### 推荐模型（中文场景）

| 模型 | 参数量 | 显存需求 | 量化后 | 特点 |
|-----|-------|---------|-------|------|
| **Qwen2.5** | 7B | 14GB | 4GB | 阿里出品，中文优秀 |
| **Qwen2.5** | 14B | 28GB | 8GB | 综合能力更强 |
| **ChatGLM3** | 6B | 12GB | 3.5GB | 清华出品，中文对话 |
| **Llama 3.1** | 8B | 16GB | 4.5GB | Meta出品，英文更强 |
| **DeepSeek** | 7B | 14GB | 4GB | 代码能力突出 |

### 选型建议

**阶段1（验证期）**：Qwen2.5-7B-Int4
- 4GB显存即可运行
- 可在 CPU 上运行（慢但省钱）
- 适合快速验证

**阶段2（生产期）**：Qwen2.5-14B-GPTQ
- 需要 8-10GB 显存
- 推理质量接近 GPT-3.5
- 推荐租用 RTX 3090/4090 服务器

---

## 资源需求

### 方案A：CPU 推理（最低成本）

```yaml
配置:
  CPU: 8核+
  内存: 32GB
  存储: 50GB SSD
  GPU: 无

模型: Qwen2.5-7B-GGUF (Q4量化)
性能: 5-10 tokens/秒
成本: 仅电费（可忽略）
适用: 低频调用（<100次/天）
```

### 方案B：入门级 GPU（推荐起步）

```yaml
配置:
  GPU: RTX 3060 12GB / RTX 4060 Ti 16GB
  CPU: 6核
  内存: 32GB
  存储: 100GB SSD

模型: Qwen2.5-7B-AWQ / Qwen2.5-14B-GPTQ
性能: 20-40 tokens/秒
成本: 
  - 阿里云 GN7i (T4): ¥800/月
  - 自建: ¥4000-6000 一次性投入
适用: 中等负载（<1000次/天）
```

### 方案C：高性能 GPU（生产环境）

```yaml
配置:
  GPU: RTX 3090 24GB / RTX 4090 24GB
  CPU: 8核
  内存: 64GB
  存储: 200GB NVMe

模型: Qwen2.5-32B-GPTQ / 多模型并发
性能: 50-100 tokens/秒
成本:
  - 阿里云 GN7 (V100): ¥2500/月
  - 阿里云 GN7i (A10): ¥1800/月
  - 自建: ¥15000-20000 一次性投入
适用: 高频调用（>1000次/天）
```

---

## 架构设计

### 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Compose                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────────────────────────────┐ │
│  │   API 服务   │───▶│         LLM推理服务                  │ │
│  │   FastAPI   │    │  ┌─────────┐    ┌───────────────┐   │ │
│  │   :8000     │    │  │  Ollama │ or │    vLLM       │   │ │
│  └─────────────┘    │  │  :11434 │    │   :8000       │   │ │
│                     │  └────┬────┘    └───────┬───────┘   │ │
│  ┌─────────────┐    │       │                 │            │ │
│  │   Agent     │───▶│  ┌────┴─────────────────┴────┐       │ │
│  │   决策引擎   │    │  │      模型存储目录          │       │ │
│  │             │    │  │  /models/qwen2.5-14b      │       │ │
│  └─────────────┘    │  └───────────────────────────┘       │ │
│                     └─────────────────────────────────────┘ │
│                                                             │
│  GPU 模式: 使用 nvidia-docker-runtime                        │
│  CPU 模式: 使用 llama.cpp / ollama cpu                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 服务拆分

```yaml
# docker-compose.yml 扩展
version: '3.8'

services:
  api:
    # 原有API服务
    depends_on:
      - llm-service
    environment:
      - LLM_PROVIDER=local  # local | openai
      - LLM_BASE_URL=http://llm-service:11434

  llm-service:
    image: ollama/ollama:latest
    volumes:
      - ./models:/root/.ollama
    ports:
      - "11434:11434"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    # CPU模式注释掉GPU配置
```

---

## 集成代码

### 1. LLM 客户端封装

```python
# app/services/llm_client.py
"""
LLM 客户端
支持本地模型和API模型切换
"""

import os
from typing import AsyncGenerator, Optional
import httpx
from openai import AsyncOpenAI


class LLMClient:
    """LLM 客户端"""

    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "local")
        self.base_url = os.getenv("LLM_BASE_URL", "http://llm-service:11434")
        self.model = os.getenv("LLM_MODEL", "qwen2.5:14b")
        self.api_key = os.getenv("LLM_API_KEY", "")

        if self.provider == "local":
            # 本地模型使用 OpenAI 兼容接口
            self.client = AsyncOpenAI(
                base_url=f"{self.base_url}/v1",
                api_key="not-needed"
            )
        else:
            # 商业API
            self.client = AsyncOpenAI(api_key=self.api_key)

    async def chat(
        self,
        messages: list,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        stream: bool = False
    ) -> str:
        """对话"""
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream
        )

        if stream:
            return self._stream_response(response)

        return response.choices[0].message.content

    async def _stream_response(self, response) -> AsyncGenerator[str, None]:
        """流式响应"""
        async for chunk in response:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


# 全局客户端
llm_client = LLMClient()
```

### 2. Agent 决策服务

```python
# app/services/agent_llm_service.py
"""
基于LLM的Agent决策服务
"""

from typing import List, Dict, Any
from app.services.llm_client import llm_client


class AgentLLMService:
    """Agent LLM 决策服务"""

    SYSTEM_PROMPT = """你是一位专业的股票分析助手。
请根据提供的技术指标数据，分析该股票的涨停潜力。

输出格式要求：
1. 分析结论：看涨/看跌/观望
2. 置信度：0-1之间的小数
3. 理由：简要说明（不超过50字）

请严格按JSON格式输出：
{
    "conclusion": "看涨",
    "confidence": 0.85,
    "reason": "MACD金叉，成交量放大"
}"""

    async def analyze_stock(
        self,
        code: str,
        name: str,
        indicators: Dict[str, Any]
    ) -> Dict[str, Any]:
        """分析股票"""

        # 构建提示词
        user_prompt = f"""股票代码: {code}
股票名称: {name}
当前价格: {indicators.get('current_price')}
涨跌幅: {indicators.get('change_pct')}%

技术指标:
- MA5: {indicators.get('ma5')}
- MA20: {indicators.get('ma20')}
- MACD DIF: {indicators.get('macd_dif')}
- MACD DEA: {indicators.get('macd_dea')}
- KDJ K: {indicators.get('kdj_k')}
- KDJ D: {indicators.get('kdj_d')}
- 成交量比: {indicators.get('volume_ratio')}

请分析该股票今日涨停潜力。"""

        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ]

        try:
            response = await llm_client.chat(
                messages=messages,
                temperature=0.3,  # 降低随机性
                max_tokens=200
            )

            # 解析JSON响应
            import json
            result = json.loads(response)

            return {
                "conclusion": result.get("conclusion", "观望"),
                "confidence": float(result.get("confidence", 0.5)),
                "reason": result.get("reason", "分析失败"),
                "model": llm_client.model
            }

        except Exception as e:
            # 降级到规则引擎
            return {
                "conclusion": "观望",
                "confidence": 0.5,
                "reason": f"LLM分析失败: {str(e)}",
                "fallback": True
            }


# 全局服务
agent_llm_service = AgentLLMService()
```

---

## 渐进式部署方案

### 阶段1：混合模式（推荐起步）

```yaml
策略:
  简单任务: 本地 7B 模型
  复杂任务: GPT-3.5 API
  失败降级: 规则引擎

成本: ¥200-500/月（节省 70%）
```

### 阶段2：完全本地

```yaml
配置:
  模型: Qwen2.5-14B
  硬件: RTX 3090 或 租用 A10

成本: ¥800-1800/月（节省 90%）
前提: 验证 14B 模型效果满足需求
```

---

## 对现有资源的影响

### 轻量服务器方案（阶段1A/1B）

| 当前配置 | 增加LLM后 | 影响 |
|---------|----------|------|
| 2核2G 50GB | ❌ 不可行 | 内存不足 |
| 2核4G 60GB | ⚠️ 勉强 | CPU推理很慢 |
| 2核4G+GPU | ✅ 可行 | 需升级带GPU |

**结论**：轻量服务器**无法**本地部署LLM，需要升级。

### 升级路径

```
选项1: 租用阿里云 GPU 服务器（弹性）
  - 开发测试: GN7i (T4) ¥800/月
  - 生产运行: GN7i (A10) ¥1800/月

选项2: 自建 GPU 服务器（长期）
  - 投入: ¥15000-20000
  - 回收期: 6-10个月（相比API费用）

选项3: 混合部署（推荐）
  - API服务: 轻量服务器 ¥100/月
  - LLM服务: 阿里云函数计算 GPU（按量）
  - 总成本: ¥300-600/月
```

---

## 推荐方案

### 短期（验证期，1-3个月）

```yaml
方案: 阿里云函数计算 GPU（按量付费）
模型: Qwen2.5-7B
调用: 0.0001元/千 tokens
预估: ¥200-400/月（1000次/天）

优点:
  - 无需维护服务器
  - 按量付费，成本低
  - 快速验证效果

缺点:
  - 冷启动延迟 3-5秒
  - 不适合高频实时场景
```

### 长期（生产期，3个月+）

```yaml
方案: 自建 GPU 服务器 或 租用包年
配置: RTX 3090 24GB
模型: Qwen2.5-14B
成本: ¥1000-1500/月

决策依据:
  - 如果月API费用 > ¥2000 → 本地部署划算
  - 如果日调用 > 5000次 → 必须本地部署
```

---

## 实施步骤

### 第一步：验证模型效果（本周）

```bash
# 本地Mac/Windows 测试
ollama run qwen2.5:7b

# 测试几个股票分析案例
# 对比 GPT-3.5 效果差异
```

### 第二步：选择部署方案（下周）

```bash
# 方案A: 函数计算
# 部署到阿里云 FC GPU

# 方案B: 租用GPU服务器
# 阿里云 GN7i 按月租用
```

### 第三步：集成到系统（2周内）

```python
# 修改 Agent 决策逻辑
if settings.LLM_PROVIDER == "local":
    result = await agent_llm_service.analyze_stock(...)
else:
    result = await openai_service.analyze_stock(...)
```

---

## 总结

| 方案 | 适合阶段 | 月成本 | 效果 |
|-----|---------|-------|------|
| **纯API (GPT-4)** | 开发期 | ¥2000-3000 | ⭐⭐⭐⭐⭐ |
| **纯API (GPT-3.5)** | 开发期 | ¥500-800 | ⭐⭐⭐⭐ |
| **混合 (7B+API)** | 验证期 | ¥300-600 | ⭐⭐⭐⭐ |
| **本地 (14B)** | 生产期 | ¥1000-1500 | ⭐⭐⭐⭐ |

**你的情况建议**：
- 当前阶段：先用阿里云函数计算 GPU 验证（¥300/月）
- 调用量上来后：升级到租用 GPU 服务器（¥1000/月）
- 完全不推荐：在轻量服务器上跑CPU推理（太慢）

