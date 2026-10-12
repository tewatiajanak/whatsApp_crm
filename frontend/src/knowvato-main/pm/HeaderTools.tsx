import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Pill } from "../user-management/shared";
import { usePm } from "./PmLayout";
import QuickTask from "./QuickTask";

/** Search everything (Ctrl+K) and add a task from anywhere inside Project Management. */
export default function HeaderTools() {
  const nav = useNavigate();
  const { hasRight } = useAuth() as any;
  const { employees } = usePm();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [at, setAt] = useState(0);
  const [add, setAdd] = useState(false);
  const seq = useRef(0);
  const canAdd = hasRight("tasks", "create") || hasRight("my_tasks", "create");

  // Ctrl+K opens the search · N adds a task · / focuses the page's search box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName || "") || (e.target as HTMLElement)?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key.toLowerCase() === "n" && canAdd && !document.querySelector('[role="dialog"]')) { e.preventDefault(); setAdd(true); }
        if (e.key === "/") {
          const box = document.querySelector<HTMLInputElement>('.content input[placeholder="Search"]');
          if (box) { e.preventDefault(); box.focus(); }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canAdd]);

  useEffect(() => {
    if (!open) return;
    setAt(0);
    if (q.trim().length < 2) return setRows([]);
    const mine = ++seq.current;
    const t = setTimeout(() => pmApi.search(q.trim()).then((r: any) => mine === seq.current && setRows(r?.data ?? [])).catch(() => {}), 220);
    return () => clearTimeout(t);
  }, [q, open]);

  const go = (row: any) => {
    setOpen(false);
    setQ("");
    nav(row.link);
  };

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => setOpen(true)} title="Search (Ctrl+K)" className="pm-head-search">
        <Search className="h-3.5 w-3.5 shrink-0" /><span className="hidden md:inline">Search</span><kbd className="hidden md:inline">Ctrl K</kbd>
      </button>
      {canAdd && (
        <button type="button" onClick={() => setAdd(true)} title="Add task (N)" className="pm-head-add">
          <Plus className="h-4 w-4" />
        </button>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
        <DialogContent className="crm-theme sm:max-w-xl p-0 gap-0 overflow-hidden" style={{ top: "18%", transform: "translate(-50%, 0)" }}>
          <DialogTitle className="sr-only">Search</DialogTitle>
          <div className="flex items-center gap-2.5 border-b px-3.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setAt((i) => Math.min(rows.length - 1, i + 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setAt((i) => Math.max(0, i - 1)); }
                if (e.key === "Enter" && rows[at]) go(rows[at]);
              }}
              placeholder="Search"
              className="h-12 flex-1 bg-transparent text-sm outline-none"
              style={{ border: 0 }}
            />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
            {q.trim().length >= 2 && rows.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">No results</div>}
            {rows.map((row, i) => (
              <button key={i} type="button" onMouseEnter={() => setAt(i)} onClick={() => go(row)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left" style={{ border: 0, background: i === at ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "transparent" }}>
                <span style={{ width: 74 }} className="shrink-0"><Pill tone="muted">{row.kind}</Pill></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{row.title}</span><span className="block truncate text-[11px] text-muted-foreground">{row.sub}</span></span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      {employees && <QuickTask open={add} onClose={() => setAdd(false)} onCreated={(t) => nav(t.project ? `/modules/projects/p/${t.project}?tab=Tasks&task=${t._id}` : `/modules/projects/my-work?task=${t._id}`)} />}
    </div>
  );
}
