import { Command, Sparkles, Zap, Clock, Search as SearchIcon, Keyboard, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const RESULT_GROUPS = [
  {
    title: "Entities",
    desc: "Events, participants, registrations, orders, payments, invoices, speakers, sponsors, exhibitors, sessions, certificates, tasks, forms, templates.",
    icon: SearchIcon,
  },
  {
    title: "Actions",
    desc: "Create Event, Add Participant, Create Form, Generate Passes, Scan QR, Send Communication, Create Session, Import Participants, Export Report.",
    icon: Zap,
  },
  {
    title: "Navigation",
    desc: "Every menu item — jump anywhere in one keystroke.",
    icon: ArrowRight,
  },
  {
    title: "Smart commands",
    desc: "Intent-parsed shortcuts: 'find participant rahul', 'show today's attendance', 'export VIP participants', 'open registration form', 'generate passes'.",
    icon: Sparkles,
  },
];

export default function CommandCenterPage() {
  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto space-y-4">
      {/* Header */}
      <div className="rounded-xl border bg-card p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
              style={{
                background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                color: "var(--primary)",
              }}
            >
              <Command className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Command Center</h1>
              <p className="text-sm text-muted-foreground mt-1">
                One keystroke to any entity, action, or page. Ships as a Ctrl/Cmd+K palette on
                desktop and this full-screen search on mobile.
              </p>
            </div>
          </div>
          <span
            className="inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider border"
            style={{
              background: "var(--warning-bg)",
              color: "var(--warning)",
              borderColor: "color-mix(in srgb, var(--warning) 25%, transparent)",
            }}
          >
            <Clock className="h-3 w-3" />
            Coming in Phase 13
          </span>
        </div>
      </div>

      {/* Big search demo (visual only) */}
      <div className="rounded-xl border bg-card p-4 md:p-5">
        <div className="rounded-lg border-2 border-dashed px-4 py-3 flex items-center gap-3 text-muted-foreground">
          <SearchIcon className="h-5 w-5 shrink-0" />
          <span className="text-sm">Type to search participants, events, actions… (disabled — coming in Phase 13)</span>
          <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border bg-muted text-muted-foreground">
            <Keyboard className="h-3 w-3" /> Ctrl K
          </span>
        </div>
      </div>

      {/* Result groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {RESULT_GROUPS.map((g) => {
          const Icon = g.icon;
          return (
            <div key={g.title} className="rounded-xl border bg-card p-4">
              <div className="flex items-start gap-3">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0"
                  style={{
                    background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                    color: "var(--primary)",
                  }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{g.title}</div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{g.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* How it works */}
      <div className="rounded-xl border bg-card p-4 md:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2">How it works</h3>
        <ul className="space-y-2.5 text-sm text-muted-foreground">
          {[
            "SearchDocument collection maintained by domain events — instant lookup across every entity in the tenant",
            "Permission-aware: never surfaces entities the user cannot see (tested with IDOR suite)",
            "Recent searches + recent items shown when the palette opens",
            "Fully keyboard-operable: ↑ ↓ navigate, Enter select, Esc close",
            "Small intent parser matches natural phrases to actions with pre-filled parameters",
            "Mongo text + prefix index; Atlas Search adapter optional later",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2.5">
              <span
                className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: "var(--primary)" }}
              />
              <span className="leading-relaxed">{line}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-center">
        <Link
          to="/"
          className="text-xs text-primary hover:underline"
          style={{ textDecoration: "none" }}
        >
          Back to dashboard →
        </Link>
      </div>
    </div>
  );
}
