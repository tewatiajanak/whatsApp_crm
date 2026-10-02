import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Code,
  Key,
  Plus,
  Copy,
  Trash2,
  RefreshCw,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBookmarks } from "@/lib/bookmarks";
import { toast } from "sonner";

interface WebhookItem {
  id: string;
  url: string;
  event: string;
  status: "Active" | "Paused";
  lastFired: string;
}

const INITIAL_WEBHOOKS: WebhookItem[] = [
  {
    id: "wh-1",
    url: "https://erp.greenwood.edu/api/webhooks/lead-created",
    event: "lead.created",
    status: "Active",
    lastFired: "2m ago (200 OK)",
  },
  {
    id: "wh-2",
    url: "https://events.greenwood.edu/webhooks/guest-checkin",
    event: "event.checkin",
    status: "Active",
    lastFired: "18m ago (200 OK)",
  },
];

export default function OtherIntegrationPage() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>(INITIAL_WEBHOOKS);
  const [apiKey, setApiKey] = useState("kv_live_99810293810293810293");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvent, setNewEvent] = useState("lead.created");

  const url = "/modules/integrations-other";
  const { add, remove, has } = useBookmarks();
  const pinned = has(url);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    toast.success("API Key copied to clipboard!");
  };

  const handleRegenerateKey = () => {
    const freshKey = `kv_live_${Math.random().toString(36).substring(2, 18)}`;
    setApiKey(freshKey);
    toast.success("New API Key generated!");
  };

  const handleAddWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) {
      toast.error("Please enter a valid webhook URL.");
      return;
    }

    const item: WebhookItem = {
      id: `wh-${Date.now()}`,
      url: newUrl,
      event: newEvent,
      status: "Active",
      lastFired: "Never",
    };

    setWebhooks((prev) => [item, ...prev]);
    toast.success("Webhook endpoint registered!");
    setIsAddOpen(false);
    setNewUrl("");
  };

  const handleDeleteWebhook = (id: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
    toast.success("Webhook endpoint deleted.");
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
          <h1 className="text-2xl font-semibold tracking-tight">API Keys & Outbound Webhooks</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={pinned ? "secondary" : "outline"}
            onClick={() => (pinned ? remove(url) : add({ title: "API & Webhooks", url }))}
          >
            {pinned ? <BookmarkCheck className="h-4 w-4 mr-1" /> : <Bookmark className="h-4 w-4 mr-1" />}
            {pinned ? "Bookmarked" : "Bookmark"}
          </Button>
          <Button onClick={() => setIsAddOpen(true)} className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4" /> Add Webhook Endpoint
          </Button>
        </div>
      </div>

      {/* API Key Card */}
      <Card>
        <CardHeader className="py-4 px-6 border-b">
          <CardTitle className="text-base font-semibold">REST API Key Credentials</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted/30 border rounded-md px-3 py-2 text-xs font-mono text-foreground select-all">
              {apiKey}
            </div>
            <Button variant="outline" size="sm" onClick={handleCopyKey}>
              <Copy className="h-4 w-4 mr-1" /> Copy
            </Button>
            <Button variant="outline" size="sm" onClick={handleRegenerateKey}>
              <RefreshCw className="h-4 w-4 mr-1" /> Regenerate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Outbound Webhooks List */}
      <Card>
        <CardHeader className="py-4 px-6 border-b">
          <CardTitle className="text-base font-semibold">Subscribed Outbound Webhooks</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-medium border-b">
                <tr>
                  <th className="px-6 py-3">Webhook Endpoint URL</th>
                  <th className="px-4 py-3">Subscribed Event</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Fired</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {webhooks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      No webhooks registered.
                    </td>
                  </tr>
                ) : (
                  webhooks.map((w) => (
                    <tr key={w.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-foreground">{w.url}</td>
                      <td className="px-4 py-4">
                        <Badge variant="outline">{w.event}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="default" className="bg-emerald-600">
                          {w.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">{w.lastFired}</td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteWebhook(w.id)}
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

      {/* Add Webhook Modal */}
      <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10">
            <SheetTitle>Add Outbound Webhook</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleAddWebhook} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Webhook URL
                </label>
                <Input
                  placeholder="https://your-server.com/webhooks/crm"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Event Trigger
                </label>
                <select
                  className="w-full h-9 border rounded-md px-3 text-sm bg-background border-input"
                  value={newEvent}
                  onChange={(e) => setNewEvent(e.target.value)}
                >
                  <option value="lead.created">lead.created</option>
                  <option value="lead.updated">lead.updated</option>
                  <option value="event.checkin">event.checkin</option>
                  <option value="campaign.sent">campaign.sent</option>
                </select>
              </div>
            </div>
            <SheetFooter className="border-t p-4 flex-row justify-end gap-2 sm:space-x-0">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary text-primary-foreground">
                Save Webhook
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
