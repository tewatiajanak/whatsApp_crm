import { Copy } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function ParticipantsDuplicatesPage() {
  return (
    <SectionStubPage
      title="Duplicates"
      description="Suspected duplicate participants surfaced by email, phone, and fuzzy name + company matching. Compare side-by-side and merge into one canonical profile."
      phase="Phase 6"
      layout="standalone"
      icon={Copy}
      backTo="/modules/participants"
      backLabel="Back to Participants"
      features={[
        "Scan job runs in the background — you keep working",
        "Match types shown per candidate: exact email, exact phone, fuzzy name + company, custom rule",
        "Side-by-side compare card with a radio per field to choose the surviving value",
        "Actions: Merge, Not duplicate (learns and stops re-flagging), Skip",
        "All merges preserve every child record (registrations, payments, messages, notes)",
      ]}
    />
  );
}
