import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Layers,
  Search,
  Star,
  Eye,
  Wand2,
  Check,
  X,
} from "lucide-react";

type Template = {
  id: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  description: string;
  isGlobal: boolean;
  isFeatured?: boolean;
  includes: string[];
  eventTypeKey?: string;
  defaultCapacity?: number;
};

const TEMPLATES: Template[] = [
  {
    id: "corporate-conference",
    name: "Corporate Conference",
    category: "Conference",
    icon: "bi-mic",
    color: "#2249b7",
    description: "Multi-day, multi-session conference with speakers, sponsors, paid tickets, and networking. Ready to launch in minutes.",
    isGlobal: true,
    isFeatured: true,
    eventTypeKey: "conference",
    defaultCapacity: 500,
    includes: [
      "Registration form (18 fields)",
      "3 ticket tiers (Early bird / Regular / VIP)",
      "Speaker & sponsor pages",
      "Session agenda template",
      "Pass design (badge 4×3)",
      "Confirmation email + WhatsApp",
      "Feedback survey",
      "Certificate of participation",
    ],
  },
  {
    id: "school-annual-function",
    name: "School Annual Function",
    category: "School Event",
    icon: "bi-mortarboard",
    color: "#f59e0b",
    description: "Complete kit for school annual day / cultural events. Parent + student registration, seating map, and RSVP tracking.",
    isGlobal: true,
    eventTypeKey: "school-event",
    defaultCapacity: 2000,
    includes: [
      "Parent + Student registration form",
      "Free entry with QR passes",
      "Auditorium seating layout",
      "SMS + WhatsApp reminders",
      "Photo gallery section",
      "Attendance report per class",
    ],
  },
  {
    id: "webinar",
    name: "Webinar",
    category: "Webinar",
    icon: "bi-camera-video",
    color: "#0891b2",
    description: "Online-only sessions. Registration, reminder cadence, join-link reveal, attendance tracking, feedback.",
    isGlobal: true,
    isFeatured: true,
    eventTypeKey: "webinar",
    defaultCapacity: 1000,
    includes: [
      "Short registration form (6 fields)",
      "Zoom / Google Meet integration",
      "Reminder emails (24 h, 1 h, 15 min)",
      "Auto-attendance from platform",
      "Post-webinar feedback",
      "Certificate of attendance",
    ],
  },
  {
    id: "hackathon",
    name: "Hackathon",
    category: "Hackathon",
    icon: "bi-code-slash",
    color: "#7c3aed",
    description: "48-hour team hackathon with group registration, session tracks, judging, and awards.",
    isGlobal: true,
    eventTypeKey: "hackathon",
    defaultCapacity: 300,
    includes: [
      "Team registration (leader + members)",
      "Track selection (AI / Web / Mobile / Open)",
      "Judging rubric",
      "Session schedule (kickoff, mentoring, demos)",
      "Winner certificates",
      "Sponsor branding",
    ],
  },
  {
    id: "workshop",
    name: "Workshop",
    category: "Workshop",
    icon: "bi-tools",
    color: "#8b5cf6",
    description: "Hands-on workshop with capacity limits, attendance tracking, and completion certificates.",
    isGlobal: true,
    eventTypeKey: "workshop",
    defaultCapacity: 60,
    includes: [
      "Registration + waitlist",
      "Paid ticket support",
      "Session materials upload",
      "Attendance QR scan",
      "Completion certificate",
      "Feedback form",
    ],
  },
  {
    id: "exhibition",
    name: "Exhibition / Trade Show",
    category: "Exhibition",
    icon: "bi-shop-window",
    color: "#059669",
    description: "Multi-day expo with exhibitors, booths, visitor tracking, multi-gate check-in, and lead scanning.",
    isGlobal: true,
    eventTypeKey: "exhibition",
    defaultCapacity: 5000,
    includes: [
      "Visitor registration",
      "Exhibitor onboarding",
      "Booth floor map",
      "Multi-gate check-in",
      "Lead scan mode",
      "Sponsor levels",
      "Public event website",
    ],
  },
  {
    id: "sports-marathon",
    name: "Marathon / Sports Event",
    category: "Sports",
    icon: "bi-trophy",
    color: "#dc2626",
    description: "Running events with categories (5K / 10K / Half / Full), bib numbers, timing chip integration hint.",
    isGlobal: true,
    eventTypeKey: "sports-event",
    defaultCapacity: 10000,
    includes: [
      "Category-based registration",
      "Age & gender split",
      "Automatic bib numbers",
      "Paid entry fees",
      "Multi-gate check-in",
      "Medical declaration consent",
      "Finisher certificate",
    ],
  },
  {
    id: "music-concert",
    name: "Music Concert",
    category: "Music",
    icon: "bi-music-player",
    color: "#be123c",
    description: "Ticketed concert with tiered seating, gate check-in, and merchandise upsell hooks.",
    isGlobal: true,
    eventTypeKey: "music-concert",
    defaultCapacity: 3000,
    includes: [
      "Tiered seating (Front / Mid / Back)",
      "Paid tickets with Razorpay / Stripe",
      "Seat selection at checkout",
      "QR gate check-in",
      "Age verification consent",
      "Post-event social share prompt",
    ],
  },
];

