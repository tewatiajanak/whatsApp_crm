import { Outlet } from "react-router-dom";

export default function ReportsLayout() {
  return (
    <div className="reports-shell w-full">
      <Outlet />
    </div>
  );
}
