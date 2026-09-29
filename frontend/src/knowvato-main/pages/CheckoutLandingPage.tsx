import { Link } from "react-router-dom";
import {
  ShoppingCart,
  User,
  Building2,
  FileText,
  CreditCard,
  ShieldCheck,
  Clock,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

const STEPS = [
  {
    title: "Account",
    desc: "Sign up or log in inline — new users create an org (P2 register-organization) in the same flow.",
    icon: User,
  },
  {
    title: "Organization details",
    desc: "Name, timezone, currency, country — pre-filled from signup where possible.",
    icon: Building2,
  },
  {
    title: "Billing details",
    desc: "Legal name, address, state (for GST place of supply), GSTIN optional / required per platform settings.",
    icon: FileText,
  },
  {
    title: "Review & Pay",
    desc: "Plan summary, duration switcher (re-quotes server-side), coupon field, price breakup (subtotal → promo → coupon → CGST+SGST or IGST → total), payment method, terms checkbox, 'Pay ₹X'.",
    icon: CreditCard,
  },
];

const STATES = [
  {
    title: "Processing",
    desc: "Polls /api/v1/checkout/:id/status or listens on socket. Clear messaging if still pending after 30s with a manual 'Retry' option.",
    icon: RefreshCw,
    tone: "info",
  },
  {
    title: "Success",
    desc: "Redirects to /onboarding after webhook activates. Never activates from the browser callback alone (R20).",
    icon: CheckCircle2,
    tone: "success",
  },
  {
    title: "Failure / Pending",
    desc: "Explicit failure message from the gateway; retry button; contact-support link; no auto-charge retry unless the gateway supports it.",
    icon: ShieldCheck,
    tone: "warning",
  },
];

export default function CheckoutLandingPage() {
  return (
    <div className="crm-theme min-h-screen" style={{ background: "var(--page-bg)" }}>
      <div className="p-4 md:p-6 max-w-[1000px] mx-auto space-y-4">
        {/* Header */}
        <div className="rounded-xl border bg-card p-6 md:p-8">
          <Link
            to="/pricing"
            className="text-xs inline-flex items-center gap-1 transition-colors"
            style={{ color: "var(--muted-foreground)", textDecoration: "none" }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to pricing
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
                <ShoppingCart className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Checkout</h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  The signup → pay → activate flow that turns a pricing visitor into an active
                  organization. Server-computed totals, server-verified payments, server-side
                  activation — the browser never gets to say "I'm paid".
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
            /checkout route reserved — flow ships in Phase 15.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            URL params drive it: /checkout?plan=professional&amp;duration=yearly&amp;currency=INR.
            Each step autosaves; refresh mid-flow resumes.
          </p>
        </div>

        {/* Step rail */}
        <div className="rounded-xl border bg-card p-4 md:p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Flow</h2>
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
                      <span
                        className="w-px h-6 my-1"
                        style={{ background: "var(--border)" }}
                      />
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

        {/* Post-pay states */}
        <div className="rounded-xl border bg-card p-4 md:p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">After payment</h2>
          {STATES.map((s) => {
            const Icon = s.icon;
            const bg =
              s.tone === "success"
                ? "var(--success-bg)"
                : s.tone === "warning"
                ? "var(--warning-bg)"
                : "var(--info-bg)";
            const fg =
              s.tone === "success"
                ? "var(--success)"
                : s.tone === "warning"
                ? "var(--warning)"
                : "var(--info)";
            return (
              <div key={s.title} className="flex items-start gap-3 rounded-lg p-3 border" style={{ borderColor: "var(--border)" }}>
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0"
                  style={{ background: bg, color: fg }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{s.title}</div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Security */}
        <div
          className="rounded-xl border bg-card p-4 md:p-5"
          style={{ borderColor: "color-mix(in srgb, var(--success) 25%, transparent)" }}
        >
          <div className="flex items-start gap-3">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0"
              style={{ background: "var(--success-bg)", color: "var(--success)" }}
            >
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold text-foreground">Server-verified activation</div>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ background: "var(--success)" }} />Idempotency-Key on every checkout / verify / webhook call</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ background: "var(--success)" }} />Signature verification + gateway fetch before any state change</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ background: "var(--success)" }} />Server re-quotes final amount — client cannot tamper the price</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ background: "var(--success)" }} />Duplicate webhooks never create duplicate subscriptions or invoices</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ background: "var(--success)" }} />Every action audit-logged with actor, source, and IP</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
