import { Link } from "react-router-dom";
import {
  Shield,
  LayoutDashboard,
  Building2,
  CreditCard,
  Calendar,
  Sparkles,
  Gauge,
  Eye,
  Globe2,
  Settings,
  ArrowLeft,
  Clock,
} from "lucide-react";

type Section = {
  title: string;
  desc: string;
  icon: typeof LayoutDashboard;
  path: string;
};

const SECTIONS: Section[] = [
  {
    title: "Dashboard",
    desc: "Platform-wide KPIs: organizations, active trials, events created, revenue trend, plan distribution.",
    icon: LayoutDashboard,
    path: "/sa",
  },
  {
    title: "Organizations",
    desc: "Every org on the platform. Assign plans manually, extend validity, override limits, impersonate, suspend.",
    icon: Building2,
    path: "/sa/organizations",
  },
  {
    title: "Plans",
    desc: "Create and version subscription plans. Toggle features, set limits, mark as featured, publish new versions.",
    icon: CreditCard,
    path: "/sa/plans",
  },
  {
    title: "Billing Durations",
    desc: "Monthly, Quarterly, Half-Yearly, Yearly — or add your own (e.g. 9 Months) with save-percent labels.",
    icon: Calendar,
    path: "/sa/billing-durations",
  },
  {
    title: "Features Catalog",
    desc: "Edit display labels, categories, and paid/free defaults for every product feature code.",
    icon: Sparkles,
    path: "/sa/features",
  },
  {
    title: "Limits Catalog",
    desc: "Configure usage limits (events, participants, users, storage, emails, SMS, WhatsApp, scans) with reset periods.",
    icon: Gauge,
    path: "/sa/limits",
  },
  {
    title: "Plan Comparison Preview",
    desc: "Live pricing table that renders exactly what the public will see, with currency and duration toggles.",
    icon: Eye,
    path: "/sa/plans/preview",
  },
  {
    title: "Masters",
    desc: "Currencies, Tax Rules (GST/VAT with components), Countries & States, Languages — all edited as data.",
    icon: Globe2,
    path: "/sa/masters",
  },
  {
    title: "Platform Settings",
    desc: "General, branding, billing, access policy, trial, grace, renewal, refund, usage thresholds, security, legal.",
    icon: Settings,
    path: "/sa/settings",
  },
];

export default function SuperAdminLandingPage() {
  return (
    <div className="p-4 max-w-[1600px] mx-auto space-y-4">
      <div className="flex items-start justify-between gap-4 pb-3 border-b">
        <div className="min-w-0">
          <Link
            to="/"
            className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors"
            style={{ textDecoration: "none" }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to workspace
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <div
              className="inline-flex h-8 w-8 items-center justify-center rounded-md"
              style={{
                background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                color: "var(--primary)",
              }}
            >
              <Shield className="h-4 w-4" strokeWidth={2.2} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Super Admin
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-2xl">
            Platform-owner console for managing every organization on Knowvato, the subscription
            plans they can buy, and the billing durations and tax rules that drive pricing. This
            surface is separate from the org workspace and only platform staff should reach it.
          </p>
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
          Coming in Phase 3
        </span>
      </div>

      <div className="rounded-xl border bg-card p-4 md:p-5">
        <p className="text-sm text-foreground font-medium mb-1">
          Routes reserved — pages ship in Phase 3.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Each card below represents a planned Super Admin section. The URLs and menu structure
          are locked now so any internal notes, bookmarks, or deep-links you make today will keep
          working when the pages arrive. Phase 3 also introduces the entitlement engine that
          gates features and enforces plan limits across the whole app.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.title}
              className="rounded-xl border bg-card p-4 flex flex-col gap-3 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md shrink-0"
                  style={{
                    background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                    color: "var(--primary)",
                  }}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.2} />
                </div>
                <span
                  className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md"
                  style={{
                    background: "var(--warning-bg)",
                    color: "var(--warning)",
                  }}
                >
                  Phase 3
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">{s.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-3">
                  {s.desc}
                </p>
              </div>
              <div className="mt-auto pt-3 border-t flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span>{s.path}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  reserved
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border bg-card p-4 md:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2">What ships with Phase 3</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {[
            "Backend models: Feature, LimitDefinition, SubscriptionPlan, BillingDuration, PlanPrice, OrganizationEntitlement, UsageCounter, UsageRecord, Currency, TaxRule, Country/State, Language",
            "Entitlement engine with Redis cache, race-safe checkAndConsume, threshold events at 80/90/100%",
            "Manual plan assignment, limit overrides, impersonation (audited), organization suspension",
            "Org-side: useFeature hook, <FeatureGate>, UpgradeRequired page, UpgradeModal on PLAN_LIMIT_REACHED",
            "Configuration → Subscription & Usage page with per-limit meters",
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
  );
}
