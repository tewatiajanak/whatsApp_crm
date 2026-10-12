// Element registry + renderer for the Website Builder.
// One renderer draws the builder canvas, the preview and the public site; `ctx.mode`
// ("editor" | "preview" | "public") is the only difference, and editor chrome never lives here.
import React, { useEffect, useRef, useState } from "react";
import {
  Star, Heart, Shield, Zap, Clock, Check, Award, Users, Phone, Mail, MapPin, Globe, Leaf, Coffee, BookOpen, Briefcase, Camera, Home,
  Sparkles, Smile, Truck, Wrench, Stethoscope, GraduationCap, Utensils, Dumbbell, Scale, Building2, Menu as MenuIcon, X, ChevronDown, Quote as QuoteIcon,
} from "lucide-react";
import { sanitizeHtml } from "../utils/sanitizeHtml";
import { evaluate, hasExpression, passes } from "./expressions";

export const ICONS = { Star, Heart, Shield, Zap, Clock, Check, Award, Users, Phone, Mail, MapPin, Globe, Leaf, Coffee, BookOpen, Briefcase, Camera, Home, Sparkles, Smile, Truck, Wrench, Stethoscope, GraduationCap, Utensils, Dumbbell, Scale, Building2 };
export const Icon = ({ name, size = 22 }) => { const I = ICONS[name] || Star; return <I size={size} aria-hidden="true" />; };

/* ───────────── registry ───────────── */
const registry = {};
export const CATEGORIES = ["Layout", "Typography", "Media", "Interactive", "Forms", "Dynamic", "Sections", "Navigation", "Embeds"];
/** Register an element: { type, label, category, keywords, isContainer, defaultProps, defaultStyle, controls, inlineEdit, Component }. */
export function registerComponent(def) { registry[def.type] = { keywords: [], controls: [], defaultProps: {}, isContainer: false, ...def }; }
export const getComponent = (type) => registry[type];
export const listComponents = () => Object.values(registry).filter((d) => d.type !== "Page");

export const uid = () => "n_" + Math.random().toString(36).slice(2, 9);
/** A fresh node of a registered type, with that type's defaults. */
export function createNode(type, props = {}, children = [], style) {
  const def = registry[type] || {};
  return { id: uid(), type, props: { ...structuredClone(def.defaultProps || {}), ...props }, style: style || structuredClone(def.defaultStyle || { desktop: {}, tablet: {}, mobile: {} }), children };
}
/** Copy a subtree with new ids (inserting a block, duplicating, pasting). */
export function cloneWithNewIds(node) {
  return { ...structuredClone(node), id: uid(), children: (node.children || []).map(cloneWithNewIds) };
}

