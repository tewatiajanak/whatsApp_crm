import CommunicationNotificationCenterPage from "./modules.communication.notification-center";

// Top-level /notifications route — same page as the one inside
// Communication → Notification Center. Both share the same in-app
// notification store so the badge and list stay in sync everywhere.
export default function NotificationsPage() {
  return <CommunicationNotificationCenterPage />;
}
