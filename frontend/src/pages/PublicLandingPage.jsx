import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "../api";
import { Spinner, ErrorBox } from "../components/ui";

import { showNotice } from "../utils/dialog";
export default function PublicLandingPage() {
  const { pageId } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formValues, setFormValues] = useState({});
  const [submittingCustomForm, setSubmittingCustomForm] = useState(false);

  const handleCustomFormSubmit = async (e) => {
    if (e) e.preventDefault();
    try {
      setSubmittingCustomForm(true);
      // Validate required fields
      const requiredFields = (page?.components || []).filter(comp => {
        const c = comp.content || {};
        return comp.type.endsWith("-input") && c.required;
      });

      for (const field of requiredFields) {
        const fieldKey = field.content?.fieldName || field.id;
        if (!formValues[fieldKey]) {
          showNotice(`Please fill in the required field: ${field.content?.label || 'Form Field'}`);
          setSubmittingCustomForm(false);
          return;
        }
      }

      // Submit lead to CRM!
      await publicApi.submitLandingEnquiry(pageId, formValues);
      showNotice("Your enquiry has been submitted successfully!");
      setFormValues({});
    } catch (err) {
      showNotice(err.message || "Failed to submit enquiry.");
    } finally {
      setSubmittingCustomForm(false);
    }
  };

  useEffect(() => {
    async function loadPage() {
      try {
        setLoading(true);
        setError("");
        const res = await publicApi.getLandingPage(pageId);
        const payload = res?.data?.page || res?.page || null;
        setPage(payload);
      } catch (e) {
        setError(e.message || "Unable to load landing page.");
      } finally {
        setLoading(false);
      }
    }
    loadPage();
  }, [pageId]);

  // Load custom google fonts specified in the theme
  useEffect(() => {
    if (!page?.theme?.fontFamily) return;
    const font = page.theme.fontFamily;
    if (font === "System" || font === "Default") return;
    const linkId = `gfont-${font.toLowerCase()}`;
    if (document.getElementById(linkId)) return;

    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${font.replace(" ", "+")}:wght@300;400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }, [page?.theme?.fontFamily]);

  // Set page meta title dynamically
  useEffect(() => {
    if (page?.seo?.title) {
      document.title = page.seo.title;
    }
  }, [page]);

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
        <Spinner label="Loading Page..." />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="container py-5 text-center min-vh-100 d-flex flex-column align-items-center justify-content-center">
        <ErrorBox error={error || "Landing Page not found."} />
        <p className="text-muted mt-3">Please verify the URL or make sure the landing page is set to Active/Live.</p>
      </div>
    );
  }

  // Determine width style based on canvas settings
  const canvasStyle = {
    maxWidth: page.canvasWidth && page.canvasWidth !== "100%" ? page.canvasWidth : "100%",
    minHeight: page.canvasHeight || "auto",
    margin: "0 auto",
    boxShadow: page.canvasWidth && page.canvasWidth !== "100%" ? "0 10px 30px rgba(0,0,0,0.05)" : "none",
    borderLeft: page.canvasWidth && page.canvasWidth !== "100%" ? "1px solid #e2e8f0" : "none",
    borderRight: page.canvasWidth && page.canvasWidth !== "100%" ? "1px solid #e2e8f0" : "none",
    backgroundColor: "#ffffff",
    position: "relative"
  };

  return (
    <div
      style={{
        fontFamily: page.theme?.fontFamily ? `'${page.theme.fontFamily}', sans-serif` : "system-ui",
        backgroundColor: page.theme?.backgroundColor || "#f8fafc",
        minHeight: "100vh",
        color: "#1e293b",
        padding: "0"
      }}
    >
      <div style={canvasStyle}>
        {page.rawHtml ? (
          <CustomHtmlBlock html={page.rawHtml} />
        ) : (
          (page.components || []).map((comp, idx) => {
            // Animation inline style
            const anim = comp.animation || { type: "none", duration: "0.5s", delay: "0s" };
            const hasAnim = anim.type && anim.type !== "none";
            const posX = comp.styles?.left ? comp.styles.left : "24px";
            const posY = comp.styles?.top ? comp.styles.top : `${idx * 200 + 24}px`;
            
            return (
              <div
                key={comp.id}
                id={comp.id}
                className={hasAnim ? `animate-${anim.type}` : ""}
                style={{
                  paddingTop: comp.styles?.paddingTop || "0px",
                  paddingBottom: comp.styles?.paddingBottom || "0px",
                  paddingLeft: comp.styles?.paddingLeft || "0px",
                  paddingRight: comp.styles?.paddingRight || "0px",
                  marginTop: comp.styles?.marginTop || "0px",
                  marginBottom: comp.styles?.marginBottom || "0px",
                  marginLeft: comp.styles?.marginLeft || "auto",
                  marginRight: comp.styles?.marginRight || "auto",
                  width: comp.styles?.width || "100%",
                  height: comp.styles?.height || "auto",
                  backgroundColor: comp.styles?.backgroundColor || "transparent",
                  color: comp.styles?.textColor || "inherit",
                  borderRadius: comp.styles?.borderRadius || page.theme?.borderRadius || "0px",
                  borderWidth: comp.styles?.borderWidth || "0px",
                  borderStyle: comp.styles?.borderWidth ? "solid" : "none",
                  borderColor: comp.styles?.borderColor || "transparent",
                  boxShadow: comp.styles?.boxShadow || "none",
                  animationDuration: hasAnim ? anim.duration || "0.5s" : "0s",
                  animationDelay: hasAnim ? anim.delay || "0s" : "0s",
                  animationFillMode: hasAnim ? "both" : "none",
                  position: "absolute",
                  left: posX,
                  top: posY,
                  zIndex: comp.styles?.zIndex || 10
                }}
              >
                {renderPublicComponent(comp, page.theme, formValues, setFormValues, handleCustomFormSubmit)}
              </div>
            );
          })
        )}
      </div>

      {/* Embedded keyframe animation stylesheet */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes zoomIn {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes bounceEffect {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-fade-in {
          animation-name: fadeIn;
        }
        .animate-slide-up {
          animation-name: slideUp;
        }
        .animate-zoom-in {
          animation-name: zoomIn;
        }
        .animate-bounce {
          animation-name: bounceEffect;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  );
}

function CustomHtmlBlock({ html }) {
  const containerRef = React.useRef(null);
  const shadowRootRef = React.useRef(null);

  React.useEffect(() => {
    if (!containerRef.current) return;

    if (!shadowRootRef.current) {
      shadowRootRef.current = containerRef.current.attachShadow({ mode: "open" });
    }

    const shadowRoot = shadowRootRef.current;
    shadowRoot.innerHTML = `
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" rel="stylesheet">
      <style>
        :host {
          display: block;
          width: 100%;
        }
      </style>
      <div class="w-100 h-100">${html}</div>
    `;

    const scripts = shadowRoot.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.appendChild(document.createTextNode(oldScript.innerHTML));
      document.body.appendChild(newScript);
      document.body.removeChild(newScript);
    });
  }, [html]);

  return <div ref={containerRef} className="w-100" style={{ height: "auto" }} />;
}

function renderPublicComponent(comp, theme, formValues = {}, setFormValues = () => {}, handleCustomFormSubmit = () => {}) {
  const c = comp.content || {};
  const pType = c.presetType || "type1";

  switch (comp.type) {
    case "custom-html": {
      return (
        <div className="w-100 position-relative">
          <CustomHtmlBlock html={c.htmlCode || "<div>Empty HTML Block</div>"} />
        </div>
      );
    }
    case "header-nav": {
      const logoLink = c.logoLink || c.logoUrlLink || "#";
      const target = logoLink.startsWith("http") ? "_blank" : "_self";
      const renderLogo = (maxHeight, className = "") => {
        if (!c.logoUrl) return null;
        return (
          <a href={logoLink} target={target} rel="noopener noreferrer" style={{ display: "inline-block", textDecoration: "none" }}>
            <img src={c.logoUrl} alt="Logo" className={className} style={{ maxHeight, objectFit: "contain" }} />
          </a>
        );
      };

      if (pType === "type2") {
        return (
          <header className="px-4 py-3 d-flex flex-wrap justify-content-between align-items-center bg-white border-bottom w-100 shadow-sm">
            {renderLogo(c.logoWidth || "45px")}
            <div className="d-flex align-items-center gap-4 mx-auto">
              {(c.menuLinks || []).map((l, i) => (
                <a key={i} href={l.url} className="text-muted small fw-bold" style={{ textDecoration: "none" }}>{l.label}</a>
              ))}
            </div>
            {c.showButton && (
              <a href={c.buttonLink} className="btn text-white px-3 py-1.5 small" style={{ background: theme.primaryColor, textDecoration: "none" }}>{c.buttonText}</a>
            )}
          </header>
        );
      } else if (pType === "type3") {
        return (
          <header className="py-4 text-center border-bottom w-100 bg-white">
            {renderLogo(c.logoWidth || "55px", "mb-3 animate-pulse")}
            <div className="d-flex justify-content-center gap-4">
              {(c.menuLinks || []).map((l, i) => (
                <a key={i} href={l.url} className="text-dark small fw-bold text-uppercase" style={{ textDecoration: "none", letterSpacing: "1px" }}>{l.label}</a>
              ))}
            </div>
          </header>
        );
      } else if (pType === "type4") {
        return (
          <div className="w-100 border-bottom bg-white">
            <div className="bg-light py-1.5 px-4 d-flex justify-content-between align-items-center border-bottom" style={{ fontSize: "11px" }}>
              <div className="text-muted"><i className="bi bi-telephone-fill me-1"></i> {c.phone} | <i className="bi bi-envelope-fill ms-2 me-1"></i> {c.email}</div>
              <div className="d-flex gap-2 text-muted"><i className="bi bi-facebook"></i><i className="bi bi-instagram"></i><i className="bi bi-whatsapp"></i></div>
            </div>
            <header className="px-4 py-3 d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-3">
                {renderLogo(c.logoWidth || "40px")}
                <h6 className="fw-bold mb-0 text-dark">{c.brandName}</h6>
              </div>
              <div className="d-flex align-items-center gap-4">
                {(c.menuLinks || []).map((l, i) => (
                  <a key={i} href={l.url} className="text-muted small fw-semibold" style={{ textDecoration: "none" }}>{l.label}</a>
                ))}
              </div>
            </header>
          </div>
        );
      } else if (pType === "type5") {
        return (
          <header className="mx-3 my-3 p-3 d-flex justify-content-between align-items-center border shadow rounded-4 w-100 bg-white bg-opacity-75" style={{
            backdropFilter: "blur(8px)"
          }}>
            {renderLogo(c.logoWidth || "45px")}
            <div className="d-flex align-items-center gap-4">
              {(c.menuLinks || []).map((l, i) => (
                <a key={i} href={l.url} className="text-muted small fw-semibold" style={{ textDecoration: "none" }}>{l.label}</a>
              ))}
            </div>
            <a href={c.buttonLink} className="btn text-white px-4" style={{ background: theme.primaryColor, borderRadius: "20px", textDecoration: "none" }}>{c.buttonText}</a>
          </header>
        );
      }

      // Default Style 1: Left Logo + Right Menu & CTA
      return (
        <header className="px-4 py-3 d-flex flex-wrap justify-content-between align-items-center bg-white border-bottom shadow-sm">
          <div className="d-flex align-items-center gap-3">
            {renderLogo(c.logoWidth || "45px", "img-fluid")}
            {c.brandName && <h5 className="fw-bold mb-0 text-dark">{c.brandName}</h5>}
          </div>
          <div className="d-none d-md-flex align-items-center gap-4 text-start">
            {(c.menuLinks || []).map((link, i) => (
              <a key={i} href={link.url} className="text-muted small fw-semibold" style={{ textDecoration: "none" }}>{link.label}</a>
            ))}
            {c.showButton && (
              <a href={c.buttonLink} className="btn text-white px-4 py-2" style={{ background: theme.primaryColor, borderRadius: theme.borderRadius, textDecoration: "none" }}>
                {c.buttonText}
              </a>
            )}
          </div>
        </header>
      );
    }

    case "hero-split": {
      // Helper to render the form card box uniformly on the public/visitor view
      const renderPublicFormBox = (textClass = "", inputClass = "") => {
        return (
          <div className={`card p-4 border-0 shadow-lg ${textClass.includes("white") ? "bg-white bg-opacity-25 border border-secondary text-white" : "bg-white text-dark"}`} style={{ borderRadius: theme.borderRadius }}>
            <h5 className={`fw-bold text-center mb-3 ${textClass.includes("white") ? "text-white" : "text-dark"}`}>{c.formTitle}</h5>
            {c.wizardFormType ? (
              renderDynamicWizardForm(c, theme, textClass, inputClass)
            ) : c.formType === "enquiry_form" && c.enquiryFormId ? (
              <PublicEnquiryFormEmbed formId={c.enquiryFormId} theme={theme} />
            ) : (
              <SimpleInquiryForm submitColor={theme.primaryColor} submitText={c.ctaText || "Submit"} borderRadius={theme.borderRadius} />
            )}
          </div>
        );
      };

      if (pType === "type2") {
        return (
          <div className="position-relative text-start py-5 px-4 text-white w-100" style={{
            backgroundImage: `linear-gradient(rgba(15,23,42,0.7), rgba(15,23,42,0.7)), url(${c.bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed"
          }}>
            <div className="container py-4">
              <div className="row g-5 align-items-center">
                <div className="col-md-7">
                  <h1 className="display-4 fw-bold mb-3">{c.title}</h1>
                  <p className="lead">{c.subtitle}</p>
                </div>
                <div className="col-md-5">
                  {renderPublicFormBox("text-white", "bg-transparent text-white border-secondary text-white-placeholder")}
                </div>
              </div>
            </div>
          </div>
        );
      } else if (pType === "type3") {
        return (
          <div className="w-100 py-5 px-4 bg-light text-dark">
            <div className="container">
              <div className="row g-5 align-items-center">
                <div className="col-md-5 order-2 order-md-1">
                  {renderPublicFormBox("text-dark", "")}
                </div>
                <div className="col-md-7 order-1 order-md-2">
                  <span className="badge bg-primary px-3 py-1.5 mb-2 text-uppercase">{c.badgeText}</span>
                  <h1 className="fw-bold text-dark display-5 mb-3">{c.title}</h1>
                  <p className="text-muted lead">{c.subtitle}</p>
                </div>
              </div>
            </div>
          </div>
        );
      } else if (pType === "type4") {
        return (
          <div className="w-100 py-5 px-4 bg-white text-dark border-bottom">
            <div className="container">
              <div className="row g-5 align-items-center">
                <div className="col-lg-6">
                  <span className="badge bg-danger text-uppercase px-3 py-2 mb-3">{c.badgeText}</span>
                  <h1 className="fw-bold display-4 mb-3">{c.title}</h1>
                  <p className="text-muted lead mb-4">{c.subtitle}</p>
                  {c.ctaText && <a href={c.ctaLink} className="btn btn-lg text-white" style={{ background: theme.primaryColor, textDecoration: "none" }}>{c.ctaText}</a>}
                </div>
                <div className="col-lg-6">
                  <div className="shadow border overflow-hidden rounded-4" style={{ height: "340px" }}>
                    <iframe src={c.videoUrl} width="100%" height="100%" style={{ border: 0 }} allowFullScreen="" title="hero-video"></iframe>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      } else if (pType === "type5") {
        return (
          <div className="w-100 py-5 px-4 text-center text-white" style={{
            background: `linear-gradient(135deg, ${theme.primaryColor} 0%, #1e1b4b 100%)`
          }}>
            <div className="container py-5" style={{ maxWidth: "800px" }}>
              <span className="badge bg-warning text-dark px-3 py-2 mb-3 text-uppercase font-semibold">{c.badgeText}</span>
              <h1 className="display-3 fw-bold mb-4">{c.title}</h1>
              <p className="lead fs-5 mb-4" style={{ opacity: 0.9, lineHeight: "1.8" }}>{c.subtitle}</p>
              
              <div className="mx-auto text-start shadow-lg" style={{ maxWidth: "450px" }}>
                {renderPublicFormBox("text-dark", "")}
              </div>
            </div>
          </div>
        );
      } else if (pType === "type6") {
        return (
          <div className="w-100 py-5 px-4 text-center" style={{
            backgroundImage: `url(${c.bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}>
            <div className="container py-5 rounded-4 shadow-lg text-dark bg-white" style={{
              maxWidth: "800px",
              background: "rgba(255, 255, 255, 0.75)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255, 255, 255, 0.4)"
            }}>
              <span className="badge bg-primary text-white px-3 py-2 mb-3 text-uppercase font-semibold">{c.badgeText}</span>
              <h1 className="display-4 fw-bold mb-4">{c.title}</h1>
              <p className="lead fs-5 mb-4">{c.subtitle}</p>
              
              <div className="mx-auto text-start shadow" style={{ maxWidth: "450px" }}>
                {renderPublicFormBox("text-dark", "")}
              </div>
            </div>
          </div>
        );
      } else if (pType === "type7") {
        return (
          <div className="w-100 py-5 px-4 text-center" style={{ backgroundColor: "#f1f5f9" }}>
            <div className="container py-5 rounded-4" style={{
              maxWidth: "800px",
              boxShadow: "10px 10px 30px #cbd5e1, -10px -10px 30px #ffffff",
              border: "1px solid #e2e8f0",
              background: "#f1f5f9"
            }}>
              <span className="text-secondary fw-bold text-uppercase d-block mb-2 small">{c.badgeText}</span>
              <h1 className="fw-black text-dark mb-4">{c.title}</h1>
              <p className="text-muted mb-4">{c.subtitle}</p>
              
              <div className="mx-auto text-start" style={{ maxWidth: "450px" }}>
                {renderPublicFormBox("text-dark", "")}
              </div>
            </div>
          </div>
        );
      } else if (pType === "type8") {
        return (
          <div className="w-100 py-5 px-4 text-start bg-light" style={{ borderLeft: `8px solid ${theme.primaryColor}` }}>
            <div className="container py-4">
              <div className="row g-5 align-items-center">
                <div className="col-md-7">
                  <span className="badge bg-dark text-white px-3 py-1 mb-3 text-uppercase font-semibold">{c.badgeText}</span>
                  <h1 className="display-4 fw-bold text-dark mb-3">{c.title}</h1>
                  <p className="lead text-muted fs-5 mb-4">{c.subtitle}</p>
                </div>
                <div className="col-md-5">
                  {renderPublicFormBox("text-dark", "")}
                </div>
              </div>
            </div>
          </div>
        );
      } else if (pType === "type9") {
        return (
          <div className="w-100 py-5 px-4 text-center text-white" style={{
            background: `linear-gradient(135deg, ${theme.primaryColor} 0%, #06b6d4 100%)`
          }}>
            <div className="container py-5">
              <span className="badge bg-white text-dark px-3 py-2 mb-3 text-uppercase">{c.badgeText}</span>
              <h1 className="display-4 fw-bold mb-4">{c.title}</h1>
              <p className="lead fs-5 mb-4" style={{ opacity: 0.9 }}>{c.subtitle}</p>
              
              <div className="mx-auto text-start shadow-lg" style={{ maxWidth: "450px" }}>
                {renderPublicFormBox("text-dark", "")}
              </div>
            </div>
          </div>
        );
      } else if (pType === "type10") {
        return (
          <div className="w-100 py-5 px-4 bg-white text-start">
            <div className="container py-4">
              <div className="row align-items-center g-5">
                <div className="col-md-7">
                  <span className="text-secondary fw-semibold text-uppercase small d-block mb-2">{c.badgeText}</span>
                  <h1 className="display-4 fw-bold text-dark mb-3">{c.title}</h1>
                  <p className="lead text-muted">{c.subtitle}</p>
                </div>
                <div className="col-md-5">
                  {renderPublicFormBox("text-dark", "")}
                </div>
              </div>
            </div>
          </div>
        );
      } else if (pType === "type11") {
        return (
          <div className="w-100 py-5 px-4 text-center text-white" style={{ backgroundColor: "#0f172a" }}>
            <div className="container py-5">
              <span className="badge bg-warning text-dark px-3 py-2 mb-3 text-uppercase">{c.badgeText}</span>
              <h1 className="display-4 fw-bold text-white mb-4">{c.title}</h1>
              <p className="lead text-secondary mb-4">{c.subtitle}</p>
              
              <div className="mx-auto text-start" style={{ maxWidth: "450px" }}>
                {renderPublicFormBox("text-white", "bg-transparent text-white border-secondary text-white-placeholder")}
              </div>
            </div>
          </div>
        );
      }

      // Default Style 1: Left Text + Right Form Solid Card
      return (
        <div className="position-relative overflow-hidden text-start py-5 px-4 text-white" style={{
          backgroundImage: `linear-gradient(rgba(15,23,42,0.85), rgba(15,23,42,0.85)), url(${c.bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}>
          <div className="container py-4">
            <div className="row align-items-center g-5">
              <div className="col-lg-7 text-start">
                {c.badgeText && (
                  <span className="badge bg-danger px-3 py-2 fw-bold text-uppercase mb-3" style={{ fontSize: "11px", letterSpacing: "1px", borderRadius: "4px" }}>
                    {c.badgeText}
                  </span>
                )}
                <h1 className="display-4 fw-bold mb-3" style={{ lineHeight: "1.2" }}>{c.title}</h1>
                <p className="lead fs-5" style={{ opacity: 0.9, lineHeight: "1.7" }}>{c.subtitle}</p>
                {c.ctaText && (
                  <a href={c.ctaLink} className="btn btn-lg text-white mt-3 fw-bold px-4 py-2.5" style={{ background: theme.primaryColor, borderRadius: theme.borderRadius, textDecoration: "none" }}>
                    {c.ctaText}
                  </a>
                )}
              </div>
              <div className="col-lg-5" id="contact-form">
                {renderPublicFormBox("text-dark", "")}
              </div>
            </div>
          </div>
        </div>
      );
    }

    case "feature-showcase": {
      if (pType === "type2") {
        return (
          <div className="container py-5 text-start w-100">
            <h3 className="fw-bold mb-4 display-6 text-center">{c.title}</h3>
            <div className="row g-4">
              {(c.items || []).map((item, idx) => (
                <div key={idx} className="col-md-4">
                  <div className="card h-100 p-4 border bg-white shadow-sm" style={{ borderRadius: theme.borderRadius }}>
                    <div className="badge bg-light text-primary fw-bold fs-5 px-3 py-2 align-self-start mb-3" style={{ borderRadius: "50%", color: theme.primaryColor }}>{item.num}</div>
                    <h5 className="fw-bold text-dark mb-2">{item.heading}</h5>
                    <p className="text-muted small mb-0" style={{ lineHeight: "1.6" }}>{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      } else if (pType === "type3") {
        return (
          <div className="container py-5 text-start w-100">
            <h3 className="fw-bold mb-4 text-center display-6">{c.title}</h3>
            <div className="position-relative ps-4 border-start border-2 border-primary" style={{ marginLeft: "20px", borderColor: theme.primaryColor }}>
              {(c.items || []).map((item, idx) => (
                <div key={idx} className="mb-4 position-relative">
                  <div className="position-absolute text-white d-flex align-items-center justify-content-center fw-bold" style={{
                    width: "30px", height: "30px", borderRadius: "50%", background: theme.primaryColor, left: "-36px", top: "0px"
                  }}>{item.num}</div>
                  <h5 className="fw-bold text-dark mb-1">{item.heading}</h5>
                  <p className="text-muted small mb-0" style={{ lineHeight: "1.6" }}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        );
      } else if (pType === "type4") {
        return (
          <div className="w-100 py-5 px-4 text-white text-start" style={{ background: "#0b1329" }}>
            <div className="container">
              <h3 className="fw-bold text-white mb-5 display-6 text-center">{c.title}</h3>
              <div className="row g-4">
                {(c.items || []).map((item, idx) => (
                  <div key={idx} className="col-md-4">
                    <div className="p-4 border border-secondary rounded-4" style={{ background: "rgba(255,255,255,0.03)", borderColor: theme.primaryColor }}>
                      <span className="text-uppercase text-secondary fw-bold display-6 d-block mb-2" style={{ color: "#38bdf8" }}>{item.num}</span>
                      <h5 className="fw-bold text-white mb-2">{item.heading}</h5>
                      <p className="text-muted small mb-0" style={{ opacity: 0.85, lineHeight: "1.6" }}>{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      } else if (pType === "type5") {
        return (
          <div className="container py-5 text-start w-100">
            <h3 className="fw-bold mb-5 text-center display-6">{c.title}</h3>
            <div className="row g-4">
              {(c.items || []).map((item, idx) => (
                <div key={idx} className="col-md-6 border-bottom pb-4 mb-2">
                  <div className="d-flex align-items-start gap-4">
                    <h1 className="fw-bold mb-0" style={{ color: theme.primaryColor, opacity: 0.6 }}>{item.num}</h1>
                    <div>
                      <h5 className="fw-bold mb-2 text-dark">{item.heading}</h5>
                      <p className="text-muted mb-0 small" style={{ lineHeight: "1.6" }}>{item.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      // Default Style 1: Numbered Flex cards side-by-side
      return (
        <div className="container py-5 text-start">
          {c.title && <h2 className="fw-bold mb-5 text-center display-6">{c.title}</h2>}
          <div className="row g-4">
            {(c.items || []).map((item, idx) => (
              <div key={idx} className="col-md-6 d-flex gap-3 align-items-start p-4 bg-white rounded-4 border shadow-sm">
                <div className="display-5 fw-bold text-accent" style={{ color: theme.primaryColor, opacity: 0.8, fontSize: "2rem" }}>
                  {item.num}
                </div>
                <div>
                  <h5 className="fw-bold mb-2 text-dark" style={{ fontSize: "18px" }}>{item.heading}</h5>
                  <p className="text-muted mb-0 small" style={{ lineHeight: "1.6", fontSize: "13px" }}>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "heading": {
      return (
        <div className="container py-2" style={{
          textAlign: comp.styles?.textAlign || "left",
          color: comp.styles?.textColor || "inherit",
          fontSize: comp.styles?.fontSize || "32px",
          fontWeight: comp.styles?.fontWeight || "700",
          fontStyle: comp.styles?.fontStyle || "normal"
        }}>
          {c.text}
        </div>
      );
    }

    case "paragraph": {
      return (
        <div className="container py-2" style={{
          textAlign: comp.styles?.textAlign || "left",
          color: comp.styles?.textColor || "inherit",
          fontSize: comp.styles?.fontSize || "16px",
          fontWeight: comp.styles?.fontWeight || "400",
          fontStyle: comp.styles?.fontStyle || "normal",
          lineHeight: "1.7"
        }}>
          {c.text}
        </div>
      );
    }

    case "logo": {
      const linkUrl = c.linkUrl || c.logoLink || c.logoUrlLink || "#";
      const target = linkUrl.startsWith("http") ? "_blank" : "_self";
      return (
        <div className="container py-2" style={{ textAlign: c.align || "left" }}>
          {c.logoUrl && (
            <a href={linkUrl} target={target} rel="noopener noreferrer">
              <img src={c.logoUrl} alt="Logo" className="img-fluid" style={{ maxWidth: c.logoWidth || "120px" }} />
            </a>
          )}
        </div>
      );
    }

    case "image": {
      const imgEl = (
        <img
          src={c.imageUrl}
          alt={c.altText || "Image"}
          className="img-fluid shadow"
          style={{
            borderRadius: comp.styles?.borderRadius || theme.borderRadius,
            maxWidth: c.width || "100%",
            height: c.height || "auto",
            objectFit: "cover"
          }}
        />
      );
      return (
        <div className="container py-3" style={{ textAlign: c.align || "center" }}>
          {c.linkUrl ? <a href={c.linkUrl}>{imgEl}</a> : imgEl}
        </div>
      );
    }

    case "button": {
      const isSubmit = c.linkUrl === "submit";
      const btnStyle = {
        background: c.btnColor || theme.primaryColor,
        color: c.textColor || "#fff",
        borderRadius: comp.styles?.borderRadius || theme.borderRadius,
        fontSize: comp.styles?.fontSize || "16px",
        fontWeight: comp.styles?.fontWeight || "600",
        width: c.width === "100%" ? "100%" : "auto",
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none"
      };
      return (
        <div className="container py-3" style={{ textAlign: c.align || "left" }}>
          {isSubmit ? (
            <button
              type="button"
              className="btn text-white px-4 py-2.5 fw-bold"
              style={btnStyle}
              onClick={handleCustomFormSubmit}
            >
              {c.iconClass && <i className={`bi ${c.iconClass} me-2`}></i>}
              {c.text}
            </button>
          ) : (
            <a
              href={c.linkUrl || "#"}
              className="btn text-white px-4 py-2.5 fw-bold"
              style={btnStyle}
            >
              {c.iconClass && <i className={`bi ${c.iconClass} me-2`}></i>}
              {c.text}
            </a>
          )}
        </div>
      );
    }

    // FORM FIELDS PREVIEW RENDERING
    case "text-input":
    case "number-input":
    case "email-input":
    case "phone-input":
    case "password-input": {
      const typeMap = { "number-input": "number", "email-input": "email", "phone-input": "tel", "password-input": "password" };
      const t = typeMap[comp.type] || "text";
      const fieldKey = c.fieldName || comp.id;
      return (
        <div className="w-100 text-start px-2 py-1">
          <label className="form-label small fw-bold text-dark mb-1">{c.label} {c.required && <span className="text-danger">*</span>}</label>
          <input
            type={t}
            className="form-control form-control-sm"
            placeholder={c.placeholder}
            required={c.required}
            value={formValues[fieldKey] || ""}
            onChange={(e) => setFormValues({ ...formValues, [fieldKey]: e.target.value })}
          />
        </div>
      );
    }
    case "textarea-input": {
      const fieldKey = c.fieldName || comp.id;
      return (
        <div className="w-100 text-start px-2 py-1">
          <label className="form-label small fw-bold text-dark mb-1">{c.label} {c.required && <span className="text-danger">*</span>}</label>
          <textarea
            className="form-control form-control-sm"
            rows={2}
            placeholder={c.placeholder}
            required={c.required}
            value={formValues[fieldKey] || ""}
            onChange={(e) => setFormValues({ ...formValues, [fieldKey]: e.target.value })}
          />
        </div>
      );
    }
    case "otp-input": {
      const fieldKey = c.fieldName || comp.id;
      return (
        <div className="w-100 text-start px-2 py-1">
          <label className="form-label small fw-bold text-dark mb-2">{c.label}</label>
          <div className="d-flex gap-2">
            {Array.from({ length: c.digits || 6 }).map((_, idx) => (
              <input
                key={idx}
                type="text"
                maxLength={1}
                className="form-control form-control-sm text-center fw-bold"
                style={{ width: "35px" }}
                onChange={(e) => {
                  const val = e.target.value;
                  const currentOtp = (formValues[fieldKey] || "").split("");
                  currentOtp[idx] = val;
                  setFormValues({ ...formValues, [fieldKey]: currentOtp.join("") });
                }}
              />
            ))}
          </div>
        </div>
      );
    }
    case "date-input":
    case "time-input":
    case "datetime-input": {
      const t = comp.type === "date-input" ? "date" : comp.type === "time-input" ? "time" : "datetime-local";
      const fieldKey = c.fieldName || comp.id;
      return (
        <div className="w-100 text-start px-2 py-1">
          <label className="form-label small fw-bold text-dark mb-1">{c.label} {c.required && <span className="text-danger">*</span>}</label>
          <input
            type={t}
            className="form-control form-control-sm"
            required={c.required}
            value={formValues[fieldKey] || ""}
            onChange={(e) => setFormValues({ ...formValues, [fieldKey]: e.target.value })}
          />
        </div>
      );
    }
    case "dropdown-input": {
      const fieldKey = c.fieldName || comp.id;
      const opts = typeof c.options === "string"
        ? c.options.split(",").map(o => o.trim()).filter(Boolean)
        : (Array.isArray(c.options) ? c.options : []);
      return (
        <div className="w-100 text-start px-2 py-1">
          <label className="form-label small fw-bold text-dark mb-1">{c.label} {c.required && <span className="text-danger">*</span>}</label>
          <select
            className="form-select form-select-sm"
            required={c.required}
            value={formValues[fieldKey] || ""}
            onChange={(e) => setFormValues({ ...formValues, [fieldKey]: e.target.value })}
          >
            <option value="">-- Select --</option>
            {opts.map((o, idx) => (
              <option key={idx} value={o}>{o}</option>
            ))}
          </select>
        </div>
      );
    }
    case "multiselect-input": {
      const fieldKey = c.fieldName || comp.id;
      const opts = typeof c.options === "string"
        ? c.options.split(",").map(o => o.trim()).filter(Boolean)
        : (Array.isArray(c.options) ? c.options : []);
      const currentSelected = Array.isArray(formValues[fieldKey]) ? formValues[fieldKey] : [];
      return (
        <div className="w-100 text-start px-2 py-1">
          <label className="form-label small fw-bold text-dark mb-1">{c.label} {c.required && <span className="text-danger">*</span>}</label>
          <div className="border p-2 rounded bg-light d-flex gap-2 flex-wrap" style={{ minHeight: "38px" }}>
            {opts.map((o, idx) => {
              const isChecked = currentSelected.includes(o);
              return (
                <label key={idx} className="badge bg-secondary d-flex align-items-center gap-1 cursor-pointer mb-0">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    className="form-check-input mt-0"
                    style={{ width: "12px", height: "12px" }}
                    onChange={() => {
                      const next = isChecked
                        ? currentSelected.filter(v => v !== o)
                        : [...currentSelected, o];
                      setFormValues({ ...formValues, [fieldKey]: next });
                    }}
                  />
                  {o}
                </label>
              );
            })}
          </div>
        </div>
      );
    }
    case "radio-group-input": {
      const fieldKey = c.fieldName || comp.id;
      const opts = typeof c.options === "string"
        ? c.options.split(",").map(o => o.trim()).filter(Boolean)
        : (Array.isArray(c.options) ? c.options : []);
      return (
        <div className="w-100 text-start px-2 py-1">
          <label className="form-label small fw-bold text-dark d-block mb-1">{c.label}</label>
          <div className="d-flex gap-3 flex-wrap">
            {opts.map((o, idx) => (
              <div key={idx} className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  name={fieldKey}
                  checked={formValues[fieldKey] === o}
                  onChange={() => setFormValues({ ...formValues, [fieldKey]: o })}
                />
                <label className="form-check-label small">{o}</label>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "checkbox-input": {
      const fieldKey = c.fieldName || comp.id;
      return (
        <div className="w-100 text-start form-check px-2 py-1 ms-3">
          <input
            className="form-check-input"
            type="checkbox"
            required={c.required}
            checked={!!formValues[fieldKey]}
            onChange={(e) => setFormValues({ ...formValues, [fieldKey]: e.target.checked })}
          />
          <label className="form-check-label small fw-semibold text-dark">{c.label} {c.required && <span className="text-danger">*</span>}</label>
        </div>
      );
    }
    case "switch-input": {
      const fieldKey = c.fieldName || comp.id;
      return (
        <div className="w-100 text-start form-check form-switch px-2 py-1 ms-3">
          <input
            className="form-check-input"
            type="checkbox"
            checked={!!formValues[fieldKey]}
            onChange={(e) => setFormValues({ ...formValues, [fieldKey]: e.target.checked })}
          />
          <label className="form-check-label small fw-semibold text-dark">{c.label}</label>
        </div>
      );
    }
    case "slider-input": {
      const fieldKey = c.fieldName || comp.id;
      return (
        <div className="w-100 text-start px-2 py-1">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <label className="form-label small fw-bold text-dark mb-0">{c.label}</label>
            <span className="small text-muted">{formValues[fieldKey] || c.min || 0} (Range: {c.min || 0} - {c.max || 100})</span>
          </div>
          <input
            type="range"
            className="form-range"
            min={c.min}
            max={c.max}
            value={formValues[fieldKey] || c.min || 0}
            onChange={(e) => setFormValues({ ...formValues, [fieldKey]: e.target.value })}
          />
        </div>
      );
    }
    case "rating-input": {
      const fieldKey = c.fieldName || comp.id;
      const maxStars = c.maxStars || 5;
      const rating = formValues[fieldKey] || 0;
      return (
        <div className="w-100 text-start px-2 py-1">
          <label className="form-label small fw-bold text-dark d-block mb-1">{c.label}</label>
          <div className="d-flex gap-1 text-warning fs-5">
            {Array.from({ length: maxStars }).map((_, idx) => {
              const starVal = idx + 1;
              return (
                <i
                  key={idx}
                  className={`bi cursor-pointer ${starVal <= rating ? "bi-star-fill" : "bi-star"}`}
                  onClick={() => setFormValues({ ...formValues, [fieldKey]: starVal })}
                ></i>
              );
            })}
          </div>
        </div>
      );
    }

    case "divider": {
      return (
        <div className="container py-2">
          <hr style={{
            borderColor: c.color || "#cbd5e1",
            borderWidth: c.thickness || "2px",
            width: c.width || "100%",
            margin: "0 auto",
            opacity: 1
          }} />
        </div>
      );
    }

    case "spacer": {
      return <div style={{ height: c.height || "40px" }} />;
    }

    case "icon": {
      const iconEl = (
        <i className={`bi ${c.iconClass || "bi-star-fill"}`} style={{ color: c.color || "#2249b7", fontSize: c.size || "40px" }}></i>
      );
      return (
        <div className="container py-2" style={{ textAlign: c.align || "left" }}>
          {c.linkUrl ? <a href={c.linkUrl}>{iconEl}</a> : iconEl}
        </div>
      );
    }

    case "social-icons": {
      const iconStyle = { color: c.iconColor || "#475569", fontSize: c.iconSize || "24px", textDecoration: "none" };
      return (
        <div className="container py-3" style={{ textAlign: c.align || "center" }}>
          <div className="d-inline-flex gap-4">
            {c.facebook && <a href={c.facebook} target="_blank" rel="noopener noreferrer" style={iconStyle}><i className="bi bi-facebook"></i></a>}
            {c.instagram && <a href={c.instagram} target="_blank" rel="noopener noreferrer" style={iconStyle}><i className="bi bi-instagram"></i></a>}
            {c.linkedin && <a href={c.linkedin} target="_blank" rel="noopener noreferrer" style={iconStyle}><i className="bi bi-linkedin"></i></a>}
            {c.whatsapp && <a href={c.whatsapp} target="_blank" rel="noopener noreferrer" style={iconStyle}><i className="bi bi-whatsapp"></i></a>}
            {c.twitter && <a href={c.twitter} target="_blank" rel="noopener noreferrer" style={iconStyle}><i className="bi bi-twitter"></i></a>}
          </div>
        </div>
      );
    }

    case "form-container": {
      return (
        <div className="container py-5" id="contact-form">
          <div className="card border-0 shadow-lg p-4 p-md-5 mx-auto bg-white" style={{ maxWidth: "600px", borderRadius: theme.borderRadius }}>
            <h3 className="fw-bold mb-2 text-center text-dark">{c.title}</h3>
            {c.subtitle && <p className="text-muted text-center small mb-4">{c.subtitle}</p>}

            {c.formType === "enquiry_form" && c.enquiryFormId ? (
              <PublicEnquiryFormEmbed formId={c.enquiryFormId} theme={theme} />
            ) : (
              <SimpleInquiryForm submitColor={theme.primaryColor} submitText={c.submitButtonText || "Submit"} borderRadius={theme.borderRadius} />
            )}
          </div>
        </div>
      );
    }

    case "payment-form": {
      return (
        <div className="container py-5 text-start">
          <div className="card border-0 shadow-lg p-4 p-md-5 mx-auto bg-white" style={{ maxWidth: "550px", borderRadius: "16px" }}>
            <h4 className="fw-bold text-dark text-center mb-1">{c.title}</h4>
            <p className="text-muted small text-center mb-4">{c.subtitle}</p>

            <div className="p-3.5 rounded-3 mb-4 d-flex justify-content-between align-items-center" style={{ background: "#f8fafc", border: "1px solid #cbd5e1" }}>
              <div>
                <span className="text-dark small fw-bold d-block">{c.itemName}</span>
                <span className="text-muted small" style={{ fontSize: "11px" }}>Secure payment link</span>
              </div>
              <h3 className="fw-bold mb-0 text-success">{c.priceText}</h3>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); showNotice("Mock Payment successful!"); }} className="d-flex flex-column gap-3">
              <div>
                <label className="form-label small text-dark mb-1">Card Holder Name</label>
                <input type="text" className="form-control" placeholder="Jane Doe" required />
              </div>
              <div>
                <label className="form-label small text-dark mb-1">Card Details</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-credit-card"></i></span>
                  <input type="text" className="form-control" placeholder="4111 2222 3333 4444" required />
                </div>
              </div>
              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label small text-dark mb-1">Expiry</label>
                  <input type="text" className="form-control" placeholder="MM/YY" required />
                </div>
                <div className="col-6">
                  <label className="form-label small text-dark mb-1">CVV</label>
                  <input type="text" className="form-control" placeholder="123" required />
                </div>
              </div>
              <button type="submit" className="btn text-white w-100 mt-3 fw-bold btn-lg py-2.5" style={{ background: theme.primaryColor, borderRadius: theme.borderRadius }}>
                <i className="bi bi-shield-lock-fill me-2"></i> {c.buttonText || "Pay Now"}
              </button>
              <div className="d-flex justify-content-center align-items-center gap-3 mt-3 text-muted small" style={{ fontSize: "11px" }}>
                <span><i className="bi bi-lock-fill text-success me-1"></i> SECURE SSL</span>
                <span><i className="bi bi-patch-check-fill text-success me-1"></i> PCI COMPLIANT</span>
              </div>
            </form>
          </div>
        </div>
      );
    }

    case "iframe": {
      return (
        <div className="container py-3 text-center">
          {c.iframeUrl && (
            <div className="shadow-lg rounded border overflow-hidden" style={{ height: c.height || "600px", width: c.width || "100%" }}>
              <iframe src={c.iframeUrl} width="100%" height="100%" style={{ border: 0 }} allowFullScreen="" title="iframe-embed"></iframe>
            </div>
          )}
        </div>
      );
    }

    case "features": {
      return (
        <div className="container py-5 text-center">
          {c.title && <h2 className="fw-bold mb-5 display-6">{c.title}</h2>}
          <div className="row g-4">
            {(c.items || []).map((item, idx) => (
              <div className="col-md-4" key={idx}>
                <div className="card h-100 p-4 border-0 shadow-sm bg-white" style={{ borderRadius: theme.borderRadius }}>
                  <div className="d-inline-flex align-items-center justify-content-center p-3 mb-3 bg-light rounded-circle mx-auto" style={{ width: "60px", height: "60px" }}>
                    <i className={`bi ${item.icon || "bi-star"} fs-3`} style={{ color: theme.primaryColor }}></i>
                  </div>
                  <h4 className="fw-bold text-dark mb-2">{item.title}</h4>
                  <p className="text-muted small mb-0">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "testimonials": {
      return (
        <div className="container py-5 text-center">
          <h2 className="fw-bold display-6 mb-5">{c.title || "Testimonials"}</h2>
          <div className="row g-4 justify-content-center">
            {(c.items || []).map((item, idx) => (
              <div className="col-md-5" key={idx}>
                <div className="card h-100 p-4 border-0 shadow-sm text-start bg-white" style={{ borderRadius: theme.borderRadius }}>
                  <p className="text-muted italic mb-4" style={{ fontSize: "1.05rem", lineHeight: "1.6" }}>"{item.text}"</p>
                  <div className="d-flex align-items-center gap-3">
                    <img src={item.photo} alt={item.name} className="rounded-circle border" style={{ width: "48px", height: "48px", objectFit: "cover" }} />
                    <div>
                      <h6 className="fw-bold mb-0 text-dark">{item.name}</h6>
                      <span className="text-muted small">{item.role}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "faq": {
      return (
        <div className="container py-5 text-start" style={{ maxWidth: "800px" }}>
          <h2 className="fw-bold display-6 mb-5 text-center">{c.title}</h2>
          <div className="accordion d-flex flex-column gap-3">
            {(c.items || []).map((item, idx) => (
              <div className="card border p-4 shadow-sm" key={idx} style={{ borderRadius: theme.borderRadius, background: "#ffffff" }}>
                <h5 className="fw-bold mb-2 text-dark d-flex gap-2 align-items-center">
                  <i className="bi bi-patch-question-fill" style={{ color: theme.primaryColor }}></i>
                  {item.q}
                </h5>
                <p className="text-muted mb-0 ps-4" style={{ lineHeight: "1.6" }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "pricing": {
      return (
        <div className="container py-5 text-center">
          <h2 className="fw-bold display-6 mb-5">{c.title}</h2>
          <div className="row g-4 justify-content-center align-items-stretch">
            {(c.items || []).map((item, idx) => (
              <div className="col-md-4" key={idx}>
                <div className={`card h-100 p-4 p-md-5 border bg-white d-flex flex-column ${item.highlight ? "border-2 shadow-lg" : "border-1"}`}
                  style={{
                    borderRadius: theme.borderRadius,
                    borderColor: item.highlight ? theme.primaryColor : "#e2e8f0"
                  }}>
                  {item.highlight && <span className="badge text-white px-4 py-2 mb-3 rounded-pill align-self-center" style={{ background: theme.primaryColor, fontSize: "11px", letterSpacing: "1px" }}>RECOMMENDED</span>}
                  <h3 className="fw-bold text-dark">{item.name}</h3>
                  <div className="my-4">
                    <span className="display-5 fw-bold text-dark">{item.price}</span>
                    <span className="text-muted"> / {item.period}</span>
                  </div>
                  <ul className="list-unstyled text-muted small my-4 text-start flex-grow-1">
                    {(item.features || []).map((f, i) => (
                      <li className="mb-3 d-flex align-items-start" key={i}>
                        <i className="bi bi-check-circle-fill text-success me-3 mt-1"></i>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button className="btn w-100 py-2.5 fw-bold btn-lg mt-auto" style={{ background: item.highlight ? theme.primaryColor : "transparent", color: item.highlight ? "#fff" : theme.primaryColor, border: `1.5px solid ${theme.primaryColor}`, borderRadius: theme.borderRadius }}>
                    {item.buttonText}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "footer": {
      if (pType === "type2") {
        return (
          <footer className="w-100 bg-dark text-light py-5 px-4" style={{ background: "#0f172a" }}>
            <div className="container text-start">
              <div className="row g-4">
                <div className="col-md-4">
                  <h6 className="fw-bold text-uppercase text-white mb-3">{c.brandName || "Acme Academy"}</h6>
                  <p className="small text-muted" style={{ opacity: 0.7 }}>Empowering generations through high-quality visual inquiry based modern teaching frameworks.</p>
                </div>
                <div className="col-md-4">
                  <h6 className="fw-bold text-uppercase text-white mb-3">Core Programs</h6>
                  <ul className="list-unstyled small text-muted d-flex flex-column gap-1">
                    <li>Early Years Curriculum</li>
                    <li>Primary Academy</li>
                    <li>High School Science & STEM</li>
                  </ul>
                </div>
                <div className="col-md-4">
                  <h6 className="fw-bold text-uppercase text-white mb-3">Contact Support</h6>
                  <div className="small text-muted">{c.address}</div>
                  <div className="small text-muted mt-2">{c.phone} | {c.email}</div>
                </div>
              </div>
              <div className="border-top border-secondary pt-3 mt-4 text-center small text-muted">
                {c.copyright}
              </div>
            </div>
          </footer>
        );
      } else if (pType === "type3") {
        return (
          <footer className="w-100 bg-light text-dark py-4 px-4 border-top">
            <div className="container">
              <div className="row g-4 align-items-center justify-content-between text-start">
                <div className="col-md-5">
                  <h5 className="fw-bold text-dark mb-1">Stay updated with admissions</h5>
                  <p className="text-muted small mb-0">Subscribe to our monthly newsletters and events tracker.</p>
                </div>
                <div className="col-md-6">
                  <form onSubmit={(e) => { e.preventDefault(); showNotice("Subscribed successfully!"); }} className="input-group">
                    <input type="email" className="form-control" placeholder="Enter email address" required />
                    <button type="submit" className="btn btn-primary text-white" style={{ background: theme.primaryColor }}>Subscribe</button>
                  </form>
                </div>
              </div>
              <div className="border-top mt-4 pt-3 text-center small text-muted">
                {c.copyright}
              </div>
            </div>
          </footer>
        );
      } else if (pType === "type4") {
        return (
          <footer className="w-100 text-light py-5 px-4" style={{ background: "#111827" }}>
            <div className="container text-start">
              <div className="row g-4">
                <div className="col-md-6">
                  <h5 className="fw-bold mb-3 text-white">Find Us on Campus</h5>
                  <div className="rounded overflow-hidden shadow" style={{ height: "200px" }}>
                    <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3508.8354084534726!2d77.38722421507797!3d28.484551982476563!2m3!1f0!2f0!3f0!3m2!1i1024!2i769!3f0!3m2!1i1024!2i769!3f0!3m2!1i1012!2i1089!3m2!1a100!2f0!3f0!3m2!1d28.484552!2d77.3894129" width="100%" height="100%" style={{ border: 0 }} allowFullScreen="" loading="lazy"></iframe>
                  </div>
                </div>
                <div className="col-md-6 d-flex flex-column justify-content-between">
                  <div>
                    <h5 className="fw-bold text-white mb-2">Acme Offices</h5>
                    <p className="small text-muted">{c.address}</p>
                    <p className="small text-muted"><i className="bi bi-telephone-fill text-wa me-2"></i> {c.phone}</p>
                  </div>
                  <div className="small text-muted mt-3">{c.copyright}</div>
                </div>
              </div>
            </div>
          </footer>
        );
      } else if (pType === "type5") {
        return (
          <footer className="w-100 py-5 bg-white border-top text-center">
            <a href={c.logoLink || c.logoUrlLink || "#"} target={(c.logoLink || c.logoUrlLink || "").startsWith("http") ? "_blank" : "_self"} rel="noopener noreferrer" style={{ display: "inline-block", textDecoration: "none" }}>
              <img src={c.logoUrl || "https://clarwynschool.com/wp-content/themes/astra/assets/images/logo.png"} alt="Logo" className="mb-3 animate-bounce" style={{ maxHeight: "50px", animationDuration: "3s" }} />
            </a>
            <p className="small text-muted max-w-sm mx-auto mb-4">{c.address}</p>
            <div className="d-flex justify-content-center gap-4 mb-4">
              <a href="#" className="text-muted fs-4"><i className="bi bi-facebook"></i></a>
              <a href="#" className="text-muted fs-4"><i className="bi bi-instagram"></i></a>
              <a href="#" className="text-muted fs-4"><i className="bi bi-whatsapp"></i></a>
            </div>
            <div className="small text-muted font-semibold">{c.copyright}</div>
          </footer>
        );
      }

      // Default Style 1: Standard Minimal Row
      return (
        <footer className="container py-5 text-center">
          <div className="row g-4 justify-content-between text-md-start mb-4">
            <div className="col-md-6">
              <p className="mb-0" style={{ opacity: 0.85 }}><i className="bi bi-geo-alt-fill me-3" style={{ color: theme.primaryColor }}></i>{c.address}</p>
            </div>
            <div className="col-md-6 text-md-end">
              <p className="mb-2" style={{ opacity: 0.85 }}><i className="bi bi-telephone-fill me-3" style={{ color: theme.primaryColor }}></i>{c.phone}</p>
              <p className="mb-0" style={{ opacity: 0.85 }}><i className="bi bi-envelope-fill me-3" style={{ color: theme.primaryColor }}></i>{c.email}</p>
            </div>
          </div>
          <div className="border-top pt-4 text-center small text-muted">
            {c.copyright}
          </div>
        </footer>
      );
    }

    default:
      return null;
  }
}

function SimpleInquiryForm({ submitColor, submitText, borderRadius }) {
  const { pageId } = useParams();
  const [vals, setVals] = useState({ name: "", email: "", phone: "", msg: "" });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vals.name || !vals.phone) {
      setError("Name and Phone number are required.");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      await publicApi.submitLandingEnquiry(pageId, {
        studentName: vals.name,
        emailId: vals.email,
        mobileNumber: vals.phone,
        message: vals.msg
      });
      setSuccess(true);
      setVals({ name: "", email: "", phone: "", msg: "" });
    } catch (e) {
      setError(e.message || "Failed to submit inquiry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-4 text-success">
        <i className="bi bi-check-circle-fill display-5 mb-2"></i>
        <h5>Thank you!</h5>
        <p className="mb-0">Your inquiry has been successfully received. We will contact you soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="d-flex flex-column gap-3 text-start">
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <div>
        <label className="form-label small text-dark">Full Name <span className="text-danger">*</span></label>
        <input
          type="text"
          className="form-control"
          placeholder="Enter your name"
          required
          value={vals.name}
          onChange={(e) => setVals((v) => ({ ...v, name: e.target.value }))}
        />
      </div>
      <div className="row g-2">
        <div className="col-6">
          <label className="form-label small text-dark">Email Address</label>
          <input
            type="email"
            className="form-control"
            placeholder="name@example.com"
            value={vals.email}
            onChange={(e) => setVals((v) => ({ ...v, email: e.target.value }))}
          />
        </div>
        <div className="col-6">
          <label className="form-label small text-dark">Phone Number <span className="text-danger">*</span></label>
          <input
            type="tel"
            className="form-control"
            placeholder="+91"
            required
            value={vals.phone}
            onChange={(e) => setVals((v) => ({ ...v, phone: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <label className="form-label small text-dark">Message / Inquiry Details</label>
        <textarea
          className="form-control"
          rows={3}
          placeholder="Add comments or query detail..."
          value={vals.msg}
          onChange={(e) => setVals((v) => ({ ...v, msg: e.target.value }))}
        />
      </div>
      <button
        type="submit"
        className="btn text-white w-100 mt-2 fw-semibold btn-lg"
        style={{ background: submitColor, borderRadius: borderRadius }}
        disabled={submitting}
      >
        {submitting ? "Submitting..." : submitText || "Submit Inquiry"}
      </button>
    </form>
  );
}

function PublicEnquiryFormEmbed({ formId, theme }) {
  const [formConfig, setFormConfig] = useState(null);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadForm() {
      try {
        setLoading(true);
        const res = await publicApi.getEnquiryForm(formId);
        const payload = res?.data?.form || res?.form || null;
        setFormConfig(payload);

        const initial = {};
        (payload?.fields || []).forEach((field) => {
          initial[field.fieldName || field.label] = field.defaultValue || "";
        });
        setValues(initial);
      } catch (e) {
        setError("Unable to load embedded enquiry form.");
      } finally {
        setLoading(false);
      }
    }
    if (formId) loadForm();
  }, [formId]);

  const visibleFields = useMemo(() => (formConfig?.fields || []).filter((f) => f.selected && !f.hidden), [formConfig]);

  const handleChange = (fieldName, value) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      setSuccess("");
      await publicApi.submitEnquiryForm(formId, values);
      setSuccess("Your enquiry has been received. We will contact you shortly.");
      setValues({});
    } catch (e) {
      setError(e.message || "Unable to submit form.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center p-3 text-muted"><Spinner label="Loading form..." /></div>;
  if (error || !formConfig) return <div className="alert alert-danger py-2 small">{error || "Form unavailable."}</div>;

  if (success) {
    return (
      <div className="text-center py-4 text-success">
        <i className="bi bi-check-circle-fill display-5 mb-2"></i>
        <h5>Thank you!</h5>
        <p className="mb-0">{success}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="d-flex flex-column gap-3 text-start">
      <h4 className="fw-semibold text-center text-dark mb-1">{formConfig.heading}</h4>
      {formConfig.tagline && <p className="text-muted text-center small mb-4">{formConfig.tagline}</p>}

      <div className="row g-3">
        {visibleFields.map((field) => {
          const isFullWidth = field.column !== 1;
          const colClass = isFullWidth ? "col-12" : "col-md-6";

          return (
            <div className={colClass} key={field.fieldName}>
              <label className="form-label small text-dark">
                {field.label} {field.isRequired && <span className="text-danger">*</span>}
              </label>

              {field.fieldType === "textarea" ? (
                <textarea
                  className="form-control"
                  rows={3}
                  required={field.isRequired}
                  value={values[field.fieldName] || ""}
                  onChange={(e) => handleChange(field.fieldName, e.target.value)}
                />
              ) : field.fieldType === "select" ? (
                <select
                  className="form-select"
                  required={field.isRequired}
                  value={values[field.fieldName] || ""}
                  onChange={(e) => handleChange(field.fieldName, e.target.value)}
                >
                  <option value="">-- Select --</option>
                  {(typeof field.options === "string"
                    ? field.options.split(",").map(o => o.trim()).filter(Boolean)
                    : (Array.isArray(field.options) ? field.options : [])
                  ).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.fieldType === "checkbox" ? (
                <div className="form-check pt-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id={`embed-${field.fieldName}`}
                    required={field.isRequired}
                    checked={!!values[field.fieldName]}
                    onChange={(e) => handleChange(field.fieldName, e.target.checked)}
                  />
                  <label className="form-check-label small text-dark text-muted" htmlFor={`embed-${field.fieldName}`}>
                    I agree to terms
                  </label>
                </div>
              ) : (
                <input
                  type={field.fieldType || "text"}
                  className="form-control"
                  required={field.isRequired}
                  value={values[field.fieldName] || ""}
                  onChange={(e) => handleChange(field.fieldName, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>

      <button
        type="submit"
        className="btn text-white w-100 mt-4 fw-semibold btn-lg"
        style={{
          background: formConfig.buttonColor || theme.primaryColor,
          borderRadius: theme.borderRadius
        }}
        disabled={submitting}
      >
        {submitting ? "Submitting..." : formConfig.submitText || "Submit Inquiry"}
      </button>
    </form>
  );
}

function renderDynamicWizardForm(c, theme, textClass = "", inputClass = "") {
  const formType = c.content?.wizardFormType || c.wizardFormType || "enquiry";

  switch (formType) {
    case "registration":
      return (
        <form className="d-flex flex-column gap-2 mt-2 text-start" onSubmit={(e) => { e.preventDefault(); showNotice("Registration completed successfully!"); }}>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Parent Name</label>
            <input type="text" className={`form-control form-control-sm ${inputClass}`} placeholder="Enter full name" required />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Mobile Number</label>
            <input type="tel" className={`form-control form-control-sm ${inputClass}`} placeholder="+91 9XXXXXXXXX" required />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Email Address</label>
            <input type="email" className={`form-control form-control-sm ${inputClass}`} placeholder="name@email.com" required />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Grade applying for</label>
            <select className={`form-select form-select-sm ${inputClass}`} required>
              <option value="">-- Choose Grade --</option>
              <option>Preschool / Kindergarten</option>
              <option>Primary Grades (1-5)</option>
              <option>Middle School (6-8)</option>
              <option>High School (9-12)</option>
            </select>
          </div>
          <button className="btn btn-sm text-white fw-bold mt-2" style={{ background: theme.primaryColor }}>Complete Registration</button>
        </form>
      );
    case "application":
    case "admission":
      return (
        <form className="d-flex flex-column gap-2 mt-2 text-start" onSubmit={(e) => { e.preventDefault(); showNotice("Application submitted successfully!"); }}>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Student Name</label>
            <input type="text" className={`form-control form-control-sm ${inputClass}`} placeholder="Enter full name" required />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Mobile Number</label>
            <input type="tel" className={`form-control form-control-sm ${inputClass}`} placeholder="+91 9XXXXXXXXX" required />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Email Address</label>
            <input type="email" className={`form-control form-control-sm ${inputClass}`} placeholder="name@school.com" required />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Grade Applying For</label>
            <select className={`form-select form-select-sm ${inputClass}`} required>
              <option value="">-- Choose Grade --</option>
              <option>Preschool / Nursery</option>
              <option>Primary School</option>
              <option>Secondary School</option>
            </select>
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Upload Transfer Certificate</label>
            <input type="file" className={`form-control form-control-sm ${inputClass}`} required />
          </div>
          <button className="btn btn-sm text-white fw-bold mt-2" style={{ background: theme.primaryColor }}>Submit Application</button>
        </form>
      );
    case "payment":
      return (
        <form className="d-flex flex-column gap-2 mt-2 text-start" onSubmit={(e) => { e.preventDefault(); showNotice("Tuition fee estimation calculated!"); }}>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Candidate Name</label>
            <input type="text" className={`form-control form-control-sm ${inputClass}`} placeholder="Enter candidate name" required />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Fee Split Installments (Months)</label>
            <input type="range" className="form-range" min="1" max="12" />
            <div className={`d-flex justify-content-between ${textClass}`} style={{ fontSize: "8px" }}><span>1 Month</span><span>6 Months</span><span>12 Months</span></div>
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Payment Method</label>
            <select className={`form-select form-select-sm ${inputClass}`} required>
              <option>Credit / Debit Card</option>
              <option>UPI / PhonePe / GPay</option>
              <option>Netbanking</option>
            </select>
          </div>
          <button className="btn btn-sm text-white fw-bold mt-2" style={{ background: theme.primaryColor }}>Pay & Estimate Fees</button>
        </form>
      );
    case "feedback":
      return (
        <form className="d-flex flex-column gap-2 mt-2 text-start" onSubmit={(e) => { e.preventDefault(); showNotice("Feedback submitted successfully!"); }}>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Full Name</label>
            <input type="text" className={`form-control form-control-sm ${inputClass}`} placeholder="Enter name" required />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 d-block ${textClass}`} style={{ fontSize: "9px" }}>Overall Experience Rating</label>
            <div className="text-warning fs-5">★ ★ ★ ★ ☆</div>
          </div>
          <div className="form-check form-switch mt-1">
            <input className="form-check-input" type="checkbox" defaultChecked />
            <label className={`form-check-label ${textClass}`} style={{ fontSize: "9px" }}>Subscribe to newsletter</label>
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Detailed Review / Comments</label>
            <textarea className={`form-control form-control-sm ${inputClass}`} rows={2} placeholder="Write details here" required />
          </div>
          <button className="btn btn-sm text-white fw-bold mt-2" style={{ background: theme.primaryColor }}>Submit Feedback</button>
        </form>
      );
    case "consent":
      return (
        <form className="d-flex flex-column gap-2 mt-2 text-start" onSubmit={(e) => { e.preventDefault(); showNotice("Consent form recorded successfully!"); }}>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Parent / Guardian Name</label>
            <input type="text" className={`form-control form-control-sm ${inputClass}`} placeholder="Enter full name" required />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Child Name</label>
            <input type="text" className={`form-control form-control-sm ${inputClass}`} placeholder="Enter student name" required />
          </div>
          <div className="form-check mt-1 text-start">
            <input className="form-check-input" type="checkbox" required />
            <label className={`form-check-label ${textClass}`} style={{ fontSize: "9px" }}>Consent for school media publication</label>
          </div>
          <div className="form-check mt-1 text-start">
            <input className="form-check-input" type="checkbox" required />
            <label className={`form-check-label ${textClass}`} style={{ fontSize: "9px" }}>Agree to medical release policy</label>
          </div>
          <div className="form-check mt-1 text-start">
            <input className="form-check-input" type="checkbox" required />
            <label className={`form-check-label ${textClass}`} style={{ fontSize: "9px" }}>Agree to standard terms & conditions</label>
          </div>
          <button className="btn btn-sm text-white fw-bold mt-2" style={{ background: theme.primaryColor }}>Submit Consent Form</button>
        </form>
      );
    case "enquiry":
    default:
      return (
        <form className="d-flex flex-column gap-2 mt-2 text-start" onSubmit={(e) => { e.preventDefault(); showNotice("Enquiry submitted successfully!"); }}>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Full Name</label>
            <input type="text" className={`form-control form-control-sm ${inputClass}`} placeholder="Enter full name" required />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Mobile Number</label>
            <input type="tel" className={`form-control form-control-sm ${inputClass}`} placeholder="+91 9XXXXXXXXX" required />
          </div>
          <div>
            <label className={`fw-bold mb-0.5 ${textClass}`} style={{ fontSize: "9px" }}>Enquiry Details</label>
            <textarea className={`form-control form-control-sm ${inputClass}`} rows={2} placeholder="Write your requirements here" required />
          </div>
          <button className="btn btn-sm text-white fw-bold mt-2" style={{ background: theme.primaryColor }}>Submit Enquiry</button>
        </form>
      );
  }
}
