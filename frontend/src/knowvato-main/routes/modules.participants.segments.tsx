import { Filter } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function ParticipantsSegmentsPage() {
  return (
    <SectionStubPage
      title="Segments"
      description="Define audiences with a visual condition builder over participant, registration, and custom form fields. Reuse them for messaging, campaigns, and reports."
      phase="Phase 6"
      layout="standalone"
      icon={Filter}
      backTo="/modules/participants"
      backLabel="Back to Participants"
      features={[
        "ConditionBuilder (AND / OR groups) over any field — including form answers like Meal Preference = Jain",
        "Live member count preview while you build",
        "Dynamic segments recompute on demand; static segments freeze the member list at save time",
        "Members list with search and export",
        "Reusable everywhere: message send, campaign audience, report filter, workflow trigger",
      ]}
    />
  );
}