/* ───────────── safety helpers ───────────── */
/** Links may be site-relative, anchors, or http(s)/mailto/tel. Anything else (javascript:, data:) is dropped. */
export function safeHref(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (s.startsWith("#") || (s.startsWith("/") && !s.startsWith("//"))) return s;
  return /^(https?:|mailto:|tel:)/i.test(s) ? s : "";
}
/** Images may be https, an uploaded file, or the built-in template artwork (/wb-art/…). */
export const safeImage = (v) => { const s = String(v || "").trim(); return /^https:\/\//i.test(s) || s.startsWith("/uploads/") || /^\/wb-art\/[a-z0-9-]+\.svg$/.test(s) ? s : ""; };

const EMBED_HOSTS = [/^https:\/\/(www\.)?youtube\.com\/embed\//, /^https:\/\/www\.youtube-nocookie\.com\/embed\//, /^https:\/\/player\.vimeo\.com\/video\//, /^https:\/\/www\.google\.com\/maps/, /^https:\/\/calendly\.com\//, /^https:\/\/open\.spotify\.com\/embed\//, /^https:\/\/w\.soundcloud\.com\/player\//, /^https:\/\/form\.typeform\.com\//];
/** Turn a pasted YouTube/Vimeo link into its embed URL; only allow-listed providers pass. */
export function embedUrl(v) {
  const s = String(v || "").trim();
  const yt = s.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,15})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = s.match(/vimeo\.com\/(?:video\/)?(\d{5,12})/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return EMBED_HOSTS.some((rx) => rx.test(s)) ? s : "";
}

/* ───────────── style compiler ───────────── */
const STYLE_PROPS = { paddingTop: "padding-top", paddingBottom: "padding-bottom", paddingLeft: "padding-left", paddingRight: "padding-right", marginTop: "margin-top", marginBottom: "margin-bottom", backgroundColor: "background-color", color: "color", textAlign: "text-align", fontSize: "font-size", maxWidth: "max-width", minHeight: "min-height", borderRadius: "border-radius", gap: "gap", opacity: "opacity" };
const SAFE_VALUE = /^[a-zA-Z0-9 #.,%()\-]*$/;
function cssValue(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const token = s.match(/^token:(color|radius)\.([a-zA-Z-]+)$/);
  if (token) return `var(--wb-${token[1]}-${token[2].replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())})`;
  return SAFE_VALUE.test(s) && !/expression|javascript/i.test(s) ? s : "";
}
function declarations(style = {}) {
  const out = [];
  for (const [key, prop] of Object.entries(STYLE_PROPS)) { const v = cssValue(style[key]); if (v) out.push(`${prop}:${v}`); }
  const bg = safeImage(style.backgroundImage);
  if (bg) out.push(`background-image:url("${encodeURI(bg)}")`, "background-size:cover", "background-position:center");
  if (style.hidden) out.push("display:none!important");
  return out.join(";");
}
export const ANIMATIONS = [["fade", "Fade in"], ["fade-up", "Fade up"], ["fade-down", "Fade down"], ["slide-left", "Slide from right"], ["slide-right", "Slide from left"], ["zoom-in", "Zoom in"]];
/**
 * Every node's style as CSS: style presets in order, then the node's own style;
 * desktop first, then tablet and mobile overrides.
 */
export function compileNodeCss(root, presets = []) {
  const d = [], t = [], m = [];
  const byId = new Map((presets || []).map((p) => [p.id, p.style || {}]));
  (function walk(node) {
    if (!node) return;
    const sel = `.wb-root [data-wb="${String(node.id).replace(/[^A-Za-z0-9_-]/g, "")}"]`;
    const layers = [...(node.presetIds || []).map((id) => byId.get(id)).filter(Boolean), node.style || {}];
    const join = (device) => layers.map((s) => declarations(s[device])).filter(Boolean).join(";");
    let a = join("desktop");
    const anim = (node.interactions || []).find((i) => i.action === "animate");
    if (anim) a += `${a ? ";" : ""}transition-duration:${Math.min(3000, Math.max(100, Number(anim.duration) || 600))}ms;transition-delay:${Math.min(3000, Math.max(0, Number(anim.delay) || 0))}ms`;
    const b = join("tablet"), c = join("mobile");
    if (a) d.push(`${sel}{${a}}`);
    if (b) t.push(`${sel}{${b}}`);
    if (c) m.push(`${sel}{${c}}`);
    (node.children || []).forEach(walk);
  })(root);
  return d.join("") + (t.length ? `@container wb (max-width:991px){${t.join("")}}` : "") + (m.length ? `@container wb (max-width:767px){${m.join("")}}` : "");
}

export const BASE_CSS = `
.wb-site{container-type:inline-size;container-name:wb;background:var(--wb-color-background);color:var(--wb-color-text);font-family:var(--wb-font-body);font-size:var(--wb-font-size);line-height:var(--wb-line-height);text-align:left}
.wb-site *,.wb-site *::before,.wb-site *::after{box-sizing:border-box}
@layer wb-site-first{
.wb-site,.wb-site *{font-family:var(--wb-font-body)!important}
.wb-site h1,.wb-site h2,.wb-site h3,.wb-site h4,.wb-site h5,.wb-site h6,.wb-site h1 *,.wb-site h2 *,.wb-site h3 *,.wb-site h4 *,.wb-site h5 *,.wb-site h6 *,.wb-site .wb-logo,.wb-site .wb-price,.wb-site .wb-stat b,.wb-site .wb-quote,.wb-site .wb-quote p{font-family:var(--wb-font-heading)!important}
.wb-site h1,.wb-site h2,.wb-site h3,.wb-site h4,.wb-site h5,.wb-site h6,.wb-site p{color:inherit!important}
.wb-site p.wb-lead,.wb-site p.wb-muted{color:var(--wb-color-muted)!important}
.wb-site .wb-hero.dark p.wb-lead,.wb-site .wb-band.dark p.wb-lead,.wb-site .wb-band.dark p.wb-muted{color:rgba(255,255,255,.78)!important}
.wb-site .wb-hero.image p.wb-lead{color:rgba(255,255,255,.85)!important}
.wb-site .wb-band.brand p.wb-lead{color:inherit!important}
.wb-site .wb-band .wb-card p.wb-muted{color:var(--wb-color-muted)!important}
.wb-site a{color:var(--wb-link,var(--wb-color-primary))!important}
.wb-site hr.wb-divider{border-color:var(--wb-color-border)!important}
.wb-site button.wb-btn.primary,.wb-site .wb-pager button[aria-current=page]{background:var(--wb-color-primary)!important;color:var(--wb-color-primary-contrast)!important;border-color:var(--wb-color-primary)!important}
.wb-site button.wb-btn.primary:hover{background:var(--wb-color-primary-hover)!important}
}
.wb-menu a,.wb-logo,.wb-btn.light{--wb-link:var(--wb-color-text)}.wb-menu a[aria-current=page],.wb-btn.outline,.wb-btn.link{--wb-link:var(--wb-color-primary)}
.wb-btn.primary,.wb-btn.outline:hover{--wb-link:var(--wb-color-primary-contrast)}.wb-footer a{--wb-link:rgba(255,255,255,.8)}.wb-social a,.wb-plain{--wb-link:currentColor}
.wb-site h1,.wb-site h2,.wb-site h3,.wb-site h4,.wb-site h5,.wb-site h6{font-family:var(--wb-font-heading);font-weight:var(--wb-heading-weight);line-height:1.2;margin:0 0 .5em;color:inherit;letter-spacing:-.01em}
.wb-site h1{font-size:var(--wb-h1)}.wb-site h2{font-size:var(--wb-h2)}.wb-site h3{font-size:var(--wb-h3)}.wb-site h4{font-size:var(--wb-h4)}.wb-site h5{font-size:var(--wb-h5)}.wb-site h6{font-size:var(--wb-h6)}
.wb-site p{margin:0 0 1em}.wb-site p:last-child{margin-bottom:0}.wb-site a{text-decoration:none}.wb-site a:hover{text-decoration:underline}
.wb-site img{max-width:100%;height:auto;display:block}.wb-site ul,.wb-site ol{margin:0 0 1em;padding-left:1.3em}
.wb-site button{font-family:inherit}
.wb-section{padding:var(--wb-section-y) 0}
.wb-container{width:100%;max-width:var(--wb-container);margin:0 auto;padding-left:var(--wb-gutter);padding-right:var(--wb-gutter)}
.wb-cols{display:grid;gap:var(--wb-gutter);grid-template-columns:repeat(var(--cols,2),minmax(0,1fr));align-items:start}
.wb-stack{display:flex;flex-direction:column;gap:16px}.wb-stack.wb-row{flex-direction:row;flex-wrap:wrap;align-items:center}
.wb-card{background:var(--wb-color-background);border:1px solid var(--wb-color-border);border-radius:var(--wb-radius-lg);padding:24px;box-shadow:var(--wb-shadow)}
.wb-muted{color:var(--wb-color-muted)}.wb-center{text-align:center}
.wb-eyebrow{font-size:var(--wb-small);font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--wb-color-primary);margin-bottom:10px}
.wb-lead{font-size:1.15em;color:var(--wb-color-muted)}
.wb-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 24px;border-radius:var(--wb-btn-radius);font-weight:var(--wb-btn-weight);text-transform:var(--wb-btn-transform);font-size:.95em;border:1.5px solid transparent;cursor:pointer;text-decoration:none!important;transition:background .15s,color .15s,border-color .15s;line-height:1.2}
.wb-btn.primary{background:var(--wb-color-primary);color:var(--wb-color-primary-contrast)}.wb-btn.primary:hover{background:var(--wb-color-primary-hover)}
.wb-btn.outline{border-color:var(--wb-color-primary);color:var(--wb-color-primary);background:transparent}.wb-btn.outline:hover{background:var(--wb-color-primary);color:var(--wb-color-primary-contrast)}
.wb-btn.light{background:var(--wb-color-background);color:var(--wb-color-text)}.wb-btn.link{padding:0;color:var(--wb-color-primary);border:none}
.wb-btn.lg{padding:15px 30px;font-size:1.05em}.wb-btn.sm{padding:8px 16px;font-size:.85em}
.wb-btns{display:flex;flex-wrap:wrap;gap:12px}
.wb-divider{border:0;border-top:1px solid var(--wb-color-border);margin:0}
.wb-img{border-radius:var(--wb-radius-lg);width:100%;object-fit:cover}
.wb-ratio{position:relative;width:100%;aspect-ratio:16/9;border-radius:var(--wb-radius-lg);overflow:hidden;background:var(--wb-color-surface)}.wb-ratio iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.wb-ph{display:flex;align-items:center;justify-content:center;background:var(--wb-color-surface);color:var(--wb-color-muted);border-radius:var(--wb-radius-lg);min-height:220px;font-size:.9em}
.wb-grid{display:grid;gap:var(--wb-gutter);grid-template-columns:repeat(var(--cols,3),minmax(0,1fr))}
.wb-icon-badge{width:48px;height:48px;border-radius:var(--wb-radius-md);background:var(--wb-color-primary-soft);color:var(--wb-color-primary);display:flex;align-items:center;justify-content:center;margin-bottom:14px}
.wb-hero{padding:calc(var(--wb-section-y) * 1.15) 0}.wb-hero.dark,.wb-band.dark{background:var(--wb-color-secondary);color:#fff}.wb-hero.dark .wb-lead,.wb-band.dark .wb-muted,.wb-band.dark .wb-lead{color:rgba(255,255,255,.78)}
.wb-hero.soft,.wb-band.soft{background:var(--wb-color-surface)}.wb-band.brand{background:var(--wb-color-primary);color:var(--wb-color-primary-contrast)}.wb-band.brand .wb-lead{color:inherit;opacity:.85}
.wb-hero.image{background-size:cover;background-position:center;color:#fff;position:relative}.wb-hero.image::before{content:"";position:absolute;inset:0;background:rgba(0,0,0,.5)}.wb-hero.image>*{position:relative}.wb-hero.image .wb-lead{color:rgba(255,255,255,.85)}
.wb-split{display:grid;grid-template-columns:1fr 1fr;gap:calc(var(--wb-gutter) * 2);align-items:center}
.wb-head{max-width:720px;margin:0 auto calc(var(--wb-gutter) * 1.6);text-align:center}.wb-head.left{margin-left:0;text-align:left}
.wb-acc-item{border-bottom:1px solid var(--wb-color-border)}.wb-acc-btn{width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;background:none;border:0;padding:18px 0;font-size:1.05em;font-weight:600;color:inherit;cursor:pointer;text-align:left}
.wb-acc-btn svg{transition:transform .2s;flex-shrink:0}.wb-acc-btn[aria-expanded=true] svg{transform:rotate(180deg)}.wb-acc-panel{padding:0 0 18px;color:var(--wb-color-muted)}
.wb-tabs{display:flex;gap:4px;border-bottom:1px solid var(--wb-color-border);margin-bottom:20px;overflow-x:auto}.wb-tab{background:none;border:0;border-bottom:2px solid transparent;padding:10px 16px;font-weight:600;color:var(--wb-color-muted);cursor:pointer;white-space:nowrap}.wb-tab[aria-selected=true]{color:var(--wb-color-primary);border-color:var(--wb-color-primary)}
.wb-stat b{display:block;font-family:var(--wb-font-heading);font-size:var(--wb-h2);line-height:1.1}
.wb-price{font-family:var(--wb-font-heading);font-size:var(--wb-h2);font-weight:var(--wb-heading-weight);line-height:1}.wb-plan.hot{border-color:var(--wb-color-primary);border-width:2px}
.wb-check{list-style:none;padding:0!important;margin:18px 0!important}.wb-check li{display:flex;gap:8px;align-items:flex-start;margin-bottom:8px}.wb-check svg{color:var(--wb-color-primary);flex-shrink:0;margin-top:3px}
.wb-avatar{width:52px;height:52px;border-radius:50%;object-fit:cover;background:var(--wb-color-primary-soft);color:var(--wb-color-primary);display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0}
.wb-team-photo{width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--wb-radius-lg);margin-bottom:14px;background:var(--wb-color-surface)}
.wb-logos{display:flex;flex-wrap:wrap;gap:32px 48px;justify-content:center;align-items:center;font-weight:700;color:var(--wb-color-muted);font-size:1.1em}
.wb-gallery img{aspect-ratio:4/3;object-fit:cover;border-radius:var(--wb-radius-md);width:100%}
.wb-nav{border-bottom:1px solid var(--wb-color-border);background:var(--wb-color-background);position:relative;z-index:5}.wb-nav-in{display:flex;align-items:center;gap:24px;min-height:68px}
.wb-logo{font-family:var(--wb-font-heading);font-weight:var(--wb-heading-weight);font-size:1.25em;color:var(--wb-color-text)!important;text-decoration:none!important;display:flex;align-items:center;gap:8px}.wb-logo img{height:36px;width:auto}
.wb-menu{display:flex;gap:6px;margin-left:auto;align-items:center;list-style:none;padding:0!important;margin-top:0!important;margin-bottom:0!important}.wb-menu>li{position:relative}
.wb-menu a,.wb-menu button.wb-mi{display:flex;align-items:center;gap:4px;padding:8px 12px;border-radius:var(--wb-radius-sm);color:var(--wb-color-text);font-weight:500;font-size:.95em;background:none;border:0;cursor:pointer;text-decoration:none}
.wb-menu a:hover,.wb-menu button.wb-mi:hover{background:var(--wb-color-surface);text-decoration:none}.wb-menu a[aria-current=page]{color:var(--wb-color-primary)}
.wb-sub{position:absolute;top:100%;left:0;min-width:200px;background:var(--wb-color-background);border:1px solid var(--wb-color-border);border-radius:var(--wb-radius-md);box-shadow:var(--wb-shadow);padding:6px;list-style:none;margin:0!important;display:none;z-index:10}
.wb-menu>li:hover>.wb-sub,.wb-menu>li:focus-within>.wb-sub,.wb-sub.open{display:block}.wb-sub.mega{display:none;grid-template-columns:repeat(var(--cols,3),minmax(160px,1fr));gap:8px 24px;padding:18px;min-width:520px}.wb-menu>li:hover>.wb-sub.mega,.wb-menu>li:focus-within>.wb-sub.mega,.wb-sub.mega.open{display:grid}
.wb-sub-title{font-size:var(--wb-small);font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--wb-color-muted);padding:6px 12px}
.wb-burger{display:none;background:none;border:1px solid var(--wb-color-border);border-radius:var(--wb-radius-sm);padding:8px;color:inherit;cursor:pointer}
.wb-footer{background:var(--wb-color-secondary);color:rgba(255,255,255,.8);padding:56px 0 28px}.wb-footer a{color:rgba(255,255,255,.8)}.wb-footer h6{color:#fff;margin-bottom:12px}.wb-footer ul{list-style:none;padding:0!important}.wb-footer li{margin-bottom:8px}
.wb-footer-bottom{border-top:1px solid rgba(255,255,255,.15);margin-top:36px;padding-top:20px;font-size:var(--wb-small);display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between}
.wb-contact-row{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}.wb-contact-row svg{color:var(--wb-color-primary);flex-shrink:0;margin-top:3px}
.wb-social{display:flex;gap:10px;flex-wrap:wrap}.wb-social a{padding:8px 14px;border:1px solid var(--wb-color-border);border-radius:999px;font-size:.88em;font-weight:600;color:inherit}
.wb-anim [data-wb-anim]{opacity:0;transition-property:opacity,transform;transition-timing-function:ease-out}
.wb-anim [data-wb-anim=fade-up]{transform:translateY(28px)}.wb-anim [data-wb-anim=fade-down]{transform:translateY(-28px)}.wb-anim [data-wb-anim=slide-left]{transform:translateX(40px)}.wb-anim [data-wb-anim=slide-right]{transform:translateX(-40px)}.wb-anim [data-wb-anim=zoom-in]{transform:scale(.92)}
.wb-anim [data-wb-anim].wb-in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.wb-anim [data-wb-anim]{opacity:1!important;transform:none!important;transition:none!important}}
.wb-field{display:block;margin-bottom:14px}.wb-field>span{display:block;font-size:var(--wb-small);font-weight:600;margin-bottom:5px}
.wb-input{width:100%;padding:11px 13px;border:1px solid var(--wb-color-border);border-radius:var(--wb-radius-sm);background:var(--wb-color-background);color:var(--wb-color-text);font-size:1em}.wb-input:focus{outline:2px solid var(--wb-color-primary);outline-offset:1px}
.wb-note{padding:12px 14px;border-radius:var(--wb-radius-md);background:var(--wb-color-primary-soft);border:1px solid var(--wb-color-border)}
.wb-table{width:100%;border-collapse:collapse}.wb-table th,.wb-table td{padding:10px 12px;border-bottom:1px solid var(--wb-color-border);text-align:left}.wb-table th{font-size:var(--wb-small);text-transform:uppercase;letter-spacing:.06em;color:var(--wb-color-muted)}.wb-table-wrap{overflow-x:auto}
.wb-bar{height:8px;border-radius:99px;background:var(--wb-color-surface);overflow:hidden}.wb-bar>i{display:block;height:100%;background:var(--wb-color-primary);border-radius:99px}
.wb-timeline{border-left:2px solid var(--wb-color-border);padding-left:22px;margin-left:6px}.wb-timeline>div{position:relative;padding-bottom:22px}.wb-timeline>div::before{content:"";position:absolute;left:-29px;top:6px;width:12px;height:12px;border-radius:50%;background:var(--wb-color-primary)}
.wb-step-n{width:40px;height:40px;border-radius:50%;background:var(--wb-color-primary);color:var(--wb-color-primary-contrast);display:flex;align-items:center;justify-content:center;font-weight:700;margin-bottom:12px}
.wb-badge{display:inline-block;padding:4px 12px;border-radius:99px;background:var(--wb-color-primary-soft);color:var(--wb-color-primary);font-size:var(--wb-small);font-weight:600}
.wb-count{display:flex;gap:14px;flex-wrap:wrap}.wb-count>div{min-width:76px;text-align:center;padding:14px 10px;border:1px solid var(--wb-color-border);border-radius:var(--wb-radius-md);background:var(--wb-color-background);color:var(--wb-color-text)}.wb-count b{display:block;font-size:var(--wb-h3);font-family:var(--wb-font-heading);line-height:1}
.wb-carousel{position:relative;overflow:hidden;border-radius:var(--wb-radius-lg)}.wb-slide{position:relative;min-height:320px;display:flex;align-items:flex-end;background:var(--wb-color-secondary) center/cover;color:#fff}.wb-slide>div{position:relative;padding:28px;width:100%;background:linear-gradient(transparent,rgba(0,0,0,.65))}
.wb-car-btn{position:absolute;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,255,255,.9);color:#111;cursor:pointer;display:flex;align-items:center;justify-content:center}.wb-dots{display:flex;gap:6px;justify-content:center;margin-top:10px}.wb-dots button{width:9px;height:9px;border-radius:50%;border:0;padding:0;background:var(--wb-color-border);cursor:pointer}.wb-dots button[aria-current=true]{background:var(--wb-color-primary)}
.wb-marquee{overflow:hidden;white-space:nowrap}.wb-marquee>div{display:inline-block;animation:wb-marq 28s linear infinite;padding-left:100%}.wb-marquee:hover>div{animation-play-state:paused}@keyframes wb-marq{to{transform:translateX(-100%)}}@media (prefers-reduced-motion:reduce){.wb-marquee>div{animation:none;padding-left:0;white-space:normal}}
.wb-price-row{display:flex;gap:12px;align-items:baseline;padding:12px 0;border-bottom:1px dashed var(--wb-color-border)}.wb-price-row>span:first-child{flex:1}.wb-price-row b{white-space:nowrap}
.wb-crumbs{display:flex;flex-wrap:wrap;gap:6px;font-size:var(--wb-small);color:var(--wb-color-muted);list-style:none;padding:0!important;margin:0!important}
.wb-pager{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:24px}.wb-pager button{min-width:38px;height:38px;padding:0 10px;border:1px solid var(--wb-color-border);border-radius:var(--wb-radius-sm);background:var(--wb-color-background);color:var(--wb-color-text);cursor:pointer}.wb-pager button[aria-current=page]{background:var(--wb-color-primary);color:var(--wb-color-primary-contrast);border-color:var(--wb-color-primary)}.wb-pager button:disabled{opacity:.4;cursor:default}
.wb-quote{border-left:3px solid var(--wb-color-primary);padding-left:20px;font-family:var(--wb-font-heading);font-size:var(--wb-h4);font-style:italic}
@container wb (max-width:991px){.wb-cols,.wb-grid{grid-template-columns:repeat(min(var(--cols,2),2),minmax(0,1fr))}.wb-split{grid-template-columns:1fr}.wb-sub.mega{min-width:0}}
@container wb (max-width:767px){.wb-cols,.wb-grid{grid-template-columns:1fr}.wb-burger{display:block}.wb-menu{display:none;position:absolute;top:100%;left:0;right:0;flex-direction:column;align-items:stretch;background:var(--wb-color-background);border-bottom:1px solid var(--wb-color-border);padding:10px var(--wb-gutter)!important;margin:0!important;gap:2px}.wb-menu.open{display:flex}.wb-sub,.wb-sub.mega{position:static;display:block;border:0;box-shadow:none;padding:0 0 0 14px;min-width:0}.wb-btn.lg{padding:13px 22px}}
`;

/* ───────────── small building pieces ───────────── */
/** Link that understands site-relative paths and does nothing inside the editor. */
export function A({ href, ctx, className, children, newTab, ...rest }) {
  const safe = safeHref(href);
  const internal = safe.startsWith("/");
  const onClick = (e) => {
    if (ctx.mode === "editor") { e.preventDefault(); return; }
    // files (calendar, feeds) are real downloads, not pages of the site
    if (internal && ctx.navigate && !/\.(ics|xml|pdf)$/i.test(safe)) { e.preventDefault(); ctx.navigate(safe); }
  };
  return <a href={internal ? ctx.linkTo(safe) : safe || undefined} className={className} onClick={onClick} {...(newTab && !internal ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest}>{children}</a>;
}

/** Text that can be edited in place on the canvas (double-click) when the builder is open. */
export function T({ tag: Tag = "span", node, prop, value, ctx, className }) {
  const [editing, setEditing] = useState(false);
  // bound text shows data, so it is edited in the panel, not in place
  if (ctx.mode !== "editor" || hasExpression(node?.props?.[prop])) return <Tag className={className}>{value}</Tag>;
  return (
    <Tag
      key={editing ? "edit" : `view-${value}`}
      className={className}
      contentEditable={editing}
      suppressContentEditableWarning
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); const el = e.currentTarget; setTimeout(() => el.focus(), 0); }}
      onBlur={(e) => { if (!editing) return; setEditing(false); ctx.onInlineEdit?.(node.id, prop, e.currentTarget.innerText.trim()); }}
      onKeyDown={(e) => { if (!editing) return; if (e.key === "Escape") { e.currentTarget.innerText = value; e.currentTarget.blur(); } if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } }}
      style={editing ? { outline: "2px solid var(--wb-color-accent)", outlineOffset: 2, cursor: "text" } : undefined}
    >{value}</Tag>
  );
}

