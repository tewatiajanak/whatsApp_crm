import { Link, useParams } from "react-router-dom";
import {
  Search,
  Compass,
  MapPin,
  Filter,
  ArrowUpDown,
  Calendar,
  Globe2,
  Building2,
  Clock,
  ArrowLeft,
} from "lucide-react";

const FEATURES = [
  {
    title: "Search",
    desc: "Full-text search across every public event on the platform — event name, host org, venue, session titles.",
    icon: Search,
  },
  {
    title: "Filters",
    desc: "Location (city / country), category, event type, date range (Today · This week · This month · Custom), price (Free / paid range), mode (online / offline / hybrid), language.",
    icon: Filter,
  },
  {
    title: "Sort",
    desc: "Upcoming, popular, nearest — with location-aware sorting when geolocation is granted.",
    icon: ArrowUpDown,
  },
  {
    title: "Result cards",
    desc: "Banner image, date badge, title, venue / online chip, price from, host org — click through to the event's public website.",
    icon: Calendar,
  },
  {
    title: "Map view",
    desc: "Toggle to a map view for physical events; static map fallback when no maps API is configured.",
    icon: MapPin,
  },
  {
    title: "Organization pages",
    desc: "/o/:orgSlug — a public page per organization listing every public event they host, with branding.",
    icon: Building2,
  },
];

export default function DiscoveryPortalLandingPage() {
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const isOrgPage = Boolean(orgSlug);

  return (
    <div className="crm-theme min-h-screen" style={{ background: "var(--page-bg)" }}>
      <div className="p-4 md:p-6 max-w-[1200px] mx-auto space-y-4">
        {/* Header */}
        <div className="rounded-xl border bg-card p-6 md:p-8">
          <Link
            to="/"
            className="text-xs inline-flex items-center gap-1 transition-colors"
            style={{ color: "var(--muted-foreground)", textDecoration: "none" }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to workspace
          </Link>
          <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg shrink-0"
                style={{
                  background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                  color: "var(--primary)",
                }}
              >
                {isOrgPage ? (
                  <Building2 className="h-5 w-5" strokeWidth={2.2} />
                ) : (
                  <Compass className="h-5 w-5" strokeWidth={2.2} />
                )}
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {isOrgPage ? `Organization: ${orgSlug}` : "Event Discovery"}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {isOrgPage
                    ? "Public listing of every public event this organization hosts, with their branding, agenda highlights, and one-click registration."
                    : "Browse every public event on the platform — search, filter, and register in seconds."}
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
              Coming in Phase 14
            </span>
          </div>
        </div>

        {/* Route reserved */}
        <div className="rounded-xl border bg-card p-4 md:p-5">
          <p className="text-sm font-medium text-foreground mb-1">
            {isOrgPage
              ? "/o/:orgSlug route reserved — org public page ships in Phase 14."
              : "/explore route reserved — discovery portal ships in Phase 14."}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isOrgPage
              ? "The organization's branding, logo, brand colors, and their public events feed will render here from the branding + website builder pipelines."
              : "Only events with visibility=public and status=published surface here. Search is powered by the same search index that backs the Command Center."}
          </p>
        </div>

        {/* Search demo */}
        <div className="rounded-xl border bg-card p-4 md:p-5">
          <div className="rounded-lg border-2 border-dashed px-4 py-3 flex items-center gap-3 text-muted-foreground">
            <Search className="h-5 w-5 shrink-0" />
            <span className="text-sm">
              {isOrgPage
                ? "Filter this organization's events…"
                : "Search events by name, city, category, host… (disabled until Phase 14)"}
            </span>
            <span
              className="ml-auto shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border"
              style={{
                background: "var(--muted-background)",
                color: "var(--muted-foreground)",
                borderColor: "var(--border)",
              }}
            >
              <Globe2 className="h-3 w-3" /> Public
            </span>
          </div>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
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
                    <div className="text-sm font-semibold text-foreground">{f.title}</div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Platform vs org */}
        <div className="rounded-xl border bg-card p-4 md:p-5">
          <h3 className="text-sm font-semibold text-foreground mb-2">Platform vs organization discovery</h3>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {[
              "Platform discovery (/explore) is an optional feature — Super Admin can enable or disable it per platform setting.",
              "Organizations can turn on their own public listing (/o/:orgSlug) independently, using their branding and custom domain.",
              "SEO tags injected server-side so social shares (WhatsApp, LinkedIn, X) get correct preview cards.",
              "JSON-LD Event schema on every event page for Google rich results.",
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
      </div>
    </div>
  );
}
