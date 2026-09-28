import { Zap } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function CommunicationAutomatedPage() {
  return (
    <SectionStubPage
      title="Automated Messages"
      description="Rules that fire on domain events — registration approved, payment success, pass generated, event reminder, session reminder, feedback request, invoice — with channel fallback, delay, and conditions."
      phase="Phase 11"
      layout="standalone"
      icon={Zap}
      backTo="/modules/communication"
      backLabel="Back to Communication"
      features={[
        "Triggers: 20+ domain events including registration.approved, pass.generated, event.reminder, session.reminder, payment.success/failed, waitlist.offer, feedback.request",
        "Channels with fallback order (e.g. WhatsApp → SMS → Email) and per-channel template",
        "Timing: immediate, delay, relative-to-event (e.g. -1440 min = 1 day before)",
        "Recipients: participant, group leader, event admins, role, custom emails",
        "Conditions (ConditionGroup) — e.g. only send WhatsApp reminder to attendees who opted in",
        "Org defaults are inherited by every event; each event can override, disable, or edit timing",
        "Test send with a real registration to preview the exact rendered output",
      ]}
    />
  );
}
