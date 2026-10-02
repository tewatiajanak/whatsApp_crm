import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Users,
  MessageSquare,
  DollarSign,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBookmarks } from "@/lib/bookmarks";
import { toast } from "sonner";

const monthlyData = [
  { month: "Jan", leads: 320, conversions: 45, revenue: 18400 },
  { month: "Feb", leads: 410, conversions: 58, revenue: 22100 },
  { month: "Mar", leads: 380, conversions: 52, revenue: 19800 },
  { month: "Apr", leads: 520, conversions: 74, revenue: 28900 },
  { month: "May", leads: 610, conversions: 89, revenue: 33200 },
  { month: "Jun", leads: 750, conversions: 112, revenue: 41650 },
];

const channelMix = [
  { name: "WhatsApp CRM", value: 412, color: "var(--chart-1)" },
  { name: "Website Forms", value: 305, color: "var(--chart-2)" },
  { name: "Email Broadcasts", value: 218, color: "var(--chart-3)" },
  { name: "Walk-in & Events", value: 145, color: "var(--chart-4)" },
];

const teamLeaderboard = [
  { rank: 1, name: "Priya Kothari", leads: 142, converted: 38, rate: "26.7%", revenue: "$14,200" },
  { rank: 2, name: "Aman Sharma", leads: 118, converted: 29, rate: "24.5%", revenue: "$11,600" },
  { rank: 3, name: "Ananya Roy", leads: 95, converted: 21, rate: "22.1%", revenue: "$8,400" },
  { rank: 4, name: "Rohan Verma", leads: 76, converted: 15, rate: "19.7%", revenue: "$6,000" },
];

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState("this-month");
  const url = "/modules/reports";
  const { add, remove, has } = useBookmarks();
  const pinned = has(url);

  const handleExportCSV = () => {
    toast.success("Exporting full analytics dataset to CSV...");
  };

  const handleExportPDF = () => {
    toast.success("Generating executive PDF report...");
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            to="/"
            className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1 text-decoration-none mb-1"
          >
            <ArrowLeft className="h-3 w-3" /> Back to dashboard
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Reports & Executive Analytics</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={pinned ? "secondary" : "outline"}
            onClick={() => (pinned ? remove(url) : add({ title: "Reports & Analytics", url }))}
          >
            {pinned ? <BookmarkCheck className="h-4 w-4 mr-1" /> : <Bookmark className="h-4 w-4 mr-1" />}
            {pinned ? "Bookmarked" : "Bookmark"}
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <FileSpreadsheet className="h-4 w-4" /> Export CSV
          </Button>
          <Button onClick={handleExportPDF} className="bg-primary text-primary-foreground">
            <Download className="h-4 w-4" /> Export PDF Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue (MTD)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">$41,650</div>
            <p className="text-xs text-emerald-600 mt-1">↑ +18.2% vs last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Generated Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">1,080</div>
            <p className="text-xs text-emerald-600 mt-1">✓ Across 4 channels</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overall Conv. Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-600">14.9%</div>
            <p className="text-xs text-muted-foreground mt-1">Industry avg: 9.5%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">WhatsApp Engagement</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">1,284 Threads</div>
            <p className="text-xs text-emerald-600 mt-1">24h SLA compliance 99%</p>
          </CardContent>
        </Card>
      </div>

      {/* Date Range Selector */}
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4 text-muted-foreground" /> Reporting Period:
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={dateRange === "this-month" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange("this-month")}
            >
              This Month
            </Button>
            <Button
              variant={dateRange === "quarter" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange("quarter")}
            >
              Last 3 Months
            </Button>
            <Button
              variant={dateRange === "ytd" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange("ytd")}
            >
              Year to Date (YTD)
            </Button>
          </div>
        </div>
      </Card>

      {/* Charts Section */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Revenue & Growth Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue & Lead Growth Trend</CardTitle>
            <CardDescription>Monthly revenue vs total leads generated</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Lead Source Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Source Mix</CardTitle>
            <CardDescription>Distribution across acquisition channels</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={channelMix} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                  {channelMix.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {channelMix.map((c) => (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="ml-auto font-medium">{c.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Leaderboard Table */}
      <Card>
        <CardHeader className="py-4 px-6 border-b">
          <CardTitle className="text-base font-semibold">Counsellor Performance Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-medium border-b">
                <tr>
                  <th className="px-6 py-3">Rank</th>
                  <th className="px-4 py-3">Team Member</th>
                  <th className="px-4 py-3">Leads Handled</th>
                  <th className="px-4 py-3">Conversions</th>
                  <th className="px-4 py-3">Conv. Rate</th>
                  <th className="px-6 py-3 text-right">Revenue Closed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {teamLeaderboard.map((member) => (
                  <tr key={member.rank} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-foreground">#{member.rank}</td>
                    <td className="px-4 py-4 font-medium">{member.name}</td>
                    <td className="px-4 py-4">{member.leads}</td>
                    <td className="px-4 py-4 font-semibold text-foreground">{member.converted}</td>
                    <td className="px-4 py-4 text-emerald-600 font-medium">{member.rate}</td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">{member.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
