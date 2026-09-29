import { Link } from "react-router-dom";
import {
  UserCircle,
  Calendar,
  Ticket,
  ListChecks,
  Bell,
  ShieldCheck,
  Award,
  FileText,
  MessageCircleQuestion,
  Clock,
  Smartphone,
  ArrowLeft,
} from "lucide-react";

const SECTIONS = [
  {
    title: "My Events",
    desc: "Upcoming and past events you've registered for — with quick buttons to view pass, agenda, join online, submit feedback, or download your certificate.",
    icon: Calendar,
  },
  {
    title: "Pass & QR",
    desc: "Full-screen QR mode with brightness hint for gate scans, download PDF / PNG, request regeneration if lost.",
    icon: Ticket,
  },
  {
    title: "My Schedule",
    desc: "Personal agenda across sessions you've registered for — add to calendar, ratings, and 'Join online' links respecting the reveal rule.",
    icon: ListChecks,
  },
  {
    title: "Alerts",
    desc: "In-app notifications and web-push opt-in — event updates, schedule changes, feedback requests, certificate ready.",
    icon: Bell,
  },
  {
    title: "Profile & Privacy",
    desc: "Profile fields with photo (used on badges), communication preferences, consent history, download-my-data, and delete request.",
    icon: UserCircle,
  },
  {
    title: "Feedback",
    desc: "Post-event and per-session feedback forms — filled in the portal, powered by the same FormRenderer as public forms.",
    icon: MessageCircleQuestion,
  },
  {
    title: "Certificates & Invoices",
    desc: "Every certificate you've earned and every invoice you've received — download PDFs and share verification links.",
    icon: Award,
  },
  {
    title: "Support",
    desc: "Open a support ticket to the event team without leaving the portal.",
    icon: FileText,
  },
];

export default function ParticipantPortalLandingPage() {
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
                <UserCircle className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Participant Portal
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Your self-service dashboard for every event you attend — passes, schedule,
                  feedback, and certificates in one place.
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
            /me route reserved — participant portal ships in Phase 14.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Login via email / phone OTP or password. Account auto-links to Participant records by
            verified email / phone. Every /me/* subpath resolves to this landing page until the
            real portal ships, so any invitation email or magic link keeps working.
          </p>
        </div>

        {/* Sections */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
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
                    <div className="text-sm font-semibold text-foreground">{s.title}</div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* PWA hint */}
        <div
          className="rounded-xl border bg-card p-4 md:p-5"
          style={{ borderColor: "color-mix(in srgb, var(--primary) 30%, var(--border))" }}
        >
          <div className="flex items-start gap-3">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0"
              style={{
                background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                color: "var(--primary)",
              }}
            >
              <Smartphone className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold text-foreground">Installable PWA</div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                The portal is installable to home screen. Your pass works offline once loaded, and
                web push alerts arrive when the tab is closed (VAPID via the Phase 11 push adapter).
              </p>
            </div>
          </div>
        </div>

        {/* Login intent */}
        <div
          className="rounded-xl border bg-card p-4 md:p-5 flex items-start gap-3"
          style={{ borderColor: "color-mix(in srgb, var(--success) 25%, transparent)" }}
        >
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0"
            style={{ background: "var(--success-bg)", color: "var(--success)" }}
          >
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">Login (Phase 14)</div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              OTP-first: enter your email or phone, receive a code, sign in. Password optional.
              Sessions honor the participant's communication preferences and quiet hours from
              Phase 11.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
