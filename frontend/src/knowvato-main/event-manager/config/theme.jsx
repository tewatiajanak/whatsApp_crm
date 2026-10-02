import { appStore } from "../../../api/appStore";
const THEMES = {
  "clean-slate": {
    primary: "#0085A8",
    primaryForeground: "#ffffff",
    background: "#F7FBFE",
    surface: "#FFFFFF",
    foreground: "#40474D",
    pill: "#E8EFF5",
    pillText: "#40474D",
    tabTrack: "#EBF2F8",
  },
  "unified-hub": {
    primary: "#0891b2",
    primaryForeground: "#ffffff",
    background: "#0f172a",
    surface: "#1a1f2e",
    foreground: "#f1f5f9",
    pill: "#1e293b",
    pillText: "#e2e8f0",
    tabTrack: "#334155",
  },
  "qrcode-generator": {
    primary: "#a855f7",
    primaryForeground: "#ffffff",
    background: "#f8fafc",
    surface: "#ffffff",
    foreground: "#1e1b4b",
    pill: "#f3e8ff",
    pillText: "#6b21a8",
    tabTrack: "#ede9fe",
  },
};

const STORAGE_KEY = "app_theme";

export function getTheme() {
  if (typeof window === "undefined") return "clean-slate";
  const stored = appStore.getItem(STORAGE_KEY);
  return stored || "clean-slate";
}

export function applyTheme(themeName = null) {
  if (typeof window === "undefined") return;

  const theme = themeName || getTheme();
  const themeConfig = THEMES[theme];

  if (!themeConfig) return;

  // Apply CSS custom properties
  const root = document.documentElement;
  Object.entries(themeConfig).forEach(([key, value]) => {
    root.style.setProperty(`--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`, value);
  });

  // Set theme attribute for CSS selectors
  root.setAttribute("data-theme", theme);

  // Store theme preference
  appStore.setItem(STORAGE_KEY, theme);

  // Dispatch event for other components to listen
  window.dispatchEvent(new CustomEvent("theme-changed", { detail: { theme, config: themeConfig } }));
}

export function initTheme() {
  const theme = getTheme();
  applyTheme(theme);

  // Listen for theme changes from unified-hub
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        applyTheme(e.newValue);
      }
    });

    window.addEventListener("theme-changed", (e) => {
      if (e.detail && e.detail.theme) {
        applyTheme(e.detail.theme);
      }
    });
  }
}

export { THEMES };
