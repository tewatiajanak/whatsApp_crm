import { TrendingUp } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function ReportsAnalyticsPage() {
  return (
    <SectionStubPage
      title="Org Analytics"
      description="Cross-event trends and health signals — events over time, participants growth, revenue trend, no-show rate, feedback NPS, top events."
      phase="Phase 13"
      layout="standalone"
      icon={TrendingUp}
      backTo="/modules/reports"
      backLabel="Back to Reports"
      features={[
        "Events over time · Participants growth · Revenue trend · Attendance rate · No-show trend · Top events · Conversion benchmarks · Feedback NPS trend",
        "Charts follow the design-system Chart.js theme with dark-mode support",
        "Every chart has: title, info tooltip, period selector, 'view as table', export PNG / CSV",
        "Compare two periods side-by-side (this month vs last month, YoY)",
        "Role-based dashboards: Admin, Event Manager, Finance, Scanner",
        "Event Health section with RAG indicators — registration projection, capacity utilization, payment completion, approval backlog age, communication delivery rate, session utilization, checklist completion",
      ]}
      footer="Per-event analytics (Registrations · Revenue · Attendance · Sessions · Conversion funnel · Feedback) lives inside each event's Workspace."
    />
  );
}
