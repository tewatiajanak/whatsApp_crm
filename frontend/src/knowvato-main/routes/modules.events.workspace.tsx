import { useParams } from "react-router-dom";
import { Compass } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

/**
 * Per-event Workspace stub. Reserves /modules/events/:eventId/* so that
 * every bookmark from Overview, Setup, Checklist, Tasks, and Activity Log
 * inside a specific event resolves cleanly. Real page ships in Phase 4.
 */
export default function EventsWorkspacePage() {
  const { eventId } = useParams();
  return (
    <SectionStubPage
      title="Event Workspace"
      description={`A focused workspace for a single event — its own sidebar, publish workflow, setup tabs, checklist, tasks, and activity feed. Reserved for event id: ${eventId ?? "—"}.`}
      phase="Phase 4"
      layout="standalone"
      icon={Compass}
      backTo="/modules/events"
      backLabel="Back to Event Manager"
      features={[
        "Left sidebar per master §9.C — hidden items follow event feature toggles",
        "Header: event name, status badge with allowed-transitions, Publish, Share, kebab (clone / save as template / archive)",
        "Sections: Overview (KPIs + next steps + activity), Setup (feature toggles, approval rules, status workflow, team, ID formats, danger zone), Checklist, Tasks, Activity",
        "Publish blocked by publish-check checklist (missing fields, forms, tickets)",
        "Auto-status transitions run every 5 min via BullMQ",
      ]}
    />
  );
}
