// Compatibility shim so files originally written for react-router-dom v6
// keep working under React Router DOM with minimal changes.
import { useMemo } from "react";
import {
  Link as DomLink,
  useNavigate as useDomNavigate,
  useLocation as useDomLocation,
  useParams as useDomParams,
  useSearchParams as useDomSearchParams,
  Navigate as DomNavigate,
} from "react-router-dom";

// Legacy Event Manager routes were rooted at "/". In this app they live
// under "/modules/events". Remap any path the ported pages try to navigate to.
const EM_PREFIX = "/modules/events";
const EM_KNOWN = [
  "/events",
  "/dashboard",
  "/setup",
  "/attendees",
  "/attendance",
  "/scan",
  "/qr",
  "/bulk-qr",
  "/registrants",
  "/pass-designer",
  "/pass-templates",
  "/form-designer",
  "/form-templates",
  "/activity",
  "/logs",
  "/import-qr",
];

export function remapEmPath(to: string): string {
  if (!to || typeof to !== "string") return to;
  if (to.startsWith(EM_PREFIX) || to.startsWith("/modules/")) return to;
  // Per-event pages: /events/<id>/(attendees|upload|logs) are real routes.
  const perEvent = to.match(/^\/events\/([^\/?]+)\/(attendees|upload|logs)(.*)$/);
  if (perEvent) return `${EM_PREFIX}/${perEvent[1]}/${perEvent[2]}${perEvent[3]}`;
  if (to.startsWith("/events")) {
    // The ported CreateEventPage IS the events list/create screen and lives
    // at "/modules/events/create". Everything under "/events" maps there
    // (preserving any query string like ?mode=new).
    const rest = to.slice("/events".length);
    const qIdx = rest.indexOf("?");
    const query = qIdx >= 0 ? rest.slice(qIdx) : "";
    return "/modules/events/create" + query;
  }
  for (const p of EM_KNOWN) {
    if (to === p || to.startsWith(p + "/") || to.startsWith(p + "?")) {
      return EM_PREFIX + to;
    }
  }
  return to;
}

export function useNavigate() {
  const navigate = useDomNavigate();
  return (to: string | number, opts?: { replace?: boolean }) => {
    if (typeof to === "number") {
      navigate(to);
      return;
    }
    navigate(remapEmPath(to), { replace: opts?.replace });
  };
}

export function useLocation() {
  return useDomLocation();
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return useDomParams() as T;
}

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams | Record<string, string>) => void] {
  const [params, setParams] = useDomSearchParams();
  const setParamsWrapper = (next: URLSearchParams | Record<string, string>) => {
    setParams(next);
  };
  return [params, setParamsWrapper];
}

export const Link = ({ to, children, ...rest }: any) => (
  <DomLink to={typeof to === "string" ? remapEmPath(to) : to} {...rest}>
    {children}
  </DomLink>
);

export const Navigate = ({ to, replace }: { to: string; replace?: boolean }) => {
  return <DomNavigate to={remapEmPath(to)} replace={replace} />;
};
