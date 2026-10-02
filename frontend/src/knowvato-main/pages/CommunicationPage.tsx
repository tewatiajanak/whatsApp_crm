import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Megaphone,
  MessageSquare,
  Mail,
  Smartphone,
  Plus,
  Search,
  Send,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Copy,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBookmarks } from "@/lib/bookmarks";
import { toast } from "sonner";

interface BroadcastItem {
  id: string;
  title: string;
  channel: "WhatsApp" | "Email" | "SMS";
  audience: string;
  recipients: number;
  delivered: string;
  status: "Delivered" | "Scheduled" | "Processing";
  scheduledAt: string;
}

const INITIAL_BROADCASTS: BroadcastItem[] = [
  {
    id: "b-1",
    title: "Summer Gala Event Announcement",
    channel: "WhatsApp",
    audience: "All Admissions Leads",
    recipients: 1204,
    delivered: "99.2%",
    status: "Delivered",
    scheduledAt: "2026-07-24 10:00",
  },
  {
    id: "b-2",
    title: "Monthly Newsletter - July Edition",
    channel: "Email",
    audience: "Enrolled Students & Parents",
    recipients: 3450,
    delivered: "98.7%",
    status: "Delivered",
    scheduledAt: "2026-07-20 09:30",
  },
  {
    id: "b-3",
    title: "Fee Deposit Reminder Alert",
    channel: "SMS",
    audience: "Pending Fees Segment",
    recipients: 420,
    delivered: "96.4%",
    status: "Delivered",
    scheduledAt: "2026-07-18 16:00",
  },
  {
    id: "b-4",
    title: "Orientation Session Broadcast",
    channel: "WhatsApp",
    audience: "Confirmed Batch 2026",
    recipients: 550,
    delivered: "0%",
    status: "Scheduled",
    scheduledAt: "2026-07-28 11:00",
  },
];

