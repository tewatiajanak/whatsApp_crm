import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CreditCard, Plus, Pencil, Trash2, PlugZap, Copy, Check, Banknote, RefreshCw, Eye, EyeOff } from "lucide-react";
import { paymentsApi, runPaymentAction } from "../../api/payments";
import { useToast } from "../../context/ToastContext";
import { UIButton } from "../components/UIKit";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fmtDateTime } from "@/utils/date";

type FieldDef = { key: string; label: string; secret?: boolean; required?: boolean; help?: string };
type ProviderDef = {
  id: string;
  name: string;
  usesMode: boolean;
  fields: FieldDef[];
  setup: { webhook: string; returnUrl: string; domain: string; webhookEvents?: string };
};
type Gateway = {
  id: string;
  provider: string;
  providerName: string;
  label: string;
  mode: "test" | "live";
  isActive: boolean;
  credentials: Record<string, string>;
  lastTest: { ok: boolean; message: string; at: string } | null;
  webhookUrl: string;
  returnUrl: string;
};
type Txn = {
  id: string;
  txnId: string;
  providerName: string;
  mode: string;
  amount: number;
  currency: string;
  purpose: string;
  status: "created" | "pending" | "paid" | "failed";
  customer: { name: string; email: string; phone: string };
  message?: string;
  isTest: boolean;
  createdAt: string;
};

const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";
const TH = "px-4 py-3 text-left font-medium";

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  paid: { bg: "var(--success-bg)", fg: "var(--success)", label: "Paid" },
  failed: { bg: "var(--destructive-bg)", fg: "var(--destructive)", label: "Failed" },
  pending: { bg: "var(--warning-bg)", fg: "var(--warning)", label: "Pending" },
  created: { bg: "var(--muted-background)", fg: "var(--muted-foreground)", label: "Started" },
};

