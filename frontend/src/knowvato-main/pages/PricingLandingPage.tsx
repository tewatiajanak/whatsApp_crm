import { Link } from "react-router-dom";
import {
  Check,
  Star,
  Clock,
  Sparkles,
  ArrowLeft,
  DollarSign,
  Table2,
  HelpCircle,
} from "lucide-react";

const DURATIONS = ["Quarterly", "Half-Yearly", "Yearly"];

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    tagline: "Get a feel for the platform",
    highlights: ["2 events", "100 participants / event", "1 user", "Email only"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Starter",
    price: "₹—",
    tagline: "Small events, small teams",
    highlights: ["10 events", "1,000 participants / event", "5 users", "Email + WhatsApp"],
    cta: "Choose plan",
    featured: false,
  },
  {
    name: "Professional",
    price: "₹—",
    tagline: "Serious event teams",
    highlights: ["Unlimited events", "10,000 participants / event", "25 users", "All channels + Pass Designer"],
    cta: "Choose plan",
    featured: true,
    badge: "Most popular",
  },
  {
    name: "Enterprise",
    price: "Contact us",
    tagline: "Custom scale + white-label",
    highlights: ["Unlimited everything", "White-label", "Custom domain", "API access + SSO"],
    cta: "Talk to sales",
    featured: false,
  },
];

export default function PricingLandingPage() {
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
                <DollarSign className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pricing</h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  Every plan · every duration · every currency — configured by the platform,
                  never hard-coded. A duration toggle, currency switcher, plan cards, and a full
                  comparison table drive customer signups here.
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
              Coming in Phase 15
            </span>
          </div>
        </div>

        {/* Route reserved */}
        <div className="rounded-xl border bg-card p-4 md:p-5">
          <p className="text-sm font-medium text-foreground mb-1">
            /pricing route reserved — page ships in Phase 15.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Plans, prices, durations, features, limits, coupons, and tax rates are all data owned
            by Super Admin (Phase 3). This page renders them at runtime — a new "18 Months"
            duration or a "YEARLY20" coupon goes live with no code change.
          </p>
        </div>

        {/* Duration toggle demo */}
        <div className="rounded-xl border bg-card p-4 md:p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-foreground">Choose your billing duration</div>
          <div
            className="inline-flex items-center rounded-lg border p-1"
            style={{ background: "var(--muted-background)", borderColor: "var(--border)" }}
          >
            {DURATIONS.map((d, i) => (
              <span
                key={d}
                className={
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors " +
                  (i === 2 ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")
                }
              >
                {d}
                {i === 2 && (
                  <span
                    className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                    style={{ background: "var(--success-bg)", color: "var(--success)" }}
                  >
                    Save 15%
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className="rounded-xl border bg-card p-4 md:p-5 flex flex-col gap-3 transition-shadow hover:shadow-sm"
              style={
                p.featured
                  ? {
                      borderColor: "color-mix(in srgb, var(--primary) 45%, var(--border))",
                      boxShadow: "0 10px 30px -20px color-mix(in srgb, var(--primary) 55%, transparent)",
                    }
                  : undefined
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{p.tagline}</div>
                </div>
                {p.badge && (
                  <span
                    className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider"
                    style={{
                      background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                      color: "var(--primary)",
                    }}
                  >
                    <Star className="h-3 w-3" fill="currentColor" />
                    {p.badge}
                  </span>
                )}
              </div>
              <div className="text-2xl font-semibold text-foreground tracking-tight">{p.price}</div>
              <ul className="space-y-1.5">
                {p.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "var(--success)" }} />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled
                className="mt-auto rounded-md text-xs font-medium px-3 py-2 opacity-60 cursor-not-allowed"
                style={{
                  background: p.featured ? "var(--primary)" : "var(--muted-background)",
                  color: p.featured ? "var(--primary-foreground)" : "var(--foreground)",
                }}
              >
                {p.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Comparison + FAQ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Table2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Comparison table</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Full feature and limit matrix, grouped by category (Registration, Ticketing, Check-in,
              Communication, Design, Analytics, Integrations, Enterprise) with ✓ / ✕ / limit values
              per plan. Accordion-per-category on mobile.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">FAQ</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Common questions on trials, refunds, plan changes, GST, custom domains, support.
              Editable by Super Admin as data, not hard-coded copy.
            </p>
          </div>
        </div>

        {/* Handoff to checkout */}
        <div className="rounded-xl border bg-card p-4 md:p-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" style={{ color: "var(--primary)" }} />
            <span>Selecting a plan handoffs to /checkout?plan=…&amp;duration=…</span>
          </div>
          <Link
            to="/checkout"
            className="text-xs inline-flex items-center gap-1"
            style={{ color: "var(--primary)", textDecoration: "none" }}
          >
            See checkout stub →
          </Link>
        </div>
      </div>
    </div>
  );
}
