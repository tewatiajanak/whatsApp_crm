import { NavLink, useLocation } from "react-router-dom";
import { ListTodo } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { PageTitle } from "./shared";

/**
 * The Planner: two tabs, each with its views — [label, address, the screens whose view right shows it].
 *   My Task   — my tasks, my daily plan
 *   Team Task — the team's tasks, the team calendar (plans, tasks due, meetings, holidays)
 */
export const PLANNER: { label: string; views: [string, string, string[]][] }[] = [
  { label: "My Task", views: [["Tasks", "/modules/projects/my-work", ["my_tasks", "tasks"]], ["Daily Plan", "/modules/projects/daily-plan", ["daily_plan"]]] },
  { label: "Team Task", views: [["Tasks", "/modules/projects/tasks", ["tasks"]], ["Calendar", "/modules/projects/team-calendar", ["team_calendar"]]] },
];

/** Project Management → Planner: the title, the two tabs and the view switch of the open tab. */
export default function WorkTitle({ actions }: { actions?: React.ReactNode }) {
  const { hasRight } = useAuth() as any;
  const { pathname } = useLocation();
  const tabs = PLANNER.map((t) => ({ ...t, views: t.views.filter(([, , screens]) => screens.some((s) => hasRight(s, "view"))) })).filter((t) => t.views.length);
  const current = tabs.find((t) => t.views.some(([, to]) => to === pathname));
  return (
    <>
      <PageTitle icon={<ListTodo className="h-4 w-4" />} title="Planner" actions={actions} />
      <div className="pm-tabs">
        {tabs.map((t) => <NavLink key={t.label} to={t.views[0][1]} className={t === current ? "is-on" : ""}>{t.label}</NavLink>)}
        {current && current.views.length > 1 && (
          <span className="pm-seg">
            {current.views.map(([label, to]) => <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? "is-on" : "")}>{label}</NavLink>)}
          </span>
        )}
      </div>
    </>
  );
}
