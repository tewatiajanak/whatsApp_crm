import { useEffect, useMemo, useRef, useState } from "react";
import { Braces, ChevronDown, Eye, LayoutTemplate, Mail, MessageCircle, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SearchInput, UIButton } from "../components/UIKit";
import { LABEL, Pill, Toggle } from "../user-management/shared";
import RichText, { type RichTextHandle } from "./RichText";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageTitle } from "./shared";
import WaTemplateFields, { EMPTY_WA, LIMITS, WaStatus, metaName, type Wa } from "./WaTemplateFields";

type Template = { _id: string; name: string; channel: "email" | "whatsapp"; category: string; subject: string; body: string; waTemplateName: string; waLanguage: string; wa?: Wa; active: boolean };
type Form = Omit<Template, "_id">;
type KeyDef = { key: string; label: string; group: string; sample?: string };
type Channel = Template["channel"];
const CHANNELS: [Channel, string][] = [["email", "Email"], ["whatsapp", "WhatsApp"]];
const TH = "px-3 py-3 text-left font-medium whitespace-nowrap";
const CUT = "px-3 py-2.5 truncate"; // with max-width 0 the cell takes its share and cuts the text
/** message text without tags, for a one-line table cell */
const plainText = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const EMPTY: Form = { name: "", channel: "email", category: "General", subject: "", body: "", waTemplateName: "", waLanguage: "en", wa: EMPTY_WA, active: true };

