"""
Agent 注册表

管理所有可用的 Agent，提供发现和访问功能
"""

from typing import Dict, List, Optional, Type, Any
from loguru import logger

from app.agents.base.agent import BaseAgent


class AgentRegistry:
    """
    Agent 注册表

    单例模式管理所有 Agent 实例，提供以下功能：
    - 注册 Agent 类
    - 获取 Agent 实例
    - 列出所有可用的 Agent
    - 批量创建 Agent 实例
    """

    _instance: Optional['AgentRegistry'] = None
    _agents: Dict[str, Type[BaseAgent]] = {}
    _instances: Dict[str, BaseAgent] = {}

    def __new__(cls) -> 'AgentRegistry':
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._agents = {}
            cls._instance._instances = {}
        return cls._instance

    def register(self, agent_class: Type[BaseAgent]) -> Type[BaseAgent]:
        """
        注册 Agent 类

        可以用作装饰器：
        @registry.register
        class MyAgent(BaseAgent):
            ...
        """
        agent_type = agent_class.agent_type
        self._agents[agent_type] = agent_class
        logger.info(f"Agent 注册成功: {agent_class.name} (type={agent_type})")
        return agent_class

    def get(self, agent_type: str, llm_client=None, config: Optional[Dict] = None) -> Optional[BaseAgent]:
        """
        获取 Agent 实例

        Args:
            agent_type: Agent 类型标识
            llm_client: LLM 客户端
            config: Agent 配置

        Returns:
            Agent 实例，如果不存在返回 None
        """
        cache_key = f"{agent_type}_{id(llm_client)}_{hash(str(config))}"

        # 检查缓存
        if cache_key in self._instances:
            return self._instances[cache_key]

        # 创建新实例
        agent_class = self._agents.get(agent_type)
        if agent_class is None:
            logger.error(f"Agent 类型未注册: {agent_type}")
            return None

        instance = agent_class(llm_client=llm_client, config=config)
        self._instances[cache_key] = instance
        return instance

    def get_all(self, llm_client=None, config: Optional[Dict] = None) -> Dict[str, BaseAgent]:
        """
        获取所有 Agent 实例

        Returns:
            {agent_type: agent_instance} 字典
        """
        return {
            agent_type: self.get(agent_type, llm_client, config)
            for agent_type in self._agents.keys()
        }

    def list_agents(self) -> List[Dict[str, Any]]:
        """
        列出所有可用的 Agent 信息

        Returns:
            Agent 信息列表
        """
        return [
            {
                "type": agent_type,
                "name": agent_class.name,
                "description": agent_class.description,
                "version": agent_class.version,
            }
            for agent_type, agent_class in self._agents.items()
        ]

    def create_all(self, llm_client=None, config: Optional[Dict] = None) -> List[BaseAgent]:
        """
        创建所有 Agent 实例

        Args:
            llm_client: LLM 客户端
            config: 全局配置

        Returns:
            Agent 实例列表
        """
        agents = []
        for agent_type in self._agents.keys():
            agent = self.get(agent_type, llm_client, config)
            if agent:
                agents.append(agent)
        return agents

    def clear_cache(self):
        """清除实例缓存"""
        self._instances.clear()
        logger.info("Agent 实例缓存已清除")

    def unregister(self, agent_type: str):
        """
        注销 Agent

        Args:
            agent_type: Agent 类型标识
        """
        if agent_type in self._agents:
            del self._agents[agent_type]
            # 清除相关缓存
            keys_to_remove = [k for k in self._instances.keys() if k.startswith(f"{agent_type}_")]
            for key in keys_to_remove:
                del self._instances[key]
            logger.info(f"Agent 已注销: {agent_type}")


# 全局注册表实例
registry = AgentRegistry()
