// Website theme: design tokens for a website, compiled to --wb-* CSS variables.
// The builder canvas, the preview and the public site all inject the same compiled CSS.

export const DEFAULT_THEME = {
  schemaVersion: 1,
  colors: {
    primary: "#217E79", primaryContrast: "#FFFFFF", secondary: "#2C5655", accent: "#E2A03F",
    background: "#FFFFFF", surface: "#F7F5F2", text: "#1F2A2E", mutedText: "#5E6E72", border: "#E1DFD7",
  },
  typography: { headingFont: "Playfair Display", bodyFont: "Inter", baseSize: 16, scaleRatio: 1.25, lineHeight: 1.6, headingWeight: 700 },
  spacing: { sectionY: 88, containerMax: 1160, gutter: 24 },
  radius: { sm: 4, md: 8, lg: 16 },
  buttons: { shape: "md", weight: 600, uppercase: false },
  shadow: "soft",
};

export const FONTS = [
  "Inter", "Poppins", "DM Sans", "Manrope", "Nunito", "Open Sans", "Lato", "Montserrat", "Work Sans", "Rubik", "Outfit", "Plus Jakarta Sans",
  "Playfair Display", "Lora", "Merriweather", "Cormorant Garamond", "DM Serif Display", "Fraunces", "Libre Baskerville", "Space Grotesk", "Oswald", "Raleway",
];

const preset = (key, name, c, heading, body, extra = {}) => ({
  key, name,
  theme: {
    ...DEFAULT_THEME,
    colors: { ...DEFAULT_THEME.colors, ...c },
    typography: { ...DEFAULT_THEME.typography, headingFont: heading, bodyFont: body, ...(extra.typography || {}) },
    radius: extra.radius || DEFAULT_THEME.radius,
    buttons: { ...DEFAULT_THEME.buttons, ...(extra.buttons || {}) },
    shadow: extra.shadow || "soft",
  },
});

