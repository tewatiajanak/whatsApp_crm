import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Share2,
  CheckCircle2,
  Globe,
  RefreshCw,
  Save,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBookmarks } from "@/lib/bookmarks";
import { toast } from "sonner";

export default function FacebookIntegrationPage() {
  const [connected, setConnected] = useState(true);
  const [pageId, setPageId] = useState("109823019283019");
  const [accessToken, setAccessToken] = useState("EAAG...meta-token-live");
  const [testing, setTesting] = useState(false);

  const url = "/modules/integrations-facebook";
  const { add, remove, has } = useBookmarks();
  const pinned = has(url);

  const handleTestToken = () => {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      toast.success("Facebook Lead Ads Webhook & Page Token verified!");
    }, 1000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Meta / Facebook Integration settings saved.");
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
          <h1 className="text-2xl font-semibold tracking-tight">Facebook & Meta Lead Ads Integration</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={pinned ? "secondary" : "outline"}
            onClick={() => (pinned ? remove(url) : add({ title: "Facebook Integration", url }))}
          >
            {pinned ? <BookmarkCheck className="h-4 w-4 mr-1" /> : <Bookmark className="h-4 w-4 mr-1" />}
            {pinned ? "Bookmarked" : "Bookmark"}
          </Button>
          <Button variant="outline" onClick={handleTestToken} disabled={testing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${testing ? "animate-spin" : ""}`} />
            {testing ? "Verifying..." : "Verify Webhook Token"}
          </Button>
        </div>
      </div>

      {/* Integration Card */}
      <Card>
        <CardHeader className="py-4 px-6 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Meta Page & App Settings</CardTitle>
          </div>
          <Badge variant={connected ? "default" : "secondary"} className={connected ? "bg-emerald-600" : ""}>
            {connected ? "Connected ✓" : "Disconnected"}
          </Badge>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Facebook Page ID
                </label>
                <Input value={pageId} onChange={(e) => setPageId(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Page Access Token
                </label>
                <Input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                />
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-muted/20 space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-600" /> Webhook Subscription Endpoint
              </h4>
              <p className="text-xs text-muted-foreground">
                Copy this URL into Meta Business Manager Lead Sync Setup:
              </p>
              <div className="bg-background border rounded px-3 py-2 text-xs font-mono text-foreground select-all">
                https://api.knowvato.com/webhooks/facebook
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2">
              <Button type="submit" className="bg-primary text-primary-foreground">
                <Save className="h-4 w-4" /> Save Meta Integration
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
