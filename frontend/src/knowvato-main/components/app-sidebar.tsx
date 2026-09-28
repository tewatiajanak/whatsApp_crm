import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  CalendarRange,
  MessageSquare,
  Globe2,
  Users,
  Megaphone,
  Building2,
  BarChart3,
  Settings,
  LogIn,
  LogOut,
  LayoutDashboard,
  Bookmark,
  ChevronRight,
  ChevronDown,
  Home,
  CalendarPlus,
  ScanLine,
  QrCode,
  Layers,
  UserCheck,
  X,
  Sparkles,
  Film,
} from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "../../context/AuthContext";
import { useBookmarks } from "@/lib/bookmarks";

const modules = [
  { title: "Event Manager", slug: "events", icon: CalendarRange },
  { title: "CRM", slug: "whatsapp", icon: MessageSquare },
  { title: "Website Builder", slug: "website", icon: Globe2 },
  { title: "Communication", slug: "communication", icon: Megaphone },
  { title: "Front Office", slug: "front-office", icon: Building2 },
  { title: "Reports & Analytics", slug: "reports", icon: BarChart3 },
  { title: "Utilities", slug: "utilities", icon: Sparkles },
];

// Configuration submodule slugs (kept in sync with CONFIGURATION_CATEGORIES in
// routes/modules.$module.tsx). Used to detect whether the Configuration nav
// pill should show as active.
const CONFIGURATION_SUBSLUGS = new Set([
  "organization-details",
  "users",
  "roles",
  "departments",
  "security",
  "audit-logs",
  "files",
  "subscription-usage",
]);

const eventsSubmenu = [
  { title: "Dashboard", path: "/modules/events", icon: LayoutDashboard, exact: true },
  { title: "Create Event", path: "/modules/events/create", icon: CalendarPlus },
  { title: "Registrants", path: "/modules/events/registrants", icon: UserCheck },
  { title: "Scan Pass", path: "/modules/events/scan", icon: ScanLine },
];

const utilitiesSubmenu = [
  { title: "QR Code", path: "https://qr.nirvaantechnologies.in", icon: QrCode, external: true },
  { title: "Video Edit", path: "https://fve.nirvaantechnologies.in", icon: Film, external: true },
];

