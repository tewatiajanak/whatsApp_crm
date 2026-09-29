import { PlayCircle } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function AutomationRunsPage() {
  return (
    <SectionStubPage
      title="Runs"
      description="Every workflow execution across the organization — triggered by, current node, status, duration, and a full timeline of every step's input / output."
      phase="Phase 12"
      layout="standalone"
      icon={PlayCircle}
      backTo="/modules/automation"
      backLabel="Back to Automation"
      features={[
        "Filters: workflow, status (running / waiting / completed / failed / cancelled), trigger type, date range, participant, event",
        "Row → Run detail with timeline: node, type, started, duration, input, output, error",
        "Actions: Retry (re-runs from failed node), Cancel (waiting runs only)",
        "Delays visible with resume time; approvals visible with pending assignee",
        "Restart-safe — server restarts do not lose in-flight runs",
      ]}
    />
  );
}
