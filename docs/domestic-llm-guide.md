# 国内大模型接入指南

> 替代 OpenAI，适合国内用户的大模型方案

---

## 推荐模型（按场景）

### 股票分析场景首选

| 排名 | 模型 | 厂商 | 效果 | 价格 | 推荐指数 |
|-----|------|------|------|------|---------|
| 🥇 | **DeepSeek-V2** | 深度求索 | ⭐⭐⭐⭐⭐ | ¥0.001/千tokens | ⭐⭐⭐⭐⭐ |
| 🥈 | **Qwen-Turbo** | 阿里云 | ⭐⭐⭐⭐ | ¥0.002/千tokens | ⭐⭐⭐⭐⭐ |
| 🥉 | **Qwen-Plus** | 阿里云 | ⭐⭐⭐⭐⭐ | ¥0.004/千tokens | ⭐⭐⭐⭐ |
| 4 | **ChatGLM-4** | 智谱AI | ⭐⭐⭐⭐ | ¥0.005/千tokens | ⭐⭐⭐⭐ |
| 5 | **Kimi** | 月之暗面 | ⭐⭐⭐⭐ | ¥0.012/千tokens | ⭐⭐⭐ |

---

## 详细对比

### 1. DeepSeek-V2（强烈推荐）

```yaml
官网: https://platform.deepseek.com
特点:
  - 推理能力极强（代码/数学/分析）
  - 价格最便宜的顶级模型
  - 支持128K长文本
  - 中文理解优秀

价格:
  输入: ¥0.001 / 千tokens
  输出: ¥0.002 / 千tokens
  对比: 比 GPT-3.5 便宜 90%

适用: 股票分析、决策推理、复盘总结
```

**接入代码**:
```python
from openai import AsyncOpenAI

client = AsyncOpenAI(
    api_key="your-deepseek-key",
    base_url="https://api.deepseek.com/v1"
)

response = await client.chat.completions.create(
    model="deepseek-chat",
    messages=[...]
)
```

---

### 2. 通义千问 Qwen-Turbo（性价比高）

```yaml
官网: https://dashscope.aliyun.com
特点:
  - 阿里出品，金融场景优化好
  - 稳定可靠，企业级服务
  - 国内访问速度快
  - 生态完善（与阿里云产品集成好）

价格:
  qwen-turbo: ¥0.002 / 千tokens
  qwen-plus: ¥0.004 / 千tokens
  qwen-max: ¥0.02 / 千tokens

适用: 通用分析、多轮对话、复杂推理
```

**接入代码**:
```python
import dashscope
from dashscope import Generation

dashscope.api_key = "your-dashscope-key"

response = Generation.call(
    model="qwen-turbo",
    messages=[...]
)
```

或使用 OpenAI 兼容接口：
```python
from openai import AsyncOpenAI

client = AsyncOpenAI(
    api_key="your-dashscope-key",
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
)
```

---

### 3. ChatGLM-4（中文优秀）

```yaml
官网: https://open.bigmodel.cn
特点:
  - 清华出品，中文理解细腻
  对话流畅自然
  - 支持工具调用

价格:
  glm-4-flash: ¥0.001 / 千tokens (限免)
  glm-4: ¥0.005 / 千tokens
  glm-4-plus: ¥0.01 / 千tokens

适用: 自然语言交互、对话场景
```

---

## 成本计算（你的场景）

### 单用户每日调用
```
10个Agent分析 × 24轮 = 240次
决策Agent × 24轮 = 24次
收盘 + 复盘 = 2次
总计: 266次/用户/天
```

### 月费用对比（50用户）

| 模型 | 单价 | 月调用量 | 月费用 |
|-----|------|---------|--------|
| DeepSeek-V2 | ¥0.0015 | 29.3万 | **¥440** |
| Qwen-Turbo | ¥0.002 | 29.3万 | **¥586** |
| Qwen-Plus | ¥0.004 | 29.3万 | **¥1,172** |
| ChatGLM-4 | ¥0.005 | 29.3万 | **¥1,465** |
| GPT-3.5 (参考) | ¥0.015 | 29.3万 | ¥4,400 |

**结论**: 国内模型比 GPT-3.5 便宜 **70-90%**

---

## 推荐配置

### 开发阶段（推荐）

```yaml
方案: DeepSeek-V2
理由: 效果接近 GPT-4，价格便宜
月费用（开发期）: ¥100-200
注册: https://platform.deepseek.com
赠送: ¥500 免费额度（够用 2-3 个月开发）
```

### 生产阶段（推荐）

