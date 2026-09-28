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
          <Route path="modules/utilities" element={<UtilitiesLayout />}>
            <Route index element={<UtilitiesOverviewPage />} />
            <Route path="qr" element={<QRCodeUtilityPage />} />
            <Route path="video-edit" element={<VideoEditorPage />} />
            <Route path="photo-edit" element={<PhotoEditorPage />} />
          </Route>
          <Route path="modules/:module" element={<ModulePage />} />
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
