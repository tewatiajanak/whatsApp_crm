import { useState } from "react";
import { CheckCheck, FileText, Image as ImageIcon, Link2, Mail, MessageCircle, MessageSquare, Pencil, Phone, Plus, Reply, Trash2, Video, X } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { UIButton } from "./UIKit";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fmtDate } from "@/utils/date";
import { templateStore, useTemplates, type Channel, type SetupModule, type Template, type TemplateButton } from "@/lib/template-store";

/** Setup → Communication Templates: the WhatsApp, SMS and email templates of a module. */
const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";
const TH = "px-4 py-3 text-left font-medium";
const AREA = { height: "auto", padding: "8px 12px" } as const;

const CHANNEL = {
  whatsapp: { title: "WhatsApp Templates", icon: MessageCircle, bodyMax: 1024 },
  sms: { title: "SMS Templates", icon: MessageSquare, bodyMax: 480 },
  email: { title: "Email Templates", icon: Mail, bodyMax: 20000 },
} as const;
const CATEGORIES = [["MARKETING", "Marketing"], ["UTILITY", "Utility"], ["AUTHENTICATION", "Authentication"]] as const;
const LANGUAGES = [["en_US", "English (US)"], ["en_GB", "English (UK)"], ["hi", "Hindi"], ["es", "Spanish"]] as const;
const HEADERS = [["none", "None"], ["text", "Text"], ["image", "Image"], ["video", "Video"], ["document", "Document"], ["location", "Location"]] as const;

const blank = (channel: Channel): Template => ({
  id: crypto.randomUUID(),
  channel,
  name: "",
  category: "MARKETING",
  language: "en_US",
  header: { type: "none" },
  subject: "",
  body: "",
  footer: "",
  buttons: [],
  sample: "",
  status: "PENDING",
  active: true,
  createdAt: new Date().toISOString(),
});
// {{1}}, {{2}}… are shown with the sample values in the preview
const withSamples = (text: string, sample?: string) => {
  const samples = (sample || "").split(",").map((s) => s.trim());
  return text.replace(/\{\{(\d+)\}\}/g, (_, n) => samples[Number(n) - 1] || `{{${n}}}`);
};

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} style={{ background: "transparent", border: 0, padding: 0 }}>
      <span className="relative inline-flex h-5 w-9 items-center rounded-full" style={{ background: on ? "var(--primary)" : "var(--border)" }}>
        <span className="inline-block h-4 w-4 rounded-full bg-white" style={{ transform: `translateX(${on ? 18 : 2}px)` }} />
      </span>
    </button>
  );
}

