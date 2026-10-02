import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  RefreshCw,
  Save,
  ShieldCheck,
  ExternalLink,
  Cpu,
  Bot,
  Zap,
  HelpCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useBookmarks } from "@/lib/bookmarks";
import { aiApi } from "../../api";
import { toast } from "sonner";
import { appStore } from "../../api/appStore";

interface AIConfig {
  enabled: boolean;
  provider: "gemini" | "claude" | "openai";
  model: string;
  apiKeyMasked: string;
  hasApiKey: boolean;
  testStatus?: "connected" | "failed" | "untested";
  lastTestedAt?: string;
  systemInstruction?: string;
}

const PROVIDERS = [
  {
    id: "gemini",
    name: "Google Gemini",
    badge: "Recommended",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
    desc: "Ultra-fast multimodal LLM by Google DeepMind with generous free tier & high throughput.",
    icon: Sparkles,
    color: "#059669",
    models: [
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash (Fastest & Efficient)" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (Next-Gen)" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro (Deep Reasoning)" },
    ],
    getKeyUrl: "https://aistudio.google.com/app/apikey",
    getKeyLabel: "Google AI Studio",
    steps: [
      "Open Google AI Studio at aistudio.google.com/app/apikey",
      "Sign in with your Google account and click 'Create API key'",
      "Copy your generated key (starts with AIzaSy...)",
      "Paste the key below, select your model, and click 'Test Connection'",
    ],
  },
  {
    id: "claude",
    name: "Anthropic Claude",
    badge: "Advanced Reasoning",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
    desc: "State-of-the-art reasoning model by Anthropic tailored for complex logic & precise instructions.",
    icon: Cpu,
    color: "#7c3aed",
    models: [
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet (Most Intelligent)" },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku (Ultra Fast)" },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus (Complex Analysis)" },
    ],
    getKeyUrl: "https://console.anthropic.com/",
    getKeyLabel: "Anthropic Console",
    steps: [
      "Navigate to Anthropic Console at console.anthropic.com",
      "Sign up or log in and go to Settings ➔ API Keys",
      "Generate a new secret key (starts with sk-ant-...)",
      "Paste the key below and test connection",
    ],
  },
  {
    id: "openai",
    name: "OpenAI GPT",
    badge: "Standard",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
    desc: "Industry-standard LLMs with structured outputs and high performance.",
    icon: Zap,
    color: "#2563eb",
    models: [
      { id: "gpt-4o-mini", name: "GPT-4o Mini (Fast & Cheap)" },
      { id: "gpt-4o", name: "GPT-4o (Omni High Capability)" },
    ],
    getKeyUrl: "https://platform.openai.com/api-keys",
    getKeyLabel: "OpenAI Platform",
    steps: [
      "Open platform.openai.com/api-keys",
      "Create a new secret key (sk-...)",
      "Paste the key below and click Test Connection",
    ],
  },
];

