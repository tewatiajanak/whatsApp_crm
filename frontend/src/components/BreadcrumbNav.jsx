import { Link, useLocation } from "react-router-dom";

// Mapping Setup active sections to parent Category titles
const SETUP_CATEGORIES = {
  offerings: { category: "Lead Configuration", label: "Offerings" },
  status: { category: "Lead Configuration", label: "Lead Statuses" },
  sources: { category: "Lead Configuration", label: "Sources" },
  "enquiry-form": { category: "Forms", label: "Enquiry Form" },
  "registration-form": { category: "Forms", label: "Registration Form" },
  "landing-page": { category: "Forms", label: "Landing Page" },
  "ui-theme": { category: "UI", label: "Theme Customization" },
  sessions: { category: "Academic Setup", label: "Academic Sessions" },
  grades: { category: "Academic Setup", label: "Grades" },
  teams: { category: "Workflows", label: "Teams" },
  workflows: { category: "Workflows", label: "Workflows" },
  "comm-templates": { category: "Workflows", label: "Communication Templates" },
  "whatsapp-templates": { category: "Workflows", label: "WhatsApp Template" },
  "whatsapp-integration": { category: "Integrations", label: "WhatsApp Integration" },
  facebook: { category: "Integrations", label: "Facebook" },
  "organization-details": { category: "General", label: "Organization Details" },
  "ai-integration": { category: "Integrations", label: "AI Integration" },
  "facebook-integration": { category: "Integrations", label: "Facebook Integration" },
  "custom-fields": { category: "Custom", label: "Custom Fields" },
  "module-whatsapp-templates": { category: "Communication Templates", label: "WhatsApp Template" },
  "module-sms-templates": { category: "Communication Templates", label: "SMS Template" },
  "module-email-templates": { category: "Communication Templates", label: "Email Template" },
};

// Labels for Setup / Configuration sub-pages, keyed by slug (kept in sync with
// CONFIGURATION_CATEGORIES in knowvato-main/routes/modules.$module.tsx).
const SLUG_LABELS = {
  "organization-details": "Organization Details",
  branding: "Branding & White-label",
  users: "Users",
  roles: "Roles",
  "user-types": "User Types",
  "password-policy": "Password Policy",
  departments: "Departments",
  security: "Security",
  "audit-logs": "Audit Logs",
  files: "Files",
  "backup-export": "Backup & Export",
  "event-types": "Event Category",
  "event-categories": "Attendee Category",
  "event-statuses": "Event Statuses",
  "task-statuses": "Task Statuses",
  venues: "Venue",
  "certificate-templates": "Certificate Design",
  "form-templates": "Event Form Design",
  "field-library": "Custom Fields",
  "pass-templates": "Pass Templates",
  "subscription-usage": "Subscription & Usage",
  "platform-invoices": "Platform Invoices",
  "billing-details": "Billing Details & Methods",
  "payment-gateways": "Payment Gateways",
  "taxes-invoicing": "Taxes & Invoicing",
  "templates-whatsapp": "WhatsApp Template",
  "templates-sms": "SMS Template",
  "templates-email": "Email Template",
  "message-delivery": "Message Delivery",
  "staff-notifications": "Staff Notifications",
  "integrations-ai": "AI Integration",
  "integrations-whatsapp": "WhatsApp Integration",
  "integrations-email": "Email Integration",
  "integrations-sms": "SMS Integration",
  "integrations-push": "Push Notifications",
  "integrations-facebook": "Facebook Integration",
  "integrations-payment": "Payment Gateway Integration",
  "integrations-api-keys": "API Access & Keys",
  "integrations-other": "Other API Integration",
  "event-id-formats": "Event ID Formats",
  "task-checklist": "Task Checklist",
  "master-lists": "Master Lists",
  "seating-maps": "Seating Maps",
  "privacy-requests": "Privacy Requests",
  "page-templates": "Landing Page Templates",
};

