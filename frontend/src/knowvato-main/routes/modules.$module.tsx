import { useState, useEffect } from "react";
import { useToast } from "../../context/ToastContext";
import { Link, useParams, useNavigate } from "react-router-dom";
import { http } from "../../api";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  MessageSquare,
  Puzzle,
  ChevronDown,
  LayoutDashboard,
  Settings as SettingsIcon,
  ShieldCheck,
  CreditCard,
  CalendarRange,
  Library,
  Building2,
  Bell,
} from "lucide-react";
import { useBookmarks } from "@/lib/bookmarks";
import SectionStubPage from "@/components/SectionStubPage";

// Import Full-Fledged Module Pages
import WebsiteBuilderPage from "../pages/WebsiteBuilderPage";
import UserManagementPage from "../pages/UserManagementPage";
import FrontOfficePage from "../pages/FrontOfficePage";
import EmailIntegrationPage from "../pages/EmailIntegrationPage";
import SmsIntegrationPage from "../pages/SmsIntegrationPage";
import FacebookIntegrationPage from "../pages/FacebookIntegrationPage";
import OtherIntegrationPage from "../pages/OtherIntegrationPage";
import AIIntegrationPage from "../pages/AIIntegrationPage";

// Import Configuration Submodule Pages
import TemplatesWhatsapp from "./modules.templates-whatsapp";
import TemplatesEmail from "./modules.templates-email";
import TemplatesSms from "./modules.templates-sms";
import IntegrationsWhatsapp from "./modules.integrations-whatsapp";
import { Sparkles } from "lucide-react";

