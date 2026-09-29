import { Link, useParams } from "react-router-dom";
import {
  Award,
  CheckCircle2,
  ShieldCheck,
  Clock,
  ArrowLeft,
  Search,
} from "lucide-react";

const STATES = [
  {
    title: "Valid",
    desc: "Green card: holder name, event name, issue date, issuer, certificate number, and 'Verified by Knowvato' seal.",
    icon: CheckCircle2,
    tone: "success",
  },
  {
    title: "Revoked",
    desc: "Amber card: same holder / event / date, plus revocation reason and date. Never leak beyond minimal data.",
    icon: ShieldCheck,
    tone: "warning",
  },
  {
    title: "Not found",
    desc: "Neutral card with a manual verification-code input so the visitor can try again.",
    icon: Search,
    tone: "info",
  },
];

export default function CertificateVerifyLandingPage() {
  const { code } = useParams<{ code?: string }>();

  return (
    <div className="crm-theme min-h-screen" style={{ background: "var(--page-bg)" }}>
      <div className="p-4 md:p-6 max-w-[900px] mx-auto space-y-4">
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
                <Award className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Certificate Verification
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Every certificate carries a QR that points here — a public, branded verification
                  page that returns minimal data and never leaks PII.
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
              Coming in Phase 12
            </span>
          </div>
        </div>

        {/* Route reserved */}
        <div className="rounded-xl border bg-card p-4 md:p-5">
          <p className="text-sm font-medium text-foreground mb-1">
            /verify/:code route reserved — page ships in Phase 12.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {code
              ? `Requested verification code: ${code}. Phase 12 will look up the Certificate by verificationCode and return one of the three states below.`
              : "Direct QR scans include the code in the URL. This landing (no code) will let visitors paste a code manually."}
          </p>
        </div>

        {/* States preview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              <div key={s.title} className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-3">
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
              </div>
            );
          })}
        </div>

        {/* API note */}
        <div className="rounded-xl border bg-card p-4 md:p-5">
          <h3 className="text-sm font-semibold text-foreground mb-2">API contract</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              "GET /api/v1/public/verify/:code → { valid, status, holderName, eventName, date, issuer, certificateNumber }",
              "No PII beyond holder name and event name — no email, phone, address, custom fields",
              "Revoked certificates return status='revoked' with holder / event / date so the certificate can still be identified, plus optional revocation reason",
              "Rate-limited (verifyLimiter preset) to prevent enumeration",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span
                  className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: "var(--primary)" }}
                />
                <span className="leading-relaxed text-xs">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
