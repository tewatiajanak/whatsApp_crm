import React, { useState, useEffect } from "react";

// Renders dynamic miniature inputs matching the active form selection
const renderMiniFormFields = (formTypeId, primaryColor) => {
  const inputStyle = { height: "5px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "1.5px", marginBottom: "3.5px" };
  const labelStyle = { width: "35%", height: "2.5px", background: "#94a3b8", borderRadius: "1px", marginBottom: "2px" };
  
  switch (formTypeId) {
    case "registration":
      return (
        <div style={{ padding: "1px" }}>
          <div style={labelStyle}></div><div style={inputStyle}></div>
          <div style={labelStyle}></div><div style={inputStyle}></div>
          <div style={labelStyle}></div><div style={inputStyle}></div>
          <div style={{ ...labelStyle, width: "45%" }}></div>
          <div style={{ height: "6px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "1.5px", marginBottom: "4px" }}></div>
          <div style={{ height: "8px", background: primaryColor, borderRadius: "2px" }}></div>
        </div>
      );
    case "application":
      return (
        <div style={{ padding: "1px" }}>
          <div style={labelStyle}></div><div style={inputStyle}></div>
          <div style={labelStyle}></div><div style={inputStyle}></div>
          <div style={{ ...labelStyle, width: "40%" }}></div>
          <div style={{ height: "6px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "1.5px", marginBottom: "3px" }}></div>
          <div style={{ height: "7px", background: "#f8fafc", border: "1px dashed #94a3b8", borderRadius: "1.5px", marginBottom: "4.5px" }}></div>
          <div style={{ height: "8px", background: primaryColor, borderRadius: "2px" }}></div>
        </div>
      );
    case "payment":
      return (
        <div style={{ padding: "1px" }}>
          <div style={labelStyle}></div><div style={inputStyle}></div>
          {/* Miniature Range Slider */}
          <div style={{ ...labelStyle, width: "55%" }}></div>
          <div className="d-flex align-items-center gap-1 mb-2.5 mt-0.5">
            <div style={{ flexGrow: 1, height: "1.5px", background: "#cbd5e1" }}></div>
            <div style={{ width: "3.5px", height: "3.5px", borderRadius: "50%", background: primaryColor }}></div>
            <div style={{ flexGrow: 1, height: "1.5px", background: "#cbd5e1" }}></div>
          </div>
          <div style={labelStyle}></div>
          <div style={{ height: "6px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "1.5px", marginBottom: "4px" }}></div>
          <div style={{ height: "8px", background: primaryColor, borderRadius: "2px" }}></div>
        </div>
      );
    case "feedback":
      return (
        <div style={{ padding: "1px" }}>
          <div style={labelStyle}></div><div style={inputStyle}></div>
          {/* Star ratings */}
          <div className="d-flex gap-0.5 mb-1.5" style={{ color: "#fbbf24", fontSize: "4.5px", lineHeight: 1 }}>★★★★☆</div>
          <div style={labelStyle}></div>
          <div style={{ height: "9px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "1.5px", marginBottom: "4px" }}></div>
          <div style={{ height: "8px", background: primaryColor, borderRadius: "2px" }}></div>
        </div>
      );
    case "consent":
      return (
        <div style={{ padding: "1px" }}>
          <div style={labelStyle}></div><div style={inputStyle}></div>
          {/* Checkboxes */}
          <div className="d-flex align-items-center gap-1 mb-1 mt-1">
            <div style={{ width: "3.5px", height: "3.5px", border: "1px solid #cbd5e1", background: "#ffffff", flexShrink: 0 }}></div>
            <div style={{ width: "70%", height: "1.5px", background: "#cbd5e1" }}></div>
          </div>
          <div className="d-flex align-items-center gap-1 mb-1">
            <div style={{ width: "3.5px", height: "3.5px", border: "1px solid #cbd5e1", background: "#ffffff", flexShrink: 0 }}></div>
            <div style={{ width: "60%", height: "1.5px", background: "#cbd5e1" }}></div>
          </div>
          <div className="d-flex align-items-center gap-1 mb-2">
            <div style={{ width: "3.5px", height: "3.5px", border: "1px solid #cbd5e1", background: "#ffffff", flexShrink: 0 }}></div>
            <div style={{ width: "65%", height: "1.5px", background: "#cbd5e1" }}></div>
          </div>
          <div style={{ height: "8px", background: primaryColor, borderRadius: "2px" }}></div>
        </div>
      );
    case "enquiry":
    default:
      return (
        <div style={{ padding: "1px" }}>
          <div style={labelStyle}></div><div style={inputStyle}></div>
          <div style={labelStyle}></div><div style={inputStyle}></div>
          <div style={{ ...labelStyle, width: "30%" }}></div>
          <div style={{ height: "9px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "1.5px", marginBottom: "4px" }}></div>
          <div style={{ height: "8px", background: primaryColor, borderRadius: "2px" }}></div>
        </div>
      );
  }
};

// Visual mockups representing style formats 1 to 11
const renderMiniMockup = (formatId, primaryColor = "#2249b7", formTypeId = "enquiry") => {
  const borderCol = "#e2e8f0";
  const cardBg = "#ffffff";
  const textCol = "#64748b";

  switch (formatId) {
    case "type1": // Left Text + Right Form Solid Box
      return (
        <div className="w-100 rounded border p-2 bg-light d-flex flex-column gap-2" style={{ height: "135px", overflow: "hidden" }}>
          {/* Header mockup */}
          <div className="d-flex justify-content-between align-items-center bg-white border-bottom pb-1 px-1">
            <span style={{ fontSize: "6px", fontWeight: "bold" }}>Brand</span>
            <div className="d-flex gap-1" style={{ fontSize: "5px", color: textCol }}>
              <span>Home</span><span>About</span>
            </div>
          </div>
          {/* Split body mockup */}
          <div className="d-flex gap-2 align-items-center flex-grow-1 px-1">
            <div className="flex-grow-1 text-start">
              <div style={{ width: "80%", height: "8px", background: "#334155", borderRadius: "2px", marginBottom: "4px" }}></div>
              <div style={{ width: "60%", height: "5px", background: "#64748b", borderRadius: "2px" }}></div>
            </div>
            <div className="bg-white border rounded p-1 shadow-xs" style={{ width: "68px", flexShrink: 0 }}>
              {renderMiniFormFields(formTypeId, primaryColor)}
            </div>
          </div>
        </div>
      );
    case "type2": // Parallax photo background with Blur panel Form on right
      return (
        <div className="w-100 rounded border p-2 bg-dark text-white d-flex flex-column gap-2 position-relative" style={{ height: "135px", overflow: "hidden", background: `linear-gradient(rgba(15,23,42,0.8), rgba(15,23,42,0.8)), url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=150')`, backgroundSize: "cover" }}>
          {/* Header mockup */}
          <div className="d-flex justify-content-between align-items-center border-bottom border-secondary pb-1 px-1">
            <span style={{ fontSize: "6px", fontWeight: "bold" }}>Brand</span>
            <div className="d-flex gap-1" style={{ fontSize: "5px", opacity: 0.8 }}>
              <span>Home</span><span>About</span>
            </div>
          </div>
          {/* Split body mockup */}
          <div className="d-flex gap-2 align-items-center flex-grow-1 px-1">
            <div className="flex-grow-1 text-start">
              <div style={{ width: "80%", height: "8px", background: "#ffffff", borderRadius: "2px", marginBottom: "4px" }}></div>
              <div style={{ width: "50%", height: "5px", background: "#cbd5e1", borderRadius: "2px" }}></div>
            </div>
            <div className="rounded p-1" style={{ width: "68px", background: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.3)", flexShrink: 0 }}>
              {renderMiniFormFields(formTypeId, primaryColor)}
            </div>
          </div>
        </div>
      );
    case "type3": // Flipped Column Layout (Form on Left)
      return (
        <div className="w-100 rounded border p-2 bg-light d-flex flex-column gap-2" style={{ height: "135px", overflow: "hidden" }}>
          <div className="d-flex justify-content-between align-items-center bg-white border-bottom pb-1 px-1">
            <span style={{ fontSize: "6px", fontWeight: "bold" }}>Brand</span>
            <div className="d-flex gap-1" style={{ fontSize: "5px", color: textCol }}>
              <span>Home</span><span>About</span>
            </div>
          </div>
          <div className="d-flex gap-2 align-items-center flex-grow-1 px-1">
            <div className="bg-white border rounded p-1 shadow-xs" style={{ width: "68px", flexShrink: 0 }}>
              {renderMiniFormFields(formTypeId, primaryColor)}
            </div>
            <div className="flex-grow-1 text-start">
              <div style={{ width: "80%", height: "8px", background: "#334155", borderRadius: "2px", marginBottom: "4px" }}></div>
              <div style={{ width: "60%", height: "5px", background: "#64748b", borderRadius: "2px" }}></div>
            </div>
          </div>
        </div>
      );
    case "type4": // Left Text + Right Video Embed Split
      return (
        <div className="w-100 rounded border p-2 bg-white d-flex flex-column gap-2" style={{ height: "135px", overflow: "hidden" }}>
          <div className="d-flex justify-content-between align-items-center border-bottom pb-1 px-1">
            <span style={{ fontSize: "6px", fontWeight: "bold" }}>Brand</span>
            <div className="d-flex gap-1" style={{ fontSize: "5px", color: textCol }}>
              <span>Home</span><span>About</span>
            </div>
          </div>
          <div className="d-flex gap-2 align-items-center flex-grow-1 px-1">
            <div className="flex-grow-1 text-start">
              <div style={{ width: "80%", height: "8px", background: "#334155", borderRadius: "2px", marginBottom: "4px" }}></div>
              <div style={{ width: "50%", height: "5px", background: "#64748b", borderRadius: "2px" }}></div>
            </div>
            <div className="bg-light rounded border d-flex align-items-center justify-content-center" style={{ width: "55px", height: "38px", flexShrink: 0 }}>
              <span style={{ fontSize: "8px", color: "#ef4444" }}>▶</span>
            </div>
          </div>
        </div>
      );
    case "type5": // Full Width Centered Hero with Indigo/Purple Gradient
      return (
        <div className="w-100 rounded border p-2 text-white d-flex flex-column gap-2 justify-content-between text-center" style={{ height: "135px", overflow: "hidden", background: `linear-gradient(135deg, ${primaryColor} 0%, #1e1b4b 100%)` }}>
          <div className="d-flex justify-content-between align-items-center border-bottom border-secondary pb-1 px-1">
            <span style={{ fontSize: "6px", fontWeight: "bold" }}>Brand</span>
            <div className="text-white opacity-75" style={{ fontSize: "5.5px" }}>Menu</div>
          </div>
          <div className="bg-white border rounded p-1 shadow-xs mx-auto text-dark" style={{ width: "70px", flexShrink: 0 }}>
            {renderMiniFormFields(formTypeId, primaryColor)}
          </div>
        </div>
      );
    case "type6": // Glassmorphic Centered Overlay
      return (
        <div className="w-100 rounded border p-2 bg-light d-flex flex-column gap-2 justify-content-center text-center position-relative" style={{ height: "135px", overflow: "hidden", backgroundImage: "url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=150')", backgroundSize: "cover" }}>
          <div className="p-1 rounded shadow-sm mx-auto text-dark" style={{ width: "70px", background: "rgba(255, 255, 255, 0.8)", backdropFilter: "blur(4px)", border: "1px solid rgba(255, 255, 255, 0.3)", flexShrink: 0 }}>
            {renderMiniFormFields(formTypeId, primaryColor)}
          </div>
        </div>
      );
    case "type7": // Neumorphic Soft Bordered
      return (
        <div className="w-100 rounded border p-2 bg-light d-flex flex-column gap-2 justify-content-center text-center" style={{ height: "135px", overflow: "hidden" }}>
          <div className="p-1 rounded-3 mx-auto bg-light" style={{ width: "70px", boxShadow: "3px 3px 6px #cbd5e1, -3px -3px 6px #ffffff", flexShrink: 0 }}>
            {renderMiniFormFields(formTypeId, primaryColor)}
          </div>
        </div>
      );
    case "type8": // Left Border Heavy Sidebar Style
      return (
        <div className="w-100 rounded border p-2 bg-light d-flex flex-column gap-2 justify-content-between" style={{ height: "135px", overflow: "hidden", borderLeft: `5px solid ${primaryColor}` }}>
          <div className="d-flex justify-content-between align-items-center bg-white border-bottom pb-1 px-1">
            <span style={{ fontSize: "6px", fontWeight: "bold" }}>Brand</span>
            <span style={{ fontSize: "5px", color: textCol }}>Home</span>
          </div>
          <div className="d-flex gap-2 align-items-center flex-grow-1 px-1">
            <div className="flex-grow-1 text-start">
              <div style={{ width: "80%", height: "7px", background: "#1e293b", borderRadius: "2px", marginBottom: "3px" }}></div>
              <div style={{ width: "50%", height: "5px", background: "#64748b", borderRadius: "2px" }}></div>
            </div>
            <div className="bg-white border rounded p-1 shadow-xs text-dark" style={{ width: "68px", flexShrink: 0 }}>
              {renderMiniFormFields(formTypeId, primaryColor)}
            </div>
          </div>
        </div>
      );
    case "type9": // Cyan/Green Gradient Centered
      return (
        <div className="w-100 rounded border p-2 text-white d-flex flex-column gap-2 justify-content-center text-center" style={{ height: "135px", overflow: "hidden", background: `linear-gradient(135deg, ${primaryColor} 0%, #06b6d4 100%)` }}>
          <div className="bg-white border rounded p-1 shadow-xs text-dark mx-auto" style={{ width: "70px", flexShrink: 0 }}>
            {renderMiniFormFields(formTypeId, primaryColor)}
          </div>
        </div>
      );
    case "type10": // Clean Minimalist Grid
      return (
        <div className="w-100 rounded border p-2 bg-white d-flex flex-column gap-2 justify-content-between" style={{ height: "135px", overflow: "hidden" }}>
          <div className="d-flex justify-content-between align-items-center pb-1 border-bottom px-1">
            <span style={{ fontSize: "6px", fontWeight: "bold" }}>Brand</span>
            <span style={{ fontSize: "5px", color: textCol }}>Home</span>
          </div>
          <div className="d-flex gap-2 align-items-center flex-grow-1 px-1">
            <div className="flex-grow-1 text-start">
              <div style={{ width: "80%", height: "8px", background: "#1e293b", borderRadius: "2px", marginBottom: "3px" }}></div>
              <div style={{ width: "70%", height: "5px", background: "#64748b", borderRadius: "2px" }}></div>
            </div>
            <div className="bg-white border rounded p-1 shadow-xs text-dark" style={{ width: "68px", flexShrink: 0 }}>
              {renderMiniFormFields(formTypeId, primaryColor)}
            </div>
          </div>
        </div>
      );
    case "type11": // High-Contrast Slate Theme
      return (
        <div className="w-100 rounded border p-2 text-white d-flex flex-column gap-2 justify-content-between text-center" style={{ height: "135px", overflow: "hidden", backgroundColor: "#0f172a" }}>
          <div className="d-flex justify-content-between align-items-center border-bottom border-secondary pb-1 px-1">
            <span style={{ fontSize: "6px", fontWeight: "bold" }}>Brand</span>
            <span style={{ fontSize: "5px", color: "#e2e8f0" }}>Home</span>
          </div>
          <div className="bg-white border rounded p-1 shadow-xs text-dark mx-auto" style={{ width: "70px", flexShrink: 0 }}>
            {renderMiniFormFields(formTypeId, primaryColor)}
          </div>
        </div>
      );
    case "embed-admission":
      return (
        <div className="w-100 rounded border p-2 bg-white d-flex flex-column align-items-center justify-content-center text-center" style={{ height: "135px", overflow: "hidden" }}>
          <i className="bi bi-window fs-3 text-primary mb-1"></i>
          <span style={{ fontSize: "9px", fontWeight: "bold" }}>Simply Admission Embed</span>
          <span style={{ fontSize: "7.5px", color: textCol }}>Full-Screen Portal Iframe</span>
        </div>
      );
    case "blank":
    default:
      return (
        <div className="w-100 rounded border border-dashed d-flex flex-column align-items-center justify-content-center bg-light text-muted" style={{ height: "135px", overflow: "hidden" }}>
          <i className="bi bi-plus-circle fs-3 text-secondary mb-1"></i>
          <span style={{ fontSize: "9px", fontWeight: "bold" }}>Blank Scratch Layout</span>
        </div>
      );
  }
};

const FORM_TYPES = [
  { id: "enquiry", name: "Enquiry Form", icon: "bi-envelope-paper-fill", color: "#10b981", desc: "Simple callback request form and query comment fields." },
  { id: "registration", name: "Registration Form", icon: "bi-person-plus-fill", color: "#3b82f6", desc: "Collect student profiles, grades, and contact details." },
  { id: "payment", name: "Payment Form", icon: "bi-credit-card-fill", color: "#f43f5e", desc: "Process payments, tuition estimates, and fee splits." },
  { id: "application", name: "Application Form", icon: "bi-mortarboard-fill", color: "#8b5cf6", desc: "Full student application with school records & document uploads." },
  { id: "feedback", name: "Feedback Form", icon: "bi-star-half", color: "#06b6d4", desc: "Gather ratings, reviews, recommendations, and feedback comments." },
  { id: "consent", name: "Consent Form", icon: "bi-shield-check-fill", color: "#14b8a6", desc: "Manage parent media releases, terms, policies, and consents." }
];

const LAYOUT_FORMATS = [
  { id: "blank", name: "Blank Scratch", label: "Empty Visual Canvas" },
  { id: "embed-admission", name: "Simply Admission", label: "SimplyAdmission Iframe Embed" },
  { id: "type1", name: "Format 1", label: "Right Form Split Card" },
  { id: "type2", name: "Format 2", label: "Blur Form Photo Overlay" },
  { id: "type3", name: "Format 3", label: "Flipped Left Form Split" },
  { id: "type4", name: "Format 4", label: "Right Video Embed Split" },
  { id: "type5", name: "Format 5", label: "Centered Indigo Banner" },
  { id: "type6", name: "Format 6", label: "Glassmorphic Floating" },
  { id: "type7", name: "Format 7", label: "Neumorphic Soft Shaded" },
  { id: "type8", name: "Format 8", label: "Sidebar Border Heavy" },
  { id: "type9", name: "Format 9", label: "Cyan Gradient Banner" },
  { id: "type10", name: "Format 10", label: "Minimalist Borderless" },
  { id: "type11", name: "Format 11", label: "Slate Accent Warning" }
];

export default function LandingPageWizard({ onSelect, onCancel }) {
  const [selectedForm, setSelectedForm] = useState(FORM_TYPES[0]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const topbarTitleEl = document.querySelector(".topbar h2");
    if (topbarTitleEl) {
      const originalHTML = topbarTitleEl.innerHTML;
      
      topbarTitleEl.innerHTML = `
        <div class="d-flex align-items-center gap-1 text-muted fw-normal" style="font-size: 13px;">
          <span class="text-primary cursor-pointer hover-underline" id="breadcrumb-setup-link" style="font-weight: 600; cursor: pointer; text-decoration: none;">Setup</span>
          <i class="bi bi-chevron-double-right text-muted mx-1" style="font-size: 10px; -webkit-text-stroke: 0.75px #64748b; font-weight: 900;"></i>
          <span class="text-primary cursor-pointer hover-underline" id="breadcrumb-lp-link" style="font-weight: 600; cursor: pointer; text-decoration: none;">Landing Page</span>
          <i class="bi bi-chevron-double-right text-muted mx-1" style="font-size: 10px; -webkit-text-stroke: 0.75px #64748b; font-weight: 900;"></i>
          <span class="text-secondary fw-bold" style="font-weight: bold;">Create Landing Page</span>
        </div>
      `;

      const setupLink = document.getElementById("breadcrumb-setup-link");
      const lpLink = document.getElementById("breadcrumb-lp-link");
      
      const goBack = (e) => {
        e.preventDefault();
        onCancel();
      };

      if (setupLink) setupLink.addEventListener("click", goBack);
      if (lpLink) lpLink.addEventListener("click", goBack);

      return () => {
        topbarTitleEl.innerHTML = originalHTML;
      };
    }
  }, [onCancel]);

  const handleSelectFormat = (formatId) => {
    // Generate page configuration based on form selection + format choice
    const brandName = selectedForm.name.replace("Form", "Portal");
    const isBlank = formatId === "blank";
    const isEmbedAdmission = formatId === "embed-admission";

    const config = {
      brandName: brandName,
      heroTitle: `Online ${selectedForm.name}`,
      heroSubtitle: `Fill in the details below to complete your ${selectedForm.name.toLowerCase()} process.`,
      heroCtaLabel: "Submit Details",
      heroCtaLink: "#contact-form",
      accentColor: selectedForm.color,
      highlightTitle: "Important Notice",
      features: [],
      components: isBlank ? [] : isEmbedAdmission ? [
        {
          id: `comp-html-${Date.now()}`,
          type: "custom-html",
          content: {
            htmlCode: `<!-- Simply Admission Embed -->
<iframe id="landingFrame" style="width: 100%; height: 100vh; border: none; display: block;"></iframe>
<script>
    (function() {
        const params = new URLSearchParams(window.location.search);
        const utmSource = params.get("utm_source") || "";
        const iframeUrl = "https://clarwyn.simplyadmission.com/clp/admission?utm_source=" + encodeURIComponent(utmSource);
        const frame = document.getElementById("landingFrame");
        if (frame) frame.src = iframeUrl;
    })();
</script>`
          },
          styles: {
            width: "100%",
            height: "auto",
            paddingTop: "0px",
            paddingBottom: "0px",
            paddingLeft: "0px",
            paddingRight: "0px"
          }
        }
      ] : [
        {
          id: `comp-header-${Date.now()}`,
          type: "header-nav",
          content: {
            presetType: formatId,
            brandName: brandName,
            logoUrl: "https://clarwynschool.com/wp-content/themes/astra/assets/images/logo.png",
            logoWidth: "50px",
            phone: "+91 9012559012",
            email: "admissions@acmeacademy.edu",
            menuLinks: [
              { label: "Home", url: "#" },
              { label: "Admissions", url: "#contact-form" },
              { label: "Contact Us", url: "#footer" }
            ],
            buttonText: "Apply Now",
            buttonLink: "#contact-form",
            showButton: true
          },
          styles: {
            width: "100%",
            height: "auto",
            backgroundColor: formatId === "type11" ? "#0f172a" : "#ffffff",
            paddingTop: "15px",
            paddingBottom: "15px",
            paddingLeft: "20px",
            paddingRight: "20px"
          }
        },
        {
          id: `comp-hero-${Date.now() + 1}`,
          type: "hero-split",
          content: {
            presetType: formatId,
            badgeText: "ONLINE FORM ACTIVE",
            title: `Portal: ${selectedForm.name}`,
            subtitle: `Easily complete the ${selectedForm.name.toLowerCase()} fields. Make sure to check details before submitting.`,
            formTitle: selectedForm.name,
            formType: "custom_form",
            wizardFormType: selectedForm.id,
            bgImage: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200",
            videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
            ctaText: "Get Started",
            ctaLink: "#contact-form"
          },
          styles: {
            width: "100%",
            height: "auto",
            paddingTop: "70px",
            paddingBottom: "70px",
            paddingLeft: "20px",
            paddingRight: "20px",
            backgroundColor: formatId === "type11" ? "#0f172a" : formatId === "type5" ? "#1e1b4b" : "#f8fafc"
          }
        },
        {
          id: `comp-footer-${Date.now() + 2}`,
          type: "footer",
          content: {
            presetType: "type1",
            address: "School Campus, Sector 12, Expressway, Noida",
            phone: "+91 9012559012",
            email: "admissions@acmeacademy.edu",
            copyright: `© 2026 ${brandName}. All rights reserved.`
          },
          styles: {
            width: "100%",
            height: "auto",
            paddingTop: "40px",
            paddingBottom: "40px",
            paddingLeft: "20px",
            paddingRight: "20px",
            backgroundColor: "#0f172a",
            textColor: "#94a3b8"
          }
        }
      ]
    };

    onSelect({
      name: `${selectedForm.name} Landing Page`,
      pageType: selectedForm.id === "enquiry" ? "enquiry" : "general",
      config
    });
  };

  const filteredFormTypes = FORM_TYPES.filter(form => 
    form.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    form.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="card shadow-sm border-0 bg-white" style={{ borderRadius: "16px", height: "calc(100vh - 85px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Top Banner Wizard Header */}
      <div className="card-header bg-white border-bottom px-4 py-2.5 d-flex justify-content-between align-items-center" style={{ borderTopLeftRadius: "16px", borderTopRightRadius: "16px", flexShrink: 0 }}>
        <div>
          <span className="fw-bold text-dark" style={{ fontSize: "14px" }}>Choose Form & Style</span>
        </div>
        <div>
          <button className="btn btn-sm btn-light border px-3" style={{ borderRadius: "8px" }} onClick={onCancel}>Cancel</button>
        </div>
      </div>

      {/* Split Layout Container */}
      <div className="d-flex flex-row flex-grow-1 text-start" style={{ background: "#f8fafc", overflow: "hidden" }}>
        
        {/* Left Sidebar - Form Types Selection */}
        <div className="bg-white border-end d-flex flex-column text-start" style={{ width: "216px", minWidth: "216px", flexShrink: 0, height: "100%" }}>
          <div className="p-2 border-bottom bg-light bg-opacity-50" style={{ flexShrink: 0 }}>
            <label className="small fw-bold text-secondary text-uppercase mb-2" style={{ fontSize: "9px", letterSpacing: "0.5px" }}>1. Select Form Type</label>
            <div className="position-relative">
              <i className="bi bi-search position-absolute text-muted" style={{ left: "10px", top: "7px", fontSize: "12px" }}></i>
              <input 
                type="text" 
                className="form-control form-control-sm ps-4 search-form-input" 
                placeholder="Search forms..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ borderRadius: "8px", fontSize: "11px", height: "28px" }}
              />
            </div>
          </div>
          
          <div className="flex-grow-1 overflow-auto p-2" style={{ overflowY: "auto" }}>
            {filteredFormTypes.map((form) => {
              const isSelected = selectedForm.id === form.id;
              return (
                <div
                  key={form.id}
                  className={`d-flex align-items-center cursor-pointer rounded-3 sidebar-form-item transition-all ${isSelected ? "sidebar-form-active" : ""}`}
                  onClick={() => setSelectedForm(form)}
                  style={{
                    cursor: "pointer",
                    borderRadius: "8px",
                    transition: "all 0.15s ease-in-out",
                    borderLeft: isSelected ? `4px solid ${form.color}` : "4px solid transparent",
                    background: isSelected ? `${form.color}0d` : "transparent",
                    padding: "8px 10px",
                    gap: "10px",
                    marginBottom: "4px"
                  }}
                >
                  <div 
                    className="rounded-3 d-flex align-items-center justify-content-center text-white" 
                    style={{ 
                      width: "30px", 
                      height: "30px", 
                      background: form.color, 
                      flexShrink: 0,
                      fontSize: "13px",
                      boxShadow: isSelected ? `0 3px 8px ${form.color}35` : "none"
                    }}
                  >
                    <i className={`bi ${form.icon}`}></i>
                  </div>
                  <div className="min-w-0 text-start flex-grow-1">
                    <h6 className={`mb-0 ${isSelected ? "text-primary fw-bold" : "text-dark"}`} style={{ fontSize: "12px", fontWeight: isSelected ? "700" : "550", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{form.name}</h6>
                  </div>
                </div>
              );
            })}
            {filteredFormTypes.length === 0 && (
              <div className="text-center py-4 text-muted small">No forms matched search</div>
            )}
          </div>
        </div>

        {/* Right Main Panel - Layout Formats Gallery */}
        <div className="flex-grow-1 p-2 overflow-auto animate-fade-in" style={{ height: "100%", overflowY: "auto" }}>
          {/* Custom Premium Header Banner */}
          <div className="bg-white text-dark text-start border shadow-xs p-3 mb-2 rounded-3 d-flex align-items-center gap-3" style={{ borderLeft: `5px solid ${selectedForm.color}`, borderRadius: "12px" }}>
            <div className="rounded-circle d-flex align-items-center justify-content-center text-white" style={{ width: "42px", height: "42px", background: selectedForm.color, flexShrink: 0, boxShadow: `0 4px 12px ${selectedForm.color}30` }}>
              <i className={`bi ${selectedForm.icon} fs-5`}></i>
            </div>
            <div>
              <span className="fw-bold text-uppercase small text-secondary" style={{ fontSize: "8.5px" }}>Selected Form Template</span>
              <h6 className="fw-bold mb-0 text-dark">{selectedForm.name}</h6>
            </div>
          </div>

          {/* Formats Grid */}
          <div className="row g-3">
            {LAYOUT_FORMATS.map((style) => (
              <div className="col-sm-6 col-md-4 col-lg-3" key={style.id}>
                <div
                  className="card h-100 p-2.5 border shadow-sm"
                  style={{
                    borderRadius: "10px",
                    background: "#ffffff",
                    borderColor: "#e2e8f0"
                  }}
                >
                  {/* Visual Miniature Wireframe Mockup Container */}
                  <div className="position-relative overflow-hidden rounded-2 format-card-media-wrapper" style={{ height: "110px" }}>
                    {renderMiniMockup(style.id, selectedForm.color, selectedForm.id)}
                  </div>

                  <div className="text-start mt-2 px-1 pb-1 flex-grow-1 d-flex flex-column justify-content-between">
                    <span className="fw-semibold text-dark d-block text-truncate mb-2" style={{ fontSize: "12px" }} title={style.id === "blank" ? "Blank Scratch" : style.label}>
                      {style.id === "blank" ? "Blank Scratch" : style.label}
                    </span>
                    <button
                      className="btn btn-sm btn-primary w-100 fw-medium shadow-xs"
                      style={{ fontSize: "11px", padding: "4px 8px" }}
                      onClick={() => handleSelectFormat(style.id)}
                    >
                      Choose Layout <i className="bi bi-arrow-right-short ms-1"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Styled Hover Micro-Animations */}
      <style>{`
        .sidebar-form-item:hover {
          background: #f1f5f9;
        }
        .sidebar-form-active {
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.02);
        }
        .search-form-input:focus {
          border-color: #2249b7 !important;
          box-shadow: 0 0 0 3px rgba(34,73,183,0.15) !important;
        }
        .format-card-media-wrapper {
          position: relative;
        }
        .format-card-hover-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(15, 23, 42, 0.4);
          opacity: 0;
          transition: all 0.25s ease-in-out;
          border-radius: 6px;
        }
        .hover-format-card:hover .format-card-hover-overlay {
          opacity: 1;
        }
        .hover-format-card:hover {
          transform: translateY(-2px);
          border-color: #2249b7 !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
}