// Modules with their own sidebar submenu: sub-path -> page label ("" = index).
const MODULE_PAGES = {
  events: {
    label: "Event Manager",
    pages: {
      "": "Overview",
      all: "Events",
      create: "Create Event",
      new: "Create Event",
      calendar: "Calendar",
      communication: "Communication",
      tasks: "Tasks",
      registrants: "Registrants",
      payments: "Payments",
      scan: "Scan Pass",
      attendance: "Attendance",
      qr: "Generate QR",
      "bulk-qr": "Bulk QR",
      activity: "Activity Log",
    },
  },
  "front-office": {
    label: "Front Office",
    pages: {
      "": "Today Visitors",
      "visitors/today": "Today Visitors",
      "visitors/upcoming": "Upcoming Visitors",
    },
  },
  website: { label: "Website Builder", pages: { "": "Overview" } },
  communication: {
    label: "Communication",
    pages: {
      "": "Overview",
      campaigns: "Campaigns",
      "automated-messages": "Automated Messages",
      logs: "Message Logs",
      "notification-center": "Notification Center",
    },
  },
  automation: {
    label: "Automation",
    pages: { "": "Workflows", templates: "Workflow Templates", runs: "Runs", webhooks: "Webhooks" },
  },
  reports: {
    label: "Reports & Analytics",
    pages: {
      "": "Overview",
      builder: "Report Builder",
      saved: "Saved Reports",
      scheduled: "Scheduled Reports",
      exports: "Exports & Downloads",
      analytics: "Org Analytics",
    },
  },
  utilities: {
    label: "Utilities",
    pages: { "": "Overview", qr: "QR Code Studio", "video-edit": "Video Editor", "photo-edit": "Photo Studio" },
  },
};

const SEGMENT_LABELS = { sa: "Super Admin", crm: "CRM", me: "Participant Portal", explore: "Event Discovery" };
const titleCase = (seg) => SEGMENT_LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");

