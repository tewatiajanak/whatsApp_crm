import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Spinner } from "./components/ui";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Registration from "./pages/Registration";
import FollowUps from "./pages/FollowUps";
import Conversion from "./pages/Conversion";
import Contacts from "./pages/Contacts";
import Conversations from "./pages/Conversations";
import Campaigns from "./pages/Campaigns";
import Templates from "./pages/Templates";
import ChatbotRules from "./pages/ChatbotRules";
import MediaManager from "./flowchat/pages/MediaManager";
import Setup from "./pages/Setup";
import PublicEnquiryForm from "./pages/PublicEnquiryForm";
import PublicLandingPage from "./pages/PublicLandingPage";
import EnquiryForms from "./pages/EnquiryForms";
import Audit from "./pages/Audit";
import ClarwynEnquiryNow from "./pages/ClarwynEnquiryNow";
import MessageHistory from "./pages/MessageHistory";

// FlowChat Studio Builder
import BotBuilder from "./flowchat/pages/BotBuilder";

// Knowvato Main Components
import MainLayout from "./knowvato-main/routes/__root";
import KnowvatoDashboard from "./knowvato-main/routes/index";
import AICopilotWidget from "./components/AICopilotWidget";
import EventManagerLayout from "./knowvato-main/routes/modules.events";
import EventsIndex from "./knowvato-main/routes/modules.events.index";
import EventsCreate from "./knowvato-main/routes/modules.events.create";
import EventsRegistrants from "./knowvato-main/routes/modules.events.registrants";
import EventsScan from "./knowvato-main/routes/modules.events.scan";
import EventsQr from "./knowvato-main/routes/modules.events.qr";
import EventsBulkQr from "./knowvato-main/routes/modules.events.bulk-qr";
// Phase 4 stubs — routes reserved so bookmarks resolve; pages ship in Phase 4.
import EventsAll from "./knowvato-main/routes/modules.events.all";
import EventsTemplates from "./knowvato-main/routes/modules.events.templates";
import EventsCalendar from "./knowvato-main/routes/modules.events.calendar";
import EventsChecklist from "./knowvato-main/routes/modules.events.checklist";
import EventsTasks from "./knowvato-main/routes/modules.events.tasks";
import EventsActivity from "./knowvato-main/routes/modules.events.activity";
import EventsWorkspace from "./knowvato-main/routes/modules.events.workspace";

// Phase 11 Communication submenu — Overview + 4 stubs
import CommunicationLayout from "./knowvato-main/routes/modules.communication";
import CommunicationIndex from "./knowvato-main/routes/modules.communication.index";
import CommunicationCampaigns from "./knowvato-main/routes/modules.communication.campaigns";
import CommunicationAutomated from "./knowvato-main/routes/modules.communication.automated";
import CommunicationLogs from "./knowvato-main/routes/modules.communication.logs";
import CommunicationNotificationCenter from "./knowvato-main/routes/modules.communication.notification-center";
import NotificationsPage from "./knowvato-main/routes/notifications";

// Phase 13 Reports submenu — Overview + 5 stubs
import ReportsLayout from "./knowvato-main/routes/modules.reports";
import ReportsIndex from "./knowvato-main/routes/modules.reports.index";
import ReportsBuilder from "./knowvato-main/routes/modules.reports.builder";
import ReportsSaved from "./knowvato-main/routes/modules.reports.saved";
import ReportsScheduled from "./knowvato-main/routes/modules.reports.scheduled";
import ReportsExports from "./knowvato-main/routes/modules.reports.exports";
import ReportsAnalytics from "./knowvato-main/routes/modules.reports.analytics";
import CommandCenterPage from "./knowvato-main/routes/search";
import TemplatesWhatsapp from "./knowvato-main/routes/modules.templates-whatsapp";
import TemplatesEmail from "./knowvato-main/routes/modules.templates-email";
import TemplatesSms from "./knowvato-main/routes/modules.templates-sms";
import IntegrationsWhatsapp from "./knowvato-main/routes/modules.integrations-whatsapp";
import ModulePage from "./knowvato-main/routes/modules.$module";

// Utilities Module Components
import UtilitiesLayout from "./knowvato-main/routes/modules.utilities";
import UtilitiesOverviewPage from "./knowvato-main/pages/UtilitiesOverviewPage";
import QRCodeUtilityPage from "./knowvato-main/pages/QRCodeUtilityPage";
import VideoEditorPage from "./knowvato-main/pages/VideoEditorPage";
import PhotoEditorPage from "./knowvato-main/pages/PhotoEditorPage";

