import { Calendar } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function EventsCalendarPage() {
  return (
    <SectionStubPage
      title="Calendar"
      description="Every event on a calendar — month, week, or agenda view — with color-coded status and click-to-open."
      phase="Phase 4"
      layout="standalone"
      icon={Calendar}
      backTo="/modules/events"
      backLabel="Back to Event Manager"
      features={[
        "Month · Week · Agenda views (no external calendar library)",
        "Color per Event Type or Status",
        "Drag to reschedule (respecting status lock rules)",
        "Mobile: agenda list with sticky day headers",
        "Filter by type, category, owner, mode",
      ]}
    />
  );
}