export const THEME_PRESETS = [
  preset("clean-corporate", "Clean Corporate", { primary: "#1D4ED8", secondary: "#0F172A", accent: "#F59E0B", surface: "#F4F6FB", text: "#0F172A", mutedText: "#55607A", border: "#E2E6EF" }, "Manrope", "Inter"),
  preset("medical-calm", "Medical Calm", { primary: "#0E8FA3", secondary: "#134E5E", accent: "#6CC5B0", surface: "#F1F8F9", text: "#16323A", mutedText: "#56707A", border: "#DCE9EC" }, "Poppins", "Open Sans", { radius: { sm: 6, md: 12, lg: 20 } }),
  preset("warm-restaurant", "Warm Restaurant", { primary: "#B4532A", secondary: "#3B2418", accent: "#E0A458", background: "#FFFBF5", surface: "#F6EDE1", text: "#2B1D14", mutedText: "#6F5B4B", border: "#E8DCCB" }, "Playfair Display", "Lato"),
  preset("bold-agency", "Bold Agency", { primary: "#111111", primaryContrast: "#FFFFFF", secondary: "#FF4D2E", accent: "#FF4D2E", surface: "#F3F3F1", text: "#111111", mutedText: "#5B5B5B", border: "#DEDEDA" }, "Space Grotesk", "Inter", { radius: { sm: 0, md: 0, lg: 0 }, buttons: { shape: "none", uppercase: true }, shadow: "none" }),
  preset("minimal-portfolio", "Minimal Portfolio", { primary: "#222222", secondary: "#444444", accent: "#C8A97E", surface: "#FAFAF8", text: "#1A1A1A", mutedText: "#6B6B6B", border: "#E8E8E4" }, "Cormorant Garamond", "Work Sans", { radius: { sm: 2, md: 2, lg: 4 }, shadow: "none" }),
  preset("luxury-hotel", "Luxury Hotel", { primary: "#8C6A3F", secondary: "#1E1A16", accent: "#C9A66B", background: "#FCFAF6", surface: "#F3EEE5", text: "#1E1A16", mutedText: "#6A6156", border: "#E4DCCD" }, "DM Serif Display", "Raleway", { radius: { sm: 2, md: 4, lg: 6 } }),
  preset("playful-school", "Playful School", { primary: "#4F46E5", secondary: "#1E1B4B", accent: "#F59E0B", surface: "#F3F2FF", text: "#1E1B4B", mutedText: "#5B5890", border: "#DDDBF7" }, "Nunito", "Nunito", { radius: { sm: 8, md: 14, lg: 24 }, buttons: { shape: "pill" } }),
  preset("tech-saas", "Tech SaaS", { primary: "#6D28D9", secondary: "#0B1020", accent: "#22D3EE", surface: "#F5F3FF", text: "#0B1020", mutedText: "#5A6078", border: "#E4E1F5" }, "Plus Jakarta Sans", "Inter", { radius: { sm: 6, md: 10, lg: 18 } }),
  preset("nature-ngo", "Nature NGO", { primary: "#2F7D4F", secondary: "#1B3B2A", accent: "#E9B949", background: "#FCFDF9", surface: "#EFF5EC", text: "#1B3B2A", mutedText: "#587062", border: "#DCE7D8" }, "Lora", "Open Sans"),
  preset("real-estate", "Real Estate Elegant", { primary: "#1F3A5F", secondary: "#0F1E33", accent: "#C8963E", surface: "#F3F5F8", text: "#0F1E33", mutedText: "#5A6678", border: "#DFE4EB" }, "Libre Baskerville", "Montserrat", { radius: { sm: 2, md: 4, lg: 8 } }),
  preset("fitness-energy", "Fitness Energy", { primary: "#E11D2E", secondary: "#0A0A0A", accent: "#FACC15", background: "#FFFFFF", surface: "#F4F4F4", text: "#0A0A0A", mutedText: "#555555", border: "#DCDCDC" }, "Oswald", "Rubik", { radius: { sm: 2, md: 4, lg: 6 }, buttons: { shape: "sm", uppercase: true } }),
  preset("legal-classic", "Legal Classic", { primary: "#3B2F2F", secondary: "#1C1717", accent: "#A8763E", background: "#FDFCFA", surface: "#F3EFE9", text: "#1C1717", mutedText: "#65594F", border: "#E3DCD1" }, "Merriweather", "Lato", { radius: { sm: 0, md: 2, lg: 4 }, shadow: "none" }),
  preset("cafe-cosy", "Café Cosy", { primary: "#7A4B2A", secondary: "#3A2414", accent: "#D9A066", background: "#FFF9F1", surface: "#F5E9D9", text: "#3A2414", mutedText: "#7A6654", border: "#EADBC6" }, "Fraunces", "DM Sans", { radius: { sm: 8, md: 14, lg: 22 }, buttons: { shape: "pill" } }),
  preset("fashion-editorial", "Fashion Editorial", { primary: "#000000", secondary: "#2A2A2A", accent: "#D4AF7A", surface: "#F7F5F2", text: "#000000", mutedText: "#666666", border: "#E5E2DD" }, "Playfair Display", "Raleway", { radius: { sm: 0, md: 0, lg: 0 }, buttons: { shape: "none", uppercase: true }, shadow: "none" }),
  preset("event-night", "Event Night", { primary: "#E0B341", primaryContrast: "#14101F", secondary: "#B79CFF", accent: "#B79CFF", background: "#14101F", surface: "#1F1930", text: "#F5F1FF", mutedText: "#B4ABCB", border: "#352C4D" }, "Outfit", "DM Sans", { radius: { sm: 6, md: 12, lg: 20 }, buttons: { shape: "pill" } }),
  preset("finance-trust", "Finance Trust", { primary: "#0F5132", secondary: "#0B2A1D", accent: "#C9A227", surface: "#F2F6F3", text: "#0B2A1D", mutedText: "#566A60", border: "#DBE5DF" }, "Montserrat", "Open Sans", { radius: { sm: 4, md: 6, lg: 10 } }),
];