export function AppSidebar() {
  const { state, toggleSidebar, openMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const pathname = location.pathname;
  const { user, logout } = useAuth();
  const { bookmarks } = useBookmarks();
  const [utilitiesOpen, setUtilitiesOpen] = useState(false);

  const handleLinkClick = () => {
    if (openMobile) setOpenMobile(false);
  };

  const configSlug = pathname.startsWith("/modules/")
    ? pathname.slice("/modules/".length).split("/")[0]
    : "";
  const isConfigurationPath =
    pathname.startsWith("/modules/integrations-") ||
    pathname.startsWith("/modules/templates-") ||
    pathname === "/modules/configuration" ||
    CONFIGURATION_SUBSLUGS.has(configSlug);

  const renderNavItems = (isMobileDrawer = false) => {
    const isCollapsed = isMobileDrawer ? false : collapsed;
    return (
      <div className="flex-grow overflow-y-auto py-2">
        {pathname.startsWith("/modules/events") ? (
          <div className="nav-section px-2 py-1">
            {!isCollapsed && (
              <div className="nav-label text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--sidebar-muted)] px-2 py-1.5">
                Event Manager
              </div>
            )}
            <div className="space-y-1">
              <Link
                to="/"
                onClick={handleLinkClick}
                title="Home"
                className={`nav-link text-decoration-none flex items-center ${
                  isCollapsed ? "justify-center p-2.5 w-[44px] h-[44px] mx-auto rounded-lg" : "gap-3 px-3 py-2 rounded-lg text-[14px]"
                } ${pathname === "/" ? "active bg-[var(--sidebar-primary)] text-white font-medium shadow-xs" : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]"}`}
              >
                <Home className="h-4 w-4 shrink-0" />
                {!isCollapsed && <span>Home</span>}
              </Link>
              {eventsSubmenu.map((s) => {
                const active = pathname === s.path;
                const Icon = s.icon;
                return (
                  <Link
                    key={s.path}
                    to={s.path}
                    onClick={handleLinkClick}
                    title={s.title}
                    className={`nav-link text-decoration-none flex items-center ${
                      isCollapsed ? "justify-center p-2.5 w-[44px] h-[44px] mx-auto rounded-lg" : "gap-3 px-3 py-2 rounded-lg text-[14px]"
                    } ${active ? "active bg-[var(--sidebar-primary)] text-white font-medium shadow-xs" : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]"}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!isCollapsed && <span>{s.title}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : pathname.startsWith("/modules/utilities") ? (
          <div className="nav-section px-2 py-1">
            {!isCollapsed && (
              <div className="nav-label text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--sidebar-muted)] px-2 py-1.5 flex items-center justify-between">
                <span>Utilities</span>
              </div>
            )}
            <div className="space-y-1">
              <Link
                to="/"
                onClick={handleLinkClick}
                title="Home"
                className={`nav-link text-decoration-none flex items-center ${
                  isCollapsed ? "justify-center p-2.5 w-[44px] h-[44px] mx-auto rounded-lg" : "gap-3 px-3 py-2 rounded-lg text-[14px]"
                } ${pathname === "/" ? "active bg-[var(--sidebar-primary)] text-white font-medium shadow-xs" : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]"}`}
              >
                <Home className="h-4 w-4 shrink-0" />
                {!isCollapsed && <span>Home</span>}
              </Link>
              {utilitiesSubmenu.map((s) => {
                const active = pathname === s.path;
                const Icon = s.icon;
                return (
                  <Link
                    key={s.path}
                    to={s.path}
                    onClick={handleLinkClick}
                    title={s.title}
                    className={`nav-link text-decoration-none flex items-center ${
                      isCollapsed ? "justify-center p-2.5 w-[44px] h-[44px] mx-auto rounded-lg" : "gap-3 px-3 py-2 rounded-lg text-[14px]"
                    } ${active ? "active bg-[var(--sidebar-primary)] text-white font-medium shadow-xs" : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]"}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!isCollapsed && <span>{s.title}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {/* Workspace */}
            <div className="nav-section px-2 py-1">
              {!isCollapsed && (
                <div className="nav-label text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--sidebar-muted)] px-2 py-1.5">
                  Workspace
                </div>
              )}
              <div className="space-y-1">
                <Link
                  to="/"
                  onClick={handleLinkClick}
                  title="Dashboard"
                  className={`nav-link text-decoration-none flex items-center ${
                    isCollapsed ? "justify-center p-2.5 w-[44px] h-[44px] mx-auto rounded-lg" : "gap-3 px-3 py-2 rounded-lg text-[14px]"
                  } ${pathname === "/" ? "active bg-[var(--sidebar-primary)] text-white font-medium shadow-xs" : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]"}`}
                >
                  <LayoutDashboard className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span>Dashboard</span>}
                </Link>
              </div>
            </div>

            {/* Modules */}
            <div className="nav-section px-2 py-1">
              {!isCollapsed && (
                <div className="nav-label text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--sidebar-muted)] px-2 py-1.5">
                  Modules
                </div>
              )}
              <div className="space-y-1">
                {modules.map((m) => {
                  if (m.slug === "utilities") {
                    const isUtilitiesActive = pathname.startsWith("/modules/utilities");
                    const Icon = m.icon;
                    if (isCollapsed) {
                      return (
                        <Link
                          key={m.slug}
                          to="/modules/utilities/qr"
                          onClick={handleLinkClick}
                          title="Utilities"
                          className={`nav-link text-decoration-none flex items-center justify-center p-2.5 w-[44px] h-[44px] mx-auto rounded-lg ${
                            isUtilitiesActive
                              ? "active bg-[var(--sidebar-primary)] text-white font-medium shadow-xs"
                              : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                        </Link>
                      );
                    }

                    return (
                      <div key={m.slug} className="space-y-1">
                        <div
                          onClick={() => setUtilitiesOpen((prev) => !prev)}
                          className={`nav-link text-decoration-none flex items-center justify-between gap-2.5 px-2.5 py-1.75 rounded-lg text-[12.75px] cursor-pointer transition-colors ${
                            isUtilitiesActive
                              ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] font-medium"
                              : "text-[var(--sidebar-foreground)] hover:bg-[rgba(33,126,121,0.04)]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{m.title}</span>
                          </div>
                          <ChevronDown
                            className={`h-3.5 w-3.5 text-[var(--sidebar-muted)] transition-transform duration-200 ${
                              utilitiesOpen ? "" : "-rotate-90"
                            }`}
                          />
                        </div>

                        {/* Drill down submenu items */}
                        {utilitiesOpen && (
                          <div className="pl-4 pr-1 py-1 space-y-1 border-l border-[var(--sidebar-border)] ml-4 my-1">
                            {utilitiesSubmenu.map((sub) => {
                              const subActive = pathname === sub.path;
                              const SubIcon = sub.icon;

                              if (sub.external) {
                                return (
                                  <a
                                    key={sub.path}
                                    href={sub.path}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={handleLinkClick}
                                    title={sub.title}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] text-decoration-none transition-colors ${
                                      subActive
                                        ? "bg-[var(--sidebar-primary)] text-white font-medium shadow-xs"
                                        : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]"
                                    }`}
                                  >
                                    <SubIcon className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{sub.title}</span>
                                  </a>
                                );
                              }

                              return (
                                <Link
                                  key={sub.path}
                                  to={sub.path}
                                  onClick={handleLinkClick}
                                  title={sub.title}
                                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] text-decoration-none transition-colors ${
                                    subActive
                                      ? "bg-[var(--sidebar-primary)] text-white font-medium shadow-xs"
                                      : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]"
                                  }`}
                                >
                                  <SubIcon className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{sub.title}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  const url =
                    m.slug === "whatsapp"
                      ? "/crm"
                      : m.slug === "events"
                      ? "/modules/events"
                      : `/modules/${m.slug}`;
                  const active =
                    pathname === url ||
                    (m.slug === "whatsapp" && pathname.startsWith("/crm"));
                  const Icon = m.icon;
                  return (
                    <Link
                      key={m.slug}
                      to={url}
                      onClick={handleLinkClick}
                      title={m.title}
                      className={`nav-link text-decoration-none flex items-center ${
                        isCollapsed ? "justify-center p-2 w-[38px] h-[38px] mx-auto rounded-lg" : "gap-2.5 px-2.5 py-1.75 rounded-lg text-[12.75px]"
                      } ${active ? "active bg-[var(--sidebar-primary)] text-white font-medium shadow-xs" : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]"}`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {!isCollapsed && <span>{m.title}</span>}
                    </Link>
                  );
                })}

                <Link
                  to="/modules/configuration"
                  onClick={handleLinkClick}
                  title="Configuration"
                  className={`nav-link text-decoration-none flex items-center ${
                    isCollapsed ? "justify-center p-2 w-[38px] h-[38px] mx-auto rounded-lg" : "gap-2.5 px-2.5 py-1.75 rounded-lg text-[12.75px]"
                  } ${isConfigurationPath ? "active bg-[var(--sidebar-primary)] text-white font-medium shadow-xs" : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]"}`}
                >
                  <Settings className="h-3.5 w-3.5 shrink-0" />
                  {!isCollapsed && <span>Configuration</span>}
                </Link>
              </div>
            </div>

            {/* Bookmarks */}
            {bookmarks.length > 0 && (
              <div className="nav-section px-2 py-1">
                {!isCollapsed && (
                  <div className="nav-label text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--sidebar-muted)] px-2 py-1.5">
                    Bookmarks
                  </div>
                )}
                <div className="space-y-1">
                  {bookmarks.map((b) => {
                    const slug = b.url.replace("/modules/", "");
                    const active = pathname === b.url;
                    return (
                      <Link
                        key={b.url}
                        to={`/modules/${slug}`}
                        onClick={handleLinkClick}
                        title={b.title}
                        className={`nav-link text-decoration-none flex items-center ${
                          isCollapsed ? "justify-center p-2 w-[38px] h-[38px] mx-auto rounded-lg" : "gap-2.5 px-2.5 py-1.75 rounded-lg text-[12.75px]"
                        } ${active ? "active bg-[var(--sidebar-primary)] text-white font-medium shadow-xs" : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]"}`}
                      >
                        <Bookmark className="h-3.5 w-3.5 shrink-0" />
                        {!isCollapsed && <span className="truncate">{b.title}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderHeader = (isMobileDrawer = false) => {
    const isCollapsed = isMobileDrawer ? false : collapsed;
    return (
      <div className={`sidebar-header border-b border-[var(--sidebar-border)] p-3 flex items-center ${isCollapsed ? "justify-center" : "justify-between"} min-h-[56px]`}>
        <div className="brand flex items-center gap-2.5 min-w-0">
          <span className="mark w-[34px] h-[34px] rounded-[10px] bg-[var(--sidebar-primary)] text-white flex items-center justify-center font-bold flex-shrink-0">
            <i className="bi bi-layers-half text-base"></i>
          </span>
          <div className="brand-copy flex flex-col min-w-0">
            <div className="brand-title text-[14px] font-semibold text-[var(--sidebar-foreground)] truncate">KnowVato Solutions</div>
            <div className="brand-sub text-[10.5px] text-[var(--sidebar-muted)] truncate">Admissions Suite</div>
          </div>
        </div>
        {isMobileDrawer ? (
          <button
            className="p-1.5 rounded-lg text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-accent)]"
            onClick={() => setOpenMobile(false)}
          >
            <X size={20} />
          </button>
        ) : (
          <button
            className="sidebar-toggle btn btn-sm border-0 p-1 flex-shrink-0 text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleSidebar}
          >
            <i className={`bi ${collapsed ? "bi-layout-sidebar-reverse" : "bi-layout-sidebar"} text-base`}></i>
          </button>
        )}
      </div>
    );
  };

  const renderFooter = (isMobileDrawer = false) => {
    const isCollapsed = isMobileDrawer ? false : collapsed;
    return (
      <div className="side-footer border-t border-[var(--sidebar-border)] p-3 mt-auto flex items-center justify-between min-h-[56px]">
        {user ? (
          <div className={`flex items-center w-full gap-2 ${isCollapsed ? "justify-center" : "justify-between"}`}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-[30px] h-[30px] rounded-full bg-[var(--sidebar-primary)] text-white flex items-center justify-center text-xs font-semibold shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <div className="text-[12.5px] font-medium text-[var(--sidebar-foreground)] truncate">{user.name}</div>
                  <div className="text-[10.5px] text-[var(--sidebar-muted)] truncate">{user.userType?.name || user.email}</div>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <button
                className="btn btn-sm border-0 p-1 shrink-0 text-[var(--sidebar-muted)] hover:text-[var(--sidebar-foreground)]"
                title="Log out"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <Link
            to="/login"
            onClick={handleLinkClick}
            title="Log in"
            className={`nav-link text-decoration-none flex items-center ${
              isCollapsed ? "justify-center p-2.5 w-[44px] h-[44px] mx-auto rounded-lg" : "gap-3 px-3 py-2 rounded-lg text-[14px]"
            } text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]`}
          >
            <LogIn className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span>Log in</span>}
          </Link>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop & Drawer */}
      {openMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setOpenMobile(false)}
          />
          <div className="relative z-50 w-72 max-w-[85vw] bg-[var(--sidebar)] text-[var(--sidebar-foreground)] h-full flex flex-col shadow-[0_20px_48px_rgba(19,29,35,0.14)] border-r border-[var(--sidebar-border)]">
            {renderHeader(true)}
            {renderNavItems(true)}
            {renderFooter(true)}
          </div>
        </div>
      )}

      {/* Desktop Sticky Sidebar */}
      <aside
        data-collapsed={collapsed}
        className={`sidebar hidden md:flex ${collapsed ? "sidebar-closed" : ""} border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] text-[var(--sidebar-foreground)] transition-all duration-300 ease-in-out flex-col sticky top-0 h-screen z-20`}
      >
        {renderHeader(false)}
        {renderNavItems(false)}
        {renderFooter(false)}
      </aside>
    </>
  );
}