const CONFIGURATION_CATEGORIES = [
  {
    id: "general",
    title: "General",
    icon: LayoutDashboard,
    accent: "var(--primary)",
    accentTint: "color-mix(in srgb, var(--primary) 12%, transparent)",
    items: [
      { slug: "organization-details", label: "Organization Details" },
      { slug: "branding", label: "Branding & White-label" },
    ],
  },
  {
    id: "security-access",
    title: "Security & Access",
    icon: ShieldCheck,
    accent: "var(--warning)",
    accentTint: "var(--warning-bg)",
    items: [
      { slug: "users", label: "Users" },
      { slug: "roles", label: "Roles & Permissions" },
      { slug: "departments", label: "Departments" },
      { slug: "security", label: "Security" },
      { slug: "audit-logs", label: "Audit Logs" },
      { slug: "files", label: "Files" },
      { slug: "privacy-requests", label: "Privacy Requests" },
    ],
  },
  {
    id: "events-settings",
    title: "Events",
    icon: CalendarRange,
    accent: "var(--info)",
    accentTint: "var(--info-bg)",
    items: [
      { slug: "event-types", label: "Event Types" },
      { slug: "event-categories", label: "Event Categories" },
      { slug: "event-statuses", label: "Event Statuses" },
      { slug: "event-default-features", label: "Default Features" },
      { slug: "event-id-formats", label: "ID Formats" },
      { slug: "checklist-templates", label: "Checklist Templates" },
    ],
  },
  {
    id: "library",
    title: "Library",
    icon: Library,
    accent: "var(--accent-foreground)",
    accentTint: "var(--accent)",
    items: [
      { slug: "field-library", label: "Field Library" },
      { slug: "form-templates", label: "Form Templates" },
      { slug: "master-lists", label: "Master Lists" },
      { slug: "pass-templates", label: "Pass Templates" },
      { slug: "page-templates", label: "Landing Page Templates" },
    ],
  },
  {
    id: "facilities",
    title: "Facilities",
    icon: Building2,
    accent: "var(--info)",
    accentTint: "var(--info-bg)",
    items: [
      { slug: "venues", label: "Venues" },
      { slug: "seating-maps", label: "Seating Maps" },
    ],
  },
  {
    id: "billing",
    title: "Billing",
    icon: CreditCard,
    accent: "var(--destructive)",
    accentTint: "var(--destructive-bg)",
    items: [
      { slug: "subscription-usage", label: "Subscription & Usage" },
      { slug: "payment-gateways", label: "Payment Gateways" },
      { slug: "taxes-invoicing", label: "Taxes & Invoicing" },
    ],
  },
  {
    id: "templates",
    title: "Communication Templates",
    icon: MessageSquare,
    accent: "var(--success)",
    accentTint: "var(--success-bg)",
    items: [
      { slug: "templates-whatsapp", label: "WhatsApp Template" },
      { slug: "templates-sms", label: "SMS Template" },
      { slug: "templates-email", label: "Email Template" },
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    icon: Bell,
    accent: "var(--warning)",
    accentTint: "var(--warning-bg)",
    items: [
      { slug: "message-delivery", label: "Message Delivery" },
      { slug: "staff-notifications", label: "Staff Notifications" },
    ],
  },
  {
    id: "integrations",
    title: "Integrations",
    icon: Puzzle,
    accent: "var(--info)",
    accentTint: "var(--info-bg)",
    items: [
      { slug: "integrations-ai", label: "AI Integration" },
      { slug: "integrations-whatsapp", label: "WhatsApp Integration" },
      { slug: "integrations-email", label: "Email Integration" },
      { slug: "integrations-sms", label: "SMS Integration" },
      { slug: "integrations-push", label: "Push Notifications" },
      { slug: "integrations-facebook", label: "Facebook Integration" },
      { slug: "integrations-other", label: "Other API Integration" },
    ],
  },
];

function ConfigurationOverview({ onSelect }: { onSelect: (slug: string) => void }) {
  const cards = [
    {
      title: "WhatsApp Templates",
      desc: "Manage Meta-approved WhatsApp message templates, variables, and quick replies.",
      slug: "templates-whatsapp",
      badge: "Meta Approved",
      color: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
      icon: MessageSquare,
    },
    {
      title: "SMS Templates",
      desc: "Configure DLT-registered SMS templates for transactional and marketing alerts.",
      slug: "templates-sms",
      badge: "DLT Ready",
      color: "bg-blue-500/10 text-blue-600 border-blue-200",
      icon: MessageSquare,
    },
    {
      title: "Email Templates",
      desc: "Design responsive HTML & rich-text email templates for automated workflows.",
      slug: "templates-email",
      badge: "HTML & Text",
      color: "bg-purple-500/10 text-purple-600 border-purple-200",
      icon: MessageSquare,
    },
    {
      title: "AI Integration & Copilot",
      desc: "Connect Google Gemini or Anthropic Claude to automate operational CRM workflows and database tasks.",
      slug: "integrations-ai",
      badge: "Gemini & Claude",
      color: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
      icon: Sparkles,
    },
    {
      title: "WhatsApp API Integration",
      desc: "Connect your WhatsApp Business API account, webhook tokens, and phone numbers.",
      slug: "integrations-whatsapp",
      badge: "Connected",
      color: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
      icon: Puzzle,
    },
    {
      title: "Email Gateway Integration",
      desc: "Configure SMTP, SendGrid, Amazon SES, or Mailgun for outbound emails.",
      slug: "integrations-email",
      badge: "SMTP / SES",
      color: "bg-blue-500/10 text-blue-600 border-blue-200",
      icon: Puzzle,
    },
    {
      title: "SMS Gateway Integration",
      desc: "Link SMS gateways like Twilio, Fast2SMS, MSG91, or custom API endpoints.",
      slug: "integrations-sms",
      badge: "Active Gateway",
      color: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
      icon: Puzzle,
    },
    {
      title: "Facebook Lead Ads Integration",
      desc: "Automatically sync leads from Facebook & Instagram ad campaigns into CRM.",
      slug: "integrations-facebook",
      badge: "Auto Sync",
      color: "bg-sky-500/10 text-sky-600 border-sky-200",
      icon: Puzzle,
    },
    {
      title: "Other API & Webhooks",
      desc: "Set up inbound & outbound REST webhooks and external API integrations.",
      slug: "integrations-other",
      badge: "REST Webhooks",
      color: "bg-amber-500/10 text-amber-600 border-amber-200",
      icon: Puzzle,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Configuration Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your communication templates, API gateways, and external integrations in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.slug}
              onClick={() => onSelect(c.slug)}
              className="group rounded-xl border bg-card p-5 shadow-xs hover:shadow-md transition-all cursor-pointer hover:border-primary/50 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className={`p-2.5 rounded-lg border ${c.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {c.badge}
                  </span>
                </div>
                <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                  {c.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                  {c.desc}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs font-medium text-primary">
                <span>Configure Settings</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ModulePage() {
  const { module } = useParams();
  const navigate = useNavigate();
  const activeModule = module || "configuration";

  // Standalone Main Suite Direct Modules
  if (activeModule === "website") return <WebsiteBuilderPage />;
  if (activeModule === "front-office") return <FrontOfficePage />;

  // Configuration / Templates / Integrations PERSISTENT 2-Column Shell
  const activeSlug = activeModule === "settings" ? "configuration" : activeModule;

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    general: true,
    "security-access": true,
    "events-settings": true,
    library: true,
    facilities: true,
    billing: true,
    notifications: true,
    templates: true,
    integrations: true,
  });

  const handleSelectSlug = (slug: string) => {
    navigate(`/modules/${slug}`);
  };

  const renderActiveConfigComponent = (slug: string) => {
    switch (slug) {
      case "organization-details":
        return <OrganizationDetailsPage />;
      case "branding":
        return (
          <SectionStubPage
            title="Branding & White-label"
            description="One place to make the whole product look like yours — dashboard theme, email header/footer, login page, public event pages, and a custom domain."
            phase="Phase 14"
            features={[
              "Logos (light / dark), favicon, and admin app theme (CSS vars applied to the whole dashboard)",
              "Brand colors (primary / secondary / accent) with WCAG AA contrast check",
              "Fonts from the allowed Google Fonts list (loaded once, cached)",
              "Email branding: header logo, footer text, colors — used by every Phase 11 template",
              "Login page branding (already partially wired via Organization Details)",
              "Custom domain: point events.yourcompany.com → your org login + public event pages, with DNS verification",
              "'Remove Powered by Knowvato' — plan-gated white_label feature",
              "PWA manifest picks up your theme color and icons automatically",
            ]}
          />
        );
      case "privacy-requests":
        return (
          <SectionStubPage
            title="Privacy Requests"
            description="Participant data-privacy queue — export, delete, or rectify requests raised from the participant portal, with SLA tracking and audit trail."
            phase="Phase 14"
            features={[
              "Types: Export (JSON / ZIP job), Delete (anonymize PII, keep immutable financial records per R21), Rectify",
              "SLA countdown to the legally required due date",
              "Actions: Approve → run job · Reject with reason · Reassign · Mark complete",
              "Consent history per participant (which version of terms they accepted, when)",
              "Cookie banner settings for public event pages",
              "Every action audit-logged",
            ]}
          />
        );
      case "users":
        return <UserManagementPage />;
      case "roles":
        return (
          <SectionStubPage
            title="Roles & Permissions"
            description="Create custom roles and control every action across the workspace via a permission matrix."
            phase="Phase C"
            features={[
              "System role library with clone-to-customize",
              "Permission matrix — modules × actions (view / create / edit / delete)",
              "Assign roles per-user and per-event (EventMember)",
              "Mobile: accordion-per-module with switches",
            ]}
          />
        );
      case "departments":
        return (
          <SectionStubPage
            title="Departments"
            description="Model your organization hierarchy with nested departments, heads, and codes."
            phase="Phase D"
            features={[
              "Tree view with drag-to-reparent",
              "Department head, code, and parent chain",
              "Link users to departments and filter reports by dept",
            ]}
          />
        );
      case "security":
        return (
          <SectionStubPage
            title="Security"
            description="Password policy, two-factor enforcement, session limits, and login history."
            phase="Phase F"
            features={[
              "Password strength rules and reset cadence",
              "Enforce 2FA for selected roles",
              "Session timeout & concurrent-device limits",
              "Login history with IP, device, and location",
            ]}
          />
        );
      case "audit-logs":
        return (
          <SectionStubPage
            title="Audit Logs"
            description="Append-only trail of every create / update / delete across the workspace."
            phase="Phase E"
            features={[
              "Actor, action, entity, IP, device, and timestamp",
              "Row drawer with before / after diff view (green added / red removed)",
              "Filter by actor, action, entity, and date range",
              "Export to CSV / Excel / JSON",
            ]}
          />
        );
      case "files":
        return (
          <SectionStubPage
            title="File Manager"
            description="Central store for uploads with folders, tags, previews, and signed URLs."
            phase="Phase F"
            features={[
              "Folder tree with drag-move and tags",
              "Grid / list view with image and PDF preview",
              "Signed URL access for private files",
              "Storage-used meter and per-file audit trail",
            ]}
          />
        );
      case "subscription-usage":
        return (
          <SectionStubPage
            title="Subscription & Usage"
            description="Your current plan, features included, and live usage meters for every limit. This is what you pay the platform for using Knowvato."
            phase="Phase 3"
            features={[
              "Current plan card with renewal date and billing duration",
              "Per-limit meters: events, participants, users, storage, emails, SMS, WhatsApp",
              "Threshold alerts at 80 / 90 / 100% (configurable by the platform)",
              "Upgrade CTA and side-by-side plan comparison",
              "Invoice history and payment methods (arrives with Phase 15 checkout)",
            ]}
          />
        );
      case "payment-gateways":
        return (
          <SectionStubPage
            title="Payment Gateways"
            description="Connect the payment providers your customers use to buy tickets. Distinct from your Knowvato subscription — this is money flowing from your attendees to you."
            phase="Phase 7"
            features={[
              "Adapters: Razorpay · Stripe · PayPal · Cashfree · PayU · Offline (cash / cheque / bank transfer)",
              "Add-gateway wizard: choose provider → paste credentials (masked, never returned) → copy webhook URL → Test connection",
              "Set default gateway per currency; priority order for retries",
              "Server-side verification: webhook is the source of truth, not the browser callback",
              "AES-256-GCM encryption at rest for every secret",
            ]}
          />
        );
      case "taxes-invoicing":
        return (
          <SectionStubPage
            title="Taxes & Invoicing"
            description="Configure how customer payments are taxed and invoiced — tax registrations per state, invoice series, and the invoice PDF template."
            phase="Phase 7"
            features={[
              "GST / VAT registrations per state (GSTIN, place of supply) — intra-state → CGST + SGST, inter-state → IGST, export → zero-rated",
              "Invoice number series with financial-year and org-code tokens: INV/{FY}/{SEQ:5}",
              "Invoice PDF template (HTML editor with variable picker + live PDF preview)",
              "Terms text, seller legal name / address / signatory",
              "Void → credit note (never delete an invoice; corrections are new records)",
            ]}
          />
        );
      case "event-types":
        return (
          <SectionStubPage
            title="Event Types"
            description="Configurable event templates — Conference, Workshop, Webinar, Hackathon, Blood Donation Camp, and 20+ more — each with its own default features, fields, and forms."
            phase="Phase 4"
            features={[
              "Seed library of 25+ system event types with icon, color, and description",
              "Custom types created without a developer (defaults propagate to new events of that type)",
              "Per-type defaults: features, form template, pass template, checklist template, ticket types, workflows",
              "Reorder, activate / deactivate, clone",
            ]}
          />
        );
      case "event-categories":
        return (
          <SectionStubPage
            title="Event Categories"
            description="Tag events with a category hierarchy for filtering, reporting, and public listings."
            phase="Phase 4"
            features={[
              "Nested category tree with drag-to-reparent",
              "Color assignment per category",
              "Filter events and reports by category",
            ]}
          />
        );
      case "event-statuses":
        return (
          <SectionStubPage
            title="Event Statuses"
            description="Design your own status lifecycle: labels, colors, allowed transitions, and side effects."
            phase="Phase 4"
            features={[
              "Custom statuses in addition to system defaults (Draft, Published, Live, Completed, Archived)",
              "Allowed-transitions graph — enforced by the status machine on the server",
              "Side effects per status: open / close registration, lock editing, public visibility",
              "Visual pipeline editor",
            ]}
          />
        );
      case "event-default-features":
        return (
          <SectionStubPage
            title="Default Event Features"
            description="Set the feature toggles that new events start with (approval, payment, waitlist, seating…)."
            phase="Phase 4"
            features={[
              "Master toggle list for every event feature flag",
              "Per Event Type overrides",
              "Plan-locked features shown with lock icon and upgrade tooltip",
            ]}
          />
        );
      case "event-id-formats":
        return (
          <SectionStubPage
            title="Event ID Formats"
            description="Define the pattern used to generate human-readable IDs for events, registrations, participants, tickets."
            phase="Phase 4"
            features={[
              "Token chips: {YYYY} {YY} {MM} {FY} {SEQ:n} {EVENTCODE} {ORGCODE}",
              "Live example preview",
              "Per Event Type overrides",
              "Atomic server-side counter — no client-side ID generation",
            ]}
          />
        );
      case "checklist-templates":
        return (
          <SectionStubPage
            title="Checklist Templates"
            description="Pre-built checklists for venue, speakers, sponsors, registration, passes, volunteers, communication."
            phase="Phase 4"
            features={[
              "Categorized checklist items with due-offset (relative to event start)",
              "Assignee role or user, link-to route, overdue highlighting",
              "Apply a template to any event; items sync to the event checklist",
            ]}
          />
        );
      case "field-library":
        return (
          <SectionStubPage
            title="Field Library"
            description="Your organization's catalog of reusable dynamic fields. Define once, reuse across every registration, speaker, sponsor, feedback and survey form."
            phase="Phase 5"
            features={[
              "30+ field types: text, number, email, phone, dropdown, multiselect, rating, NPS, date, file, signature, address, country/state/city cascade, formula, consent",
              "System fields locked (first_name, last_name, email, phone, dob, gender, city, country)",
              "Per-field validation: min/max, regex, custom rules, PII level for masking",
              "Usage tracker — see every form the field is used in",
              "Bulk import fields via JSON",
            ]}
          />
        );
      case "form-templates":
        return (
          <SectionStubPage
            title="Form Templates"
            description="A gallery of ready-to-use form blueprints — Corporate Conference Registration, School Event, Hackathon, Speaker Registration, Feedback, and more."
            phase="Phase 5"
            features={[
              "Global (platform-shipped) templates and organization templates side by side",
              "Category filters: Registration, Speaker, Sponsor, Feedback, Survey, Profile",
              "Preview modal renders the template with the real FormRenderer",
              "Use → creates a form in the target event, pre-filled with pages, fields, and logic",
              "Save any event form as a template · Export / Import as JSON",
            ]}
            footer="Distinct from Communication Templates (WhatsApp / SMS / Email). Those are message blueprints; these are form blueprints."
          />
        );
      case "master-lists":
        return (
          <SectionStubPage
            title="Master Lists"
            description="Big option sets that a dropdown or multiselect field can source from — Colleges, Departments, Countries, Product Categories."
            phase="Phase 5"
            features={[
              "CSV import (label, value, optional parent for hierarchical lists)",
              "Reuse one list across many forms — update once, all forms follow",
              "Search, reorder, deactivate items without deleting them",
              "Version history so old submissions keep resolving to their original label",
            ]}
          />
        );
      case "venues":
        return (
          <SectionStubPage
            title="Venues"
            description="Reusable physical spaces — hotels, convention centers, campuses, stadiums, offices — with a hierarchy of buildings, floors, halls, and rooms."
            phase="Phase 9"
            features={[
              "Venue library with type, address, geo, contact, amenities, photos",
              "Tree: Building → Floor → Hall → Room with per-room capacity by layout",
              "Layouts per room: theatre, classroom, round table, U-shape, boardroom, cabaret, standing",
              "Facilities checklist (projector, mic, AC…), accessibility notes",
              "Reused across events — pick venue when creating a new event",
              "'Events held here' history per venue",
            ]}
          />
        );
      case "seating-maps":
        return (
          <SectionStubPage
            title="Seating Maps"
            description="A drag-and-drop Seating Designer (react-konva) that outputs reusable seat layouts. Attach a map to a room or clone it into an event for real seat allocation."
            phase="Phase 9"
            features={[
              "Layout presets: theatre N×M with curve/aisles, classroom, round tables, U-shape, boardroom",
              "Section tool: group seats into VIP / General / Premium with color + price tier",
              "Row labels (A–Z, numeric, skip I/O), seat numbering direction, block / accessible marking",
              "Stage, aisles, exits, pillars as canvas objects with labels",
              "Zoom / pan / smart guides; mobile pinch-zoom viewer with tap-to-assign",
              "Auto-assign at checkout: participant self-select via seat_selector form field",
            ]}
          />
        );
      case "page-templates":
        return (
          <SectionStubPage
            title="Landing Page Templates"
            description="Seeded landing-page blueprints per event type — Conference, Workshop, Sports, Cultural, School, Webinar, Exhibition — with pre-arranged sections, ready to clone into an event website."
            phase="Phase 14"
            features={[
              "Section-based page builder output — Hero, Event Info, About, Stats, Speakers, Agenda, Sponsors, Tickets, Registration, Gallery, FAQ, Countdown, CTA",
              "Preview modal renders the template inside the real public renderer",
              "Use → creates a SitePage on the event with pages and sections pre-arranged",
              "Save any event page as a template (organization-shared or global)",
              "Category filters: Conference, Workshop, Sports, Cultural, School, Webinar, Exhibition, VIP",
              "Export / import as JSON",
            ]}
            footer="Distinct from Form / Pass / Communication templates. These are website page blueprints."
          />
        );
      case "pass-templates":
        return (
          <SectionStubPage
            title="Pass Templates"
            description="Reusable badge and pass designs — General, VIP, Speaker, Staff, Exhibitor, Visitor, Student — with front and back layouts, ready to apply to any event."
            phase="Phase 8"
            features={[
              "Drag-and-drop Canvas Designer (react-konva) with mm units, snap, guides, layers",
              "Elements: text with auto-shrink, image, logo, participant photo, QR (hashed token), barcode (Code128 / EAN / PDF417), shapes, icons, dynamic fields, conditional blocks (e.g. VIP → gold ribbon)",
              "Bind any field: {{participant.name}}, {{registration.code}}, ticket color band",
              "Server-side rendering (puppeteer) is the source of truth — canvas preview matches print",
              "Preset sizes: badge 4×3, A6, CR80; bleed + safe-zone overlays",
              "Version history, save-as-template, apply to event",
            ]}
            footer="Distinct from Form Templates and Communication Templates. Passes are what participants show at the gate."
          />
        );
      case "templates-whatsapp":
        return <TemplatesWhatsapp />;
      case "templates-email":
        return <TemplatesEmail />;
      case "templates-sms":
        return <TemplatesSms />;
      case "message-delivery":
        return (
          <SectionStubPage
            title="Message Delivery"
            description="Choose the default provider per channel, set fallback order, quiet hours, daily caps, and tracking toggles that every message obeys."
            phase="Phase 11"
            features={[
              "Per-channel default: which provider sends when nothing else is specified",
              "Fallback order (drag list): e.g. WhatsApp → SMS → Email for critical alerts",
              "Quiet hours: defer non-urgent messages between 22:00 – 07:00 in recipient timezone",
              "Daily caps per channel (soft warn / hard stop)",
              "Tracking toggles: email open pixel, click redirect, unsubscribe footer",
              "Use platform provider (metered) vs use your own (plan-gated)",
            ]}
          />
        );
      case "staff-notifications":
        return (
          <SectionStubPage
            title="Staff Notification Matrix"
            description="Decide who on your team gets notified about which system events, on which channels. A matrix of roles × events × channels with quiet-hour respect."
            phase="Phase 11"
            features={[
              "Rows: system events (new registration, payment failed, approval needed, device offline, plan limit reached, refund requested…)",
              "Columns: in-app · email · push · WhatsApp",
              "One toggle grid per role — Organization Admin, Event Manager, Registration Manager, Finance, Support, etc.",
              "Preset routing: escalate after N minutes if not acknowledged",
              "Personal override in every user's profile",
            ]}
          />
        );
      case "integrations-push":
        return (
          <SectionStubPage
            title="Push Notifications"
            description="Web Push (VAPID) for browser users and FCM for the mobile app — the same notification engine, one more channel."
            phase="Phase 11"
            features={[
              "Web Push provider with VAPID keys (auto-generated, rotatable)",
              "FCM provider for Android / iOS mobile app (Phase 16)",
              "Subscription flow: user opts in from bell → browser prompt → token stored per device",
              "Test push from Settings",
              "Delivery reported by the provider webhook",
            ]}
          />
        );
      case "integrations-ai":
        return <AIIntegrationPage />;
      case "integrations-whatsapp":
        return <IntegrationsWhatsapp />;
      case "integrations-email":
        return <EmailIntegrationPage />;
      case "integrations-sms":
        return <SmsIntegrationPage />;
      case "integrations-facebook":
        return <FacebookIntegrationPage />;
      case "integrations-other":
        return <OtherIntegrationPage />;
      case "configuration":
      case "settings":
      default:
        return <ConfigurationOverview onSelect={(slug) => navigate(`/modules/${slug}`)} />;
    }
  };

  return (
    <div className="p-4 max-w-[1600px] mx-auto space-y-4">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-4 pb-3 border-b">
        <div>
          <Link
            to="/"
            className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors"
            style={{ textDecoration: "none" }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to dashboard
          </Link>
          <h1 className="text-xl font-semibold tracking-tight mt-0.5 text-foreground">Configuration</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your workspace preferences, templates, and third-party integrations.
          </p>
        </div>
      </div>

      {/* 2-Column Setup Layout: Left Submenu Sidebar (PERSISTENT) + Right Active Submodule Component */}
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5">
        {/* Left Submenu Navigation */}
        <nav aria-label="Configuration sections" className="space-y-3 sticky top-[70px] self-start">
          {CONFIGURATION_CATEGORIES.map((cat) => {
            const isOpen = openCategories[cat.id];
            const hasActive = cat.items.some((item) => activeSlug === item.slug);
            return (
              <div
                key={cat.id}
                className="rounded-xl border bg-card overflow-hidden transition-all"
                style={{
                  boxShadow: hasActive
                    ? "0 1px 2px rgba(37,51,56,0.04), 0 10px 24px -16px rgba(37,51,56,0.14)"
                    : "0 1px 2px rgba(37,51,56,0.03)",
                  borderColor: hasActive ? "color-mix(in srgb, var(--primary) 30%, var(--border))" : "var(--border)",
                }}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left cursor-pointer transition-colors hover:bg-muted/40"
                  onClick={() =>
                    setOpenCategories((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))
                  }
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md shrink-0"
                      style={{ background: cat.accentTint, color: cat.accent }}
                    >
                      <cat.icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </span>
                    <span
                      className="truncate text-[11px] font-semibold uppercase tracking-wider text-foreground"
                    >
                      {cat.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                      {cat.items.length}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
                        isOpen ? "" : "-rotate-90"
                      }`}
                    />
                  </div>
                </button>

                <div
                  className="grid transition-all duration-200 ease-out"
                  style={{
                    gridTemplateRows: isOpen ? "1fr" : "0fr",
                  }}
                >
                  <div className="overflow-hidden">
                    <div className="p-1.5 pt-1 border-t border-border/70 space-y-0.5">
                      {cat.items.map((item) => {
                        const isSelected = activeSlug === item.slug;
                        return (
                          <button
                            key={item.slug}
                            type="button"
                            onClick={() => handleSelectSlug(item.slug)}
                            className={`w-full text-left pl-3 pr-2.5 py-2 rounded-md text-[13px] font-medium transition-all flex items-center justify-between cursor-pointer relative ${
                              isSelected
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            }`}
                          >
                            {!isSelected && (
                              <span
                                className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ background: cat.accent }}
                              />
                            )}
                            <span className="truncate">{item.label}</span>
                            {isSelected && (
                              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Right Panel: Active Submodule Component */}
        <div className="min-w-0 rounded-xl border bg-card shadow-sm overflow-hidden">
          {renderActiveConfigComponent(activeSlug)}
        </div>
      </div>
    </div>
  );
}

const NATURE_OF_BUSINESS = [
  "Education",
  "Healthcare",
  "Hospitality",
  "Retail",
  "Finance",
  "Manufacturing",
  "IT Services",
  "Real Estate",
  "Food & Beverage",
  "Media & Entertainment",
  "Logistics",
  "Consulting",
  "Legal Services",
  "Non-Profit",
  "Government",
  "Other"
];

const SOCIAL_MEDIA_PLATFORMS = [
  { id: "facebook", label: "Facebook", icon: "bi-facebook", placeholder: "https://facebook.com/yourpage" },
  { id: "twitter", label: "Twitter / X", icon: "bi-twitter", placeholder: "https://twitter.com/yourhandle" },
  { id: "linkedin", label: "LinkedIn", icon: "bi-linkedin", placeholder: "https://linkedin.com/company/yourcompany" },
  { id: "instagram", label: "Instagram", icon: "bi-instagram", placeholder: "https://instagram.com/yourprofile" },
  { id: "youtube", label: "YouTube", icon: "bi-youtube", placeholder: "https://youtube.com/yourchannel" },
  { id: "whatsapp", label: "WhatsApp", icon: "bi-whatsapp", placeholder: "https://wa.me/yourphonenumber" },
];

const orgLabel = "block text-xs font-medium mb-1.5";
const orgInput = "w-full h-9 px-3 border rounded-md text-sm border-input bg-background transition-all";
const orgSecondaryBtn = "inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border bg-background hover:bg-muted cursor-pointer transition-colors";
const orgDangerBtn = "inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-red-200 text-red-600 bg-background hover:bg-red-50 cursor-pointer transition-colors";

function OrgSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4 @container">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function OrganizationDetailsPage() {
  const toast = useToast();
  const [data, setData] = useState<{
    name: string;
    tagline: string;
    natureOfBusiness: string;
    address: {
      street: string;
      city: string;
      state: string;
      country: string;
      postalCode: string;
    };
    contactInfo: {
      mobile: string;
      email: string;
    };
    socialMedia: {
      facebook: string;
      twitter: string;
      linkedin: string;
      instagram: string;
      youtube: string;
      whatsapp: string;
    };
    logo: string | null;
    logoWidth: number;
    logoHeight: number;
    loginLayout: "center-stack" | "side-by-side";
    logoSize: number;
    nameFontSize: number;
    taglineFontSize: number;
    loginImages: string[];
    loginVideo: string | null;
  }>({
    name: "",
    tagline: "",
    natureOfBusiness: "",
    address: {
      street: "",
      city: "",
      state: "",
      country: "",
      postalCode: ""
    },
    contactInfo: {
      mobile: "",
      email: ""
    },
    socialMedia: {
      facebook: "",
      twitter: "",
      linkedin: "",
      instagram: "",
      youtube: "",
      whatsapp: ""
    },
    logo: null,
    logoWidth: 200,
    logoHeight: 100,
    logoBorderRadius: 0,
    loginLayout: "center-stack" as const,
    logoSize: 60,
    nameFontSize: 24,
    taglineFontSize: 14,
    nameColor: "#222",
    taglineColor: "#666",
    loginImages: [],
    loginVideo: null
  });
  const [loading, setLoading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [logoWidth, setLogoWidth] = useState(200);
  const [logoHeight, setLogoHeight] = useState(100);

  // Helper function to show pop-up notifications
  const showNotification = (message: string, type: "error" | "warning" | "success" = "error") => {
    const popup = document.createElement("div");
    const isError = type === "error";
    const isWarning = type === "warning";
    const isSuccess = type === "success";

    const icon = isError ? "⚠️" : isWarning ? "⚡" : isSuccess ? "✓" : "ℹ️";
    const bgColor = isError ? "#ef4444" : isWarning ? "#f59e0b" : isSuccess ? "#16a34a" : "#3b82f6";
    const borderColor = isError ? "#f87171" : isWarning ? "#fbbf24" : isSuccess ? "#22c55e" : "#60a5fa";

    popup.innerHTML = `
      <div style="display: flex; gap: 12px;">
        <div style="font-size: 20px; flex-shrink: 0;">${icon}</div>
        <div style="flex: 1;">
          <div style="font-size: 13px; opacity: 0.95; line-height: 1.5;">${message}</div>
        </div>
      </div>
    `;
    popup.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, ${bgColor} 0%, ${bgColor}DD 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 9999;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      animation: slideInRight 0.4s ease-out;
      border-left: 4px solid ${borderColor};
      max-width: 400px;
      word-wrap: break-word;
    `;

    const style = document.createElement("style");
    if (!document.querySelector("style[data-notification-animation]")) {
      style.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      style.setAttribute("data-notification-animation", "true");
      document.head.appendChild(style);
    }

    document.body.appendChild(popup);
    setTimeout(() => {
      popup.style.animation = "slideInRight 0.4s ease-out reverse";
      setTimeout(() => popup.remove(), 400);
    }, 3000);
  };

  // Show logo adjustment modal
  const showLogoAdjustModal = () => {
    const clampLogo = (v: number) => Math.min(120, Math.max(40, Number(v) || 120));
    let currentW = clampLogo(data.logoWidth);
    let currentH = clampLogo(data.logoHeight);
    let selectedLayout: "center-stack" | "side-by-side" | null = null;
    let currentBorderRadius = data.logoBorderRadius || 0;
    let currentFontSize = data.nameFontSize;
    let currentFontFamily = "sans-serif";
    let currentNameColor = data.nameColor || "#222";
    let currentTaglineColor = data.taglineColor || "#666";

    const modal = document.createElement("div");
    modal.id = "logo-adjust-modal";

    modal.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
        <div style="background: white; border-radius: 12px; padding: 28px; max-width: 550px; width: 95%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
          <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 24px; color: #222;">🎨 Customize Logo & Header</h2>

          <!-- Step 1: Layout Selection -->
          <div id="step-layout">
            <div style="margin-bottom: 16px;">
              <label style="font-size: 13px; font-weight: 600; color: #222; display: block; margin-bottom: 12px;">Step 1: Select Layout Style</label>
              <div style="display: flex; gap: 12px;">
                <button id="layout-center-btn" style="flex: 1; padding: 16px; background: #f0f4ff; border: 2px solid #3b82f6; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; color: #222; transition: all 0.2s;">
                  📌 Logo on Top<br><span style="font-size: 11px; color: #666; font-weight: normal;">Centered above name</span>
                </button>
                <button id="layout-side-btn" style="flex: 1; padding: 16px; background: #f5f5f5; border: 2px solid #d1d5db; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; color: #222; transition: all 0.2s;">
                  📄 Logo on Left<br><span style="font-size: 11px; color: #666; font-weight: normal;">Beside the name</span>
                </button>
              </div>
            </div>

            <!-- Preview for selected layout -->
            <div id="preview-container" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid #bfdbfe; border-radius: 12px; padding: 28px; text-align: center; margin-bottom: 24px; display: none;">
              <div style="font-size: 11px; color: #0369a1; font-weight: 600; margin-bottom: 16px;">LIVE PREVIEW</div>
              <div id="preview-content" style="display: flex; flex-direction: column; align-items: center; gap: 14px; min-height: 220px; justify-content: center;">
              </div>
              <div style="margin-top: 16px; font-size: 11px; color: #0369a1; font-weight: 600;">
                Size: <span id="preview-size">${currentW}px × ${currentH}px</span>
              </div>
            </div>

            <!-- Step 2: Size Controls (hidden initially) -->
            <div id="step-size" style="display: none; margin-bottom: 24px;">
              <!-- Width Control -->
              <div style="margin-bottom: 18px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <label style="font-size: 13px; font-weight: 600; color: #222;">📏 Logo Width</label>
                  <span style="font-size: 13px; font-weight: 700; color: #1e3c72; background: #f0f4ff; padding: 4px 12px; border-radius: 6px;" id="width-display">${currentW}px</span>
                </div>
                <input type="range" id="logo-width-slider" value="${currentW}" min="40" max="120" step="5" style="width: 100%; height: 6px; border-radius: 5px; background: #e5e7eb; outline: none; -webkit-appearance: none; appearance: none; cursor: pointer;">
                <style>
                  #logo-width-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #1e3c72;
                    cursor: pointer;
                    box-shadow: 0 2px 6px rgba(30, 60, 114, 0.4);
                  }
                  #logo-width-slider::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #1e3c72;
                    cursor: pointer;
                    border: none;
                  }
                </style>
                <div style="font-size: 11px; color: #666; margin-top: 6px;">Adjust logo size (40 - 120px)</div>
              </div>

              <!-- Height Control -->
              <div style="margin-bottom: 18px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <label style="font-size: 13px; font-weight: 600; color: #222;">📏 Logo Height</label>
                  <span style="font-size: 13px; font-weight: 700; color: #1e3c72; background: #f0f4ff; padding: 4px 12px; border-radius: 6px;" id="height-display">${currentH}px</span>
                </div>
                <input type="range" id="logo-height-slider" value="${currentH}" min="40" max="120" step="5" style="width: 100%; height: 6px; border-radius: 5px; background: #e5e7eb; outline: none; -webkit-appearance: none; appearance: none; cursor: pointer;">
                <style>
                  #logo-height-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #1e3c72;
                    cursor: pointer;
                    box-shadow: 0 2px 6px rgba(30, 60, 114, 0.4);
                  }
                  #logo-height-slider::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #1e3c72;
                    cursor: pointer;
                    border: none;
                  }
                </style>
                <div style="font-size: 11px; color: #666; margin-top: 6px;">Adjust logo size (40 - 120px)</div>
              </div>

              <!-- Border Radius -->
              <div style="margin-bottom: 18px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <label style="font-size: 13px; font-weight: 600; color: #222;">🔘 Logo Border Radius</label>
                  <span style="font-size: 13px; font-weight: 700; color: #1e3c72; background: #f0f4ff; padding: 4px 12px; border-radius: 6px;" id="radius-display">${currentBorderRadius}px</span>
                </div>
                <input type="range" id="logo-radius-slider" value="${currentBorderRadius}" min="0" max="50" step="2" style="width: 100%; height: 6px; border-radius: 5px; background: #e5e7eb; outline: none; -webkit-appearance: none; appearance: none; cursor: pointer;">
                <style>
                  #logo-radius-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #1e3c72;
                    cursor: pointer;
                    box-shadow: 0 2px 6px rgba(30, 60, 114, 0.4);
                  }
                  #logo-radius-slider::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #1e3c72;
                    cursor: pointer;
                    border: none;
                  }
                </style>
                <div style="font-size: 11px; color: #666; margin-top: 6px;">0 = No rounding, 50 = Fully rounded</div>
              </div>

              <!-- Name Font Size -->
              <div style="margin-bottom: 18px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <label style="font-size: 13px; font-weight: 600; color: #222;">📝 Name Font Size</label>
                  <span style="font-size: 13px; font-weight: 700; color: #1e3c72; background: #f0f4ff; padding: 4px 12px; border-radius: 6px;" id="fontsize-display">${currentFontSize}px</span>
                </div>
                <input type="range" id="name-fontsize-slider" value="${currentFontSize}" min="16" max="40" step="2" style="width: 100%; height: 6px; border-radius: 5px; background: #e5e7eb; outline: none; -webkit-appearance: none; appearance: none; cursor: pointer;">
                <style>
                  #name-fontsize-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #1e3c72;
                    cursor: pointer;
                    box-shadow: 0 2px 6px rgba(30, 60, 114, 0.4);
                  }
                  #name-fontsize-slider::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #1e3c72;
                    cursor: pointer;
                    border: none;
                  }
                </style>
                <div style="font-size: 11px; color: #666; margin-top: 6px;">Text size for organization name</div>
              </div>

              <!-- Name Text Color -->
              <div style="margin-bottom: 18px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <label style="font-size: 13px; font-weight: 600; color: #222;">🎨 Name Text Color</label>
                  <input type="color" id="name-color-picker" value="#222222" style="width: 50px; height: 36px; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;">
                </div>
                <div style="font-size: 11px; color: #666; margin-top: 6px;">Color for organization name text</div>
              </div>

              <!-- Tagline Text Color -->
              <div style="margin-bottom: 18px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <label style="font-size: 13px; font-weight: 600; color: #222;">🎨 Tagline Text Color</label>
                  <input type="color" id="tagline-color-picker" value="#666666" style="width: 50px; height: 36px; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;">
                </div>
                <div style="font-size: 11px; color: #666; margin-top: 6px;">Color for tagline text</div>
              </div>
            </div>
          </div>

          <!-- Buttons -->
          <div style="display: flex; gap: 12px; justify-content: flex-end; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <button id="logo-adjust-cancel" style="padding: 10px 22px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; color: #374151;">Cancel</button>
            <button id="logo-adjust-save" style="padding: 10px 22px; background: #1e3c72; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; display: none;">Save</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const layoutCenterBtn = document.getElementById("layout-center-btn") as HTMLButtonElement;
    const layoutSideBtn = document.getElementById("layout-side-btn") as HTMLButtonElement;
    const previewContainer = document.getElementById("preview-container") as HTMLElement;
    const previewContent = document.getElementById("preview-content") as HTMLElement;
    const previewSize = document.getElementById("preview-size") as HTMLElement;
    const stepLayout = document.getElementById("step-layout") as HTMLElement;
    const stepSize = document.getElementById("step-size") as HTMLElement;
    const widthSlider = document.getElementById("logo-width-slider") as HTMLInputElement;
    const heightSlider = document.getElementById("logo-height-slider") as HTMLInputElement;
    const radiusSlider = document.getElementById("logo-radius-slider") as HTMLInputElement;
    const fontsizeSlider = document.getElementById("name-fontsize-slider") as HTMLInputElement;
    const widthDisplay = document.getElementById("width-display") as HTMLElement;
    const heightDisplay = document.getElementById("height-display") as HTMLElement;
    const radiusDisplay = document.getElementById("radius-display") as HTMLElement;
    const fontsizeDisplay = document.getElementById("fontsize-display") as HTMLElement;
    const nameColorPicker = document.getElementById("name-color-picker") as HTMLInputElement;
    const taglineColorPicker = document.getElementById("tagline-color-picker") as HTMLInputElement;
    const saveBtn = document.getElementById("logo-adjust-save") as HTMLButtonElement;
    const cancelBtn = document.getElementById("logo-adjust-cancel") as HTMLButtonElement;

    // Initialize color pickers and sliders with saved values
    radiusSlider.value = String(currentBorderRadius);
    nameColorPicker.value = currentNameColor;
    taglineColorPicker.value = currentTaglineColor;

    // Update preview in real-time
    const updatePreview = () => {
      const w = parseInt(widthSlider.value);
      const h = parseInt(heightSlider.value);
      const r = parseInt(radiusSlider.value);
      const fs = parseInt(fontsizeSlider.value);
      currentW = w;
      currentH = h;
      currentBorderRadius = r;
      currentFontSize = fs;

      widthDisplay.textContent = `${w}px`;
      heightDisplay.textContent = `${h}px`;
      radiusDisplay.textContent = `${r}px`;
      fontsizeDisplay.textContent = `${fs}px`;
      previewSize.textContent = `${w}px × ${h}px`;

      // Render preview
      const nameColor = nameColorPicker.value;
      const taglineColor = taglineColorPicker.value;
      previewContent.innerHTML = `
        ${data.logo ? `<img src="${data.logo}" alt="Logo" style="max-height: ${h}px; max-width: ${w}px; object-fit: contain; border-radius: ${r}px;">` : ''}
        ${selectedLayout === "center-stack" ? `
          <div>
            ${data.name ? `<div style="font-size: ${fs}px; font-weight: 700; color: ${nameColor};">${data.name}</div>` : ''}
            ${data.tagline ? `<div style="font-size: 13px; color: ${taglineColor}; margin-top: 4px;">${data.tagline}</div>` : ''}
          </div>
        ` : `
          <div>
            ${data.name ? `<div style="font-size: ${fs}px; font-weight: 700; color: ${nameColor};">${data.name}</div>` : ''}
            ${data.tagline ? `<div style="font-size: 13px; color: ${taglineColor}; margin-top: 4px;">${data.tagline}</div>` : ''}
          </div>
        `}
      `;
    };

    // Layout selection handlers
    layoutCenterBtn.onclick = () => {
      selectedLayout = "center-stack";
      layoutCenterBtn.style.background = "#3b82f6";
      layoutCenterBtn.style.borderColor = "#1e3c72";
      layoutCenterBtn.style.color = "white";
      layoutSideBtn.style.background = "#f5f5f5";
      layoutSideBtn.style.borderColor = "#d1d5db";
      layoutSideBtn.style.color = "#222";

      stepSize.style.display = "block";
      previewContainer.style.display = "block";
      saveBtn.style.display = "block";
      setData((prev) => ({ ...prev, loginLayout: "center-stack" }));
      updatePreview();
    };

    layoutSideBtn.onclick = () => {
      selectedLayout = "side-by-side";
      layoutSideBtn.style.background = "#3b82f6";
      layoutSideBtn.style.borderColor = "#1e3c72";
      layoutSideBtn.style.color = "white";
      layoutCenterBtn.style.background = "#f0f4ff";
      layoutCenterBtn.style.borderColor = "#3b82f6";
      layoutCenterBtn.style.color = "#222";

      stepSize.style.display = "block";
      previewContainer.style.display = "block";
      saveBtn.style.display = "block";
      setData((prev) => ({ ...prev, loginLayout: "side-by-side" }));
      updatePreview();
    };

    // Update on slider changes
    widthSlider.oninput = updatePreview;
    heightSlider.oninput = updatePreview;
    radiusSlider.oninput = updatePreview;
    fontsizeSlider.oninput = updatePreview;
    nameColorPicker.oninput = updatePreview;
    taglineColorPicker.oninput = updatePreview;

    // Save handler
    saveBtn.onclick = () => {
      setData((prev) => ({
        ...prev,
        logoWidth: currentW,
        logoHeight: currentH,
        logoBorderRadius: currentBorderRadius,
        nameFontSize: currentFontSize,
        nameColor: nameColorPicker.value,
        taglineColor: taglineColorPicker.value,
      }));
      modal.remove();
      showNotification("Logo customization saved ✓", "success");
    };

    cancelBtn.onclick = () => modal.remove();
  };

  // Auto-rotate images every 3 seconds
  // Load saved organization details when component mounts
  useEffect(() => {
    const loadOrganizationDetails = async () => {
      try {
        const response = await http.get("/organization-details");
        const savedData = response.data || response;
        if (savedData && Object.keys(savedData).length > 0) {
          setData({
            name: savedData.name || "",
            tagline: savedData.tagline || "",
            natureOfBusiness: savedData.natureOfBusiness || "",
            address: {
              street: savedData.address?.street || "",
              city: savedData.address?.city || "",
              state: savedData.address?.state || "",
              country: savedData.address?.country || "",
              postalCode: savedData.address?.postalCode || ""
            },
            contactInfo: {
              mobile: savedData.contactInfo?.mobile || "",
              email: savedData.contactInfo?.email || ""
            },
            socialMedia: {
              facebook: savedData.socialMedia?.facebook || "",
              twitter: savedData.socialMedia?.twitter || "",
              linkedin: savedData.socialMedia?.linkedin || "",
              instagram: savedData.socialMedia?.instagram || "",
              youtube: savedData.socialMedia?.youtube || "",
              whatsapp: savedData.socialMedia?.whatsapp || ""
            },
            logo: savedData.logo || null,
            logoWidth: savedData.logoWidth || 200,
            logoHeight: savedData.logoHeight || 100,
            logoBorderRadius: savedData.logoBorderRadius || 0,
            loginLayout: savedData.loginLayout || "center-stack",
            logoSize: savedData.logoSize || 60,
            nameFontSize: savedData.nameFontSize || 24,
            taglineFontSize: savedData.taglineFontSize || 14,
            nameColor: savedData.nameColor || "#222",
            taglineColor: savedData.taglineColor || "#666",
            loginImages: savedData.loginImages || [],
            loginVideo: savedData.loginVideo || null
          });
        }
      } catch (err) {
        console.log("Could not load organization details");
      }
    };
    loadOrganizationDetails();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
    const MIN_WIDTH = 800;
    const MAX_WIDTH = 2000;
    const MIN_HEIGHT = 400;
    const MAX_HEIGHT = 1500;

    if (data.loginImages.length + files.length > 5) {
      showNotification("Maximum 5 images allowed", "warning");
      return;
    }

    files.forEach((file) => {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        showNotification(`Image "${file.name}" is too large. Maximum file size is 1MB.`, "error");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        // Check image dimensions
        const img = new Image();
        img.onload = () => {
          if (img.width < MIN_WIDTH || img.width > MAX_WIDTH) {
            showNotification(`Image "${file.name}" width must be between ${MIN_WIDTH}px and ${MAX_WIDTH}px. Current: ${img.width}px`, "error");
            return;
          }
          if (img.height < MIN_HEIGHT || img.height > MAX_HEIGHT) {
            showNotification(`Image "${file.name}" height must be between ${MIN_HEIGHT}px and ${MAX_HEIGHT}px. Current: ${img.height}px`, "error");
            return;
          }
          setData((prev) => ({
            ...prev,
            loginImages: [...prev.loginImages, event.target.result as string]
          }));
        };
        img.onerror = () => {
          showNotification(`Failed to load image "${file.name}". Please ensure it's a valid image file.`, "error");
        };
        img.src = event.target.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setData((prev) => ({
      ...prev,
      loginImages: prev.loginImages.filter((_, i) => i !== index)
    }));
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

    if (file.size > MAX_VIDEO_SIZE) {
      showNotification(`Video file is too large. Maximum file size is 50MB. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`, "error");
      return;
    }

    // Upload the file itself; only its URL goes into the org details payload
    // (a base64 video blows past the request body limit and Mongo's 16MB document cap).
    setVideoUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response: any = await http.postForm("/organization-details/video", form);
      const url = response?.data?.url;
      if (!url) throw new Error("Upload did not return a URL");
      setData((prev) => ({
        ...prev,
        loginVideo: url
      }));
      showNotification("Video uploaded. Click 'Save Changes' to apply it to the login page.", "success");
    } catch (err: any) {
      showNotification(`Failed to upload video: ${err?.message || "unknown error"}`, "error");
    } finally {
      setVideoUploading(false);
    }
  };

  const removeVideo = () => {
    setData((prev) => ({
      ...prev,
      loginVideo: null
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MIN_LOGO_SIZE = 10 * 1024; // 10KB
    const MAX_LOGO_SIZE = 500 * 1024; // 500KB

    if (file.size < MIN_LOGO_SIZE) {
      showNotification(`Logo file is too small. Minimum file size is 20KB. Current size: ${(file.size / 1024).toFixed(2)}KB`, "error");
      return;
    }

    if (file.size > MAX_LOGO_SIZE) {
      showNotification(`Logo file is too large. Maximum file size is 500KB. Current size: ${(file.size / 1024).toFixed(2)}KB`, "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Display box defaults to 120×120 (object-fit keeps the aspect ratio)
        setData((prev) => ({
          ...prev,
          logo: event.target?.result as string,
          logoWidth: 120,
          logoHeight: 120
        }));
        showNotification("Logo uploaded successfully.", "success");
      };
      img.onerror = () => {
        showNotification("Failed to load logo. Please ensure it's a valid image file.", "error");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setData((prev) => ({
      ...prev,
      logo: null
    }));
  };

  const save = async () => {
    // Check which field is empty and scroll to it
    const emptyFields: { [key: string]: string } = {};

    if (!data.name) emptyFields.name = "Organization Name";
    if (!data.tagline) emptyFields.tagline = "Tag Line";
    if (!data.natureOfBusiness) emptyFields.natureOfBusiness = "Nature of Business";
    if (!data.address.street) emptyFields.street = "Street Address";
    if (!data.address.city) emptyFields.city = "City";
    if (!data.address.state) emptyFields.state = "State";
    if (!data.address.country) emptyFields.country = "Country";
    if (!data.contactInfo.mobile) emptyFields.mobile = "Mobile Number";
    if (!data.contactInfo.email) emptyFields.email = "Email Address";

    if (Object.keys(emptyFields).length > 0) {
      const firstEmptyField = document.querySelector(`[data-field="${Object.keys(emptyFields)[0]}"]`);
      if (firstEmptyField) {
        firstEmptyField.scrollIntoView({ behavior: "smooth", block: "center" });
        (firstEmptyField as HTMLInputElement).focus();
        (firstEmptyField as HTMLInputElement).style.borderColor = "#ef4444";
        (firstEmptyField as HTMLInputElement).style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.1)";
        setTimeout(() => {
          (firstEmptyField as HTMLInputElement).style.borderColor = "";
          (firstEmptyField as HTMLInputElement).style.boxShadow = "";
        }, 3000);
      }
      return;
    }

    setLoading(true);
    try {
      // Save to database via API
      console.log("Saving organization details:", data);
      const response = await http.post("/organization-details", data);
      console.log("Save response:", response);

      // Show success notification
      const successPopup = document.createElement("div");
      successPopup.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 20px;">✓</div>
          <div>
            <div style="font-weight: 600; margin-bottom: 2px;">Success!</div>
            <div style="font-size: 13px; opacity: 0.95;">Organization details saved successfully</div>
          </div>
        </div>
      `;
      successPopup.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 9999;
        box-shadow: 0 10px 25px rgba(22, 163, 74, 0.3);
        animation: slideInRight 0.4s ease-out;
        border-left: 4px solid #22c55e;
      `;

      const style = document.createElement("style");
      style.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      if (!document.querySelector("style[data-toast-animation]")) {
        style.setAttribute("data-toast-animation", "true");
        document.head.appendChild(style);
      }

      document.body.appendChild(successPopup);
      setTimeout(() => {
        successPopup.style.animation = "slideInRight 0.4s ease-out reverse";
        setTimeout(() => successPopup.remove(), 400);
      }, 3000);
    } catch (error) {
      // Show error notification with detailed message
      const errorMsg = error instanceof Error ? error.message : "Failed to save organization details";
      console.error("Save error:", errorMsg, error);

      const errorPopup = document.createElement("div");
      const isValidationError = errorMsg.toLowerCase().includes("required") || errorMsg.toLowerCase().includes("invalid");

      errorPopup.innerHTML = `
        <div style="display: flex; gap: 12px;">
          <div style="font-size: 20px; flex-shrink: 0;">⚠️</div>
          <div style="flex: 1;">
            <div style="font-weight: 600; margin-bottom: 4px;">Unable to Save</div>
            <div style="font-size: 13px; opacity: 0.95; line-height: 1.4;">${errorMsg}</div>
            ${isValidationError ? '<div style="font-size: 12px; opacity: 0.85; margin-top: 6px;">Please check all required fields are filled correctly.</div>' : ''}
          </div>
        </div>
      `;
      errorPopup.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 9999;
        box-shadow: 0 10px 25px rgba(239, 68, 68, 0.3);
        animation: slideInRight 0.4s ease-out;
        border-left: 4px solid #f87171;
        max-width: 400px;
        word-wrap: break-word;
      `;

      document.body.appendChild(errorPopup);
      setTimeout(() => {
        errorPopup.style.animation = "slideInRight 0.4s ease-out reverse";
        setTimeout(() => errorPopup.remove(), 400);
      }, 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-5 @container">
      {/* Header with always-reachable Save */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Organization Details</h2>
          <p className="text-sm text-muted-foreground">Configure your organization information and login page branding</p>
        </div>
        <Button onClick={save} disabled={loading || videoUploading} className="shrink-0 px-6">
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid grid-cols-1 @5xl:grid-cols-2 gap-5 items-start">
        {/* Left column - organization info */}
        <div className="space-y-5 min-w-0">
          <OrgSection title="Basic Information">
            <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
              <div>
                <label className={orgLabel}>Organization Name *</label>
                <input
                  data-field="name"
                  type="text"
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  placeholder="Enter organization name"
                  className={orgInput}
                />
              </div>
              <div>
                <label className={orgLabel}>Nature of Business *</label>
                <select
                  data-field="natureOfBusiness"
                  value={data.natureOfBusiness}
                  onChange={(e) => setData({ ...data, natureOfBusiness: e.target.value })}
                  className={orgInput}
                >
                  <option value="">Select nature of business</option>
                  {NATURE_OF_BUSINESS.map((nature) => (
                    <option key={nature} value={nature}>
                      {nature}
                    </option>
                  ))}
                </select>
              </div>
              <div className="@md:col-span-2">
                <label className={orgLabel}>Tag Line / Motto *</label>
                <input
                  data-field="tagline"
                  type="text"
                  value={data.tagline}
                  onChange={(e) => setData({ ...data, tagline: e.target.value })}
                  placeholder="Enter your organization's tag line"
                  className={orgInput}
                />
              </div>
            </div>
          </OrgSection>

          <OrgSection title="Address">
            <div className="grid grid-cols-2 @xl:grid-cols-4 gap-3">
              <div className="col-span-2 @xl:col-span-4">
                <label className={orgLabel}>Street Address *</label>
                <input
                  data-field="street"
                  type="text"
                  value={data.address.street}
                  onChange={(e) => setData({ ...data, address: { ...data.address, street: e.target.value } })}
                  placeholder="Enter street address"
                  className={orgInput}
                />
              </div>
              <div>
                <label className={orgLabel}>City *</label>
                <input
                  data-field="city"
                  type="text"
                  value={data.address.city}
                  onChange={(e) => setData({ ...data, address: { ...data.address, city: e.target.value } })}
                  placeholder="City"
                  className={orgInput}
                />
              </div>
              <div>
                <label className={orgLabel}>State *</label>
                <input
                  data-field="state"
                  type="text"
                  value={data.address.state}
                  onChange={(e) => setData({ ...data, address: { ...data.address, state: e.target.value } })}
                  placeholder="State"
                  className={orgInput}
                />
              </div>
              <div>
                <label className={orgLabel}>Country *</label>
                <input
                  data-field="country"
                  type="text"
                  value={data.address.country}
                  onChange={(e) => setData({ ...data, address: { ...data.address, country: e.target.value } })}
                  placeholder="Country"
                  className={orgInput}
                />
              </div>
              <div>
                <label className={orgLabel}>Postal Code</label>
                <input
                  type="text"
                  value={data.address.postalCode}
                  onChange={(e) => setData({ ...data, address: { ...data.address, postalCode: e.target.value } })}
                  placeholder="Postal code"
                  className={orgInput}
                />
              </div>
            </div>
          </OrgSection>

          <OrgSection title="Contact Information">
            <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
              <div>
                <label className={orgLabel}>Mobile Number *</label>
                <input
                  data-field="mobile"
                  type="tel"
                  value={data.contactInfo.mobile}
                  onChange={(e) => setData({ ...data, contactInfo: { ...data.contactInfo, mobile: e.target.value } })}
                  placeholder="Enter mobile number"
                  className={orgInput}
                />
              </div>
              <div>
                <label className={orgLabel}>Email Address *</label>
                <input
                  data-field="email"
                  type="email"
                  value={data.contactInfo.email}
                  onChange={(e) => setData({ ...data, contactInfo: { ...data.contactInfo, email: e.target.value } })}
                  placeholder="Enter email address"
                  className={orgInput}
                />
              </div>
            </div>
          </OrgSection>

          <OrgSection title="Social Media Links">
            <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
              {SOCIAL_MEDIA_PLATFORMS.map((platform) => (
                <div key={platform.id}>
                  <label className={orgLabel}>
                    <i className={`bi ${platform.icon} mr-1.5`}></i>
                    {platform.label}
                  </label>
                  <input
                    type="url"
                    value={data.socialMedia[platform.id as keyof typeof data.socialMedia]}
                    onChange={(e) =>
                      setData({
                        ...data,
                        socialMedia: {
                          ...data.socialMedia,
                          [platform.id]: e.target.value
                        }
                      })
                    }
                    placeholder={platform.placeholder}
                    className={orgInput}
                  />
                </div>
              ))}
            </div>
          </OrgSection>
        </div>

        {/* Right column - login page branding */}
        <div className="space-y-5 min-w-0">
          <OrgSection
            title="Logo & Login Header"
            hint="Logo: JPG/PNG · 10KB–500KB · 200×100px to 500×500px"
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              style={{ display: "none" }}
              id="logo-upload"
            />
            <div className="flex items-center gap-4">
              <div className="h-20 w-36 shrink-0 rounded-md border bg-muted/40 flex items-center justify-center overflow-hidden">
                {data.logo ? (
                  <img src={data.logo} alt="Organization Logo" className="max-h-full max-w-full object-contain p-2" />
                ) : (
                  <span className="text-2xl">🏢</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <label htmlFor="logo-upload" className={orgSecondaryBtn}>
                  {data.logo ? "Replace" : "Upload Logo"}
                </label>
                {data.logo && (
                  <button onClick={removeLogo} className={orgDangerBtn}>
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className={orgLabel}>Name Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={data.nameColor || "#222"}
                    onChange={(e) => setData({ ...data, nameColor: e.target.value })}
                    className="h-9 w-12 border rounded-md border-input cursor-pointer bg-background"
                  />
                  <span className="text-xs font-mono text-muted-foreground">{data.nameColor || "#222"}</span>
                </div>
              </div>
              <div>
                <label className={orgLabel}>Tagline Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={data.taglineColor || "#666"}
                    onChange={(e) => setData({ ...data, taglineColor: e.target.value })}
                    className="h-9 w-12 border rounded-md border-input cursor-pointer bg-background"
                  />
                  <span className="text-xs font-mono text-muted-foreground">{data.taglineColor || "#666"}</span>
                </div>
              </div>
            </div>

            {data.logo && data.name && (
              <div className="mt-4 pt-4 border-t space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium">Display Style</span>
                  <div className="inline-flex rounded-md border p-0.5 bg-muted/40">
                    {([
                      ["center-stack", "Logo Top"],
                      ["side-by-side", "Logo Left"]
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => setData({ ...data, loginLayout: value })}
                        className={`px-3 py-1 rounded text-xs font-medium transition ${
                          data.loginLayout === value ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 @md:grid-cols-2 gap-x-5 gap-y-3">
                  {([
                    ["logoWidth", "Logo Width", 40, 120, 5],
                    ["logoHeight", "Logo Height", 40, 120, 5],
                    ["logoBorderRadius", "Logo Border Radius", 0, 50, 2],
                    ["nameFontSize", "Name Font Size", 16, 40, 1],
                    ["taglineFontSize", "Tagline Font Size", 10, 24, 1]
                  ] as const).map(([key, label, min, max, step]) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium">{label}</label>
                        <span className="text-[11px] font-mono text-muted-foreground">{data[key] ?? min}px</span>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={data[key] ?? min}
                        onChange={(e) => setData({ ...data, [key]: Number(e.target.value) })}
                        className="org-range w-full"
                      />
                    </div>
                  ))}
                </div>

                {/* Header preview: mirrors how the login page renders the header */}
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Preview</div>
                  <div className="bg-gradient-to-b from-blue-100 to-blue-50 border border-blue-300 rounded-lg p-4">
                    <div style={{
                      display: "flex",
                      flexDirection: data.loginLayout === "side-by-side" ? "row" : "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: data.loginLayout === "side-by-side" ? "12px" : "8px",
                    }}>
                      <img
                        src={data.logo}
                        alt="Logo Preview"
                        style={{
                          maxWidth: `${data.logoWidth || 120}px`,
                          maxHeight: `${data.logoHeight || 120}px`,
                          objectFit: "contain",
                          borderRadius: `${data.logoBorderRadius || 0}px`,
                        }}
                      />
                      {/* divs, not h1/p: a global stylesheet forces heading/paragraph colors with !important */}
                      <div style={{ textAlign: data.loginLayout === "side-by-side" ? "left" : "center" }}>
                        <div style={{
                          fontSize: `${data.nameFontSize}px`,
                          fontWeight: 700,
                          lineHeight: 1.2,
                          color: data.nameColor || "#222",
                        }}>
                          {data.name}
                        </div>
                        {data.tagline && (
                          <div style={{
                            fontSize: `${data.taglineFontSize}px`,
                            color: data.taglineColor || "#666",
                            marginTop: "4px",
                          }}>
                            {data.tagline}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </OrgSection>

          <OrgSection
            title="Login Video"
            hint="MP4, WebM or MOV · max 50MB · 1 video"
          >
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleVideoUpload}
              style={{ display: "none" }}
              id="video-upload"
            />
            {videoUploading ? (
              <div className="aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                Uploading video…
              </div>
            ) : data.loginVideo ? (
              <div className="space-y-2">
                <video
                  key={data.loginVideo}
                  src={data.loginVideo}
                  controls
                  preload="metadata"
                  className="w-full aspect-video rounded-lg bg-black object-contain"
                />
                <div className="flex justify-end gap-2">
                  <label htmlFor="video-upload" className={orgSecondaryBtn}>
                    Replace Video
                  </label>
                  <button onClick={removeVideo} className={orgDangerBtn}>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label
                htmlFor="video-upload"
                className="flex flex-col items-center justify-center gap-1 py-8 rounded-lg border-2 border-dashed cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <span className="text-xl">🎬</span>
                <span className="font-medium text-xs">Upload Video</span>
                <span className="text-[11px] text-muted-foreground">Plays on the login page</span>
              </label>
            )}
          </OrgSection>

          <OrgSection
            title={`Login Images (${data.loginImages.length}/5)`}
            hint="JPG/PNG · max 1MB each · 800×400px to 2000×1500px"
          >
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: "none" }}
              id="image-upload"
            />
            <div className="grid grid-cols-3 @md:grid-cols-5 gap-2">
              {data.loginImages.map((img, idx) => (
                <div key={idx} className="relative aspect-[4/3] rounded-md overflow-hidden border group">
                  <img src={img} alt={`Login image ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    title="Remove image"
                    className="absolute top-1 right-1 bg-black/60 text-white rounded text-xs w-5 h-5 flex items-center justify-center hover:bg-black/80"
                  >
                    ×
                  </button>
                </div>
              ))}
              {data.loginImages.length < 5 && (
                <label
                  htmlFor="image-upload"
                  className="aspect-[4/3] rounded-md border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors text-muted-foreground"
                >
                  <span className="text-lg leading-none">+</span>
                  <span className="text-[11px] mt-1">Add</span>
                </label>
              )}
            </div>
          </OrgSection>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <Button onClick={save} disabled={loading || videoUploading} className="px-6">
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
