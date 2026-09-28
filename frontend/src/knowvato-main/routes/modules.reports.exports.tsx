import { Download } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function ReportsExportsPage() {
  return (
    <SectionStubPage
      title="Exports & Downloads"
      description="Every export job in one place — ad-hoc data exports, scheduled report outputs, participant exports, message logs, invoice bundles — with download links and expiry dates."
      phase="Phase 13"
      layout="standalone"
      icon={Download}
      backTo="/modules/reports"
      backLabel="Back to Reports"
      features={[
        "Job list with entity, format, rows, requested by, requested at, size, expiry",
        "Downloadable while file exists; re-run the same export when it expires",
        "Filter by entity, format, requester, date range",
        "Streaming export for large datasets — memory-flat for 50k+ rows",
        "PII masking on export controlled by permission",
      ]}
    />
  );
}
