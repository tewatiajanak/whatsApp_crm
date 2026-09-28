import { Wrench } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function ReportsBuilderPage() {
  return (
    <SectionStubPage
      title="Report Builder"
      description="A no-code report builder over every entity — Registrations, Participants, Orders, Payments, Check-ins, Sessions, Messages, Feedback — with joins, aggregations, and charts."
      phase="Phase 13"
      layout="standalone"
      icon={Wrench}
      backTo="/modules/reports"
      backLabel="Back to Reports"
      features={[
        "Left step rail: Data Source → Fields → Filters → Group By → Sort → Aggregation → Chart",
        "Custom form fields discovered per event — group and filter by 'Meal Preference', 'College Name' etc.",
        "Safe aggregation pipeline: whitelisted fields / ops only, tenant $match first, row cap, timeout",
        "Visualization: table · bar · line · pie · donut · KPI · pivot",
        "Save / Save as / Schedule / Export from the builder",
        "Field picker grouped by entity with search",
      ]}
    />
  );
}
