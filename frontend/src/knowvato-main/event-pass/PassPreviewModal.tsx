import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { loadAttendeeCategories } from "../event-form/eventScope";
import PassRenderer from "./PassRenderer";
import { buildQrUrls } from "./exportPass";
import { type PassContext, type PassDesign, BASE_PASS_FIELDS, passValue } from "./schema";

/** One attendee's pass, drawn with the design saved on the event. */
export default function PassPreviewModal({ attendee, event, onClose }: { attendee: any; event: any; onClose: () => void }) {
  const design: PassDesign = event.passLayout;
  const ctx: PassContext = useMemo(
    () => ({
      event,
      attendee,
      categoryColors: Object.fromEntries(loadAttendeeCategories(event.id).map((c) => [c.name, { badge: c.badgeColor, ribbon: c.ribbonColor }])),
    }),
    [event, attendee]
  );
  const fields = useMemo(
    () => [...BASE_PASS_FIELDS, ...((event.form?.fields || []) as any[]).filter((f) => !BASE_PASS_FIELDS.some((b) => b.key === f.key)).map((f) => ({ key: f.key, label: f.label }))],
    [event]
  );
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    buildQrUrls(design, passValue(ctx, "passId")).then((u) => alive && setQrUrls(u)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [design, ctx]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15, 23, 42, 0.45)" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rounded-xl border bg-card shadow-lg flex flex-col" style={{ maxWidth: "95vw", maxHeight: "92vh" }}>
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Pass Preview</div>
            <div className="text-[11px] text-muted-foreground truncate">{attendee.name}{attendee.category ? ` · ${attendee.category}` : ""}</div>
          </div>
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" onClick={onClose} title="Close">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="p-5 overflow-auto" style={{ background: "var(--muted-background)" }}>
          <PassRenderer design={design} ctx={ctx} qrUrls={qrUrls} fields={fields} />
        </div>
      </div>
    </div>
  );
}
