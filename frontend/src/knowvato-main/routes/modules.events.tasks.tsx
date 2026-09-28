import { ListTodo } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function EventsTasksPage() {
  return (
    <SectionStubPage
      title="Tasks"
      description="Work items for the whole team — org-wide or scoped to a single event — in both List and Kanban views."
      phase="Phase 4"
      layout="standalone"
      icon={ListTodo}
      backTo="/modules/events"
      backLabel="Back to Event Manager"
      features={[
        "Views: List (DataTable) · Kanban (dnd-kit) · Mobile Tabs-by-status",
        "Priority (low / medium / high / urgent) · Due date · Labels · Checklist · Attachments",
        "Assignees, watchers, @mention comments with activity feed",
        "Relate a task to any entity (event, participant, invoice…)",
        "'My tasks' quick filter across the whole org",
      ]}
    />
  );
}
