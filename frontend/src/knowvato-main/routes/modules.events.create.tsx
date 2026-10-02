import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Legacy /modules/events/create route: old links, bookmarks and menu items
// land on the create-event wizard.
export default function EventsCreateRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/modules/events/new", { replace: true });
  }, [navigate]);
  return (
    <div className="p-12 text-center text-sm text-muted-foreground">
      Opening Events…
    </div>
  );
}
