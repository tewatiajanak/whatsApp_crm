import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Network } from "lucide-react";
import { pmApi } from "../../api";
import { useToast } from "../../context/ToastContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SearchInput, UIButton } from "../components/UIKit";
import { Pill } from "../user-management/shared";
import { fmtDate } from "@/utils/date";
import { PageTitle, PersonAvatar, StatTile, type Tone } from "./shared";

type Employee = {
  _id: string; name: string; email: string; mobile: string; code: string;
  designation: string; department: string; reportingManager: string; joiningDate: string;
  photo: string; status: string; teams: string[];
  openTasks: number; overdueTasks: number; projects: number;
};

/** Project Management → Team Hierarchy: who reports to whom. */
export default function TeamHierarchyPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const isMobile = useIsMobile();
  const [people, setPeople] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<Employee | null>(null);
  const firstHit = useRef<HTMLElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await pmApi.hierarchy();
        setPeople(res?.data?.employees ?? []);
      } catch (e: any) {
        toast(e?.message || "Could not load the team", "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = useMemo(() => new Map(people.map((p) => [p._id, p])), [people]);
  const childrenOf = useMemo(() => {
    const map = new Map<string, Employee[]>();
    for (const p of people) {
      if (!p.reportingManager || !byId.has(p.reportingManager)) continue;
      if (!map.has(p.reportingManager)) map.set(p.reportingManager, []);
      map.get(p.reportingManager)!.push(p);
    }
    return map;
  }, [people, byId]);
  const roots = useMemo(() => {
    const top = people.filter((p) => !p.reportingManager || !byId.has(p.reportingManager));
    // people with a team under them first
    return [...top].sort((a, b) => (childrenOf.get(b._id)?.length ? 1 : 0) - (childrenOf.get(a._id)?.length ? 1 : 0));
  }, [people, byId, childrenOf]);

  /** everyone below a person, at any depth */
  const teamSize = useMemo(() => {
    const memo = new Map<string, number>();
    const count = (id: string, trail: Set<string>): number => {
      if (memo.has(id)) return memo.get(id)!;
      if (trail.has(id)) return 0;
      trail.add(id);
      const n = (childrenOf.get(id) || []).reduce((sum, c) => sum + 1 + count(c._id, trail), 0);
      memo.set(id, n);
      return n;
    };
    people.forEach((p) => count(p._id, new Set()));
    return memo;
  }, [people, childrenOf]);

  const q = search.trim().toLowerCase();
  const hits = useMemo(
    () => new Set(q ? people.filter((p) => `${p.name} ${p.code} ${p.designation} ${p.department}`.toLowerCase().includes(q)).map((p) => p._id) : []),
    [people, q]
  );
  /** managers above a match stay open while searching */
  const forcedOpen = useMemo(() => {
    const open = new Set<string>();
    hits.forEach((id) => {
      let cur = byId.get(id)?.reportingManager || "";
      for (let i = 0; cur && byId.has(cur) && i <= people.length; i++) {
        open.add(cur);
        cur = byId.get(cur)!.reportingManager;
      }
    });
    return open;
  }, [hits, byId, people.length]);

  useEffect(() => {
    if (!q) return;
    const t = setTimeout(() => firstHit.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }), 60);
    return () => clearTimeout(t);
  }, [q, hits]);

  const isOpen = (id: string) => forcedOpen.has(id) || !closed.has(id);
  const toggle = (id: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const withReports = people.filter((p) => childrenOf.get(p._id)?.length).map((p) => p._id);

  firstHit.current = null;
  const hitRef = (id: string) => (el: HTMLElement | null) => {
    if (el && hits.has(id) && !firstHit.current) firstHit.current = el;
  };

  const renderNode = (p: Employee): React.ReactNode => {
    const kids = childrenOf.get(p._id) || [];
    const open = isOpen(p._id);
    return (
      <li key={p._id}>
        <div ref={hitRef(p._id)} className={`pm-node ${hits.has(p._id) ? "is-hit" : q ? "is-dim" : ""}`} onClick={() => setProfile(p)}>
          <PersonAvatar name={p.name} photo={p.photo} size={44} />
          <div className="mt-1.5 text-[13px] font-semibold text-foreground truncate" title={p.name}>{p.name}</div>
          <div className="text-[11px] text-muted-foreground truncate">{p.designation || "—"}</div>
          {kids.length > 0 && (
            <button type="button" className="pm-toggle" title={open ? "Collapse" : "Expand"} onClick={(e) => { e.stopPropagation(); toggle(p._id); }}>
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {teamSize.get(p._id) || 0}
            </button>
          )}
        </div>
        {kids.length > 0 && open && (
          <ul>
            {kids.map(renderNode)}
          </ul>
        )}
      </li>
    );
  };

  const renderRow = (p: Employee, depth: number): React.ReactNode => {
    const kids = childrenOf.get(p._id) || [];
    const open = isOpen(p._id);
    return (
      <Fragment key={p._id}>
        <div
          ref={hitRef(p._id)}
          className={`pm-row flex items-center gap-2.5 border-t py-2.5 pr-3 ${hits.has(p._id) ? "is-hit" : ""}`}
          style={{ paddingLeft: 12 + Math.min(depth, 6) * 18, opacity: q && !hits.has(p._id) ? 0.5 : 1 }}
          onClick={() => setProfile(p)}
        >
          {kids.length > 0 ? (
            <button type="button" className="inline-flex h-8 w-8 items-center justify-center shrink-0" style={{ background: "transparent", border: 0, color: "var(--muted-foreground)" }} title={open ? "Collapse" : "Expand"} onClick={(e) => { e.stopPropagation(); toggle(p._id); }}>
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-8 shrink-0" />
          )}
          <PersonAvatar name={p.name} photo={p.photo} size={36} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground truncate">{p.name}</div>
            <div className="text-xs text-muted-foreground truncate">{p.designation || "—"}</div>
          </div>
          {kids.length > 0 && <Pill tone="muted">{teamSize.get(p._id) || 0}</Pill>}
        </div>
        {open && kids.map((c) => renderRow(c, depth + 1))}
      </Fragment>
    );
  };

  const manager = profile ? byId.get(profile.reportingManager) : null;
  const tiles: [string, number, Tone][] = profile
    ? [
        ["Open tasks", profile.openTasks, "neutral"],
        ["Overdue", profile.overdueTasks, "danger"],
        ["Projects", profile.projects, "neutral"],
      ]
    : [];

  return (
    <>
      <PageTitle icon={<Network className="h-4 w-4" />} title="Team Hierarchy" />

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" containerClassName="flex-1 min-w-[200px] max-w-md" />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{loading ? "Loading…" : q ? `${hits.size} of ${people.length}` : people.length}</span>
          {withReports.length > 0 && (
            <>
              <UIButton size="sm" variant="outline" onClick={() => setClosed(new Set())}>Expand</UIButton>
              <UIButton size="sm" variant="outline" onClick={() => setClosed(new Set(withReports))}>Collapse</UIButton>
            </>
          )}
        </div>
      </div>

      {!loading && people.length === 0 && (
        <div className="mt-3 rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">No employees</div>
      )}

      {people.length > 0 && isMobile && (
        <div className="mt-3 rounded-xl border bg-card overflow-hidden [&>div:first-child]:border-t-0">
          {roots.map((p) => renderRow(p, 0))}
        </div>
      )}

      {people.length > 0 && !isMobile && (
        <div className="mt-3 rounded-xl border bg-card overflow-auto p-5">
          <div className="flex flex-wrap items-start gap-x-6 gap-y-8" style={{ minWidth: "max-content" }}>
            {roots.map((p) => (
              <div key={p._id} className="pm-tree">
                <ul>{renderNode(p)}</ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <Sheet open={!!profile} onOpenChange={(o) => !o && setProfile(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>{profile?.name}</SheetTitle></SheetHeader>
          {profile && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex items-center gap-3">
                <PersonAvatar name={profile.name} photo={profile.photo} size={64} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{profile.designation || "—"}</div>
                  <div className="text-xs text-muted-foreground truncate">{[profile.department, profile.code].filter(Boolean).join(" · ") || "—"}</div>
                  <div className="mt-1"><Pill tone={profile.status === "Active" ? "success" : "muted"}>{profile.status}</Pill></div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {tiles.map(([label, value, tone]) => (
                  <StatTile key={label} compact label={label} value={value} tone={tone} />
                ))}
              </div>

              <dl className="rounded-lg border divide-y text-sm">
                {([
                  ["Manager", manager?.name],
                  ["Reports", teamSize.get(profile._id) ? String(teamSize.get(profile._id)) : ""],
                  ["Email", profile.email],
                  ["Mobile", profile.mobile],
                  ["Joined", profile.joiningDate ? fmtDate(profile.joiningDate) : ""],
                ] as [string, string | undefined][]).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 px-3 py-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="m-0 text-foreground text-right truncate">{v || "—"}</dd>
                  </div>
                ))}
              </dl>

              <Link to={`/modules/projects/people/${profile._id}`} className="ui-btn ui-btn-outline w-full text-decoration-none">Performance</Link>

              {profile.teams.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {profile.teams.map((t) => <Pill key={t} tone="info">{t}</Pill>)}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