export const Btn = ({ label, href, variant = "primary", size = "", ctx, node, prop }) => (label ? <A href={href} ctx={ctx} className={`wb-btn ${variant} ${size}`}>{node ? <T node={node} prop={prop} value={label} ctx={ctx} /> : label}</A> : null);
export const Img = ({ src, alt, className = "wb-img", style }) => (safeImage(src) ? <img src={safeImage(src)} alt={alt || ""} className={className} style={style} loading="lazy" /> : <div className="wb-ph" role="img" aria-label={alt || "Image"}>Image</div>);
export const Head = ({ node, props, ctx, left }) => ((props.eyebrow || props.heading || props.text) ? (
  <div className={`wb-head ${left ? "left" : ""}`}>
    {props.eyebrow && <T tag="div" className="wb-eyebrow" node={node} prop="eyebrow" value={props.eyebrow} ctx={ctx} />}
    {props.heading && <T tag="h2" node={node} prop="heading" value={props.heading} ctx={ctx} />}
    {props.text && <T tag="p" className="wb-lead" node={node} prop="text" value={props.text} ctx={ctx} />}
  </div>
) : null);
export const Empty = ({ ctx, label = "Add elements here" }) => (ctx.mode === "editor" ? <div className="wb-ph" style={{ minHeight: 90, border: "1.5px dashed var(--wb-color-border)", background: "transparent" }}>{label}</div> : null);
export const band = (tone) => (tone && tone !== "none" ? `wb-band ${tone}` : "");
const TONES = [["none", "None"], ["soft", "Soft"], ["dark", "Dark"], ["brand", "Brand"]];
export const headControls = [{ key: "eyebrow", label: "Eyebrow", type: "text" }, { key: "heading", label: "Heading", type: "text" }, { key: "text", label: "Text", type: "textarea" }];
export const toneControl = { key: "tone", label: "Background", type: "select", options: TONES };
export const colsControl = (max = 4) => ({ key: "columns", label: "Columns", type: "select", options: Array.from({ length: max }, (_, i) => [i + 1, String(i + 1)]) });

