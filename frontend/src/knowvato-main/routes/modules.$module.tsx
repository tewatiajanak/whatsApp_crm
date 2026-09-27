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
} from "lucide-react";
import { useBookmarks } from "@/lib/bookmarks";

// Import Full-Fledged Module Pages
import WebsiteBuilderPage from "../pages/WebsiteBuilderPage";
import UserManagementPage from "../pages/UserManagementPage";
import CommunicationPage from "../pages/CommunicationPage";
import FrontOfficePage from "../pages/FrontOfficePage";
import ReportsPage from "../pages/ReportsPage";
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
    color: "#6366f1",
    items: [
      { slug: "organization-details", label: "Organization Details" },
    ],
  },
  {
    id: "templates",
    title: "Communication Templates",
    icon: MessageSquare,
    color: "#059669",
    items: [
      { slug: "templates-whatsapp", label: "WhatsApp Template" },
      { slug: "templates-sms", label: "SMS Template" },
      { slug: "templates-email", label: "Email Template" },
    ],
  },
  {
    id: "integrations",
    title: "Integrations",
    icon: Puzzle,
    color: "#2563eb",
    items: [
      { slug: "integrations-ai", label: "AI Integration" },
      { slug: "integrations-whatsapp", label: "WhatsApp Integration" },
      { slug: "integrations-email", label: "Email Integration" },
      { slug: "integrations-sms", label: "SMS Integration" },
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
  if (activeModule === "users") return <UserManagementPage />;
  if (activeModule === "communication") return <CommunicationPage />;
  if (activeModule === "front-office") return <FrontOfficePage />;
  if (activeModule === "reports") return <ReportsPage />;

  // Configuration / Templates / Integrations PERSISTENT 2-Column Shell
  const activeSlug = activeModule === "settings" ? "configuration" : activeModule;

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    general: true,
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
      case "templates-whatsapp":
        return <TemplatesWhatsapp />;
      case "templates-email":
        return <TemplatesEmail />;
      case "templates-sms":
        return <TemplatesSms />;
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
      <div className="flex items-center justify-between gap-4 pb-2 border-b">
        <div>
          <Link
            to="/"
            className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1 text-decoration-none"
          >
            <ArrowLeft className="h-3 w-3" /> Back to dashboard
          </Link>
          <h1 className="text-xl font-semibold tracking-tight mt-0.5">Configuration</h1>
        </div>
      </div>

      {/* 2-Column Setup Layout: Left Submenu Sidebar (PERSISTENT) + Right Active Submodule Component */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
        {/* Left Submenu Navigation */}
        <div className="space-y-2 sticky top-[70px] align-self-start">
          {CONFIGURATION_CATEGORIES.map((cat) => (
            <div key={cat.id} className="rounded-xl border bg-card overflow-hidden shadow-2xs">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 p-2.5 bg-muted/20 border-b text-left text-xs font-semibold text-foreground cursor-pointer"
                onClick={() =>
                  setOpenCategories((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <cat.icon className="h-4 w-4 shrink-0" style={{ color: cat.color }} />
                  <span className="truncate">{cat.title}</span>
                </div>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${
                    openCategories[cat.id] ? "" : "-rotate-90"
                  }`}
                />
              </button>

              {openCategories[cat.id] && (
                <div className="p-1 space-y-0.5">
                  {cat.items.map((item) => {
                    const isSelected = activeSlug === item.slug;
                    return (
                      <button
                        key={item.slug}
                        type="button"
                        onClick={() => handleSelectSlug(item.slug)}
                        className={`w-full text-left px-2.5 py-2 rounded-md text-xs font-medium transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                            : "text-muted-foreground hover:bg-slate-200/80 hover:text-foreground"
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                        {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right Panel: Active Submodule Component */}
        <div className="min-w-0 rounded-xl border bg-card shadow-2xs overflow-hidden">
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
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
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
    let currentW = data.logoWidth;
    let currentH = data.logoHeight;
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
                  <span style="font-size: 13px; font-weight: 700; color: #1e3c72; background: #f0f4ff; padding: 4px 12px; border-radius: 6px;" id="radius-display">0px</span>
                </div>
                <input type="range" id="logo-radius-slider" value="0" min="0" max="50" step="2" style="width: 100%; height: 6px; border-radius: 5px; background: #e5e7eb; outline: none; -webkit-appearance: none; appearance: none; cursor: pointer;">
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
                  <span style="font-size: 13px; font-weight: 700; color: #1e3c72; background: #f0f4ff; padding: 4px 12px; border-radius: 6px;" id="fontsize-display">24px</span>
                </div>
                <input type="range" id="name-fontsize-slider" value="24" min="16" max="36" step="2" style="width: 100%; height: 6px; border-radius: 5px; background: #e5e7eb; outline: none; -webkit-appearance: none; appearance: none; cursor: pointer;">
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

  useEffect(() => {
    if (data.loginImages.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % data.loginImages.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [data.loginImages.length]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
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
    if (currentImageIndex >= data.loginImages.length - 1) {
      setCurrentImageIndex(0);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB

    if (file.size > MAX_VIDEO_SIZE) {
      showNotification(`Video file is too large. Maximum file size is 200MB. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`, "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setData((prev) => ({
        ...prev,
        loginVideo: event.target?.result as string
      }));
      setShowVideo(true);
    };
    reader.onerror = () => {
      showNotification("Failed to load video. Please ensure it's a valid video file.", "error");
    };
    reader.readAsDataURL(file);
  };

  const removeVideo = () => {
    setData((prev) => ({
      ...prev,
      loginVideo: null
    }));
    setShowVideo(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MIN_LOGO_SIZE = 10 * 1024; // 10KB
    const MAX_LOGO_SIZE = 500 * 1024; // 500KB
    const MIN_WIDTH = 200;
    const MAX_WIDTH = 500;
    const MIN_HEIGHT = 100;
    const MAX_HEIGHT = 500;

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
        // Set default dimensions based on actual image or use suggested values
        const suggestedWidth = Math.min(Math.max(img.width, MIN_WIDTH), MAX_WIDTH);
        const suggestedHeight = Math.min(Math.max(img.height, MIN_HEIGHT), MAX_HEIGHT);

        setData((prev) => ({
          ...prev,
          logo: event.target?.result as string,
          logoWidth: suggestedWidth,
          logoHeight: suggestedHeight
        }));
        showNotification("Logo uploaded successfully! ✨ Click 'Adjust Size' to customize dimensions.", "success");
        setTimeout(() => showLogoAdjustModal(), 500);
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
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Organization Details</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure your organization information and login page branding</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-8">
        {/* Left Side - Form */}
        <div className="space-y-4">
          {/* Organization Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Organization Name *</label>
            <input
              data-field="name"
              type="text"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              placeholder="Enter organization name"
              className="w-full px-3 py-2 border rounded-md text-sm border-input bg-background transition-all"
            />
          </div>

          {/* Tag Line */}
          <div>
            <label className="block text-sm font-medium mb-2">Tag Line / Motto *</label>
            <input
              data-field="tagline"
              type="text"
              value={data.tagline}
              onChange={(e) => setData({ ...data, tagline: e.target.value })}
              placeholder="Enter your organization's tag line"
              className="w-full px-3 py-2 border rounded-md text-sm border-input bg-background transition-all"
            />
          </div>

          {/* Nature of Business */}
          <div>
            <label className="block text-sm font-medium mb-2">Nature of Business *</label>
            <select
              data-field="natureOfBusiness"
              value={data.natureOfBusiness}
              onChange={(e) => setData({ ...data, natureOfBusiness: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm border-input bg-background transition-all"
            >
              <option value="">Select nature of business</option>
              {NATURE_OF_BUSINESS.map((nature) => (
                <option key={nature} value={nature}>
                  {nature}
                </option>
              ))}
            </select>
          </div>

          {/* Address Fields */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold mb-3">Address Details</h3>

            <div className="mb-3">
              <label className="block text-sm font-medium mb-2">Street Address *</label>
              <input
                data-field="street"
                type="text"
                value={data.address.street}
                onChange={(e) => setData({ ...data, address: { ...data.address, street: e.target.value } })}
                placeholder="Enter street address"
                className="w-full px-3 py-2 border rounded-md text-sm border-input bg-background transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium mb-2">City *</label>
                <input
                  data-field="city"
                  type="text"
                  value={data.address.city}
                  onChange={(e) => setData({ ...data, address: { ...data.address, city: e.target.value } })}
                  placeholder="City"
                  className="w-full px-3 py-2 border rounded-md text-sm border-input bg-background transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">State *</label>
                <input
                  data-field="state"
                  type="text"
                  value={data.address.state}
                  onChange={(e) => setData({ ...data, address: { ...data.address, state: e.target.value } })}
                  placeholder="State"
                  className="w-full px-3 py-2 border rounded-md text-sm border-input bg-background transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium mb-2">Country *</label>
                <input
                  data-field="country"
                  type="text"
                  value={data.address.country}
                  onChange={(e) => setData({ ...data, address: { ...data.address, country: e.target.value } })}
                  placeholder="Country"
                  className="w-full px-3 py-2 border rounded-md text-sm border-input bg-background transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Postal Code</label>
                <input
                  type="text"
                  value={data.address.postalCode}
                  onChange={(e) => setData({ ...data, address: { ...data.address, postalCode: e.target.value } })}
                  placeholder="Postal code"
                  className="w-full px-3 py-2 border rounded-md text-sm border-input bg-background"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold mb-3">Contact Information</h3>

            <div className="mb-3">
              <label className="block text-sm font-medium mb-2">Mobile Number *</label>
              <input
                data-field="mobile"
                type="tel"
                value={data.contactInfo.mobile}
                onChange={(e) => setData({ ...data, contactInfo: { ...data.contactInfo, mobile: e.target.value } })}
                placeholder="Enter mobile number"
                className="w-full px-3 py-2 border rounded-md text-sm border-input bg-background transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Email Address *</label>
              <input
                data-field="email"
                type="email"
                value={data.contactInfo.email}
                onChange={(e) => setData({ ...data, contactInfo: { ...data.contactInfo, email: e.target.value } })}
                placeholder="Enter email address"
                className="w-full px-3 py-2 border rounded-md text-sm border-input bg-background transition-all"
              />
            </div>
          </div>

          {/* Social Media Links */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold mb-3">Social Media Links</h3>
            <div className="space-y-3">
              {SOCIAL_MEDIA_PLATFORMS.map((platform) => (
                <div key={platform.id}>
                  <label className="block text-sm font-medium mb-2">
                    <i className={`bi ${platform.icon} mr-2`}></i>
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
                    className="w-full px-3 py-2 border rounded-md text-sm border-input bg-background"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Text Colors */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold mb-3">🎨 Text Colors</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">Organization Name Color</label>
                <input
                  type="color"
                  value={data.nameColor || "#222"}
                  onChange={(e) => setData({ ...data, nameColor: e.target.value })}
                  className="w-16 h-10 border rounded-md border-input cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Tagline Color</label>
                <input
                  type="color"
                  value={data.taglineColor || "#666"}
                  onChange={(e) => setData({ ...data, taglineColor: e.target.value })}
                  className="w-16 h-10 border rounded-md border-input cursor-pointer"
                />
              </div>
            </div>
          </div>

          <Button onClick={save} disabled={loading} className="w-full mt-6">
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {/* Right Side - Logo, Image Upload & Preview */}
        <div className="space-y-4">
          {/* Logo Upload Section */}
          <div>
            <label className="block text-sm font-medium mb-2">Organization Logo</label>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
              <div className="text-xs text-amber-900">
                <div className="font-semibold mb-2">📋 Logo Specifications:</div>
                <ul className="space-y-1 ml-2">
                  <li>• <strong>Dimensions:</strong> 200px × 100px (min) to 500px × 500px (max)</li>
                  <li>• <strong>File Size:</strong> 10KB (min) to 500KB (max)</li>
                  <li>• <strong>Format:</strong> JPG, PNG</li>
                  <li>• <strong>Location:</strong> Displays above login form</li>
                </ul>
              </div>
            </div>

            {/* Logo Preview */}
            {data.logo && (
              <div className="mb-4 flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                <img src={data.logo} alt="Organization Logo" className="h-16 max-w-xs object-contain" />
                <div className="flex gap-2">
                  <button
                    onClick={showLogoAdjustModal}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Adjust Size
                  </button>
                  <button
                    onClick={removeLogo}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            {/* Logo Upload Button */}
            <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-amber-50 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                style={{ display: "none" }}
                id="logo-upload"
              />
              <label htmlFor="logo-upload" className="cursor-pointer">
                <div className="text-xl mb-2">🏢</div>
                <div className="font-medium text-sm">Upload Logo</div>
                <div className="text-xs text-gray-500 mt-1">JPG, PNG (Max 500KB)</div>
              </label>
            </div>
          </div>

          {/* Layout & Styling Section */}
          {data.logo && data.name && (
            <div className="border-t pt-4">
              <label className="block text-sm font-medium mb-3">Login Header Layout</label>

              {/* Layout Options */}
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs font-medium block mb-2">Display Style</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setData({ ...data, loginLayout: "center-stack" })}
                      className={`flex-1 px-3 py-2 rounded text-xs font-medium transition ${
                        data.loginLayout === "center-stack"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      Logo Top
                    </button>
                    <button
                      onClick={() => setData({ ...data, loginLayout: "side-by-side" })}
                      className={`flex-1 px-3 py-2 rounded text-xs font-medium transition ${
                        data.loginLayout === "side-by-side"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      Logo Left
                    </button>
                  </div>
                </div>

                {/* Logo Size Slider */}
                <div>
                  <label className="text-xs font-medium block mb-2">Logo Size: {data.logoSize}px</label>
                  <input
                    type="range"
                    min="40"
                    max="100"
                    value={data.logoSize}
                    onChange={(e) => setData({ ...data, logoSize: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>

                {/* Name Font Size */}
                <div>
                  <label className="text-xs font-medium block mb-2">Name Font Size: {data.nameFontSize}px</label>
                  <input
                    type="range"
                    min="16"
                    max="40"
                    value={data.nameFontSize}
                    onChange={(e) => setData({ ...data, nameFontSize: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>

                {/* Tagline Font Size */}
                <div>
                  <label className="text-xs font-medium block mb-2">Tagline Font Size: {data.taglineFontSize}px</label>
                  <input
                    type="range"
                    min="10"
                    max="24"
                    value={data.taglineFontSize}
                    onChange={(e) => setData({ ...data, taglineFontSize: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="bg-gradient-to-b from-blue-100 to-blue-50 border border-blue-300 rounded-lg p-4 mb-2">
                <div style={{
                  textAlign: data.loginLayout === "center-stack" ? "center" : "left",
                  display: data.loginLayout === "side-by-side" ? "flex" : "block",
                  gap: data.loginLayout === "side-by-side" ? "12px" : "0",
                  alignItems: data.loginLayout === "side-by-side" ? "center" : "normal",
                }}>
                  {data.logo && (
                    <img
                      src={data.logo}
                      alt="Logo Preview"
                      style={{
                        maxHeight: `${data.logoSize}px`,
                        maxWidth: data.loginLayout === "side-by-side" ? "80px" : "100%",
                        objectFit: "contain",
                        marginBottom: data.loginLayout === "center-stack" ? "8px" : "0",
                      }}
                    />
                  )}
                  <div>
                    {data.name && (
                      <h1 style={{
                        fontSize: `${data.nameFontSize}px`,
                        fontWeight: 700,
                        color: "#222",
                        margin: "0 0 4px 0",
                      }}>
                        {data.name}
                      </h1>
                    )}
                    {data.tagline && (
                      <p style={{
                        fontSize: `${data.taglineFontSize}px`,
                        color: "#666",
                        margin: "0",
                      }}>
                        {data.tagline}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-500 text-center">Preview</div>
            </div>
          )}

          <div className="border-t pt-4">
            <label className="block text-sm font-medium mb-2">Login Page Images & Video (Max 5)</label>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
              <div className="text-xs text-blue-900 space-y-3">
                <div>
                  <div className="font-semibold mb-2">🖼️ Image Specifications:</div>
                  <ul className="space-y-1 ml-2">
                    <li>• <strong>Dimensions:</strong> 800px × 400px (min) to 2000px × 1500px (max)</li>
                    <li>• <strong>File Size:</strong> Maximum 1MB per image</li>
                    <li>• <strong>Format:</strong> JPG, PNG</li>
                    <li>• <strong>Total Images:</strong> Up to 5 images allowed</li>
                  </ul>
                </div>
                <div className="border-t pt-3">
                  <div className="font-semibold mb-2">🎬 Video Specifications:</div>
                  <ul className="space-y-1 ml-2">
                    <li>• <strong>File Size:</strong> Maximum 200MB</li>
                    <li>• <strong>Format:</strong> MP4, WebM, MOV</li>
                    <li>• <strong>Total Videos:</strong> Only 1 video allowed</li>
                    <li>• <strong>Note:</strong> Video will replace images in preview</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Preview Tabs */}
          {(data.loginImages.length > 0 || data.loginVideo) && (
            <div className="flex gap-2 mb-3">
              {data.loginImages.length > 0 && (
                <button
                  onClick={() => setShowVideo(false)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    !showVideo
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Images ({data.loginImages.length})
                </button>
              )}
              {data.loginVideo && (
                <button
                  onClick={() => setShowVideo(true)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    showVideo
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Video
                </button>
              )}
            </div>
          )}

          {/* Image Preview */}
          {!showVideo && data.loginImages.length > 0 && (
            <div className="rounded-lg overflow-hidden bg-muted h-[300px] flex items-center justify-center relative">
              <img
                src={data.loginImages[currentImageIndex]}
                alt={`Image ${currentImageIndex + 1}`}
                className="w-full h-full object-cover"
              />
              {data.loginImages.length > 1 && (
                <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-2">
                  {data.loginImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`h-2 w-2 rounded-full transition-colors cursor-pointer ${
                        idx === currentImageIndex ? "bg-white" : "bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Video Preview */}
          {showVideo && data.loginVideo && (
            <div className="rounded-lg overflow-hidden bg-muted h-[300px] flex items-center justify-center relative">
              <video
                src={data.loginVideo}
                controls
                className="w-full h-full object-cover"
              />
              <button
                onClick={removeVideo}
                className="absolute top-2 right-2 bg-red-600 text-white rounded text-sm px-3 py-1 hover:bg-red-700"
              >
                Remove Video
              </button>
            </div>
          )}

          {/* Upload Areas */}
          <div className="grid grid-cols-2 gap-3">
            {/* Image Upload */}
            <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: "none" }}
                id="image-upload"
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                <div className="text-xl mb-2">🖼️</div>
                <div className="font-medium text-xs">Upload Images</div>
                <div className="text-[11px] text-muted-foreground mt-1">JPG, PNG</div>
              </label>
            </div>

            {/* Video Upload */}
            <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleVideoUpload}
                style={{ display: "none" }}
                id="video-upload"
              />
              <label htmlFor="video-upload" className="cursor-pointer">
                <div className="text-xl mb-2">🎬</div>
                <div className="font-medium text-xs">Upload Video</div>
                <div className="text-[11px] text-muted-foreground mt-1">MP4, WebM</div>
              </label>
            </div>
          </div>

          {/* Uploaded Images Grid */}
          {data.loginImages.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-3">
                Uploaded Images ({data.loginImages.length}/5)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {data.loginImages.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-md overflow-hidden border">
                    <img
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-80"
                      onClick={() => setCurrentImageIndex(idx)}
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded text-xs w-5 h-5 flex items-center justify-center hover:bg-black/80"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
