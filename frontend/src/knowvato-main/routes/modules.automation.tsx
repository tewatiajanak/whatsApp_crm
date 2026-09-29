import { Outlet } from "react-router-dom";

export default function AutomationLayout() {
  return (
    <div className="automation-shell w-full">
      <Outlet />
    </div>
  );
}
