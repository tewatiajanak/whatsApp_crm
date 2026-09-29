import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Copy,
  ArrowLeft,
  Merge,
  X,
  Check,
  Mail,
  Phone,
  Users,
  Sparkles,
  RefreshCw,
} from "lucide-react";

type Attendee = {
  id: string;
  eventId?: string;
  name?: string;
  email?: string;
  mobile?: string;
  phone?: string;
  company?: string;
  status?: string;
  createdAt?: string;
  [k: string]: any;
};

type Candidate = {
  id: string;
  a: Attendee;
  b: Attendee;
  matchedOn: string[];
  score: number;
};

const STORAGE_ATTENDEES = "em_mock_attendees";
const STORAGE_IGNORED = "em_participants_dedup_ignored";

const load = (): Attendee[] => {
  try {
    const raw = localStorage.getItem(STORAGE_ATTENDEES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const saveAttendees = (arr: Attendee[]) => {
  try {
    localStorage.setItem(STORAGE_ATTENDEES, JSON.stringify(arr));
  } catch {}
};
const loadIgnored = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_IGNORED);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const saveIgnored = (ids: string[]) => {
  try {
    localStorage.setItem(STORAGE_IGNORED, JSON.stringify(ids));
  } catch {}
};

const norm = (s?: string) => (s || "").toString().toLowerCase().trim();
const pairKey = (a: string, b: string) => [a, b].sort().join("::");

// Very simple similarity: 1.0 if equal, else count of shared 3-letter chunks / max
const nameSim = (a?: string, b?: string) => {
  const A = norm(a).replace(/[^a-z ]/g, "");
  const B = norm(b).replace(/[^a-z ]/g, "");
  if (!A || !B) return 0;
  if (A === B) return 1;
  const grams = (s: string) => new Set(Array.from({ length: Math.max(0, s.length - 2) }, (_, i) => s.slice(i, i + 3)));
  const ga = grams(A);
  const gb = grams(B);
  const inter = Array.from(ga).filter((g) => gb.has(g)).length;
  return inter / Math.max(ga.size, gb.size, 1);
};

const scan = (attendees: Attendee[], ignored: Set<string>): Candidate[] => {
  const out: Candidate[] = [];
  for (let i = 0; i < attendees.length; i++) {
    for (let j = i + 1; j < attendees.length; j++) {
      const a = attendees[i];
      const b = attendees[j];
      const matched: string[] = [];
      let score = 0;
      if (norm(a.email) && norm(a.email) === norm(b.email)) {
        matched.push("email");
        score += 0.6;
      }
      if (norm(a.mobile || a.phone) && norm(a.mobile || a.phone) === norm(b.mobile || b.phone)) {
        matched.push("phone");
        score += 0.6;
      }
      const ns = nameSim(a.name, b.name);
      if (ns >= 0.7 && norm(a.company) && norm(a.company) === norm(b.company)) {
        matched.push("name+company");
        score += ns * 0.4;
      }
      if (matched.length === 0) continue;
      const key = pairKey(a.id, b.id);
      if (ignored.has(key)) continue;
      out.push({ id: key, a, b, matchedOn: matched, score: Math.min(1, score) });
    }
  }
  return out.sort((x, y) => y.score - x.score);
};

export default function ParticipantsDuplicatesPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [mergeTarget, setMergeTarget] = useState<Candidate | null>(null);
  const [scanning, setScanning] = useState(false);

  const rescan = () => {
    setScanning(true);
    const arr = load();
    const ig = loadIgnored();
    setAttendees(arr);
    setIgnored(ig);
    setTimeout(() => {
      setCandidates(scan(arr, new Set(ig)));
      setScanning(false);
    }, 250);
  };

  useEffect(() => {
    rescan();
  }, []);

  const ignoredSet = useMemo(() => new Set(ignored), [ignored]);

  const doMerge = (c: Candidate, keepId: string) => {
    // Merge attendee `dropId` into `keepId` — combine non-empty fields, then delete dropId.
    const keep = c.a.id === keepId ? c.a : c.b;
    const drop = c.a.id === keepId ? c.b : c.a;
    const merged: Attendee = { ...drop, ...keep };
    // Fill blanks in merged from drop
    Object.keys(drop).forEach((k) => {
      if ((merged as any)[k] === undefined || (merged as any)[k] === "" || (merged as any)[k] === null) {
        (merged as any)[k] = (drop as any)[k];
      }
    });
    const next = attendees.filter((a) => a.id !== drop.id).map((a) => (a.id === keep.id ? merged : a));
    setAttendees(next);
    saveAttendees(next);
    setMergeTarget(null);
    setTimeout(rescan, 100);
  };

  const ignoreCandidate = (c: Candidate) => {
    const next = [...ignored, c.id];
    setIgnored(next);
    saveIgnored(next);
    setCandidates(candidates.filter((x) => x.id !== c.id));
  };

  const clearIgnored = () => {
    saveIgnored([]);
    setIgnored([]);
    rescan();
  };

  return (
    <div className="p-4 max-w-[1400px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <Link
            to="/modules/participants"
            className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors"
            style={{ textDecoration: "none" }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to Participants
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-md"
              style={{
                background: "color-mix(in srgb, var(--warning) 15%, transparent)",
                color: "var(--warning)",
              }}
            >
              <Copy className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Duplicates</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Suspected duplicate participants matched by email, phone, and fuzzy name + company.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ignored.length > 0 && (
            <button
              type="button"
              onClick={clearIgnored}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium hover:bg-accent text-muted-foreground"
            >
              Clear {ignored.length} ignored
            </button>
          )}
          <button
            type="button"
            onClick={rescan}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-medium text-white shadow-sm"
            style={{ background: "var(--primary)" }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
            Rescan
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Scanned participants", value: attendees.length, color: "var(--primary)" },
          { label: "Duplicate pairs", value: candidates.length, color: "var(--warning)" },
          { label: "Ignored pairs", value: ignored.length, color: "var(--muted-foreground)" },
          {
            label: "High confidence",
            value: candidates.filter((c) => c.score >= 0.8).length,
            color: "var(--destructive)",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3.5">
            <div className="text-xl font-semibold text-foreground tabular-nums">{s.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Candidate list */}
      <div className="space-y-3">
        {scanning && (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 inline-block mr-2 animate-pulse" />
            Scanning for duplicates…
          </div>
        )}
        {!scanning && candidates.length === 0 && (
          <div className="rounded-xl border bg-card p-8 text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full mx-auto mb-3" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
              <Check className="h-5 w-5" />
            </div>
            <div className="text-sm font-medium text-foreground">All clear</div>
            <div className="text-xs text-muted-foreground mt-1">
              No duplicate participants found across your workspace.
            </div>
          </div>
        )}
        {candidates.map((c) => (
          <div key={c.id} className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b" style={{ background: "var(--muted-background)" }}>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground uppercase tracking-wider">Matched on</span>
                {c.matchedOn.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center px-2 py-0.5 rounded font-medium"
                    style={{
                      background: "color-mix(in srgb, var(--warning) 15%, transparent)",
                      color: "var(--warning)",
                    }}
                  >
                    {m}
                  </span>
                ))}
                <span className="text-muted-foreground ml-2">
                  score: <span className="text-foreground font-medium">{Math.round(c.score * 100)}%</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => ignoreCandidate(c)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Ignore
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
              {[c.a, c.b].map((p) => (
                <div key={p.id} className="p-4 space-y-2">
                  <div className="font-semibold text-foreground text-sm">
                    {p.name || <span className="italic text-muted-foreground">Anonymous</span>}
                  </div>
                  <div className="space-y-1 text-xs">
                    {p.email && (
                      <div className="inline-flex items-center gap-1 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span>{p.email}</span>
                      </div>
                    )}
                    {(p.mobile || p.phone) && (
                      <div className="inline-flex items-center gap-1 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{p.mobile || p.phone}</span>
                      </div>
                    )}
                    {p.company && (
                      <div className="inline-flex items-center gap-1 text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{p.company}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Created {p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN") : "—"}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t flex items-center justify-end gap-2 bg-accent/10">
              <button
                type="button"
                onClick={() => setMergeTarget(c)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-primary-foreground shadow-sm"
                style={{ background: "var(--primary)" }}
              >
                <Merge className="h-3.5 w-3.5" />
                Merge…
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Merge modal */}
      {mergeTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setMergeTarget(null)}>
          <div className="bg-card rounded-xl border shadow-2xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-foreground">Merge duplicates</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Choose the profile to keep. All registrations and fields from the other one will be preserved on the survivor.
                </div>
              </div>
              <button type="button" onClick={() => setMergeTarget(null)} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[mergeTarget.a, mergeTarget.b].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => doMerge(mergeTarget, p.id)}
                  className="text-left rounded-lg border p-3 hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <div className="text-sm font-semibold text-foreground">{p.name || "Anonymous"}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{p.email || p.mobile || p.phone}</div>
                  <div className="mt-2 text-[11px] text-primary font-medium">Keep this one →</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
