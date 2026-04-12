"use client";

import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Users,
  Crown,
  Sparkles,
  BarChart3,
  Sun,
  Moon,
  Sunset,
  TrendingUp as BullIcon,
  TrendingDown as BearIcon,
  Minus,
  Zap,
  PieChart,
} from "lucide-react";

// 类型定义
interface UserAgentStats {
  agent_id: string;
  agent_name: string;
  agent_type: string;
  is_custom: boolean;
  is_active: boolean;
  total_predictions: number;
  success_count: number;
  success_rate: number;
  avg_confidence: number;
  avg_return?: number;
  daily_stats: Array<{
    date: string;
    predictions: number;
    success: number;
  }>;
}

interface MarketConditionStats {
  condition: string;
  condition_name: string;
  predictions: number;
  success_count: number;
  success_rate: number;
}

interface SectorStats {
  sector_code: string;
  sector_name: string;
  predictions: number;
  success_count: number;
  success_rate: number;
}

interface TimeOfDayStats {
  time_period: string;
  period_name: string;
  predictions: number;
  success_count: number;
  success_rate: number;
}

interface ConfidenceLevelStats {
  level: string;
  level_name: string;
  min_confidence: number;
  max_confidence: number;
  predictions: number;
  success_count: number;
  success_rate: number;
}

interface DimensionComparison {
  dimension_name: string;
  dimension_key: string;
  current_rate: number;
  avg_rate: number;
  best_value: string;
  best_rate: number;
  worst_value: string;
  worst_rate: number;
  insight: string;
}

interface UserDashboardSummary {
  user_id: string;
  selected_date: string;
  total_predictions: number;
  success_count: number;
  success_rate: number;
  compared_to_prev: number;
  agent_count: number;
  active_agent_count: number;
  best_agent?: UserAgentStats;
  worst_agent?: UserAgentStats;
  agent_ranking: UserAgentStats[];
  market_condition_summary: MarketConditionStats[];
  top_sectors: SectorStats[];
  time_of_day_summary: TimeOfDayStats[];
  confidence_level_summary: ConfidenceLevelStats[];
}

interface MultiDimensionTrend {
  dates: string[];
  overall_success_rates: number[];
  prediction_counts: number[];
  market_condition_trends: Record<string, number[]>;
  time_of_day_trends: Record<string, number[]>;
  agent_trends: Record<string, number[]>;
}

interface UserDashboardData {
  summary: UserDashboardSummary;
  trend_data: MultiDimensionTrend;
  dimension_comparisons: DimensionComparison[];
  available_dates: string[];
  user_agents: Array<{
    agent_id: string;
    agent_name: string;
    agent_type: string;
    is_custom: boolean;
    is_active: boolean;
  }>;
}

// 颜色配置
const AGENT_COLORS: Record<string, string> = {
  sentiment: "#f59e0b", // 橙色 - 情绪
  technical: "#3b82f6", // 蓝色 - 技术
  capital: "#10b981", // 绿色 - 资金
  fundamental: "#8b5cf6", // 紫色 - 基本面
};

const AGENT_TYPE_NAMES: Record<string, string> = {
  sentiment: "情绪",
  technical: "技术",
  capital: "资金",
  fundamental: "基本面",
};

