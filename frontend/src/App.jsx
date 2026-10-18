import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import { useToast } from "./context/ToastContext";
import { appStore } from "./api/appStore";
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
import { PublicPrerequisitePage } from "./pages/PrerequisitePages";
import PublicLandingPage from "./pages/PublicLandingPage";
import EnquiryForms from "./pages/EnquiryForms";
import Audit from "./pages/Audit";
import ClarwynEnquiryNow from "./pages/ClarwynEnquiryNow";
import MessageHistory from "./pages/MessageHistory";
import Automation from "./pages/Automation";
import CrmSettings from "./pages/CrmSettings";
import Targets from "./pages/Targets";
import Applications from "./pages/Applications";
import { PublicPayPage, PublicApplicationPage, PublicPartnerPage, PublicBookingPage, ApplicantLoginPage } from "./pages/PublicCrmPages";
import { Approvals, Partners, Reports } from "./pages/CrmMorePages";
import { Queries, LeadLists, ActivityRegister } from "./pages/CrmProPages";

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
import EventsCalendar from "./knowvato-main/routes/modules.events.calendar";
import EventsAttendance from "./knowvato-main/routes/modules.events.attendance";
import EventsCommunication from "./knowvato-main/routes/modules.events.communication";
import EventsTasks from "./knowvato-main/routes/modules.events.tasks";
import EventsActivity from "./knowvato-main/routes/modules.events.activity";
import EventAttendeesPage from "./knowvato-main/event-manager/pages/EventAttendeesPage";
import EventActivityLogPage from "./knowvato-main/event-manager/pages/ActivityLogPage";
import EventPassPage from "./knowvato-main/pages/EventPassDesignerPage";
import EventWizardPage from "./knowvato-main/pages/EventWizardPage";
import EventsPayments from "./knowvato-main/routes/modules.events.payments";
import PublicEventFormPage from "./knowvato-main/pages/PublicEventFormPage";

// Phase 11 Communication submenu — Overview + 4 stubs
import CommunicationLayout from "./knowvato-main/routes/modules.communication";
import CommunicationIndex from "./knowvato-main/routes/modules.communication.index";
import CommunicationCampaigns from "./knowvato-main/routes/modules.communication.campaigns";
import CommunicationAutomated from "./knowvato-main/routes/modules.communication.automated";
import CommunicationLogs from "./knowvato-main/routes/modules.communication.logs";
import CommunicationNotificationCenter from "./knowvato-main/routes/modules.communication.notification-center";
import NotificationsPage from "./knowvato-main/routes/notifications";

// Phase 12 Automation submenu — Workflows / Templates / Runs / Webhooks
import AutomationLayout from "./knowvato-main/routes/modules.automation";
import AutomationWorkflows from "./knowvato-main/routes/modules.automation.index";
import AutomationTemplates from "./knowvato-main/routes/modules.automation.templates";
import AutomationRuns from "./knowvato-main/routes/modules.automation.runs";
import AutomationWebhooks from "./knowvato-main/routes/modules.automation.webhooks";