/**
 * Sanitised HTML. The server has no DOM to clean HTML with, so it sends the text only;
 * the browser then writes the cleaned, formatted HTML in after the page is live.
 */
export function RichHtml({ html, attrs }) {
  const ref = useRef(null);
  const clean = sanitizeHtml(html);
  useEffect(() => { if (ref.current && ref.current.innerHTML !== clean) ref.current.innerHTML = clean; }, [clean]);
  return <div {...attrs} ref={ref} className="wb-rich" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: clean }} />;
}

/* ───────────── elements ───────────── */
registerComponent({ type: "Page", label: "Page", category: "Layout", isContainer: true, Component: ({ attrs, children, ctx }) => <div {...attrs} className="wb-root">{children.length ? children : <Empty ctx={ctx} label="Add a block or an element to start" />}</div> });

registerComponent({
  type: "Section", label: "Section", category: "Layout", isContainer: true, keywords: ["band", "row", "area"],
  defaultProps: { tone: "none", contained: true }, controls: [toneControl, { key: "contained", label: "Keep content in container", type: "toggle" }],
  Component: ({ attrs, props, children, ctx }) => <section {...attrs} className={`wb-section ${band(props.tone)}`}>{props.contained ? <div className="wb-container">{children.length ? children : <Empty ctx={ctx} />}</div> : (children.length ? children : <Empty ctx={ctx} />)}</section>,
});
registerComponent({ type: "Container", label: "Container", category: "Layout", isContainer: true, keywords: ["box", "wrapper"], Component: ({ attrs, children, ctx }) => <div {...attrs} className="wb-container">{children.length ? children : <Empty ctx={ctx} />}</div> });
registerComponent({
  type: "Columns", label: "Columns", category: "Layout", isContainer: true, keywords: ["grid", "row", "layout"],
  defaultProps: { columns: 2 }, controls: [colsControl(6)],
  Component: ({ attrs, props, children, ctx }) => <div {...attrs} className="wb-cols" style={{ "--cols": Number(props.columns) || 2 }}>{children.length ? children : <Empty ctx={ctx} label="Add elements — each one becomes a column" />}</div>,
});
registerComponent({
  type: "Stack", label: "Stack", category: "Layout", isContainer: true, keywords: ["flex", "group", "row"],
  defaultProps: { direction: "column" }, controls: [{ key: "direction", label: "Direction", type: "select", options: [["column", "Vertical"], ["row", "Horizontal"]] }],
  Component: ({ attrs, props, children, ctx }) => <div {...attrs} className={`wb-stack ${props.direction === "row" ? "wb-row" : ""}`}>{children.length ? children : <Empty ctx={ctx} />}</div>,
});
registerComponent({ type: "Card", label: "Card", category: "Layout", isContainer: true, keywords: ["box", "panel"], Component: ({ attrs, children, ctx }) => <div {...attrs} className="wb-card">{children.length ? children : <Empty ctx={ctx} />}</div> });
registerComponent({ type: "Spacer", label: "Spacer", category: "Layout", keywords: ["gap", "space"], defaultProps: { height: 40 }, controls: [{ key: "height", label: "Height (px)", type: "number" }], Component: ({ attrs, props }) => <div {...attrs} style={{ height: Math.max(0, Math.min(400, Number(props.height) || 0)) }} aria-hidden="true" /> });
registerComponent({ type: "Divider", label: "Divider", category: "Layout", keywords: ["line", "separator"], Component: ({ attrs }) => <hr {...attrs} className="wb-divider" /> });

