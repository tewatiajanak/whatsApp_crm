import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { formsApi, leadsApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PageHeader, Spinner, ErrorBox, EmptyState, Chip, Modal, Confirm, Tabs, StatCard, Panel, SearchBox, FilterSummary } from "../components/ui";
import { formatDateTime } from "../utils/dateFormat";
import { labelCls, timeAgo } from "../components/lead/leadUtils";
import FormBuilder from "../components/forms/FormBuilder";
import FormRenderer from "../components/forms/FormRenderer";
import { Submissions, Analytics } from "../components/forms/FormSubmissions";
import { FORM_KINDS, FORM_STATUS, CHOICE_TYPES } from "../components/forms/fieldTypes";

const num = new Intl.NumberFormat("en-IN");
const kindOf = (k) => FORM_KINDS.find((x) => x.value === k) || FORM_KINDS[0];
const linkOf = (base, slug) => `${base || window.location.origin}/f/${slug}`;

/* ───────────── new form ───────────── */
function NewForm({ onClose }) {
  const toast = useToast();
  const navigate = useNavigate();
  const t = useApi(() => formsApi.templates(), []);
  const [pick, setPick] = useState("enquiry");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    try { const r = await formsApi.create({ template: pick, name: name.trim() }); toast("Form created"); navigate(`/crm/forms/${r.data._id}`); }
    catch (e) { toast(e.message, "error"); setBusy(false); }
  }
  return (
    <Modal title="New form" onClose={onClose} footer={<><button type="button" className="ui-btn ui-btn-outline" onClick={onClose}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={create}>{busy ? "Creating…" : "Create"}</button></>}>
      <label className={labelCls}>Name</label>
      <input className="ui-input w-full mb-4" autoFocus title="Leave empty to use the template name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
      <label className={labelCls}>Start from</label>
      {t.loading ? <Spinner /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(t.data || []).map((x) => (
            <button key={x.key} type="button" onClick={() => setPick(x.key)} aria-pressed={pick === x.key}
              className="relative flex items-center gap-3 border bg-card p-3 text-left transition-colors hover:bg-accent/30"
              style={{ borderRadius: 10, borderColor: pick === x.key ? "var(--primary)" : "var(--border)", background: pick === x.key ? "color-mix(in srgb, var(--primary) 6%, var(--card))" : undefined }}>
              <span className="inline-flex h-9 w-9 items-center justify-center flex-shrink-0" style={{ borderRadius: 8, background: pick === x.key ? "var(--primary)" : "color-mix(in srgb, var(--primary) 12%, transparent)", color: pick === x.key ? "#fff" : "var(--primary)" }}><i className={`bi bi-${x.icon}`}></i></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground truncate">{x.name}</span>
                <span className="block text-[11px] text-muted-foreground">{kindOf(x.kind).label} · {x.fields} fields{x.pages > 1 ? ` · ${x.pages} steps` : ""}</span>
              </span>
              {pick === x.key && <i className="bi bi-check-circle-fill flex-shrink-0" style={{ color: "var(--primary)" }}></i>}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ───────────── all forms ───────────── */
export function FormsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [adding, setAdding] = useState(false);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = setTimeout(() => setTerm(q), 300); return () => clearTimeout(t); }, [q]);
  const list = useApi(() => formsApi.list({ status, kind, q: term }), [status, kind, term]);
  const meta = useApi(() => formsApi.meta().catch(() => ({ data: {} })), []);
  const base = meta.data?.base;
  const items = list.data?.items || [];
  const counts = list.data?.counts || {};
  const totalSubs = items.reduce((a, f) => a + f.submissions, 0);
  const today = items.reduce((a, f) => a + f.today, 0);
  const unread = items.reduce((a, f) => a + f.unread, 0);

  async function duplicate(f) {
    try { const r = await formsApi.duplicate(f._id); toast("Copy made"); navigate(`/crm/forms/${r.data._id}`); } catch (e) { toast(e.message, "error"); }
  }
  async function remove() {
    setBusy(true);
    try { await formsApi.remove(del._id); toast("Form deleted"); setDel(null); list.reload(); } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  }
  const copy = (f) => navigator.clipboard?.writeText(linkOf(base, f.slug)).then(() => toast("Link copied"));

  return (
    <div>
      <PageHeader title="Forms" actions={can("setup", "create") && <button type="button" className="ui-btn ui-btn-primary" onClick={() => setAdding(true)}><i className="bi bi-plus-lg"></i>New form</button>} />
      <Tabs value={status} onChange={setStatus} tabs={[
        { value: "", label: "All", count: Object.values(counts).reduce((a, n) => a + n, 0) },
        ...Object.entries(FORM_STATUS).map(([k, v]) => ({ value: k, label: v.label, count: counts[k] || 0 })),
      ]} />
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <SearchBox value={q} onChange={setQ} />
        <select className="ui-input min-w-[150px]" style={{ width: "auto" }} aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">All types</option>{FORM_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
        <FilterSummary onClear={q || kind ? () => { setQ(""); setKind(""); } : undefined} text={list.loading ? "Loading…" : `${items.length} form${items.length === 1 ? "" : "s"} · ${num.format(totalSubs)} submissions${today ? ` · ${today} today` : ""}${unread ? ` · ${unread} new` : ""}`} />
      </div>
      <ErrorBox error={list.error} />
      {list.loading && !list.data ? <Spinner /> : !items.length ? (
        <div className="rounded-xl border bg-card"><EmptyState icon="ui-checks" text="No forms" />{can("setup", "create") && <div className="text-center pb-8 -mt-10"><button type="button" className="ui-btn ui-btn-primary" onClick={() => setAdding(true)}><i className="bi bi-plus-lg"></i>New form</button></div>}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((f) => (
            <div key={f._id} className="rounded-xl border bg-card p-3 flex flex-col cursor-pointer hover:shadow-sm" onClick={() => navigate(`/crm/forms/${f._id}`)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{f.name}</div>
                  <div className="flex flex-wrap items-center gap-1 mt-1"><Chip color={FORM_STATUS[f.status].color} icon={f.status === "live" ? "broadcast" : undefined}>{FORM_STATUS[f.status].label}</Chip><Chip color={kindOf(f.kind).color}>{kindOf(f.kind).label}</Chip>{f.settings?.fee?.enabled && <Chip icon="currency-rupee">Fee</Chip>}</div>
                </div>
                {f.unread > 0 && <span className="inline-flex items-center justify-center rounded-full text-[11px] font-semibold px-2 h-5" style={{ background: "var(--primary)", color: "#fff" }}>{f.unread}</span>}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div><div className="text-base font-semibold text-foreground">{num.format(f.stats?.views || 0)}</div><div className="text-[11px] text-muted-foreground">Views</div></div>
                <div><div className="text-base font-semibold text-foreground">{num.format(f.submissions)}</div><div className="text-[11px] text-muted-foreground">Submitted</div></div>
                <div><div className="text-base font-semibold text-foreground">{f.conversion}%</div><div className="text-[11px] text-muted-foreground">Conversion</div></div>
              </div>
              <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t">
                <span className="text-[11px] text-muted-foreground truncate">{f.lastAt ? `Last ${timeAgo(f.lastAt)}` : `Edited ${timeAgo(f.updatedAt)}`}</span>
                <span className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Submissions" onClick={() => navigate(`/crm/forms/${f._id}?tab=submissions`)}><i className="bi bi-inbox"></i></button>
                  {f.status === "live" && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Copy link" onClick={() => copy(f)}><i className="bi bi-link-45deg"></i></button>}
                  {f.status === "live" && <a className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Open" href={linkOf(base, f.slug)} target="_blank" rel="noreferrer"><i className="bi bi-box-arrow-up-right"></i></a>}
                  {can("setup", "create") && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Duplicate" onClick={() => duplicate(f)}><i className="bi bi-copy"></i></button>}
                  {can("setup", "del") && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Delete" onClick={() => setDel(f)}><i className="bi bi-trash"></i></button>}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      {adding && <NewForm onClose={() => setAdding(false)} />}
      {del && <Confirm title={`Delete ${del.name}?`} text={del.submissions ? `Its ${del.submissions} submission${del.submissions === 1 ? "" : "s"} go too. Leads made from it stay.` : undefined} danger confirmLabel="Delete" busy={busy} onConfirm={remove} onCancel={() => setDel(null)} />}
    </div>
  );
}

/* ───────────── settings ───────────── */
const toLocal = (d) => { if (!d) return ""; const x = new Date(d); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
function Toggle({ on, set, children }) {
  return <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer py-1"><input type="checkbox" className="form-check-input m-0" checked={!!on} onChange={(e) => set(e.target.checked)} />{children}</label>;
}

function Settings({ draft, setDraft, meta, leadMeta }) {
  const s = draft.settings;
  const t = draft.theme;
  const setS = (k, v) => setDraft({ ...draft, settings: { ...s, [k]: v } });
  const setFee = (k, v) => setS("fee", { ...s.fee, [k]: v });
  const setT = (k, v) => setDraft({ ...draft, theme: { ...t, [k]: v } });
  const choiceFields = draft.pages.flatMap((p) => p.fields).filter((f) => CHOICE_TYPES.has(f.type) && f.type !== "checkbox");
  const amountField = choiceFields.find((f) => f.id === s.fee.amountFrom);
  const amountOptions = amountField ? (draft.resolved?.flatMap((p) => p.fields).find((f) => f.id === amountField.id)?.options || amountField.options) : [];
  const g = "grid grid-cols-1 sm:grid-cols-2 gap-3";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
      <Panel title="General">
        <div className={g}>
          <div><label className={labelCls}>Name *</label><input className="ui-input w-full" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
          <div><label className={labelCls}>Type</label><select className="ui-input w-full" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>{FORM_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></div>
          <div className="sm:col-span-2"><label className={labelCls}>Heading on the form</label><input className="ui-input w-full" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
          <div><label className={labelCls}>Button text</label><input className="ui-input w-full" value={s.submitLabel} onChange={(e) => setS("submitLabel", e.target.value)} /></div>
          <div><label className={labelCls}>Number prefix</label><input className="ui-input w-full font-mono" value={s.numberPrefix} onChange={(e) => setS("numberPrefix", e.target.value.toUpperCase())} title="Leave empty for ENQ-, APP-, REG- …" /></div>
        </div>
        <div className="mt-2">
          <Toggle on={s.showProgress} set={(v) => setS("showProgress", v)}>Show steps and progress bar</Toggle>
          <Toggle on={s.allowDraft} set={(v) => setS("allowDraft", v)}>Save and continue later</Toggle>
        </div>
      </Panel>

      <Panel title="After submit">
        <label className={labelCls}>Thank-you message</label>
        <textarea className="ui-input w-full" style={{ minHeight: 80, height: "auto", paddingTop: 6 }} value={s.successMessage} onChange={(e) => setS("successMessage", e.target.value)} />
        <div className="flex gap-1 mt-1">{["{name}", "{ref}"].map((k) => <button key={k} type="button" className="ui-btn ui-btn-ghost ui-btn-sm font-mono" onClick={() => setS("successMessage", `${s.successMessage || ""}${k}`)}>{k}</button>)}</div>
        <label className={labelCls + " mt-3"}>Then open link</label>
        <input className="ui-input w-full" type="url" value={s.redirectUrl} onChange={(e) => setS("redirectUrl", e.target.value)} />
      </Panel>

      <Panel title="Availability">
        <div className={g}>
          <div><label className={labelCls}>Opens</label><input type="datetime-local" className="ui-input w-full" value={toLocal(s.opensAt)} onChange={(e) => setS("opensAt", e.target.value ? new Date(e.target.value).toISOString() : null)} /></div>
          <div><label className={labelCls}>Closes</label><input type="datetime-local" className="ui-input w-full" value={toLocal(s.closesAt)} onChange={(e) => setS("closesAt", e.target.value ? new Date(e.target.value).toISOString() : null)} /></div>
          <div><label className={labelCls}>Most submissions</label><input type="number" min="0" className="ui-input w-full" value={s.maxSubmissions || ""} onChange={(e) => setS("maxSubmissions", Number(e.target.value) || 0)} /></div>
          <div><label className={labelCls}>Closed message</label><input className="ui-input w-full" value={s.closedMessage} onChange={(e) => setS("closedMessage", e.target.value)} /></div>
        </div>
        <div className="mt-2"><Toggle on={s.onePerPhone} set={(v) => setS("onePerPhone", v)}>One submission per phone number</Toggle></div>
      </Panel>

      <Panel title="Lead">
        <Toggle on={s.createLead} set={(v) => setS("createLead", v)}>Create or update a lead</Toggle>
        <Toggle on={s.createApplication} set={(v) => setS("createApplication", v)}>Add to Applications</Toggle>
        {(s.createLead || s.createApplication) && (
          <div className={g + " mt-2"}>
            <div><label className={labelCls}>Source</label><select className="ui-input w-full" value={s.leadSource} onChange={(e) => setS("leadSource", e.target.value)}><option value="">From link (utm_source) or Website</option>{(leadMeta?.sources || []).map((x) => <option key={x._id} value={x.name}>{x.name}</option>)}</select></div>
            <div><label className={labelCls}>Status</label><select className="ui-input w-full" value={s.leadStatus} onChange={(e) => setS("leadStatus", e.target.value)}><option value="">First status</option>{(meta?.statuses || []).map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</select></div>
            <div><label className={labelCls}>Owner</label><select className="ui-input w-full" value={s.owner} onChange={(e) => setS("owner", e.target.value)}><option value="">Auto assign</option>{(meta?.owners || []).map((o) => <option key={o}>{o}</option>)}</select></div>
            <div><label className={labelCls}>Course</label><input className="ui-input w-full" value={s.course} onChange={(e) => setS("course", e.target.value)} title="Used when the form has no course field" /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Tags</label><input className="ui-input w-full" value={(s.tags || []).join(", ")} onChange={(e) => setS("tags", e.target.value.split(",").map((x) => x.trimStart()))} /></div>
          </div>
        )}
      </Panel>

      <Panel title="Fee">
        <Toggle on={s.fee.enabled} set={(v) => setFee("enabled", v)}>Collect a fee</Toggle>
        {s.fee.enabled && (
          <div className="mt-2 space-y-3">
            <div className={g}>
              <div><label className={labelCls}>Title</label><input className="ui-input w-full" value={s.fee.title} onChange={(e) => setFee("title", e.target.value)} /></div>
              <div><label className={labelCls}>Amount (₹)</label><input type="number" min="0" className="ui-input w-full" value={s.fee.amount || ""} onChange={(e) => setFee("amount", Number(e.target.value) || 0)} /></div>
            </div>
            {choiceFields.length > 0 && (
              <div>
                <label className={labelCls}>Amount depends on</label>
                <select className="ui-input w-full" value={s.fee.amountFrom} onChange={(e) => setFee("amountFrom", e.target.value)}><option value="">Same for everyone</option>{choiceFields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
                {amountField && (
                  <div className="rounded-lg border mt-2 divide-y">
                    {amountOptions.map((o) => (
                      <div key={o} className="flex items-center gap-2 px-2.5 py-1.5">
                        <span className="text-sm text-foreground flex-1 truncate">{o}</span>
                        <input type="number" min="0" className="ui-input" style={{ width: 120 }} aria-label={`Amount for ${o}`} value={s.fee.amounts?.[o] ?? ""} onChange={(e) => setFee("amounts", { ...s.fee.amounts, [o]: e.target.value === "" ? undefined : Number(e.target.value) })} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Panel>

      <Panel title="Notifications">
        <Toggle on={s.notifyOwner} set={(v) => setS("notifyOwner", v)}>Tell the lead owner</Toggle>
        <label className={labelCls + " mt-2"}>Also email</label>
        <input className="ui-input w-full" value={Array.isArray(s.notifyEmails) ? s.notifyEmails.join(", ") : s.notifyEmails} onChange={(e) => setS("notifyEmails", e.target.value)} />
        <div className="border-t mt-3 pt-2">
          <Toggle on={s.replyEmail} set={(v) => setS("replyEmail", v)}>Email a copy to the person</Toggle>
          <Toggle on={s.replyWhatsApp} set={(v) => setS("replyWhatsApp", v)}>WhatsApp the person</Toggle>
          {(s.replyEmail || s.replyWhatsApp) && <><label className={labelCls + " mt-2"}>Reply text</label><textarea className="ui-input w-full" style={{ minHeight: 70, height: "auto", paddingTop: 6 }} value={s.replyText} onChange={(e) => setS("replyText", e.target.value)} /></>}
        </div>
      </Panel>

      <Panel title="Look">
        <div className={g}>
          <div><label className={labelCls}>Colour</label><div className="flex gap-2"><input type="color" className="ui-input p-1" style={{ width: 48 }} value={t.color || "#0f766e"} onChange={(e) => setT("color", e.target.value)} /><button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setT("color", "")}>Theme</button></div></div>
          <div><label className={labelCls}>Background</label><div className="flex gap-2"><input type="color" className="ui-input p-1" style={{ width: 48 }} value={t.background || "#f1f5f9"} onChange={(e) => setT("background", e.target.value)} /><button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setT("background", "")}>Theme</button></div></div>
          <div><label className={labelCls}>Logo link</label><input className="ui-input w-full" type="url" value={t.logo} onChange={(e) => setT("logo", e.target.value)} /></div>
          <div><label className={labelCls}>Cover image link</label><input className="ui-input w-full" type="url" value={t.cover} onChange={(e) => setT("cover", e.target.value)} /></div>
          <div><label className={labelCls}>Width</label><select className="ui-input w-full" value={t.width} onChange={(e) => setT("width", e.target.value)}><option value="narrow">Narrow</option><option value="wide">Wide</option></select></div>
        </div>
      </Panel>
    </div>
  );
}

/* ───────────── share ───────────── */
function Share({ form, base, onSlug }) {
  const toast = useToast();
  const [qr, setQr] = useState("");
  const [utm, setUtm] = useState({ source: "", medium: "", campaign: "" });
  const [slug, setSlug] = useState(form.slug);
  useEffect(() => setSlug(form.slug), [form.slug]);
  const link = linkOf(base, form.slug);
  const tracked = useMemo(() => { const p = new URLSearchParams(Object.entries(utm).filter(([, v]) => v.trim()).map(([k, v]) => [`utm_${k}`, v.trim()])).toString(); return p ? `${link}?${p}` : link; }, [utm, link]);
  useEffect(() => { import("qrcode").then((Q) => Q.toDataURL(tracked, { width: 480, margin: 1 })).then(setQr).catch(() => setQr("")); }, [tracked]);
  const embed = `<iframe src="${link}?embed=1" style="width:100%;border:0;min-height:600px" id="crm-form-${form.slug}"></iframe>\n<script>addEventListener("message",function(e){if(e.data&&e.data.type==="crm-form-height"){document.getElementById("crm-form-${form.slug}").style.height=e.data.height+"px"}})</script>`;
  const copy = (t, what) => navigator.clipboard?.writeText(t).then(() => toast(`${what} copied`));
  const params = form.pages.flatMap((p) => p.fields).filter((f) => f.param);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-3 items-start">
      <div className="space-y-3">
        {form.status !== "live" && <div className="alert alert-warning py-2 small mb-0"><i className="bi bi-exclamation-circle me-1"></i>{form.status === "draft" ? "Publish the form to take submissions." : "The form is closed."}</div>}
        <Panel title="Link">
          <div className="flex flex-wrap gap-2">
            <input readOnly className="ui-input flex-1 font-mono text-xs" style={{ minWidth: 220 }} value={tracked} onFocus={(e) => e.target.select()} />
            <button type="button" className="ui-btn ui-btn-primary" onClick={() => copy(tracked, "Link")}><i className="bi bi-copy"></i>Copy</button>
            <a className="ui-btn ui-btn-outline" href={tracked} target="_blank" rel="noreferrer"><i className="bi bi-box-arrow-up-right"></i>Open</a>
            <a className="ui-btn ui-btn-outline" href={`https://wa.me/?text=${encodeURIComponent(`${form.title || form.name}: ${tracked}`)}`} target="_blank" rel="noreferrer"><i className="bi bi-whatsapp"></i>WhatsApp</a>
          </div>
          <div className="flex flex-wrap items-end gap-2 mt-3">
            <div className="flex-1" style={{ minWidth: 200 }}><label className={labelCls}>Link name</label><div className="flex items-center gap-1"><span className="text-xs text-muted-foreground font-mono">/f/</span><input className="ui-input flex-1 font-mono text-xs" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, "-"))} /></div></div>
            <button type="button" className="ui-btn ui-btn-outline" disabled={slug === form.slug || slug.length < 3} onClick={() => onSlug(slug)}>Change</button>
          </div>
        </Panel>
        <Panel title="Campaign tracking">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {["source", "medium", "campaign"].map((k) => <div key={k}><label className={labelCls}>{k}</label><input className="ui-input w-full" value={utm[k]} onChange={(e) => setUtm({ ...utm, [k]: e.target.value })} list={`utm-${k}`} /></div>)}
          </div>
          <datalist id="utm-source">{["facebook", "instagram", "google", "whatsapp", "email", "sms", "website", "newspaper"].map((x) => <option key={x} value={x} />)}</datalist>
          <datalist id="utm-medium">{["cpc", "social", "organic", "referral", "qr", "print"].map((x) => <option key={x} value={x} />)}</datalist>
        </Panel>
        <Panel title="Embed on a website" actions={<button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => copy(embed, "Embed code")}><i className="bi bi-code-slash"></i>Copy</button>}>
          <pre className="text-[11px] font-mono rounded-lg border p-2 m-0 whitespace-pre-wrap break-all" style={{ background: "var(--muted-background)" }}>{embed}</pre>
        </Panel>
        {params.length > 0 && (
          <Panel title="Fill from the link">
            <div className="text-xs font-mono break-all text-foreground">{link}?{params.map((f) => `${f.param}=…`).join("&")}</div>
            <div className="flex flex-wrap gap-1 mt-2">{params.map((f) => <Chip key={f.id}>{f.param} → {f.label}</Chip>)}</div>
          </Panel>
        )}
      </div>
      <Panel title="QR code">
        {qr ? <img src={qr} alt="QR code" className="w-full rounded-lg border" /> : <Spinner />}
        {qr && <a className="ui-btn ui-btn-outline w-full mt-2" href={qr} download={`${form.slug}-qr.png`}><i className="bi bi-download"></i>Download</a>}
      </Panel>
    </div>
  );
}

/* ───────────── one form ───────────── */
const TABS = [{ value: "build", label: "Build" }, { value: "settings", label: "Settings" }, { value: "share", label: "Share" }, { value: "submissions", label: "Submissions" }, { value: "analytics", label: "Analytics" }];

export function FormWorkspace() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const { can } = useAuth();
  const canEdit = can("setup", "edit");
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") || (canEdit ? "build" : "submissions");
  const setTab = (t) => { sp.set("tab", t); sp.delete("s"); setSp(sp, { replace: true }); };
  const openSub = sp.get("s");
  const setOpenSub = (v) => { if (v) sp.set("s", v); else sp.delete("s"); setSp(sp, { replace: true }); };

  const form = useApi(() => formsApi.get(id), [id]);
  const meta = useApi(() => (canEdit ? formsApi.meta() : Promise.resolve({ data: {} })), [canEdit]);
  const leadMeta = useApi(() => leadsApi.meta().catch(() => ({ data: {} })), []);
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [device, setDevice] = useState("desktop");

  const fromServer = (d) => ({ name: d.name, title: d.title, kind: d.kind, pages: d.pages, settings: d.settings, theme: d.theme, resolved: d.resolvedPages });
  useEffect(() => { if (form.data) { const d = fromServer(form.data); setDraft(d); setSaved(JSON.stringify({ ...d, resolved: undefined })); } }, [form.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = draft && JSON.stringify({ ...draft, resolved: undefined }) !== saved;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save(extra = {}, msg = "Saved") {
    setBusy(true);
    try {
      const { resolved, ...body } = draft;
      const r = await formsApi.update(id, { ...body, ...extra });
      form.setData({ ...form.data, ...r.data });
      toast(msg);
      return true;
    } catch (e) { toast(e.message, "error"); return false; }
    finally { setBusy(false); }
  }
  useEffect(() => {
    const k = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); if (dirty && !busy) save(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (form.loading && !form.data) return <Spinner />;
  if (!form.data || !draft) return <ErrorBox error={form.error || "Form not found"} />;
  const f = form.data;
  const base = meta.data?.base;
  const st = FORM_STATUS[f.status];
  // the preview uses resolved master options where the builder has none of its own
  const previewPages = draft.pages.map((p) => ({ ...p, fields: p.fields.map((x) => { const r = (draft.resolved || []).flatMap((pp) => pp.fields).find((y) => y.id === x.id); return r && x.optionSource !== "custom" ? { ...x, options: r.options } : x; }) }));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 pb-2 mb-3 border-b">
        <Link to="/crm/forms" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="All forms"><i className="bi bi-arrow-left"></i></Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0"><h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight truncate m-0">{draft.name}</h1><Chip color={st.color} icon={f.status === "live" ? "broadcast" : undefined}>{st.label}</Chip>{dirty && <Chip color="var(--warning)">Unsaved</Chip>}</div>
          <div className="text-[11px] text-muted-foreground">{f.submissions} submission{f.submissions === 1 ? "" : "s"} · edited {formatDateTime(f.updatedAt)}{f.updatedBy ? ` by ${f.updatedBy}` : ""}</div>
        </div>
        <button type="button" className="ui-btn ui-btn-outline" onClick={() => setPreview(true)}><i className="bi bi-eye"></i><span className="hidden sm:inline">Preview</span></button>
        {canEdit && <>
          {f.status === "live"
            ? <button type="button" className="ui-btn ui-btn-outline" disabled={busy} onClick={() => save({ status: "closed" }, "Form closed")}><i className="bi bi-pause-circle"></i><span className="hidden sm:inline">Close</span></button>
            : <button type="button" className="ui-btn ui-btn-outline" disabled={busy} onClick={() => save({ status: "live" }, "Form is live")}><i className="bi bi-broadcast"></i><span className="hidden sm:inline">Publish</span></button>}
          <button type="button" className="ui-btn ui-btn-primary" disabled={busy || !dirty} onClick={() => save()}><i className="bi bi-check-lg"></i>{busy ? "Saving…" : "Save"}</button>
        </>}
      </div>

      {canEdit && f.problems?.length > 0 && f.status !== "live" && (
        <div className="flex flex-wrap gap-1.5 mb-3">{f.problems.map((p) => <Chip key={p} color="var(--warning)" icon="exclamation-triangle">{p}</Chip>)}</div>
      )}

      <Tabs value={tab} onChange={setTab} tabs={TABS.filter((t) => canEdit || !["build", "settings"].includes(t.value)).map((t) => (t.value === "submissions" ? { ...t, label: `Submissions ${f.submissions ? `(${f.submissions})` : ""}` } : t))} />

      {tab === "build" && canEdit && <FormBuilder pages={draft.pages} setPages={(pages) => setDraft({ ...draft, pages })} title={draft.title} theme={draft.theme} settings={draft.settings} onTitle={(title) => setDraft((d) => ({ ...d, title }))} onSettings={(patch) => setDraft((d) => ({ ...d, settings: { ...d.settings, ...patch } }))} onTheme={(patch) => setDraft((d) => ({ ...d, theme: { ...d.theme, ...patch } }))} resolved={draft.resolved} />}
      {tab === "settings" && canEdit && <Settings draft={draft} setDraft={setDraft} meta={meta.data} leadMeta={leadMeta.data} />}
      {tab === "share" && <Share form={f} base={base} onSlug={(slug) => save({ slug }, "Link changed")} />}
      {tab === "submissions" && <Submissions form={f} openId={openSub} onOpen={setOpenSub} />}
      {tab === "analytics" && <Analytics form={f} />}

      {preview && (
        <Modal size="wide" title={<span className="flex items-center gap-2">Preview<span className="inline-flex rounded-lg border p-0.5">{[["desktop", "display"], ["phone", "phone"]].map(([k, ic]) => <button key={k} type="button" title={k} className={"ui-btn ui-btn-sm ui-btn-icon " + (device === k ? "ui-btn-primary" : "ui-btn-ghost")} onClick={() => setDevice(k)}><i className={`bi bi-${ic}`}></i></button>)}</span></span>} onClose={() => setPreview(false)} bodyStyle={{ background: draft.theme.background || "var(--page-bg)" }}>
          <div className="mx-auto" style={{ maxWidth: device === "phone" ? 380 : "100%" }}>
            <FormRenderer key={device + JSON.stringify(previewPages).length} preview form={{ ...draft, pages: previewPages, logo: draft.theme.logo }} onSubmit={async () => ({})} />
          </div>
        </Modal>
      )}
    </div>
  );
}

export default FormsPage;
