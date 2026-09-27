import React, { createContext, useContext, useState, useEffect, useMemo } from "react";

export const PRESETS = {
  original: {
    name: "Indigo Classic",
    accent: "#4f46e5",
    accentHover: "#4338ca",
    pageBg: "#f8fafc",
    border: "#e2e8f0",
    cardBg: "#ffffff",
    headingText: "#0f172a",
    textColor: "#475569",
    activeStyle: "light",
    radius: "12",
    shadowKey: "subtle",
    clickScale: "0.9",
    buttonStyle: "normal",
    font: "'Inter', sans-serif",
  },
  corporate: {
    name: "Corporate Blue",
    accent: "#1e3a8a",
    accentHover: "#1e40af",
    pageBg: "#f3f5f9",
    border: "#e5e9f0",
    cardBg: "#ffffff",
    headingText: "#0f172a",
    textColor: "#475569",
    activeStyle: "solid",
    radius: "12",
    shadowKey: "medium",
    clickScale: "0.9",
    buttonStyle: "normal",
    font: "'Inter', sans-serif",
  },
  emerald: {
    name: "Emerald Finance",
    accent: "#047857",
    accentHover: "#065f46",
    pageBg: "#f7fdfa",
    border: "#e2e8f0",
    cardBg: "#ffffff",
    headingText: "#0f172a",
    textColor: "#475569",
    activeStyle: "light",
    radius: "10",
    shadowKey: "subtle",
    clickScale: "0.9",
    buttonStyle: "sleek",
    font: "'Inter', sans-serif",
  },
  graphite: {
    name: "Graphite Minimal",
    accent: "#18181b",
    accentHover: "#27272a",
    pageBg: "#fafafa",
    border: "#e4e4e7",
    cardBg: "#ffffff",
    headingText: "#0f172a",
    textColor: "#475569",
    activeStyle: "solid",
    radius: "6",
    shadowKey: "subtle",
    clickScale: "0.9",
    buttonStyle: "sleek",
    font: "'Inter', sans-serif",
  },
};

export const SHADOW_MAP = {
  none: "none",
  subtle: "0 1px 2px rgba(0,0,0,.04)",
  medium: "0 1px 3px rgba(0,0,0,.08), 0 4px 12px rgba(0,0,0,.05)",
  strong: "0 2px 6px rgba(0,0,0,.12), 0 10px 28px rgba(0,0,0,.10)",
};

export const BUTTON_STYLES = {
  normal: {
    padY: "0.6rem",
    padX: "1.1rem",
    fontWeight: "500",
    fontSize: "0.875rem",
    letterSpacing: "0",
    border: "1px solid transparent",
  },
  sleek: {
    padY: "0.5rem",
    padX: "1rem",
    fontWeight: "600",
    fontSize: "0.8rem",
    letterSpacing: "0.02em",
    border: "1px solid rgba(255,255,255,0.15)",
  },
};

export const MAX_CUSTOM_THEMES = 3;

