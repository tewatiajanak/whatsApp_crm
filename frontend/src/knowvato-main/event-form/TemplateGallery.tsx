import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import FormRenderer from "./FormRenderer";
import { type EventInfo, type FormField, type FormTemplate, SYSTEM_FIELDS, applyTemplate } from "./schema";

const SAMPLE_EVENT: EventInfo = {
  eventName: "Annual Tech Summit",
  startDate: "2026-11-14",
  endDate: "2026-11-15",
  startTime: "09:00",
  endTime: "18:00",
  venue: "Grand Convention Centre",
  city: "New Delhi",
  organizer: "KnowVato Solutions",
  registrationFees: { VIP: 2500, Delegate: 1000, Student: 0 },
};
const SAMPLE_FIELDS: FormField[] = SYSTEM_FIELDS.filter((f) => f.key !== "organization");

const THUMB_W = 640;

/** A scaled-down, non-interactive picture of a template. */
export function TemplateThumb({ template, scale = 0.36, height = 230, event, fields }: { template: FormTemplate; scale?: number; height?: number; event?: EventInfo; fields?: FormField[] }) {
  const design = useMemo(() => applyTemplate(template, fields?.length ? fields : SAMPLE_FIELDS), [template, fields]);
  return (
    <div style={{ height, overflow: "hidden", background: template.theme.pageBg, pointerEvents: "none" }} aria-hidden>
      <div style={{ width: THUMB_W, transform: `scale(${scale})`, transformOrigin: "top left", marginRight: -THUMB_W }}>
        <FormRenderer design={{ ...design, theme: { ...design.theme, width: THUMB_W - 28 } }} fields={fields?.length ? fields : SAMPLE_FIELDS} event={event?.eventName ? event : SAMPLE_EVENT} mode="preview" />
      </div>
    </div>
  );
}

type Props = {
  templates: FormTemplate[];
  /** Card click (pick a template). */
  onSelect?: (t: FormTemplate) => void;
  onDelete?: (t: FormTemplate) => void;
  selectedId?: string;
  actionLabel?: string;
  event?: EventInfo;
  fields?: FormField[];
};

export default function TemplateGallery({ templates, onSelect, onDelete, selectedId, actionLabel = "Use this design", event, fields }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {templates.map((t) => (
        <div
          key={t.id}
          className="rounded-xl border bg-card overflow-hidden flex flex-col transition-shadow hover:shadow-md"
          style={selectedId === t.id ? { boxShadow: "0 0 0 2px var(--primary)" } : undefined}
        >
          <div style={{ width: "100%", overflow: "hidden" }} className="border-b">
            <TemplateThumb template={t} event={event} fields={fields} />
          </div>
          <div className="p-3 flex-1 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">{t.name}</div>
                <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{t.description}</div>
              </div>
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={t.builtIn ? { background: "var(--info-bg)", color: "var(--info)" } : { background: "var(--success-bg)", color: "var(--success)" }}
              >
                {t.builtIn ? "Built-in" : "Saved"}
              </span>
            </div>
            <div className="mt-auto flex items-center gap-2 pt-1">
              {onSelect && (
                <button type="button" className="ui-btn ui-btn-outline ui-btn-sm flex-1" onClick={() => onSelect(t)}>
                  {actionLabel}
                </button>
              )}
              {onDelete && !t.builtIn && (
                <button type="button" className="ui-btn ui-btn-danger ui-btn-sm ui-btn-icon" title="Delete template" onClick={() => onDelete(t)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