registerComponent({
  type: "Heading", label: "Heading", category: "Typography", keywords: ["title", "h1", "h2"], inlineEdit: ["text"],
  defaultProps: { text: "Your heading", level: "h2" }, controls: [{ key: "text", label: "Text", type: "text" }, { key: "level", label: "Level", type: "select", options: ["h1", "h2", "h3", "h4", "h5", "h6"].map((h) => [h, h.toUpperCase()]) }],
  Component: ({ attrs, props, node, ctx }) => <div {...attrs}><T tag={/^h[1-6]$/.test(props.level) ? props.level : "h2"} node={node} prop="text" value={props.text} ctx={ctx} /></div>,
});
registerComponent({
  type: "Text", label: "Text", category: "Typography", keywords: ["paragraph", "copy"], inlineEdit: ["text"],
  defaultProps: { text: "Write something about your business here.", lead: false }, controls: [{ key: "text", label: "Text", type: "textarea" }, { key: "lead", label: "Large intro text", type: "toggle" }],
  Component: ({ attrs, props, node, ctx }) => <div {...attrs}><T tag="p" className={props.lead ? "wb-lead" : ""} node={node} prop="text" value={props.text} ctx={ctx} /></div>,
});
registerComponent({
  type: "RichText", label: "Rich text", category: "Typography", keywords: ["article", "html", "content"],
  defaultProps: { html: "<p>Formatted text with <b>bold</b>, lists and links.</p>" }, controls: [{ key: "html", label: "Content", type: "richtext" }],
  Component: ({ attrs, props }) => <RichHtml attrs={attrs} html={props.html} />,
});
registerComponent({ type: "Eyebrow", label: "Eyebrow", category: "Typography", keywords: ["kicker", "label"], defaultProps: { text: "Section label" }, controls: [{ key: "text", label: "Text", type: "text" }], Component: ({ attrs, props, node, ctx }) => <div {...attrs}><T tag="div" className="wb-eyebrow" node={node} prop="text" value={props.text} ctx={ctx} /></div> });
registerComponent({
  type: "Quote", label: "Quote", category: "Typography", keywords: ["blockquote", "testimonial"],
  defaultProps: { text: "A short, memorable quote goes here.", author: "" }, controls: [{ key: "text", label: "Quote", type: "textarea" }, { key: "author", label: "Author", type: "text" }],
  Component: ({ attrs, props, node, ctx }) => <blockquote {...attrs} className="wb-quote" style={{ margin: 0 }}><T tag="p" node={node} prop="text" value={props.text} ctx={ctx} />{props.author && <footer className="wb-muted" style={{ fontSize: "var(--wb-font-size)", fontStyle: "normal" }}>— {props.author}</footer>}</blockquote>,
});
registerComponent({
  type: "List", label: "Checklist", category: "Typography", keywords: ["bullets", "features", "points"],
  defaultProps: { items: [{ text: "First point" }, { text: "Second point" }, { text: "Third point" }] }, controls: [{ key: "items", label: "Items", type: "items", fields: [{ key: "text", label: "Text", type: "text" }] }],
  Component: ({ attrs, props }) => <ul {...attrs} className="wb-check">{(props.items || []).map((it, i) => <li key={i}><Check size={18} aria-hidden="true" /><span>{it.text}</span></li>)}</ul>,
});

registerComponent({
  type: "Image", label: "Image", category: "Media", keywords: ["photo", "picture"],
  defaultProps: { src: "", alt: "", href: "" }, controls: [{ key: "src", label: "Image URL", type: "image" }, { key: "alt", label: "Alt text", type: "text" }, { key: "href", label: "Link", type: "link" }],
  Component: ({ attrs, props, ctx }) => <div {...attrs}>{safeHref(props.href) ? <A href={props.href} ctx={ctx}><Img src={props.src} alt={props.alt} /></A> : <Img src={props.src} alt={props.alt} />}</div>,
});
registerComponent({
  type: "Video", label: "Video", category: "Media", keywords: ["youtube", "vimeo", "embed"],
  defaultProps: { url: "", title: "Video" }, controls: [{ key: "url", label: "YouTube or Vimeo link", type: "text" }, { key: "title", label: "Title", type: "text" }],
  Component: ({ attrs, props, ctx }) => { const src = embedUrl(props.url); return <div {...attrs}>{src ? <div className="wb-ratio"><iframe src={src} title={props.title || "Video"} loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen style={ctx.mode === "editor" ? { pointerEvents: "none" } : undefined} /></div> : <div className="wb-ph">Paste a YouTube or Vimeo link</div>}</div>; },
});
registerComponent({
  type: "Gallery", label: "Gallery", category: "Media", keywords: ["photos", "images", "grid"],
  defaultProps: { columns: 3, items: [{ src: "", alt: "" }, { src: "", alt: "" }, { src: "", alt: "" }] },
  controls: [colsControl(5), { key: "items", label: "Images", type: "items", fields: [{ key: "src", label: "Image URL", type: "image" }, { key: "alt", label: "Alt text", type: "text" }] }],
  Component: ({ attrs, props }) => <div {...attrs} className="wb-grid wb-gallery" style={{ "--cols": Number(props.columns) || 3 }}>{(props.items || []).map((it, i) => <Img key={i} src={it.src} alt={it.alt} className="" />)}</div>,
});

registerComponent({
  type: "Button", label: "Button", category: "Interactive", keywords: ["cta", "link", "action"], inlineEdit: ["label"],
  defaultProps: { label: "Get started", href: "", variant: "primary", size: "" },
  controls: [{ key: "label", label: "Label", type: "text" }, { key: "href", label: "Link", type: "link" }, { key: "variant", label: "Style", type: "select", options: [["primary", "Primary"], ["outline", "Outline"], ["light", "Light"], ["link", "Text link"]] }, { key: "size", label: "Size", type: "select", options: [["sm", "Small"], ["", "Normal"], ["lg", "Large"]] }],
  Component: ({ attrs, props, node, ctx }) => <div {...attrs}><Btn label={props.label} href={props.href} variant={props.variant} size={props.size} ctx={ctx} node={node} prop="label" /></div>,
});
function AccordionView({ attrs, props }) {
  const [open, setOpen] = useState(0);
  return <div {...attrs}>{(props.items || []).map((it, i) => (
    <div className="wb-acc-item" key={i}>
      <button type="button" className="wb-acc-btn" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}><span>{it.question}</span><ChevronDown size={18} aria-hidden="true" /></button>
      {open === i && <div className="wb-acc-panel">{it.answer}</div>}
    </div>))}</div>;
}
registerComponent({
  type: "Accordion", label: "Accordion / FAQ", category: "Interactive", keywords: ["faq", "questions", "toggle"],
  defaultProps: { items: [{ question: "What do you offer?", answer: "Describe your offer in a sentence or two." }, { question: "How do I get started?", answer: "Explain the first step." }] },
  controls: [{ key: "items", label: "Questions", type: "items", fields: [{ key: "question", label: "Question", type: "text" }, { key: "answer", label: "Answer", type: "textarea" }] }], Component: AccordionView,
});
function TabsView({ attrs, props }) {
  const [tab, setTab] = useState(0);
  const items = props.items || [];
  const cur = items[Math.min(tab, items.length - 1)];
  return <div {...attrs}><div className="wb-tabs" role="tablist">{items.map((it, i) => <button key={i} type="button" role="tab" aria-selected={i === tab} className="wb-tab" onClick={() => setTab(i)}>{it.title}</button>)}</div>{cur && <div role="tabpanel">{cur.text}</div>}</div>;
}
registerComponent({
  type: "Tabs", label: "Tabs", category: "Interactive", keywords: ["switch", "panels"],
  defaultProps: { items: [{ title: "First", text: "Content for the first tab." }, { title: "Second", text: "Content for the second tab." }] },
  controls: [{ key: "items", label: "Tabs", type: "items", fields: [{ key: "title", label: "Title", type: "text" }, { key: "text", label: "Content", type: "textarea" }] }], Component: TabsView,
});

