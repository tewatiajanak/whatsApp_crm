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
  "google-form": { category: "Integrations", label: "Google Form" },
  "api-integration": { category: "Integrations", label: "API Integration" },
};

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

    if (pathname.startsWith("/crm/chatbot")) {
      return [
        { label: "Home", to: "/" },
        { label: "WhatsApp Manager", to: "/crm/chat" },
        { label: "Chatbot & Bot Flows", to: "/crm/chatbot" }
      ];
    }

    if (pathname === "/crm/audit") {
      return [
        { label: "Home", to: "/" },
        { label: "Administration", to: "/crm/setup" },
        { label: "Audit Logs" }
      ];
    }

    if (pathname.startsWith("/crm/setup/enquiry-forms")) {
      return [
        { label: "Home", to: "/" },
        { label: "Administration", to: "/crm/setup" },
        { label: "Setup", to: "/crm/setup" },
        { label: "Forms", to: "/crm/setup?active=enquiry-form" },
        { label: "Enquiry Form Builder" }
      ];
    }

    if (pathname === "/crm/setup") {
      const secInfo = SETUP_CATEGORIES[activeSection] || { category: "Setup", label: "Setup" };
      const crumbs = [
        { label: "Home", to: "/" },
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
    if (pathname.startsWith("/modules/events")) {
      const crumbs = [
        { label: "Home", to: "/" },
        { label: "Event Manager", to: "/modules/events" }
      ];
      if (pathname === "/modules/events/create") crumbs.push({ label: "Create Event" });
      else if (pathname === "/modules/events/registrants") crumbs.push({ label: "Registrants" });
      else if (pathname === "/modules/events/scan") crumbs.push({ label: "Scan Pass" });
      else if (pathname === "/modules/events/qr") crumbs.push({ label: "Generate QR" });
      else if (pathname === "/modules/events/bulk-qr") crumbs.push({ label: "Bulk QR" });
      else crumbs.push({ label: "Dashboard" });
      return crumbs;
    }

    if (pathname.startsWith("/modules/utilities")) {
      const crumbs = [
        { label: "Home", to: "/" },
        { label: "Utilities", to: "/modules/utilities" }
      ];
      if (pathname === "/modules/utilities/qr") crumbs.push({ label: "QR Code Studio" });
      else if (pathname === "/modules/utilities/video-edit") crumbs.push({ label: "Video Editor" });
      else if (pathname === "/modules/utilities/photo-edit") crumbs.push({ label: "Photo Studio" });
      return crumbs;
    }

    if (pathname.startsWith("/modules/integrations")) {
      const slug = pathname.replace("/modules/", "");
      const labelMap = {
        "integrations-whatsapp": "WhatsApp Integration",
        "integrations-email": "Email Integration",
        "integrations-sms": "SMS Integration",
        "integrations-facebook": "Facebook Integration",
        "integrations-other": "API Integration"
      };
      return [
        { label: "Home", to: "/" },
        { label: "Configuration", to: "/modules/configuration" },
        { label: labelMap[slug] || "Integration" }
      ];
    }

    if (pathname.startsWith("/modules/configuration")) {
      return [
        { label: "Home", to: "/" },
        { label: "Configuration" }
      ];
    }

    // Default Fallback Breadcrumb
    const pathSegments = pathname.split("/").filter(Boolean);
    const crumbs = [{ label: "Home", to: "/" }];
    let accPath = "";
    pathSegments.forEach((seg, i) => {
      accPath += `/${seg}`;
      const title = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
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
