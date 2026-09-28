import { CheckSquare } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function EventsChecklistPage() {
  return (
    <SectionStubPage
      title="Checklist"
      description="An event's readiness board — grouped by category with due dates, assignees, and overdue highlighting."
      phase="Phase 4"
      layout="standalone"
      icon={CheckSquare}
      backTo="/modules/events"
      backLabel="Back to Event Manager"
      features={[
        "Categories: venue, speakers, sponsors, registration, passes, volunteers, communication, completion, feedback, certificates",
        "Per-item due date (relative offset from event start) and assignee",
        "Apply a Checklist Template with one click",
        "Progress bar and overdue highlighting",
        "Deep-link from each item to its module (form, pass, template…)",
      ]}
    />
  );
}
