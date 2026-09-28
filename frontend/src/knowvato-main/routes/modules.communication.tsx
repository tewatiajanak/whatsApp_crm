import { Outlet } from "react-router-dom";

/**
 * Communication module shell. Light wrapper so shadcn/Tailwind children
 * render inside the org app. Overview keeps the existing CommunicationPage;
 * every other child is a Phase 11 stub for now.
 */
export default function CommunicationLayout() {
  return (
    <div className="communication-shell w-full">
      <Outlet />
    </div>
  );
}