export default function CommunicationPage() {
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>(INITIAL_BROADCASTS);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const [composerForm, setComposerForm] = useState({
    title: "",
    channel: "WhatsApp" as BroadcastItem["channel"],
    audience: "All Admissions Leads",
    content: "Dear {{name}}, we invite you to Greenwood International's Open Day on {{date}}!",
  });

  const url = "/modules/communication";
  const { add, remove, has } = useBookmarks();
  const pinned = has(url);

  const filteredBroadcasts = broadcasts.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.audience.toLowerCase().includes(search.toLowerCase());
    const matchesChannel = channelFilter === "all" || b.channel === channelFilter;
    return matchesSearch && matchesChannel;
  });

  const handleDeleteBroadcast = (id: string) => {
    setBroadcasts((prev) => prev.filter((b) => b.id !== id));
    toast.success("Broadcast removed.");
  };

  const handleCreateBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerForm.title || !composerForm.content) {
      toast.error("Please enter a broadcast title and message body.");
      return;
    }

    const newBroadcast: BroadcastItem = {
      id: `b-${Date.now()}`,
      title: composerForm.title,
      channel: composerForm.channel,
      audience: composerForm.audience,
      recipients: 850,
      delivered: "100.0%",
      status: "Delivered",
      scheduledAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    };

    setBroadcasts((prev) => [newBroadcast, ...prev]);
    toast.success(`${composerForm.channel} Broadcast launched successfully!`);
    setIsComposerOpen(false);
    setComposerForm({
      title: "",
      channel: "WhatsApp",
      audience: "All Admissions Leads",
      content: "Dear {{name}}, we invite you to Greenwood International's Open Day on {{date}}!",
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            to="/"
            className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1 text-decoration-none mb-1"
          >
            <ArrowLeft className="h-3 w-3" /> Back to dashboard
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Communication & Announcements</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={pinned ? "secondary" : "outline"}
            onClick={() => (pinned ? remove(url) : add({ title: "Communication", url }))}
          >
            {pinned ? <BookmarkCheck className="h-4 w-4 mr-1" /> : <Bookmark className="h-4 w-4 mr-1" />}
            {pinned ? "Bookmarked" : "Bookmark"}
          </Button>
          <Button onClick={() => setIsComposerOpen(true)} className="bg-primary text-primary-foreground">
            <Send className="h-4 w-4" /> Launch Broadcast
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Broadcasts Sent (MTD)</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{broadcasts.length}</div>
            <p className="text-xs text-emerald-600 mt-1">✓ Across WhatsApp, Email & SMS</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Recipients Reached</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {broadcasts.reduce((acc, b) => acc + b.recipients, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">High engagement rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Delivery Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-600">98.5%</div>
            <p className="text-xs text-emerald-600 mt-1">Verified carrier delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Scheduled Campaigns</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {broadcasts.filter((b) => b.status === "Scheduled").length}
            </div>
            <p className="text-xs text-amber-600 mt-1">Upcoming automated dispatches</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search announcements..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <Button
              variant={channelFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setChannelFilter("all")}
            >
              All Channels
            </Button>
            <Button
              variant={channelFilter === "WhatsApp" ? "default" : "outline"}
              size="sm"
              onClick={() => setChannelFilter("WhatsApp")}
            >
              WhatsApp
            </Button>
            <Button
              variant={channelFilter === "Email" ? "default" : "outline"}
              size="sm"
              onClick={() => setChannelFilter("Email")}
            >
              Email
            </Button>
            <Button
              variant={channelFilter === "SMS" ? "default" : "outline"}
              size="sm"
              onClick={() => setChannelFilter("SMS")}
            >
              SMS
            </Button>
          </div>
        </div>
      </Card>

      {/* Broadcasts Table */}
      <Card>
        <CardHeader className="py-4 px-6 border-b">
          <CardTitle className="text-base font-semibold">Broadcast & Communication History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-medium border-b">
                <tr>
                  <th className="px-6 py-3">Announcement Title</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Target Audience</th>
                  <th className="px-4 py-3">Recipients</th>
                  <th className="px-4 py-3">Delivery Rate</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Dispatched / Scheduled</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredBroadcasts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground">
                      No communications found.
                    </td>
                  </tr>
                ) : (
                  filteredBroadcasts.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">{item.title}</td>
                      <td className="px-4 py-4">
                        <Badge variant="outline" className="font-normal">
                          {item.channel}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">{item.audience}</td>
                      <td className="px-4 py-4 font-semibold">{item.recipients.toLocaleString()}</td>
                      <td className="px-4 py-4 text-emerald-600 font-medium">{item.delivered}</td>
                      <td className="px-4 py-4">
                        <Badge variant={item.status === "Delivered" ? "default" : "secondary"}>
                          {item.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">{item.scheduledAt}</td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          title="Delete Broadcast Log"
                          onClick={() => handleDeleteBroadcast(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Composer Modal */}
      {isComposerOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-base">Launch Broadcast Announcement</h3>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsComposerOpen(false)}>
                ✕
              </Button>
            </div>

            <form onSubmit={handleCreateBroadcast} className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Campaign Title
                </label>
                <Input
                  placeholder="e.g. August Open Day Invitation"
                  value={composerForm.title}
                  onChange={(e) => setComposerForm({ ...composerForm, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                    Channel
                  </label>
                  <select
                    className="w-full h-9 border rounded-md px-3 text-sm bg-background border-input"
                    value={composerForm.channel}
                    onChange={(e) =>
                      setComposerForm({ ...composerForm, channel: e.target.value as BroadcastItem["channel"] })
                    }
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                    <option value="SMS">SMS</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                    Target Segment
                  </label>
                  <select
                    className="w-full h-9 border rounded-md px-3 text-sm bg-background border-input"
                    value={composerForm.audience}
                    onChange={(e) => setComposerForm({ ...composerForm, audience: e.target.value })}
                  >
                    <option value="All Admissions Leads">All Admissions Leads</option>
                    <option value="Qualified Leads Only">Qualified Leads Only</option>
                    <option value="Enrolled Students & Parents">Enrolled Students & Parents</option>
                    <option value="Event Registrants">Event Registrants</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Message Content (Supports Merge Tags: &#123;&#123;name&#125;&#125;, &#123;&#123;date&#125;&#125;)
                </label>
                <textarea
                  rows={4}
                  className="w-full border rounded-md p-3 text-sm bg-background border-input"
                  value={composerForm.content}
                  onChange={(e) => setComposerForm({ ...composerForm, content: e.target.value })}
                />
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsComposerOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary text-primary-foreground">
                  Dispatch Broadcast Now
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
