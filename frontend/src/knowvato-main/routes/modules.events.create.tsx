import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Legacy /modules/events/create route now redirects to the unified All Events
// page with ?create=1 which auto-opens the modern create drawer. This keeps
// old links, bookmarks, and menu items working while merging Create + All
// Events into a single surface.
export default function EventsCreateRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/modules/events/all?create=1", { replace: true });
  }, [navigate]);
  return (
    <div className="p-12 text-center text-sm text-muted-foreground">
      Opening Events…
    </div>
  );
}
