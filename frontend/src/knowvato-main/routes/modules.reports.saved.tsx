import { FolderOpen } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function ReportsSavedPage() {
  return (
    <SectionStubPage
      title="Saved Reports"
      description="Your library of saved report definitions — organized into folders, marked as favorites, and shared with roles or specific teammates."
      phase="Phase 13"
      layout="standalone"
      icon={FolderOpen}
      backTo="/modules/reports"
      backLabel="Back to Reports"
      features={[
        "Folders and favorites for organization",
        "Visibility: Private · Shared with role · Shared with user",
        "'Run' → live results with the saved definition",
        "'Edit' opens the Report Builder pre-loaded",
        "Duplicate, delete, export definition as JSON",
        "Seed reports: Registration summary, Revenue by ticket & gateway, GST tax report, Attendance by gate/hour, Session attendance, No-show list, Coupon usage, Message delivery, Feedback summary, Speaker ratings, Lead report per exhibitor",
      ]}
    />
  );
}