export default function AIIntegrationPage() {
  const [config, setConfig] = useState<AIConfig>({
    enabled: false,
    provider: "gemini",
    model: "gemini-1.5-flash",
    apiKeyMasked: "",
    hasApiKey: false,
    testStatus: "untested",
  });

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const url = "/modules/integrations-ai";
  const { add, remove, has } = useBookmarks();
  const pinned = has(url);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await aiApi.getConfig();
        const data = res?.data || {};
        if (mounted) {
          setConfig({
            enabled: Boolean(data.enabled),
            provider: data.provider || "gemini",
            model: data.model || "gemini-1.5-flash",
            apiKeyMasked: data.apiKeyMasked || "",
            hasApiKey: Boolean(data.hasApiKey),
            testStatus: data.testStatus || "untested",
            lastTestedAt: data.lastTestedAt,
            systemInstruction: data.systemInstruction,
          });
        }
      } catch (err: any) {
        console.warn("Could not load AI config:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const currentProvider = PROVIDERS.find((p) => p.id === config.provider) || PROVIDERS[0];

  const handleProviderSelect = (pId: "gemini" | "claude" | "openai") => {
    const prov = PROVIDERS.find((p) => p.id === pId) || PROVIDERS[0];
    setConfig((prev) => ({
      ...prev,
      provider: pId,
      model: prov.models[0].id,
      testStatus: "untested",
    }));
  };

  const handleToggleEnabled = async (checked: boolean) => {
    setConfig((prev) => ({ ...prev, enabled: checked }));
    try {
      await aiApi.saveConfig({
        ...config,
        enabled: checked,
        apiKey: apiKeyInput.trim() || undefined,
      });
      // Trigger storage event so floating widget updates immediately
      appStore.setItem("knowvato_ai_enabled", checked ? "true" : "false");
      window.dispatchEvent(new Event("knowvato_ai_status_changed"));
      toast.success(checked ? "AI Copilot enabled! Floating assistant icon is now active." : "AI Copilot disabled.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update AI status");
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await aiApi.testConnection({
        provider: config.provider,
        model: config.model,
        apiKey: apiKeyInput.trim() || undefined,
      });
      setConfig((prev) => ({ ...prev, testStatus: "connected", hasApiKey: true }));
      toast.success(res?.data?.message || "Successfully verified connection to AI API!");
    } catch (err: any) {
      setConfig((prev) => ({ ...prev, testStatus: "failed" }));
      toast.error(err.message || "Connection test failed. Please verify API key.");
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        enabled: config.enabled,
        provider: config.provider,
        model: config.model,
      };
      if (apiKeyInput.trim()) {
        payload.apiKey = apiKeyInput.trim();
      }

      const res = await aiApi.saveConfig(payload);
      const data = res?.data || {};
      setConfig((prev) => ({
        ...prev,
        enabled: Boolean(data.enabled),
        provider: data.provider,
        model: data.model,
        apiKeyMasked: data.apiKeyMasked,
        hasApiKey: Boolean(data.hasApiKey),
      }));
      setApiKeyInput("");
      appStore.setItem("knowvato_ai_enabled", config.enabled ? "true" : "false");
      window.dispatchEvent(new Event("knowvato_ai_status_changed"));
      toast.success("AI Integration configuration saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save AI configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            to="/modules/configuration"
            className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1 text-decoration-none mb-1"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Configuration
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-200 inline-flex">
              <Sparkles className="h-5 w-5" />
            </span>
            AI Integration & Assistant Settings
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={pinned ? "secondary" : "outline"}
            onClick={() => (pinned ? remove(url) : add({ title: "AI Integration", url }))}
          >
            {pinned ? <BookmarkCheck className="h-4 w-4 mr-1" /> : <Bookmark className="h-4 w-4 mr-1" />}
            {pinned ? "Bookmarked" : "Bookmark"}
          </Button>
          <Button variant="outline" onClick={handleTestConnection} disabled={testing || (!config.hasApiKey && !apiKeyInput.trim())}>
            <RefreshCw className={`h-4 w-4 mr-1 ${testing ? "animate-spin" : ""}`} />
            {testing ? "Testing..." : "Test Connection"}
          </Button>
          <Button onClick={handleSaveConfig} disabled={saving} className="bg-primary text-white">
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {/* Main Activation Status Toggle Card */}
      <Card className={`border-2 transition-all ${config.enabled ? "border-emerald-500/50 bg-emerald-500/[0.03]" : "border-slate-200 bg-card"}`}>
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl border ${config.enabled ? "bg-emerald-500 text-white border-emerald-600 shadow-xs" : "bg-muted text-muted-foreground border-border"}`}>
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-foreground">AI Copilot Status</span>
                <Badge variant={config.enabled ? "default" : "secondary"} className={config.enabled ? "bg-emerald-600 text-white" : ""}>
                  {config.enabled ? "🟢 Active & Enabled" : "⚪ Inactive"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                {config.enabled
                  ? "When enabled, the floating AI Copilot button reflects at the bottom-right corner of your workspace to execute operational tasks and database queries."
                  : "Turn ON this toggle to activate the AI assistant icon at the bottom-right of your screen."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-center">
            <Label htmlFor="ai-active-toggle" className="text-sm font-semibold cursor-pointer">
              {config.enabled ? "Enabled" : "Disabled"}
            </Label>
            <Switch
              id="ai-active-toggle"
              checked={config.enabled}
              onCheckedChange={handleToggleEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Provider Selector Grid */}
      <div>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
          1. Select AI Provider
        </h3>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          {PROVIDERS.map((p) => {
            const isSelected = config.provider === p.id;
            const Icon = p.icon;
            return (
              <Card
                key={p.id}
                className={`cursor-pointer transition-all border-2 relative overflow-hidden ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/20 bg-primary/[0.02] shadow-sm"
                    : "hover:border-slate-300 hover:bg-muted/20"
                }`}
                onClick={() => handleProviderSelect(p.id as any)}
              >
                <CardHeader className="p-4 pb-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="p-2 rounded-lg border bg-white shadow-2xs" style={{ color: p.color }}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className={`text-[10.5px] font-semibold ${p.badgeColor}`}>
                      {p.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-semibold">{p.name}</CardTitle>
                </CardHeader>
                <div className="px-4 pb-3 pt-1 border-t flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{p.models.length} model choices</span>
                  <span className={`font-semibold ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                    {isSelected ? "Selected ✓" : "Select"}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2-cols: Configuration Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                2. API Credentials & Model Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSaveConfig} className="space-y-4">
                {/* Model Selection */}
                <div>
                  <Label className="text-xs font-semibold">Selected Model</Label>
                  <select
                    className="form-select mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
                    value={config.model}
                    onChange={(e) => setConfig((prev) => ({ ...prev, model: e.target.value }))}
                  >
                    {currentProvider.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* API Key Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-semibold">API Key ({currentProvider.name})</Label>
                    {config.hasApiKey && (
                      <span className="text-[11px] text-emerald-600 font-medium inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Key Configured ({config.apiKeyMasked})
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type={showKey ? "text" : "password"}
                      placeholder={config.hasApiKey ? "Enter new key to update, or leave blank to keep current" : "Paste your API key here..."}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Connection Status & Buttons */}
                <div className="p-3.5 rounded-lg bg-slate-50 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold text-muted-foreground">Status:</div>
                    {config.testStatus === "connected" ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                        <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" /> Connected
                      </Badge>
                    ) : config.testStatus === "failed" ? (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" /> Connection Failed
                      </Badge>
                    ) : (
                      <Badge variant="outline">Untested</Badge>
                    )}
                    {config.lastTestedAt && (
                      <span className="text-[11px] text-muted-foreground">
                        (Last tested: {new Date(config.lastTestedAt).toLocaleTimeString()})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleTestConnection}
                      disabled={testing || (!config.hasApiKey && !apiKeyInput.trim())}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1 ${testing ? "animate-spin" : ""}`} />
                      {testing ? "Testing..." : "Test Connection"}
                    </Button>
                    <Button type="submit" size="sm" disabled={saving}>
                      <Save className="h-3.5 w-3.5 mr-1" />
                      {saving ? "Saving..." : "Save Settings"}
                    </Button>
                  </div>
                </div>
              </form>

              {/* Strict Security Guardrail Notice */}
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 flex items-start gap-2.5 text-xs text-amber-900">
                <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Strict Functional Boundary Guardrail:</span> The AI Copilot is strictly isolated to operational database actions (such as creating visual bot flows, generating event passes, and launching WhatsApp campaigns). It does NOT alter application code or architecture.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 1-col: Step-by-Step Integration Guide */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Integration Method & Setup</span>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {currentProvider.steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs">
                    <div className="h-5 w-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 mt-0.5 text-[11px]">
                      {idx + 1}
                    </div>
                    <span className="text-muted-foreground leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t">
                <a
                  href={currentProvider.getKeyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline-primary btn-sm w-full rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1 text-decoration-none py-2"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Get API Key from {currentProvider.getKeyLabel}
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Operational Examples Card */}
          <Card className="bg-slate-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Supported Operational Commands
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="p-2 rounded bg-white border">
                <span className="font-semibold text-foreground">🤖 Create Chatbot:</span>
                <p className="text-muted-foreground mt-0.5 m-0">"Create chatbot with keyword 'Learn' that collects student course details"</p>
              </div>
              <div className="p-2 rounded bg-white border">
                <span className="font-semibold text-foreground">📅 Event & Passes:</span>
                <p className="text-muted-foreground mt-0.5 m-0">"Create Event 'Tech Summit' and generate passes but dont shoot email"</p>
              </div>
              <div className="p-2 rounded bg-white border">
                <span className="font-semibold text-foreground">📢 WhatsApp Campaign:</span>
                <p className="text-muted-foreground mt-0.5 m-0">"Run WhatsApp campaign on attached list"</p>
              </div>
              <div className="p-2 rounded bg-white border">
                <span className="font-semibold text-foreground">📊 CRM Queries:</span>
                <p className="text-muted-foreground mt-0.5 m-0">"Show total leads overview and conversion stats"</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
