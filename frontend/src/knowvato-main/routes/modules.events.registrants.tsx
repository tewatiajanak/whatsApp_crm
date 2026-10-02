import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Eye, Mail, MessageCircle, Pencil, Send } from "lucide-react";
import { http } from "../../api";
import { useToast } from "../../context/ToastContext";
import { useEventData } from "@/event-manager/context/EventDataContext";
import { SearchInput, UIButton } from "@/components/UIKit";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fmtDateTime } from "@/utils/date";
import { loadAttendeeCategories } from "../event-form/eventScope";
import PassPreviewModal from "../event-pass/PassPreviewModal";
import { useColumnPicker } from "@/components/ColumnPicker";
import SendMessageDialog from "@/components/SendMessageDialog";

const COLUMNS = ["Sr No", "Name", "Mobile number", "Event", "Category", "Organisation", "Pass", "Registration date", "Actions"];

/** Event Manager → Registrants: everyone registered, across events or for one event. */
type Form = { name: string; phone: string; email: string; category: string; organization: string };
const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";
const TH = "px-4 py-3 text-left font-medium";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EventsRegistrantsPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { events = [], attendees = [], setAttendees, updateAttendee } = useEventData() as any;
  const [eventId, setEventId] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Form>({ name: "", phone: "", email: "", category: "", organization: "" });
  const [saving, setSaving] = useState(false);
  const [passFor, setPassFor] = useState<any | null>(null);
  const cols = useColumnPicker("registrants", COLUMNS, [0, 1, 8]);
  const [commOpen, setCommOpen] = useState(false);
  const [sendVia, setSendVia] = useState<"whatsapp" | "email" | null>(null);

  // registrations also arrive from the public form — start from fresh data
  useEffect(() => {
    http
      .get("/attendees")
      .then((res: any) => setAttendees(res?.data ?? []))
      .catch((e: any) => toast(e?.message || "Could not load registrants", "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventMap = useMemo(() => Object.fromEntries((events as any[]).map((e) => [e.id, e])), [events]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (attendees as any[])
      .filter((a) => eventMap[a.eventId] && (eventId === "all" || a.eventId === eventId))
      .filter((a) => !q || `${a.name || ""} ${a.phone || ""} ${a.email || ""} ${a.organization || ""}`.toLowerCase().includes(q));
  }, [attendees, eventMap, eventId, search]);
  const total = useMemo(
    () => (attendees as any[]).filter((a) => eventMap[a.eventId] && (eventId === "all" || a.eventId === eventId)).length,
    [attendees, eventMap, eventId]
  );

  const openEdit = (a: any) => {
    setEditing(a);
    setForm({ name: a.name || "", phone: a.phone || "", email: a.email || "", category: a.category || "", organization: a.organization || "" });
  };
  // categories that apply to the registrant's event, plus whatever they already have
  const categoryOptions = useMemo(() => {
    if (!editing) return [];
    const names = loadAttendeeCategories(editing.eventId).map((c) => c.name);
    return editing.category && !names.includes(editing.category) ? [editing.category, ...names] : names;
  }, [editing]);

  const phoneDigits = form.phone.replace(/\D/g, "");
  const problem = !form.name.trim()
    ? "Enter the name."
    : form.phone.trim() && phoneDigits.length < 7
    ? "Enter a valid mobile number."
    : form.email.trim() && !EMAIL.test(form.email.trim())
    ? "Enter a valid email address."
    : "";

  const save = async () => {
    if (!editing || problem) return;
    setSaving(true);
    try {
      await updateAttendee(editing.id, { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), category: form.category, organization: form.organization.trim() }, editing);
      toast("Registrant updated");
      setEditing(null);
    } catch (e: any) {
      toast(e?.message || "Could not update the registrant", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
      {/* Header */}
      <div className="pb-2 border-b">
        <Link to="/modules/events" className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors" style={{ textDecoration: "none" }}>
          <ArrowLeft className="h-3 w-3" /> Back to Event Manager
        </Link>
        <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight">Registrants</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select className="ui-input" value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ minWidth: 220 }}>
          <option value="all">All events</option>
          {(events as any[]).map((e) => (
            <option key={e.id} value={e.id}>{e.eventName || "Untitled"}</option>
          ))}
        </select>
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, mobile, email…" containerClassName="flex-1 min-w-[220px] max-w-md" />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{loading ? "Loading…" : `${rows.length} of ${total}`}</span>
          {/* Message the registrants currently listed */}
          <div style={{ position: "relative" }}>
            <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" title="Send a message" aria-label="Send a message" disabled={!rows.length} onClick={() => setCommOpen((o) => !o)}>
              <Send className="h-3.5 w-3.5" />
            </button>
            {commOpen && (
              <div className="rounded-lg border bg-card py-1" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 40, minWidth: 160, boxShadow: "var(--shadow-lift)" }} onMouseLeave={() => setCommOpen(false)}>
                {([["whatsapp", "WhatsApp", MessageCircle], ["email", "Email", Mail]] as const).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] hover:bg-accent text-left"
                    style={{ background: "transparent", border: 0, color: "var(--foreground)" }}
                    onClick={() => {
                      setCommOpen(false);
                      setSendVia(id);
                    }}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {cols.button}
        </div>
      </div>
      {cols.style}

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table id={cols.tableId} className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className={TH} style={{ width: 64 }}>Sr No</th>
                <th className={TH}>Name</th>
                <th className={TH}>Mobile number</th>
                <th className={TH}>Event</th>
                <th className={TH}>Category</th>
                <th className={TH}>Organisation</th>
                <th className={TH}>Pass</th>
                <th className={TH}>Registration date</th>
                <th className="px-4 py-3 font-medium" style={{ width: 110, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {total ? "No registrants match your search." : "No registrants yet."}
                  </td>
                </tr>
              )}
              {rows.map((a, i) => {
                const ev = eventMap[a.eventId];
                const hasDesign = !!ev?.passLayout?.blocks;
                return (
                  <tr key={a.id} className="border-t hover:bg-accent/30">
                    <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{a.name || "—"}</div>
                      {a.email && <div className="text-xs text-muted-foreground">{a.email}</div>}
                    </td>
                    <td className="px-4 py-2.5">{a.phone || "—"}</td>
                    <td className="px-4 py-2.5">{ev.eventName}</td>
                    <td className="px-4 py-2.5">{a.category || "—"}</td>
                    <td className="px-4 py-2.5">{a.organization || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                        style={a.passGenerated ? { background: "var(--success-bg)", color: "var(--success)" } : { background: "var(--muted-background)", color: "var(--muted-foreground)" }}
                      >
                        {a.passGenerated ? "Generated" : "No pass"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmtDateTime(a.createdAt)}</td>
                    <td className="px-4 py-2.5" style={{ textAlign: "right" }}>
                      <div className="inline-flex items-center gap-1">
                        {hasDesign && (
                          <UIButton size="icon-sm" variant="ghost" onClick={() => setPassFor(a)} title="View pass">
                            <Eye className="h-3.5 w-3.5" />
                          </UIButton>
                        )}
                        <UIButton size="icon-sm" variant="ghost" onClick={() => openEdit(a)} title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </UIButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit drawer */}
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10">
            <SheetTitle>Edit registrant</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div>
              <label className={LABEL}>Name *</label>
              <input autoFocus className="ui-input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} />
            </div>
            <div>
              <label className={LABEL}>Mobile number</label>
              <input type="tel" inputMode="numeric" className="ui-input w-full" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d+ -]/g, "") })} maxLength={18} />
            </div>
            <div>
              <label className={LABEL}>Email</label>
              <input type="email" className="ui-input w-full" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Category</label>
              <select className="ui-input w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">— none —</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Organisation</label>
              <input className="ui-input w-full" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} maxLength={120} />
            </div>
            {problem && form.name.trim() !== "" && <div className="text-xs" style={{ color: "var(--destructive)" }}>{problem}</div>}
          </div>
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setEditing(null)} className="flex-1">Cancel</UIButton>
            <UIButton onClick={save} loading={saving} disabled={!!problem} className="flex-1">Save changes</UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {sendVia && (
        <SendMessageDialog
          channel={sendVia}
          recipients={rows.map((a) => ({ id: a.id, name: a.name, phone: a.phone, email: a.email, eventName: eventMap[a.eventId]?.eventName }))}
          onClose={() => setSendVia(null)}
          onNotify={toast}
        />
      )}

      {passFor && <PassPreviewModal attendee={passFor} event={eventMap[passFor.eventId]} onClose={() => setPassFor(null)} />}
    </div>
  );
}
