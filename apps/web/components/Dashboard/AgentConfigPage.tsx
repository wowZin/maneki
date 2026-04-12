"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  Bot,
  Brain,
  TrendingUp,
  Newspaper,
  Coins,
  Save,
  X,
  ChevronRight,
  Settings,
  Eye,
  Play,
} from "lucide-react";

// 类型定义
interface AgentConfig {
  agent_id: string;
  agent_name: string;
  agent_type: "sentiment" | "technical" | "capital" | "fundamental";
  is_custom: boolean;
  is_active: boolean;
  system_prompt: string;
  description?: string;
  parameters: AgentParameters;
  created_at: string;
  updated_at: string;
}

interface AgentParameters {
  temperature: number;
  max_tokens: number;
  confidence_threshold: number;
  // 各类型特有参数
  news_sources?: string[]; // sentiment
  indicators?: string[]; // technical
  capital_weight?: number; // capital
  analysis_depth?: "basic" | "standard" | "deep"; // fundamental
}

interface AgentTemplate {
  type: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  default_prompt: string;
  default_params: Partial<AgentParameters>;
}

// Agent类型模板
const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    type: "sentiment",
    name: "情绪分析Agent",
    description: "分析市场情绪、新闻舆情、社交媒体情绪",
    icon: <Newspaper className="w-5 h-5" />,
    default_prompt: `你是一个专业的市场情绪分析专家。你的任务是分析当前市场情绪对股票涨停可能性的影响。

分析维度：
1. 新闻舆情：正面/负面新闻的密度和影响
2. 社交媒体：股吧、雪球等平台的情绪热度
3. 市场整体情绪：恐慌/贪婪指数
4. 板块情绪：特定板块的炒作热度

输出格式：
- 情绪评分（0-100）
- 主要情绪驱动因素
- 对涨停预测的建议权重`,
    default_params: {
      news_sources: [" Eastmoney", "Xueqiu", "Sina"],
      confidence_threshold: 0.6,
    },
  },
  {
    type: "technical",
    name: "技术分析Agent",
    description: "分析K线形态、技术指标、量价关系",
    icon: <TrendingUp className="w-5 h-5" />,
    default_prompt: `你是一个专业的技术分析专家。你的任务是通过技术指标分析股票涨停的可能性。

分析维度：
1. K线形态：是否出现突破形态、涨停基因
2. 均线系统：多头排列、支撑压力位
3. 成交量：放量突破、量价配合
4. 技术指标：MACD、RSI、KDJ等

输出格式：
- 技术评分（0-100）
- 关键技术信号
- 建议买入/观望/卖出`,
    default_params: {
      indicators: ["MA", "MACD", "RSI", "Volume"],
      confidence_threshold: 0.65,
    },
  },
  {
    type: "capital",
    name: "资金流向Agent",
    description: "分析主力资金流向、大单成交、资金博弈",
    icon: <Coins className="w-5 h-5" />,
    default_prompt: `你是一个专业的资金流向分析专家。你的任务是通过资金数据分析股票涨停的可能性。

分析维度：
1. 主力资金：大单净流入/流出
2. 龙虎榜数据：机构/游资动向
3. 筹码分布：集中度、获利盘比例
4. 资金博弈：买方/卖方力量对比

输出格式：
- 资金评分（0-100）
- 主力资金动向
- 涨停概率评估`,
    default_params: {
      capital_weight: 0.4,
      confidence_threshold: 0.7,
    },
  },
  {
    type: "fundamental",
    name: "基本面Agent",
    description: "分析公司基本面、财报、行业地位",
    icon: <Brain className="w-5 h-5" />,
    default_prompt: `你是一个专业的基本面分析师。你的任务是通过公司基本面数据评估股票的长期价值和短期炒作可能性。

分析维度：
1. 财务指标：营收增长、利润率、ROE
2. 行业地位：市场份额、竞争优势
3. 催化剂：业绩预告、重大合同、政策利好
4. 估值水平：PE、PB相对历史水平

输出格式：
- 基本面评分（0-100）
- 主要利好/风险因素
- 投资价值评估`,
    default_params: {
      analysis_depth: "standard",
      confidence_threshold: 0.55,
    },
  },
];

const AGENT_COLORS: Record<string, string> = {
  sentiment: "bg-amber-100 text-amber-800 border-amber-200",
  technical: "bg-blue-100 text-blue-800 border-blue-200",
  capital: "bg-green-100 text-green-800 border-green-200",
  fundamental: "bg-purple-100 text-purple-800 border-purple-200",
};

