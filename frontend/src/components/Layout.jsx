import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./ui";
import BreadcrumbNav from "./BreadcrumbNav";

const NAV = [
  {
    items: [
      { to: "/", end: true, icon: "house", label: "Home", module: "dashboard" },
    ],
  },
  {
    label: "WhatsApp Manager",
    items: [
      { to: "/crm/chat", icon: "chat-dots", label: "Conversations", module: "chat" },
      { to: "/crm/campaigns", icon: "send", label: "Bulk Campaigns", module: "blast" },
      { to: "/crm/history", icon: "clock-history", label: "Message History", module: "reports" },
      { to: "/crm/templates", icon: "file-text", label: "Templates", module: "blast" },
      { to: "/crm/media", icon: "collection-play", label: "Manage Media", module: "setup" },
      { to: "/crm/chatbot", icon: "robot", label: "Chatbot & Bot Flows", module: "setup" },
    ],
  },
  {
    label: "CRM",
    items: [
      { to: "/crm", end: true, icon: "speedometer2", label: "Dashboard", module: "dashboard" },
      { to: "/crm/leads", icon: "flag", label: "Leads", module: "leads" },
      { to: "/crm/followups", icon: "bell", label: "Follow-ups", module: "followups" },
      { to: "/crm/conversion", icon: "graph-up", label: "Conversion", module: "conversion" },
      { to: "/crm/contacts", icon: "people", label: "Contacts", module: "contacts" },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/crm/setup", icon: "gear", label: "Setup", module: "setup" },
      { to: "/crm/audit", icon: "shield-check", label: "Audit Logs", module: "reports" },
    ],
  },
];

const TITLES = {
  "/": "Home",
  "/crm": "Dashboard",
  "/crm/leads": "Leads",
  "/crm/followups": "Follow-ups",
  "/crm/conversion": "Conversion Dashboard",
  "/crm/contacts": "Contacts",
  "/crm/chat": "Conversations",
  "/crm/campaigns": "Bulk Campaigns",
  "/crm/history": "Message History",
  "/crm/templates": "Templates",
  "/crm/media": "Manage Media",
  "/crm/chatbot": "Chatbot & Bot Flows",
  "/crm/setup": "Setup",
  "/crm/audit": "Audit Logs",
};

const findSectionForPath = (pathname) => {
  const entry = NAV.find((group) => group.items.some((it) => it.to === pathname));
  return entry ? entry.label : "";
};

export default function Layout() {
  const { user, logout, can } = useAuth();
  const loc = useLocation();
  const title = TITLES[loc.pathname] || "CRM";
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const stored = localStorage.getItem("sidebar-open");
    return stored !== null ? JSON.parse(stored) : true;
  });

  useEffect(() => {
    localStorage.setItem("sidebar-open", JSON.stringify(sidebarOpen));
  }, [sidebarOpen]);

  const [expandedSection, setExpandedSection] = useState(() => {
    return findSectionForPath(window.location.pathname) || "WhatsApp Manager";
  });

  const activeSection = findSectionForPath(loc.pathname);

  useEffect(() => {
    if (activeSection) setExpandedSection(activeSection);
  }, [activeSection]);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleSection = (section) => setExpandedSection((current) => (current === section ? "" : section));

  const isPreviewOnly = loc.search.includes("startScreen=preview_only");
  if (isPreviewOnly) {
    return (
      <div style={{ height: "100vh", width: "100vw", overflow: "hidden" }}>
        <Outlet />
      </div>
    );
  }

  return (
    <div className={`crm-theme app-shell ${sidebarOpen ? "" : "sidebar-closed"}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <span className="mark"><i className="bi bi-whatsapp"></i></span>
            <div className="brand-copy">
              <div className="brand-title">CRM</div>
              <div className="brand-sub">Admissions Suite</div>
            </div>
          </div>
          <button
            className="sidebar-toggle btn btn-sm btn-outline-dark border-0"
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            onClick={toggleSidebar}
          >
            <i className={`bi ${sidebarOpen ? "bi-layout-sidebar" : "bi-layout-sidebar-reverse"}`}></i>
          </button>
        </div>

        <div className="flex-grow-1 overflow-auto">
          {NAV.map((group, idx) => {
            const visible = group.items.filter((it) => can(it.module, "view"));
            if (!visible.length) return null;
            const hasLabel = Boolean(group.label);
            const isOpen = !hasLabel || expandedSection === group.label;
            return (
              <div className="nav-section" key={group.label || `group-${idx}`}>
                {hasLabel && (
                  <button
                    type="button"
                    className={`nav-label nav-toggle ${isOpen ? "open" : ""}`}
                    onClick={() => toggleSection(group.label)}
                  >
                    <span>{group.label}</span>
                    <i className={`bi bi-chevron-${isOpen ? "down" : "right"}`} />
                  </button>
                )}
                <div className={`nav-group ${isOpen ? "open" : "collapsed"}`}>
                  {visible.map((it) => (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      end={it.end}
                      className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
                    >
                      <i className={`bi bi-${it.icon}`}></i>
                      <span>{it.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="side-footer">
          <Avatar name={user?.name || "?"} size={30} />
          <div className="flex-grow-1 min-w-0">
            <div className="text-dark text-truncate" style={{ fontSize: 12.5, fontWeight: 500 }}>{user?.name}</div>
            <div className="text-truncate" style={{ fontSize: 10.5, color: "#6b7480" }}>{user?.userType?.name}</div>
          </div>
          <button className="btn btn-sm btn-outline-dark border-0" title="Log out" onClick={logout} style={{ minHeight: 30, padding: "0.35rem 0.5rem" }}>
            <i className="bi bi-box-arrow-right"></i>
          </button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar px-3 d-flex align-items-center justify-content-between">
          <BreadcrumbNav />
          <div className="ms-auto d-flex align-items-center gap-3 text-secondary">
            <i className="bi bi-bell"></i>
            <span className="small">{user?.email}</span>
          </div>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
