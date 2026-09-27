import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet } from "react-router-dom";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "../../context/AuthContext";
import { Menu } from "lucide-react";
import BreadcrumbNav from "../../components/BreadcrumbNav";

const queryClient = new QueryClient();

const TITLES: Record<string, string> = {
  "/": "Home",
  "/modules/events": "Event Manager",
  "/modules/whatsapp": "CRM",
  "/modules/website": "Website Builder",
  "/modules/users": "User Management",
  "/modules/communication": "Communication",
  "/modules/front-office": "Front Office",
  "/modules/reports": "Reports & Analytics",
  "/modules/utilities": "Utilities",
  "/modules/utilities/qr": "Utilities - QR Code Studio",
  "/modules/utilities/video-edit": "Utilities - Video Editor",
  "/modules/utilities/photo-edit": "Utilities - Photo Studio",
  "/modules/configuration": "Configuration",
};

function MainHeader() {
  const { user } = useAuth();
  const { toggleSidebar } = useSidebar();

  return (
    <div className="topbar flex items-center justify-between border-b px-3 sm:px-4 sticky top-0 z-10" style={{ height: "48px", borderColor: "var(--border)", background: "var(--page-bg)", color: "var(--foreground)" }}>
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] md:hidden cursor-pointer flex-shrink-0"
          title="Toggle Navigation Menu"
        >
          <Menu className="w-4 h-4" />
        </button>
        <BreadcrumbNav />
      </div>
      <div className="flex items-center gap-3 text-[11.5px] text-[var(--muted-foreground)] flex-shrink-0">
        <i className="bi bi-bell"></i>
        <span className="hidden sm:inline">{user?.email || "admin@knowvato.com"}</span>
      </div>
    </div>
  );
}

export default function MainLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <div className="crm-theme app-shell min-h-screen flex w-full" style={{ background: "var(--page-bg)" }}>
          <AppSidebar />
          <div className="main flex-1 flex flex-col min-w-0 w-full">
            <MainHeader />
            <div className="content flex-1 min-w-0 w-full overflow-x-hidden">
              <Outlet />
            </div>
          </div>
        </div>
      </SidebarProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
