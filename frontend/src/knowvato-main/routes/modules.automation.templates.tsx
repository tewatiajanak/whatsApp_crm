import { Layers } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function AutomationTemplatesPage() {
  return (
    <SectionStubPage
      title="Workflow Templates"
      description="Reusable workflow blueprints — VIP approval flow, feedback nudge, no-show recovery, sponsor benefit tracker — ready to clone into any event."
      phase="Phase 12"
      layout="standalone"
      icon={Layers}
      backTo="/modules/automation"
      backLabel="Back to Automation"
      features={[
        "Seeded templates from PHASE-12: 'Registration Submitted + Ticket = VIP → Approve → Generate VIP Pass → Email + WhatsApp'",
        "Preview modal shows the full graph before cloning",
        "Use → creates a Workflow on the target event or organization",
        "Save any workflow as a template (organization-shared or global)",
        "Category filters: Registration, Payments, Communication, Attendance, Certificates, Sponsors",
        "Export / import as JSON",
      ]}
    />
  );
}