// Phase 13 Reports submenu — Overview + 5 stubs
import ReportsLayout from "./knowvato-main/routes/modules.reports";
import ReportsIndex from "./knowvato-main/routes/modules.reports.index";
import ReportsBuilder from "./knowvato-main/routes/modules.reports.builder";
import ReportsSaved from "./knowvato-main/routes/modules.reports.saved";
import ReportsScheduled from "./knowvato-main/routes/modules.reports.scheduled";
import ReportsExports from "./knowvato-main/routes/modules.reports.exports";
import ReportsAnalytics from "./knowvato-main/routes/modules.reports.analytics";
import TemplatesWhatsapp from "./knowvato-main/routes/modules.templates-whatsapp";
import TemplatesEmail from "./knowvato-main/routes/modules.templates-email";
import TemplatesSms from "./knowvato-main/routes/modules.templates-sms";
import IntegrationsWhatsapp from "./knowvato-main/routes/modules.integrations-whatsapp";
import ModulePage from "./knowvato-main/routes/modules.$module";
import { WebsitesPage, SitePagesPage, DesignerPage, MenusPage, SiteSettingsPage } from "./website-builder/pages";
import WebsitePageBuilder from "./website-builder/BuilderPage";
import { PublicSite, SitePreview, SharedPreview } from "./website-builder/SiteView";
import { ContentPage, DataApisPage, InboxPage, AppsPage } from "./website-builder/dataPages";
import { TemplateGalleryPage } from "./website-builder/templates";
import WebsiteLandingPages from "./knowvato-main/pages/WebsiteBuilderPage";
import FrontOfficePage from "./knowvato-main/pages/FrontOfficePage";
import PmLayout, { PmIndex, PmGuard } from "./knowvato-main/pm/PmLayout";
import TeamHierarchyPage from "./knowvato-main/pm/TeamHierarchyPage";
import PmSetupPage from "./knowvato-main/pm/PmSetupPage";
import ProductBuilderPage from "./knowvato-main/pm/ProductBuilderPage";
import PmClientsPage from "./knowvato-main/pm/ClientsPage";
import PmProjectsPage from "./knowvato-main/pm/ProjectsPage";
import PmProjectDetailPage from "./knowvato-main/pm/ProjectDetailPage";
import PmMyWorkPage from "./knowvato-main/pm/MyWorkPage";
import PmTasksPage from "./knowvato-main/pm/TasksPage";
import PmDailyPlanPage from "./knowvato-main/pm/DailyPlanPage";
import PmTeamCalendarPage from "./knowvato-main/pm/TeamCalendarPage";
import PmMessageLogPage from "./knowvato-main/pm/MessageLogPage";
import PmNotificationsPage from "./knowvato-main/pm/Notifications";
import PmMeetingsPage from "./knowvato-main/pm/MeetingsPage";
import PmTicketsPage from "./knowvato-main/pm/TicketsPage";
import PmPortalApp from "./knowvato-main/pm/PortalApp";
import { PublicMeetingPage, PublicVerifyPage, PublicSignoffPage } from "./knowvato-main/pm/PublicPages";
import PmDashboardPage from "./knowvato-main/pm/DashboardPage";
import PmReportsPage from "./knowvato-main/pm/ReportsPage";
import PmPersonPage from "./knowvato-main/pm/PersonPage";

// Utilities Module Components
import UtilitiesLayout from "./knowvato-main/routes/modules.utilities";
import UtilitiesOverviewPage from "./knowvato-main/pages/UtilitiesOverviewPage";
import QRCodeUtilityPage from "./knowvato-main/pages/QRCodeUtilityPage";
import VideoEditorPage from "./knowvato-main/pages/VideoEditorPage";
import PhotoEditorPage from "./knowvato-main/pages/PhotoEditorPage";






// Certificate verification (Phase 12 public stub)

// Participants (Phase 6 stub — Registration Engine + Participants 360°)

