// Binding expressions: "Price: {{ item.price | currency:"INR" }}".
// A tiny template language — parsed and evaluated here, never with eval or new Function.
//   {{ path }}  {{ path | filter }}  {{ path | filter:arg1,arg2 }}
// Paths use dots and [index] only. Allowed roots: item, page, site, query, loop.

const ROOTS = new Set(["item", "page", "site", "query", "loop"]);
const BLOCKED = new Set(["__proto__", "constructor", "prototype"]);
const MAX_LENGTH = 500;
const MAX_FILTERS = 20;
const MAX_DEPTH = 10;

function parsePath(src) {
  const parts = [];
  const rx = /([A-Za-z_][A-Za-z0-9_]*)|\[(\d+)\]|(\.)/y;
  let pos = 0, expectName = true;
  while (pos < src.length) {
    rx.lastIndex = pos;
    const m = rx.exec(src);
    if (!m) return null;
    if (m[3]) { if (expectName) return null; expectName = true; }
    else if (m[1]) { if (!expectName) return null; parts.push(m[1]); expectName = false; }
    else { if (expectName && parts.length === 0) return null; parts.push(Number(m[2])); expectName = false; }
    pos = rx.lastIndex;
  }
  if (expectName || !parts.length || parts.length > MAX_DEPTH) return null;
  if (!ROOTS.has(parts[0]) || parts.some((p) => BLOCKED.has(p))) return null;
  return parts;
}

