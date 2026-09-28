import { Megaphone } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function CommunicationCampaignsPage() {
  return (
    <SectionStubPage
      title="Campaigns"
      description="Broadcast messages to any audience — segment, filter, event, or uploaded list — across Email, SMS, WhatsApp, and Push, with throttling, A/B tests, and live delivery stats."
      phase="Phase 11"
      layout="standalone"
      icon={Megaphone}
      backTo="/modules/communication"
      backLabel="Back to Communication"
      features={[
        "4-step campaign builder: Audience → Channel & Content → Schedule → Review",
        "Audience: segment picker, filter builder, event(s), uploaded list — live recipient count with exclusions",
        "Email editor: TipTap + blocks (logo, heading, text, button, image, divider, 2-column) with VariablePicker",
        "SMS with character / segment counter and DLT template id · WhatsApp approved template picker with param mapping",
        "Schedule now or later with timezone (event / recipient), throttle per minute, optional A/B split with winner metric",
        "Campaign report: funnel targeted → sent → delivered → opened → clicked, failures table, link click map",
      ]}
    />
  );
}
