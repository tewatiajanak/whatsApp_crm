import { Outlet, useLocation } from "react-router-dom";
import MainLayout from "../knowvato-main/routes/__root";

// CRM pages render inside the same shell as the rest of the suite (sidebar,
// top bar, page padding) so they look identical to Event Manager. The CRM
// submenu lives in knowvato-main/components/app-sidebar.tsx.
export default function Layout() {
  const loc = useLocation();

  if (loc.search.includes("startScreen=preview_only")) {
    return (
      <div style={{ height: "100vh", width: "100vw", overflow: "hidden" }}>
        <Outlet />
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="crm-page px-4 py-3 max-w-[1600px] mx-auto">
        <Outlet />
      </div>
    </MainLayout>
  );
}
