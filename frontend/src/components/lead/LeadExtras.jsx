import { useRef, useState } from "react";
import { crmApi } from "../../api";
import { useApi } from "../../hooks/useApi";
import { useToast } from "../../context/ToastContext";
import { Spinner, ErrorBox, EmptyState, Chip, Confirm } from "../ui";
import DateInput from "../DateInput";
import { formatDate } from "../../utils/dateFormat";
import { labelCls } from "./leadUtils";

const DOC_KINDS = ["ID proof", "Mark sheet", "Photo", "Address proof", "Certificate", "Other"];
const fileSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/* ───────────── documents attached to a lead ───────────── */
export function Documents({ leadId, canEdit, onChanged }) {
  const toast = useToast();
  const docs = useApi(() => crmApi.documents(leadId), [leadId]);
  const [kind, setKind] = useState(DOC_KINDS[0]);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);
  const input = useRef(null);

  async function upload(files) {
    setBusy(true);
    try {
      for (const f of files) await crmApi.uploadDocument(leadId, f, kind);
      toast(files.length > 1 ? `${files.length} documents added` : "Document added");
      docs.reload();
      onChanged?.();
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }
  // the file needs the login, so it is fetched and opened as a blob rather than linked
  async function open(d) {
    try {
      const url = URL.createObjectURL(await crmApi.documentFile(leadId, d._id));
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast(e.message, "error"); }
  }

  return (
    <div className="space-y-2">
      {canEdit && (
        <div className="flex gap-2">
          <select className="ui-input flex-1" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Document type">{DOC_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={() => input.current?.click()}><i className="bi bi-upload"></i>{busy ? "Uploading…" : "Upload"}</button>
          <input ref={input} type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => { const f = [...(e.target.files || [])]; e.target.value = ""; if (f.length) upload(f); }} />
        </div>
      )}
      <ErrorBox error={docs.error} />
      {docs.loading && !docs.data ? <Spinner /> : !(docs.data || []).length ? <EmptyState icon="paperclip" text="No documents yet." /> : docs.data.map((d) => (
        <div key={d._id} className="rounded-lg border p-2.5 flex items-center gap-2.5">
          <i className={`bi bi-${d.mime?.startsWith("image/") ? "file-image" : d.mime === "application/pdf" ? "file-pdf" : "file-earmark-text"}`} style={{ color: "var(--primary)", fontSize: 18 }}></i>
          <button type="button" className="min-w-0 flex-1 text-left bg-transparent border-0 p-0" onClick={() => open(d)}>
            <div className="text-sm font-medium text-foreground truncate">{d.name}</div>
            <div className="text-[11px] text-muted-foreground">{d.category || "Document"} · {fileSize(d.size)} · {d.by} · {formatDate(d.createdAt)}</div>
          </button>
          {canEdit && <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Remove" onClick={() => setRemoving(d)}><i className="bi bi-trash"></i></button>}
        </div>
      ))}
      {removing && (
        <Confirm danger title={`Remove ${removing.name}?`} confirmLabel="Remove" busy={busy} onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            setBusy(true);
            try { await crmApi.removeDocument(leadId, removing._id); toast("Document removed"); setRemoving(null); docs.reload(); onChanged?.(); }
            catch (e) { toast(e.message, "error"); }
            finally { setBusy(false); }
          }} />
      )}
    </div>
  );
}

/* ───────────── inputs for the fields defined in CRM Settings → Custom fields ───────────── */
export function CustomFieldInputs({ fields = [], values = {}, onChange, disabled }) {
  if (!fields.length) return null;
  const options = (f) => String(f.options || "").split(/[\n,]/).map((o) => o.trim()).filter(Boolean);
  return fields.map((f) => {
    const v = values[f.key] ?? "";
    const set = (val) => onChange({ ...values, [f.key]: val });
    return (
      <div key={f.key}>
        <label className={labelCls}>{f.label}{f.required === "yes" && " *"}</label>
        {f.type === "dropdown" ? (
          <select className="ui-input w-full" disabled={disabled} value={v} onChange={(e) => set(e.target.value)}><option value="">—</option>{options(f).map((o) => <option key={o}>{o}</option>)}</select>
        ) : f.type === "date" ? (
          <DateInput className="ui-input w-full" disabled={disabled} value={v} onChange={(e) => set(e.target.value)} />
        ) : f.type === "consent" ? (
          <label className="flex items-center gap-2 text-sm text-foreground h-[34px]"><input type="checkbox" disabled={disabled} checked={v === true || v === "yes"} onChange={(e) => set(e.target.checked ? "yes" : "")} />Yes</label>
        ) : (
          <input className="ui-input w-full" disabled={disabled} type={f.type === "number" ? "number" : f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"} value={v} onChange={(e) => set(e.target.value)} />
        )}
      </div>
    );
  });
}

/** Required custom fields that are still empty — used to block saving. */
export const missingCustom = (fields = [], values = {}) => fields.filter((f) => f.required === "yes" && !String(values[f.key] ?? "").trim()).map((f) => f.label);