/* ---- sections (ready-made, theme-aware) ---- */
registerComponent({
  type: "Hero", label: "Hero", category: "Sections", keywords: ["banner", "header", "intro"], inlineEdit: ["heading", "text"],
  defaultProps: { layout: "split", tone: "soft", eyebrow: "Welcome", heading: "A clear headline that says what you do", text: "One or two lines that explain the value you bring and who it is for.", primaryLabel: "Get started", primaryHref: "", secondaryLabel: "Learn more", secondaryHref: "", image: "" },
  controls: [{ key: "layout", label: "Layout", type: "select", options: [["split", "Text + image"], ["center", "Centred"], ["image", "Background image"]] }, { key: "tone", label: "Background", type: "select", options: [["soft", "Soft"], ["dark", "Dark"], ["none", "None"]] }, ...headControls, { key: "primaryLabel", label: "Button", type: "text" }, { key: "primaryHref", label: "Button link", type: "link" }, { key: "secondaryLabel", label: "Second button", type: "text" }, { key: "secondaryHref", label: "Second link", type: "link" }, { key: "image", label: "Image URL", type: "image" }],
  Component: ({ attrs, props, node, ctx }) => {
    const text = (
      <div>
        {props.eyebrow && <T tag="div" className="wb-eyebrow" node={node} prop="eyebrow" value={props.eyebrow} ctx={ctx} />}
        <T tag="h1" node={node} prop="heading" value={props.heading} ctx={ctx} />
        {props.text && <T tag="p" className="wb-lead" node={node} prop="text" value={props.text} ctx={ctx} />}
        <div className="wb-btns" style={{ marginTop: 26, justifyContent: props.layout === "split" ? "flex-start" : "center" }}>
          <Btn label={props.primaryLabel} href={props.primaryHref} size="lg" ctx={ctx} />
          <Btn label={props.secondaryLabel} href={props.secondaryHref} variant={props.layout === "image" || props.tone === "dark" ? "light" : "outline"} size="lg" ctx={ctx} />
        </div>
      </div>);
    if (props.layout === "image") return <section {...attrs} className="wb-hero image" style={{ backgroundImage: safeImage(props.image) ? `url("${encodeURI(safeImage(props.image))}")` : undefined, backgroundColor: "var(--wb-color-secondary)" }}><div className="wb-container wb-center" style={{ maxWidth: 820 }}>{text}</div></section>;
    return <section {...attrs} className={`wb-hero ${props.tone === "none" ? "" : props.tone}`}><div className="wb-container">{props.layout === "center" ? <div className="wb-center" style={{ maxWidth: 780, margin: "0 auto" }}>{text}</div> : <div className="wb-split">{text}<Img src={props.image} alt={props.heading} /></div>}</div></section>;
  },
});
registerComponent({
  type: "Features", label: "Features", category: "Sections", keywords: ["benefits", "services", "icons"],
  defaultProps: { tone: "none", columns: 3, eyebrow: "", heading: "Why choose us", text: "", cards: false, items: [{ icon: "Star", title: "Quality first", text: "A short line about this benefit." }, { icon: "Clock", title: "On time", text: "A short line about this benefit." }, { icon: "Shield", title: "Trusted", text: "A short line about this benefit." }] },
  controls: [toneControl, colsControl(4), ...headControls, { key: "cards", label: "Show as cards", type: "toggle" }, { key: "items", label: "Items", type: "items", fields: [{ key: "icon", label: "Icon", type: "icon" }, { key: "title", label: "Title", type: "text" }, { key: "text", label: "Text", type: "textarea" }] }],
  Component: ({ attrs, props, node, ctx }) => <section {...attrs} className={`wb-section ${band(props.tone)}`}><div className="wb-container"><Head node={node} props={props} ctx={ctx} /><div className="wb-grid" style={{ "--cols": Number(props.columns) || 3 }}>{(props.items || []).map((it, i) => <div key={i} className={props.cards ? "wb-card" : ""}><div className="wb-icon-badge"><Icon name={it.icon} /></div><h4>{it.title}</h4><p className="wb-muted">{it.text}</p></div>)}</div></div></section>,
});
registerComponent({
  type: "Split", label: "Image + text", category: "Sections", keywords: ["about", "story", "content"],
  defaultProps: { tone: "none", reverse: false, eyebrow: "About us", heading: "Tell your story", text: "Explain who you are, what you care about and why people choose you.", buttonLabel: "", buttonHref: "", image: "", points: [] },
  controls: [toneControl, { key: "reverse", label: "Image on the left", type: "toggle" }, ...headControls, { key: "points", label: "Points", type: "items", fields: [{ key: "text", label: "Text", type: "text" }] }, { key: "buttonLabel", label: "Button", type: "text" }, { key: "buttonHref", label: "Button link", type: "link" }, { key: "image", label: "Image URL", type: "image" }],
  Component: ({ attrs, props, node, ctx }) => {
    const text = <div><Head node={node} props={props} ctx={ctx} left />{(props.points || []).length > 0 && <ul className="wb-check">{props.points.map((p, i) => <li key={i}><Check size={18} aria-hidden="true" /><span>{p.text}</span></li>)}</ul>}<Btn label={props.buttonLabel} href={props.buttonHref} ctx={ctx} /></div>;
    const image = <Img src={props.image} alt={props.heading} />;
    return <section {...attrs} className={`wb-section ${band(props.tone)}`}><div className="wb-container"><div className="wb-split">{props.reverse ? <>{image}{text}</> : <>{text}{image}</>}</div></div></section>;
  },
});
registerComponent({
  type: "Stats", label: "Stats", category: "Sections", keywords: ["numbers", "counter", "achievements"],
  defaultProps: { tone: "brand", items: [{ value: "500+", label: "Happy clients" }, { value: "12", label: "Years of experience" }, { value: "98%", label: "Satisfaction" }, { value: "24/7", label: "Support" }] },
  controls: [toneControl, { key: "items", label: "Numbers", type: "items", fields: [{ key: "value", label: "Number", type: "text" }, { key: "label", label: "Label", type: "text" }] }],
  Component: ({ attrs, props }) => <section {...attrs} className={`wb-section ${band(props.tone)}`} style={{ paddingTop: "calc(var(--wb-section-y) * .6)", paddingBottom: "calc(var(--wb-section-y) * .6)" }}><div className="wb-container"><div className="wb-grid wb-center" style={{ "--cols": Math.min(4, (props.items || []).length || 1) }}>{(props.items || []).map((it, i) => <div className="wb-stat" key={i}><b>{it.value}</b><span>{it.label}</span></div>)}</div></div></section>,
});
registerComponent({
  type: "Pricing", label: "Pricing", category: "Sections", keywords: ["plans", "price", "packages"],
  defaultProps: { tone: "soft", eyebrow: "", heading: "Simple pricing", text: "", items: [{ name: "Basic", price: "₹999", period: "/month", features: "One user\nEmail support", buttonLabel: "Choose", buttonHref: "", highlight: false }, { name: "Standard", price: "₹2,499", period: "/month", features: "Five users\nPriority support\nReports", buttonLabel: "Choose", buttonHref: "", highlight: true }, { name: "Premium", price: "₹4,999", period: "/month", features: "Unlimited users\nDedicated manager", buttonLabel: "Choose", buttonHref: "", highlight: false }] },
  controls: [toneControl, ...headControls, { key: "items", label: "Plans", type: "items", fields: [{ key: "name", label: "Name", type: "text" }, { key: "price", label: "Price", type: "text" }, { key: "period", label: "Period", type: "text" }, { key: "features", label: "Features (one per line)", type: "textarea" }, { key: "buttonLabel", label: "Button", type: "text" }, { key: "buttonHref", label: "Button link", type: "link" }, { key: "highlight", label: "Highlight", type: "toggle" }] }],
  Component: ({ attrs, props, node, ctx }) => <section {...attrs} className={`wb-section ${band(props.tone)}`}><div className="wb-container"><Head node={node} props={props} ctx={ctx} /><div className="wb-grid" style={{ "--cols": Math.min(4, (props.items || []).length || 1), alignItems: "stretch" }}>{(props.items || []).map((p, i) => (
    <div key={i} className={`wb-card wb-plan ${p.highlight ? "hot" : ""}`} style={{ color: "var(--wb-color-text)" }}>
      <h4>{p.name}</h4><div><span className="wb-price">{p.price}</span> <span className="wb-muted">{p.period}</span></div>
      <ul className="wb-check">{String(p.features || "").split("\n").filter(Boolean).map((f, j) => <li key={j}><Check size={18} aria-hidden="true" /><span>{f}</span></li>)}</ul>
      <Btn label={p.buttonLabel} href={p.buttonHref} variant={p.highlight ? "primary" : "outline"} ctx={ctx} />
    </div>))}</div></div></section>,
});
registerComponent({
  type: "Testimonials", label: "Testimonials", category: "Sections", keywords: ["reviews", "quotes", "social proof"],
  defaultProps: { tone: "soft", columns: 3, eyebrow: "", heading: "What people say", text: "", items: [{ quote: "Great service from start to finish.", name: "Asha Mehta", role: "Customer", photo: "" }, { quote: "Professional, friendly and quick.", name: "Rohan Gupta", role: "Customer", photo: "" }, { quote: "I would recommend them to anyone.", name: "Neha Singh", role: "Customer", photo: "" }] },
  controls: [toneControl, colsControl(3), ...headControls, { key: "items", label: "Reviews", type: "items", fields: [{ key: "quote", label: "Quote", type: "textarea" }, { key: "name", label: "Name", type: "text" }, { key: "role", label: "Role", type: "text" }, { key: "photo", label: "Photo URL", type: "image" }] }],
  Component: ({ attrs, props, node, ctx }) => <section {...attrs} className={`wb-section ${band(props.tone)}`}><div className="wb-container"><Head node={node} props={props} ctx={ctx} /><div className="wb-grid" style={{ "--cols": Number(props.columns) || 3 }}>{(props.items || []).map((it, i) => (
    <figure key={i} className="wb-card" style={{ margin: 0, color: "var(--wb-color-text)" }}><QuoteIcon size={22} style={{ color: "var(--wb-color-primary)", marginBottom: 10 }} aria-hidden="true" /><blockquote style={{ margin: "0 0 16px" }}>{it.quote}</blockquote>
      <figcaption style={{ display: "flex", gap: 12, alignItems: "center" }}>{safeImage(it.photo) ? <img className="wb-avatar" src={safeImage(it.photo)} alt="" /> : <span className="wb-avatar">{String(it.name || "?").charAt(0)}</span>}<span><b>{it.name}</b><br /><span className="wb-muted" style={{ fontSize: "var(--wb-small)" }}>{it.role}</span></span></figcaption></figure>))}</div></div></section>,
});
registerComponent({
  type: "Team", label: "Team", category: "Sections", keywords: ["people", "staff", "members"],
  defaultProps: { tone: "none", columns: 4, eyebrow: "", heading: "Meet the team", text: "", items: [{ name: "Team member", role: "Role", photo: "" }, { name: "Team member", role: "Role", photo: "" }, { name: "Team member", role: "Role", photo: "" }, { name: "Team member", role: "Role", photo: "" }] },
  controls: [toneControl, colsControl(4), ...headControls, { key: "items", label: "People", type: "items", fields: [{ key: "name", label: "Name", type: "text" }, { key: "role", label: "Role", type: "text" }, { key: "photo", label: "Photo URL", type: "image" }] }],
  Component: ({ attrs, props, node, ctx }) => <section {...attrs} className={`wb-section ${band(props.tone)}`}><div className="wb-container"><Head node={node} props={props} ctx={ctx} /><div className="wb-grid" style={{ "--cols": Number(props.columns) || 4 }}>{(props.items || []).map((it, i) => <div key={i}>{safeImage(it.photo) ? <img className="wb-team-photo" src={safeImage(it.photo)} alt={it.name} loading="lazy" /> : <div className="wb-team-photo wb-ph" style={{ minHeight: 0 }}>Photo</div>}<h5 style={{ marginBottom: 2 }}>{it.name}</h5><span className="wb-muted">{it.role}</span></div>)}</div></div></section>,
});
registerComponent({
  type: "LogoStrip", label: "Logos", category: "Sections", keywords: ["clients", "partners", "brands"],
  defaultProps: { heading: "Trusted by", items: [{ name: "Company A" }, { name: "Company B" }, { name: "Company C" }, { name: "Company D" }] },
  controls: [{ key: "heading", label: "Heading", type: "text" }, { key: "items", label: "Names", type: "items", fields: [{ key: "name", label: "Name", type: "text" }, { key: "logo", label: "Logo URL", type: "image" }] }],
  Component: ({ attrs, props }) => <section {...attrs} className="wb-section" style={{ paddingTop: "calc(var(--wb-section-y) * .5)", paddingBottom: "calc(var(--wb-section-y) * .5)" }}><div className="wb-container wb-center">{props.heading && <div className="wb-eyebrow" style={{ color: "var(--wb-color-muted)" }}>{props.heading}</div>}<div className="wb-logos">{(props.items || []).map((it, i) => (safeImage(it.logo) ? <img key={i} src={safeImage(it.logo)} alt={it.name} style={{ height: 36, width: "auto" }} /> : <span key={i}>{it.name}</span>))}</div></div></section>,
});
registerComponent({
  type: "CTA", label: "Call to action", category: "Sections", keywords: ["banner", "contact", "signup"], inlineEdit: ["heading", "text"],
  defaultProps: { tone: "brand", heading: "Ready to get started?", text: "Talk to us today and see how we can help.", buttonLabel: "Contact us", buttonHref: "" },
  controls: [toneControl, { key: "heading", label: "Heading", type: "text" }, { key: "text", label: "Text", type: "textarea" }, { key: "buttonLabel", label: "Button", type: "text" }, { key: "buttonHref", label: "Button link", type: "link" }],
  Component: ({ attrs, props, node, ctx }) => <section {...attrs} className={`wb-section ${band(props.tone)}`}><div className="wb-container wb-center" style={{ maxWidth: 760 }}><T tag="h2" node={node} prop="heading" value={props.heading} ctx={ctx} />{props.text && <T tag="p" className="wb-lead" node={node} prop="text" value={props.text} ctx={ctx} />}<div className="wb-btns" style={{ justifyContent: "center", marginTop: 22 }}><Btn label={props.buttonLabel} href={props.buttonHref} variant={props.tone === "brand" || props.tone === "dark" ? "light" : "primary"} size="lg" ctx={ctx} /></div></div></section>,
});
registerComponent({
  type: "FAQ", label: "FAQ section", category: "Sections", keywords: ["questions", "help", "accordion"],
  defaultProps: { tone: "none", eyebrow: "", heading: "Frequently asked questions", text: "", items: [{ question: "What are your hours?", answer: "We are open Monday to Saturday, 9 am to 6 pm." }, { question: "How can I contact you?", answer: "Call, email or use the contact page." }, { question: "Where are you located?", answer: "Add your address here." }] },
  controls: [toneControl, ...headControls, { key: "items", label: "Questions", type: "items", fields: [{ key: "question", label: "Question", type: "text" }, { key: "answer", label: "Answer", type: "textarea" }] }],
  Component: ({ attrs, props, node, ctx }) => <section {...attrs} className={`wb-section ${band(props.tone)}`}><div className="wb-container" style={{ maxWidth: 820 }}><Head node={node} props={props} ctx={ctx} /><AccordionView attrs={{}} props={props} /></div></section>,
});
registerComponent({
  type: "ContactInfo", label: "Contact details", category: "Sections", keywords: ["address", "phone", "email", "hours", "map"],
  defaultProps: { tone: "none", eyebrow: "", heading: "Get in touch", text: "", address: "Your address, city", phone: "+91 00000 00000", email: "hello@example.com", hours: "Mon–Sat, 9 am – 6 pm", mapQuery: "" },
  controls: [toneControl, ...headControls, { key: "address", label: "Address", type: "textarea" }, { key: "phone", label: "Phone", type: "text" }, { key: "email", label: "Email", type: "text" }, { key: "hours", label: "Hours", type: "text" }, { key: "mapQuery", label: "Map place or address", type: "text" }],
  Component: ({ attrs, props, node, ctx }) => {
    const rows = [[MapPin, props.address, ""], [Phone, props.phone, `tel:${String(props.phone).replace(/[^+\d]/g, "")}`], [Mail, props.email, `mailto:${props.email}`], [Clock, props.hours, ""]].filter((r) => r[1]);
    const info = <div><Head node={node} props={props} ctx={ctx} left />{rows.map(([I, v, href], i) => <div className="wb-contact-row" key={i}><I size={20} aria-hidden="true" />{href ? <a href={safeHref(href)} onClick={ctx.mode === "editor" ? (e) => e.preventDefault() : undefined} className="wb-plain">{v}</a> : <span style={{ whiteSpace: "pre-line" }}>{v}</span>}</div>)}</div>;
    return <section {...attrs} className={`wb-section ${band(props.tone)}`}><div className="wb-container">{props.mapQuery ? <div className="wb-split">{info}<div className="wb-ratio" style={{ aspectRatio: "4/3" }}><iframe title="Map" loading="lazy" src={`https://www.google.com/maps?q=${encodeURIComponent(props.mapQuery)}&output=embed`} style={ctx.mode === "editor" ? { pointerEvents: "none" } : undefined} /></div></div> : info}</div></section>;
  },
});
registerComponent({
  type: "SocialLinks", label: "Social links", category: "Sections", keywords: ["facebook", "instagram", "linkedin", "follow"],
  defaultProps: { items: [{ label: "Instagram", href: "" }, { label: "Facebook", href: "" }, { label: "LinkedIn", href: "" }] },
  controls: [{ key: "items", label: "Links", type: "items", fields: [{ key: "label", label: "Name", type: "text" }, { key: "href", label: "Link", type: "link" }] }],
  Component: ({ attrs, props, ctx }) => <div {...attrs} className="wb-social">{(props.items || []).map((it, i) => <A key={i} href={it.href} ctx={ctx} newTab>{it.label}</A>)}</div>,
});

