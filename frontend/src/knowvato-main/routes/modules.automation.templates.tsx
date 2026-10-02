import { Link } from "react-router-dom";
import { Layers, ArrowLeft, Wand2, Eye, Check } from "lucide-react";
import { useState } from "react";

const TEMPLATES = [
  {
    id: "vip-fast-track",
    name: "VIP fast-track approval",
    trigger: "registration.created",
    category: "Registration",
    color: "#8b5cf6",
    description: "Auto-approve VIP tickets, generate the badge, and send WhatsApp confirmation immediately.",
    steps: ["Condition: ticket = VIP", "Action: approve registration", "Action: generate pass", "Action: send WhatsApp"],
  },
  {
    id: "feedback-nudge",
    name: "Feedback nudge",
    trigger: "checkin.success",
    category: "Feedback",
    color: "#0891b2",
    description: "60 minutes after check-in, email + WhatsApp the feedback form. Retry every 24h up to 3 times.",
    steps: ["Delay: 60 minutes", "Action: send email", "Action: send WhatsApp", "Condition: not submitted", "Delay: 24 hours", "Action: retry"],
  },
  {
    id: "no-show-recovery",
    name: "No-show recovery",
    trigger: "event.completed",
    category: "Engagement",
    color: "#f59e0b",
    description: "Identify no-shows, offer a discount to their next event, and add to nurture segment.",
    steps: ["Delay: 24 hours", "Condition: no check-in recorded", "Action: send apology email", "Action: create discount coupon", "Action: add to segment"],
  },
  {
    id: "payment-success-flow",
    name: "Payment success flow",
    trigger: "payment.success",
    category: "Payments",
    color: "#059669",
    description: "Send invoice email, generate pass, notify sales team, log to analytics.",
    steps: ["Action: send invoice email", "Action: generate pass", "Action: send WhatsApp", "Action: notify Slack channel"],
  },
  {
    id: "session-reminder",
    name: "Session reminder",
    trigger: "session.reminder",
    category: "Communication",
    color: "#2249b7",
    description: "15 minutes before each session, send join-link (online) or room-directions (physical).",
    steps: ["Timing: -15 minutes", "Condition: online session", "Action: send join link", "Condition: physical session", "Action: send room directions"],
  },
  {
    id: "sponsor-benefits",
    name: "Sponsor benefit tracker",
    trigger: "sponsor.confirmed",
    category: "Sponsors",
    color: "#eab308",
    description: "For each benefit in the package, create a task, assign an owner, and set the due date.",
    steps: ["Loop over benefits", "Action: create task", "Action: assign owner", "Action: set due date"],
  },
];

export default function AutomationTemplatesPage() {
  const [preview, setPreview] = useState<typeof TEMPLATES[0] | null>(null);

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <Link to="/modules/automation" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1" style={{ textDecoration: "none" }}>
            <ArrowLeft className="h-3 w-3" /> Back to Automation
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
              <Layers className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Workflow Templates</h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {TEMPLATES.map((t) => (
          <div key={t.id} className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-2" style={{ background: t.color }} />
            <div className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: t.color }}>{t.category}</div>
                  <div className="text-sm font-semibold text-foreground mt-0.5">{t.name}</div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{t.description}</p>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                Trigger: {t.trigger}
              </div>
              <div className="pt-3 border-t flex items-center gap-2">
                <button onClick={() => setPreview(t)} className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Eye className="h-3 w-3" />
                  Preview
                </button>
                <button className="ml-auto inline-flex items-center gap-1 h-8 px-3 text-xs font-medium rounded-md text-white shadow-sm" style={{ background: t.color }}>
                  <Wand2 className="h-3 w-3" />
                  Use
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="bg-card rounded-xl border shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="h-2" style={{ background: preview.color }} />
            <div className="p-5 space-y-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: preview.color }}>{preview.category}</div>
                <h2 className="text-lg font-semibold text-foreground mt-0.5">{preview.name}</h2>
                <p className="text-xs text-muted-foreground mt-1">{preview.description}</p>
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pt-3 border-t">Steps</div>
              <div className="space-y-1.5">
                {preview.steps.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full shrink-0 mt-0.5 text-white text-[10px] font-semibold" style={{ background: preview.color }}>{i + 1}</span>
                    <span className="text-foreground">{s}</span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t flex gap-2">
                <button onClick={() => setPreview(null)} className="flex-1 h-9 rounded-md text-sm font-medium border hover:bg-accent">Close</button>
                <button className="flex-1 h-9 rounded-md text-sm font-medium text-white shadow-sm" style={{ background: preview.color }}>Clone this template</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