// Super Admin (Phase 3 stub — routes reserved, pages ship in P3)
import SuperAdminLandingPage from "./knowvato-main/pages/SuperAdminLandingPage";

// Portals (Phase 9 stub — Speaker / Sponsor / Exhibitor self-service portals)
import PortalLandingPage from "./knowvato-main/pages/PortalLandingPage";

// Scanner PWA (Phase 10 stub — installable, camera-first, offline-first)
import ScannerPWALandingPage from "./knowvato-main/pages/ScannerPWALandingPage";

// Participant portal + public event discovery (Phase 14 stubs)
import ParticipantPortalLandingPage from "./knowvato-main/pages/ParticipantPortalLandingPage";
import DiscoveryPortalLandingPage from "./knowvato-main/pages/DiscoveryPortalLandingPage";

// SaaS billing surfaces (Phase 15 stubs)
import PricingLandingPage from "./knowvato-main/pages/PricingLandingPage";
import CheckoutLandingPage from "./knowvato-main/pages/CheckoutLandingPage";
import OnboardingLandingPage from "./knowvato-main/routes/onboarding";

// Participants (Phase 6 stub — Registration Engine + Participants 360°)
import ParticipantsLayout from "./knowvato-main/routes/modules.participants";
import ParticipantsIndex from "./knowvato-main/routes/modules.participants.index";
import ParticipantsDuplicates from "./knowvato-main/routes/modules.participants.duplicates";
import ParticipantsSegments from "./knowvato-main/routes/modules.participants.segments";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Starting…" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <div className="crm-theme"><Login /></div>} />
        <Route path="/public/enquiry-form/:formId" element={<div className="crm-theme"><PublicEnquiryForm /></div>} />
        <Route path="/public/landing-page/:pageId" element={<div className="crm-theme"><PublicLandingPage /></div>} />
        <Route path="/clp/enquirenow" element={<div className="crm-theme"><ClarwynEnquiryNow /></div>} />

        {/* Speaker / Sponsor / Exhibitor portals (Phase 9 stub).
            Rendered outside MainLayout so portal users don't see the
            organization's admin sidebar. Wildcard catches any subpath so
            /portal/speaker/sessions, /portal/sponsor/benefits etc. all
            resolve to the same landing page until the real portals ship. */}
        <Route path="/portal/:role" element={<PortalLandingPage />} />
        <Route path="/portal/:role/*" element={<PortalLandingPage />} />

        {/* Scanner PWA (Phase 10 stub). Installable, camera-first,
            offline-first. Rendered outside MainLayout — gate staff open
            this URL on their phones and add it to home screen. */}
        <Route path="/scan" element={<ScannerPWALandingPage />} />
        <Route path="/scan/*" element={<ScannerPWALandingPage />} />

        {/* Participant portal (Phase 14 stub) — /me and every subpath.
            Rendered outside MainLayout so participants don't see the
            organization's admin sidebar. */}
        <Route path="/me" element={<ParticipantPortalLandingPage />} />
        <Route path="/me/*" element={<ParticipantPortalLandingPage />} />

        {/* Public event discovery (Phase 14 stub) — /explore lists every
            public event on the platform; /o/:orgSlug is the per-org
            public page listing that organization's events. */}
        <Route path="/explore" element={<DiscoveryPortalLandingPage />} />
        <Route path="/o/:orgSlug" element={<DiscoveryPortalLandingPage />} />
        <Route path="/o/:orgSlug/*" element={<DiscoveryPortalLandingPage />} />

        {/* Public SaaS billing routes (Phase 15 stubs) — pricing page and
            the signup → pay → activate checkout flow. Both rendered
            outside MainLayout since visitors aren't logged in yet. */}
        <Route path="/pricing" element={<PricingLandingPage />} />
        <Route path="/checkout" element={<CheckoutLandingPage />} />

        {/* Standalone Full-screen Bot Builder routes */}
        <Route
          path="/crm/chatbot/builder/:botId"
          element={
            <Protected>
              <BotBuilder />
            </Protected>
          }
        />
        <Route
          path="/bot/:botId"
          element={
            <Protected>
              <BotBuilder />
            </Protected>
          }
        />

        {/* Knowvato Main Routes */}
        <Route
          path="/"
          element={
            <Protected>
              <MainLayout />
            </Protected>
          }
        >
          <Route index element={<KnowvatoDashboard />} />
          <Route path="modules/events" element={<EventManagerLayout />}>
            <Route index element={<EventsIndex />} />
            <Route path="create" element={<EventsCreate />} />
            <Route path="registrants" element={<EventsRegistrants />} />
            <Route path="scan" element={<EventsScan />} />
            <Route path="qr" element={<EventsQr />} />
            <Route path="bulk-qr" element={<EventsBulkQr />} />
            {/* Phase 4 stubs */}
            <Route path="all" element={<EventsAll />} />
            <Route path="templates" element={<EventsTemplates />} />
            <Route path="calendar" element={<EventsCalendar />} />
            <Route path="checklist" element={<EventsChecklist />} />
            <Route path="tasks" element={<EventsTasks />} />
            <Route path="activity" element={<EventsActivity />} />
            {/* Per-event Workspace stub — /:eventId and every subpath (Overview,
                Setup, Checklist, Tasks, Activity) all resolve to the workspace
                stub until Phase 4 ships the real layout. */}
            <Route path=":eventId" element={<EventsWorkspace />} />
            <Route path=":eventId/*" element={<EventsWorkspace />} />
          </Route>
          <Route path="modules/participants" element={<ParticipantsLayout />}>
            <Route index element={<ParticipantsIndex />} />
            <Route path="duplicates" element={<ParticipantsDuplicates />} />
            <Route path="segments" element={<ParticipantsSegments />} />
          </Route>
          <Route path="modules/communication" element={<CommunicationLayout />}>
            <Route index element={<CommunicationIndex />} />
            <Route path="campaigns" element={<CommunicationCampaigns />} />
            <Route path="automated-messages" element={<CommunicationAutomated />} />
            <Route path="logs" element={<CommunicationLogs />} />
            <Route path="notification-center" element={<CommunicationNotificationCenter />} />
          </Route>
          <Route path="modules/reports" element={<ReportsLayout />}>
            <Route index element={<ReportsIndex />} />
            <Route path="builder" element={<ReportsBuilder />} />
            <Route path="saved" element={<ReportsSaved />} />
            <Route path="scheduled" element={<ReportsScheduled />} />
            <Route path="exports" element={<ReportsExports />} />
            <Route path="analytics" element={<ReportsAnalytics />} />
          </Route>
          <Route path="modules/utilities" element={<UtilitiesLayout />}>
            <Route index element={<UtilitiesOverviewPage />} />
            <Route path="qr" element={<QRCodeUtilityPage />} />
            <Route path="video-edit" element={<VideoEditorPage />} />
            <Route path="photo-edit" element={<PhotoEditorPage />} />
          </Route>
          <Route path="modules/:module" element={<ModulePage />} />
          {/* Notification Center (Phase 11 stub) — top-level entry from the
              bell in the top bar. Same page also renders inside Communication. */}
          <Route path="notifications" element={<NotificationsPage />} />
          {/* Command Center (Phase 13 stub) — full-screen search fallback
              for mobile; desktop opens Ctrl+K palette overlay in Phase 13. */}
          <Route path="search" element={<CommandCenterPage />} />
          {/* Onboarding wizard (Phase 15 stub) — post-activation first-run
              experience. Rendered inside MainLayout since the org is
              already logged in at this point. */}
          <Route path="onboarding" element={<OnboardingLandingPage />} />
          {/* Super Admin — reserved for Phase 3. All /sa/* subroutes render the
              same landing page until the real pages ship, so bookmarks work. */}
          <Route path="sa" element={<SuperAdminLandingPage />} />
          <Route path="sa/*" element={<SuperAdminLandingPage />} />
        </Route>

        {/* WhatsApp CRM Routes */}
        <Route
          path="/crm"
          element={
            <Protected>
              <Layout />
            </Protected>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="leads/registration/:leadId" element={<Registration />} />
          <Route path="followups" element={<FollowUps />} />
          <Route path="conversion" element={<Conversion />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="chat" element={<Conversations />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="history" element={<MessageHistory />} />
          <Route path="templates" element={<Templates />} />
          <Route path="media" element={<MediaManager />} />
          <Route path="chatbot" element={<ChatbotRules />} />
          <Route path="setup" element={<Setup />} />
          <Route path="setup/enquiry-forms" element={<EnquiryForms />} />
          <Route path="setup/enquiry-forms/:formId" element={<EnquiryForms />} />
          <Route path="audit" element={<Audit />} />
        </Route>

        {/* Fallback to main page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AICopilotWidget />
    </>
  );
}