/** Project Management → Setup → Templates: Email and WhatsApp templates (one tab each) with dynamic keys. */
export default function TemplatesPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { hasRight } = useAuth() as any;
  const canAdd = hasRight("templates", "create");
  const canEdit = hasRight("templates", "edit");
  const [rows, setRows] = useState<Template[]>([]);
  const [keys, setKeys] = useState<KeyDef[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<Channel>("email");
  const isMobile = useIsMobile();
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [testTo, setTestTo] = useState("");
  const [focus, setFocus] = useState<"subject" | "body" | "header">("body");
  const [keysOpen, setKeysOpen] = useState(false);
  const rich = useRef<RichTextHandle>(null);
  const plain = useRef<HTMLTextAreaElement>(null);
  const subject = useRef<HTMLInputElement>(null);
  const header = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await pmApi.templates();
      setRows(res?.data ?? []);
      return res?.data ?? [];
    } catch (e: any) {
      toast(e?.message || "Could not load templates", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load().then((list: Template[] | undefined) => {
      if (!list?.some((t) => t.wa?.metaStatus === "Pending")) return;
      pmApi.templateWaStatus().then((r: any) => r?.data?.changed && load()).catch(() => {});
    });
    pmApi.templateMeta().then((r: any) => { setKeys(r?.data?.keys ?? []); setCategories(r?.data?.categories ?? []); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((t) => t.channel === channel && (!category || t.category === category) && (!q || `${t.name} ${t.subject}`.toLowerCase().includes(q)));
  }, [rows, search, channel, category]);
  const samples = useMemo(() => Object.fromEntries(keys.map((k) => [k.key, k.sample || ""])), [keys]);
  const keyGroups = useMemo(() => [...new Set(keys.map((k) => k.group))], [keys]);

  const open = (t?: Template) => {
    setEditing(t || null);
    setPreview(null);
    setTestTo("");
    setFocus("body");
    setKeysOpen(false);
    setForm(t ? { name: t.name, channel: t.channel, category: t.category, subject: t.subject, body: t.body, waTemplateName: t.waTemplateName, waLanguage: t.waLanguage, wa: { ...EMPTY_WA, ...(t.wa || {}), buttons: [...(t.wa?.buttons || [])] }, active: t.active } : { ...EMPTY, channel });
  };

  /** put a key where the cursor is: subject, WhatsApp text or the email editor */
  const insertKey = (key: string) => {
    if (!form) return;
    const token = `{{${key}}}`;
    const into = (el: HTMLInputElement | HTMLTextAreaElement | null, field: "subject" | "body") => {
      const start = el?.selectionStart ?? form[field].length;
      const end = el?.selectionEnd ?? start;
      setForm({ ...form, [field]: form[field].slice(0, start) + token + form[field].slice(end) });
      requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length); });
    };
    if (focus === "subject" && form.channel === "email") return into(subject.current, "subject");
    if (focus === "header" && form.channel === "whatsapp" && form.wa?.headerType === "TEXT") {
      const el = header.current;
      const text = form.wa.headerText;
      const start = el?.selectionStart ?? text.length;
      const next = (text.slice(0, start) + token + text.slice(el?.selectionEnd ?? start)).slice(0, LIMITS.header);
      setForm({ ...form, wa: { ...form.wa, headerText: next } });
      return requestAnimationFrame(() => el?.focus());
    }
    if (form.channel === "whatsapp") return into(plain.current, "body");
    rich.current?.insert(token);
  };

  /** Save; with `submit` a WhatsApp template then goes to WhatsApp for approval. */
  const save = async (submit = false) => {
    if (!form?.name.trim()) return;
    setSaving(true);
    try {
      const body = form.channel === "whatsapp" ? { ...form, waTemplateName: form.waTemplateName || (submit ? metaName(form.name) : "") } : { ...form, wa: undefined };
      const res: any = editing ? await pmApi.updateTemplate(editing._id, body) : await pmApi.createTemplate(body);
      if (submit) {
        try {
          await pmApi.submitTemplate(res.data._id);
          toast("Saved and submitted for approval");
        } catch (e: any) {
          // saved, but WhatsApp did not take it: stay in the form on the saved template
          setEditing(res.data);
          setForm((f) => (f ? { ...f, waTemplateName: res.data.waTemplateName, wa: { ...EMPTY_WA, ...(res.data.wa || {}) } } : f));
          await load();
          return toast(e?.message || "Saved, but could not submit", "error");
        }
      } else toast("Saved");
      setForm(null);
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (t: Template) => {
    if (!window.confirm(`Delete the template "${t.name}"?`)) return;
    try {
      await pmApi.removeTemplate(t._id);
      toast("Deleted");
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not delete", "error");
    }
  };
  const showPreview = async () => {
    if (!form) return;
    try {
      const res: any = await pmApi.previewTemplate({ subject: form.subject, body: form.body });
      setPreview(res.data);
    } catch (e: any) {
      toast(e?.message || "Could not preview", "error");
    }
  };
  const sendTest = async () => {
    if (!editing || !testTo.trim()) return;
    setSaving(true);
    try {
      const res: any = await pmApi.testTemplate(editing._id, { to: testTo.trim() });
      toast(res.data.simulated ? "Sending is in simulation mode; nothing was delivered" : "Test sent", res.data.simulated ? "error" : "success");
    } catch (e: any) {
      toast(e?.message || "Could not send", "error");
    } finally {
      setSaving(false);
    }
  };

  const actions = (t: Template) => (
    <>
      {canEdit && <UIButton size="icon-sm" variant="ghost" title="Edit" onClick={() => open(t)}><Pencil className="h-3.5 w-3.5" /></UIButton>}
      {hasRight("templates", "del") && <UIButton size="icon-sm" variant="danger" title="Delete" onClick={() => remove(t)}><Trash2 className="h-3.5 w-3.5" /></UIButton>}
    </>
  );

  /* Dynamic keys: a small menu. Nothing in it takes the focus, so the key lands where the cursor is. */
  const keyMenu = (
    <div className="relative mb-1" onMouseDown={(e) => e.preventDefault()}>
      <button type="button" onClick={() => setKeysOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-[11.5px] font-medium" style={{ color: "var(--primary)" }}>
        <Braces className="h-3 w-3" />Insert key<ChevronDown className="h-3 w-3" />
      </button>
      {keysOpen && (
        <div className="absolute right-0 z-50 mt-1 rounded-lg border bg-card shadow-lg overflow-y-auto" style={{ width: 240, maxHeight: 280 }}>
          {keyGroups.map((g) => (
            <div key={g}>
              <div className="px-3 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{g}</div>
              {keys.filter((k) => k.group === g).map((k) => (
                <button key={k.key} type="button" title={`{{${k.key}}}`} onClick={() => { insertKey(k.key); setKeysOpen(false); }} className="block w-full px-3 py-1.5 text-left text-[12.5px] hover:bg-accent/40" style={{ background: "transparent", border: 0, color: "var(--foreground)" }}>
                  {k.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <PageTitle
        icon={<LayoutTemplate className="h-4 w-4" />}
        title="Templates"
        actions={canAdd && <UIButton onClick={() => open()} leftIcon={<Plus className="h-3.5 w-3.5" />}>Create</UIButton>}
      />

      <div className="mt-3 flex items-end gap-1 border-b">
        {CHANNELS.map(([value, label]) => {
          const Icon = value === "email" ? Mail : MessageCircle;
          const on = channel === value;
          return (
            <button key={value} type="button" onClick={() => setChannel(value)} className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium whitespace-nowrap" style={{ background: "transparent", border: 0, borderBottom: `2px solid ${on ? "var(--primary)" : "transparent"}`, marginBottom: -1, color: on ? "var(--primary)" : "var(--muted-foreground)" }}>
              <Icon className="h-3.5 w-3.5" />{label} ({rows.filter((t) => t.channel === value).length})
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" containerClassName="flex-1 min-w-[200px] max-w-md" />
        <select className="ui-input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading && <div className="mt-3 rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">Loading…</div>}
      {!loading && filtered.length === 0 && (
        <div className="mt-3 rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No templates
          {canAdd && <div className="mt-3"><UIButton size="sm" onClick={() => open()} leftIcon={<Plus className="h-3.5 w-3.5" />}>Create</UIButton></div>}
        </div>
      )}

      {/* phone: cards */}
      {filtered.length > 0 && isMobile && (
        <div className="mt-3 space-y-2">
          {filtered.map((t) => (
            <div key={t._id} className="rounded-xl border bg-card p-3" style={{ opacity: t.active ? 1 : 0.6 }} onClick={() => open(t)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.channel === "email" ? t.subject : t.body}</div>
                </div>
                <div className="inline-flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>{actions(t)}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Pill tone="muted">{t.category}</Pill>
                <Pill tone={t.active ? "success" : "muted"}>{t.active ? "Active" : "Inactive"}</Pill>
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length > 0 && !isMobile && (
        <div className="mt-3 rounded-xl border bg-card overflow-hidden">
          <div>
            <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                  <th className={TH} style={{ width: 60 }}>Sr No</th>
                  <th className={TH} style={{ width: "26%" }}>Name</th>
                  <th className={TH} style={{ width: 120 }}>Category</th>
                  <th className={TH}>{channel === "email" ? "Subject" : "Message"}</th>
                  {channel === "whatsapp" && <th className={TH} style={{ width: 124 }}>Approval</th>}
                  <th className={TH} style={{ width: 90 }}>Status</th>
                  <th className="px-3 py-3 font-medium" style={{ width: 88, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr key={t._id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={() => open(t)}>
                    <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className={`${CUT} font-medium text-foreground`} style={{ maxWidth: 0 }} title={t.name}>{t.name}</td>
                    <td className="px-3 py-2.5"><Pill tone="muted">{t.category}</Pill></td>
                    <td className={`${CUT} text-muted-foreground`} style={{ maxWidth: 0 }}>{(t.channel === "email" ? t.subject : plainText(t.body)) || "—"}</td>
                    {channel === "whatsapp" && <td className="px-3 py-2.5"><WaStatus wa={t.wa} name={t.waTemplateName} /></td>}
                    <td className="px-3 py-2.5"><Pill tone={t.active ? "success" : "muted"}>{t.active ? "Active" : "Inactive"}</Pill></td>
                    <td className="px-3 py-2.5" style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}><span className="inline-flex items-center gap-1">{actions(t)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Sheet open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-xl flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>{editing ? editing.name : form?.channel === "whatsapp" ? "Create WhatsApp template" : "Create email template"}</SheetTitle></SheetHeader>
          {form && (
            <div className="flex-1 overflow-y-auto p-4">
              <fieldset disabled={editing ? !canEdit : !canAdd} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                <div className="space-y-3 min-w-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className={LABEL}>Name *</label>
                      <input autoFocus className="ui-input w-full" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div>
                      <label className={LABEL}>Category</label>
                      <select className="ui-input w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex items-end justify-between gap-3 text-sm pb-1.5">
                      <span>Active</span>
                      <Toggle on={form.active} onChange={() => setForm({ ...form, active: !form.active })} labels={["Yes", "No"]} />
                    </div>
                  </div>

                  {form.channel === "email" ? (
                    <>
                      <div>
                        <label className={LABEL}>Subject *</label>
                        <input ref={subject} className="ui-input w-full" value={form.subject} onFocus={() => setFocus("subject")} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                      </div>
                      <div onFocus={() => setFocus("body")}>
                        <div className="flex items-end justify-between gap-2">
                          <label className={LABEL}>Message *</label>
                          {keyMenu}
                        </div>
                        <RichText ref={rich} value={form.body} onChange={(body) => setForm((f) => (f ? { ...f, body } : f))} onError={(m) => toast(m, "error")} />
                      </div>
                    </>
                  ) : (
                    <WaTemplateFields
                      name={form.name}
                      body={form.body}
                      waTemplateName={form.waTemplateName}
                      waLanguage={form.waLanguage}
                      wa={form.wa || EMPTY_WA}
                      set={(patch) => setForm((f) => (f ? { ...f, ...patch } : f))}
                      samples={samples}
                      keyMenu={keyMenu}
                      bodyRef={plain}
                      headerRef={header}
                      onFocus={setFocus}
                      onError={(m) => toast(m, "error")}
                    />
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {form.channel === "email" && <UIButton size="sm" variant="outline" onClick={showPreview} leftIcon={<Eye className="h-3.5 w-3.5" />}>Preview</UIButton>}
                    {editing && canEdit && (
                      <>
                        <input className="ui-input flex-1" style={{ minWidth: 150 }} value={testTo} onChange={(e) => setTestTo(e.target.value)} aria-label={form.channel === "email" ? "Test email" : "Test number"} placeholder={form.channel === "email" ? "name@example.com" : "919876543210"} />
                        <UIButton size="sm" variant="outline" loading={saving} disabled={!testTo.trim()} onClick={sendTest} leftIcon={<Send className="h-3.5 w-3.5" />}>Send test</UIButton>
                      </>
                    )}
                  </div>

                  {preview && form.channel === "email" && (
                    <div className="rounded-lg border overflow-hidden">
                      {form.channel === "email" && <div className="border-b px-3 py-2 text-sm font-semibold" style={{ background: "var(--muted-background)" }}>{preview.subject}</div>}
                      {form.channel === "email" ? (
                        <div className="px-3 py-2.5 text-sm" dangerouslySetInnerHTML={{ __html: preview.body }} />
                      ) : (
                        <div className="px-3 py-2.5 text-sm whitespace-pre-wrap">{preview.body}</div>
                      )}
                    </div>
                  )}
                </div>
              </fieldset>
            </div>
          )}
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setForm(null)} className="flex-1">Cancel</UIButton>
            {(editing ? canEdit : canAdd) && <UIButton variant={form?.channel === "whatsapp" && canEdit ? "outline" : undefined} onClick={() => save()} loading={saving} disabled={!form?.name.trim()} className="flex-1">Save</UIButton>}
            {form?.channel === "whatsapp" && canEdit && (editing || canAdd) && <UIButton onClick={() => save(true)} loading={saving} disabled={!form?.name.trim() || !form.body.trim()} leftIcon={<Send className="h-3.5 w-3.5" />} className="flex-1">Save &amp; submit</UIButton>}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
