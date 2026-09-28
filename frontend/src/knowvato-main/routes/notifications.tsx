import { Bell } from "lucide-react";
import SectionStubPage from "@/components/SectionStubPage";

/**
 * Top-level /notifications route — the org user's personal Notification
 * Center. Also reachable from the Communication module submenu. Real page
 * ships in Phase 11 with real-time socket updates and the bell dropdown
 * in the top bar.
 */
export default function NotificationsPage() {
  return (
    <SectionStubPage
      title="Notification Center"
      description="Your inbox for everything the platform wants you to see — approvals waiting, payments failed, devices offline, plan-limit warnings, teammate mentions, and system alerts."
      phase="Phase 11"
      layout="standalone"
      icon={Bell}
      backTo="/"
      backLabel="Back to dashboard"
      features={[
        "Real-time via socket — new items appear without refresh",
        "Bell dropdown in the top bar shows unread count and the latest 10",
        "Filters: unread, type, event, date range",
        "Deep-link to the entity that fired the notification (e.g. tap a payment failure → the payment detail drawer opens)",
        "Web Push subscription per browser (VAPID) so alerts arrive when the tab is closed",
        "Preferences: per-type channel matrix (in-app / email / push / WhatsApp) with quiet hours",
      ]}
      footer="Same page also renders inside Communication → Notification Center. This route is the top-level entry from the bell icon."
    />
  );
}
