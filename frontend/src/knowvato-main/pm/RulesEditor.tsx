import { useState } from "react";
import { Mail, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { UIButton } from "../components/UIKit";
import { LABEL, Toggle } from "../user-management/shared";
import MultiPicker from "./MultiPicker";
import type { Employee, Master } from "./shared";

export type Rule = {
  _id?: string; when: string; offsetValue: number; offsetUnit: "hours" | "days"; status: string | null;
  channel: "email" | "whatsapp"; template: string; recipients: string[]; roles: string[]; employees: string[]; extra: string[]; active: boolean;
};
export type RuleMeta = {
  events: Record<string, { value: string; label: string; offset?: boolean; status?: boolean }[]>;
  recipients: { value: string; label: string }[];
};
type Tpl = { _id: string; name: string; channel: string; active: boolean };

const blank = (when: string): Rule => ({ when, offsetValue: 1, offsetUnit: "days", status: null, channel: "email", template: "", recipients: [], roles: [], employees: [], extra: [], active: true });

/**
 * Auto Email / WhatsApp rules of a task, a module or a project.
 * One row per rule; the row opens in place to edit.
 */
export default function RulesEditor({
  level, value, onChange, meta, templates, employees, statuses, readOnly,
}: {
  level: "task" | "module" | "project";
  value: Rule[];
  onChange: (rules: Rule[]) => void;
  meta: RuleMeta | null;
  templates: Tpl[];
  employees: Employee[];
  statuses: Master[];
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (!meta) return null;
  const events = meta.events[level] || [];
  // recipients that need a task do not apply to module / project rules
  const skip = level === "task" ? [] : level === "module" ? ["assignee", "manager"] : ["assignee", "manager", "module_incharge"];
  const recipients = meta.recipients.filter((r) => !skip.includes(r.value));
  const set = (i: number, patch: Partial<Rule>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const labelOf = (r: Rule) => {
    const ev = events.find((e) => e.value === r.when);
    if (!ev) return r.when;
    if (ev.offset) return `${r.offsetValue} ${r.offsetUnit} ${ev.label.toLowerCase()}`;
    if (ev.status) return `${ev.label} ${statuses.find((s) => s._id === r.status)?.name || "…"}`;
    return ev.label;
  };

  return (
    <div className="space-y-2">
      {value.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">No auto messages</div>}
      {value.map((r, i) => {
        const ev = events.find((e) => e.value === r.when);
        const tpl = templates.find((t) => t._id === r.template);
        return (
          <div key={r._id || i} className="rounded-lg border">
            <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ opacity: r.active ? 1 : 0.55 }}>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md shrink-0" style={{ background: "var(--muted-background)", color: r.channel === "email" ? "var(--info)" : "var(--success)" }}>
                {r.channel === "email" ? <Mail className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground truncate">{labelOf(r)}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {tpl?.name || "—"} → {r.recipients.map((x) => meta.recipients.find((m) => m.value === x)?.label || x).join(", ") || "—"}
                </div>
              </div>
              {!readOnly && (
                <>
                  <Toggle on={r.active} onChange={() => set(i, { active: !r.active })} labels={["On", "Off"]} />
                  <UIButton size="icon-sm" variant="ghost" title="Edit" onClick={() => setOpen(open === i ? null : i)}><Pencil className="h-3.5 w-3.5" /></UIButton>
                  <UIButton size="icon-sm" variant="danger" title="Delete" onClick={() => { onChange(value.filter((_, j) => j !== i)); setOpen(null); }}><Trash2 className="h-3.5 w-3.5" /></UIButton>
                </>
              )}
            </div>

            {open === i && !readOnly && (
              <div className="border-t p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-b-lg" style={{ background: "var(--muted-background)" }}>
                <div>
                  <label className={LABEL}>Trigger *</label>
                  <select className="ui-input w-full" value={r.when} onChange={(e) => set(i, { when: e.target.value })}>
                    {events.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Recipients *</label>
                  <MultiPicker options={recipients} value={r.recipients} onChange={(v) => set(i, { recipients: v })} />
                </div>
                {ev?.offset && (
                  <>
                    <div>
                      <label className={LABEL}>Offset</label>
                      <input type="number" min={0} className="ui-input w-full" value={r.offsetValue} onChange={(e) => set(i, { offsetValue: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className={LABEL}>Unit</label>
                      <select className="ui-input w-full" value={r.offsetUnit} onChange={(e) => set(i, { offsetUnit: e.target.value as any })}>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
                  </>
                )}
                {ev?.status && (
                  <div className="sm:col-span-2">
                    <label className={LABEL}>Status *</label>
                    <select className="ui-input w-full" value={r.status || ""} onChange={(e) => set(i, { status: e.target.value || null })}>
                      <option value="">—</option>
                      {statuses.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className={LABEL}>Channel *</label>
                  <select className="ui-input w-full" value={r.channel} onChange={(e) => set(i, { channel: e.target.value as any, template: "" })}>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Template *</label>
                  <select className="ui-input w-full" value={r.template} onChange={(e) => set(i, { template: e.target.value })}>
                    <option value="">—</option>
                    {templates.filter((t) => t.channel === r.channel && (t.active || t._id === r.template)).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                  </select>
                </div>
                {r.recipients.includes("client_roles") && (
                  <div className="sm:col-span-2">
                    <label className={LABEL}>Designations (comma separated) *</label>
                    <input className="ui-input w-full" value={r.roles.join(", ")} onChange={(e) => set(i, { roles: e.target.value.split(",").map((s) => s.trimStart()) })} />
                  </div>
                )}
                {r.recipients.includes("employees") && (
                  <div className="sm:col-span-2">
                    <label className={LABEL}>Employees *</label>
                    <MultiPicker options={employees.filter((e) => e.status !== "Inactive" || r.employees.includes(e._id)).map((e) => ({ value: e._id, label: e.name }))} value={r.employees} onChange={(v) => set(i, { employees: v })} />
                  </div>
                )}
                {r.recipients.includes("extra") && (
                  <div className="sm:col-span-2">
                    <label className={LABEL}>{r.channel === "email" ? "Extra emails" : "Extra numbers"} (comma separated) *</label>
                    <input className="ui-input w-full" value={r.extra.join(", ")} onChange={(e) => set(i, { extra: e.target.value.split(",").map((s) => s.trimStart()) })} />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {!readOnly && events.length > 0 && (
        <UIButton size="sm" variant="outline" onClick={() => { onChange([...value, blank(events[0].value)]); setOpen(value.length); }} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add rule</UIButton>
      )}
    </div>
  );
}
