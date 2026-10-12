import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  Boxes, Building, CalendarOff, CircleDot, Flag, LayoutTemplate, GitBranch, LifeBuoy, ListChecks, MapPin, Shapes, Tags, Timer, Users2, type LucideIcon,
} from "lucide-react";
import MiniCrudPage from "../components/MiniCrudPage";
import { Pill } from "../user-management/shared";
import MasterList from "./setup/MasterList";
import StatusFlow from "./setup/StatusFlow";
import Holidays from "./setup/Holidays";
// import Settings from "./setup/Settings";
import ProductsList from "./setup/ProductsList";
// import Messaging from "./setup/Messaging";
import TemplatesPage from "./TemplatesPage";

/** A simple master: its type in the API, and the flags / numbers it carries. */
type MasterDef = { type: string; flags?: string[]; values?: string[] };
type Section = { slug: string; label: string; icon: LucideIcon; group: string; master?: MasterDef };

/** Project Management → Setup. */
const SECTIONS: Section[] = [
  { slug: "products", label: "Products", icon: Boxes, group: "Templates" },
  { slug: "project-status", label: "Project Status", icon: CircleDot, group: "Projects & Tasks", master: { type: "project_status", flags: ["isCompleted", "isOnHold", "isCancelled"] } },
  { slug: "task-status", label: "Task Status", icon: ListChecks, group: "Projects & Tasks", master: { type: "task_status", flags: ["isInitial", "isInProgress", "isCompleted", "isOnHold", "isWaitingForClient", "pausesTat"] } },
  { slug: "status-flow", label: "Status Flow", icon: GitBranch, group: "Projects & Tasks" },
  { slug: "priority", label: "Priority", icon: Flag, group: "Projects & Tasks", master: { type: "priority" } },
  { slug: "task-type", label: "Task Type", icon: Shapes, group: "Projects & Tasks", master: { type: "task_type" } },
  { slug: "work-location", label: "Work Location", icon: MapPin, group: "People", master: { type: "work_location", flags: ["isOnsite"] } },
  { slug: "meeting-type", label: "Meeting / Training Type", icon: Users2, group: "People", master: { type: "meeting_type", flags: ["isTraining"] } },
  { slug: "departments", label: "Departments", icon: Building, group: "People" },
  { slug: "ticket-category", label: "Ticket Category", icon: Tags, group: "Tickets", master: { type: "ticket_category" } },
  { slug: "ticket-status", label: "Ticket Status", icon: LifeBuoy, group: "Tickets", master: { type: "ticket_status", flags: ["isOpen", "isClosed"] } },
  { slug: "ticket-priority", label: "Ticket Priority", icon: Timer, group: "Tickets", master: { type: "ticket_priority", values: ["responseHours", "resolveHours"] } },
  { slug: "holidays", label: "Holidays", icon: CalendarOff, group: "Calendar" },
  // Settings is hidden for now. The page and its API stay.
  // { slug: "settings", label: "Settings", icon: Settings2, group: "Calendar" },
  { slug: "templates", label: "Templates", icon: LayoutTemplate, group: "Communication" },
  // Sending Settings is hidden for now (to be reviewed later). The page and its API stay.
  // { slug: "messaging", label: "Sending Settings", icon: Share2, group: "Communication" },
];
const GROUPS = [...new Set(SECTIONS.map((s) => s.group))];

function Departments() {
  return (
    <MiniCrudPage
      title="Departments"
      icon={Building}
      storageKey="pm_departments"
      endpoint="/pm/departments"
      sortKey="order"
      createLabel="Add department"
      emptyMessage="No departments"
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "order", label: "Sequence", type: "number" },
        { key: "active", label: "Active", type: "toggle" },
      ]}
      columns={[
        { key: "name", label: "Department" },
        { key: "employees", label: "Employees" },
        { key: "active", label: "Status", render: (row) => <Pill tone={row.active === false ? "muted" : "success"}>{row.active === false ? "Inactive" : "Active"}</Pill> },
      ]}
    />
  );
}

export default function PmSetupPage() {
  const { slug } = useParams();
  const nav = useNavigate();
  if (!slug) return <Navigate to={`/modules/projects/setup/${SECTIONS[0].slug}`} replace />;
  const current = SECTIONS.find((s) => s.slug === slug);
  if (!current) return <Navigate to="/modules/projects/setup" replace />;

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* phone: one dropdown · desktop: the list */}
      <select className="ui-input w-full md:hidden" value={slug} onChange={(e) => nav(`/modules/projects/setup/${e.target.value}`)}>
        {GROUPS.map((g) => (
          <optgroup key={g} label={g}>
            {SECTIONS.filter((s) => s.group === g).map((s) => <option key={s.slug} value={s.slug}>{s.label}</option>)}
          </optgroup>
        ))}
      </select>
      <nav className="hidden md:block shrink-0 rounded-xl border bg-card p-2 self-start" style={{ width: 232 }}>
        {GROUPS.map((g) => (
          <div key={g} className="mb-1.5">
            <div className="px-2 pt-1.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{g}</div>
            {SECTIONS.filter((s) => s.group === g).map((s) => {
              const Icon = s.icon;
              const active = s.slug === slug;
              return (
                <Link
                  key={s.slug}
                  to={`/modules/projects/setup/${s.slug}`}
                  className="pm-link flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px]"
                  style={(active ? { background: "var(--primary)", "--pm-link-color": "#fff" } : { "--pm-link-color": "var(--foreground)" }) as any}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{s.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        {current.master && <MasterList key={current.slug} type={current.master.type} title={current.label} icon={current.icon} flags={current.master.flags || []} values={current.master.values || []} />}
        {slug === "products" && <ProductsList />}
        {slug === "status-flow" && <StatusFlow />}
        {slug === "departments" && <Departments />}
        {slug === "holidays" && <Holidays />}
        {/* {slug === "settings" && <Settings />} */}
        {slug === "templates" && <TemplatesPage />}
        {/* {slug === "messaging" && <Messaging />} */}
      </div>
    </div>
  );
}