// 主组件
export default function AgentConfigPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null);

  // 表单状态
  const [formData, setFormData] = useState<Partial<AgentConfig>>({
    agent_name: "",
    agent_type: "sentiment",
    system_prompt: "",
    description: "",
    parameters: {
      temperature: 0.7,
      max_tokens: 2000,
      confidence_threshold: 0.6,
    },
    is_active: true,
  });

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      // TODO: 替换为实际API
      const res = await fetch("/api/agents/my-agents");
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error("获取Agent列表失败:", error);
      // 模拟数据
      setAgents([
        {
          agent_id: "custom_sentiment_001",
          agent_name: "我的情绪Agent",
          agent_type: "sentiment",
          is_custom: true,
          is_active: true,
          system_prompt: AGENT_TEMPLATES[0].default_prompt,
          description: "专注于社交媒体情绪分析",
          parameters: {
            temperature: 0.7,
            max_tokens: 2000,
            confidence_threshold: 0.6,
            news_sources: ["Xueqiu", "Eastmoney"],
          },
          created_at: "2026-04-01T10:00:00Z",
          updated_at: "2026-04-10T15:30:00Z",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = async () => {
    try {
      // TODO: 替换为实际API
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      setAgents([...agents, data]);
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("创建Agent失败:", error);
    }
  };

  const handleUpdateAgent = async () => {
    if (!selectedAgent) return;
    try {
      // TODO: 替换为实际API
      const res = await fetch(`/api/agents/${selectedAgent.agent_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      setAgents(agents.map((a) => (a.agent_id === data.agent_id ? data : a)));
      setSelectedAgent(null);
      setIsEditMode(false);
      resetForm();
    } catch (error) {
      console.error("更新Agent失败:", error);
    }
  };

  const handleDeleteAgent = async () => {
    if (!agentToDelete) return;
    try {
      await fetch(`/api/agents/${agentToDelete}`, { method: "DELETE" });
      setAgents(agents.filter((a) => a.agent_id !== agentToDelete));
      setAgentToDelete(null);
    } catch (error) {
      console.error("删除Agent失败:", error);
    }
  };

  const handleToggleActive = async (agent: AgentConfig) => {
    try {
      const updated = { ...agent, is_active: !agent.is_active };
      await fetch(`/api/agents/${agent.agent_id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: updated.is_active }),
      });
      setAgents(agents.map((a) => (a.agent_id === agent.agent_id ? updated : a)));
    } catch (error) {
      console.error("切换Agent状态失败:", error);
    }
  };

  const startEdit = (agent: AgentConfig) => {
    setSelectedAgent(agent);
    setFormData({
      agent_name: agent.agent_name,
      agent_type: agent.agent_type,
      system_prompt: agent.system_prompt,
      description: agent.description,
      parameters: agent.parameters,
      is_active: agent.is_active,
    });
    setIsEditMode(true);
  };

  const resetForm = () => {
    setFormData({
      agent_name: "",
      agent_type: "sentiment",
      system_prompt: "",
      description: "",
      parameters: {
        temperature: 0.7,
        max_tokens: 2000,
        confidence_threshold: 0.6,
      },
      is_active: true,
    });
  };

  const selectTemplate = (template: AgentTemplate) => {
    setFormData({
      ...formData,
      agent_type: template.type as any,
      system_prompt: template.default_prompt,
      parameters: {
        ...formData.parameters,
        ...template.default_params,
      },
    });
  };

  if (loading) {
    return <ConfigPageSkeleton />;
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-8 h-8 text-gray-700" />
            Agent 配置管理
          </h1>
          <p className="text-gray-500 mt-1">
            管理您的自定义 Agent，优化预测策略
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              创建 Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>创建自定义 Agent</DialogTitle>
              <DialogDescription>
                选择模板或从头开始创建您的专属 Agent
              </DialogDescription>
            </DialogHeader>

            {/* 模板选择 */}
            {!formData.system_prompt && (
              <div className="grid grid-cols-2 gap-4 py-4">
                {AGENT_TEMPLATES.map((template) => (
                  <Card
                    key={template.type}
                    className="cursor-pointer hover:border-blue-400 transition-colors"
                    onClick={() => selectTemplate(template)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          {template.icon}
                        </div>
                        <div>
                          <h4 className="font-semibold">{template.name}</h4>
                          <p className="text-sm text-gray-500">
                            {template.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* 表单 */}
            {formData.system_prompt && (
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">
                    {AGENT_TEMPLATES.find((t) => t.type === formData.agent_type)?.name}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setFormData({ ...formData, system_prompt: "" })
                    }
                  >
                    更换模板
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Agent 名称</Label>
                  <Input
                    value={formData.agent_name}
                    onChange={(e) =>
                      setFormData({ ...formData, agent_name: e.target.value })
                    }
                    placeholder="给我的Agent起个名字"
                  />
                </div>

                <div className="space-y-2">
                  <Label>描述</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="简要描述这个Agent的用途"
                  />
                </div>

                <div className="space-y-2">
                  <Label>系统提示词</Label>
                  <Textarea
                    value={formData.system_prompt}
                    onChange={(e) =>
                      setFormData({ ...formData, system_prompt: e.target.value })
                    }
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>创意度 (Temperature)</Label>
                    <Slider
                      value={[formData.parameters?.temperature || 0.7]}
                      onValueChange={([v]) =>
                        setFormData({
                          ...formData,
                          parameters: { ...formData.parameters, temperature: v },
                        })
                      }
                      min={0}
                      max={1}
                      step={0.1}
                    />
                    <span className="text-sm text-gray-500">
                      {formData.parameters?.temperature}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label>置信度阈值</Label>
                    <Slider
                      value={[formData.parameters?.confidence_threshold || 0.6]}
                      onValueChange={([v]) =>
                        setFormData({
                          ...formData,
                          parameters: {
                            ...formData.parameters,
                            confidence_threshold: v,
                          },
                        })
                      }
                      min={0.3}
                      max={0.9}
                      step={0.05}
                    />
                    <span className="text-sm text-gray-500">
                      {formData.parameters?.confidence_threshold}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label>最大 Token</Label>
                    <Select
                      value={String(formData.parameters?.max_tokens)}
                      onValueChange={(v) =>
                        setFormData({
                          ...formData,
                          parameters: {
                            ...formData.parameters,
                            max_tokens: parseInt(v),
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1000">1000</SelectItem>
                        <SelectItem value="2000">2000</SelectItem>
                        <SelectItem value="4000">4000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetForm();
                }}
              >
                取消
              </Button>
              <Button
                onClick={handleCreateAgent}
                disabled={!formData.agent_name || !formData.system_prompt}
              >
                创建
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* VIP 提示 */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <div>
              <p className="font-medium text-purple-900">VIP 专属功能</p>
              <p className="text-sm text-purple-700">
                您最多可以创建 5 个自定义 Agent，当前已创建 {agents.length} 个
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent 列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {agents.map((agent) => (
          <Card key={agent.agent_id} className="relative group">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${AGENT_COLORS[agent.agent_type]}`}>
                    {agent.agent_type === "sentiment" && <Newspaper className="w-5 h-5" />}
                    {agent.agent_type === "technical" && <TrendingUp className="w-5 h-5" />}
                    {agent.agent_type === "capital" && <Coins className="w-5 h-5" />}
                    {agent.agent_type === "fundamental" && <Brain className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{agent.agent_name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {AGENT_TEMPLATES.find((t) => t.type === agent.agent_type)?.name}
                      </Badge>
                      {agent.is_active ? (
                        <Badge className="bg-green-100 text-green-800 text-xs">运行中</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800 text-xs">已停用</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={agent.is_active}
                    onCheckedChange={() => handleToggleActive(agent)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(agent)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => setAgentToDelete(agent.agent_id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {agent.description && (
                <p className="text-sm text-gray-600 mt-3">{agent.description}</p>
              )}

              <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
                <span>置信度: {(agent.parameters.confidence_threshold * 100).toFixed(0)}%</span>
                <span>创意度: {agent.parameters.temperature}</span>
                <span className="text-gray-300">|</span>
                <span>更新于 {new Date(agent.updated_at).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* 添加新 Agent 卡片 */}
        <Card
          className="border-dashed cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <CardContent className="p-5 flex flex-col items-center justify-center h-full min-h-[160px]">
            <Plus className="w-10 h-10 text-gray-400 mb-2" />
            <p className="text-gray-500 font-medium">创建新 Agent</p>
            <p className="text-sm text-gray-400">自定义您的预测策略</p>
          </CardContent>
        </Card>
      </div>

      {/* 编辑对话框 */}
      <Dialog open={isEditMode} onOpenChange={setIsEditMode}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑 Agent</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Agent 名称</Label>
              <Input
                value={formData.agent_name}
                onChange={(e) =>
                  setFormData({ ...formData, agent_name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>描述</Label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>系统提示词</Label>
              <Textarea
                value={formData.system_prompt}
                onChange={(e) =>
                  setFormData({ ...formData, system_prompt: e.target.value })
                }
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>创意度</Label>
                <Slider
                  value={[formData.parameters?.temperature || 0.7]}
                  onValueChange={([v]) =>
                    setFormData({
                      ...formData,
                      parameters: { ...formData.parameters, temperature: v },
                    })
                  }
                  min={0}
                  max={1}
                  step={0.1}
                />
                <span className="text-sm text-gray-500">
                  {formData.parameters?.temperature}
                </span>
              </div>

              <div className="space-y-2">
                <Label>置信度阈值</Label>
                <Slider
                  value={[formData.parameters?.confidence_threshold || 0.6]}
                  onValueChange={([v]) =>
                    setFormData({
                      ...formData,
                      parameters: {
                        ...formData.parameters,
                        confidence_threshold: v,
                      },
                    })
                  }
                  min={0.3}
                  max={0.9}
                  step={0.05}
                />
                <span className="text-sm text-gray-500">
                  {formData.parameters?.confidence_threshold}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditMode(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateAgent}>保存更改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog
        open={!!agentToDelete}
        onOpenChange={() => setAgentToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后该 Agent 的预测历史仍会保留，但无法继续使用。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAgent}
              className="bg-red-500 hover:bg-red-600"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// 骨架屏
function ConfigPageSkeleton() {
  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
      <div className="h-20 bg-gray-200 rounded animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
