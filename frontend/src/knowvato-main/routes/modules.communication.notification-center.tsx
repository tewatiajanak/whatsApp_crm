import { Bell } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

export default function CommunicationNotificationCenterPage() {
  return (
    <SectionStubPage
      title="Notification Center"
      description="Every in-app notification you've received — new registrations, approvals needed, payment failures, device offline alerts, plan-limit warnings — with mark-read and deep links to the source."
      phase="Phase 11"
      layout="standalone"
      icon={Bell}
      backTo="/modules/communication"
      backLabel="Back to Communication"
      features={[
        "Real-time via socket — arrives without refresh",
        "Bell dropdown in the top bar shows unread count and the latest 10",
        "Filters: unread, type, event, date range",
        "Mark read / mark all read; TTL 180 days",
        "Web Push subscription per browser (VAPID) so alerts arrive when the tab is closed",
        "Preferences: per-type channel matrix (in-app / email / push / WhatsApp) with quiet hours",
      ]}
      footer="Also reachable at /notifications from the bell in the top bar."
    />
  );
}
