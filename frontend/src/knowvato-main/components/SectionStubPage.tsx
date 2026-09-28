import { Link } from "react-router-dom";
import { ArrowLeft, Clock, Construction, type LucideIcon } from "lucide-react";

type Props = {
  title: string;
  description: string;
  phase: string;
  features: string[];
  backTo?: string;
  backLabel?: string;
  icon?: LucideIcon;
  accent?: string;
  accentTint?: string;
  layout?: "embedded" | "standalone";
  footer?: string;
};

/**
 * Themed placeholder used across Configuration and Event Manager for surfaces
 * whose UI is intentionally deferred to a future phase. Keeps menu, routing,
 * and bookmarks stable while the real page is built.
 *
 * Use `layout="standalone"` for a top-level route (wraps in outer padding).
 * Use `layout="embedded"` (default) when rendered inside the Configuration
 * two-column shell, which already owns the outer padding.
 */
export default function SectionStubPage({
  title,
  description,
  phase,
  features,
  backTo,
  backLabel = "Back",
  icon: Icon,
  accent = "var(--primary)",
  accentTint = "color-mix(in srgb, var(--primary) 12%, transparent)",
  layout = "embedded",
  footer = "The menu placement and slug are finalized so bookmarks, deep links, and breadcrumbs will keep working when the page ships.",
}: Props) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-4 pb-5 border-b">
        <div className="min-w-0">
          {backTo && (
            <Link
              to={backTo}
              className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors mb-1.5"
              style={{ textDecoration: "none" }}
            >
              <ArrowLeft className="h-3 w-3" /> {backLabel}
            </Link>
          )}
          <div className="flex items-center gap-2.5">
            {Icon && (
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0"
                style={{ background: accentTint, color: accent }}
              >
                <Icon className="h-4 w-4" strokeWidth={2.2} />
              </span>
            )}
            <h2 className="text-lg font-semibold text-foreground truncate">{title}</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{description}</p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider border"
          style={{
            background: "var(--warning-bg)",
            color: "var(--warning)",
            borderColor: "color-mix(in srgb, var(--warning) 25%, transparent)",
          }}
        >
          <Clock className="h-3 w-3" />
          Coming in {phase}
        </span>
      </div>

      <div className="mt-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-3">
          <Construction className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Planned capabilities</h3>
        </div>
        <ul className="space-y-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <span
                className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: accent }}
              />
              <span className="leading-relaxed">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 pt-5 border-t">
        <p className="text-xs text-muted-foreground">{footer}</p>
      </div>
    </>
  );

  if (layout === "standalone") {
    return (
      <div className="p-4 max-w-[1600px] mx-auto">
        <div className="rounded-xl border bg-card p-6 md:p-8">{inner}</div>
      </div>
    );
  }
  return <div className="p-6 md:p-8">{inner}</div>;
}
