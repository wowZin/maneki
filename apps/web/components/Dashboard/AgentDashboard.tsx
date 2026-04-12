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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, TrendingDown, Activity, Target, Users } from "lucide-react";

// 类型定义
interface AgentStats {
  agent_type: string;
  agent_name: string;
  total_predictions: number;
  success_count: number;
  success_rate: number;
  avg_confidence: number;
}

interface DashboardSummary {
  selected_date: string;
  total_predictions: number;
  success_count: number;
  success_rate: number;
  compared_to_prev: number;
  agent_ranking: AgentStats[];
}

interface TrendData {
  dates: string[];
  success_rates: number[];
  prediction_counts: number[];
}

interface AgentPerformanceTrend {
  agent_type: string;
  agent_name: string;
  dates: string[];
  success_rates: number[];
}

interface DashboardData {
  summary: DashboardSummary;
  daily_trend: TrendData;
  agent_trends: AgentPerformanceTrend[];
  available_dates: string[];
}

// 颜色配置
const AGENT_COLORS: Record<string, string> = {
  technical: "#3b82f6", // 蓝色
  capital: "#10b981",   // 绿色
  sentiment: "#f59e0b", // 橙色
  fundamental: "#8b5cf6", // 紫色
};

const AGENT_NAMES: Record<string, string> = {
  technical: "技术Agent",
  capital: "资金Agent",
  sentiment: "情绪Agent",
  fundamental: "基本面Agent",
};

// 主组件
export default function AgentDashboard() {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // 获取数据
  useEffect(() => {
    fetchDashboardData();
  }, [selectedDate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const url = selectedDate
        ? `/api/dashboard/stats?target_date=${selectedDate}`
        : "/api/dashboard/stats";
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

  const { summary, daily_trend, agent_trends } = data;

  // 构造图表数据
  const trendChartData = daily_trend.dates.map((date, i) => ({
    date,
    成功率: (daily_trend.success_rates[i] * 100).toFixed(1),
    预测数: daily_trend.prediction_counts[i],
  }));

  const agentTrendData = agent_trends[0]?.dates.map((date, i) => {
    const point: Record<string, any> = { date };
    agent_trends.forEach((agent) => {
      point[agent.agent_name] = (agent.success_rates[i] * 100).toFixed(1);
    });
    return point;
  });

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agent预测效果看板</h1>
          <p className="text-gray-500 mt-1">实时监控各Agent涨停预测准确率</p>
        </div>
        <DateSelector
          dates={data.available_dates}
          selected={selectedDate}
          onChange={setSelectedDate}
        />
      </div>

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
          value={summary.agent_ranking.length}
          suffix="个"
          icon={<Users className="w-6 h-6 text-orange-500" />}
        />
      </div>

      {/* 图表区域 */}
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
                <Tooltip
                  formatter={(value: any) => [`${value}%`, "成功率"]}
                  labelFormatter={(label) => `日期: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="成功率"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Agent对比趋势 */}
        <Card>
          <CardHeader>
            <CardTitle>各Agent成功率对比</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={agentTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value: any) => `${value}%`} />
                <Legend />
                {agent_trends.map((agent) => (
                  <Line
                    key={agent.agent_type}
                    type="monotone"
                    dataKey={agent.agent_name}
                    stroke={AGENT_COLORS[agent.agent_type]}
                    strokeWidth={2}
                    dot={false}
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
          <CardTitle>Agent表现排名</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {summary.agent_ranking.map((agent, index) => (
              <AgentCard key={agent.agent_type} agent={agent} rank={index + 1} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 预测数量趋势 */}
      <Card>
        <CardHeader>
          <CardTitle>每日预测数量</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="预测数" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// 日期选择器组件
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
      <span className="text-sm text-gray-500">选择日期:</span>
      <Select value={selected} onValueChange={onChange}>
        <SelectTrigger className="w-[180px]">
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

// 指标卡片组件
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

// Agent卡片组件
function AgentCard({ agent, rank }: { agent: AgentStats; rank: number }) {
  const colors = ["bg-yellow-100 text-yellow-800", "bg-gray-100 text-gray-800", "bg-orange-100 text-orange-800"];
  const rankColor = rank <= 3 ? colors[rank - 1] : "bg-blue-100 text-blue-800";

  return (
    <div className="flex items-center p-4 bg-gray-50 rounded-lg">
      <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${rankColor}`}>
        {rank}
      </div>
      <div className="ml-4 flex-1">
        <h4 className="font-semibold text-gray-900">{agent.agent_name}</h4>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <span className="text-gray-600">
            成功率: <span className="font-medium text-gray-900">{(agent.success_rate * 100).toFixed(1)}%</span>
          </span>
          <span className="text-gray-600">
            预测: <span className="font-medium text-gray-900">{agent.success_count}/{agent.total_predictions}</span>
          </span>
        </div>
      </div>
      <div className="text-right">
        <Badge
          variant={agent.success_rate > 0.6 ? "success" : agent.success_rate > 0.5 ? "default" : "secondary"}
        >
          置信度 {(agent.avg_confidence * 100).toFixed(0)}%
        </Badge>
      </div>
    </div>
  );
}

// 骨架屏组件
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