export default function BreadcrumbNav() {
  const location = useLocation();
  const pathname = location.pathname;
  const searchParams = new URLSearchParams(location.search);
  const activeSection = searchParams.get("active") || "offerings";
  const mode = searchParams.get("mode") || "list";

  const getCrumbs = () => {
    // 1. Root / Home
    if (pathname === "/") {
      return [{ label: "Home", to: "/" }];
    }

    // 2. WhatsApp CRM Routes (/crm/...)
    if (pathname === "/crm") {
      return [
        { label: "Home", to: "/" },
        { label: "CRM", to: "/crm" },
        { label: "Dashboard" }
      ];
    }

    if (pathname === "/crm/leads") {
      return [
        { label: "Home", to: "/" },
        { label: "CRM", to: "/crm" },
        { label: "Leads" }
      ];
    }

    if (pathname.startsWith("/crm/leads/registration")) {
      return [
        { label: "Home", to: "/" },
        { label: "CRM", to: "/crm" },
        { label: "Leads", to: "/crm/leads" },
        { label: "Lead Registration" }
      ];
    }

    if (pathname === "/crm/followups") {
      return [
        { label: "Home", to: "/" },
        { label: "CRM", to: "/crm" },
        { label: "Follow-ups" }
      ];
    }

    if (pathname === "/crm/conversion") {
      return [
        { label: "Home", to: "/" },
        { label: "CRM", to: "/crm" },
        { label: "Conversion Dashboard" }
      ];
    }

    if (pathname === "/crm/contacts") {
      return [
        { label: "Home", to: "/" },
        { label: "CRM", to: "/crm" },
        { label: "Contacts" }
      ];
    }

    if (pathname === "/crm/chat") {
      return [
        { label: "Home", to: "/" },
        { label: "WhatsApp Manager", to: "/crm/chat" },
        { label: "Conversations" }
      ];
    }

    if (pathname === "/crm/campaigns") {
      return [
        { label: "Home", to: "/" },
        { label: "WhatsApp Manager", to: "/crm/chat" },
        { label: "Bulk Campaigns" }
      ];
    }

    if (pathname === "/crm/history") {
      return [
        { label: "Home", to: "/" },
        { label: "WhatsApp Manager", to: "/crm/chat" },
        { label: "Message History" }
      ];
    }

    if (pathname === "/crm/templates") {
      return [
        { label: "Home", to: "/" },
        { label: "WhatsApp Manager", to: "/crm/chat" },
        { label: "Templates" }
      ];
    }

    if (pathname === "/crm/media") {
      return [
        { label: "Home", to: "/" },
        { label: "WhatsApp Manager", to: "/crm/chat" },
        { label: "Manage Media" }
      ];
    }

    if (pathname.startsWith("/crm/chatbot")) {
      return [
        { label: "Home", to: "/" },
        { label: "WhatsApp Manager", to: "/crm/chat" },
        { label: "Chatbot & Bot Flows" }
      ];
    }

    if (pathname === "/crm/audit") {
      return [
        { label: "Home", to: "/" },
        { label: "CRM", to: "/crm" },
        { label: "Audit Logs" }
      ];
    }

    if (pathname.startsWith("/crm/setup/enquiry-forms")) {
      return [
        { label: "Home", to: "/" },
        { label: "CRM", to: "/crm" },
        { label: "Setup", to: "/crm/setup" },
        { label: "Forms", to: "/crm/setup?active=enquiry-form" },
        { label: "Enquiry Form Builder" }
      ];
    }

    if (pathname === "/crm/setup") {
      const secInfo = SETUP_CATEGORIES[activeSection] || { category: "Setup", label: "Setup" };
      const crumbs = [
        { label: "Home", to: "/" },
        { label: "CRM", to: "/crm" },
        { label: "Setup", to: "/crm/setup" },
        { label: secInfo.category, to: `/crm/setup?active=${activeSection}` },
        { label: secInfo.label, to: mode === "editor" ? `/crm/setup?active=${activeSection}&mode=list` : null }
      ];

      if (mode === "editor") {
        if (activeSection === "whatsapp-templates") crumbs.push({ label: "Edit Template" });
        else if (activeSection === "registration-form") crumbs.push({ label: "Edit Registration Form" });
        else if (activeSection === "landing-page") crumbs.push({ label: "Edit Landing Page" });
        else crumbs.push({ label: "Editor" });
      }

      return crumbs;
    }

    // 3. KnowVato Main Modules (/modules/...)
    if (pathname.startsWith("/modules/")) {
      const [slug, ...restSegs] = pathname.slice("/modules/".length).split("/").filter(Boolean);
      const rest = restSegs.join("/");
      const home = { label: "Home", to: "/" };

      if (slug === "configuration") return [home, { label: "Configuration" }];

      const mod = MODULE_PAGES[slug];
      if (mod) {
        const base = `/modules/${slug}`;
        const crumbs = [home, { label: mod.label, to: base }];
        if (restSegs[0] === "setup") {
          const sub = restSegs[1];
          if (!sub) crumbs.push({ label: "Setup" });
          else crumbs.push({ label: "Setup", to: `${base}/setup` }, { label: SLUG_LABELS[sub] || titleCase(sub) });
        } else if (mod.pages[rest] !== undefined) {
          crumbs.push({ label: mod.pages[rest] });
        } else if (slug === "events") {
          // /modules/events/:eventId/... — a single event's pages
          const sub = { attendees: "Attendees", upload: "Upload Data", logs: "Activity Log", passes: "Generate Pass", edit: "Edit Event" }[restSegs[1]];
          crumbs.push({ label: "Events", to: `${base}/all` }, { label: sub || "Event Details" });
        } else {
          crumbs.push({ label: titleCase(restSegs[restSegs.length - 1]) });
        }
        return crumbs;
      }

      // Everything else under /modules/<slug> is a Configuration sub-page.
      return [
        home,
        { label: "Configuration", to: "/modules/configuration" },
        { label: SLUG_LABELS[slug] || titleCase(slug || "Configuration") }
      ];
    }

    // Default Fallback Breadcrumb
    const pathSegments = pathname.split("/").filter(Boolean);
    const crumbs = [{ label: "Home", to: "/" }];
    let accPath = "";
    pathSegments.forEach((seg, i) => {
      accPath += `/${seg}`;
      const title = titleCase(seg);
      if (i === pathSegments.length - 1) {
        crumbs.push({ label: title });
      } else {
        crumbs.push({ label: title, to: accPath });
      }
    });

    return crumbs;
  };

  const crumbs = getCrumbs();

  return (
    <nav className="breadcrumb-nav d-inline-flex align-items-center gap-1.5 min-w-0" aria-label="breadcrumb">
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <div key={idx} className="d-inline-flex align-items-center gap-1.5 min-w-0 text-truncate">
            {idx > 0 && (
              <i className="bi bi-chevron-double-right text-muted opacity-50" style={{ fontSize: "10px" }} />
            )}
            {crumb.to && !isLast ? (
              <Link
                to={crumb.to}
                className="text-decoration-none text-secondary hover-primary d-inline-flex align-items-center gap-1"
                style={{ fontSize: "12.5px", fontWeight: 500 }}
              >
                {idx === 0 && <i className="bi bi-house me-0.5" style={{ fontSize: "12px" }}></i>}
                <span className="text-truncate">{crumb.label}</span>
              </Link>
            ) : (
              <span
                className={`text-truncate ${isLast ? "fw-semibold text-slate-900" : "text-secondary"}`}
                style={{ fontSize: "12.5px" }}
              >
                {idx === 0 && <i className="bi bi-house me-0.5" style={{ fontSize: "12px" }}></i>}
                {crumb.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
