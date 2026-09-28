import { useParams } from "react-router-dom";
import {
  Mic2,
  Award,
  Store,
  Clock,
  LogIn,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";

type PortalConfig = {
  title: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  accentTint: string;
  sections: { title: string; desc: string }[];
};

const PORTALS: Record<string, PortalConfig> = {
  speaker: {
    title: "Speaker Portal",
    tagline: "Everything a speaker needs, in one place.",
    description:
      "Your dashboard for the events you're speaking at — sessions, schedule, presentation uploads, travel details, and direct messages from the event team.",
    icon: Mic2,
    accent: "var(--primary)",
    accentTint: "color-mix(in srgb, var(--primary) 12%, transparent)",
    sections: [
      { title: "My Sessions", desc: "Every talk, panel, or workshop you're on — with time, room, co-speakers, and status." },
      { title: "Schedule", desc: "Day-by-day timeline including rehearsals, green-room slots, and meal breaks." },
      { title: "Slides & Materials", desc: "Upload your deck (PDF / PPTX) and supporting files — versioned, downloadable by the event team." },
      { title: "Travel & Hotel", desc: "Fill the travel form the event has assigned to you — flights, hotel preferences, accessibility." },
      { title: "Messages", desc: "Two-way messages with the event coordinator." },
      { title: "Profile", desc: "Your bio, photo, social links, and topics — used on the event website and pass." },
    ],
  },
  sponsor: {
    title: "Sponsor Portal",
    tagline: "Manage your sponsorship, benefits, and brand placements.",
    description:
      "Your self-service dashboard for every sponsorship — package details, payment status, benefits tracker, brand asset uploads, allocated passes, and invoices.",
    icon: Award,
    accent: "var(--warning)",
    accentTint: "var(--warning-bg)",
    sections: [
      { title: "Profile & Team", desc: "Company details, contacts, and team members with portal access." },
      { title: "Package & Payments", desc: "What you paid for, what's been invoiced, upcoming payment schedule." },
      { title: "Benefits Tracker", desc: "Every benefit in your package with delivery status (e.g. logo on website, stage screen, email footer)." },
      { title: "Brand Assets", desc: "Upload logos (light / dark) and marketing materials — subject to event approval." },
      { title: "Allocated Passes", desc: "Your pass quota — assign them to guests and see who's registered." },
      { title: "Documents & Invoices", desc: "Contract, invoices, credit notes — all in one place, always downloadable." },
    ],
  },
  exhibitor: {
    title: "Exhibitor Portal",
    tagline: "Your booth, your staff, your leads.",
    description:
      "Manage your presence at the expo — booth details, staff passes, lead-scan history, package payments, and required documents.",
    icon: Store,
    accent: "var(--success)",
    accentTint: "var(--success-bg)",
    sections: [
      { title: "Company Profile", desc: "Your listing on the event website — description, logo, category." },
      { title: "Booth & Floor Map", desc: "See your allocated booth on the floor map — with size, code, and neighbors." },
      { title: "Package & Payments", desc: "Booth package details, inclusions, invoices, and payment status." },
      { title: "Staff Passes", desc: "Manage which team members can staff the booth; issue passes from your quota." },
      { title: "Leads", desc: "Every attendee scanned at your booth (only consented fields) — export to CSV." },
      { title: "Documents", desc: "Signed contracts, insurance, W9 / GST — uploads with approval status." },
    ],
  },
};

export default function PortalLandingPage() {
  const { role } = useParams<{ role: string }>();
  const config = role && PORTALS[role];

  if (!config) {
    return (
      <div className="crm-theme min-h-screen flex items-center justify-center p-6" style={{ background: "var(--page-bg)" }}>
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-foreground">Portal not found</h1>
          <p className="text-sm text-muted-foreground mt-2">
            The URL you tried does not match a known portal (speaker · sponsor · exhibitor).
          </p>
          <a
            href="/"
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            style={{ textDecoration: "none" }}
          >
            Go to workspace →
          </a>
        </div>
      </div>
    );
  }

  const Icon = config.icon;

  return (
    <div className="crm-theme min-h-screen" style={{ background: "var(--page-bg)" }}>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
        {/* Header */}
        <div className="rounded-xl border bg-card p-6 md:p-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4 min-w-0">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg shrink-0"
                style={{ background: config.accentTint, color: config.accent }}
              >
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-foreground">{config.title}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{config.tagline}</p>
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
              Coming in Phase 9
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-4 max-w-3xl leading-relaxed">
            {config.description}
          </p>
        </div>

        {/* Reserved notice */}
        <div className="rounded-xl border bg-card p-4 md:p-5">
          <p className="text-sm font-medium text-foreground mb-1">Route reserved — page ships in Phase 9.</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This landing is intentional. When Phase 9 delivers, the login and dashboard for this
            portal render at this same URL, so any invitation email or shared link keeps working
            without changes.
          </p>
        </div>

        {/* Sections grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {config.sections.map((s) => (
            <div key={s.title} className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
              <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="rounded-xl border bg-card p-4 md:p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <LogIn className="h-3.5 w-3.5" />
            <span>Portal users log in with a magic link sent by the event team.</span>
          </div>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            style={{ textDecoration: "none" }}
          >
            Back to organization workspace <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
