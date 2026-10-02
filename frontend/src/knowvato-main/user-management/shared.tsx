import type { ReactNode } from "react";

export type Perm = { module: string; view: boolean; create: boolean; edit: boolean; del: boolean };
export const ACTIONS = ["view", "create", "edit", "del"] as const;
export const ACTION_LABELS: Record<(typeof ACTIONS)[number], string> = { view: "View", create: "Create", edit: "Edit", del: "Delete" };

export const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  leads: "Leads",
  followups: "Follow-ups",
  chat: "Chat",
  blast: "Campaigns",
  contacts: "Contacts",
  conversion: "Conversion",
  setup: "Setup / Configuration",
  reports: "Reports",
  workflows: "Workflows",
};
export const MODULE_KEYS = Object.keys(MODULE_LABELS);

export const emptyPerm = (module: string): Perm => ({ module, view: false, create: false, edit: false, del: false });
export const fullPerm = (module: string): Perm => ({ module, view: true, create: true, edit: true, del: true });
export const permOf = (list: Perm[] | undefined, module: string): Perm | undefined => (list || []).find((p) => p.module === module);

export const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";
export const TH = "px-4 py-3 text-left font-medium";

export function Pill({ tone, children }: { tone: "success" | "info" | "warning" | "muted" | "danger"; children: ReactNode }) {
  const c = {
    success: ["var(--success-bg)", "var(--success)"],
    info: ["var(--info-bg)", "var(--info)"],
    warning: ["var(--warning-bg)", "var(--warning)"],
    danger: ["var(--destructive-bg)", "var(--destructive)"],
    muted: ["var(--muted-background)", "var(--muted-foreground)"],
  }[tone];
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap" style={{ background: c[0], color: c[1] }}>
      {children}
    </span>
  );
}

export function Toggle({ on, onChange, disabled, labels = ["On", "Off"] }: { on: boolean; onChange: () => void; disabled?: boolean; labels?: [string, string] }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={onChange} className="inline-flex items-center gap-2" style={{ background: "transparent", border: 0, padding: 0, opacity: disabled ? 0.5 : 1 }}>
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${on ? "" : "bg-muted"}`} style={on ? { background: "var(--primary)" } : undefined}>
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
      </span>
      <span className={`text-[11px] font-medium ${on ? "text-primary" : "text-muted-foreground"}`}>{on ? labels[0] : labels[1]}</span>
    </button>
  );
}

/**
 * Module × action grid of tick boxes.
 *   limit    — cells outside it cannot be ticked (the user type's ceiling)
 *   rowState — per module: is this row editable, and what to show when it is not
 */
export function PermissionMatrix({
  value,
  onChange,
  limit,
  rowLead,
  rowLocked,
  lockedValue,
  leadHeader,
}: {
  value: Perm[];
  onChange: (next: Perm[]) => void;
  limit?: Perm[];
  /** extra first cell per row (e.g. a "custom" switch) */
  rowLead?: (module: string) => ReactNode;
  leadHeader?: string;
  rowLocked?: (module: string) => boolean;
  /** what a locked row displays */
  lockedValue?: (module: string) => Perm;
}) {
  const capped = !!limit && limit.length > 0;
  const allowed = (module: string, a: (typeof ACTIONS)[number]) => !capped || !!permOf(limit, module)?.[a];
  const row = (module: string) => permOf(value, module) || emptyPerm(module);
  const set = (module: string, patch: Partial<Perm>) => {
    const next = { ...row(module), ...patch };
    onChange([...value.filter((p) => p.module !== module), next]);
  };
  const setAll = (a: (typeof ACTIONS)[number], on: boolean) =>
    onChange(MODULE_KEYS.map((m) => (rowLocked?.(m) ? row(m) : { ...row(m), [a]: on && allowed(m, a) })).filter((p) => value.some((v) => v.module === p.module) || ACTIONS.some((x) => p[x])));

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
            <th className="px-3 py-2.5 text-left font-medium">Module</th>
            {rowLead && <th className="px-3 py-2.5 font-medium" style={{ textAlign: "center", width: 90 }}>{leadHeader}</th>}
            {ACTIONS.map((a) => (
              <th key={a} className="px-3 py-2.5 font-medium" style={{ textAlign: "center", width: 74 }}>
                <button type="button" title={`Tick or clear ${ACTION_LABELS[a]} for every module`} onClick={() => setAll(a, !MODULE_KEYS.every((m) => rowLocked?.(m) || !allowed(m, a) || row(m)[a]))} style={{ background: "transparent", border: 0, padding: 0, font: "inherit", color: "inherit", textTransform: "inherit", letterSpacing: "inherit" }}>
                  {ACTION_LABELS[a]}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULE_KEYS.map((m) => {
            const locked = !!rowLocked?.(m);
            const shown = locked && lockedValue ? lockedValue(m) : row(m);
            return (
              <tr key={m} className="border-t">
                <td className="px-3 py-2">{MODULE_LABELS[m]}</td>
                {rowLead && <td className="px-3 py-2" style={{ textAlign: "center" }}>{rowLead(m)}</td>}
                {ACTIONS.map((a) => {
                  const can = allowed(m, a);
                  return (
                    <td key={a} className="px-3 py-2" style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={!!shown[a] && can}
                        disabled={locked || !can}
                        title={!can ? "Not allowed for this user type" : undefined}
                        onChange={(e) => set(m, { [a]: e.target.checked } as Partial<Perm>)}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