/* ---- colour helpers ---- */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export const isHex = (v) => typeof v === "string" && HEX.test(v.trim());
function rgb(hex) {
  let h = hex.trim().slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const toHex = (parts) => "#" + parts.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");
export const shade = (hex, percent) => (isHex(hex) ? toHex(rgb(hex).map((n) => (percent < 0 ? n * (1 + percent / 100) : n + (255 - n) * (percent / 100)))) : hex);

function luminance(hex) {
  const [r, g, b] = rgb(hex).map((n) => { const c = n / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio between two hex colours (1 to 21). */
export function contrast(a, b) {
  if (!isHex(a) || !isHex(b)) return 0;
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** Text/background pairs that fail WCAG AA for body text. */
export function contrastWarnings(theme) {
  const c = mergeTheme(theme).colors;
  return [
    ["Text on background", c.text, c.background],
    ["Muted text on background", c.mutedText, c.background],
    ["Text on surface", c.text, c.surface],
    ["Button text on primary", c.primaryContrast, c.primary],
  ].map(([label, fg, bg]) => ({ label, ratio: contrast(fg, bg) })).filter((p) => p.ratio && p.ratio < 4.5);
}

/** Saved themes may miss newer keys; fill them from the defaults. */
export function mergeTheme(theme) {
  const t = theme && typeof theme === "object" ? theme : {};
  return {
    ...DEFAULT_THEME, ...t,
    colors: { ...DEFAULT_THEME.colors, ...(t.colors || {}) },
    typography: { ...DEFAULT_THEME.typography, ...(t.typography || {}) },
    spacing: { ...DEFAULT_THEME.spacing, ...(t.spacing || {}) },
    radius: { ...DEFAULT_THEME.radius, ...(t.radius || {}) },
    buttons: { ...DEFAULT_THEME.buttons, ...(t.buttons || {}) },
  };
}

const num = (v, min, max, fallback) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; };
const fontName = (v, fallback) => (FONTS.includes(v) ? v : fallback);
const SHADOWS = { none: "none", soft: "0 4px 14px rgba(0,0,0,.07)", strong: "0 12px 32px rgba(0,0,0,.14)" };

/** Google Fonts stylesheet for the two theme fonts. */
export function fontHref(theme) {
  const t = mergeTheme(theme).typography;
  const families = [...new Set([fontName(t.headingFont, "Inter"), fontName(t.bodyFont, "Inter")])];
  return "https://fonts.googleapis.com/css2?" + families.map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700`).join("&") + "&display=swap";
}

/** Theme → CSS custom properties on the site root. Pure: same theme in, same CSS out. */
export function compileTheme(theme, scope = ".wb-site") {
  const t = mergeTheme(theme);
  const c = Object.fromEntries(Object.entries(t.colors).map(([k, v]) => [k, isHex(v) ? v.trim() : DEFAULT_THEME.colors[k]]));
  const ty = t.typography;
  const base = num(ty.baseSize, 12, 22, 16);
  const ratio = num(ty.scaleRatio, 1.1, 1.5, 1.25);
  const size = (step) => +(base * ratio ** step).toFixed(2);
  const r = { sm: num(t.radius.sm, 0, 40, 4), md: num(t.radius.md, 0, 40, 8), lg: num(t.radius.lg, 0, 60, 16) };
  const btnRadius = { none: 0, sm: r.sm, md: r.md, pill: 999 }[t.buttons.shape] ?? r.md;
  const sectionY = num(t.spacing.sectionY, 24, 200, 88);
  const vars = {
    "color-primary": c.primary, "color-primary-contrast": c.primaryContrast, "color-primary-hover": shade(c.primary, -12),
    "color-primary-soft": shade(c.primary, 88), "color-secondary": c.secondary, "color-accent": c.accent,
    "color-background": c.background, "color-surface": c.surface, "color-text": c.text, "color-muted": c.mutedText, "color-border": c.border,
    "font-heading": `"${fontName(ty.headingFont, "Inter")}", Georgia, serif`, "font-body": `"${fontName(ty.bodyFont, "Inter")}", system-ui, sans-serif`,
    "font-size": `${base}px`, "line-height": num(ty.lineHeight, 1.1, 2.2, 1.6), "heading-weight": num(ty.headingWeight, 300, 900, 700),
    "h1": `${size(5)}px`, "h2": `${size(4)}px`, "h3": `${size(3)}px`, "h4": `${size(2)}px`, "h5": `${size(1)}px`, "h6": `${base}px`, "small": `${+(base / ratio).toFixed(2)}px`,
    "section-y": `${sectionY}px`, "container": `${num(t.spacing.containerMax, 720, 1600, 1160)}px`, "gutter": `${num(t.spacing.gutter, 8, 64, 24)}px`,
    "radius-sm": `${r.sm}px`, "radius-md": `${r.md}px`, "radius-lg": `${r.lg}px`, "btn-radius": `${btnRadius}px`,
    "btn-weight": num(t.buttons.weight, 400, 800, 600), "btn-transform": t.buttons.uppercase ? "uppercase" : "none",
    "shadow": SHADOWS[t.shadow] || SHADOWS.soft,
  };
  const decl = (o) => Object.entries(o).map(([k, v]) => `--wb-${k}:${v}`).join(";");
  // smaller screens: tighter sections and a gentler type scale
  const tablet = decl({ "section-y": `${Math.round(sectionY * 0.75)}px`, h1: `${size(4)}px`, h2: `${size(3)}px`, h3: `${size(2)}px` });
  const mobile = decl({ "section-y": `${Math.round(sectionY * 0.55)}px`, h1: `${size(3)}px`, h2: `${size(2.5)}px`, h3: `${size(1.5)}px`, gutter: "18px" });
  return `${scope}{${decl(vars)}}@container wb (max-width:991px){${scope} .wb-root{${tablet}}}@container wb (max-width:767px){${scope} .wb-root{${mobile}}}`;
}
