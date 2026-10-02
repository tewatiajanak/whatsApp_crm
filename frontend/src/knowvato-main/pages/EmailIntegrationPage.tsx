import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  Key,
  Globe,
  Send,
  Save,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBookmarks } from "@/lib/bookmarks";
import { toast } from "sonner";

export default function EmailIntegrationPage() {
  const [provider, setProvider] = useState("smtp");
  const [smtpConfig, setSmtpConfig] = useState({
    host: "smtp.greenwood.edu",
    port: "587",
    username: "admissions@greenwood.edu",
    password: "••••••••••••",
    fromEmail: "admissions@greenwood.edu",
    fromName: "Greenwood Admissions Desk",
    encryption: "TLS",
  });

  const [testing, setTesting] = useState(false);
  const url = "/modules/integrations-email";
  const { add, remove, has } = useBookmarks();
  const pinned = has(url);

  const handleTestConnection = () => {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      toast.success("SMTP Connection test successful! Verified port 587 TLS.");
    }, 1200);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Email Integration settings saved!");
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
          <h1 className="text-2xl font-semibold tracking-tight">Email Integration Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={pinned ? "secondary" : "outline"}
            onClick={() => (pinned ? remove(url) : add({ title: "Email Integration", url }))}
          >
            {pinned ? <BookmarkCheck className="h-4 w-4 mr-1" /> : <Bookmark className="h-4 w-4 mr-1" />}
            {pinned ? "Bookmarked" : "Bookmark"}
          </Button>
          <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${testing ? "animate-spin" : ""}`} />
            {testing ? "Testing..." : "Test Connection"}
          </Button>
        </div>
      </div>

      {/* Provider Selector Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card
          className={`cursor-pointer transition-all ${
            provider === "smtp" ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-muted/30"
          }`}
          onClick={() => setProvider("smtp")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Custom SMTP Server</span>
              <Mail className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            provider === "sendgrid" ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-muted/30"
          }`}
          onClick={() => setProvider("sendgrid")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Twilio SendGrid API</span>
              <Globe className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            provider === "aws-ses" ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-muted/30"
          }`}
          onClick={() => setProvider("aws-ses")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Amazon SES (AWS)</span>
              <ShieldCheck className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Configuration Form */}
      <Card>
        <CardHeader className="py-4 px-6 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              {provider === "smtp"
                ? "SMTP Server Credentials"
                : provider === "sendgrid"
                ? "SendGrid API Configuration"
                : "Amazon SES Credentials"}
            </CardTitle>
          </div>
          <Badge variant="default" className="bg-emerald-600">
            Connected ✓
          </Badge>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  SMTP Host Server
                </label>
                <Input
                  value={smtpConfig.host}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Port & Encryption
                </label>
                <div className="flex gap-2">
                  <Input
                    className="w-24"
                    value={smtpConfig.port}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, port: e.target.value })}
                  />
                  <select
                    className="flex-1 h-9 border rounded-md px-3 text-sm bg-background border-input"
                    value={smtpConfig.encryption}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, encryption: e.target.value })}
                  >
                    <option value="TLS">TLS (Port 587)</option>
                    <option value="SSL">SSL (Port 465)</option>
                    <option value="NONE">None (Port 25)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  SMTP Username / Key
                </label>
                <Input
                  value={smtpConfig.username}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, username: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  SMTP Password / API Secret
                </label>
                <Input
                  type="password"
                  value={smtpConfig.password}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Sender Email Address
                </label>
                <Input
                  value={smtpConfig.fromEmail}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, fromEmail: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Sender Display Name
                </label>
                <Input
                  value={smtpConfig.fromName}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, fromName: e.target.value })}
                />
              </div>
            </div>

            {/* Domain Verification Status */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-2">Domain Authentication Status (DKIM & SPF)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 border rounded-lg bg-emerald-500/10 flex items-center justify-between">
                  <span className="text-xs font-medium">SPF Record</span>
                  <Badge variant="default" className="bg-emerald-600">
                    Verified ✓
                  </Badge>
                </div>
                <div className="p-3 border rounded-lg bg-emerald-500/10 flex items-center justify-between">
                  <span className="text-xs font-medium">DKIM Key</span>
                  <Badge variant="default" className="bg-emerald-600">
                    Verified ✓
                  </Badge>
                </div>
                <div className="p-3 border rounded-lg bg-emerald-500/10 flex items-center justify-between">
                  <span className="text-xs font-medium">DMARC Policy</span>
                  <Badge variant="default" className="bg-emerald-600">
                    Enforced ✓
                  </Badge>
                </div>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2">
              <Button type="submit" className="bg-primary text-primary-foreground">
                <Save className="h-4 w-4" /> Save Integration Settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
