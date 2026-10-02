import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Download } from "lucide-react";
import JSZip from "jszip";
import { useToast } from "../../context/ToastContext";
import { useEventData } from "@/event-manager/context/EventDataContext";
import { UIButton } from "@/components/UIKit";
import { loadAttendeeCategories } from "../event-form/eventScope";
import PassDesigner from "../event-pass/PassDesigner";
import { canvasToBlob, passToCanvas } from "../event-pass/exportPass";
import { type PassContext, type PassDesign, type PassField, BASE_PASS_FIELDS, defaultPassDesign } from "../event-pass/schema";

/** Event → Attendees → Generate Pass: design the pass, then download it for every attendee. */
const SAMPLE = { id: "SAMPLE-PASS-0001", name: "Attendee Name", category: "", organization: "Organization", phone: "9876543210", email: "name@example.com" };
const fileSafe = (text: string, fallback: string) =>
  (text || fallback).replace(/[^a-z0-9-_ ]/gi, "").replace(/\s+/g, "-").substring(0, 80) || fallback;

export default function EventPassDesignerPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const toast = useToast() as (msg: string, type?: string) => void;
  const { events = [], eventsLoading, attendees = [], setSelectedEventId, updateEvent, markPassesGenerated } = useEventData() as any;

  // Tell the context which event is active so it loads that event's attendees
  useEffect(() => {
    if (eventId) setSelectedEventId(eventId);
  }, [eventId, setSelectedEventId]);

  const event = useMemo(() => (events as any[]).find((e) => String(e.id) === String(eventId)) || null, [events, eventId]);
  const list = useMemo(() => (attendees as any[]).filter((a) => event && a.eventId === event.id), [attendees, event]);

  const [design, setDesign] = useState<PassDesign | null>(null);
  const [savedJson, setSavedJson] = useState("");
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");

  // Start from the design saved on the event (once it has loaded)
  useEffect(() => {
    if (!event || design) return;
    const start: PassDesign = event.passLayout?.blocks ? event.passLayout : defaultPassDesign();
    setDesign(start);
    setSavedJson(event.passLayout?.blocks ? JSON.stringify(start) : "");
  }, [event, design]);

  // Values that can be placed: attendee details + this event's registration form answers
  const fields: PassField[] = useMemo(() => {
    const extra = ((event?.form?.fields || []) as any[])
      .filter((f) => f.type !== "repeater" && !BASE_PASS_FIELDS.some((b) => b.key === f.key))
      .map((f) => ({ key: f.key, label: f.label }));
    return [...BASE_PASS_FIELDS, ...extra];
  }, [event]);

  const categoryColors = useMemo(
    () => Object.fromEntries(loadAttendeeCategories(eventId).map((c) => [c.name, { badge: c.badgeColor, ribbon: c.ribbonColor }])),
    [eventId]
  );

  const safeIndex = Math.min(index, Math.max(0, list.length - 1));
  const current = list[safeIndex] || SAMPLE;
  const ctxFor = (attendee: any): PassContext => ({ event: event || {}, attendee, categoryColors });
  const dirty = !!design && JSON.stringify(design) !== savedJson;

  const save = async () => {
    if (!design || !event) return;
    setSaving(true);
    try {
      await updateEvent(event.id, { passLayout: design, passDesignSaved: true }, event);
      setSavedJson(JSON.stringify(design));
      toast("Pass design saved");
    } catch (e: any) {
      toast(e?.message || "Could not save the pass design", "error");
    } finally {
      setSaving(false);
    }
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadOne = async () => {
    if (!design) return;
    setBusy("one");
    try {
      const canvas = await passToCanvas(design, ctxFor(current), fields);
      downloadBlob(await canvasToBlob(canvas), `${fileSafe(current.name, "pass")}.png`);
    } catch (e: any) {
      toast(e?.message || "Could not create the pass image", "error");
    } finally {
      setBusy("");
    }
  };

  const downloadAll = async () => {
    if (!design || !list.length) return;
    setBusy(`0 / ${list.length}`);
    try {
      const zip = new JSZip();
      const used = new Set<string>();
      for (let i = 0; i < list.length; i++) {
        setBusy(`${i + 1} / ${list.length}`);
        const canvas = await passToCanvas(design, ctxFor(list[i]), fields);
        let name = fileSafe(list[i].name, `pass-${i + 1}`);
        if (used.has(name)) name = `${name}-${i + 1}`;
        used.add(name);
        zip.file(`${name}.png`, await canvasToBlob(canvas));
      }
      downloadBlob(await zip.generateAsync({ type: "blob" }), `${fileSafe(event.eventName, "event")}_passes.zip`);
      await markPassesGenerated(event.id);
      toast(`${list.length} passes downloaded`);
    } catch (e: any) {
      console.error(e);
      toast(e?.message || "Could not generate the passes", "error");
    } finally {
      setBusy("");
    }
  };

  if (!event) {
    return (
      <div className="px-4 py-3 max-w-[1600px] mx-auto">
        <div className="rounded-xl border bg-card px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground mb-3">{eventsLoading ? "Loading…" : "Event not found."}</p>
          {!eventsLoading && <UIButton onClick={() => navigate("/modules/events/all")}>Back to Events</UIButton>}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-2 border-b">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate(`/modules/events/${eventId}/attendees`)}
            className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors"
            style={{ background: "transparent", border: 0, padding: 0 }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to Attendees
          </button>
          <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight">Generate Pass</h1>
          <p className="text-[11px] text-muted-foreground leading-tight truncate">
            {event.eventName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UIButton variant="outline" onClick={save} loading={saving} disabled={!dirty}>
            {dirty ? "Save design" : "Design saved"}
          </UIButton>
          <UIButton onClick={downloadAll} disabled={!!busy || !list.length} leftIcon={<Download className="h-3.5 w-3.5" />}>
            {busy && busy !== "one" ? `Generating ${busy}…` : `Download all (${list.length})`}
          </UIButton>
        </div>
      </div>

      {design && (
        <PassDesigner
          design={design}
          onChange={setDesign}
          ctx={ctxFor(current)}
          fields={fields}
          onNotify={toast}
          toolbar={
            <div className="flex items-center gap-2">
              {list.length > 0 ? (
                <>
                  <UIButton size="icon-sm" variant="outline" onClick={() => setIndex(Math.max(0, safeIndex - 1))} disabled={safeIndex === 0} title="Previous attendee">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </UIButton>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {current.name || "Attendee"} · {safeIndex + 1} of {list.length}
                  </span>
                  <UIButton size="icon-sm" variant="outline" onClick={() => setIndex(Math.min(list.length - 1, safeIndex + 1))} disabled={safeIndex >= list.length - 1} title="Next attendee">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </UIButton>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">No attendees yet — showing sample details</span>
              )}
              <UIButton size="sm" variant="outline" onClick={downloadOne} disabled={!!busy} leftIcon={<Download className="h-3.5 w-3.5" />}>
                {busy === "one" ? "Preparing…" : "Download this pass"}
              </UIButton>
            </div>
          }
        />
      )}
    </div>
  );
}
