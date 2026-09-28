import { List } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function EventsAllPage() {
  return (
    <SectionStubPage
      title="All Events"
      description="Every event on your workspace with Table, Cards, and Calendar views, fast filters, saved views, and bulk actions."
      phase="Phase 4"
      layout="standalone"
      icon={List}
      backTo="/modules/events"
      backLabel="Back to Event Manager"
      features={[
        "Views: Table (dense) · Cards (visual) · Calendar (month / week / agenda)",
        "Status quick-tabs with counts: All · Draft · Published · Live · Completed · Archived",
        "Filters: type, category, mode (physical / online / hybrid), date range, owner",
        "Kebab actions per row: Open, Edit, Clone, Save as Template, Archive",
        "Bulk actions: archive, export, status change",
      ]}
      footer="The route is reserved so links from dashboards, search, and reports keep resolving to this page when it ships."
    />
  );
}