function hexToRgb(hex) {
  const clean = (hex || "#000000").replace("#", "");
  const n = parseInt(clean.length === 6 ? clean : "000000", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(hex, target, amount) {
  const c = hexToRgb(hex);
  const r = Math.round(c.r + (target.r - c.r) * amount);
  const g = Math.round(c.g + (target.g - c.g) * amount);
  const b = Math.round(c.b + (target.b - c.b) * amount);
  return `rgb(${r}, ${g}, ${b})`;
}

export function buildVars(cfg) {
  const accentSurface = "#E2ECEB";
  const btn = BUTTON_STYLES[cfg.buttonStyle] || BUTTON_STYLES.normal;
  const radiusRaw = String(cfg.radius || "0.55rem");
  const radiusUnit = radiusRaw.includes("rem") ? "rem" : "px";
  const radiusValue = parseFloat(radiusRaw.replace(/rem|px/g, "")) || 0.55;
  const shadowVal = SHADOW_MAP[cfg.shadowKey] || SHADOW_MAP.subtle;

  return {
    "--accent": "#E2ECEB",
    "--accent-hover": "#D9E7E5",
    "--accent-surface": "#E2ECEB",
    "--accent-soft": "#E2ECEB",
    "--accent-foreground": "#286663",
    "--page-bg": cfg.pageBg,
    "--background": cfg.pageBg,
    "--active-bg": cfg.activeStyle === "solid" ? cfg.accent : accentSurface,
    "--active-text": cfg.activeStyle === "solid" ? "#ffffff" : "#286663",
    "--active-border": cfg.activeStyle === "solid" ? "transparent" : cfg.accent,
    "--btn-dark": cfg.accent,
    "--btn-dark-hover": cfg.accentHover,
    "--toggle-bg": cfg.accent,
    "--card-radius": `${radiusValue}${radiusUnit}`,
    "--radius": `${radiusValue}${radiusUnit}`,
    "--radius-md": `${Math.max(0.4, radiusValue - 0.05)}${radiusUnit}`,
    "--radius-sm": `${Math.max(0.35, radiusValue - 0.1)}${radiusUnit}`,
    "--radius-xs": `${Math.max(0.3, radiusValue - 0.15)}${radiusUnit}`,
    "--btn-radius": `${radiusValue}${radiusUnit}`,
    "--logo-shape": `${radiusValue}${radiusUnit}`,
    "--card-shadow": shadowVal,
    "--shadow-sm": shadowVal,
    "--card-border": cfg.border,
    "--border": cfg.border,
    "--border-2": cfg.border,
    "--surface-bg": cfg.cardBg,
    "--surface": cfg.cardBg,
    "--heading-text": cfg.headingText,
    "--text": cfg.headingText,
    "--body-text": cfg.textColor,
    "--text-2": cfg.textColor,
    "--click-scale": cfg.clickScale,
    "--btn-pad-y": btn.padY,
    "--btn-pad-x": btn.padX,
    "--btn-font-weight": btn.fontWeight,
    "--btn-font-size": btn.fontSize,
    "--btn-letter-spacing": btn.letterSpacing,
    "--btn-border": btn.border,
    "--primary": cfg.accent,
    "--primary-foreground": "#FAFDFD",
    "--sidebar-primary": cfg.accent,
    "--sidebar-accent": "#E2ECEB",
    "--sidebar-accent-foreground": "#286663",
    "font-family": cfg.font,
    "fontFamily": cfg.font,
  };
}

export function applyThemeToDocument(cfg) {
  if (!cfg) return;
  const vars = buildVars(cfg);
  const root = document.documentElement;

  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
    document.body.style.setProperty(key, value);
  });

  // Inject or update global style sheet for font family and active scales
  let styleEl = document.getElementById("knowvato-dynamic-theme");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "knowvato-dynamic-theme";
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    *, body, .crm-theme, .app-shell, input, select, textarea, button {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    }
    body, .crm-theme, .app-shell {
      background-color: var(--page-bg) !important;
      color: var(--body-text) !important;
    }
    .page-title, h1, h2, h3, h4, h5, h6, .brand-title, .card-title, .fw-bold, .fw-semibold {
      color: var(--heading-text) !important;
    }
    .btn:active, button:active, [role="button"]:active {
      transform: scale(var(--click-scale, 0.95)) !important;
      transition: transform 0.1s ease !important;
    }
    .btn-wa, .btn-primary, .btn-dark, button[type="submit"], [data-variant="default"] {
      background-color: var(--btn-dark) !important;
      border-color: var(--btn-dark) !important;
      color: #ffffff !important;
      border-radius: var(--btn-radius) !important;
      box-shadow: var(--shadow-sm) !important;
    }
    .btn-wa:hover, .btn-primary:hover, .btn-dark:hover, button[type="submit"]:hover, [data-variant="default"]:hover {
      background-color: var(--btn-dark-hover) !important;
      border-color: var(--btn-dark-hover) !important;
      color: #ffffff !important;
    }
    .btn-outline-secondary, .btn-secondary, .btn-light, [data-variant="outline"], [data-variant="ghost"], [data-variant="secondary"] {
      border: 1px solid var(--border) !important;
      background-color: var(--surface) !important;
      color: var(--heading-text) !important;
      border-radius: var(--btn-radius) !important;
    }
    .btn-outline-secondary:hover, .btn-secondary:hover, .btn-light:hover, [data-variant="outline"]:hover, [data-variant="ghost"]:hover, [data-variant="secondary"]:hover {
      background-color: var(--accent-soft, #f1f5f9) !important;
      color: var(--heading-text, #0f172a) !important;
      border-color: var(--border) !important;
    }
    .card, .table-card, .filter-card, .kpi-card, .modal-content, .offcanvas {
      background-color: var(--surface-bg) !important;
      border: 1px solid var(--card-border) !important;
      border-radius: var(--card-radius) !important;
      box-shadow: var(--card-shadow) !important;
    }
    .text-dark, .text-black, .text-bg-dark, .bg-dark, .bg-black, .border-dark {
      color: var(--heading-text) !important;
      border-color: var(--border) !important;
    }
    .bg-dark, .bg-black {
      background-color: var(--surface-bg) !important;
    }
    .table-responsive, .table {
      border-radius: var(--card-radius) !important;
      overflow: hidden !important;
    }
    .form-control, .form-select, .input-group-text {
      border-radius: var(--radius-sm) !important;
      border-color: var(--border) !important;
      background-color: var(--surface) !important;
      color: var(--body-text) !important;
    }
    .form-control:focus, .form-select:focus, .btn:focus-visible {
      box-shadow: 0 0 0 3px var(--accent-soft) !important;
      border-color: var(--accent) !important;
    }
    .sidebar .nav-link.active {
      background-color: var(--active-bg) !important;
      color: var(--active-text) !important;
      border-radius: var(--radius-sm) !important;
    }
    .topbar {
      background-color: var(--surface-bg) !important;
      border-bottom: 1px solid var(--border) !important;
    }
    .table > thead > tr > th {
      background-color: var(--surface-bg) !important;
      color: var(--muted) !important;
      border-bottom: 1px solid var(--border) !important;
    }
    .table > tbody > tr > td {
      border-bottom: 1px solid var(--border) !important;
      color: var(--body-text) !important;
    }
    .tab-track {
      border-radius: var(--radius-sm) !important;
      background-color: var(--surface) !important;
      border: 1px solid var(--border) !important;
    }
    .tab-track .tab.active, .nav-pills .nav-link.active {
      background-color: var(--btn-dark) !important;
      color: #ffffff !important;
      border-radius: var(--radius-xs) !important;
    }
  `;
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    return localStorage.getItem("knowvato_theme_id") || "original";
  });

  const [customThemes, setCustomThemes] = useState(() => {
    try {
      const saved = localStorage.getItem("knowvato_custom_themes");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const currentConfig = useMemo(() => {
    if (PRESETS[themeId]) return PRESETS[themeId];
    const found = customThemes.find((t) => t.id === themeId);
    return found || PRESETS.original;
  }, [themeId, customThemes]);

  useEffect(() => {
    localStorage.setItem("knowvato_theme_id", themeId);
  }, [themeId]);

  useEffect(() => {
    localStorage.setItem("knowvato_custom_themes", JSON.stringify(customThemes));
  }, [customThemes]);

  useEffect(() => {
    applyThemeToDocument(currentConfig);
  }, [currentConfig]);

  const value = {
    themeId,
    setThemeId,
    customThemes,
    setCustomThemes,
    currentConfig,
    applyThemeToDocument,
    PRESETS,
    MAX_CUSTOM_THEMES,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
