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
import EventTypesPage from "../pages/EventTypesPage";
import RolesPage from "../pages/RolesPage";
import DepartmentsPage from "../pages/DepartmentsPage";
import AuditLogsPage from "../pages/AuditLogsPage";
import MiniCrudPage from "../components/MiniCrudPage";
import {
  Tag,
  Circle,
  ToggleLeft,
  Hash,
  ClipboardList,
  ListChecks,
  Database,
  Map,
  Grid3x3,
  Folder,
  Award,
  CreditCard as CreditIcon,
  FileText,
  Palette,
  Lock,
  Download,
  ShieldAlert,
  Key,
  BellRing,
  FileCheck,
} from "lucide-react";
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
      { slug: "backup-export", label: "Backup & Export" },
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
      { slug: "certificate-templates", label: "Certificate Templates" },
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
      { slug: "platform-invoices", label: "Platform Invoices" },
      { slug: "billing-details", label: "Billing Details & Methods" },
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
      { slug: "integrations-api-keys", label: "API Access & Keys" },
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

  // Accordion behaviour: only one Configuration group is expanded at a time.
  // On first render the group containing the active submenu item auto-opens;
  // otherwise everything is collapsed.
  const activeCategoryId = CONFIGURATION_CATEGORIES.find((c) =>
    c.items.some((it) => it.slug === activeSlug)
  )?.id ?? null;

  const [openCategoryId, setOpenCategoryId] = useState<string | null>(activeCategoryId);

  // If the URL changes to another submenu inside a different group, expand
  // that group so the user sees where they are.
  useEffect(() => {
    if (activeCategoryId && activeCategoryId !== openCategoryId) {
      setOpenCategoryId(activeCategoryId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategoryId]);

  const handleSelectSlug = (slug: string) => {
    navigate(`/modules/${slug}`);
  };

  const renderActiveConfigComponent = (slug: string) => {
    switch (slug) {
      case "organization-details":
        return <OrganizationDetailsPage />;
      case "branding":
        return (
          <MiniCrudPage
            title="Branding & White-label"
            description="Brand-your-workspace assets, colors, and custom domains."
            icon={Palette}
            storageKey="em_branding"
            createLabel="Add asset"
            fields={[
              { key: "type", label: "Asset type", type: "select", options: ["Logo (light)", "Logo (dark)", "Favicon", "Email header", "Custom domain", "Brand color"] },
              { key: "value", label: "Value / URL / hex", required: true },
              { key: "active", label: "Active", type: "select", options: ["yes", "no"] },
            ]}
            columns={[
              { key: "type", label: "Asset" },
              { key: "value", label: "Value", render: (r) => r.type === "Brand color" ? <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded" style={{ background: r.value }} /><code className="font-mono text-xs">{r.value}</code></span> : <span className="text-xs">{r.value}</span> },
              { key: "active", label: "Active" },
            ]}
            seed={[
              { id: "1", type: "Brand color", value: "#2249b7", active: "yes" },
              { id: "2", type: "Custom domain", value: "events.mycompany.com", active: "no" },
              { id: "3", type: "Email header", value: "https://cdn.example.com/logo-email.png", active: "yes" },
            ]}
            footer="For logo, name, tagline, and login page, see Organization Details above."
          />
        );
      case "backup-export":
        return (
          <MiniCrudPage
            title="Backup & Export"
            description="Full-organization backup jobs (encrypted ZIP)."
            icon={Download}
            storageKey="em_backup_jobs"
            createLabel="New backup"
            fields={[
              { key: "name", label: "Backup name", required: true, placeholder: "Weekly full backup" },
              { key: "cadence", label: "Cadence", type: "select", options: ["one-off", "daily", "weekly", "monthly"] },
              { key: "delivery", label: "Delivery", type: "select", options: ["Email link", "S3 bucket"] },
              { key: "includes", label: "Includes (comma-separated)", placeholder: "participants,payments,files" },
              { key: "status", label: "Last status", type: "select", options: ["scheduled", "running", "completed", "failed"] },
            ]}
            columns={[
              { key: "name", label: "Backup" },
              { key: "cadence", label: "Cadence" },
              { key: "delivery", label: "Delivery" },
              { key: "status", label: "Status" },
            ]}
            seed={[
              { id: "1", name: "Weekly full backup", cadence: "weekly", delivery: "Email link", includes: "all", status: "completed" },
              { id: "2", name: "Monthly to S3", cadence: "monthly", delivery: "S3 bucket", includes: "all", status: "scheduled" },
            ]}
            footer="Distinct from Reports → Exports (report-shaped data). This is a full-fidelity encrypted org backup."
          />
        );
      case "privacy-requests":
        return (
          <MiniCrudPage
            title="Privacy Requests"
            description="Participant data-privacy queue — export, delete, rectify."
            icon={ShieldAlert}
            storageKey="em_privacy_requests"
            createLabel="Log request"
            fields={[
              { key: "participant", label: "Participant name / email", required: true },
              { key: "type", label: "Type", type: "select", options: ["Export", "Delete / Anonymize", "Rectify"] },
              { key: "status", label: "Status", type: "select", options: ["Open", "In progress", "Approved", "Rejected", "Completed"] },
              { key: "dueBy", label: "Due by", placeholder: "YYYY-MM-DD" },
              { key: "note", label: "Notes", type: "textarea" },
            ]}
            columns={[
              { key: "participant", label: "Participant" },
              { key: "type", label: "Type" },
              { key: "status", label: "Status" },
              { key: "dueBy", label: "Due by" },
            ]}
            seed={[
              { id: "1", participant: "priya@example.com", type: "Export", status: "In progress", dueBy: "2026-10-15", note: "GDPR right-to-access" },
              { id: "2", participant: "old_user@example.com", type: "Delete / Anonymize", status: "Completed", dueBy: "2026-09-20", note: "Account deletion request" },
            ]}
          />
        );
      case "users":
        return <UserManagementPage />;
      case "roles":
        return <RolesPage />;
      case "departments":
        return <DepartmentsPage />;
      case "security":
        return (
          <MiniCrudPage
            title="Security Policies"
            description="Password rules, 2FA enforcement, session limits."
            icon={Lock}
            storageKey="em_security_policies"
            createLabel="Add policy"
            fields={[
              { key: "name", label: "Policy name", required: true },
              { key: "type", label: "Type", type: "select", options: ["Password", "2FA", "Session", "IP restriction"] },
              { key: "value", label: "Rule / value", placeholder: "e.g. min length 12" },
              { key: "appliesTo", label: "Applies to (role)", placeholder: "all / role name" },
              { key: "active", label: "Active", type: "select", options: ["yes", "no"] },
            ]}
            columns={[
              { key: "name", label: "Policy" },
              { key: "type", label: "Type" },
              { key: "value", label: "Value" },
              { key: "appliesTo", label: "Applies to" },
              { key: "active", label: "Active" },
            ]}
            seed={[
              { id: "1", name: "Minimum password length", type: "Password", value: "12 characters", appliesTo: "all", active: "yes" },
              { id: "2", name: "Password expiry", type: "Password", value: "90 days", appliesTo: "all", active: "yes" },
              { id: "3", name: "Enforce 2FA for admins", type: "2FA", value: "Required", appliesTo: "Administrator", active: "yes" },
              { id: "4", name: "Session timeout", type: "Session", value: "8 hours idle", appliesTo: "all", active: "yes" },
            ]}
          />
        );
      case "audit-logs":
        return <AuditLogsPage />;
      case "files":
        return (
          <MiniCrudPage
            title="File Manager"
            description="Files uploaded across the workspace."
            icon={Folder}
            storageKey="em_files"
            createLabel="Upload"
            fields={[
              { key: "name", label: "File name", required: true, placeholder: "report.pdf" },
              { key: "folder", label: "Folder", placeholder: "e.g. reports/2026" },
              { key: "type", label: "Type", type: "select", options: ["PDF", "Image", "Document", "Spreadsheet", "Other"] },
              { key: "size", label: "Size", placeholder: "e.g. 1.4 MB" },
              { key: "tags", label: "Tags", placeholder: "comma-separated" },
            ]}
            columns={[
              { key: "name", label: "File" },
              { key: "folder", label: "Folder" },
              { key: "type", label: "Type" },
              { key: "size", label: "Size" },
              { key: "tags", label: "Tags" },
            ]}
            seed={[
              { id: "1", name: "Q3 revenue report.pdf", folder: "reports/2026", type: "PDF", size: "245 KB", tags: "finance,q3" },
              { id: "2", name: "Speaker headshots.zip", folder: "events/tech-conf", type: "Other", size: "18 MB", tags: "speakers,media" },
              { id: "3", name: "GST invoice template.docx", folder: "templates", type: "Document", size: "124 KB", tags: "invoice,gst" },
            ]}
          />
        );
      case "subscription-usage":
        return (
          <div className="p-6 md:p-8 space-y-4">
            <div className="pb-4 border-b">
              <div className="flex items-center gap-2">
                <CreditIcon className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Subscription & Usage</h2>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Your current plan and usage against limits.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border bg-card p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Current plan</div>
                <div className="text-2xl font-semibold text-foreground mt-1">Professional</div>
                <div className="text-xs text-muted-foreground mt-1">Yearly · ₹49,999 / year</div>
                <div className="text-xs text-muted-foreground mt-3 pt-3 border-t">Renews on <strong className="text-foreground">15 March 2027</strong></div>
              </div>
              <div className="md:col-span-2 rounded-xl border bg-card p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Usage this period</div>
                <div className="space-y-3">
                  {[
                    { label: "Events", used: 8, total: 50 },
                    { label: "Participants", used: 7500, total: 25000 },
                    { label: "Users", used: 12, total: 25 },
                    { label: "Storage", used: 18, total: 100, unit: " GB" },
                    { label: "Emails this month", used: 8500, total: 10000 },
                  ].map((m) => {
                    const pct = Math.round((m.used / m.total) * 100);
                    return (
                      <div key={m.label}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{m.label}</span>
                          <span className="tabular-nums text-foreground">{m.used.toLocaleString()}{m.unit || ""} / {m.total.toLocaleString()}{m.unit || ""}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: pct > 90 ? "var(--destructive)" : pct > 75 ? "var(--warning)" : "var(--primary)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-sm font-semibold text-foreground mb-1">Need more?</div>
              <div className="text-xs text-muted-foreground">Upgrade to Enterprise for unlimited events, white-label, and priority support.</div>
              <button className="mt-3 h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm" style={{ background: "var(--primary)" }}>See plans</button>
            </div>
          </div>
        );
      case "platform-invoices":
        return (
          <MiniCrudPage
            title="Platform Invoices"
            description="Invoices you receive from Knowvato for your subscription."
            icon={FileCheck}
            storageKey="em_platform_invoices"
            createLabel="Add invoice"
            fields={[
              { key: "number", label: "Invoice number", required: true },
              { key: "date", label: "Date" },
              { key: "amount", label: "Amount (₹)" },
              { key: "status", label: "Status", type: "select", options: ["Paid", "Pending", "Overdue"] },
            ]}
            columns={[
              { key: "number", label: "Invoice #" },
              { key: "date", label: "Date" },
              { key: "amount", label: "Amount", render: (r) => <span className="tabular-nums">₹{r.amount}</span> },
              { key: "status", label: "Status", render: (r) => <span className={r.status === "Paid" ? "text-success" : r.status === "Overdue" ? "text-red-600" : ""}>{r.status}</span> },
            ]}
            seed={[
              { id: "1", number: "SUB/2526/00187", date: "2026-03-15", amount: "49,999", status: "Paid" },
              { id: "2", number: "SUB/2425/00142", date: "2025-03-15", amount: "39,999", status: "Paid" },
              { id: "3", number: "SUB/2425/00098", date: "2024-03-15", amount: "29,999", status: "Paid" },
            ]}
          />
        );
      case "billing-details":
        return (
          <MiniCrudPage
            title="Billing Details & Payment Methods"
            description="Your platform-billing profile and saved payment methods for renewals."
            icon={CreditIcon}
            storageKey="em_billing_methods"
            createLabel="Add method"
            fields={[
              { key: "type", label: "Type", type: "select", options: ["Card", "UPI", "Netbanking", "Billing address", "GSTIN", "Finance contact"] },
              { key: "value", label: "Value (masked)", required: true, placeholder: "•••• 4242 or acme@upi" },
              { key: "isDefault", label: "Default", type: "select", options: ["no", "yes"] },
            ]}
            columns={[
              { key: "type", label: "Type" },
              { key: "value", label: "Value", render: (r) => <code className="font-mono text-xs">{r.value}</code> },
              { key: "isDefault", label: "Default" },
            ]}
            seed={[
              { id: "1", type: "Card", value: "•••• 4242 (Visa)", isDefault: "yes" },
              { id: "2", type: "GSTIN", value: "29ABCDE1234F1Z5", isDefault: "yes" },
              { id: "3", type: "Finance contact", value: "finance@mycompany.com", isDefault: "yes" },
              { id: "4", type: "Billing address", value: "Level 5, Sona Tower, MG Road, Bengaluru 560001", isDefault: "yes" },
            ]}
          />
        );
      case "payment-gateways":
        return (
          <MiniCrudPage
            title="Payment Gateways"
            description="Providers your customers use to buy tickets (money in)."
            icon={CreditIcon}
            storageKey="em_payment_gateways"
            createLabel="Add gateway"
            fields={[
              { key: "provider", label: "Provider", type: "select", options: ["Razorpay", "Stripe", "PayPal", "Cashfree", "PayU", "Offline"] },
              { key: "name", label: "Display name", required: true, placeholder: "e.g. Razorpay India" },
              { key: "environment", label: "Environment", type: "select", options: ["test", "live"] },
              { key: "currency", label: "Currency", placeholder: "INR" },
              { key: "isDefault", label: "Default", type: "select", options: ["no", "yes"] },
              { key: "priority", label: "Priority", type: "number" },
              { key: "active", label: "Active", type: "select", options: ["yes", "no"] },
            ]}
            columns={[
              { key: "provider", label: "Provider" },
              { key: "name", label: "Name" },
              { key: "environment", label: "Env" },
              { key: "currency", label: "Currency" },
              { key: "isDefault", label: "Default" },
              { key: "active", label: "Active" },
            ]}
            seed={[
              { id: "1", provider: "Razorpay", name: "Razorpay India", environment: "live", currency: "INR", isDefault: "yes", priority: 1, active: "yes" },
              { id: "2", provider: "Stripe", name: "Stripe International", environment: "live", currency: "USD", isDefault: "no", priority: 2, active: "yes" },
              { id: "3", provider: "Offline", name: "Cash / Cheque / Bank transfer", environment: "live", currency: "INR", isDefault: "no", priority: 10, active: "yes" },
            ]}
            footer="Credentials are entered here in production — masked, encrypted, never returned by API."
          />
        );
      case "taxes-invoicing":
        return (
          <MiniCrudPage
            title="Taxes & Invoicing"
            description="Tax registrations per state, invoice series, and invoice template."
            icon={FileCheck}
            storageKey="em_taxes_invoicing"
            createLabel="Add rule"
            fields={[
              { key: "state", label: "State / Region", required: true },
              { key: "gstin", label: "GSTIN", placeholder: "29ABCDE1234F1Z5" },
              { key: "taxType", label: "Tax type", type: "select", options: ["GST (CGST+SGST)", "IGST", "VAT", "Zero-rated"] },
              { key: "rate", label: "Total rate %", type: "number" },
              { key: "invoiceSeries", label: "Invoice series", placeholder: "INV/{FY}/{SEQ:5}" },
              { key: "applicableTo", label: "Applies to", type: "select", options: ["Tickets", "Subscriptions", "Both"] },
            ]}
            columns={[
              { key: "state", label: "State" },
              { key: "gstin", label: "GSTIN", render: (r) => <code className="text-xs font-mono">{r.gstin || "—"}</code> },
              { key: "taxType", label: "Tax" },
              { key: "rate", label: "Rate", render: (r) => `${r.rate}%` },
              { key: "invoiceSeries", label: "Series", render: (r) => <code className="text-xs font-mono">{r.invoiceSeries}</code> },
              { key: "applicableTo", label: "Applies to" },
            ]}
            seed={[
              { id: "1", state: "Karnataka", gstin: "29ABCDE1234F1Z5", taxType: "GST (CGST+SGST)", rate: 18, invoiceSeries: "INV/{FY}/{SEQ:5}", applicableTo: "Tickets" },
              { id: "2", state: "All other Indian states", gstin: "29ABCDE1234F1Z5", taxType: "IGST", rate: 18, invoiceSeries: "INV/{FY}/{SEQ:5}", applicableTo: "Tickets" },
              { id: "3", state: "Export / International", gstin: "", taxType: "Zero-rated", rate: 0, invoiceSeries: "INV/{FY}/{SEQ:5}", applicableTo: "Tickets" },
            ]}
          />
        );
      case "event-types":
        return <EventTypesPage />;
      case "event-categories":
        return (
          <MiniCrudPage
            title="Event Categories"
            description="Categories for grouping and filtering events."
            icon={Tag}
            storageKey="em_event_categories_config"
            createLabel="Add category"
            fields={[
              { key: "name", label: "Name", required: true },
              { key: "color", label: "Color", type: "color" },
              { key: "description", label: "Description", type: "textarea" },
            ]}
            columns={[
              { key: "name", label: "Category", render: (r) => <div className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: r.color }} />{r.name}</div> },
              { key: "description", label: "Description" },
            ]}
            seed={[
              { id: "1", name: "Business", color: "#2249b7", description: "Corporate and B2B events" },
              { id: "2", name: "Education", color: "#059669", description: "Schools, colleges, workshops" },
              { id: "3", name: "Entertainment", color: "#dc2626", description: "Concerts, festivals, shows" },
              { id: "4", name: "Sports", color: "#f97316", description: "Athletic and fitness events" },
              { id: "5", name: "Cultural", color: "#a855f7", description: "Arts, music, dance" },
            ]}
          />
        );
      case "event-statuses":
        return (
          <MiniCrudPage
            title="Event Statuses"
            description="Custom statuses for the event lifecycle with allowed transitions."
            icon={Circle}
            storageKey="em_event_statuses"
            createLabel="Add status"
            fields={[
              { key: "label", label: "Label", required: true },
              { key: "color", label: "Color", type: "color" },
              { key: "order", label: "Order", type: "number" },
              { key: "sideEffects", label: "Side effects (comma-separated)", placeholder: "openRegistration,publicVisible" },
            ]}
            columns={[
              { key: "label", label: "Status", render: (r) => <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: r.color }} />{r.label}</span> },
              { key: "order", label: "Order" },
              { key: "sideEffects", label: "Side effects" },
            ]}
            seed={[
              { id: "1", label: "Draft", color: "#94a3b8", order: 1, sideEffects: "" },
              { id: "2", label: "Published", color: "#2249b7", order: 2, sideEffects: "publicVisible" },
              { id: "3", label: "Registration Open", color: "#059669", order: 3, sideEffects: "openRegistration,publicVisible" },
              { id: "4", label: "Live", color: "#dc2626", order: 4, sideEffects: "lockEditing" },
              { id: "5", label: "Completed", color: "#0891b2", order: 5, sideEffects: "" },
              { id: "6", label: "Archived", color: "#64748b", order: 6, sideEffects: "" },
            ]}
          />
        );
      case "event-default-features":
        return (
          <MiniCrudPage
            title="Default Event Features"
            description="Feature toggles that new events inherit unless overridden by their Event Type."
            icon={ToggleLeft}
            storageKey="em_default_features"
            createLabel="Add feature"
            fields={[
              { key: "name", label: "Feature", required: true },
              { key: "enabled", label: "Default", type: "select", options: ["enabled", "disabled"] },
              { key: "planGate", label: "Plan-gated?", type: "select", options: ["no", "starter", "pro", "enterprise"] },
              { key: "description", label: "What it does", type: "textarea" },
            ]}
            columns={[
              { key: "name", label: "Feature" },
              { key: "enabled", label: "Default" },
              { key: "planGate", label: "Plan gate" },
              { key: "description", label: "Description" },
            ]}
            seed={[
              { id: "1", name: "Registration required", enabled: "enabled", planGate: "no", description: "Attendees must register to attend" },
              { id: "2", name: "Approval workflow", enabled: "disabled", planGate: "no", description: "Manually approve each registration" },
              { id: "3", name: "Paid tickets", enabled: "disabled", planGate: "starter", description: "Collect payment for tickets" },
              { id: "4", name: "QR pass generation", enabled: "enabled", planGate: "no", description: "Generate QR-coded event passes" },
              { id: "5", name: "Attendance tracking", enabled: "enabled", planGate: "no", description: "Log check-ins" },
              { id: "6", name: "Certificates", enabled: "disabled", planGate: "pro", description: "Auto-generate participation certificates" },
              { id: "7", name: "Multi-gate check-in", enabled: "disabled", planGate: "pro", description: "Support multiple entry gates" },
              { id: "8", name: "Sponsor pages", enabled: "disabled", planGate: "starter", description: "Public sponsor listings" },
              { id: "9", name: "White-label branding", enabled: "disabled", planGate: "enterprise", description: "Remove Knowvato branding" },
            ]}
          />
        );
      case "event-id-formats":
        return (
          <MiniCrudPage
            title="Event ID Formats"
            description="Patterns for generating human-readable IDs. Tokens: {YYYY} {YY} {MM} {FY} {SEQ:n} {EVENTCODE} {ORGCODE}."
            icon={Hash}
            storageKey="em_id_formats"
            createLabel="Add format"
            fields={[
              { key: "entity", label: "Entity", type: "select", options: ["Event", "Registration", "Ticket", "Participant", "Invoice", "Certificate"] },
              { key: "pattern", label: "Pattern", required: true, placeholder: "EVT-{YYYY}-{SEQ:4}" },
              { key: "example", label: "Example", placeholder: "EVT-2026-0001" },
              { key: "resetOn", label: "Reset counter on", type: "select", options: ["never", "yearly", "monthly", "per event"] },
            ]}
            columns={[
              { key: "entity", label: "Entity" },
              { key: "pattern", label: "Pattern", render: (r) => <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{r.pattern}</code> },
              { key: "example", label: "Example", render: (r) => <span className="text-xs text-muted-foreground font-mono">{r.example}</span> },
              { key: "resetOn", label: "Reset" },
            ]}
            seed={[
              { id: "1", entity: "Event", pattern: "EVT-{YYYY}-{SEQ:4}", example: "EVT-2026-0001", resetOn: "yearly" },
              { id: "2", entity: "Registration", pattern: "REG-{EVENTCODE}-{SEQ:5}", example: "REG-TC26-00042", resetOn: "per event" },
              { id: "3", entity: "Ticket", pattern: "TKT-{YYYY}{MM}-{SEQ:6}", example: "TKT-202610-000123", resetOn: "monthly" },
              { id: "4", entity: "Invoice", pattern: "INV/{FY}/{SEQ:5}", example: "INV/2526/00187", resetOn: "yearly" },
              { id: "5", entity: "Certificate", pattern: "CERT-{EVENTCODE}-{SEQ:6}", example: "CERT-WS26-000042", resetOn: "per event" },
            ]}
          />
        );
      case "checklist-templates":
        return (
          <MiniCrudPage
            title="Checklist Templates"
            description="Reusable pre-event checklists. Applied to an event copies items into its checklist."
            icon={ClipboardList}
            storageKey="em_checklist_templates"
            createLabel="Add template"
            fields={[
              { key: "name", label: "Template name", required: true },
              { key: "category", label: "Category", type: "select", options: ["Venue", "Speakers", "Sponsors", "Registration", "Passes", "Volunteers", "Communication", "Completion"] },
              { key: "itemCount", label: "Number of items", type: "number" },
              { key: "description", label: "Description", type: "textarea" },
            ]}
            columns={[
              { key: "name", label: "Template" },
              { key: "category", label: "Category" },
              { key: "itemCount", label: "Items" },
              { key: "description", label: "Description" },
            ]}
            seed={[
              { id: "1", name: "Standard conference checklist", category: "Registration", itemCount: 24, description: "Venue, speakers, sponsors, pass design" },
              { id: "2", name: "Webinar prep", category: "Communication", itemCount: 8, description: "Reminders, tech check, recording" },
              { id: "3", name: "Sports event kit", category: "Registration", itemCount: 32, description: "Categories, BIB numbers, medical, timing" },
              { id: "4", name: "Volunteer coordination", category: "Volunteers", itemCount: 12, description: "Recruit, brief, assign, feedback" },
            ]}
          />
        );
      case "field-library":
        return (
          <MiniCrudPage
            title="Field Library"
            description="Reusable dynamic fields for every form across your workspace."
            icon={Database}
            storageKey="em_field_library"
            createLabel="Add field"
            fields={[
              { key: "key", label: "Machine name", required: true, placeholder: "meal_preference" },
              { key: "label", label: "Display label", required: true, placeholder: "Meal Preference" },
              { key: "type", label: "Type", type: "select", options: ["text", "number", "email", "phone", "dropdown", "multiselect", "rating", "date", "file", "signature", "address", "consent"] },
              { key: "category", label: "Category", type: "select", options: ["Personal", "Professional", "Logistics", "Preferences", "Consent"] },
              { key: "options", label: "Options (comma-separated for dropdown)", type: "textarea" },
              { key: "required", label: "Required by default?", type: "select", options: ["no", "yes"] },
              { key: "isSystem", label: "System field?", type: "select", options: ["no", "yes"] },
            ]}
            columns={[
              { key: "label", label: "Field" },
              { key: "key", label: "Key", render: (r) => <code className="text-xs font-mono text-muted-foreground">{r.key}</code> },
              { key: "type", label: "Type" },
              { key: "category", label: "Category" },
              { key: "required", label: "Required" },
            ]}
            seed={[
              { id: "1", key: "meal_preference", label: "Meal Preference", type: "dropdown", category: "Preferences", options: "Veg, Non-Veg, Jain, Vegan", required: "no", isSystem: "no" },
              { id: "2", key: "tshirt_size", label: "T-Shirt Size", type: "dropdown", category: "Logistics", options: "XS, S, M, L, XL, XXL", required: "no", isSystem: "no" },
              { id: "3", key: "dietary_restrictions", label: "Dietary Restrictions", type: "text", category: "Preferences", options: "", required: "no", isSystem: "no" },
              { id: "4", key: "emergency_contact", label: "Emergency Contact", type: "phone", category: "Personal", options: "", required: "no", isSystem: "no" },
              { id: "5", key: "company", label: "Company", type: "text", category: "Professional", options: "", required: "no", isSystem: "yes" },
              { id: "6", key: "designation", label: "Designation", type: "text", category: "Professional", options: "", required: "no", isSystem: "yes" },
              { id: "7", key: "accessibility_needs", label: "Accessibility Needs", type: "text", category: "Preferences", options: "", required: "no", isSystem: "no" },
              { id: "8", key: "terms_consent", label: "I accept the terms", type: "consent", category: "Consent", options: "", required: "yes", isSystem: "yes" },
            ]}
          />
        );
      case "form-templates":
        return (
          <MiniCrudPage
            title="Form Templates"
            description="Blueprints for registration, speaker, sponsor, feedback, and survey forms."
            icon={FileText}
            storageKey="em_form_templates"
            createLabel="Add template"
            fields={[
              { key: "name", label: "Template name", required: true },
              { key: "purpose", label: "Purpose", type: "select", options: ["Registration", "Speaker", "Sponsor", "Exhibitor", "Volunteer", "Feedback", "Survey", "Profile"] },
              { key: "category", label: "Event category", type: "select", options: ["Conference", "Workshop", "Webinar", "School", "Sports", "Cultural"] },
              { key: "fieldCount", label: "Number of fields", type: "number" },
              { key: "description", label: "Description", type: "textarea" },
            ]}
            columns={[
              { key: "name", label: "Template" },
              { key: "purpose", label: "Purpose" },
              { key: "category", label: "Category" },
              { key: "fieldCount", label: "Fields" },
            ]}
            seed={[
              { id: "1", name: "Corporate Conference Registration", purpose: "Registration", category: "Conference", fieldCount: 18, description: "Standard conference reg with meal + t-shirt" },
              { id: "2", name: "Speaker Application", purpose: "Speaker", category: "Conference", fieldCount: 12, description: "Bio, session pitch, travel needs" },
              { id: "3", name: "Sponsor Onboarding", purpose: "Sponsor", category: "Conference", fieldCount: 8, description: "Package, contacts, brand assets" },
              { id: "4", name: "Post-event Feedback", purpose: "Feedback", category: "Conference", fieldCount: 6, description: "NPS + rating + open text" },
              { id: "5", name: "School Event Parent Consent", purpose: "Registration", category: "School", fieldCount: 10, description: "Student + parent details + consent" },
            ]}
            footer="Distinct from Communication Templates (WhatsApp / SMS / Email)."
          />
        );
      case "master-lists":
        return (
          <MiniCrudPage
            title="Master Lists"
            description="Big option sets that dropdown fields can source from."
            icon={ListChecks}
            storageKey="em_master_lists"
            createLabel="Add list"
            fields={[
              { key: "name", label: "List name", required: true },
              { key: "itemCount", label: "Number of items", type: "number" },
              { key: "hierarchical", label: "Hierarchical?", type: "select", options: ["no", "yes"] },
              { key: "description", label: "Description", type: "textarea" },
            ]}
            columns={[
              { key: "name", label: "List" },
              { key: "itemCount", label: "Items" },
              { key: "hierarchical", label: "Hierarchical" },
            ]}
            seed={[
              { id: "1", name: "Indian Colleges", itemCount: 12000, hierarchical: "no", description: "Recognized Indian college list" },
              { id: "2", name: "Countries", itemCount: 195, hierarchical: "no", description: "ISO country list" },
              { id: "3", name: "Indian States", itemCount: 36, hierarchical: "yes", description: "States and Union Territories" },
              { id: "4", name: "Product Categories", itemCount: 84, hierarchical: "yes", description: "Product / service taxonomy" },
              { id: "5", name: "Industries", itemCount: 22, hierarchical: "no", description: "Industry classification" },
            ]}
          />
        );
      case "venues":
        return (
          <MiniCrudPage
            title="Venues"
            description="Reusable physical spaces — hotels, convention centers, campuses, stadiums."
            icon={Building2}
            storageKey="em_venues"
            createLabel="Add venue"
            fields={[
              { key: "name", label: "Venue name", required: true },
              { key: "type", label: "Type", type: "select", options: ["Hotel", "Convention Center", "Campus", "Stadium", "Office", "Outdoor", "Virtual"] },
              { key: "city", label: "City" },
              { key: "capacity", label: "Total capacity", type: "number" },
              { key: "address", label: "Address", type: "textarea" },
              { key: "amenities", label: "Amenities (comma-separated)", placeholder: "AV, WiFi, Parking, Catering" },
            ]}
            columns={[
              { key: "name", label: "Venue" },
              { key: "type", label: "Type" },
              { key: "city", label: "City" },
              { key: "capacity", label: "Capacity" },
              { key: "amenities", label: "Amenities" },
            ]}
            seed={[
              { id: "1", name: "Grand Hyatt Gurugram", type: "Hotel", city: "Gurugram", capacity: 800, address: "MG Road, Gurugram", amenities: "AV, WiFi, Parking, Catering, Valet" },
              { id: "2", name: "India Habitat Centre", type: "Convention Center", city: "New Delhi", capacity: 1200, address: "Lodhi Road, New Delhi", amenities: "AV, Multiple halls, Catering" },
              { id: "3", name: "IISc Auditorium", type: "Campus", city: "Bengaluru", capacity: 500, address: "IISc Campus, Bengaluru", amenities: "AV, Live streaming, Recording" },
              { id: "4", name: "The Leela Palace", type: "Hotel", city: "Mumbai", capacity: 600, address: "Andheri East, Mumbai", amenities: "AV, WiFi, Valet, Catering" },
              { id: "5", name: "JLN Stadium", type: "Stadium", city: "New Delhi", capacity: 60000, address: "Lodhi Road", amenities: "Multi-gate, Parking, Emergency medical" },
            ]}
          />
        );
      case "seating-maps":
        return (
          <MiniCrudPage
            title="Seating Maps"
            description="Reusable seat layouts — theatre, classroom, round tables, U-shape, boardroom."
            icon={Map}
            storageKey="em_seating_maps"
            createLabel="Add layout"
            fields={[
              { key: "name", label: "Layout name", required: true },
              { key: "type", label: "Style", type: "select", options: ["Theatre", "Classroom", "Round Tables", "U-shape", "Boardroom", "Cabaret", "Standing", "Custom"] },
              { key: "totalSeats", label: "Total seats", type: "number" },
              { key: "rows", label: "Rows", type: "number" },
              { key: "sections", label: "Sections", placeholder: "VIP, Premium, General" },
              { key: "venue", label: "Attached to venue" },
            ]}
            columns={[
              { key: "name", label: "Layout" },
              { key: "type", label: "Style" },
              { key: "totalSeats", label: "Seats" },
              { key: "sections", label: "Sections" },
              { key: "venue", label: "Venue" },
            ]}
            seed={[
              { id: "1", name: "Grand Ballroom theatre", type: "Theatre", totalSeats: 500, rows: 20, sections: "VIP, Premium, General", venue: "Grand Hyatt Gurugram" },
              { id: "2", name: "Workshop room 3x3", type: "Round Tables", totalSeats: 60, rows: 6, sections: "General", venue: "IISc Auditorium" },
              { id: "3", name: "Board room 20 seats", type: "Boardroom", totalSeats: 20, rows: 1, sections: "General", venue: "The Leela Palace" },
              { id: "4", name: "Auditorium 1200", type: "Theatre", totalSeats: 1200, rows: 40, sections: "Balcony, Stalls, VIP", venue: "India Habitat Centre" },
            ]}
          />
        );
      case "certificate-templates":
        return (
          <MiniCrudPage
            title="Certificate Templates"
            description="Certificate designs — Participation, Speaker, Volunteer, Achievement, Workshop."
            icon={Award}
            storageKey="em_certificate_templates"
            createLabel="Add design"
            fields={[
              { key: "name", label: "Design name", required: true },
              { key: "kind", label: "Kind", type: "select", options: ["Participation", "Speaker", "Volunteer", "Achievement", "Workshop", "Winner", "Merit"] },
              { key: "size", label: "Paper", type: "select", options: ["A4 Landscape", "A4 Portrait", "Letter Landscape"] },
              { key: "eligibility", label: "Eligibility rule", placeholder: "attendance >= 75%" },
              { key: "color", label: "Accent", type: "color" },
            ]}
            columns={[
              { key: "name", label: "Design", render: (r) => <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded" style={{ background: r.color }} />{r.name}</span> },
              { key: "kind", label: "Kind" },
              { key: "size", label: "Paper" },
              { key: "eligibility", label: "Eligibility" },
            ]}
            seed={[
              { id: "1", name: "Standard participation", kind: "Participation", size: "A4 Landscape", eligibility: "attendance >= 75%", color: "#2249b7" },
              { id: "2", name: "Speaker certificate", kind: "Speaker", size: "A4 Landscape", eligibility: "session_delivered", color: "#8b5cf6" },
              { id: "3", name: "Volunteer appreciation", kind: "Volunteer", size: "A4 Portrait", eligibility: "volunteer_type", color: "#059669" },
              { id: "4", name: "Winner — Top 3", kind: "Winner", size: "A4 Landscape", eligibility: "rank <= 3", color: "#eab308" },
              { id: "5", name: "Workshop completion", kind: "Workshop", size: "A4 Portrait", eligibility: "sessions_attended == total", color: "#0891b2" },
            ]}
          />
        );
      case "page-templates":
        return (
          <MiniCrudPage
            title="Landing Page Templates"
            description="Pre-built website blueprints per event type."
            icon={Grid3x3}
            storageKey="em_page_templates"
            createLabel="Add template"
            fields={[
              { key: "name", label: "Template name", required: true },
              { key: "category", label: "Event type", type: "select", options: ["Conference", "Workshop", "Sports", "Cultural", "School", "Webinar", "Exhibition", "VIP"] },
              { key: "sections", label: "Number of sections", type: "number" },
              { key: "description", label: "Description", type: "textarea" },
            ]}
            columns={[
              { key: "name", label: "Template" },
              { key: "category", label: "For" },
              { key: "sections", label: "Sections" },
            ]}
            seed={[
              { id: "1", name: "Tech Conference Hero", category: "Conference", sections: 12, description: "Hero + Countdown + Speakers + Agenda + Sponsors + Tickets" },
              { id: "2", name: "Webinar Landing", category: "Webinar", sections: 6, description: "Hero + About + Speaker + Registration" },
              { id: "3", name: "Sports Registration", category: "Sports", sections: 8, description: "Hero + Categories + Registration + FAQ + Gallery" },
              { id: "4", name: "Workshop Enrollment", category: "Workshop", sections: 7, description: "Hero + About + Curriculum + Trainer + Registration" },
              { id: "5", name: "Cultural Festival", category: "Cultural", sections: 10, description: "Hero + Program + Artists + Gallery + Tickets" },
            ]}
          />
        );
      case "pass-templates":
        return (
          <MiniCrudPage
            title="Pass Templates"
            description="Reusable badge and pass designs — General, VIP, Speaker, Staff, Exhibitor, Visitor, Student."
            icon={Grid3x3}
            storageKey="em_pass_templates"
            createLabel="Add design"
            fields={[
              { key: "name", label: "Design name", required: true },
              { key: "kind", label: "Kind", type: "select", options: ["General", "VIP", "Speaker", "Volunteer", "Staff", "Exhibitor", "Student", "Visitor"] },
              { key: "size", label: "Size", type: "select", options: ["Badge 4×3", "A6", "CR80", "A5", "Custom"] },
              { key: "sides", label: "Sides", type: "select", options: ["Front only", "Front + Back"] },
              { key: "color", label: "Accent color", type: "color" },
            ]}
            columns={[
              { key: "name", label: "Design", render: (r) => <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded" style={{ background: r.color }} />{r.name}</span> },
              { key: "kind", label: "Kind" },
              { key: "size", label: "Size" },
              { key: "sides", label: "Sides" },
            ]}
            seed={[
              { id: "1", name: "General attendee badge", kind: "General", size: "Badge 4×3", sides: "Front + Back", color: "#2249b7" },
              { id: "2", name: "VIP pass — gold ribbon", kind: "VIP", size: "A6", sides: "Front + Back", color: "#eab308" },
              { id: "3", name: "Speaker badge", kind: "Speaker", size: "Badge 4×3", sides: "Front + Back", color: "#8b5cf6" },
              { id: "4", name: "Volunteer pass", kind: "Volunteer", size: "Badge 4×3", sides: "Front only", color: "#059669" },
              { id: "5", name: "Exhibitor booth pass", kind: "Exhibitor", size: "A6", sides: "Front + Back", color: "#dc2626" },
              { id: "6", name: "Student pass", kind: "Student", size: "Badge 4×3", sides: "Front only", color: "#f59e0b" },
            ]}
            footer="Passes are what participants show at the gate. Distinct from Certificate Templates (earned after)."
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
          <MiniCrudPage
            title="Message Delivery"
            description="Default provider per channel + fallback order + quiet hours + daily caps."
            icon={BellRing}
            storageKey="em_message_delivery"
            createLabel="Add rule"
            fields={[
              { key: "channel", label: "Channel", type: "select", options: ["WhatsApp", "Email", "SMS", "Push"] },
              { key: "defaultProvider", label: "Default provider", placeholder: "e.g. Meta Cloud API" },
              { key: "fallback", label: "Fallback order (comma-separated)", placeholder: "WhatsApp,SMS,Email" },
              { key: "quietHours", label: "Quiet hours", placeholder: "22:00–07:00 recipient TZ" },
              { key: "dailyCap", label: "Daily cap", type: "number" },
              { key: "tracking", label: "Tracking", type: "select", options: ["open + click", "open only", "off"] },
            ]}
            columns={[
              { key: "channel", label: "Channel" },
              { key: "defaultProvider", label: "Default" },
              { key: "fallback", label: "Fallback" },
              { key: "quietHours", label: "Quiet hours" },
              { key: "dailyCap", label: "Cap" },
              { key: "tracking", label: "Tracking" },
            ]}
            seed={[
              { id: "1", channel: "WhatsApp", defaultProvider: "Meta Cloud API", fallback: "WhatsApp,SMS", quietHours: "22:00–07:00", dailyCap: 10000, tracking: "open + click" },
              { id: "2", channel: "Email", defaultProvider: "SendGrid", fallback: "SendGrid,SMTP", quietHours: "None", dailyCap: 50000, tracking: "open + click" },
              { id: "3", channel: "SMS", defaultProvider: "MSG91", fallback: "MSG91,Twilio", quietHours: "22:00–07:00", dailyCap: 5000, tracking: "off" },
              { id: "4", channel: "Push", defaultProvider: "Web Push (VAPID)", fallback: "Push,In-app", quietHours: "22:00–07:00", dailyCap: 100000, tracking: "off" },
            ]}
          />
        );
      case "staff-notifications":
        return (
          <MiniCrudPage
            title="Staff Notification Matrix"
            description="Who on your team gets notified about which system events."
            icon={BellRing}
            storageKey="em_staff_notifications"
            createLabel="Add rule"
            fields={[
              { key: "event", label: "System event", type: "select", options: ["New registration", "Payment failed", "Approval needed", "Device offline", "Plan limit reached", "Refund requested", "New feedback", "Certificate issued"] },
              { key: "role", label: "Notify role", type: "select", options: ["Administrator", "Event Manager", "Registration Manager", "Finance", "Support", "Marketing"] },
              { key: "channels", label: "Channels (comma-separated)", placeholder: "in-app,email,whatsapp" },
              { key: "escalate", label: "Escalate after (min)", type: "number" },
              { key: "active", label: "Active", type: "select", options: ["yes", "no"] },
            ]}
            columns={[
              { key: "event", label: "Event" },
              { key: "role", label: "Notify" },
              { key: "channels", label: "Channels" },
              { key: "escalate", label: "Escalate" },
              { key: "active", label: "Active" },
            ]}
            seed={[
              { id: "1", event: "New registration", role: "Event Manager", channels: "in-app,email", escalate: 0, active: "yes" },
              { id: "2", event: "Payment failed", role: "Finance", channels: "in-app,email,whatsapp", escalate: 15, active: "yes" },
              { id: "3", event: "Approval needed", role: "Event Manager", channels: "in-app,email", escalate: 60, active: "yes" },
              { id: "4", event: "Plan limit reached", role: "Administrator", channels: "in-app,email", escalate: 0, active: "yes" },
              { id: "5", event: "Refund requested", role: "Finance", channels: "in-app,email", escalate: 30, active: "yes" },
            ]}
          />
        );
      case "integrations-api-keys":
        return (
          <MiniCrudPage
            title="API Access & Keys"
            description="Bearer-token API keys for third-party integrations."
            icon={Key}
            storageKey="em_api_keys"
            createLabel="Generate key"
            fields={[
              { key: "name", label: "Key name", required: true, placeholder: "Our CRM sync" },
              { key: "scope", label: "Scope", type: "select", options: ["read-only", "read + write", "read + write + admin"] },
              { key: "expiresOn", label: "Expires on", placeholder: "YYYY-MM-DD or never" },
              { key: "ipAllowList", label: "IP allow-list", placeholder: "comma-separated or blank" },
              { key: "active", label: "Active", type: "select", options: ["yes", "no"] },
            ]}
            columns={[
              { key: "name", label: "Key name" },
              { key: "scope", label: "Scope" },
              { key: "expiresOn", label: "Expires" },
              { key: "ipAllowList", label: "IP allow-list" },
              { key: "active", label: "Active" },
            ]}
            seed={[
              { id: "1", name: "CRM sync (production)", scope: "read + write", expiresOn: "2027-03-15", ipAllowList: "203.0.113.45", active: "yes" },
              { id: "2", name: "Analytics pipeline", scope: "read-only", expiresOn: "never", ipAllowList: "", active: "yes" },
              { id: "3", name: "Zapier integration", scope: "read + write", expiresOn: "never", ipAllowList: "", active: "yes" },
            ]}
            footer="Secrets are shown once at creation. Distinct from internal user tokens."
          />
        );
      case "integrations-push":
        return (
          <MiniCrudPage
            title="Push Notification Providers"
            description="Web Push (VAPID) and FCM for mobile app."
            icon={BellRing}
            storageKey="em_push_providers"
            createLabel="Add provider"
            fields={[
              { key: "provider", label: "Provider", type: "select", options: ["Web Push (VAPID)", "FCM (Android/iOS)", "APNs (iOS)"] },
              { key: "name", label: "Display name", required: true },
              { key: "environment", label: "Environment", type: "select", options: ["test", "live"] },
              { key: "active", label: "Active", type: "select", options: ["yes", "no"] },
            ]}
            columns={[
              { key: "provider", label: "Provider" },
              { key: "name", label: "Name" },
              { key: "environment", label: "Env" },
              { key: "active", label: "Active" },
            ]}
            seed={[
              { id: "1", provider: "Web Push (VAPID)", name: "Browser push (production)", environment: "live", active: "yes" },
              { id: "2", provider: "FCM (Android/iOS)", name: "Mobile app push", environment: "live", active: "no" },
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
            className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors"
            style={{ textDecoration: "none" }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to dashboard
          </Link>
          <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight">Configuration</h1>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Manage your workspace preferences, templates, and third-party integrations.
          </p>
        </div>
      </div>

      {/* 2-Column Setup Layout: Left Submenu Sidebar (PERSISTENT) + Right Active Submodule Component */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
        {/* Left Submenu Navigation */}
        <nav aria-label="Configuration sections" className="space-y-3 sticky top-[70px] self-start">
          {CONFIGURATION_CATEGORIES.map((cat) => {
            const isOpen = openCategoryId === cat.id;
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
                  onClick={() => setOpenCategoryId(isOpen ? null : cat.id)}
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
