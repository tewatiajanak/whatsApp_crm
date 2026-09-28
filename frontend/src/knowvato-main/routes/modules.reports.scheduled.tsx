import { CalendarClock } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function ReportsScheduledPage() {
  return (
    <SectionStubPage
      title="Scheduled Reports"
      description="Send saved reports on a schedule to your team — daily, weekly, monthly, or custom cron — as PDF, XLSX, or CSV attachments."
      phase="Phase 13"
      layout="standalone"
      icon={CalendarClock}
      backTo="/modules/reports"
      backLabel="Back to Reports"
      features={[
        "Cadence: daily · weekly · monthly · custom cron with timezone",
        "Filter overrides at send time (e.g. 'yesterday only', 'this week')",
        "Format: PDF, Excel (XLSX), CSV — attachment or link",
        "Recipients: users or free-form email list",
        "Run history: last run, status, generated file, row count",
        "Pause / resume / run-now",
      ]}
    />
  );
}
