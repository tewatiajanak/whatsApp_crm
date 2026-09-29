import { Link } from "react-router-dom";
import {
  Sparkles,
  Building2,
  Palette,
  CalendarPlus,
  FileText,
  IdCard,
  CreditCard,
  Megaphone,
  Users,
  UserCheck,
  CheckCircle2,
  Clock,
  ArrowLeft,
} from "lucide-react";

const STEPS = [
  { title: "Organization profile", desc: "Name, slug, logo, contact, timezone, currency, locale — pre-filled from signup.", icon: Building2 },
  { title: "Branding", desc: "Primary/secondary colors, fonts, admin app theme, email header/footer.", icon: Palette },
  { title: "First event", desc: "Mini wizard: type → basic info → date & time → location → features → review.", icon: CalendarPlus },
  { title: "Registration form", desc: "Pick a form template (Conference / Workshop / Feedback…) or start blank.", icon: FileText },
  { title: "Pass design", desc: "Pick a badge template (General / VIP / Speaker / Volunteer) or start blank.", icon: IdCard },
  { title: "Payment configuration", desc: "Connect Razorpay / Stripe (skippable — attendees still register for free events).", icon: CreditCard },
  { title: "Communication", desc: "Use the platform sender (metered) or bring your own SMTP / SendGrid / SES / Meta WhatsApp.", icon: Megaphone },
  { title: "Team users", desc: "Invite teammates with roles (Event Manager, Registration Manager, Finance, Support).", icon: Users },
  { title: "First participant", desc: "Add or self-register a test participant to confirm the whole loop.", icon: UserCheck },
];

export default function OnboardingLandingPage() {
  return (
    <div className="p-4 md:p-6 max-w-[1000px] mx-auto space-y-4">
      {/* Header */}
      <div className="rounded-xl border bg-card p-6 md:p-8">
        <Link
          to="/"
          className="text-xs inline-flex items-center gap-1 transition-colors text-muted-foreground hover:text-primary"
          style={{ textDecoration: "none" }}
        >
          <ArrowLeft className="h-3 w-3" /> Back to dashboard
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
              <Sparkles className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Onboarding Wizard</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                First-run experience for a freshly activated organization. Resumable, skippable
                for non-critical steps, with a progress bar. Post-activation destination for
                every new signup.
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

      {/* Progress placeholder */}
      <div className="rounded-xl border bg-card p-4 md:p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-foreground">Progress</div>
          <div className="text-xs text-muted-foreground">0 of {STEPS.length} — Coming in Phase 15</div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: "5%", background: "color-mix(in srgb, var(--primary) 60%, transparent)" }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="rounded-xl border bg-card p-4 md:p-5">
        <div className="space-y-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="flex items-start gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold border"
                    style={{
                      background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                      color: "var(--primary)",
                      borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
                    }}
                  >
                    {i + 1}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span className="w-px h-6 my-1" style={{ background: "var(--border)" }} />
                  )}
                </div>
                <div className="min-w-0 pb-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="text-sm font-semibold text-foreground">{s.title}</div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Done panel */}
      <div
        className="rounded-xl border bg-card p-4 md:p-5"
        style={{ borderColor: "color-mix(in srgb, var(--success) 25%, transparent)" }}
      >
        <div className="flex items-start gap-3">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0"
            style={{ background: "var(--success-bg)", color: "var(--success)" }}
          >
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">Done</div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Clean success card (no confetti — enterprise ERP tone), routes back to the
              dashboard with an onboarding-checklist card that stays visible until every step is
              marked complete. Skipped steps show a small nudge banner until they're done.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
