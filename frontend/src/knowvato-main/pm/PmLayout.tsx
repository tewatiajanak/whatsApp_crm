import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Navigate, Outlet } from "react-router-dom";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import type { Employee, Master } from "./shared";
import HeaderTools from "./HeaderTools";
import "./pm.css";

/** Project Management pages, in the order they are tried as the landing page. */
const LANDING: [string, string][] = [
  ["dashboard", "/modules/projects/dashboard"],
  ["my_tasks", "/modules/projects/my-work"],
  ["projects", "/modules/projects/list"],
  ["clients", "/modules/projects/clients"],
  ["team", "/modules/projects/team"],
  ["setup", "/modules/projects/setup"],
];

/* Employees and masters are needed on almost every screen: loaded once here. */
type PmData = { employees: Employee[]; masters: Record<string, Master[]>; reload: () => void; master: (type: string, id?: string | null) => Master | null };
const Ctx = createContext<PmData>({ employees: [], masters: {}, reload: () => {}, master: () => null });
export const usePm = () => useContext(Ctx);

export default function PmLayout() {
  const { hasPm } = useAuth() as any;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [masters, setMasters] = useState<Record<string, Master[]>>({});

  const reload = useCallback(() => {
    pmApi.employees().then((r: any) => setEmployees(r?.data ?? [])).catch(() => {});
    pmApi.masters().then((r: any) => setMasters(r?.data ?? {})).catch(() => {});
  }, []);
  useEffect(() => {
    if (hasPm) reload();
  }, [hasPm, reload]);
  // the top bar has a slot for the search and quick-add buttons; it exists once the shell is on screen
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(document.getElementById("pm-header-tools"));
  }, []);

  const value = useMemo<PmData>(
    () => ({ employees, masters, reload, master: (type, id) => (masters[type] || []).find((m) => m._id === id) || null }),
    [employees, masters, reload]
  );

  if (!hasPm) return <Navigate to="/" replace />;
  return (
    <Ctx.Provider value={value}>
      {slot && createPortal(<HeaderTools />, slot)}
      <div className="md:px-4 md:py-3 max-w-[1600px] mx-auto">
        <Outlet />
      </div>
    </Ctx.Provider>
  );
}

/** /modules/projects → the first page this user may open. */
export function PmIndex() {
  const { hasRight } = useAuth() as any;
  const first = LANDING.find(([screen]) => hasRight(screen, "view"));
  return <Navigate to={first ? first[1] : "/"} replace />;
}

/** Guard for a single page: <PmGuard screen="team">…</PmGuard>. `any` = one of several screens is enough. */
export function PmGuard({ screen, any, children }: { screen?: string; any?: string[]; children: React.ReactNode }) {
  const { hasRight } = useAuth() as any;
  const allowed = any ? any.some((s) => hasRight(s, "view")) : hasRight(screen, "view");
  if (!allowed) return <Navigate to="/modules/projects" replace />;
  return <>{children}</>;
}