registerComponent({
  type: "Map", label: "Map", category: "Embeds", keywords: ["location", "google maps", "directions"],
  defaultProps: { query: "New Delhi" }, controls: [{ key: "query", label: "Place or address", type: "text" }],
  Component: ({ attrs, props, ctx }) => <div {...attrs}><div className="wb-ratio"><iframe title="Map" loading="lazy" src={`https://www.google.com/maps?q=${encodeURIComponent(props.query || "")}&output=embed`} style={ctx.mode === "editor" ? { pointerEvents: "none" } : undefined} /></div></div>,
});
registerComponent({
  type: "Embed", label: "Embed", category: "Embeds", keywords: ["youtube", "vimeo", "calendly", "spotify", "typeform"],
  defaultProps: { url: "", title: "Embedded content" }, controls: [{ key: "url", label: "Link (YouTube, Vimeo, Calendly, Spotify, Typeform, Google Maps)", type: "text" }, { key: "title", label: "Title", type: "text" }],
  Component: ({ attrs, props, ctx }) => { const src = embedUrl(props.url); return <div {...attrs}>{src ? <div className="wb-ratio"><iframe src={src} title={props.title || "Embed"} loading="lazy" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" style={ctx.mode === "editor" ? { pointerEvents: "none" } : undefined} /></div> : <div className="wb-ph">{props.url ? "This provider is not supported" : "Paste a link to embed"}</div>}</div>; },
});

/* ---- navigation (menus come from the website's Menus screen) ---- */
function MenuList({ items, ctx, open }) {
  const [sub, setSub] = useState(null);
  return (
    <ul className={`wb-menu ${open ? "open" : ""}`}>
      {(items || []).map((it) => {
        const kids = it.children || [];
        const mega = kids.some((k) => (k.children || []).length > 0);
        const current = it.href && it.href === ctx.path ? { "aria-current": "page" } : {};
        return (
          <li key={it.id}>
            {kids.length === 0 ? <A href={it.href} ctx={ctx} newTab={it.newTab} className={it.highlight ? "wb-btn primary sm" : ""} {...current}>{it.label}</A> : (
              <>
                <button type="button" className="wb-mi" aria-expanded={sub === it.id} onClick={() => setSub(sub === it.id ? null : it.id)} onKeyDown={(e) => e.key === "Escape" && setSub(null)}>{it.label}<ChevronDown size={14} aria-hidden="true" /></button>
                <ul className={`wb-sub ${mega ? "mega" : ""} ${sub === it.id ? "open" : ""}`} style={mega ? { "--cols": Math.min(4, kids.length) } : undefined}>
                  {kids.map((k) => (mega ? (
                    <li key={k.id}><div className="wb-sub-title">{k.label}</div><ul style={{ listStyle: "none", padding: 0, margin: 0 }}>{(k.children || []).map((g) => <li key={g.id}><A href={g.href} ctx={ctx} newTab={g.newTab}>{g.label}</A></li>)}</ul></li>
                  ) : (k.type === "heading" ? <li key={k.id} className="wb-sub-title">{k.label}</li> : <li key={k.id}><A href={k.href} ctx={ctx} newTab={k.newTab}>{k.label}</A></li>)))}
                </ul>
              </>)}
          </li>);
      })}
    </ul>);
}
function NavbarView({ attrs, props, ctx }) {
  const [open, setOpen] = useState(false);
  const logo = safeImage(props.logoUrl || ctx.site?.logoUrl);
  return (
    <header {...attrs} className="wb-nav"><div className="wb-container wb-nav-in">
      <A href="/" ctx={ctx} className="wb-logo">{logo ? <img src={logo} alt={props.logoText || ctx.site?.logoText || "Home"} /> : (props.logoText || ctx.site?.logoText || "Your brand")}</A>
      <nav aria-label="Main" style={{ marginLeft: "auto" }}><MenuList items={ctx.menus?.primary} ctx={ctx} open={open} /></nav>
      <button type="button" className="wb-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <MenuIcon size={20} />}</button>
      {props.ctaLabel && <span className="wb-nav-cta"><Btn label={props.ctaLabel} href={props.ctaHref} size="sm" ctx={ctx} /></span>}
    </div></header>);
}
registerComponent({
  type: "Navbar", label: "Navigation bar", category: "Navigation", keywords: ["header", "menu", "logo"],
  defaultProps: { logoText: "", logoUrl: "", ctaLabel: "", ctaHref: "" },
  controls: [{ key: "logoText", label: "Logo text", type: "text" }, { key: "logoUrl", label: "Logo image URL", type: "image" }, { key: "ctaLabel", label: "Button", type: "text" }, { key: "ctaHref", label: "Button link", type: "link" }],
  Component: NavbarView,
});
registerComponent({
  type: "Footer", label: "Footer", category: "Navigation", keywords: ["bottom", "copyright", "links"],
  defaultProps: { about: "A short line about your business.", contact: "", copyright: "" },
  controls: [{ key: "about", label: "About text", type: "textarea" }, { key: "contact", label: "Contact lines", type: "textarea" }, { key: "copyright", label: "Copyright", type: "text" }],
  Component: ({ attrs, props, ctx }) => (
    <footer {...attrs} className="wb-footer"><div className="wb-container">
      <div className="wb-grid" style={{ "--cols": 3 }}>
        <div><h6>{ctx.site?.logoText || "Your brand"}</h6><p>{props.about}</p></div>
        <div><h6>Links</h6><ul>{(ctx.menus?.footer?.length ? ctx.menus.footer : ctx.menus?.primary || []).filter((it) => it.href).map((it) => <li key={it.id}><A href={it.href} ctx={ctx} newTab={it.newTab}>{it.label}</A></li>)}</ul></div>
        <div><h6>Contact</h6><p style={{ whiteSpace: "pre-line" }}>{props.contact}</p></div>
      </div>
      <div className="wb-footer-bottom"><span>{props.copyright || `© ${new Date().getFullYear()} ${ctx.site?.name || ""}`}</span><span style={{ display: "flex", gap: 16 }}>{(ctx.menus?.legal || []).map((it) => <A key={it.id} href={it.href} ctx={ctx}>{it.label}</A>)}</span></div>
    </div></footer>),
});

/* ───────────── renderer ───────────── */
class NodeBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error(`[website] element "${this.props.type}" failed to render`, err); }
  render() {
    if (!this.state.failed) return this.props.children;
    // a broken element never takes the page down: an error card in the editor, nothing on the public site
    return this.props.mode === "editor" ? <div data-wb={this.props.id} className="wb-ph" style={{ minHeight: 60, color: "#b3261e" }}>This {this.props.type} element could not be shown</div> : null;
  }
}

