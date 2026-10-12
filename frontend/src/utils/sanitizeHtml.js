// Cleans HTML written in the form builder's text editor before it is shown to
// anyone: only formatting tags and safe attributes survive.

const TAGS = new Set([
  "P", "DIV", "SPAN", "BR", "HR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SUB", "SUP",
  "H1", "H2", "H3", "H4", "BLOCKQUOTE", "UL", "OL", "LI", "A", "FONT",
]);
const DROP_WITH_CONTENT = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "NOSCRIPT", "SVG", "MATH", "FORM", "TEXTAREA", "SELECT", "BUTTON", "INPUT", "LINK", "META"]);
const ATTRS = new Set(["style", "href", "align", "color", "face", "size"]);
const STYLE_PROPS = new Set([
  "color", "background-color", "font-family", "font-size", "font-weight", "font-style",
  "text-decoration", "text-decoration-line", "text-align", "line-height", "margin-left", "padding-left",
]);

function cleanStyle(el) {
  const kept = [];
  for (const prop of Array.from(el.style)) {
    const value = el.style.getPropertyValue(prop);
    if (STYLE_PROPS.has(prop) && !/url\(|expression|javascript:/i.test(value)) kept.push(`${prop}:${value}`);
  }
  if (kept.length) el.setAttribute("style", kept.join(";"));
  else el.removeAttribute("style");
}

function clean(node) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE || DROP_WITH_CONTENT.has(child.tagName)) {
      child.remove();
      continue;
    }
    clean(child);
    if (!TAGS.has(child.tagName)) {
      // unknown tag: keep its (already cleaned) content, drop the tag itself
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }
    for (const attr of Array.from(child.attributes)) {
      if (!ATTRS.has(attr.name.toLowerCase())) child.removeAttribute(attr.name);
    }
    if (child.hasAttribute("style")) cleanStyle(child);
    if (child.tagName === "A") {
      const href = (child.getAttribute("href") || "").trim();
      if (!/^(https?:|mailto:|tel:)/i.test(href)) child.removeAttribute("href");
      else {
        child.setAttribute("target", "_blank");
        child.setAttribute("rel", "noopener noreferrer");
      }
    }
  }
}

export function sanitizeHtml(html) {
  if (!html) return "";
  // no DOM on the server: send the text only (the browser redraws it with full formatting)
  if (typeof DOMParser === "undefined") return textToHtml(String(html).replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim());
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  clean(doc.body);
  return doc.body.innerHTML;
}

/** Plain text typed before the editor existed, shown as HTML. */
export function textToHtml(text) {
  return String(text || "")
    .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))
    .replace(/\n/g, "<br>");
}
