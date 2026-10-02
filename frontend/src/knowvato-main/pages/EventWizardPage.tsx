import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, Building2 } from "lucide-react";
import { http } from "../../api";
import { appStore } from "../../api/appStore";
import DateInput from "../../components/DateInput";
import TimeInput from "../../components/TimeInput";
import { useToast } from "../../context/ToastContext";
import { useEventData } from "@/event-manager/context/EventDataContext";
import FormDesigner from "../event-form/FormDesigner";
import FieldsStep, { type FieldRow, fieldRowsError, rowsToFields } from "../event-form/FieldsStep";
import { appliesToEvent, loadAttendeeCategories } from "../event-form/eventScope";
import {
  type EventInfo, type FieldType, type FormDesign, type FormField,
  SUPPORTED_FIELD_TYPES, SYSTEM_FIELDS, applyTemplate, orderFieldBlocks, syncFields,
} from "../event-form/schema";
import { DEFAULT_TEMPLATE } from "../event-form/templates";

/**
 * Create / edit an event in three steps:
 *   1. Event details + registration amount per attendee category
 *   2. Which fields the registration form asks
 *   3. Design of the live registration form
 */
type Details = {
  eventName: string; eventType: string; organizer: string; description: string;
  startDate: string; endDate: string; startTime: string; endTime: string;
  venue: string; city: string; capacity: number;
  /** Optional: stop taking registrations before the event's last day. */
  registrationCloseDate: string; registrationCloseTime: string;
};
const EMPTY: Details = {
  eventName: "", eventType: "", organizer: "", description: "",
  startDate: "", endDate: "", startTime: "09:00", endTime: "18:00",
  venue: "", city: "", capacity: 100,
  registrationCloseDate: "", registrationCloseTime: "",
};
type Row = FieldRow;

const STEPS = ["Event details", "Form fields", "Form design"];
const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";
const INPUT = "ui-input w-full";
const TH = "px-3 py-2.5 text-left font-medium";

const loadVenues = (): { id: string; name: string; city?: string }[] => {
  try {
    const rows = JSON.parse(appStore.getItem("em_venues") || "[]");
    return Array.isArray(rows) ? rows.filter((v) => v?.name) : [];
  } catch {
    return [];
  }
};

