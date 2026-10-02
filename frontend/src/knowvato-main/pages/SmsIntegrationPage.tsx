import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Smartphone,
  CheckCircle2,
  Key,
  Save,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  RefreshCw,
  MessageSquare,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBookmarks } from "@/lib/bookmarks";
import { toast } from "sonner";

export default function SmsIntegrationPage() {
  const [vendor, setVendor] = useState("msg91");
  const [smsConfig, setSmsConfig] = useState({
    authKey: "392817405912837401",
    senderId: "GWUEDU",
    entityId: "1701159820491029345",
    telemarketerId: "1702160000000000000",
    testPhone: "+91 98765 43210",
  });

  const [testing, setTesting] = useState(false);
  const url = "/modules/integrations-sms";
  const { add, remove, has } = useBookmarks();
  const pinned = has(url);

  const handleTestSms = () => {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      toast.success(`Test SMS dispatched to ${smsConfig.testPhone} via ${vendor.toUpperCase()}!`);
    }, 1200);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("SMS Gateway configuration saved successfully!");
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
          <h1 className="text-2xl font-semibold tracking-tight">SMS Gateway Integration</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={pinned ? "secondary" : "outline"}
            onClick={() => (pinned ? remove(url) : add({ title: "SMS Integration", url }))}
          >
            {pinned ? <BookmarkCheck className="h-4 w-4 mr-1" /> : <Bookmark className="h-4 w-4 mr-1" />}
            {pinned ? "Bookmarked" : "Bookmark"}
          </Button>
          <Button variant="outline" onClick={handleTestSms} disabled={testing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${testing ? "animate-spin" : ""}`} />
            {testing ? "Sending..." : "Send Test SMS"}
          </Button>
        </div>
      </div>

      {/* Gateway Options */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card
          className={`cursor-pointer transition-all ${
            vendor === "msg91" ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-muted/30"
          }`}
          onClick={() => setVendor("msg91")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>MSG91 Gateway</span>
              <Smartphone className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            vendor === "twilio" ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-muted/30"
          }`}
          onClick={() => setVendor("twilio")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Twilio SMS</span>
              <MessageSquare className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            vendor === "kaleyra" ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-muted/30"
          }`}
          onClick={() => setVendor("kaleyra")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Kaleyra / Textlocal</span>
              <ShieldAlert className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Settings Card */}
      <Card>
        <CardHeader className="py-4 px-6 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{vendor.toUpperCase()} Credentials & DLT Info</CardTitle>
          </div>
          <Badge variant="default" className="bg-emerald-600">
            Active ✓
          </Badge>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  API Key / Auth Token
                </label>
                <Input
                  type="password"
                  value={smsConfig.authKey}
                  onChange={(e) => setSmsConfig({ ...smsConfig, authKey: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Header / Sender ID (6 Characters)
                </label>
                <Input
                  maxLength={6}
                  value={smsConfig.senderId}
                  onChange={(e) => setSmsConfig({ ...smsConfig, senderId: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  DLT Entity Registration ID
                </label>
                <Input
                  value={smsConfig.entityId}
                  onChange={(e) => setSmsConfig({ ...smsConfig, entityId: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Telemarketer Registration ID
                </label>
                <Input
                  value={smsConfig.telemarketerId}
                  onChange={(e) => setSmsConfig({ ...smsConfig, telemarketerId: e.target.value })}
                />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2">
              <Button type="submit" className="bg-primary text-primary-foreground">
                <Save className="h-4 w-4" /> Save SMS Settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