```yaml
分析 Agent (10个): Qwen-Turbo
  - 便宜稳定，适合高频调用
  - 月费用: ¥400 (50用户)

决策/复盘 Agent: DeepSeek-V2
  - 推理强，关键决策准确
  - 月费用: ¥100 (50用户)

总费用: ¥500/月 (vs GPT-3.5 的 ¥2,200)
```

---

## 集成代码

### 统一 LLM 客户端

```python
# app/services/llm_client.py
import os
from typing import Optional
from openai import AsyncOpenAI


class LLMClient:
    """统一 LLM 客户端，支持多家国内厂商"""

    PROVIDERS = {
        "deepseek": {
            "base_url": "https://api.deepseek.com/v1",
            "models": {
                "default": "deepseek-chat",
                "advanced": "deepseek-coder",
            }
        },
        "aliyun": {
            "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "models": {
                "default": "qwen-turbo",
                "advanced": "qwen-plus",
            }
        },
        "zhipu": {
            "base_url": "https://open.bigmodel.cn/api/paas/v4",
            "models": {
                "default": "glm-4-flash",
                "advanced": "glm-4",
            }
        },
    }

    def __init__(self, provider: Optional[str] = None):
        self.provider = provider or os.getenv("LLM_PROVIDER", "deepseek")
        config = self.PROVIDERS.get(self.provider, self.PROVIDERS["deepseek"])

        api_key = os.getenv(f"{self.provider.upper()}_API_KEY")
        if not api_key:
            raise ValueError(f"请设置 {self.provider.upper()}_API_KEY 环境变量")

        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=config["base_url"]
        )
        self.models = config["models"]

    async def chat(
        self,
        messages: list,
        model_type: str = "default",
        temperature: float = 0.7,
        max_tokens: int = 1000
    ) -> str:
        """对话"""
        model = self.models.get(model_type, self.models["default"])

        response = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )

        return response.choices[0].message.content


# 全局实例
llm_client = LLMClient()
```

### 环境变量配置

```bash
# .env 文件

# 选择厂商: deepseek | aliyun | zhipu
LLM_PROVIDER=deepseek

# 各厂商 API Key（在官网申请）
DEEPSEEK_API_KEY=sk-your-key-here
ALIYUN_API_KEY=sk-your-key-here
ZHIPU_API_KEY=your-key-here
```

---

## 申请步骤

### 1. DeepSeek（推荐首选）

```
1. 访问 https://platform.deepseek.com
2. 用手机号注册
3. 实名认证（个人即可）
4. 获取 API Key
5. 赠送 ¥500 额度，立即使用
```

### 2. 阿里云 DashScope

```
1. 访问 https://dashscope.aliyun.com
2. 用阿里云账号登录
3. 开通 DashScope 服务
4. 获取 API Key
5. 赠送 ¥100 额度
```

### 3. 智谱 AI

```
1. 访问 https://open.bigmodel.cn
2. 注册账号
3. 实名认证
4. 获取 API Key
5. 新用户赠送 500万 tokens
```

---

## 测试对比

建议你注册 **DeepSeek** 和 **阿里云** 两个，对比测试：

```python
# test_models.py
import asyncio

async def test_all_models():
    test_prompt = """
    股票代码: 000001
    当前价格: 10.5元
    涨跌幅: +2.5%
    MA5: 10.2
    MA20: 9.8
    MACD: 金叉
    成交量: 放量1.8倍

    请分析该股票今日涨停潜力。
    """

    messages = [
        {"role": "system", "content": "你是股票分析专家"},
        {"role": "user", "content": test_prompt}
    ]

    # 测试 DeepSeek
    deepseek = LLMClient("deepseek")
    result_ds = await deepseek.chat(messages)
    print("=== DeepSeek ===")
    print(result_ds)

    # 测试阿里云
    aliyun = LLMClient("aliyun")
    result_qw = await aliyun.chat(messages)
    print("\n=== Qwen ===")
    print(result_qw)

asyncio.run(test_all_models())
```

---

## 最终建议

| 阶段 | 推荐模型 | 月费用 | 理由 |
|-----|---------|--------|------|
| **开发期** | DeepSeek-V2 | ¥100-200 | 免费额度多，效果顶尖 |
| **上线初期** | Qwen-Turbo | ¥400-600 | 稳定便宜，适合高频 |
| **规模期** | Qwen-Turbo + DeepSeek-V2 混合 | ¥500-800 | 成本和效果平衡 |

**现在就注册 DeepSeek，有 ¥500 免费额度，够你开发 2-3 个月。**

官网：https://platform.deepseek.com
