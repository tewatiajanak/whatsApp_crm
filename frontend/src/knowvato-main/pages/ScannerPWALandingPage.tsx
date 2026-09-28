import { Link } from "react-router-dom";
import {
  ScanLine,
  Camera,
  Search,
  History,
  RefreshCw,
  Settings,
  WifiOff,
  Zap,
  Vibrate,
  Keyboard,
  Clock,
  ArrowLeft,
} from "lucide-react";

const CAPABILITIES = [
  {
    icon: Camera,
    title: "Camera-first scanning",
    desc: "Full-screen back camera with torch, camera switch, and 1.5s cooldown per identical code. Result overlay: green ✓ / amber ! / red ✕ with photo, name, ticket, seat, alerts.",
  },
  {
    icon: WifiOff,
    title: "Offline-first",
    desc: "Downloads an offline package (event config, allowed passes, session/meal plan) into IndexedDB. Scans work in airplane mode; queue syncs when online.",
  },
  {
    icon: Search,
    title: "Manual search",
    desc: "Big search box for name / phone / email / code. Works offline on the local package. Tap → confirm check-in.",
  },
  {
    icon: RefreshCw,
    title: "Sync & conflict handling",
    desc: "Workbox Background Sync + a manual 'Sync now' button. Same person scanned on two offline devices → first scan wins, other flagged as duplicate for review.",
  },
  {
    icon: History,
    title: "History",
    desc: "Every scan on this device with result filters — successful, duplicate, invalid, revoked.",
  },
  {
    icon: Settings,
    title: "Settings",
    desc: "Device name, sound & vibration, auto-dismiss seconds, refresh package, change gate or mode, logout.",
  },
  {
    icon: Keyboard,
    title: "Handheld / USB scanners",
    desc: "Bluetooth or USB barcode scanners (keyboard-wedge) supported via a hidden focused input. Fast keystrokes ending with Enter are captured.",
  },
  {
    icon: Vibrate,
    title: "One-handed UX",
    desc: "Primary controls in the bottom 40% of the screen. Buttons ≥ 56px. Dark theme default to save battery on long shifts.",
  },
];

const MODES = [
  { code: "Entry", desc: "Check a participant into the event." },
  { code: "Exit", desc: "Mark participant off-site (for re-entry counting)." },
  { code: "Session", desc: "Room / session check-in with eligibility + capacity." },
  { code: "Meal", desc: "Meal pass with window and per-person limit." },
  { code: "Lead", desc: "Exhibitor lead capture (consented fields only)." },
];

export default function ScannerPWALandingPage() {
  return (
    <div className="scanner-landing min-h-screen text-white" style={{ background: "#0b1220" }}>
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-6 md:py-10 space-y-6">
        {/* Header */}
        <div>
          <Link
            to="/"
            className="text-xs inline-flex items-center gap-1 transition-colors"
            style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to workspace
          </Link>
          <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg shrink-0"
                style={{ background: "rgba(88, 136, 252, 0.15)", color: "#5888fc" }}
              >
                <ScanLine className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Scanner PWA</h1>
                <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Fast, one-handed, offline-first check-in for events of 10,000+ people.
                </p>
              </div>
            </div>
            <span
              className="inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider border"
              style={{
                background: "rgba(176, 116, 0, 0.15)",
                color: "#f0b73a",
                borderColor: "rgba(240, 183, 58, 0.4)",
              }}
            >
              <Clock className="h-3 w-3" />
              Coming in Phase 10
            </span>
          </div>
        </div>

        {/* Route reserved notice */}
        <div
          className="rounded-xl p-4 md:p-5 border"
          style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
        >
          <p className="text-sm font-medium">Route reserved — installable PWA ships in Phase 10.</p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            /scan and every /scan/* subpath resolve to this page. When Phase 10 lands, gate staff
            open this URL, install to their home screen, and the real scanner replaces this
            placeholder — no invitation, no email link changes needed.
          </p>
        </div>

        {/* Modes */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" style={{ color: "#5888fc" }} />
            <h2 className="text-sm font-semibold uppercase tracking-wider">Scanning modes</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {MODES.map((m) => (
              <div
                key={m.code}
                className="rounded-lg p-3 border"
                style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
              >
                <div className="text-sm font-medium">{m.code}</div>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {m.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Capabilities */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4" style={{ color: "#5888fc" }} />
            <h2 className="text-sm font-semibold uppercase tracking-wider">Planned capabilities</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CAPABILITIES.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.title}
                  className="rounded-xl p-4 border transition-shadow hover:shadow-lg"
                  style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0"
                      style={{ background: "rgba(88, 136, 252, 0.15)", color: "#5888fc" }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{c.title}</div>
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                        {c.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Performance target */}
        <div
          className="rounded-xl p-4 md:p-5 border"
          style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
        >
          <h3 className="text-sm font-semibold">Performance targets</h3>
          <ul className="text-xs mt-3 space-y-2" style={{ color: "rgba(255,255,255,0.7)" }}>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#5888fc" }} />
              <span>Scan-to-result under 1 s while online, under 150 ms p95 at the API layer.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#5888fc" }} />
              <span>200 scans / sec sustained for 5 minutes with p95 &lt; 200 ms (k6 load test).</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#5888fc" }} />
              <span>Socket fan-out to 50 concurrent live dashboards without lag.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#5888fc" }} />
              <span>Idempotent scanId — the same scan submitted twice never double-counts.</span>
            </li>
          </ul>
        </div>

        <div className="text-center text-[11px] pt-2" style={{ color: "rgba(255,255,255,0.4)" }}>
          Admin desk-mode check-in (/modules/events/scan) is separate and still available today.
        </div>
      </div>
    </div>
  );
}
