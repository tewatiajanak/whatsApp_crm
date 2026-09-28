import { Layers } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function EventsTemplatesPage() {
  return (
    <SectionStubPage
      title="Event Templates"
      description="A gallery of pre-built event blueprints — settings, forms, fields, tickets, pass designs, email templates, sessions structure, landing page, certificates, checklist, workflows — ready to clone into a new event."
      phase="Phase 4"
      layout="standalone"
      icon={Layers}
      backTo="/modules/events"
      backLabel="Back to Event Manager"
      features={[
        "Global (platform-shipped) templates and organization templates side by side",
        "Preview drawer showing every included piece as chips",
        "Use template → opens the Create Event Wizard pre-filled",
        "Edit / delete organization templates; global templates are read-only",
        "Save any existing event as a template (choose which pieces to include)",
      ]}
    />
  );
}
