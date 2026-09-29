import { Webhook } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function AutomationWebhooksPage() {
  return (
    <SectionStubPage
      title="Outbound Webhooks"
      description="Signed HTTPS webhooks to your systems — CRM, warehouse, analytics — with retry, backoff, delivery logs, and one-click redelivery."
      phase="Phase 12"
      layout="standalone"
      icon={Webhook}
      backTo="/modules/automation"
      backLabel="Back to Automation"
      features={[
        "Events: registration.created / updated / approved, payment.success / failed, checkin.success, certificate.generated, feedback.submitted, and more",
        "Payload envelope { id, type, createdAt, organizationId, eventId, data }",
        "Signature header X-EventOS-Signature: t=<ts>,v1=<hmac_sha256> with rotatable per-endpoint secret",
        "Retry policy: max 8 attempts with exponential backoff",
        "Delivery log with request / response viewer and Redeliver button",
        "SSRF-safe: HTTPS only, private IPs blocked",
        "Auto-disable after N consecutive failures with admin notification",
      ]}
    />
  );
}