export default function TemplateManager({ channel, module = "events" }: { channel: Channel; module?: SetupModule }) {
  const toast = useToast() as (msg: string, type?: string) => void;
  const list = useTemplates(channel, module);
  const meta = CHANNEL[channel];
  const Icon = meta.icon;
  const isWa = channel === "whatsapp";
  const isEmail = channel === "email";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Template>(blank(channel));
  const [saving, setSaving] = useState(false);
  const editing = list.some((x) => x.id === form.id);
  const set = (patch: Partial<Template>) => setForm((f) => ({ ...f, ...patch }));

  const problem = !form.name.trim() ? "Enter the template name." : isEmail && !form.subject?.trim() ? "Enter the subject." : !form.body.trim() ? "Enter the message." : "";
  const save = async () => {
    if (problem) return;
    setSaving(true);
    try {
      await templateStore.upsert({ ...form, name: form.name.trim(), module: form.module ?? module });
      toast("Template saved");
      setOpen(false);
    } catch (e: any) {
      toast(e?.message || "Could not save the template", "error");
    } finally {
      setSaving(false);
    }
  };
  const remove = (t: Template) => {
    if (!window.confirm(`Delete the template "${t.name}"?`)) return;
    templateStore.remove(t.id).then(() => toast("Template deleted")).catch((e) => toast(e?.message || "Could not delete", "error"));
  };
  const setActive = (t: Template, active: boolean) => templateStore.upsert({ ...t, active }).catch((e) => toast(e?.message || "Could not update", "error"));

  const addButton = (type: TemplateButton["type"]) =>
    set({ buttons: [...form.buttons, type === "quick_reply" ? { type, text: "" } : type === "url" ? { type, text: "", url: "https://" } : { type, text: "", phone: "" }] });
  const updateButton = (i: number, patch: Partial<TemplateButton>) => set({ buttons: form.buttons.map((b, idx) => (idx === i ? ({ ...b, ...patch } as TemplateButton) : b)) });

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
            <Icon className="h-4 w-4" />
          </span>
          <h2 className="text-base font-semibold text-foreground leading-tight">{meta.title}</h2>
        </div>
        <UIButton onClick={() => { setForm(blank(channel)); setOpen(true); }} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add template</UIButton>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className={TH} style={{ width: 64 }}>Sr No</th>
                <th className={TH}>Template</th>
                <th className={TH}>{isEmail ? "Subject" : isWa ? "Category" : "Message"}</th>
                <th className={TH}>Active</th>
                <th className={TH}>Created on</th>
                <th className="px-4 py-3 font-medium" style={{ width: 110, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">No templates yet.</td></tr>
              )}
              {list.map((t, i) => (
                <tr key={t.id} className="border-t hover:bg-accent/30">
                  <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{t.name}</td>
                  <td className="px-4 py-2.5" style={{ maxWidth: 360 }}>
                    <div className="truncate">{isEmail ? t.subject : isWa ? CATEGORIES.find((c) => c[0] === t.category)?.[1] : t.body}</div>
                  </td>
                  <td className="px-4 py-2.5"><Toggle on={t.active} onChange={(v) => setActive(t, v)} /></td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                  <td className="px-4 py-2.5" style={{ textAlign: "right" }}>
                    <div className="inline-flex items-center gap-1">
                      <UIButton size="icon-sm" variant="ghost" onClick={() => { setForm({ ...t, buttons: [...t.buttons] }); setOpen(true); }} title="Edit"><Pencil className="h-3.5 w-3.5" /></UIButton>
                      <UIButton size="icon-sm" variant="danger" onClick={() => remove(t)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></UIButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="crm-theme w-full sm:max-w-3xl flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>{editing ? "Edit template" : "Add template"}</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="space-y-3">
              <div>
                <label className={LABEL}>Template name *</label>
                <input
                  autoFocus
                  className="ui-input w-full"
                  value={form.name}
                  maxLength={80}
                  // WhatsApp and SMS providers accept only lower-case names with underscores
                  onChange={(e) => set({ name: isEmail ? e.target.value : e.target.value.toLowerCase().replace(/\s/g, "_") })}
                />
              </div>

              {isWa && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL}>Category</label>
                      <select className="ui-input w-full" value={form.category} onChange={(e) => set({ category: e.target.value as Template["category"] })}>
                        {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL}>Language</label>
                      <select className="ui-input w-full" value={form.language} onChange={(e) => set({ language: e.target.value })}>
                        {LANGUAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={LABEL}>Header</label>
                    <select className="ui-input w-full" value={form.header?.type || "none"} onChange={(e) => set({ header: { type: e.target.value as any, text: form.header?.text } })}>
                      {HEADERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {form.header?.type === "text" && (
                      <input className="ui-input w-full mt-2" value={form.header.text || ""} maxLength={60} onChange={(e) => set({ header: { type: "text", text: e.target.value } })} />
                    )}
                  </div>
                </>
              )}

              {isEmail && (
                <div>
                  <label className={LABEL}>Subject *</label>
                  <input className="ui-input w-full" value={form.subject || ""} maxLength={150} onChange={(e) => set({ subject: e.target.value })} />
                </div>
              )}

              <div>
                <label className={LABEL}>Message *</label>
                <textarea className="ui-input w-full" style={AREA} rows={isEmail ? 12 : 5} value={form.body} maxLength={meta.bodyMax} onChange={(e) => set({ body: e.target.value })} />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {isEmail
                    ? "{{name}} and {{event}} are replaced for each person."
                    : `{{1}}, {{2}} are replaced when sending. ${form.body.length}/${meta.bodyMax}${channel === "sms" ? ` · ${Math.ceil(form.body.length / 160) || 0} SMS` : ""}`}
                </p>
              </div>

              {isWa && (
                <div>
                  <label className={LABEL}>Footer</label>
                  <input className="ui-input w-full" value={form.footer || ""} maxLength={60} onChange={(e) => set({ footer: e.target.value })} />
                </div>
              )}
              {!isEmail && (
                <div>
                  <label className={LABEL}>Sample values</label>
                  <input className="ui-input w-full" value={form.sample || ""} onChange={(e) => set({ sample: e.target.value })} />
                  <p className="text-[11px] text-muted-foreground mt-1">Comma separated, in the order of {"{{1}}, {{2}}"}.</p>
                </div>
              )}

              {isWa && (
                <div>
                  <label className={LABEL}>Buttons · max 3</label>
                  <div className="flex flex-wrap gap-2">
                    {([["quick_reply", "Quick reply", Reply], ["url", "Website", Link2], ["phone", "Call", Phone]] as const).map(([type, label, BtnIcon]) => (
                      <UIButton key={type} size="sm" variant="outline" disabled={form.buttons.length >= 3} onClick={() => addButton(type)} leftIcon={<BtnIcon className="h-3.5 w-3.5" />}>{label}</UIButton>
                    ))}
                  </div>
                  <div className="space-y-2 mt-2">
                    {form.buttons.map((b, i) => (
                      <div key={i} className="rounded-lg border p-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap" style={{ width: 84 }}>{b.type === "quick_reply" ? "Quick reply" : b.type === "url" ? "Website" : "Call"}</span>
                          <input className="ui-input flex-1" style={{ minWidth: 0 }} value={b.text} maxLength={25} aria-label="Button text" onChange={(e) => updateButton(i, { text: e.target.value })} />
                          <UIButton size="icon-sm" variant="danger" onClick={() => set({ buttons: form.buttons.filter((_, idx) => idx !== i) })} title="Remove"><X className="h-3.5 w-3.5" /></UIButton>
                        </div>
                        {b.type === "url" && <input className="ui-input w-full" value={b.url} aria-label="Website address" onChange={(e) => updateButton(i, { url: e.target.value })} />}
                        {b.type === "phone" && <input className="ui-input w-full" type="tel" value={b.phone} aria-label="Phone number" onChange={(e) => updateButton(i, { phone: e.target.value.replace(/[^\d+ -]/g, "") })} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {problem && form.name.trim() !== "" && <div className="text-xs" style={{ color: "var(--destructive)" }}>{problem}</div>}
            </div>

            {/* Preview */}
            <div>
              <div className={LABEL}>Preview</div>
              {isEmail ? (
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold text-foreground mb-2">{form.subject || "—"}</div>
                  {/<[a-z][\s\S]*>/i.test(form.body) ? (
                    <div className="text-sm" dangerouslySetInnerHTML={{ __html: form.body }} />
                  ) : (
                    <div className="text-sm text-foreground" style={{ whiteSpace: "pre-wrap" }}>{form.body}</div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg p-3" style={{ background: isWa ? "#e5ddd5" : "var(--muted-background)" }}>
                  <div className="rounded-lg bg-white" style={{ maxWidth: 320, marginLeft: "auto", color: "#111827", boxShadow: "0 1px 1px rgba(0,0,0,.12)" }}>
                    {isWa && form.header?.type === "text" && form.header.text && <div className="px-3 pt-2 text-sm font-semibold">{withSamples(form.header.text, form.sample)}</div>}
                    {isWa && ["image", "video", "document"].includes(form.header?.type || "") && (
                      <div className="flex items-center justify-center rounded-t-lg" style={{ background: "#e5e7eb", color: "#6b7280", aspectRatio: "16 / 9" }}>
                        {form.header?.type === "image" ? <ImageIcon className="h-8 w-8" /> : form.header?.type === "video" ? <Video className="h-8 w-8" /> : <FileText className="h-8 w-8" />}
                      </div>
                    )}
                    <div className="p-3 text-sm" style={{ whiteSpace: "pre-wrap", minHeight: 44 }}>{withSamples(form.body, form.sample)}</div>
                    {isWa && form.footer && <div className="px-3 pb-2 text-xs" style={{ color: "#6b7280" }}>{form.footer}</div>}
                    {isWa && (
                      <div className="px-3 pb-2 flex items-center justify-end" style={{ color: "#3b82f6" }}><CheckCheck className="h-3 w-3" /></div>
                    )}
                    {isWa && form.buttons.map((b, i) => (
                      <div key={i} className="border-t py-2 text-sm font-medium flex items-center justify-center gap-1" style={{ color: "#2563eb" }}>
                        {b.type === "url" ? <Link2 className="h-4 w-4" /> : b.type === "phone" ? <Phone className="h-4 w-4" /> : <Reply className="h-4 w-4" />}
                        {b.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</UIButton>
            <UIButton onClick={save} loading={saving} disabled={!!problem} className="flex-1">{editing ? "Save changes" : "Add template"}</UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