/** What binding expressions can read at this point of the page. */
export const dataContext = (ctx) => ({ item: ctx.item || {}, page: ctx.pageInfo || {}, site: ctx.site || {}, query: ctx.query || {}, loop: ctx.loop || {} });
/** A record with the address of its own page, when the website has a "/x/:slug" page for its collection. */
function withUrl(item, source, ctx) {
  const tpl = ctx.itemPaths?.[String(source || "").replace(/^collection:/, "")];
  return tpl && item?.slug ? { ...item, url: tpl.replace(":slug", item.slug) } : item;
}

export function RenderNode({ node, ctx }) {
  const def = registry[node.type];
  if (!def) return ctx.mode === "editor" ? <div data-wb={node.id} className="wb-ph" style={{ minHeight: 60 }}>Unknown element: {node.type}</div> : null;
  const data = dataContext(ctx);
  // 1. conditions: hidden on the site, dimmed in the editor
  const shown = passes(node.conditions, data);
  if (!shown && ctx.mode !== "editor") return null;
  // 2. bindings: "{{ item.title }}" in any text property, plus the explicit bindings map
  const props = { ...def.defaultProps, ...(node.props || {}) };
  for (const key of Object.keys(props)) if (hasExpression(props[key])) props[key] = evaluate(props[key], data);
  for (const [key, expr] of Object.entries(node.bindings || {})) props[key] = evaluate(String(expr), data);
  // 3. repeat: draw the children once per record
  let children;
  const rep = node.repeat?.source ? node.repeat : null;
  const result = rep ? ctx.data?.[node.id] || { items: [], total: 0, page: 1, totalPages: 1 } : null;
  if (rep) {
    children = result.items.flatMap((item, i) => (node.children || []).map((c) => <RenderNode key={`${c.id}-${item.id ?? i}`} node={c} ctx={{ ...ctx, item: withUrl(item, rep.source, ctx), loop: { index: i, first: i === 0, last: i === result.items.length - 1, count: result.items.length } }} />));
  } else children = (node.children || []).map((c) => <RenderNode key={c.id} node={c} ctx={ctx} />);
  // 4. interactions: entrance animation (the site script reveals it when it scrolls into view)
  const anim = (node.interactions || []).find((i) => i.action === "animate");
  const attrs = { "data-wb": node.id, ...(anim && ctx.mode !== "editor" ? { "data-wb-anim": anim.animation || "fade-up" } : {}), ...(!shown ? { "data-wb-cond": "off" } : {}) };
  return (
    <NodeBoundary type={node.type} id={node.id} mode={ctx.mode}>
      <def.Component node={node} props={props} attrs={attrs} ctx={ctx} repeat={result}>{children}</def.Component>
    </NodeBoundary>);
}
