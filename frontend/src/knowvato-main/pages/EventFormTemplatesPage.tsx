import { useMemo, useState } from "react";
import { LayoutTemplate, X } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import FormRenderer from "../event-form/FormRenderer";
import TemplateGallery from "../event-form/TemplateGallery";
import { allTemplates, deleteSavedTemplate } from "../event-form/templateStore";
import { type FormTemplate, SYSTEM_FIELDS, applyTemplate } from "../event-form/schema";

const SAMPLE_EVENT = {
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

/** Setup → Event Form Design: the ready-made designs plus the ones you saved. */
export default function EventFormTemplatesPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const [version, setVersion] = useState(0);
  const [preview, setPreview] = useState<FormTemplate | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const templates = useMemo(() => allTemplates(), [version]);
  const saved = templates.filter((t) => !t.builtIn).length;

  const remove = (t: FormTemplate) => {
    if (!window.confirm(`Delete the saved template "${t.name}"? Events already using it keep their design.`)) return;
    deleteSavedTemplate(t.id);
    setVersion((v) => v + 1);
    toast("Template deleted");
  };

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0"
            style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}
          >
            <LayoutTemplate className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground leading-tight">Event Form Design</h2>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {templates.length - saved} built-in · {saved} saved
        </div>
      </div>

      <div className="mt-3">
        <TemplateGallery templates={templates} onSelect={setPreview} onDelete={remove} actionLabel="Preview" />
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,.45)" }} onClick={() => setPreview(null)}>
          <div className="w-full rounded-xl border bg-card shadow-lg flex flex-col overflow-hidden" style={{ maxWidth: 900, maxHeight: "92vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-foreground">{preview.name}</div>
              </div>
              <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" onClick={() => setPreview(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="overflow-y-auto">
              <FormRenderer design={applyTemplate(preview, SYSTEM_FIELDS)} fields={SYSTEM_FIELDS} event={SAMPLE_EVENT} mode="preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
