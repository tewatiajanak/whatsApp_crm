import { GitBranch } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function AutomationWorkflowsPage() {
  return (
    <SectionStubPage
      title="Workflows"
      description="Visual automation — trigger → conditions → actions → delays → branches → approvals → webhooks — running restart-safe on BullMQ. Every action calls existing services; no duplicate business logic."
      phase="Phase 12"
      layout="standalone"
      icon={GitBranch}
      features={[
        "Triggers: domain events (registration.created, payment.success, checkin.success, pass.generated, feedback.submitted, form.tag from form logic), schedule (cron / relative to event date), manual, inbound webhook",
        "Nodes: Trigger · Condition · Branch / Switch · Delay · Approval · Actions · End",
        "Actions: update registration, set field, tag, assign ticket, generate pass, send message, create task, assign seat, register to session, issue certificate, add to segment, call webhook, update participant, wait for event",
        "Delays survive server restart — persisted state per run",
        "Test-run panel highlights the path taken with a sample registration",
        "Runs page (see 'Runs' item) shows timeline of every step's input / output / duration",
      ]}
      footer="Actions run with a system actor bounded by the workflow creator's permissions snapshot — no privilege escalation, no permission bypass."
    />
  );
}