const CATEGORIES = ["All", ...Array.from(new Set(TEMPLATES.map((t) => t.category)))];

export default function EventsTemplatesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [previewing, setPreviewing] = useState<Template | null>(null);

  const filtered = TEMPLATES.filter((t) => {
    if (category !== "All" && t.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${t.name} ${t.description} ${t.category}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const useTemplate = (t: Template) => {
    // Pass template metadata via query params to CreateEvent; that page can
    // read `?template=` and pre-fill in a future iteration. For now we hint
    // via the event type.
    const params = new URLSearchParams({ mode: "new" });
    if (t.eventTypeKey) params.set("typeKey", t.eventTypeKey);
    params.set("template", t.id);
    navigate(`/modules/events/create?${params.toString()}`);
  };

  return (
    <div className="p-4 max-w-[1600px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <Link
            to="/modules/events"
            className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors"
            style={{ textDecoration: "none" }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to Event Manager
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-md"
              style={{
                background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                color: "var(--primary)",
              }}
            >
              <Layers className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Event Templates</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-2xl">
            Pre-built event blueprints — forms, tickets, agenda, passes, communication — ready to
            clone into a new event in one click.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-xl border bg-card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {CATEGORIES.map((c) => {
            const active = c === category;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`inline-flex items-center h-8 px-3 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {TEMPLATES.length}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
            No templates match your search.
          </div>
        )}
        {filtered.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border bg-card overflow-hidden flex flex-col transition-shadow hover:shadow-md group"
          >
            {/* Banner */}
            <div
              className="h-24 flex items-center justify-center relative"
              style={{
                background: `linear-gradient(135deg, ${t.color} 0%, color-mix(in srgb, ${t.color} 60%, black) 100%)`,
              }}
            >
              <i className={`${t.icon} text-white text-4xl`} style={{ opacity: 0.9 }} />
              {t.isFeatured && (
                <span
                  className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(255,255,255,0.2)", color: "white", backdropFilter: "blur(4px)" }}
                >
                  <Star className="h-2.5 w-2.5" fill="currentColor" />
                  Featured
                </span>
              )}
            </div>
            {/* Body */}
            <div className="p-4 flex flex-col flex-1 gap-2">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm text-foreground truncate">{t.name}</h3>
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                      color: "var(--primary)",
                    }}
                  >
                    {t.isGlobal ? "Global" : "Yours"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                  {t.description}
                </p>
              </div>
              <div className="mt-auto pt-2 border-t flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewing(t)}
                  className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => useTemplate(t)}
                  className="ml-auto inline-flex items-center gap-1 h-8 px-3 text-xs font-medium rounded-md text-white shadow-sm hover:opacity-90 transition-opacity"
                  style={{ background: t.color }}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Use
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview drawer */}
      {previewing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setPreviewing(null)}>
          <div
            className="bg-card rounded-xl border shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="p-4 flex items-start gap-3 relative"
              style={{
                background: `linear-gradient(135deg, ${previewing.color} 0%, color-mix(in srgb, ${previewing.color} 60%, black) 100%)`,
                color: "white",
              }}
            >
              <button
                type="button"
                onClick={() => setPreviewing(null)}
                className="absolute top-2 right-2 h-7 w-7 rounded-md flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <i className={`${previewing.icon} text-3xl`} style={{ opacity: 0.95 }} />
              <div className="min-w-0 pr-8">
                <div className="text-xs uppercase tracking-wider opacity-80">{previewing.category}</div>
                <h2 className="text-lg font-semibold mt-0.5">{previewing.name}</h2>
                <p className="text-xs mt-1 opacity-90 leading-relaxed">{previewing.description}</p>
              </div>
            </div>
            <div className="p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                What's included
              </div>
              <ul className="space-y-2">
                {previewing.includes.map((inc) => (
                  <li key={inc} className="flex items-start gap-2 text-sm text-foreground">
                    <span
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full shrink-0 mt-0.5"
                      style={{ background: "var(--success-bg)", color: "var(--success)" }}
                    >
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    <span>{inc}</span>
                  </li>
                ))}
              </ul>
              {previewing.defaultCapacity && (
                <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
                  Suggested capacity: <strong className="text-foreground">{previewing.defaultCapacity.toLocaleString()}</strong> participants
                </div>
              )}
              <div className="mt-5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewing(null)}
                  className="flex-1 h-9 rounded-md text-sm font-medium border hover:bg-accent transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const t = previewing;
                    setPreviewing(null);
                    useTemplate(t);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-md text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
                  style={{ background: previewing.color }}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Use this template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
