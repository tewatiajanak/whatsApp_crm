import { Fragment, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Settings2, ChevronUp } from "lucide-react";
import {
  type FieldType, type FormField, type ShowWhen, type SubField,
  FIELD_TYPE_LABELS, REPEATER_MAX, SUPPORTED_FIELD_TYPES,
} from "./schema";

/**
 * Step 2 of the event wizard: choose what the registration form asks and how
 * each field behaves — rename, mandatory, default value, hidden, selection
 * limits, "show only when…" conditions and repeating groups.
 */
export type FieldRow = FormField & {
  included: boolean;
  /** Always asked (the attendee's name). */
  locked?: boolean;
  /** A Setup custom field whose type cannot be shown on a form. */
  unsupported?: boolean;
  /** Created in this wizard; saved to Setup → Custom Fields when the event is saved. */
  isNew?: boolean;
};

const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";
const INPUT = "ui-input w-full";
const SMALL = { height: 30 } as const;
const TH = "px-3 py-2.5 text-left font-medium";
const SUB_TYPES: SubField["type"][] = ["text", "number", "email", "phone", "dropdown", "date"];

export const slugKey = (text: string) =>
  text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
const splitList = (text: string) => text.split(",").map((s) => s.trim()).filter(Boolean);
const hasOptions = (r: { key: string; type: FieldType }) => r.key !== "category" && (r.type === "dropdown" || r.type === "multiselect");

/** The fields as they are saved on the event: only the ticked ones, cleaned up. */
export function rowsToFields(rows: FieldRow[], categoryNames: string[]): FormField[] {
  const included = rows.filter((r) => r.included);
  const keys = new Set(included.map((r) => r.key));
  return included.map(({ included: _i, locked, unsupported, isNew, ...f }) => ({
    ...f,
    label: f.label.trim(),
    options: f.key === "category" ? categoryNames : f.options,
    // a condition on a field that is no longer asked can never be met — drop it
    showWhen: f.showWhen?.field && keys.has(f.showWhen.field) && f.showWhen.field !== f.key ? f.showWhen : null,
  }));
}

/** First problem that stops the wizard from moving on, or "". */
export function fieldRowsError(rows: FieldRow[]): string {
  for (const r of rows.filter((x) => x.included)) {
    const name = r.label.trim() || r.key;
    if (!r.label.trim()) return "Every included field needs a label.";
    if (hasOptions(r) && !(r.options || []).length) return `Add at least one option for "${name}".`;
    if (r.hidden && r.required && !(r.defaultValue || "").trim()) return `"${name}" is hidden and mandatory, so it needs a default value.`;
    if (r.type === "multiselect") {
      const n = (r.options || []).length;
      if ((r.maxSelect || 0) > n) return `"${name}": the maximum selections cannot be more than its ${n} options.`;
      if (r.minSelect && r.maxSelect && r.minSelect > r.maxSelect) return `"${name}": minimum selections cannot be more than the maximum.`;
    }
    if (r.type === "repeater") {
      const subs = r.subFields || [];
      if (!subs.length) return `Add at least one detail to ask for each "${r.itemLabel || name}".`;
      if (subs.some((s) => !s.label.trim())) return `"${name}": every detail needs a name.`;
      const bad = subs.find((s) => s.type === "dropdown" && !(s.options || []).length);
      if (bad) return `"${name}": add options for "${bad.label}".`;
      if (r.minRows && r.maxRows && r.minRows > r.maxRows) return `"${name}": minimum cannot be more than the maximum.`;
    }
  }
  return "";
}

type NewField = { label: string; key: string; keyEdited: boolean; type: FieldType; options: string; required: boolean };
const EMPTY_FIELD: NewField = { label: "", key: "", keyEdited: false, type: "text", options: "", required: false };

type Props = {
  rows: FieldRow[];
  onChange: (rows: FieldRow[]) => void;
  /** Keys already used by any custom field of the organisation. */
  takenKeys: Set<string>;
  categoryNames: string[];
  children?: ReactNode;
};