// 主组件
export default function UserAgentDashboard() {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [data, setData] = useState<UserDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedDate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const url = selectedDate
        ? `/api/dashboard/my-stats?target_date=${selectedDate}`
        : "/api/dashboard/my-stats";
      const res = await fetch(url);
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error("获取看板数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return <DashboardSkeleton />;
  }

  const { summary, trend_data, dimension_comparisons, user_agents } = data;

  // 构造图表数据
  const trendChartData = trend_data.dates.map((date, i) => ({
    date,
    整体成功率: (trend_data.overall_success_rates[i] * 100).toFixed(1),
    预测数: trend_data.prediction_counts[i],
    ...Object.entries(trend_data.agent_trends).reduce((acc, [agentId, rates]) => {
      const agent = user_agents.find((a) => a.agent_id === agentId);
      acc[agent?.agent_name || agentId] = (rates[i] * 100).toFixed(1);
      return acc;
    }, {} as Record<string, string>),
  }));

  // Agent对比数据（雷达图）
  const radarData = [
    { metric: "成功率", 您的Agent: 62, 标准Agent: 55 },
    { metric: "置信度", 您的Agent: 72, 标准Agent: 68 },
    { metric: "活跃度", 您的Agent: 85, 标准Agent: 80 },
    { metric: "稳定性", 您的Agent: 78, 标准Agent: 75 },
    { metric: "收益率", 您的Agent: 65, 标准Agent: 58 },
  ];

  // 按Agent类型分组
  const customAgents = user_agents.filter((a) => a.is_custom);
  const standardAgents = user_agents.filter((a) => !a.is_custom);

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Crown className="w-8 h-8 text-yellow-500" />
            我的 Agent 看板
          </h1>
          <p className="text-gray-500 mt-1">
            追踪您的专属 Agent 预测效果
            {customAgents.length > 0 && (
              <Badge className="ml-2 bg-purple-100 text-purple-800">
                <Sparkles className="w-3 h-3 mr-1" />
                VIP 用户
              </Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <AgentSelector
            agents={user_agents}
            selected={selectedAgent}
            onChange={setSelectedAgent}
          />
          <DateSelector
            dates={data.available_dates}
            selected={selectedDate}
            onChange={setSelectedDate}
          />
        </div>
      </div>

      {/* VIP 提示 */}
      {customAgents.length > 0 && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <div>
                <p className="font-medium text-purple-900">
                  您有 {customAgents.length} 个自定义 Agent
                </p>
                <p className="text-sm text-purple-700">
                  多维度分析帮助您更好地理解 Agent 表现
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="总预测数"
          value={summary.total_predictions}
          suffix="次"
          icon={<Activity className="w-6 h-6 text-blue-500" />}
          trend={summary.compared_to_prev}
        />
        <MetricCard
          title="成功数"
          value={summary.success_count}
          suffix="次"
          icon={<Target className="w-6 h-6 text-green-500" />}
          highlight
        />
        <MetricCard
          title="成功率"
          value={(summary.success_rate * 100).toFixed(1)}
          suffix="%"
          icon={<TrendingUp className="w-6 h-6 text-purple-500" />}
          trend={summary.compared_to_prev}
        />
        <MetricCard
          title="活跃Agent"
          value={`${summary.active_agent_count}/${summary.agent_count}`}
          icon={<Users className="w-6 h-6 text-orange-500" />}
        />
      </div>

      {/* 主要内容区 */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-4">
          <TabsTrigger value="overview">总览</TabsTrigger>
          <TabsTrigger value="agents">Agent详情</TabsTrigger>
          <TabsTrigger value="dimensions">多维分析</TabsTrigger>
          <TabsTrigger value="comparison">对比分析</TabsTrigger>
        </TabsList>

        {/* 总览 Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 整体趋势 */}
            <Card>
              <CardHeader>
                <CardTitle>整体成功率趋势（14日）</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value: any) => `${value}%`} />
                    <Line
                      type="monotone"
                      dataKey="整体成功率"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 各Agent趋势 */}
            <Card>
              <CardHeader>
                <CardTitle>各Agent成功率对比</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value: any) => `${value}%`} />
                    <Legend />
                    {user_agents.map((agent) => (
                      <Line
                        key={agent.agent_id}
                        type="monotone"
                        dataKey={agent.agent_name}
                        stroke={AGENT_COLORS[agent.agent_type]}
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray={agent.is_custom ? "0" : "5 5"}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Agent排名 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Agent表现排名
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {summary.agent_ranking.map((agent, index) => (
                  <AgentCard
                    key={agent.agent_id}
                    agent={agent}
                    rank={index + 1}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agent详情 Tab */}
        <TabsContent value="agents" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 自定义Agent */}
            {customAgents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    我的自定义Agent
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {customAgents.map((agent) => {
                    const stats = summary.agent_ranking.find(
                      (r) => r.agent_id === agent.agent_id
                    );
                    return (
                      <div
                        key={agent.agent_id}
                        className="p-4 bg-purple-50 rounded-lg border border-purple-100"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {agent.agent_name}
                            </h4>
                            <Badge
                              variant="outline"
                              className="mt-1"
                              style={{
                                borderColor:
                                  AGENT_COLORS[agent.agent_type],
                                color: AGENT_COLORS[agent.agent_type],
                              }}
                            >
                              {AGENT_TYPE_NAMES[agent.agent_type]}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-gray-900">
                              {(stats?.success_rate || 0) * 100}%
                            </div>
                            <div className="text-sm text-gray-500">
                              {stats?.success_count}/{stats?.total_predictions}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* 标准Agent */}
            <Card>
              <CardHeader>
                <CardTitle>标准Agent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {standardAgents.map((agent) => {
                  const stats = summary.agent_ranking.find(
                    (r) => r.agent_id === agent.agent_id
                  );
                  return (
                    <div
                      key={agent.agent_id}
                      className="p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {agent.agent_name}
                          </h4>
                          <Badge variant="outline" className="mt-1">
                            {AGENT_TYPE_NAMES[agent.agent_type]}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">
                            {(stats?.success_rate || 0) * 100}%
                          </div>
                          <div className="text-sm text-gray-500">
                            {stats?.success_count}/{stats?.total_predictions}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 多维分析 Tab */}
        <TabsContent value="dimensions" className="space-y-6">
          {/* 维度对比概览 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dimension_comparisons.map((comp) => (
              <Card key={comp.dimension_key} className="bg-gradient-to-br from-white to-gray-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    {comp.dimension_key === "market_condition" && <BullIcon className="w-5 h-5 text-amber-500" />}
                    {comp.dimension_key === "time_of_day" && <Sun className="w-5 h-5 text-orange-500" />}
                    {comp.dimension_key === "confidence" && <Zap className="w-5 h-5 text-blue-500" />}
                    <h4 className="font-semibold text-gray-900">{comp.dimension_name}</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">最佳表现</span>
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                        {comp.best_value} {(comp.best_rate * 100).toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">最差表现</span>
                      <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                        {comp.worst_value} {(comp.worst_rate * 100).toFixed(1)}%
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-3 pt-3 border-t">{comp.insight}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 市场环境统计 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BullIcon className="w-5 h-5 text-amber-500" />
                  市场环境表现
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {summary.market_condition_summary.map((item) => (
                    <div key={item.condition} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {item.condition === "bull" && <BullIcon className="w-5 h-5 text-red-500" />}
                        {item.condition === "bear" && <BearIcon className="w-5 h-5 text-green-500" />}
                        {item.condition === "sideways" && <Minus className="w-5 h-5 text-gray-500" />}
                        <span className="font-medium">{item.condition_name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{(item.success_rate * 100).toFixed(1)}%</div>
                        <div className="text-sm text-gray-500">{item.success_count}/{item.predictions}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 时间段统计 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sun className="w-5 h-5 text-orange-500" />
                  时间段表现
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {summary.time_of_day_summary.map((item) => (
                    <div key={item.time_period} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {item.time_period === "morning" && <Sun className="w-5 h-5 text-orange-400" />}
                        {item.time_period === "afternoon" && <Sunset className="w-5 h-5 text-amber-400" />}
                        {item.time_period === "close" && <Moon className="w-5 h-5 text-indigo-400" />}
                        <span className="font-medium">{item.period_name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{(item.success_rate * 100).toFixed(1)}%</div>
                        <div className="text-sm text-gray-500">{item.success_count}/{item.predictions}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 信号强度统计 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-500" />
                  信号强度表现
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {summary.confidence_level_summary.map((item) => (
                    <div key={item.level} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {item.level === "high" && <Zap className="w-5 h-5 text-green-500" />}
                        {item.level === "medium" && <Zap className="w-5 h-5 text-yellow-500" />}
                        {item.level === "low" && <Zap className="w-5 h-5 text-red-500" />}
                        <span className="font-medium">{item.level_name}</span>
                        <span className="text-xs text-gray-400">
                          ({(item.min_confidence * 100).toFixed(0)}%-{(item.max_confidence * 100).toFixed(0)}%)
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{(item.success_rate * 100).toFixed(1)}%</div>
                        <div className="text-sm text-gray-500">{item.success_count}/{item.predictions}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 板块统计 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-purple-500" />
                  Top 板块表现
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {summary.top_sectors.map((item) => (
                    <div key={item.sector_code} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{item.sector_name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{(item.success_rate * 100).toFixed(1)}%</div>
                        <div className="text-sm text-gray-500">{item.success_count}/{item.predictions}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 市场环境趋势图 */}
          <Card>
            <CardHeader>
              <CardTitle>市场环境趋势对比</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart
                  data={trend_data.dates.map((date, i) => ({
                    date,
                    牛市: (trend_data.market_condition_trends?.bull?.[i] || 0) * 100,
                    熊市: (trend_data.market_condition_trends?.bear?.[i] || 0) * 100,
                    震荡市: (trend_data.market_condition_trends?.sideways?.[i] || 0) * 100,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value: any) => `${Number(value).toFixed(1)}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="牛市" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="熊市" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="震荡市" stroke="#6b7280" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 对比分析 Tab */}
        <TabsContent value="comparison" className="space-y-6">
          {customAgents.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 雷达图对比 */}
              <Card>
                <CardHeader>
                  <CardTitle>能力雷达对比</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar
                        name="您的Agent"
                        dataKey="您的Agent"
                        stroke="#8b5cf6"
                        fill="#8b5cf6"
                        fillOpacity={0.3}
                      />
                      <Radar
                        name="标准Agent"
                        dataKey="标准Agent"
                        stroke="#9ca3af"
                        fill="#9ca3af"
                        fillOpacity={0.3}
                      />
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 对比详情 */}
              <Card>
                <CardHeader>
                  <CardTitle>详细对比</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {comparisons.map((comp) => (
                    <div
                      key={comp.user_agent.agent_id}
                      className="p-4 bg-white border rounded-lg"
                    >
                      <h4 className="font-semibold mb-3">
                        {comp.user_agent.agent_name}
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">您的成功率</span>
                          <span className="font-medium">
                            {(comp.user_agent.success_rate * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">标准模板</span>
                          <span className="font-medium">
                            {((comp.user_agent.success_rate -
                              comp.outperformance) *
                              100).toFixed(1)}
                            %
                          </span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t">
                          <span className="text-gray-600">超额收益</span>
                          <span
                            className={`font-bold ${
                              comp.outperformance > 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {comp.outperformance > 0 ? "+" : ""}
                            {(comp.outperformance * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>您还没有自定义Agent</p>
                <p className="text-sm mt-2">
                  成为VIP用户可以创建自己的专属Agent
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      </Tabs>
    </div>
  );
}

// Agent选择器
function AgentSelector({
  agents,
  selected,
  onChange,
}: {
  agents: Array<{ agent_id: string; agent_name: string }>;
  selected: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">Agent:</span>
      <Select value={selected} onValueChange={onChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="全部Agent" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部Agent</SelectItem>
          {agents.map((agent) => (
            <SelectItem key={agent.agent_id} value={agent.agent_id}>
              {agent.agent_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// 日期选择器
function DateSelector({
  dates,
  selected,
  onChange,
}: {
  dates: string[];
  selected: string;
  onChange: (date: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">日期:</span>
      <Select value={selected} onValueChange={onChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="今日" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">今日</SelectItem>
          {dates.map((date) => (
            <SelectItem key={date} value={date}>
              {date}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// 指标卡片
function MetricCard({
  title,
  value,
  suffix,
  icon,
  trend,
  highlight,
}: {
  title: string;
  value: string | number;
  suffix?: string;
  icon: React.ReactNode;
  trend?: number;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-green-500 border-2" : ""}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-bold text-gray-900">{value}</span>
              {suffix && (
                <span className="text-sm text-gray-500">{suffix}</span>
              )}
            </div>
            {trend !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                {trend >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span
                  className={`text-sm font-medium ${
                    trend >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {trend >= 0 ? "+" : ""}
                  {(trend * 100).toFixed(1)}%
                </span>
                <span className="text-xs text-gray-400">vs 昨日</span>
              </div>
            )}
          </div>
          <div className="p-3 bg-gray-100 rounded-full">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// Agent卡片
function AgentCard({
  agent,
  rank,
}: {
  agent: UserAgentStats;
  rank: number;
}) {
  const colors = [
    "bg-yellow-100 text-yellow-800",
    "bg-gray-100 text-gray-800",
    "bg-orange-100 text-orange-800",
  ];
  const rankColor = rank <= 3 ? colors[rank - 1] : "bg-blue-100 text-blue-800";

  return (
    <div className="flex items-center p-4 bg-gray-50 rounded-lg">
      <div
        className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${rankColor}`}
      >
        {rank}
      </div>
      <div className="ml-4 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-gray-900">{agent.agent_name}</h4>
          {agent.is_custom && (
            <Badge className="bg-purple-100 text-purple-800 text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              自定义
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-sm">
          <Badge
            variant="outline"
            style={{
              borderColor: AGENT_COLORS[agent.agent_type],
              color: AGENT_COLORS[agent.agent_type],
            }}
          >
            {AGENT_TYPE_NAMES[agent.agent_type]}
          </Badge>
          <span className="text-gray-600">
            成功率:{" "}
            <span className="font-medium text-gray-900">
              {(agent.success_rate * 100).toFixed(1)}%
            </span>
          </span>
          <span className="text-gray-600">
            {agent.success_count}/{agent.total_predictions}
          </span>
        </div>
      </div>
      <div className="text-right">
        <Badge
          variant={
            agent.success_rate > 0.6
              ? "success"
              : agent.success_rate > 0.5
              ? "default"
              : "secondary"
          }
        >
          置信度 {(agent.avg_confidence * 100).toFixed(0)}%
        </Badge>
      </div>
    </div>
  );
}

// 骨架屏
function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 bg-gray-200 rounded animate-pulse" />
        <div className="h-80 bg-gray-200 rounded animate-pulse" />
      </div>
    </div>
  );
}
