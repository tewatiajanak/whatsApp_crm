import { Link } from "react-router-dom";
import {
  CalendarRange,
  MessageSquare,
  Globe2,
  Users,
  Megaphone,
  Building2,
  TrendingUp,
  TrendingDown,
  Bookmark,
  BookmarkCheck,
  Plus,
  Search,
  Bell,
  Activity,
  Sparkles,
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBookmarks } from "@/lib/bookmarks";
import { useAuth } from "../../context/AuthContext";

const revenueData = [
  { m: "Jan", revenue: 18400, bookings: 120 },
  { m: "Feb", revenue: 22100, bookings: 142 },
  { m: "Mar", revenue: 19800, bookings: 131 },
  { m: "Apr", revenue: 28900, bookings: 178 },
  { m: "May", revenue: 33200, bookings: 205 },
  { m: "Jun", revenue: 41600, bookings: 247 },
];

const channelData = [
  { name: "WhatsApp", value: 412 },
  { name: "Email", value: 218 },
  { name: "Website", value: 305 },
  { name: "Walk-in", value: 96 },
];

const trafficData = [
  { d: "Mon", visits: 320 },
  { d: "Tue", visits: 410 },
  { d: "Wed", visits: 380 },
  { d: "Thu", visits: 520 },
  { d: "Fri", visits: 610 },
  { d: "Sat", visits: 720 },
  { d: "Sun", visits: 540 },
];

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

const kpis = [
  { label: "Revenue (MTD)", value: "$41,650", delta: "+18.2%", up: true, icon: TrendingUp },
  { label: "Active Bookings", value: "247", delta: "+12.4%", up: true, icon: CalendarRange },
  { label: "WhatsApp Threads", value: "1,284", delta: "+6.1%", up: true, icon: MessageSquare },
  { label: "Churned Users", value: "23", delta: "-3.2%", up: false, icon: Users },
];

const quickActions = [
  { title: "New Event", slug: "events", icon: CalendarRange, hue: "bg-chart-1/15 text-chart-1" },
  { title: "Send Broadcast", slug: "whatsapp", icon: MessageSquare, hue: "bg-chart-2/15 text-chart-2" },
  { title: "Publish Page", slug: "website", icon: Globe2, hue: "bg-chart-3/15 text-chart-3" },
  { title: "Invite User", slug: "users", icon: Users, hue: "bg-chart-4/15 text-chart-4" },
  { title: "Announcement", slug: "communication", icon: Megaphone, hue: "bg-chart-5/15 text-chart-5" },
  { title: "Check-in Guest", slug: "front-office", icon: Building2, hue: "bg-primary/10 text-primary" },
];

const activity = [
  { who: "Priya", what: "checked in 4 guests", when: "2m ago", tag: "Front Office" },
  { who: "Aman", what: "published 'Summer Gala' landing page", when: "18m ago", tag: "Website" },
  { who: "WhatsApp", what: "broadcast delivered to 1,204 contacts", when: "1h ago", tag: "CRM" },
  { who: "Riya", what: "created event 'Tech Mixer — Aug 14'", when: "3h ago", tag: "Events" },
  { who: "System", what: "nightly backup completed", when: "6h ago", tag: "Ops" },
];

const pinnableModules = [
  { title: "Event Manager", slug: "events" },
  { title: "CRM", slug: "whatsapp" },
  { title: "Website Builder", slug: "website" },
  { title: "Utilities", slug: "utilities" },
  { title: "User Management", slug: "users" },
  { title: "Communication", slug: "communication" },
  { title: "Front Office", slug: "front-office" },
  { title: "Reports & Analytics", slug: "reports" },
  { title: "Settings", slug: "settings" },
];

export default function KnowvatoDashboard() {
  const { user } = useAuth();
  const { bookmarks, add, remove, has } = useBookmarks();

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Greeting + global search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back{user ? `, ${user.name}` : ""} 👋
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search modules, guests, messages…"
              className="pl-8 w-72"
            />
          </div>
          <Button variant="outline" size="icon" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
          <Button>
            <Sparkles className="h-4 w-4" />
            Ask AI
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {k.label}
              </CardTitle>
              <k.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{k.value}</div>
              <div
                className={`inline-flex items-center gap-1 text-xs mt-1 ${
                  k.up ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {k.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {k.delta} vs last month
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue & Bookings</CardTitle>
            <CardDescription>Last 6 months performance</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="revenue">
              <TabsList>
                <TabsTrigger value="revenue">Revenue</TabsTrigger>
                <TabsTrigger value="traffic">Web Traffic</TabsTrigger>
              </TabsList>
              <TabsContent value="revenue" className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="m" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      fill="url(#rev)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </TabsContent>
              <TabsContent value="traffic" className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trafficData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="d" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="visits" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Channel Mix</CardTitle>
            <CardDescription>Leads by source this month</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={channelData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {channelData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
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
              {channelData.map((c, i) => (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="ml-auto font-medium">{c.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((a) => {
              const url = a.slug === "whatsapp" ? "/crm" : a.slug === "events" ? "/modules/events" : a.slug === "utilities" ? "/modules/utilities/qr" : `/modules/${a.slug}`;
              return (
                <div
                  key={a.title}
                  className="rounded-lg border bg-card p-3 flex flex-col justify-between items-start gap-2 shadow-xs"
                >
                  <div className={`h-8 w-8 rounded-md flex items-center justify-center ${a.hue}`}>
                    <a.icon className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-medium text-foreground">{a.title}</div>
                  <Button asChild size="sm" variant="outline" className="w-full text-xs h-7 mt-1">
                    <Link to={url} className="text-decoration-none">
                      <Plus className="h-3 w-3 mr-1" /> Open
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Bookmarks + Activity */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" /> Recent Activity
              </CardTitle>
            </div>
            <Badge variant="secondary">Live</Badge>
          </CardHeader>
          <CardContent>
            <ul className="divide-y p-0 m-0">
              {activity.map((a, i) => (
                <li key={i} className="py-3 flex items-center gap-3 list-style-none">
                  <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-white">
                    {a.who.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className="font-medium">{a.who}</span>{" "}
                      <span className="text-muted-foreground">{a.what}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{a.when}</div>
                  </div>
                  <Badge variant="outline">{a.tag}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bookmark className="h-4 w-4" /> Bookmarks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pinnableModules.map((m) => {
              const url = m.slug === "whatsapp" ? "/crm" : m.slug === "events" ? "/modules/events" : `/modules/${m.slug}`;
              const pinned = has(url);
              return (
                <div
                  key={m.slug}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <Link
                    to={url}
                    className="text-sm hover:underline text-foreground text-decoration-none"
                  >
                    {m.title}
                  </Link>
                  <Button
                    size="sm"
                    variant={pinned ? "secondary" : "ghost"}
                    onClick={() => (pinned ? remove(url) : add({ title: m.title, url }))}
                    aria-label={pinned ? "Remove bookmark" : "Add bookmark"}
                  >
                    {pinned ? (
                      <>
                        <BookmarkCheck className="h-4 w-4 mr-1" /> Pinned
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-4 w-4 mr-1" /> Pin
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
            {bookmarks.length > 0 && (
              <p className="text-xs text-muted-foreground pt-2 m-0">
                {bookmarks.length} bookmarked — also shown in the sidebar.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
