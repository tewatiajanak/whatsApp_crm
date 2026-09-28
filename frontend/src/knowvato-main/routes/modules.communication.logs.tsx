import { ScrollText } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function CommunicationLogsPage() {
  return (
    <SectionStubPage
      title="Message Logs"
      description="Every email, SMS, WhatsApp, push, and in-app notification sent by the platform — searchable, filterable, with delivery / open / read timestamps from provider webhooks."
      phase="Phase 11"
      layout="standalone"
      icon={ScrollText}
      backTo="/modules/communication"
      backLabel="Back to Communication"
      features={[
        "Filters: channel, status, event, template, participant, date range",
        "Row drawer with rendered content and status timeline (queued → sent → delivered → opened → clicked)",
        "Provider message id + masked reference for troubleshooting with the provider dashboard",
        "Resend button (permission-gated)",
        "Delivery webhooks from SendGrid / SES / Mailgun / Msg91 / Twilio / Meta update status in real time",
        "Cost per message where the provider reports it",
      ]}
    />
  );
}
