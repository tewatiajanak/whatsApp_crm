import { Outlet } from "react-router-dom";

/**
 * Participants module shell. Kept intentionally light — no bootstrap import,
 * no event-manager providers — so the Participants area renders with the
 * shadcn/Tailwind theme the rest of the org app uses. Real pages ship in
 * Phase 6 (Registration Engine, Participants 360°, Duplicates, Segments).
 */
export default function ParticipantsLayout() {
  return (
    <div className="participants-shell w-full">
      <Outlet />
    </div>
  );
}
