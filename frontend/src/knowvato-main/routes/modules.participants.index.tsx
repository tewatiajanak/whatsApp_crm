import { Users } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function ParticipantsIndexPage() {
  return (
    <SectionStubPage
      title="All Participants"
      description="Every person in your organization, across every event they've ever attended, spoken at, sponsored, or exhibited at — one unified profile."
      phase="Phase 6"
      layout="standalone"
      icon={Users}
      features={[
        "DataTable with avatar, name, email, phone, company, tags, events attended, spend",
        "360° profile page: registrations, tickets, payments, passes, sessions, check-ins, communications, feedback, certificates, documents, notes, timeline",
        "Filters: tag, source, event history, custom profile fields, communication preferences",
        "Bulk: tag, message (WhatsApp / SMS / Email), export, add to segment",
        "Merge two participants (side-by-side, choose surviving values field by field)",
        "Soft delete with privacy anonymize option",
      ]}
      footer="This is the cross-event Participant CRM. Event-specific registration lives inside each event's Workspace."
    />
  );
}
