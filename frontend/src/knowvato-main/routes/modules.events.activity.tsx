import { Activity } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function EventsActivityPage() {
  return (
    <SectionStubPage
      title="Activity Log"
      description="A timeline of every meaningful event across all your events — created, updated, published, registration opened / closed, started, completed, reports generated…"
      phase="Phase 4"
      layout="standalone"
      icon={Activity}
      backTo="/modules/events"
      backLabel="Back to Event Manager"
      features={[
        "Type filters: lifecycle, registration, comms, payments, attendance, reports",
        "Actor, IP, device, and time on every entry",
        "Deep-link to the entity involved",
        "Export to CSV / JSON",
      ]}
      footer="This is the org-wide activity feed. Per-event activity lives inside the Event Workspace."
    />
  );
}