/** Split on a separator, ignoring separators inside quotes. */
function split(src, sep) {
  const out = [];
  let cur = "", quote = null;
  for (const ch of src) {
    if (quote) { cur += ch; if (ch === quote) quote = null; }
    else if (ch === '"' || ch === "'") { quote = ch; cur += ch; }
    else if (ch === sep) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
const unquote = (s) => { const t = s.trim(); return /^(".*"|'.*')$/.test(t) ? t.slice(1, -1) : /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t; };

function getPath(ctx, parts) {
  let cur = ctx;
  for (const key of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    if (!Object.prototype.hasOwnProperty.call(cur, key)) return undefined;
    cur = cur[key];
  }
  return cur;
}

const pad = (n) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const FILTERS = {
  default: (v, fallback = "") => (v == null || v === "" || (Array.isArray(v) && !v.length) ? fallback : v),
  upper: (v) => String(v ?? "").toUpperCase(),
  lower: (v) => String(v ?? "").toLowerCase(),
  capitalize: (v) => { const s = String(v ?? ""); return s.charAt(0).toUpperCase() + s.slice(1); },
  truncate: (v, n = 120) => { const s = String(v ?? ""); const max = Math.max(1, Number(n) || 120); return s.length > max ? s.slice(0, max).trimEnd() + "…" : s; },
  date: (v, format = "dd-mm-yyyy") => {
    const d = new Date(v);
    if (!v || isNaN(d)) return "";
    return String(format).replace(/yyyy/g, d.getFullYear()).replace(/mmm/g, MONTHS[d.getMonth()]).replace(/mm/g, pad(d.getMonth() + 1)).replace(/dd/g, pad(d.getDate()));
  },
  number: (v, digits = 0) => { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString("en-IN", { minimumFractionDigits: Number(digits) || 0, maximumFractionDigits: Number(digits) || 0 }) : ""; },
  currency: (v, code = "INR") => { const n = Number(v); if (!Number.isFinite(n)) return ""; try { return n.toLocaleString("en-IN", { style: "currency", currency: String(code), maximumFractionDigits: 0 }); } catch { return String(n); } },
  percent: (v) => { const n = Number(v); return Number.isFinite(n) ? `${n}%` : ""; },
  join: (v, sep = ", ") => (Array.isArray(v) ? v.join(String(sep)) : String(v ?? "")),
  first: (v) => (Array.isArray(v) ? v[0] : v),
  last: (v) => (Array.isArray(v) ? v[v.length - 1] : v),
  count: (v) => (Array.isArray(v) ? v.length : v == null ? 0 : String(v).length),
  slugify: (v) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
  stripHtml: (v) => String(v ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
};

/** Parse one "{{ … }}" body into { path, filters } or null when it is not valid. */
function parseExpr(body) {
  const [head, ...rest] = split(body, "|");
  const path = parsePath(head.trim());
  if (!path || rest.length > MAX_FILTERS) return null;
  const filters = [];
  for (const raw of rest) {
    const [name, ...argParts] = split(raw.trim(), ":");
    const fn = name.trim();
    if (!Object.prototype.hasOwnProperty.call(FILTERS, fn)) return null;
    filters.push({ fn, args: argParts.length ? split(argParts.join(":"), ",").map(unquote) : [] });
  }
  return { path, filters };
}

const TEMPLATE = /\{\{([^{}]*)\}\}/g;
export const hasExpression = (v) => typeof v === "string" && v.includes("{{");

function evalExpr(expr, ctx) {
  let value = getPath(ctx, expr.path);
  for (const f of expr.filters) value = FILTERS[f.fn](value, ...f.args);
  return value;
}

/**
 * Evaluate a template against a context. A template that is exactly one expression
 * returns the raw value (so numbers and arrays survive); mixed text returns a string.
 * Unknown paths give "" — never an error.
 */
export function evaluate(template, ctx) {
  if (!hasExpression(template) || template.length > MAX_LENGTH) return template;
  const whole = template.match(/^\s*\{\{([^{}]*)\}\}\s*$/);
  if (whole) {
    const expr = parseExpr(whole[1]);
    const value = expr ? evalExpr(expr, ctx) : "";
    return value == null ? "" : value;
  }
  return template.replace(TEMPLATE, (_m, body) => {
    const expr = parseExpr(body);
    const value = expr ? evalExpr(expr, ctx) : "";
    return value == null || typeof value === "object" ? (Array.isArray(value) ? value.join(", ") : "") : String(value);
  });
}

/** Problems in a template, for the binding editor: [] when it is fine. */
export function validate(template, fieldKeys = null) {
  if (typeof template !== "string" || !hasExpression(template)) return [];
  if (template.length > MAX_LENGTH) return ["Expression is too long"];
  const problems = [];
  for (const m of template.matchAll(TEMPLATE)) {
    const expr = parseExpr(m[1]);
    if (!expr) { problems.push(`"${m[1].trim()}" is not a valid expression`); continue; }
    if (fieldKeys && expr.path[0] === "item" && expr.path[1] !== undefined && !fieldKeys.includes(expr.path[1])) problems.push(`Unknown field "${expr.path[1]}"`);
  }
  if ((template.match(/\{\{/g) || []).length !== (template.match(/\}\}/g) || []).length) problems.push("A {{ is not closed");
  return problems;
}

const OPS = {
  eq: (a, b) => String(a ?? "") === String(b ?? ""),
  neq: (a, b) => String(a ?? "") !== String(b ?? ""),
  gt: (a, b) => Number(a) > Number(b),
  gte: (a, b) => Number(a) >= Number(b),
  lt: (a, b) => Number(a) < Number(b),
  lte: (a, b) => Number(a) <= Number(b),
  contains: (a, b) => (Array.isArray(a) ? a.map(String).includes(String(b)) : String(a ?? "").toLowerCase().includes(String(b ?? "").toLowerCase())),
  notContains: (a, b) => !OPS.contains(a, b),
  empty: (a) => a == null || a === "" || a === false || (Array.isArray(a) && !a.length),
  notEmpty: (a) => !OPS.empty(a),
  startsWith: (a, b) => String(a ?? "").toLowerCase().startsWith(String(b ?? "").toLowerCase()),
};
export const CONDITION_OPS = [["eq", "equals"], ["neq", "does not equal"], ["gt", "greater than"], ["gte", "at least"], ["lt", "less than"], ["lte", "at most"], ["contains", "contains"], ["notContains", "does not contain"], ["empty", "is empty"], ["notEmpty", "is not empty"], ["startsWith", "starts with"]];

/** { match: "all" | "any", rules: [{ left, op, right }] } → should the node be shown? */
export function passes(conditions, ctx) {
  const rules = conditions?.rules;
  if (!Array.isArray(rules) || !rules.length) return true;
  const test = (r) => { const op = OPS[r.op]; return op ? !!op(evaluate(String(r.left ?? ""), ctx), evaluate(String(r.right ?? ""), ctx)) : true; };
  return conditions.match === "any" ? rules.some(test) : rules.every(test);
}
