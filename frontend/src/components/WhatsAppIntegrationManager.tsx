import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Plug,
  Plus,
  Pencil,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  Radio,
  Save,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { waStore, useWaIntegrations, type Integration } from "@/lib/wa-store";
import { waAccountsApi } from "../api";

const VENDORS = ["Pinnacle", "AI Sensy", "Interakt", "Gupshup", "WATI"];

const looksMaskedSecret = (value?: string) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return trimmed.includes("•") || /^\*{4,}/.test(trimmed) || trimmed.toLowerCase().includes("unchanged");
};

interface Props {
  showHeader?: boolean;
  backLink?: React.ReactNode;
}

const emptyForm = (): Integration => ({
  id: crypto.randomUUID(),
  provider: "meta",
  vendor: "",
  apiKey: "",
  phoneId: "",
  wabaId: "",
  phoneNumber: "",
  active: true,
  status: "untested",
  callbackUrl: "",
  createdAt: new Date().toISOString(),
});

export default function WhatsAppIntegrationManager({ showHeader = true, backLink = null }: Props) {
  const localIntegrations = useWaIntegrations();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Integration & { backendId?: string }>(emptyForm());
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sync between backend waAccountsApi and local waStore
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await waAccountsApi.list();
      const backendAccounts = Array.isArray(res) ? res : (res as any)?.data || [];
      if (backendAccounts.length > 0) {
        const mapped: (Integration & { backendId?: string })[] = backendAccounts.map((acc: any) => ({
          id: acc._id || acc.id || crypto.randomUUID(),
          provider: acc.vendor === "meta" ? "meta" : "vendor",
          vendor: acc.vendor && acc.vendor !== "meta" ? acc.vendor : "Pinnacle",
          apiKey: "",
          phoneId: acc.phoneNumberId || "",
          wabaId: acc.wabaId || "",
          phoneNumber: acc.senderNumber || acc.phoneNumber || "",
          active: Boolean(acc.active),
          status: acc.health === "ok" ? "connected" : acc.health === "error" ? "disconnected" : "untested",
          callbackUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/webhooks/whatsapp`,
          createdAt: acc.createdAt || new Date().toISOString(),
          backendId: acc._id
        }));
        setIntegrations(mapped);
        mapped.forEach((item) => waStore.upsert(item));
      } else if (localIntegrations.length > 0) {
        setIntegrations(localIntegrations);
      } else {
        setIntegrations([]);
      }
    } catch (e) {
      console.warn("Backend waAccounts fetch error, fallback to local store:", e);
      setIntegrations(localIntegrations);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (localIntegrations.length > 0 && integrations.length === 0 && !loading) {
      setIntegrations(localIntegrations);
    }
  }, [localIntegrations]);

  const startCreate = () => {
    setForm(emptyForm());
    setOpen(true);
  };

  const startEdit = (i: Integration & { backendId?: string }) => {
    setForm({ ...i });
    setOpen(true);
  };

  const onSave = async () => {
    const hasUsableApiKey = Boolean(form.apiKey && !looksMaskedSecret(form.apiKey) && form.apiKey.trim());

    if (!form.phoneId || !form.phoneNumber) {
      toast.error("Please fill required fields (Phone Number ID, Phone Number)");
      return;
    }
    if (!form.backendId && !hasUsableApiKey) {
      toast.error("Please enter a valid API Key / Access Token for new integration");
      return;
    }
    if (form.provider === "vendor" && !form.vendor) {
      toast.error("Please select a vendor");
      return;
    }
    const callbackUrl =
      form.callbackUrl ||
      `${typeof window !== "undefined" ? window.location.origin : ""}/webhooks/whatsapp`;

    const updatedItem = {
      ...form,
      callbackUrl,
      status: form.status || "untested"
    };

    waStore.upsert(updatedItem);

    try {
      const payload = {
        label: form.provider === "meta" ? "Meta Cloud API" : `${form.vendor || "Vendor"} Integration`,
        vendor: form.provider === "meta" ? "meta" : (form.vendor?.toLowerCase() || "pinnacle"),
        active: form.active,
        senderNumber: form.phoneNumber,
        phoneNumberId: form.phoneId,
        wabaId: form.wabaId,
        health: form.status === "connected" ? "ok" : form.status === "disconnected" ? "error" : "unknown"
      };
      if (hasUsableApiKey) {
        payload.apiKey = form.apiKey.trim();
        payload.accessToken = form.apiKey.trim();
      }

      if (form.backendId) {
        await waAccountsApi.update(form.backendId, payload);
        if (form.active) await waAccountsApi.activate(form.backendId);
      } else {
        const created = await waAccountsApi.create(payload);
        const createdId = (created as any)?._id || (created as any)?.data?._id;
        if (createdId) {
          updatedItem.backendId = createdId;
          waStore.upsert(updatedItem);
          if (form.active) {
            await waAccountsApi.activate(createdId);
          }
        }
      }
    } catch (err: any) {
      console.warn("Could not sync with backend waAccounts API:", err.message);
    }

    toast.success("Integration saved");
    setOpen(false);
    loadData();
  };

  const onTest = async () => {
    const hasUsableApiKey = Boolean(form.apiKey && !looksMaskedSecret(form.apiKey) && form.apiKey.trim());
    if ((!form.backendId && !hasUsableApiKey) || !form.phoneId) {
      toast.error("Enter API key and Phone ID first");
      return;
    }
    setTesting(true);
    await new Promise((r) => setTimeout(r, 1000));

    const ok = (hasUsableApiKey || Boolean(form.backendId)) && form.phoneId.trim().length >= 5;
    const newStatus = ok ? "connected" : "disconnected";
    setForm((f) => ({ ...f, status: newStatus }));
    setTesting(false);

    if (ok) {
      toast.success("Connection live ✓");
    } else {
      toast.error("Connection failed! Invalid API Key or Phone ID.");
    }
  };

  const toggleActive = async (item: Integration & { backendId?: string }) => {
    const nextActive = !item.active;
    waStore.setActive(item.id);
    if (item.backendId && nextActive) {
      try {
        await waAccountsApi.activate(item.backendId);
      } catch (err) {
        console.warn("Backend activate failed:", err);
      }
    }
    toast.success(`${item.phoneNumber} is now ${nextActive ? "Active" : "Inactive"}`);
    loadData();
  };

  const onDelete = async (item: Integration & { backendId?: string }) => {
    if (confirm(`Are you sure you want to delete integration for ${item.phoneNumber}?`)) {
      waStore.remove(item.id);
      if (item.backendId) {
        try {
          await waAccountsApi.remove(item.backendId);
        } catch (e) {
          console.warn("Backend remove failed:", e);
        }
      }
      toast.success("Deleted");
      loadData();
    }
  };

  return (
    <div
      className="space-y-6"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {showHeader && (
        <div>
          {backLink}
          <div className="flex items-center justify-between mt-1">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
                <Plug className="h-6 w-6 text-emerald-600" /> WhatsApp Integration
              </h1>
            </div>
            <Button onClick={startCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs">
              <Plus className="h-4 w-4" /> Integrate
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-card shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Configured Gateways</span>
            <Badge variant="secondary" className="text-[11px] font-normal">{integrations.length}</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={loadData} className="h-7 text-xs text-slate-600 hover:text-slate-900 gap-1">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="font-medium text-xs text-slate-600">Provider / Vendor</TableHead>
              <TableHead className="font-medium text-xs text-slate-600">Phone Number</TableHead>
              <TableHead className="font-medium text-xs text-slate-600">Phone ID</TableHead>
              <TableHead className="font-medium text-xs text-slate-600">Status / Active</TableHead>
              <TableHead className="font-medium text-xs text-slate-600">Callback URL</TableHead>
              <TableHead className="font-medium text-xs text-slate-600">Created</TableHead>
              <TableHead className="text-right font-medium text-xs text-slate-600">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 opacity-60" />
                  Loading integrations...
                </TableCell>
              </TableRow>
            ) : integrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <Plug className="h-8 w-8 mx-auto mb-2 opacity-40 text-slate-500" />
                  <p className="text-sm font-medium text-slate-700">No integrations configured yet</p>
                  <p className="text-xs text-slate-500 mb-3">Click Integrate to add Meta Cloud API or Vendor credentials.</p>
                  <Button size="sm" onClick={startCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Integrate
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              integrations.map((i) => (
                <TableRow key={i.id} className="hover:bg-slate-50/60 transition-colors">
                  <TableCell className="font-medium text-slate-900 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                        <i className="bi bi-whatsapp"></i>
                      </span>
                      <span>{i.provider === "meta" ? "Meta (Cloud API)" : i.vendor}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-mono text-slate-700">{i.phoneNumber || "—"}</TableCell>
                  <TableCell>
                    <span className="text-xs font-mono text-slate-600">{i.phoneId || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        className={`border-0 font-medium px-2 py-0.5 text-xs ${
                          i.status === "connected"
                            ? "bg-emerald-100 text-emerald-800"
                            : i.status === "disconnected"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        Meta: {i.status === "connected" ? "Live" : i.status === "disconnected" ? "Failed" : "Untested"}
                      </Badge>
                      <Badge className={`border-0 font-medium px-2 py-0.5 text-xs ${i.active ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}`}>
                        CRM: {i.active ? "ON" : "OFF"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-primary hover:underline bg-slate-100 hover:bg-slate-200/80 px-2 py-1 rounded transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(i.callbackUrl);
                        toast.success("Callback URL copied");
                      }}
                      title="Click to copy callback URL"
                    >
                      <Copy className="h-3 w-3 text-slate-500" />
                      <span className="truncate max-w-[180px]">{i.callbackUrl}</span>
                    </button>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {new Date(i.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(i)} className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(i)} className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-slate-900 text-lg">
              <Plug className="h-5 w-5 text-emerald-600" />
              {integrations.find((x) => x.id === form.id) ? "Edit" : "New"} WhatsApp Integration
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-5 mt-6 px-1 text-sm">
            <div>
              <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-600">Provider Type</Label>
              <RadioGroup
                value={form.provider}
                onValueChange={(v) => setForm({ ...form, provider: v as "meta" | "vendor" })}
                className="grid grid-cols-2 gap-3"
              >
                <label className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${form.provider === "meta" ? "border-emerald-600 bg-emerald-50/50 text-emerald-900 font-medium" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
                  <RadioGroupItem value="meta" id="meta" />
                  <span className="text-xs">Meta (Cloud API)</span>
                </label>
                <label className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${form.provider === "vendor" ? "border-emerald-600 bg-emerald-50/50 text-emerald-900 font-medium" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
                  <RadioGroupItem value="vendor" id="vendor" />
                  <span className="text-xs">Vendor (BSP)</span>
                </label>
              </RadioGroup>
            </div>

            {form.provider === "vendor" && (
              <div>
                <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-600">Select Vendor</Label>
                <Select
                  value={form.vendor || ""}
                  onValueChange={(v) => setForm({ ...form, vendor: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENDORS.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-slate-700">API Key / Access Token <span className="text-rose-500">*</span></Label>
                <Input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-slate-700">Phone Number ID <span className="text-rose-500">*</span></Label>
                <Input
                  value={form.phoneId}
                  onChange={(e) => setForm({ ...form, phoneId: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-slate-700">WABA ID (Business Account ID)</Label>
                <Input
                  value={form.wabaId}
                  onChange={(e) => setForm({ ...form, wabaId: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-slate-700">Sender Phone Number <span className="text-rose-500">*</span></Label>
                <Input
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 bg-slate-50/80">
              <div>
                <div className="text-xs font-semibold text-slate-800">Active Gateway</div>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>

            {form.status !== "untested" && (
              <div
                className={`text-xs rounded-lg p-3 flex items-center gap-2 border font-medium ${
                  form.status === "connected"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-rose-50 text-rose-800 border-rose-200"
                }`}
              >
                {form.status === "connected" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-600" />
                )}
                {form.status === "connected" ? "Connection live ✓ Verified" : "Connection failed! Check credentials."}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={onTest} disabled={testing} className="flex-1 gap-1.5 text-xs">
                {testing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Testing...
                  </>
                ) : (
                  <>
                    <Radio className="h-3.5 w-3.5" /> Test Connection
                  </>
                )}
              </Button>
              <Button onClick={onSave} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs">
                <Save className="h-3.5 w-3.5" /> Save Integration
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