function Pill({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

function Toggle({ on, onChange, title }: { on: boolean; onChange: () => void; title?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onChange} title={title} className="inline-flex items-center gap-2">
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${on ? "" : "bg-muted"}`}
        style={on ? { background: "var(--primary)" } : undefined}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
      </span>
      <span className={`text-[11px] font-medium ${on ? "text-primary" : "text-muted-foreground"}`}>{on ? "Active" : "Inactive"}</span>
    </button>
  );
}

function CopyRow({ label, value, note }: { label: string; value: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the value is selectable */
    }
  };
  return (
    <div>
      <div className={LABEL}>{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate rounded-md border bg-muted px-2.5 py-2 text-[11.5px]" title={value}>
          {value}
        </code>
        <UIButton size="icon-sm" variant="outline" onClick={copy} title="Copy">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </UIButton>
      </div>
      {note && <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{note}</p>}
    </div>
  );
}

type FormState = { provider: string; label: string; mode: "test" | "live"; credentials: Record<string, string> };
const EMPTY: FormState = { provider: "", label: "", mode: "test", credentials: {} };

export default function PaymentGatewaysPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<"gateways" | "payments">("gateways");
  const [providers, setProviders] = useState<ProviderDef[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Gateway | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // secret fields whose typed value is currently shown
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [txns, setTxns] = useState<Txn[]>([]);
  const [txnTotal, setTxnTotal] = useState(0);
  const [txnPage, setTxnPage] = useState(1);
  const [txnLoading, setTxnLoading] = useState(false);
  const PER_PAGE = 25;

  const providerMap = useMemo(() => Object.fromEntries(providers.map((p) => [p.id, p])), [providers]);
  const currentProvider = providerMap[form.provider];
  const websiteOrigin = typeof window !== "undefined" ? window.location.origin : "";

  const load = async () => {
    setLoading(true);
    try {
      const [p, g]: any[] = await Promise.all([paymentsApi.providers(), paymentsApi.gateways()]);
      setProviders(p?.data ?? []);
      setGateways(g?.data ?? []);
    } catch (e: any) {
      toast(e?.message || "Failed to load payment gateways", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadTxns = async (page = txnPage) => {
    setTxnLoading(true);
    try {
      const res: any = await paymentsApi.list(page, PER_PAGE);
      setTxns(res?.data ?? []);
      setTxnTotal(res?.total ?? 0);
    } catch (e: any) {
      toast(e?.message || "Failed to load payments", "error");
    } finally {
      setTxnLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "payments") loadTxns(txnPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, txnPage]);

  // Back from a test payment: show the verified result, then clean the URL.
  useEffect(() => {
    const txn = searchParams.get("txn");
    if (!txn) return;
    (async () => {
      try {
        const res: any = await paymentsApi.get(txn);
        const t = res?.data;
        if (t?.status === "paid") toast(`Test payment successful (${t.providerName}, ${t.txnId}).`);
        else if (t?.status === "pending") toast(`Test payment is still pending at ${t.providerName}.`, "error");
        else toast(`Test payment failed${t?.message ? `: ${t.message}` : "."}`, "error");
      } catch {
        toast("Could not read the test payment result.", "error");
      }
      setSearchParams({}, { replace: true });
      setTab("payments");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setRevealed({});
    setEditing(null);
    setForm({ ...EMPTY, provider: providers[0]?.id || "" });
    setDrawerOpen(true);
  };

  const openEdit = (g: Gateway) => {
    setRevealed({});
    setEditing(g);
    // Secrets are never sent back: start them blank, blank = keep what is saved.
    const provider = providerMap[g.provider];
    const credentials: Record<string, string> = {};
    provider?.fields.forEach((f) => {
      credentials[f.key] = f.secret ? "" : g.credentials[f.key] || "";
    });
    setForm({ provider: g.provider, label: g.label, mode: g.mode, credentials });
    setDrawerOpen(true);
  };

  const missingRequired =
    !currentProvider ||
    currentProvider.fields.some((f) => {
      if (!f.required) return false;
      const typed = (form.credentials[f.key] || "").trim();
      const alreadySaved = !!editing && f.secret && !!editing.credentials[f.key];
      return !typed && !alreadySaved;
    });

  const save = async () => {
    if (missingRequired) return;
    setSaving(true);
    try {
      const body = { provider: form.provider, label: form.label.trim(), mode: form.mode, credentials: form.credentials };
      const res: any = editing ? await paymentsApi.updateGateway(editing.id, body) : await paymentsApi.createGateway(body);
      toast(editing ? "Payment gateway updated" : "Payment gateway added");
      await load();
      // keep the drawer open on the saved gateway so the URLs to whitelist are visible
      const saved: Gateway | undefined = res?.data;
      if (saved && !editing) {
        setEditing(saved);
        const credentials: Record<string, string> = {};
        providerMap[saved.provider]?.fields.forEach((f) => {
          credentials[f.key] = f.secret ? "" : saved.credentials[f.key] || "";
        });
        setForm({ provider: saved.provider, label: saved.label, mode: saved.mode, credentials });
      } else {
        setDrawerOpen(false);
      }
    } catch (e: any) {
      toast(e?.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (g: Gateway) => {
    setBusyId(g.id);
    try {
      const res: any = await paymentsApi.setActive(g.id, !g.isActive);
      setGateways(res?.data ?? []);
      toast(g.isActive ? `${g.providerName} deactivated — no gateway is taking payments now` : `${g.providerName} is now the active payment gateway`);
    } catch (e: any) {
      toast(e?.message || "Update failed", "error");
    } finally {
      setBusyId(null);
    }
  };

  const testConnection = async (g: Gateway) => {
    setBusyId(g.id);
    try {
      const res: any = await paymentsApi.testGateway(g.id);
      const updated: Gateway = res?.data;
      setGateways((prev) => prev.map((x) => (x.id === g.id ? updated : x)));
      toast(updated.lastTest?.message || "Test finished", updated.lastTest?.ok ? "success" : "error");
    } catch (e: any) {
      toast(e?.message || "Test failed", "error");
    } finally {
      setBusyId(null);
    }
  };

  const testPayment = async (g: Gateway) => {
    if (!window.confirm(`Start a real ${g.mode === "live" ? "LIVE" : "test-mode"} payment of ₹1 through ${g.providerName}? You will be taken to the gateway's payment page.`)) return;
    setBusyId(g.id);
    try {
      const res: any = await paymentsApi.initiate({
        gatewayId: g.id,
        amount: 1,
        currency: "INR",
        purpose: "Gateway test payment",
        customer: { name: "Test Customer", email: "test@example.com", phone: "9999999999" },
        returnUrl: `${window.location.origin}${window.location.pathname}`,
        isTest: true,
      });
      await runPaymentAction(res?.data?.action);
    } catch (e: any) {
      toast(e?.message || "Could not start the test payment", "error");
    } finally {
      // a checkout popup can be closed without paying — don't leave the row locked
      setBusyId(null);
    }
  };

  const remove = async (g: Gateway) => {
    if (!window.confirm(`Delete the ${g.providerName} gateway${g.label ? ` "${g.label}"` : ""}? Its saved keys are removed.`)) return;
    try {
      await paymentsApi.removeGateway(g.id);
      toast("Payment gateway deleted");
      await load();
    } catch (e: any) {
      toast(e?.message || "Delete failed", "error");
    }
  };

  const active = gateways.find((g) => g.isActive);
  const pages = Math.max(1, Math.ceil(txnTotal / PER_PAGE));

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0"
            style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}
          >
            <CreditCard className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground leading-tight">Payment Gateway Integration</h2>
          </div>
        </div>
        <UIButton onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />} disabled={!providers.length}>
          Add gateway
        </UIButton>
      </div>

      {/* Active gateway summary */}
      <div
        className="mt-3 rounded-lg border px-3 py-2 text-xs"
        style={active ? { background: "var(--success-bg)", color: "var(--success)" } : { background: "var(--warning-bg)", color: "var(--warning)" }}
      >
        {active ? (
          <>
            Payments are going through <strong>{active.providerName}</strong>
            {active.label ? ` (${active.label})` : ""} in <strong>{active.mode === "live" ? "live" : "test"}</strong> mode.
          </>
        ) : (
          "No gateway is active — the app cannot take payments until you activate one."
        )}
      </div>

      {/* Tabs */}
      <div className="mt-3 inline-flex items-center gap-1 rounded-lg border bg-card p-1">
        {(["gateways", "payments"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="px-3 h-7 rounded-md text-xs font-medium transition-colors"
            style={tab === t ? { background: "var(--primary)", color: "var(--primary-foreground)" } : { color: "var(--muted-foreground)", background: "transparent" }}
          >
            {t === "gateways" ? "Gateways" : "Payments"}
          </button>
        ))}
      </div>

      {tab === "gateways" && (
        <div className="mt-3 rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                  <th className={TH} style={{ width: 64 }}>Sr No</th>
                  <th className={TH}>Gateway</th>
                  <th className={TH}>Mode</th>
                  <th className={TH}>Connection</th>
                  <th className={TH} style={{ width: 130 }}>Status</th>
                  <th className="px-4 py-3 font-medium" style={{ width: 170, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">Loading…</td>
                  </tr>
                )}
                {!loading && gateways.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No payment gateway added yet. Click “Add gateway” to enter your keys.
                    </td>
                  </tr>
                )}
                {!loading &&
                  gateways.map((g, i) => (
                    <tr key={g.id} className="border-t hover:bg-accent/30">
                      <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-foreground">{g.providerName}</div>
                        {g.label && <div className="text-xs text-muted-foreground">{g.label}</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        {g.mode === "live" ? (
                          <Pill bg="var(--success-bg)" fg="var(--success)">Live</Pill>
                        ) : (
                          <Pill bg="var(--info-bg)" fg="var(--info)">Test</Pill>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {g.lastTest ? (
                          <div title={g.lastTest.message}>
                            {g.lastTest.ok ? (
                              <Pill bg="var(--success-bg)" fg="var(--success)">Keys accepted</Pill>
                            ) : (
                              <Pill bg="var(--destructive-bg)" fg="var(--destructive)">Keys rejected</Pill>
                            )}
                            <div className="text-[11px] text-muted-foreground mt-0.5">{fmtDateTime(g.lastTest.at)}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not tested</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Toggle on={g.isActive} onChange={() => busyId !== g.id && toggleActive(g)} title={g.isActive ? "Click to deactivate" : "Click to make this the active gateway"} />
                      </td>
                      <td className="px-4 py-2.5" style={{ textAlign: "right" }}>
                        <div className="inline-flex items-center gap-1">
                          <UIButton size="icon-sm" variant="ghost" onClick={() => testConnection(g)} disabled={busyId === g.id} title="Test connection (checks the keys)">
                            <PlugZap className="h-3.5 w-3.5" />
                          </UIButton>
                          <UIButton size="icon-sm" variant="ghost" onClick={() => testPayment(g)} disabled={busyId === g.id} title="Make a ₹1 test payment">
                            <Banknote className="h-3.5 w-3.5" />
                          </UIButton>
                          <UIButton size="icon-sm" variant="ghost" onClick={() => openEdit(g)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </UIButton>
                          <UIButton size="icon-sm" variant="danger" onClick={() => remove(g)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </UIButton>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "payments" && (
        <>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">{txnLoading ? "Loading…" : `${txnTotal} payment${txnTotal === 1 ? "" : "s"}`}</div>
            <UIButton size="sm" variant="outline" onClick={() => loadTxns(txnPage)} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
              Refresh
            </UIButton>
          </div>
          <div className="mt-2 rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                    <th className={TH} style={{ width: 64 }}>Sr No</th>
                    <th className={TH}>Date</th>
                    <th className={TH}>Transaction ID</th>
                    <th className={TH}>For</th>
                    <th className={TH}>Customer</th>
                    <th className={TH}>Gateway</th>
                    <th className="px-4 py-3 font-medium" style={{ textAlign: "right" }}>Amount</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!txnLoading && txns.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">No payments yet.</td>
                    </tr>
                  )}
                  {txns.map((t, i) => {
                    const st = STATUS_STYLE[t.status] || STATUS_STYLE.created;
                    return (
                      <tr key={t.id} className="border-t hover:bg-accent/30">
                        <td className="px-4 py-2.5 text-muted-foreground">{(txnPage - 1) * PER_PAGE + i + 1}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{fmtDateTime(t.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          <code className="text-xs font-mono text-muted-foreground">{t.txnId}</code>
                        </td>
                        <td className="px-4 py-2.5">
                          {t.purpose}
                          {t.isTest && <span className="ml-1.5 text-[10px] text-muted-foreground">(test)</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <div>{t.customer?.name || "—"}</div>
                          {(t.customer?.phone || t.customer?.email) && (
                            <div className="text-xs text-muted-foreground">{t.customer.phone || t.customer.email}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {t.providerName}
                          <span className="ml-1.5 text-[10px] text-muted-foreground">{t.mode}</span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ textAlign: "right" }}>
                          {t.currency} {Number(t.amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5" title={t.message || ""}>
                          <Pill bg={st.bg} fg={st.fg}>{st.label}</Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {pages > 1 && (
            <div className="mt-2 flex items-center justify-end gap-2">
              <UIButton size="sm" variant="outline" disabled={txnPage <= 1} onClick={() => setTxnPage((p) => p - 1)}>
                Previous
              </UIButton>
              <span className="text-xs text-muted-foreground">Page {txnPage} of {pages}</span>
              <UIButton size="sm" variant="outline" disabled={txnPage >= pages} onClick={() => setTxnPage((p) => p + 1)}>
                Next
              </UIButton>
            </div>
          )}
        </>
      )}

      {/* Add / Edit drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="crm-theme w-full sm:max-w-xl flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10">
            <SheetTitle>{editing ? `Edit ${editing.providerName}` : "Add payment gateway"}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Gateway *</label>
                <select
                  className="ui-input w-full"
                  value={form.provider}
                  disabled={!!editing}
                  onChange={(e) => setForm({ ...EMPTY, label: form.label, provider: e.target.value })}
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Mode</label>
                {currentProvider?.usesMode ? (
                  <select className="ui-input w-full" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as "test" | "live" })}>
                    <option value="test">Test / Sandbox</option>
                    <option value="live">Live</option>
                  </select>
                ) : (
                  <select className="ui-input w-full" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as "test" | "live" })}>
                    <option value="test">Test keys</option>
                    <option value="live">Live keys</option>
                  </select>
                )}
              </div>
            </div>
            {currentProvider && !currentProvider.usesMode && (
              <p className="text-[11px] text-muted-foreground -mt-2">
                {currentProvider.name} decides test or live from the key itself — choose the mode that matches the keys you paste.
              </p>
            )}

            <div>
              <label className={LABEL}>Label</label>
              <input
                className="ui-input w-full"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Main account"
                maxLength={60}
              />
            </div>

            {currentProvider?.fields.map((f) => {
              const saved = !!editing && f.secret && !!editing.credentials[f.key];
              return (
                <div key={f.key}>
                  <label className={LABEL}>
                    {f.label} {f.required && "*"}
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      className="ui-input w-full"
                      type={f.secret && !revealed[f.key] ? "password" : "text"}
                      autoComplete="off"
                      style={f.secret ? { paddingRight: 36 } : undefined}
                      value={form.credentials[f.key] || ""}
                      onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, [f.key]: e.target.value } })}
                      placeholder={saved ? `${editing!.credentials[f.key]}  — leave blank to keep` : ""}
                    />
                    {f.secret && (
                      <button
                        type="button"
                        title={revealed[f.key] ? "Hide" : "Show"}
                        aria-label={revealed[f.key] ? "Hide" : "Show"}
                        onClick={() => setRevealed({ ...revealed, [f.key]: !revealed[f.key] })}
                        style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "transparent", border: 0, padding: 4, color: "var(--muted-foreground)", display: "inline-flex" }}
                      >
                        {revealed[f.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                  {f.help && <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{f.help}</p>}
                </div>
              );
            })}

            {/* Whitelisting */}
            {currentProvider && (
              <div className="rounded-xl border p-3 space-y-3" style={{ background: "var(--muted-background)" }}>
                <div className="text-sm font-semibold text-foreground">Set up on {currentProvider.name}</div>
                {editing ? (
                  <CopyRow
                    label="Webhook URL"
                    value={editing.webhookUrl}
                    note={`${currentProvider.setup.webhook}${currentProvider.setup.webhookEvents ? ` Events: ${currentProvider.setup.webhookEvents}.` : ""}`}
                  />
                ) : (
                  <div>
                    <div className={LABEL}>Webhook URL</div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Shown here after you save — each gateway gets its own URL. {currentProvider.setup.webhook}
                    </p>
                  </div>
                )}
                <CopyRow
                  label="Return / callback URL"
                  value={editing ? editing.returnUrl : "…/webhooks/payments/return/…"}
                  note={currentProvider.setup.returnUrl}
                />
                <CopyRow label="Website domain to whitelist" value={websiteOrigin} note={currentProvider.setup.domain} />
              </div>
            )}
          </div>

          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setDrawerOpen(false)} className="flex-1">
              Close
            </UIButton>
            <UIButton onClick={save} disabled={missingRequired} loading={saving} className="flex-1">
              {editing ? "Save changes" : "Save gateway"}
            </UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