export default function FieldsStep({ rows, onChange, takenKeys, categoryNames, children }: Props) {
  const [newField, setNewField] = useState<NewField | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const setRow = (key: string, patch: Partial<FieldRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  // Sr No: move a field to the position typed (1 = first on the form)
  const moveRow = (key: string, position: number) => {
    const from = rows.findIndex((r) => r.key === key);
    const to = Math.max(0, Math.min(rows.length - 1, (Math.floor(position) || 1) - 1));
    if (from < 0 || from === to) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const needsOptions = newField?.type === "dropdown" || newField?.type === "multiselect";
  const newFieldError = !newField
    ? ""
    : !newField.label.trim()
    ? "Enter the field name."
    : !newField.key
    ? "Enter a key (letters, numbers and _)."
    : takenKeys.has(newField.key) || rows.some((r) => r.key === newField.key)
    ? `The key "${newField.key}" is already used by another field.`
    : needsOptions && !splitList(newField.options).length
    ? "Add at least one option."
    : "";

  const addNewField = () => {
    if (!newField || newFieldError) return;
    const isRepeater = newField.type === "repeater";
    onChange([
      ...rows,
      {
        key: newField.key,
        label: newField.label.trim(),
        type: newField.type,
        required: newField.required,
        options: needsOptions ? splitList(newField.options) : [],
        included: true,
        isNew: true,
        ...(isRepeater
          ? { itemLabel: "Participant", minRows: 1, maxRows: 10, subFields: [{ key: "name", label: "Name", type: "text" as const, required: true }] }
          : {}),
      },
    ]);
    // a repeating group is not usable until its details are set — open them
    if (isRepeater) setOpenKey(newField.key);
    setNewField(null);
  };

  /** Short tags describing how a field has been set up. */
  const badges = (r: FieldRow): string[] => {
    const out: string[] = [];
    if (r.hidden) out.push("Hidden");
    if ((r.defaultValue || "").trim()) out.push(`Default: ${r.defaultValue}`);
    if (r.type === "multiselect" && (r.minSelect || r.maxSelect)) {
      out.push(r.minSelect && r.maxSelect ? (r.minSelect === r.maxSelect ? `Exactly ${r.maxSelect}` : `${r.minSelect}–${r.maxSelect}`) : r.maxSelect ? `Max ${r.maxSelect}` : `Min ${r.minSelect}`);
    }
    if (r.showWhen?.field) out.push("Conditional");
    if (r.type === "repeater") out.push(`${(r.subFields || []).length} details × up to ${r.maxRows || REPEATER_MAX}`);
    return out;
  };

  /* ── settings of one field ─────────────────────────────────────────────── */
  const renderSettings = (r: FieldRow) => {
    const others = rows.filter((x) => x.included && x.key !== r.key && !x.hidden);
    const w: ShowWhen = r.showWhen || { field: "", op: "is", value: "" };
    const ctrl = others.find((x) => x.key === w.field);
    const ctrlOptions = ctrl ? (ctrl.key === "category" ? categoryNames : ctrl.type === "consent" ? ["yes", "no"] : ctrl.options || []) : [];
    const setWhen = (patch: Partial<ShowWhen>) => setRow(r.key, { showWhen: { ...w, ...patch } });
    const subs = r.subFields || [];
    const setSub = (i: number, patch: Partial<SubField>) => setRow(r.key, { subFields: subs.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
    const fieldOptions = r.key === "category" ? categoryNames : r.options || [];

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {hasOptions(r) && (
            <div className="sm:col-span-2">
              <label className={LABEL}>Options (comma-separated) *</label>
              <input
                className={INPUT}
                style={SMALL}
                key={`${r.key}-opts`}
                defaultValue={(r.options || []).join(", ")}
                onBlur={(e) => setRow(r.key, { options: splitList(e.target.value) })}
              />
            </div>
          )}

          {r.type === "multiselect" && (
            <>
              <div>
                <label className={LABEL}>Minimum selections</label>
                <input type="number" min={0} className={INPUT} style={SMALL} value={r.minSelect || 0} onChange={(e) => setRow(r.key, { minSelect: Math.max(0, parseInt(e.target.value) || 0) })} />
              </div>
              <div>
                <label className={LABEL}>Maximum selections</label>
                <input type="number" min={0} className={INPUT} style={SMALL} value={r.maxSelect || 0} onChange={(e) => setRow(r.key, { maxSelect: Math.max(0, parseInt(e.target.value) || 0) })} />
                <p className="text-[10.5px] text-muted-foreground mt-1">0 = no limit.</p>
              </div>
            </>
          )}

          {r.type !== "repeater" && (
            <div className={r.type === "address" ? "sm:col-span-2" : ""}>
              <label className={LABEL}>Default value</label>
              {r.type === "consent" ? (
                <select className={INPUT} style={SMALL} value={/^(yes|true|1)$/i.test(r.defaultValue || "") ? "yes" : ""} onChange={(e) => setRow(r.key, { defaultValue: e.target.value })}>
                  <option value="">Not ticked</option>
                  <option value="yes">Ticked</option>
                </select>
              ) : r.type === "dropdown" ? (
                <select className={INPUT} style={SMALL} value={r.defaultValue || ""} onChange={(e) => setRow(r.key, { defaultValue: e.target.value })}>
                  <option value="">— none —</option>
                  {fieldOptions.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : r.type === "rating" ? (
                <select className={INPUT} style={SMALL} value={r.defaultValue || ""} onChange={(e) => setRow(r.key, { defaultValue: e.target.value })}>
                  <option value="">— none —</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              ) : (
                <input
                  className={INPUT}
                  style={SMALL}
                  type={r.type === "number" ? "number" : r.type === "date" ? "date" : "text"}
                  value={r.defaultValue || ""}
                  onChange={(e) => setRow(r.key, { defaultValue: e.target.value })}
                />
              )}
              {r.type === "multiselect" && <p className="text-[10.5px] text-muted-foreground mt-1">Comma-separated options to tick in advance.</p>}
            </div>
          )}

          {r.type !== "repeater" && (
            <div>
              <label className={LABEL}>Hidden</label>
              <div>
              <label className="text-xs text-foreground" style={{ display: "inline-flex", alignItems: "center", gap: 8, margin: 0, minHeight: 30 }}>
                <input type="checkbox" checked={!!r.hidden} disabled={r.locked} onChange={(e) => setRow(r.key, { hidden: e.target.checked })} />
                <span>Do not show on the form</span>
              </label>
              </div>
            </div>
          )}
        </div>

        {/* Repeating group */}
        {r.type === "repeater" && (
          <div className="rounded-lg border bg-card p-3 space-y-3">
            <div className="text-xs font-semibold text-foreground">Repeating group</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={LABEL}>Each one is called</label>
                <input className={INPUT} style={SMALL} value={r.itemLabel || ""} onChange={(e) => setRow(r.key, { itemLabel: e.target.value })} maxLength={30} />
              </div>
              <div>
                <label className={LABEL}>Minimum</label>
                <input type="number" min={0} max={REPEATER_MAX} className={INPUT} style={SMALL} value={r.minRows || 0} onChange={(e) => setRow(r.key, { minRows: Math.max(0, Math.min(REPEATER_MAX, parseInt(e.target.value) || 0)) })} />
              </div>
              <div>
                <label className={LABEL}>Maximum</label>
                <input type="number" min={1} max={REPEATER_MAX} className={INPUT} style={SMALL} value={r.maxRows || REPEATER_MAX} onChange={(e) => setRow(r.key, { maxRows: Math.max(1, Math.min(REPEATER_MAX, parseInt(e.target.value) || 1)) })} />
              </div>
            </div>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                    <th className={TH} style={{ width: 56 }}>Sr No</th>
                    <th className={TH}>Detail to ask</th>
                    <th className={TH} style={{ width: 140 }}>Type</th>
                    <th className={TH}>Options</th>
                    <th className={TH} style={{ width: 96 }}>Mandatory</th>
                    <th className={TH} style={{ width: 48 }} />
                  </tr>
                </thead>
                <tbody>
                  {subs.map((sf, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-1.5">
                        <input
                          className={INPUT}
                          style={SMALL}
                          value={sf.label}
                          onChange={(e) => {
                            // the key follows the name until another detail already uses it
                            const key = slugKey(e.target.value) || sf.key;
                            setSub(i, { label: e.target.value, key: subs.some((x, idx) => idx !== i && x.key === key) ? sf.key : key });
                          }}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <select className={INPUT} style={SMALL} value={sf.type} onChange={(e) => setSub(i, { type: e.target.value as SubField["type"] })}>
                          {SUB_TYPES.map((t) => (
                            <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        {sf.type === "dropdown" ? (
                          <input className={INPUT} style={SMALL} key={`${r.key}-${i}-o`} defaultValue={(sf.options || []).join(", ")} onBlur={(e) => setSub(i, { options: splitList(e.target.value) })} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="checkbox" checked={sf.required} onChange={(e) => setSub(i, { required: e.target.checked })} />
                      </td>
                      <td className="px-3 py-1.5" style={{ textAlign: "right" }}>
                        <button type="button" className="ui-btn ui-btn-danger ui-btn-sm ui-btn-icon" title="Remove" onClick={() => setRow(r.key, { subFields: subs.filter((_, idx) => idx !== i) })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!subs.length && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-xs text-muted-foreground">Add the details to ask for each one.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="ui-btn ui-btn-outline ui-btn-sm"
              onClick={() => setRow(r.key, { subFields: [...subs, { key: `detail_${subs.length + 1}`, label: "", type: "text", required: false }] })}
            >
              <Plus className="h-3.5 w-3.5" /> Add detail
            </button>
          </div>
        )}

        {/* Condition */}
        {!r.locked && (
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs font-semibold text-foreground mb-2">Show only when…</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={LABEL}>Depends on</label>
                <select className={INPUT} style={SMALL} value={w.field} onChange={(e) => setRow(r.key, { showWhen: e.target.value ? { field: e.target.value, op: "is", value: "" } : null })}>
                  <option value="">Always show</option>
                  {others.map((o) => (
                    <option key={o.key} value={o.key}>{o.label || o.key}</option>
                  ))}
                </select>
              </div>
              {ctrl && (
                <>
                  <div>
                    <label className={LABEL}>Condition</label>
                    <select className={INPUT} style={SMALL} value={w.op} onChange={(e) => setWhen({ op: e.target.value as ShowWhen["op"] })}>
                      <option value="is">{ctrl.type === "multiselect" ? "includes" : "is"}</option>
                      <option value="isNot">{ctrl.type === "multiselect" ? "does not include" : "is not"}</option>
                      <option value="filled">is filled in</option>
                      <option value="empty">is empty</option>
                    </select>
                  </div>
                  {(w.op === "is" || w.op === "isNot") && (
                    <div>
                      <label className={LABEL}>Value</label>
                      {ctrlOptions.length ? (
                        <select className={INPUT} style={SMALL} value={w.value || ""} onChange={(e) => setWhen({ value: e.target.value })}>
                          <option value="">— choose —</option>
                          {ctrlOptions.map((o) => (
                            <option key={o} value={o}>{ctrl.type === "consent" ? (o === "yes" ? "Ticked" : "Not ticked") : o}</option>
                          ))}
                        </select>
                      ) : (
                        <input className={INPUT} style={SMALL} value={w.value || ""} onChange={(e) => setWhen({ value: e.target.value })} />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Form fields</div>
        </div>
        {!newField && (
          <button type="button" className="ui-btn ui-btn-outline" onClick={() => setNewField(EMPTY_FIELD)}>
            <Plus className="h-3.5 w-3.5" /> Add field
          </button>
        )}
      </div>

      {newField && (
        <div className="rounded-lg border p-3 mb-3" style={{ background: "var(--muted-background)" }}>
          <div className="text-xs font-semibold text-foreground mb-2">New field for this event</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className={LABEL}>Name *</label>
              <input
                autoFocus
                className={INPUT}
                value={newField.label}
                maxLength={60}
                onChange={(e) => setNewField({ ...newField, label: e.target.value, key: newField.keyEdited ? newField.key : slugKey(e.target.value) })}
              />
            </div>
            <div>
              <label className={LABEL}>Key *</label>
              <input
                className={INPUT}
                style={{ fontFamily: "ui-monospace, monospace" }}
                value={newField.key}
                onChange={(e) => setNewField({ ...newField, key: slugKey(e.target.value), keyEdited: true })}
              />
            </div>
            <div>
              <label className={LABEL}>Field type</label>
              <select className={INPUT} value={newField.type} onChange={(e) => setNewField({ ...newField, type: e.target.value as FieldType })}>
                {SUPPORTED_FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Options {needsOptions ? "(comma-separated) *" : ""}</label>
              <input className={INPUT} value={newField.options} disabled={!needsOptions} onChange={(e) => setNewField({ ...newField, options: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
            <label className="text-xs text-foreground" style={{ display: "inline-flex", alignItems: "center", gap: 8, margin: 0 }}>
              <input type="checkbox" checked={newField.required} onChange={(e) => setNewField({ ...newField, required: e.target.checked })} />
              <span>Mandatory on the form</span>
            </label>
            <div className="flex items-center gap-2">
              {newFieldError && newField.label && <span className="text-[11px]" style={{ color: "var(--destructive)" }}>{newFieldError}</span>}
              <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => setNewField(null)}>Cancel</button>
              <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={addNewField} disabled={!!newFieldError}>Add to form</button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className={TH} style={{ width: 76 }}>Sr No</th>
                <th className={TH} style={{ width: 60 }}>Ask</th>
                <th className={TH}>Label on the form</th>
                <th className={TH} style={{ width: 200 }}>Type</th>
                <th className={TH} style={{ width: 100 }}>Mandatory</th>
                <th className="px-3 py-2.5 font-medium" style={{ width: 96, textAlign: "right" }}>Settings</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, index) => {
                const open = openKey === r.key && r.included;
                const tags = r.included ? badges(r) : [];
                return (
                  <Fragment key={r.key}>
                    <tr className="border-t" style={r.included ? undefined : { opacity: 0.6 }}>
                      <td className="px-3 py-1.5">
                        {/* re-keyed by position so the box always shows where the field now sits */}
                        <input
                          key={`${r.key}-${index}`}
                          type="number"
                          min={1}
                          max={rows.length}
                          className={INPUT}
                          style={{ ...SMALL, width: 52, padding: "0 6px", textAlign: "center" }}
                          defaultValue={index + 1}
                          title="Position on the form"
                          onBlur={(e) => moveRow(r.key, Number(e.target.value))}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={r.included} disabled={r.locked || r.unsupported} onChange={(e) => setRow(r.key, { included: e.target.checked })} />
                      </td>
                      <td className="px-3 py-1.5">
                        <input className={INPUT} style={SMALL} value={r.label} disabled={!r.included} onChange={(e) => setRow(r.key, { label: e.target.value })} />
                        {!r.system && (
                          <div className="text-[10.5px] text-muted-foreground mt-0.5">{r.isNew ? "New · " : ""}{r.key}</div>
                        )}
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tags.map((t) => (
                              <span key={t} className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: "var(--info-bg)", color: "var(--info)" }}>{t}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.unsupported ? "Not supported on forms" : FIELD_TYPE_LABELS[r.type] || r.type}
                        {r.key === "category" && <div className="text-[10.5px] mt-0.5">{categoryNames.join(", ") || "No categories"}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={r.required} disabled={!r.included || r.locked} onChange={(e) => setRow(r.key, { required: e.target.checked })} />
                      </td>
                      <td className="px-3 py-2" style={{ textAlign: "right" }}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            className={`ui-btn ui-btn-sm ui-btn-icon ${open ? "ui-btn-primary" : "ui-btn-outline"}`}
                            title={open ? "Close settings" : "Field settings"}
                            disabled={!r.included}
                            onClick={() => setOpenKey(open ? null : r.key)}
                          >
                            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <Settings2 className="h-3.5 w-3.5" />}
                          </button>
                          {r.isNew && (
                            <button type="button" className="ui-btn ui-btn-danger ui-btn-sm ui-btn-icon" title="Remove this new field" onClick={() => onChange(rows.filter((x) => x.key !== r.key))}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={6} className="px-3 py-3" style={{ background: "var(--muted-background)" }}>
                          {renderSettings(r)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {children}
    </div>
  );
}