// Shown instead of the app until a user on a default password has chosen their own.
function ChangePasswordGate() {
  const { user, changePassword, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const problem = next && next.length < 8 ? "The new password needs at least 8 characters." : again && next !== again ? "The two new passwords do not match." : "";

  async function submit(e) {
    e.preventDefault();
    if (problem || !current || !next || next !== again) return;
    setBusy(true);
    setError("");
    try {
      await changePassword(current, next);
    } catch (err) {
      setError(err.message || "Could not change the password");
    } finally {
      setBusy(false);
    }
  }

  const label = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";
  return (
    <div className="crm-theme min-h-screen flex items-center justify-center p-4" style={{ background: "var(--page-bg)" }}>
      <form onSubmit={submit} className="rounded-xl border bg-card p-5 w-full space-y-3" style={{ maxWidth: 400 }}>
        <div>
          <div className="text-base font-semibold text-foreground">Set your password</div>
          <div className="text-xs text-muted-foreground mt-0.5">{user?.email}</div>
        </div>
        <div>
          <label className={label}>Current password</label>
          <input type="password" autoFocus className="ui-input w-full" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </div>
        <div>
          <label className={label}>New password</label>
          <input type="password" className="ui-input w-full" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <label className={label}>New password again</label>
          <input type="password" className="ui-input w-full" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
        </div>
        {(problem || error) && <div className="text-xs" style={{ color: "var(--destructive)" }}>{problem || error}</div>}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button type="button" className="ui-btn ui-btn-ghost" onClick={logout}>Sign out</button>
          <button type="submit" className="ui-btn ui-btn-primary" disabled={busy || !!problem || !current || !next || next !== again}>
            {busy ? "Saving…" : "Save password"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Protected({ children }) {
  const { user, loading, storeError, retryStore } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <Spinner label="Starting…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <ChangePasswordGate />;
  // a client's own user lives in the client portal, nowhere else
  if (user.pmClient && !pathname.startsWith("/portal")) return <Navigate to="/portal" replace />;
  if (storeError) {
    return (
      <div className="crm-theme min-h-screen flex items-center justify-center p-4" style={{ background: "var(--page-bg)" }}>
        <div className="rounded-xl border bg-card p-5 text-center" style={{ maxWidth: 420 }}>
          <div className="text-sm font-semibold text-foreground">Could not load your data from the server</div>
          <p className="text-xs text-muted-foreground mt-1 mb-3">{storeError}</p>
          <button type="button" className="ui-btn ui-btn-primary" onClick={retryStore}>
            Retry
          </button>
        </div>
      </div>
    );
  }
  return children;
}

export default function App() {
  const { user } = useAuth();
  const toast = useToast();

  // A save that never reached the server must not fail silently.
  useEffect(
    () => appStore.onError(() => toast("Could not save your last change to the server. Check your connection.", "error")),
    [toast]
  );

  return (
    <>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <div className="crm-theme"><Login /></div>} />
        {/* Admission pre-requisite form sent to a client (Setup › Implementation › Pre-requisites) */}
        <Route path="/prerequisites/:token" element={<PublicPrerequisitePage />} />
        <Route path="/public/enquiry-form/:formId" element={<div className="crm-theme"><PublicEnquiryForm /></div>} />
        <Route path="/public/landing-page/:pageId" element={<div className="crm-theme"><PublicLandingPage /></div>} />
        {/* Website Builder: published websites (public) */}
        <Route path="/site/:siteKey/*" element={<PublicSite />} />
        <Route path="/site-preview/:token/*" element={<SharedPreview />} />
        <Route path="/clp/enquirenow" element={<div className="crm-theme"><ClarwynEnquiryNow /></div>} />
        {/* Lead CRM links sent to a lead: pay a fee, follow an application (public) */}
        <Route path="/pay/:token" element={<PublicPayPage />} />
        <Route path="/application/:token" element={<PublicApplicationPage />} />
        <Route path="/partner/:token" element={<PublicPartnerPage />} />
        <Route path="/applicant" element={<ApplicantLoginPage />} />
        <Route path="/book/:token" element={<PublicBookingPage />} />
        {/* Live event registration form (public) */}
        <Route path="/e/:eventId" element={<PublicEventFormPage />} />

        {/* Project Management links opened from an email / WhatsApp message (no login) */}
        <Route path="/pm/meeting/:token" element={<PublicMeetingPage />} />
        <Route path="/pm/verify/:token" element={<PublicVerifyPage />} />
        <Route path="/pm/signoff/:token" element={<PublicSignoffPage />} />
        {/* Client portal */}
        <Route path="/portal/*" element={<Protected><PmPortalApp /></Protected>} />

        {/* Old scanner link → the real Scan Pass page */}
        <Route path="/scan/*" element={<Navigate to="/modules/events/scan" replace />} />

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
            <Route path="attendance" element={<EventsAttendance />} />
            <Route path="qr" element={<EventsQr />} />
            <Route path="bulk-qr" element={<EventsBulkQr />} />
            {/* Phase 4 stubs */}
            <Route path="all" element={<EventsAll />} />
            <Route path="templates" element={<Navigate to="/modules/events" replace />} />
            <Route path="calendar" element={<EventsCalendar />} />
            <Route path="communication" element={<EventsCommunication />} />
            <Route path="checklist" element={<Navigate to="/modules/events/tasks" replace />} />
            <Route path="tasks" element={<EventsTasks />} />
            <Route path="activity" element={<EventsActivity />} />
            <Route path="payments" element={<EventsPayments />} />
            <Route path="setup" element={<ModulePage setupModule="events" />} />
            <Route path="setup/:slug" element={<ModulePage setupModule="events" />} />
            {/* Create / edit an event: details → form fields → form design */}
            <Route path="new" element={<EventWizardPage />} />
            <Route path=":eventId/edit" element={<EventWizardPage />} />
            {/* Per-event pages opened from the Events table action menu */}
            <Route path=":eventId/attendees" element={<EventAttendeesPage />} />
            <Route path=":eventId/upload" element={<EventAttendeesPage />} />
            <Route path=":eventId/logs" element={<EventActivityLogPage />} />
            <Route path=":eventId/passes" element={<EventPassPage />} />
            {/* An event's own URL opens its attendees */}
            <Route path=":eventId" element={<Navigate to="attendees" replace />} />
          </Route>
          {/* Participants module was removed — send old bookmarks home. */}
          <Route path="modules/participants/*" element={<Navigate to="/" replace />} />
          <Route path="modules/communication" element={<CommunicationLayout />}>
            <Route index element={<CommunicationIndex />} />
            <Route path="campaigns" element={<CommunicationCampaigns />} />
            <Route path="automated-messages" element={<CommunicationAutomated />} />
            <Route path="logs" element={<CommunicationLogs />} />
            <Route path="notification-center" element={<CommunicationNotificationCenter />} />
          </Route>
          <Route path="modules/automation" element={<AutomationLayout />}>
            <Route index element={<AutomationWorkflows />} />
            <Route path="templates" element={<AutomationTemplates />} />
            <Route path="runs" element={<AutomationRuns />} />
            <Route path="webhooks" element={<AutomationWebhooks />} />
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
          <Route path="modules/website" element={<WebsitesPage />} />
          <Route path="modules/website/templates" element={<TemplateGalleryPage />} />
          <Route path="modules/website/landing" element={<WebsiteLandingPages />} />
          <Route path="modules/website/s/:siteId" element={<Navigate to="pages" replace />} />
          <Route path="modules/website/s/:siteId/pages" element={<SitePagesPage />} />
          <Route path="modules/website/s/:siteId/designer" element={<DesignerPage />} />
          <Route path="modules/website/s/:siteId/menus" element={<MenusPage />} />
          <Route path="modules/website/s/:siteId/settings" element={<SiteSettingsPage />} />
          <Route path="modules/website/s/:siteId/content" element={<ContentPage />} />
          <Route path="modules/website/s/:siteId/content/:key" element={<ContentPage />} />
          <Route path="modules/website/s/:siteId/data" element={<DataApisPage />} />
          <Route path="modules/website/s/:siteId/inbox" element={<InboxPage />} />
          <Route path="modules/website/s/:siteId/apps" element={<AppsPage />} />
          <Route path="modules/website/s/:siteId/builder/:pageId" element={<WebsitePageBuilder />} />
          <Route path="modules/website/s/:siteId/preview" element={<SitePreview />} />
          <Route path="modules/website/setup" element={<ModulePage setupModule="website" />} />
          <Route path="modules/website/setup/:slug" element={<ModulePage setupModule="website" />} />
          <Route path="modules/front-office" element={<Navigate to="/modules/front-office/visitors/today" replace />} />
          <Route path="modules/front-office/visitors/today" element={<FrontOfficePage view="today" />} />
          <Route path="modules/front-office/visitors/upcoming" element={<FrontOfficePage view="upcoming" />} />
          <Route path="modules/front-office/communication" element={<Navigate to="/modules/front-office" replace />} />
          <Route path="modules/front-office/setup" element={<ModulePage setupModule="front-office" />} />
          <Route path="modules/front-office/setup/:slug" element={<ModulePage setupModule="front-office" />} />
          <Route path="modules/projects" element={<PmLayout />}>
            <Route index element={<PmIndex />} />
            <Route path="team" element={<PmGuard screen="team"><TeamHierarchyPage /></PmGuard>} />
            <Route path="dashboard" element={<PmGuard screen="dashboard"><PmDashboardPage /></PmGuard>} />
            <Route path="reports" element={<PmGuard screen="reports"><PmReportsPage /></PmGuard>} />
            <Route path="people/:personId" element={<PmGuard any={["team", "my_tasks", "dashboard"]}><PmPersonPage /></PmGuard>} />
            <Route path="my-work" element={<PmGuard any={["my_tasks", "tasks"]}><PmMyWorkPage /></PmGuard>} />
            <Route path="list" element={<PmGuard screen="projects"><PmProjectsPage /></PmGuard>} />
            {/* the new-project form is a drawer on the Projects page */}
            <Route path="new" element={<Navigate to="/modules/projects/list?new=1" replace />} />
            <Route path="p/:projectId" element={<PmGuard screen="projects"><PmProjectDetailPage /></PmGuard>} />
            <Route path="tasks" element={<PmGuard screen="tasks"><PmTasksPage /></PmGuard>} />
            <Route path="daily-plan" element={<PmGuard screen="daily_plan"><PmDailyPlanPage /></PmGuard>} />
            <Route path="team-calendar" element={<PmGuard screen="team_calendar"><PmTeamCalendarPage /></PmGuard>} />
            <Route path="meetings" element={<PmGuard screen="meetings"><PmMeetingsPage /></PmGuard>} />
            <Route path="tickets" element={<PmGuard screen="tickets"><PmTicketsPage /></PmGuard>} />
            <Route path="clients" element={<PmGuard screen="clients"><PmClientsPage /></PmGuard>} />
            {/* Templates live under Setup; the old address still works */}
            <Route path="templates" element={<Navigate to="/modules/projects/setup/templates" replace />} />
            <Route path="messages" element={<PmGuard any={["notification_rules", "reports", "setup"]}><PmMessageLogPage /></PmGuard>} />
            <Route path="notifications" element={<PmNotificationsPage />} />
            <Route path="products/:productId" element={<PmGuard screen="setup"><ProductBuilderPage /></PmGuard>} />
            <Route path="setup" element={<PmGuard screen="setup"><PmSetupPage /></PmGuard>} />
            <Route path="setup/:slug" element={<PmGuard screen="setup"><PmSetupPage /></PmGuard>} />
          </Route>
          <Route path="modules/:module" element={<ModulePage />} />
          {/* Notification Center (Phase 11 stub) — top-level entry from the
              bell in the top bar. Same page also renders inside Communication. */}
          <Route path="notifications" element={<NotificationsPage />} />
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
          <Route path="applications" element={<Applications />} />
          <Route path="targets" element={<Targets />} />
          <Route path="reports" element={<Reports />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="partners" element={<Partners />} />
          <Route path="queries" element={<Queries />} />
          <Route path="lists" element={<LeadLists />} />
          <Route path="activities" element={<ActivityRegister />} />
          <Route path="automation" element={<Automation />} />
          <Route path="settings" element={<CrmSettings />} />
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
