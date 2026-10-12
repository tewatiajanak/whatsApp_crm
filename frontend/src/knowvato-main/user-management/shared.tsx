import type { ReactNode } from "react";

export type Perm = {
  module: string; view: boolean; create: boolean; edit: boolean; del: boolean;
  assign?: boolean; reassign?: boolean; approve?: boolean; export?: boolean; configure?: boolean;
};
export const BASE_ACTIONS = ["view", "create", "edit", "del"] as const;
/** Project Management actions — only the pm_* modules have them. */
export const PM_ACTIONS = ["assign", "reassign", "approve", "export", "configure"] as const;
export const ACTIONS = [...BASE_ACTIONS, ...PM_ACTIONS] as const;
export type Action = (typeof ACTIONS)[number];
export const ACTION_LABELS: Record<Action, string> = {
  view: "View", create: "Create", edit: "Edit", del: "Delete",
  assign: "Assign", reassign: "Reassign", approve: "Approve", export: "Export", configure: "Configure",
};
export const isPmModule = (module: string) => module.startsWith("pm_");
/** Does this module have this action at all? */
export const hasAction = (module: string, a: Action) => isPmModule(module) || (BASE_ACTIONS as readonly string[]).includes(a);

export const VISIBILITY_OPTIONS = [
  { value: "own", label: "Own" },
  { value: "team", label: "Team" },
  { value: "all", label: "All" },
] as const;

/** Lead fields that can be hidden from a role, or shown but locked. */
export const LEAD_FIELD_OPTIONS = [
  { value: "value", label: "Value" }, { value: "source", label: "Source" }, { value: "score", label: "Score" }, { value: "priority", label: "Priority" },
  { value: "tags", label: "Tags" }, { value: "course", label: "Course" }, { value: "city", label: "City" }, { value: "state", label: "State" },
  { value: "grade", label: "Grade" }, { value: "branch", label: "Branch" }, { value: "partner", label: "Referred by" }, { value: "lostReason", label: "Lost reason" },
  { value: "customFields", label: "Custom fields" }, { value: "utm", label: "Campaign" }, { value: "owner", label: "Owner" },
] as const;

/** Whose leads and follow-ups a role sees in the CRM. */
export const LEAD_VISIBILITY_OPTIONS = [
  { value: "own", label: "Own leads only" },
  { value: "team", label: "Team's leads + unassigned" },
  { value: "all", label: "All leads" },
] as const;

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
  pm_dashboard: "PM · Dashboard",
  pm_projects: "PM · Projects",
  pm_tasks: "PM · Tasks",
  pm_my_tasks: "PM · My Tasks",
  pm_daily_plan: "PM · Daily Plan",
  pm_team_calendar: "PM · Team Calendar",
  pm_team: "PM · Team Hierarchy",
  pm_meetings: "PM · Meetings & Trainings",
  pm_tickets: "PM · Tickets",
  pm_clients: "PM · Clients",
  pm_portal_users: "PM · Client Portal Users",
  pm_reports: "PM · Reports",
  pm_setup: "PM · Setup",
  pm_templates: "PM · Communication Templates",
  pm_notification_rules: "PM · Notification Rules",
};
export const MODULE_KEYS = Object.keys(MODULE_LABELS);

export const emptyPerm = (module: string): Perm => ({ module, view: false, create: false, edit: false, del: false });
export const fullPerm = (module: string): Perm =>
  isPmModule(module)
    ? { module, view: true, create: true, edit: true, del: true, assign: true, reassign: true, approve: true, export: true, configure: true }
    : { module, view: true, create: true, edit: true, del: true };
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
  const allowed = (module: string, a: Action) => hasAction(module, a) && (!capped || !!permOf(limit, module)?.[a]);
  const row = (module: string) => permOf(value, module) || emptyPerm(module);
  const set = (module: string, patch: Partial<Perm>) => {
    const next = { ...row(module), ...patch };
    onChange([...value.filter((p) => p.module !== module), next]);
  };
  const setAll = (a: Action, on: boolean) =>
    onChange(MODULE_KEYS.map((m) => (rowLocked?.(m) ? row(m) : { ...row(m), [a]: on && allowed(m, a) })).filter((p) => value.some((v) => v.module === p.module) || ACTIONS.some((x) => p[x])));

  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth: 760 }}>
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
            <th className="px-3 py-2.5 text-left font-medium">Module</th>
            {rowLead && <th className="px-3 py-2.5 font-medium" style={{ textAlign: "center", width: 90 }}>{leadHeader}</th>}
            {ACTIONS.map((a) => (
              <th key={a} className="px-2 py-2.5 font-medium" style={{ textAlign: "center", width: 66 }}>
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
                <td className="px-3 py-2 whitespace-nowrap">{MODULE_LABELS[m]}</td>
                {rowLead && <td className="px-3 py-2" style={{ textAlign: "center" }}>{rowLead(m)}</td>}
                {ACTIONS.map((a) => {
                  if (!hasAction(m, a)) return <td key={a} />;
                  const can = allowed(m, a);
                  return (
                    <td key={a} className="px-2 py-2" style={{ textAlign: "center" }}>
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