export default function EventWizardPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const toast = useToast() as (msg: string, type?: string) => void;
  const { events = [], eventsLoading, eventTypes = [], addEvent, updateEvent } = useEventData() as any;
  const editingEvent = useMemo(() => (eventId ? events.find((e: any) => String(e.id) === String(eventId)) : null), [events, eventId]);

  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<Details>(EMPTY);
  const [fees, setFees] = useState<Record<string, number>>({});
  const [singleFee, setSingleFee] = useState(0);
  // Whether this event's form collects a registration payment at all.
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [design, setDesign] = useState<FormDesign | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // null = not known yet; false = no gateway is switched on, so the form cannot take money
  const [gatewayActive, setGatewayActive] = useState<boolean | null>(null);
  useEffect(() => {
    http
      .get("/payment-gateways")
      .then((res: any) => setGatewayActive((res?.data ?? []).some((g: any) => g.isActive)))
      .catch(() => setGatewayActive(null));
  }, []);
  // keys already used by any custom field of this organisation (keys must be unique)
  const [takenKeys, setTakenKeys] = useState<Set<string>>(new Set());

  const venues = useMemo(loadVenues, []);
  const categories = useMemo(() => loadAttendeeCategories(eventId), [eventId]);

  // Load once: the event being edited (if any) and the custom fields from Setup.
  useEffect(() => {
    if (loaded || (eventId && (eventsLoading || !editingEvent))) return;
    const ev = editingEvent;
    if (ev) {
      setDetails({
        eventName: ev.eventName || "", eventType: ev.eventType || "", organizer: ev.organizer || "", description: ev.description || "",
        startDate: ev.startDate || "", endDate: ev.endDate || "", startTime: ev.startTime || "09:00", endTime: ev.endTime || "18:00",
        venue: ev.venue || "", city: ev.city || "", capacity: ev.capacity || 0,
        registrationCloseDate: ev.registrationCloseDate || "", registrationCloseTime: ev.registrationCloseTime || "",
      });
      setSingleFee(Number(ev.registrationFee) || 0);
      // events saved before this switch existed: on if any amount was set
      setPaymentRequired(
        ev.paymentRequired ?? (Number(ev.registrationFee) > 0 || Object.values(ev.registrationFees || {}).some((v) => Number(v) > 0))
      );
      if (ev.form?.design) setDesign(ev.form.design);
    }
    const savedFees: Record<string, number> = ev?.registrationFees || {};
    setFees(Object.fromEntries(categories.map((c) => [c.name, Number(savedFees[c.name]) || 0])));

    const savedFields: FormField[] = ev?.form?.fields || [];
    const savedMap = new Map(savedFields.map((f) => [f.key, f]));
    const isNew = !ev?.form;
    const system: Row[] = SYSTEM_FIELDS.map((f) => {
      const s = savedMap.get(f.key);
      return {
        ...f,
        ...(s || {}),
        system: true,
        type: f.type,
        label: s?.label || f.label,
        required: s ? s.required : f.required,
        included: f.key === "name" || (isNew ? f.key !== "organization" : !!s),
        locked: f.key === "name",
      };
    });
    (async () => {
      let custom: Row[] = [];
      try {
        const res: any = await http.get("/custom-fields?module=events&perPage=200");
        setTakenKeys(new Set((res?.data ?? []).map((c: any) => String(c.key))));
        custom = (res?.data ?? [])
          .filter((c: any) => c.isActive !== false && appliesToEvent(c.events, eventId))
          .filter((c: any) => !SYSTEM_FIELDS.some((s) => s.key === c.key))
          .map((c: any) => {
            const s = savedMap.get(c.key);
            const supported = SUPPORTED_FIELD_TYPES.includes(c.type);
            return {
              ...(s || {}),
              key: c.key, label: s?.label || c.label, type: (supported ? c.type : "text") as FieldType,
              required: s?.required ?? false, options: s?.options || [], included: !!s && supported, unsupported: !supported,
            };
          });
      } catch {
        toast("Could not load custom fields from Setup", "error");
      }
      // fields already on the form come first, in their saved sequence
      const savedOrder = new Map(savedFields.map((x, i) => [x.key, i]));
      const all = [...system, ...custom];
      setRows(
        all
          .map((r, i) => ({ r, i }))
          .sort((a, b) => (savedOrder.get(a.r.key) ?? 1000 + a.i) - (savedOrder.get(b.r.key) ?? 1000 + b.i))
          .map((x) => x.r)
      );
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, eventsLoading, editingEvent, loaded]);

  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories]);
  // everything the form collects (saved on the event)…
  const fields: FormField[] = useMemo(() => rowsToFields(rows, categoryNames), [rows, categoryNames]);
  // …and the ones that have a place on the page (hidden fields have none)
  const shownFields = useMemo(() => fields.filter((f) => !f.hidden), [fields]);
  const askCategory = fields.some((f) => f.key === "category");
  const eventInfo: EventInfo = useMemo(
    () => ({
      ...details,
      registrationFees: paymentRequired && askCategory ? fees : {},
      registrationFee: paymentRequired && !askCategory ? singleFee : 0,
    }),
    [details, fees, singleFee, askCategory, paymentRequired]
  );

  const set = (patch: Partial<Details>) => setDetails((d) => ({ ...d, ...patch }));

  const step1Error = !details.eventName.trim()
    ? "Enter the event name."
    : !details.startDate
    ? "Choose the start date."
    : details.endDate && details.endDate < details.startDate
    ? "End date cannot be before the start date."
    : details.registrationCloseTime && !details.registrationCloseDate
    ? "Choose the closing date for the closing time."
    : details.registrationCloseDate && details.registrationCloseDate > (details.endDate || details.startDate)
    ? "The form closing date cannot be after the event's last date."
    : "";
  const step2Error = fieldRowsError(rows);

  // Anything changed since the last load / save? Used to warn before leaving.
  const [dirty, setDirty] = useState(false);
  const watching = useRef(false);
  useEffect(() => {
    if (!loaded) return;
    // the first run after loading is the loaded data itself, not an edit
    if (!watching.current) {
      watching.current = true;
      return;
    }
    setDirty(true);
  }, [loaded, details, fees, singleFee, paymentRequired, rows, design]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const leave = () => {
    if (dirty && !window.confirm("You have changes that are not saved. Leave without saving?")) return;
    navigate("/modules/events/all");
  };

  // New fields become real custom fields, limited to this event.
  const saveNewFields = async (id: string) => {
    const created = rows.filter((r) => r.isNew);
    const failed: string[] = [];
    for (const r of created) {
      try {
        await http.post("/custom-fields", { module: "events", key: r.key, label: r.label.trim(), type: r.type, isActive: true, events: [id] });
      } catch {
        failed.push(r.label);
      }
    }
    setRows((rs) => rs.map((r) => (r.isNew && !failed.includes(r.label) ? { ...r, isNew: false } : r)));
    if (failed.length) toast(`The event is saved, but these fields could not be added to Custom Fields: ${failed.join(", ")}`, "error");
  };

  /**
   * Step 2 rows changed. When a field is added to an event that already exists,
   * save it immediately: the field goes to Setup → Custom Fields (for this
   * event) and into the event's form, so it is still there on the next visit.
   */
  const handleRows = async (next: Row[]) => {
    const added = next.filter((r) => r.isNew && !rows.some((x) => x.key === r.key));
    const wasDirty = dirty;
    setRows(next);
    // Sr No changed: the fields on the designed form follow the new sequence
    const keysOf = (list: Row[]) => list.filter((r) => r.included).map((r) => r.key);
    const before = keysOf(rows), after = keysOf(next);
    // (the same fields in a different order — ticking a field is not a re-sequence)
    const resequenced = before.join("|") !== after.join("|") && [...before].sort().join("|") === [...after].sort().join("|");
    if (design && resequenced) {
      const ordered = rowsToFields(next, categoryNames).filter((x) => !x.hidden);
      setDesign(orderFieldBlocks(syncFields(design, ordered), ordered));
    }
    if (!eventId || !editingEvent || !added.length) return;
    try {
      for (const r of added) {
        await http.post("/custom-fields", { module: "events", key: r.key, label: r.label.trim(), type: r.type, isActive: true, events: [eventId] });
      }
      const nextFields = rowsToFields(next, categoryNames);
      const shown = nextFields.filter((x) => !x.hidden);
      const nextDesign = syncFields(design ?? editingEvent.form?.design ?? applyTemplate(DEFAULT_TEMPLATE, shown), shown);
      await updateEvent(eventId, { form: { fields: nextFields, design: nextDesign, published: editingEvent.form?.published ?? true } }, editingEvent);
      if (design) setDesign(nextDesign);
      const keys = new Set(added.map((r) => r.key));
      setRows((rs) => rs.map((r) => (keys.has(r.key) ? { ...r, isNew: false } : r)));
      setTakenKeys((t) => new Set([...t, ...keys]));
      toast(`${added.map((r) => r.label).join(", ")} saved to this event's form`);
      // the field itself is saved; only earlier edits (if any) are still pending
      setTimeout(() => setDirty(wasDirty), 150);
    } catch (e: any) {
      toast(e?.message || "The new field could not be saved. Use Save changes to try again.", "error");
    }
  };

  const goTo = (n: number) => {
    if (n > 0 && step1Error) return toast(step1Error, "error");
    if (n > 1 && step2Error) return toast(step2Error, "error");
    // entering the designer: start from the default template, keep it in step with the fields
    if (n === 2) setDesign((d) => syncFields(d ?? applyTemplate(DEFAULT_TEMPLATE, shownFields), shownFields));
    setStep(n);
    window.scrollTo({ top: 0 });
  };

  // Everything the wizard holds beyond the basic event details.
  const buildExtra = () => ({
    registrationCloseDate: details.registrationCloseDate,
    registrationCloseTime: details.registrationCloseDate ? details.registrationCloseTime : "",
    paymentRequired,
    registrationFees: paymentRequired && askCategory ? fees : {},
    registrationFee: paymentRequired && !askCategory ? singleFee : 0,
    // the form is published once it has a design (after step 3 has been opened)
    ...(design ? { form: { fields, design: syncFields(design, shownFields), published: true } } : {}),
  });

  // Save an existing event from any step, staying on the page.
  const saveChanges = async () => {
    if (!eventId) return;
    if (step1Error) return toast(step1Error, "error");
    if (step2Error) return toast(step2Error, "error");
    setSaving(true);
    try {
      await updateEvent(eventId, { ...details, ...buildExtra() }, editingEvent);
      await saveNewFields(String(eventId));
      setDirty(false);
      toast("Changes saved");
    } catch (e: any) {
      toast(e?.message || "Could not save the event", "error");
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (step1Error || step2Error || !design) return;
    setSaving(true);
    try {
      const extra = buildExtra();
      let id = eventId;
      if (eventId) await updateEvent(eventId, { ...details, ...extra }, editingEvent);
      else id = (await addEvent({ ...details, extra })).id;
      await saveNewFields(String(id));
      setDirty(false);
      setSavedId(String(id));
    } catch (e: any) {
      toast(e?.message || "Could not save the event", "error");
    } finally {
      setSaving(false);
    }
  };

  const liveUrl = savedId ? `${window.location.origin}/e/${savedId}` : "";
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(liveUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the link is selectable */
    }
  };

  if (eventId && !eventsLoading && !editingEvent) {
    return (
      <div className="px-4 py-3 max-w-[1600px] mx-auto">
        <div className="rounded-xl border bg-card px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground mb-3">Event not found.</p>
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => navigate("/modules/events/all")}>Back to Events</button>
        </div>
      </div>
    );
  }

  if (savedId) {
    return (
      <div className="p-4 max-w-[720px] mx-auto">
        <div className="rounded-xl border bg-card p-6 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
            <Check className="h-6 w-6" />
          </span>
          <h1 className="text-lg font-semibold text-foreground mt-3">{eventId ? "Event updated" : "Event created"}</h1>
          <p className="text-xs text-muted-foreground mt-1">Share this link with attendees.</p>
          <div className="mt-4 flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded-md border bg-muted px-3 py-2 text-xs text-left">{liveUrl}</code>
            <button type="button" className="ui-btn ui-btn-outline ui-btn-icon" title="Copy link" onClick={copyLink}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <a className="ui-btn ui-btn-outline" href={liveUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> Open
            </a>
          </div>
          <button type="button" className="ui-btn ui-btn-primary mt-5" onClick={() => navigate("/modules/events/all")}>
            Go to Events
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
      {/* Header */}
      <div className="pb-2 border-b">
        <button type="button" onClick={leave} className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors" style={{ background: "transparent", border: 0, padding: 0 }}>
          <ArrowLeft className="h-3 w-3" /> Back to Events
        </button>
        <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight">
          {eventId ? `Edit event${details.eventName ? ` — ${details.eventName}` : ""}` : "Create event"}
        </h1>
      </div>

      {/* Stepper */}
      <div className="rounded-xl border bg-card px-4 py-3 flex items-center">
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={label} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? 1 : "0 0 auto" }}>
              <button type="button" onClick={() => goTo(i)} className="flex items-center gap-2" style={{ background: "transparent", border: 0, padding: 0 }}>
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold shrink-0"
                  style={
                    done || active
                      ? { background: "var(--primary)", color: "var(--primary-foreground)" }
                      : { background: "var(--muted-background)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }
                  }
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={`text-xs font-medium hidden sm:inline ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
              </button>
              {i < STEPS.length - 1 && <div className="flex-1 mx-3" style={{ height: 2, background: done ? "var(--primary)" : "var(--border)" }} />}
            </div>
          );
        })}
      </div>

      {!loaded ? (
        <div className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          {/* Step 1 — details + fees */}
          {step === 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
              <div className="lg:col-span-7 rounded-xl border bg-card p-4 space-y-4">
                <div className="text-sm font-semibold text-foreground">Event details</div>
                <div>
                  <label className={LABEL}>Event name *</label>
                  <input className={INPUT} value={details.eventName} onChange={(e) => set({ eventName: e.target.value })} placeholder="e.g. Annual Tech Summit 2026" maxLength={120} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>Event category</label>
                    <select className={INPUT} value={details.eventType} onChange={(e) => set({ eventType: e.target.value })}>
                      <option value="">— select —</option>
                      {(eventTypes as any[]).filter((t) => t.active !== false).map((t) => (
                        <option key={t.id} value={t.id}>{t.label || t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>Organizer</label>
                    <input className={INPUT} value={details.organizer} onChange={(e) => set({ organizer: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Short description</label>
                  <textarea className={INPUT} style={{ height: "auto", padding: "8px 12px" }} rows={2} value={details.description} onChange={(e) => set({ description: e.target.value })} maxLength={300} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>Start date *</label>
                    <DateInput className={INPUT} value={details.startDate} onChange={(e: any) => set({ startDate: e.target.value })} />
                  </div>
                  <div>
                    <label className={LABEL}>End date</label>
                    <DateInput className={INPUT} value={details.endDate} onChange={(e: any) => set({ endDate: e.target.value })} />
                  </div>
                  <div>
                    <label className={LABEL}>Start time</label>
                    <TimeInput value={details.startTime} onChange={(e: any) => set({ startTime: e.target.value })} />
                  </div>
                  <div>
                    <label className={LABEL}>End time</label>
                    <TimeInput value={details.endTime} onChange={(e: any) => set({ endTime: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className={LABEL}>Venue</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <select
                        className={INPUT}
                        style={{ paddingLeft: 32 }}
                        value={details.venue}
                        onChange={(e) => {
                          const v = venues.find((x) => x.name === e.target.value);
                          set({ venue: e.target.value, city: v ? v.city || "" : "" });
                        }}
                      >
                        <option value="">— select venue —</option>
                        {details.venue && !venues.some((v) => v.name === details.venue) && <option value={details.venue}>{details.venue}</option>}
                        {venues.map((v) => (
                          <option key={v.id} value={v.name}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                    {venues.length === 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        No venues yet — add them in <Link to="/modules/events/setup/venues" style={{ color: "var(--primary)" }}>Setup → Venue</Link>.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={LABEL}>City</label>
                    <input className={INPUT} value={details.city} readOnly placeholder="From the venue" style={{ background: "var(--muted-background)" }} />
                  </div>
                </div>
                <div style={{ maxWidth: 220 }}>
                  <label className={LABEL}>Total capacity</label>
                  <input type="number" min={0} className={INPUT} value={details.capacity} onChange={(e) => set({ capacity: Math.max(0, parseInt(e.target.value) || 0) })} />
                  <p className="text-[11px] text-muted-foreground mt-1">0 = no limit.</p>
                </div>

                <div className="pt-3 border-t">
                  <div className="text-sm font-semibold text-foreground">Form closing</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ maxWidth: 600 }}>
                    <div>
                      <label className={LABEL}>Closing date</label>
                      <DateInput className={INPUT} value={details.registrationCloseDate} onChange={(e: any) => set({ registrationCloseDate: e.target.value })} />
                    </div>
                    <div>
                      <label className={LABEL}>Closing time</label>
                      <TimeInput allowEmpty value={details.registrationCloseTime} disabled={!details.registrationCloseDate} onChange={(e: any) => set({ registrationCloseTime: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <p className="text-[11px] text-muted-foreground m-0">
                      {details.registrationCloseDate && !details.registrationCloseTime ? "No time set — closes at 11:59 PM that day." : ""}
                    </p>
                    {details.registrationCloseDate && (
                      <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => set({ registrationCloseDate: "", registrationCloseTime: "" })}>
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 rounded-xl border bg-card p-4">
                <label className="text-sm font-semibold text-foreground" style={{ display: "inline-flex", alignItems: "center", gap: 8, margin: 0, cursor: "pointer" }}>
                  <input type="checkbox" checked={paymentRequired} onChange={(e) => setPaymentRequired(e.target.checked)} />
                  <span>Registration Payment Required</span>
                </label>
                {paymentRequired && gatewayActive === false && (
                  <div className="mt-2 rounded-lg border px-3 py-2 text-xs" style={{ background: "var(--destructive-bg)", color: "var(--destructive)" }}>
                    No payment gateway is active, so the form cannot take payment — attendees will be registered as unpaid.{" "}
                    <Link to="/modules/integrations-payment" style={{ color: "var(--destructive)", fontWeight: 600, textDecoration: "underline" }}>Set up a gateway</Link>
                  </div>
                )}
                {paymentRequired && (
                  <>
                <div className="text-xs font-semibold text-foreground mt-4">Amount by attendee category</div>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">Leave 0 for a category that enters free.</p>
                {categories.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No attendee categories apply to this event. Add them in{" "}
                    <Link to="/modules/events/setup/event-categories" style={{ color: "var(--primary)" }}>Setup → Attendee Category</Link>.
                  </p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                          <th className={TH} style={{ width: 56 }}>Sr No</th>
                          <th className={TH}>Attendee category</th>
                          <th className="px-3 py-2.5 font-medium" style={{ width: 150, textAlign: "right" }}>Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((c, i) => (
                          <tr key={c.id} className="border-t">
                            <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.badgeColor || "var(--muted-foreground)" }} />
                                {c.name}
                              </span>
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="number"
                                min={0}
                                className={INPUT}
                                style={{ textAlign: "right", height: 30 }}
                                value={fees[c.name] ?? 0}
                                onChange={(e) => setFees({ ...fees, [c.name]: Math.max(0, Number(e.target.value) || 0) })}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 2 — fields */}
          {step === 1 && (
            <FieldsStep rows={rows} onChange={handleRows} takenKeys={takenKeys} categoryNames={categoryNames}>
              {paymentRequired && !askCategory && (
                <div className="mt-3 rounded-lg border p-3" style={{ background: "var(--warning-bg)" }}>
                  <div className="text-xs font-semibold" style={{ color: "var(--warning)" }}>Attendee category is not asked</div>
                  <p className="text-[11px] mt-0.5 mb-2" style={{ color: "var(--warning)" }}>
                    The category-wise amounts from step 1 cannot apply. Everyone pays the single amount below.
                  </p>
                  <div style={{ maxWidth: 200 }}>
                    <label className={LABEL}>Registration amount (₹)</label>
                    <input type="number" min={0} className={INPUT} value={singleFee} onChange={(e) => setSingleFee(Math.max(0, Number(e.target.value) || 0))} />
                  </div>
                </div>
              )}
            </FieldsStep>
          )}

          {/* Step 3 — design */}
          {step === 2 && design && <FormDesigner design={design} fields={shownFields} event={eventInfo} onChange={setDesign} onNotify={toast} />}

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button type="button" className="ui-btn ui-btn-outline" onClick={() => (step === 0 ? leave() : goTo(step - 1))}>
              {step === 0 ? "Cancel" : <><ArrowLeft className="h-3.5 w-3.5" /> Back</>}
            </button>
            {step < 2 ? (
              <div className="flex items-center gap-2">
                {eventId && (
                  <button type="button" className="ui-btn ui-btn-outline" onClick={saveChanges} disabled={saving || !dirty}>
                    {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
                  </button>
                )}
                <button type="button" className="ui-btn ui-btn-primary" onClick={() => goTo(step + 1)}>
                  Next: {STEPS[step + 1]} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button type="button" className="ui-btn ui-btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : eventId ? "Save & publish form" : "Create event & publish form"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
