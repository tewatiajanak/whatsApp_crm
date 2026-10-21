import { useEffect, useState } from "react";
import { Modal, Chip } from "../ui";
import { labelCls } from "../lead/leadUtils";
import { FieldInput } from "./FormRenderer";
import { FIELD_GROUPS, FIELD_META, CHOICE_TYPES, LEAD_TARGETS, OPTION_SOURCES, SHOW_OPS, AUTO_MAP, newField, newId } from "./fieldTypes";

const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
function useDesktop() {
  const [d, setD] = useState(isDesktop);
  useEffect(() => { const m = window.matchMedia("(min-width: 1024px)"); const on = () => setD(m.matches); m.addEventListener("change", on); return () => m.removeEventListener("change", on); }, []);
  return d;
}

/* ───────────── the field's settings ───────────── */
function Props({ field, pages, pageIndex, update, moveToPage, usedMaps }) {
  const f = field;
  const all = pages.flatMap((p) => p.fields).filter((x) => x.id !== f.id && !["heading", "hidden"].includes(x.type));
  const dep = all.find((x) => x.id === f.showIf?.field);
  const set = (k, v) => update({ ...f, [k]: v });
  const numOrNull = (v) => (v === "" ? null : Number(v));
  const isChoice = CHOICE_TYPES.has(f.type);
  const answerless = f.type === "heading";
  const sameFamily = (t) => (isChoice ? CHOICE_TYPES.has(t) : ["text", "textarea", "email", "phone", "number", "url", "date", "time"].includes(f.type) ? ["text", "textarea", "email", "phone", "number", "url", "date", "time"].includes(t) : t === f.type);

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>{f.type === "heading" ? "Title" : f.type === "consent" ? "Text" : "Label"} *</label>
        {f.type === "consent" ? <textarea className="ui-input w-full" style={{ minHeight: 70, height: "auto", paddingTop: 6 }} value={f.label} onChange={(e) => set("label", e.target.value)} /> : <input className="ui-input w-full" autoFocus value={f.label} onChange={(e) => set("label", e.target.value)} />}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Type</label>
          <select className="ui-input w-full" value={f.type} onChange={(e) => update({ ...f, type: e.target.value, options: CHOICE_TYPES.has(e.target.value) && !f.options.length ? ["Option 1", "Option 2"] : f.options })}>
            {Object.values(FIELD_META).filter((t) => sameFamily(t.type)).map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Width</label>
          <select className="ui-input w-full" value={f.width} onChange={(e) => set("width", e.target.value)}><option value="full">Full</option><option value="half">Half</option></select>
        </div>
      </div>
      {!answerless && f.type !== "hidden" && (
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer"><input type="checkbox" className="form-check-input m-0" checked={f.required} onChange={(e) => set("required", e.target.checked)} />Required</label>
      )}

      {isChoice && (
        <div className="rounded-lg border p-2.5 space-y-2">
          <div>
            <label className={labelCls}>Options from</label>
            <select className="ui-input w-full" value={f.optionSource} onChange={(e) => set("optionSource", e.target.value)}>{OPTION_SOURCES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          </div>
          {f.optionSource === "custom" && (
            <div>
              <label className={labelCls}>Options · one per line</label>
              <textarea className="ui-input w-full font-mono text-xs" style={{ minHeight: 110, height: "auto", paddingTop: 6 }} value={(f.options || []).join("\n")} onChange={(e) => set("options", e.target.value.split("\n"))} onBlur={(e) => set("options", [...new Set(e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))])} />
            </div>
          )}
          {f.type === "select" && <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer"><input type="checkbox" className="form-check-input m-0" checked={f.multiple} onChange={(e) => set("multiple", e.target.checked)} />Pick many</label>}
          {f.type === "checkbox" && <div><label className={labelCls}>Most picks</label><input type="number" min="1" className="ui-input w-full" value={f.max ?? ""} onChange={(e) => set("max", numOrNull(e.target.value))} /></div>}
        </div>
      )}

      {!answerless && f.type !== "file" && f.type !== "signature" && f.type !== "consent" && (
        <div>
          <label className={labelCls}>Fills lead field</label>
          <select className="ui-input w-full" value={f.map} onChange={(e) => set("map", e.target.value)}>
            <option value="">None</option>
            {LEAD_TARGETS.map((t) => <option key={t.value} value={t.value} disabled={usedMaps.has(t.value) && f.map !== t.value}>{t.label}{usedMaps.has(t.value) && f.map !== t.value ? " · used" : ""}</option>)}
          </select>
        </div>
      )}

      {["text", "textarea", "number", "email", "phone", "url", "select", "radio", "hidden", "date", "time"].includes(f.type) && (
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelCls}>{f.type === "hidden" ? "Value" : "Default"}</label><input className="ui-input w-full" value={f.defaultValue} onChange={(e) => set("defaultValue", e.target.value)} /></div>
          <div><label className={labelCls} title="Fill this from the link, e.g. ?course=BBA">URL name</label><input className="ui-input w-full font-mono text-xs" value={f.param} onChange={(e) => set("param", e.target.value.replace(/[^a-zA-Z0-9_\-]/g, ""))} /></div>
        </div>
      )}

      {f.type === "number" && (
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelCls}>Min</label><input type="number" className="ui-input w-full" value={f.min ?? ""} onChange={(e) => set("min", numOrNull(e.target.value))} /></div>
          <div><label className={labelCls}>Max</label><input type="number" className="ui-input w-full" value={f.max ?? ""} onChange={(e) => set("max", numOrNull(e.target.value))} /></div>
        </div>
      )}
      {f.type === "rating" && <div><label className={labelCls}>Stars</label><select className="ui-input w-full" value={f.max || 5} onChange={(e) => set("max", Number(e.target.value))}>{[3, 4, 5, 7, 10].map((n) => <option key={n}>{n}</option>)}</select></div>}
      {["text", "textarea"].includes(f.type) && (
        <details className="rounded-lg border px-2.5 py-2" open={!!(f.minLength || f.maxLength || f.pattern)}>
          <summary className="text-xs font-semibold text-muted-foreground cursor-pointer">Validation</summary>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div><label className={labelCls}>Min length</label><input type="number" min="0" className="ui-input w-full" value={f.minLength ?? ""} onChange={(e) => set("minLength", numOrNull(e.target.value))} /></div>
            <div><label className={labelCls}>Max length</label><input type="number" min="1" className="ui-input w-full" value={f.maxLength ?? ""} onChange={(e) => set("maxLength", numOrNull(e.target.value))} /></div>
          </div>
          <div className="mt-2">
            <label className={labelCls}>Format</label>
            <select className="ui-input w-full" value={["", "[0-9]{6}", "[A-Z]{5}[0-9]{4}[A-Z]", "[0-9]{12}", "[A-Za-z ]+"].includes(f.pattern) ? f.pattern : "custom"} onChange={(e) => { const v = e.target.value; const msg = { "[0-9]{6}": "Enter a 6-digit PIN code", "[A-Z]{5}[0-9]{4}[A-Z]": "Enter a valid PAN", "[0-9]{12}": "Enter a 12-digit Aadhaar number", "[A-Za-z ]+": "Use letters only" }[v]; update({ ...f, pattern: v === "custom" ? f.pattern || ".*" : v, patternMessage: msg || f.patternMessage }); }}>
              <option value="">Any</option><option value="[0-9]{6}">PIN code</option><option value="[A-Z]{5}[0-9]{4}[A-Z]">PAN</option><option value="[0-9]{12}">Aadhaar</option><option value="[A-Za-z ]+">Letters only</option><option value="custom">Custom pattern</option>
            </select>
            {f.pattern && !["[0-9]{6}", "[A-Z]{5}[0-9]{4}[A-Z]", "[0-9]{12}", "[A-Za-z ]+"].includes(f.pattern) && <input className="ui-input w-full font-mono text-xs mt-2" aria-label="Pattern" value={f.pattern} onChange={(e) => set("pattern", e.target.value)} />}
            {f.pattern && <div className="mt-2"><label className={labelCls}>Error text</label><input className="ui-input w-full" value={f.patternMessage} onChange={(e) => set("patternMessage", e.target.value)} /></div>}
          </div>
        </details>
      )}

      {f.type === "file" && (
        <div className="rounded-lg border p-2.5 space-y-2">
          <div><label className={labelCls}>Allowed</label>
            <select className="ui-input w-full" value={[".pdf,image/*", "image/*", ".pdf", ".pdf,.doc,.docx", ""].includes(f.accept) ? f.accept : ".pdf,image/*"} onChange={(e) => set("accept", e.target.value)}>
              <option value=".pdf,image/*">PDF or image</option><option value="image/*">Image</option><option value=".pdf">PDF</option><option value=".pdf,.doc,.docx">PDF or Word</option><option value="">Any document</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 items-end">
            <div><label className={labelCls}>Max size (MB)</label><select className="ui-input w-full" value={f.maxSizeMb} onChange={(e) => set("maxSizeMb", Number(e.target.value))}>{[1, 2, 5, 10].map((n) => <option key={n}>{n}</option>)}</select></div>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer pb-2"><input type="checkbox" className="form-check-input m-0" checked={f.multiple} onChange={(e) => set("multiple", e.target.checked)} />Up to 5</label>
          </div>
        </div>
      )}

      {all.length > 0 && (
        <div className="rounded-lg border p-2.5 space-y-2">
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer"><input type="checkbox" className="form-check-input m-0" checked={!!f.showIf} onChange={(e) => set("showIf", e.target.checked ? { field: all[0].id, op: "eq", value: (all[0].options || [])[0] || "" } : null)} />Show only if</label>
          {f.showIf && (
            <>
              <select className="ui-input w-full" aria-label="Field" value={f.showIf.field} onChange={(e) => { const d = all.find((x) => x.id === e.target.value); set("showIf", { ...f.showIf, field: e.target.value, value: (d?.options || [])[0] || "" }); }}>
                {all.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select className="ui-input w-full" aria-label="Condition" value={f.showIf.op} onChange={(e) => set("showIf", { ...f.showIf, op: e.target.value })}>{SHOW_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                {["eq", "neq"].includes(f.showIf.op) && (
                  dep && (CHOICE_TYPES.has(dep.type) || dep.type === "yesno") && dep.optionSource === "custom"
                    ? <select className="ui-input w-full" aria-label="Value" value={f.showIf.value} onChange={(e) => set("showIf", { ...f.showIf, value: e.target.value })}>{(dep.type === "yesno" ? ["Yes", "No"] : dep.options).map((o) => <option key={o}>{o}</option>)}</select>
                    : <input className="ui-input w-full" aria-label="Value" value={f.showIf.value} onChange={(e) => set("showIf", { ...f.showIf, value: e.target.value })} />
                )}
              </div>
            </>
          )}
        </div>
      )}

      {pages.length > 1 && (
        <div><label className={labelCls}>Step</label><select className="ui-input w-full" value={pageIndex} onChange={(e) => moveToPage(Number(e.target.value))}>{pages.map((p, i) => <option key={p.id} value={i}>{i + 1}. {p.title}</option>)}</select></div>
      )}
      <div className="text-[11px] text-muted-foreground font-mono">ID {f.id}</div>
    </div>
  );
}

/* ───────────── the form's heading and buttons ───────────── */
function HeaderProps({ title, onTitle, theme = {}, onTheme, settings, onSettings }) {
  return (
    <div className="space-y-3">
      <div><label className={labelCls}>Heading *</label><input className="ui-input w-full" autoFocus value={title || ""} onChange={(e) => onTitle(e.target.value)} /></div>
      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer"><input type="checkbox" className="form-check-input m-0" checked={settings.showProgress !== false} onChange={(e) => onSettings({ showProgress: e.target.checked })} />Show steps and progress</label>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={labelCls}>Colour</label><div className="flex gap-1.5"><input type="color" className="ui-input p-1" style={{ width: 44 }} value={theme.color || "#0f766e"} onChange={(e) => onTheme({ color: e.target.value })} /><button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => onTheme({ color: "" })}>Theme</button></div></div>
        <div><label className={labelCls}>Width</label><select className="ui-input w-full" value={theme.width || "narrow"} onChange={(e) => onTheme({ width: e.target.value })}><option value="narrow">Narrow</option><option value="wide">Wide</option></select></div>
      </div>
      <div><label className={labelCls}>Logo link</label><input type="url" className="ui-input w-full" value={theme.logo || ""} onChange={(e) => onTheme({ logo: e.target.value })} /></div>
      <div><label className={labelCls}>Cover image link</label><input type="url" className="ui-input w-full" value={theme.cover || ""} onChange={(e) => onTheme({ cover: e.target.value })} /></div>
    </div>
  );
}
const ALIGNS = [{ v: "left", icon: "align-start", t: "Left" }, { v: "center", icon: "align-center", t: "Centre" }, { v: "right", icon: "align-end", t: "Right" }, { v: "full", icon: "arrow-left-right", t: "Full width" }];
function ButtonProps({ settings, onSettings, steps }) {
  const align = settings.buttonAlign || "right";
  return (
    <div className="space-y-3">
      <div><label className={labelCls}>Submit text *</label><input className="ui-input w-full" autoFocus value={settings.submitLabel ?? ""} onChange={(e) => onSettings({ submitLabel: e.target.value })} /></div>
      {steps > 1 && (
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelCls}>Next text</label><input className="ui-input w-full" value={settings.nextLabel ?? "Next"} onChange={(e) => onSettings({ nextLabel: e.target.value })} /></div>
          <div><label className={labelCls}>Back text</label><input className="ui-input w-full" value={settings.backLabel ?? "Back"} onChange={(e) => onSettings({ backLabel: e.target.value })} /></div>
        </div>
      )}
      <div>
        <label className={labelCls}>Position</label>
        <div className="grid grid-cols-4 gap-1 rounded-lg border p-1">
          {ALIGNS.map((a) => (
            <button key={a.v} type="button" title={a.t} aria-pressed={align === a.v} onClick={() => onSettings({ buttonAlign: a.v })} className={"ui-btn ui-btn-sm " + (align === a.v ? "ui-btn-primary" : "ui-btn-ghost")}><i className={`bi bi-${a.icon}`}></i></button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer"><input type="checkbox" className="form-check-input m-0" checked={!!settings.allowDraft} onChange={(e) => onSettings({ allowDraft: e.target.checked })} />Save for later button</label>
    </div>
  );
}

/* ───────────── the builder ───────────── */
export default function FormBuilder({ pages, setPages, title, theme, settings = {}, onSettings, onTitle, onTheme, resolved = [] }) {
  const submitLabel = settings.submitLabel, allowDraft = settings.allowDraft;
  const resolvedOptions = Object.fromEntries(resolved.flatMap((p) => p.fields || []).map((x) => [x.id, x.options || []]));
  const desktop = useDesktop();
  const [pi, setPi] = useState(0);
  const [sel, setSel] = useState(null);
  const [drag, setDrag] = useState(null); // { kind: "new", type } | { kind: "move", id }
  const [over, setOver] = useState(null); // index in the current page
  const [palette, setPalette] = useState(false);
  const page = pages[Math.min(pi, pages.length - 1)] || pages[0];
  const pIndex = Math.min(pi, pages.length - 1);
  const usedMaps = new Set(pages.flatMap((p) => p.fields).map((f) => f.map).filter(Boolean));

  const located = (() => { for (let i = 0; i < pages.length; i++) { const j = pages[i].fields.findIndex((f) => f.id === sel); if (j >= 0) return { i, j, f: pages[i].fields[j] }; } return null; })();

  const editPage = (i, fn) => setPages(pages.map((p, k) => (k === i ? fn(p) : p)));
  function add(type, at) {
    const f = newField(type);
    if (AUTO_MAP[type] && !usedMaps.has(AUTO_MAP[type])) f.map = AUTO_MAP[type];
    const pos = at ?? (located && located.i === pIndex ? located.j + 1 : page.fields.length);
    editPage(pIndex, (p) => { const fields = [...p.fields]; fields.splice(pos, 0, f); return { ...p, fields }; });
    setSel(f.id);
    setPalette(false);
  }
  const update = (f) => setPages(pages.map((p) => ({ ...p, fields: p.fields.map((x) => (x.id === f.id ? f : x)) })));
  function remove(id) {
    // a condition pointing at a removed field would hide its field for good
    setPages(pages.map((p) => ({ ...p, fields: p.fields.filter((x) => x.id !== id).map((x) => (x.showIf?.field === id ? { ...x, showIf: null } : x)) })));
    if (sel === id) setSel(null);
  }
  function duplicate(id) {
    const i = page.fields.findIndex((x) => x.id === id);
    const copy = { ...page.fields[i], id: newId(), label: `${page.fields[i].label} (copy)`, map: "" };
    editPage(pIndex, (p) => { const fields = [...p.fields]; fields.splice(i + 1, 0, copy); return { ...p, fields }; });
    setSel(copy.id);
  }
  function moveBy(id, d) {
    editPage(pIndex, (p) => { const fields = [...p.fields]; const i = fields.findIndex((x) => x.id === id); const j = i + d; if (j < 0 || j >= fields.length) return p; [fields[i], fields[j]] = [fields[j], fields[i]]; return { ...p, fields }; });
  }
  function moveTo(id, to) {
    editPage(pIndex, (p) => { const fields = [...p.fields]; const i = fields.findIndex((x) => x.id === id); if (i < 0) return p; const [f] = fields.splice(i, 1); fields.splice(to > i ? to - 1 : to, 0, f); return { ...p, fields }; });
  }
  function moveToPage(target) {
    if (!located || target === located.i) return;
    const f = located.f;
    setPages(pages.map((p, k) => (k === located.i ? { ...p, fields: p.fields.filter((x) => x.id !== f.id) } : k === target ? { ...p, fields: [...p.fields, f] } : p)));
    setPi(target);
  }
  function drop(at) {
    if (!drag) return;
    if (drag.kind === "new") add(drag.type, at); else moveTo(drag.id, at);
    setDrag(null); setOver(null);
  }

  const addPage = () => { setPages([...pages, { id: `p${Date.now().toString(36)}`, title: `Step ${pages.length + 1}`, fields: [] }]); setPi(pages.length); };
  const removePage = (i) => {
    if (pages.length < 2) return;
    const moved = pages[i].fields;
    const rest = pages.filter((_, k) => k !== i);
    const into = Math.max(0, i - 1);
    // fields on a removed step move to the step before, never lost
    setPages(rest.map((p, k) => (k === into ? { ...p, fields: [...p.fields, ...moved] } : p)));
    setPi(into);
  };
  const movePage = (i, d) => { const j = i + d; if (j < 0 || j >= pages.length) return; const next = [...pages]; [next[i], next[j]] = [next[j], next[i]]; setPages(next); setPi(j); };

  const Palette = (
    <div className="space-y-3">
      {FIELD_GROUPS.map((g) => (
        <div key={g.label}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{g.label}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {g.types.map((t) => (
              <button key={t.type} type="button" draggable onDragStart={() => setDrag({ kind: "new", type: t.type })} onDragEnd={() => { setDrag(null); setOver(null); }} onClick={() => add(t.type)}
                className="flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1.5 text-xs text-foreground hover:border-[var(--primary)] cursor-grab text-left">
                <i className={`bi bi-${t.icon} text-muted-foreground`}></i><span className="truncate">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[232px_1fr_300px] gap-3 items-start">
      {/* palette */}
      <aside className="hidden lg:block rounded-xl border bg-card p-3 sticky top-2">{Palette}</aside>

      {/* canvas */}
      <section className="min-w-0">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
          {pages.map((p, i) => (
            <button key={p.id} type="button" onClick={() => { setPi(i); }} onDragOver={(e) => { if (drag?.kind === "move") { e.preventDefault(); } }}
              onDrop={() => { if (drag?.kind === "move") { const f = pages.flatMap((x) => x.fields).find((x) => x.id === drag.id); if (f) { setSel(f.id); setPages(pages.map((pg, k) => (k === i ? { ...pg, fields: [...pg.fields.filter((x) => x.id !== f.id), f] } : { ...pg, fields: pg.fields.filter((x) => x.id !== f.id) }))); setPi(i); } setDrag(null); } }}
              className={"ui-btn ui-btn-sm flex-shrink-0 " + (i === pIndex ? "ui-btn-primary" : "ui-btn-outline")}>
              <span className="opacity-70">{i + 1}</span>{p.title}<span className="text-[10px] opacity-70">{p.fields.length}</span>
            </button>
          ))}
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm flex-shrink-0" onClick={addPage}><i className="bi bi-plus-lg"></i>Step</button>
        </div>

        {/* step name and step tools */}
        <div className="flex items-center gap-2 mb-2">
          <input className="ui-input flex-1 font-medium" aria-label="Step title" title="Step title" value={page.title} onChange={(e) => editPage(pIndex, (p) => ({ ...p, title: e.target.value }))} />
          {pages.length > 1 && <>
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Move step left" disabled={pIndex === 0} onClick={() => movePage(pIndex, -1)}><i className="bi bi-arrow-left"></i></button>
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Move step right" disabled={pIndex === pages.length - 1} onClick={() => movePage(pIndex, 1)}><i className="bi bi-arrow-right"></i></button>
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Remove step (its fields move to the step before)" onClick={() => removePage(pIndex)}><i className="bi bi-trash"></i></button>
          </>}
        </div>

        {/* the form, as people will see it */}
        <div className="rounded-xl border bg-card overflow-hidden" style={theme?.color ? { "--primary": theme.color, "--ring": `color-mix(in srgb, ${theme.color} 25%, transparent)` } : undefined}>
          {theme?.cover && <img src={theme.cover} alt="" className="w-full object-cover" style={{ maxHeight: 160 }} />}
          <div className="p-4 sm:p-6">
            <div onClick={() => setSel("__header")} className="relative group -mx-2.5 -mt-2 px-2.5 pt-2 pb-2.5 rounded-lg cursor-pointer border border-transparent hover:border-[var(--border)]" style={sel === "__header" ? { borderColor: "var(--primary)", boxShadow: "0 0 0 3px var(--ring)" } : undefined}>
            {theme?.logo && <img src={theme.logo} alt="" className="mb-3" style={{ height: 32, maxWidth: 140, objectFit: "contain" }} />}
            <h2 className="text-xl font-semibold text-foreground leading-tight m-0">{title || "Untitled form"}</h2>
            {pages.length > 1 && settings.showProgress !== false && (
              <div className="mt-4">
                <div className="hidden sm:flex items-center gap-1 mb-2">
                  {pages.map((p, i) => (
                    <button key={p.id} type="button" onClick={(e) => { e.stopPropagation(); setPi(i); }} className="flex items-center gap-1.5 text-xs font-medium flex-1 min-w-0 border-0 bg-transparent p-0 text-left" style={{ color: i <= pIndex ? "var(--primary)" : "var(--muted-foreground)" }}>
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0 text-[10px]" style={{ background: i < pIndex ? "var(--primary)" : "transparent", color: i < pIndex ? "#fff" : undefined, border: "1.5px solid currentColor" }}>{i < pIndex ? <i className="bi bi-check"></i> : i + 1}</span>
                      <span className="truncate">{p.title}</span>
                    </button>
                  ))}
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted-background, var(--muted))" }}><div className="h-full rounded-full" style={{ width: `${Math.round(((pIndex + 1) / pages.length) * 100)}%`, background: "var(--primary)" }} /></div>
              </div>
            )}

            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-5" style={{ minHeight: 160 }}
              onDragOver={(e) => { if (drag) { e.preventDefault(); if (!page.fields.length) setOver(0); } }} onDrop={() => drop(over ?? page.fields.length)}>
              {!page.fields.length && (
                <div className="sm:col-span-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground" style={over === 0 ? { borderColor: "var(--primary)" } : undefined}>
                  <span className="hidden lg:inline">Click or drag a field here</span>
                  <div className="lg:hidden"><button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => setPalette(true)}><i className="bi bi-plus-lg"></i>Add field</button></div>
                </div>
              )}
              {page.fields.map((f, i) => {
                const active = sel === f.id;
                const half = f.width === "half";
                const dep = f.showIf ? pages.flatMap((p) => p.fields).find((x) => x.id === f.showIf.field) : null;
                const opts = CHOICE_TYPES.has(f.type) && f.optionSource !== "custom" ? (resolvedOptions[f.id]?.length ? resolvedOptions[f.id] : [OPTION_SOURCES.find((o) => o.value === f.optionSource)?.label || "Options"]) : f.options;
                const shown = { ...f, options: opts };
                const before = drag && over === i;
                const after = drag && over === i + 1 && i === page.fields.length - 1;
                return (
                  <div key={f.id} className={"relative group " + (half ? "" : "sm:col-span-2")}
                    onDragOver={(e) => { if (drag) { e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setOver(e.clientY < r.top + r.height / 2 ? i : i + 1); } }}
                    onDrop={(e) => { e.stopPropagation(); drop(over ?? i); }}>
                    {before && <div className="absolute -top-1 left-0 right-0 h-0.5 rounded-full z-10" style={{ background: "var(--primary)" }} />}
                    {after && <div className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full z-10" style={{ background: "var(--primary)" }} />}
                    <div draggable onDragStart={() => setDrag({ kind: "move", id: f.id })} onDragEnd={() => { setDrag(null); setOver(null); }} onClick={() => setSel(f.id)}
                      className="rounded-lg px-2.5 pt-2 pb-2.5 cursor-pointer transition-colors border border-transparent hover:border-[var(--border)]"
                      style={{ ...(active ? { borderColor: "var(--primary)", boxShadow: "0 0 0 3px var(--ring)", background: "color-mix(in srgb, var(--primary) 3%, transparent)" } : {}), opacity: drag?.kind === "move" && drag.id === f.id ? 0.4 : 1 }}>
                      {/* tools, on hover or when chosen */}
                      <div className={"absolute top-1 right-1 z-10 items-center gap-0.5 rounded-md border bg-card shadow-sm px-0.5 " + (active ? "flex" : "hidden group-hover:flex")} onClick={(e) => e.stopPropagation()}>
                        <span className="px-1 text-muted-foreground cursor-grab hidden sm:inline" title="Drag"><i className="bi bi-grip-vertical"></i></span>
                        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" style={{ height: 24, width: 24 }} title="Up" disabled={i === 0} onClick={() => moveBy(f.id, -1)}><i className="bi bi-chevron-up"></i></button>
                        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" style={{ height: 24, width: 24 }} title="Down" disabled={i === page.fields.length - 1} onClick={() => moveBy(f.id, 1)}><i className="bi bi-chevron-down"></i></button>
                        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" style={{ height: 24, width: 24 }} title="Duplicate" onClick={() => duplicate(f.id)}><i className="bi bi-copy"></i></button>
                        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" style={{ height: 24, width: 24 }} title="Delete" onClick={() => remove(f.id)}><i className="bi bi-trash"></i></button>
                      </div>
                      {f.type === "heading" ? (
                        <div className="border-b pb-1.5 pt-1"><span className="text-base font-semibold text-foreground">{f.label || "Section"}</span></div>
                      ) : f.type === "hidden" ? (
                        <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground"><i className="bi bi-eye-slash"></i>{f.label || "Hidden value"}{f.defaultValue ? ` = ${f.defaultValue}` : ""}{f.param ? ` · ?${f.param}=` : ""}</div>
                      ) : (
                        <>
                          {f.type !== "consent" && <div className="block text-sm font-medium text-foreground mb-1.5 pr-28">{f.label || <span className="text-muted-foreground">Untitled</span>}{f.required && <span style={{ color: "var(--destructive)" }}> *</span>}</div>}
                          <div className="pointer-events-none select-none" aria-hidden="true">
                            <FieldInput f={shown} value={f.type === "checkbox" ? [] : f.defaultValue || ""} set={() => {}} files={{}} setFiles={() => {}} invalid={false} />
                          </div>
                        </>
                      )}
                      {(f.map || dep) && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {f.map && <Chip color="var(--primary)" icon="person">{LEAD_TARGETS.find((t) => t.value === f.map)?.label}</Chip>}
                          {dep && <Chip color="var(--warning)" icon="signpost-split">Shown if {dep.label}</Chip>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {page.fields.length > 0 && <button type="button" className="ui-btn ui-btn-outline ui-btn-sm w-full mt-2 lg:hidden" onClick={() => setPalette(true)}><i className="bi bi-plus-lg"></i>Add field</button>}

            {/* the buttons people will see — click to change them */}
            <div onClick={() => setSel("__submit")} className={"relative group -mx-2.5 mt-4 px-2.5 py-2.5 rounded-lg cursor-pointer border border-transparent hover:border-[var(--border)] flex flex-wrap items-center gap-2 " + ((settings.buttonAlign || "right") === "center" ? "justify-center" : "")}
              style={sel === "__submit" ? { borderColor: "var(--primary)", boxShadow: "0 0 0 3px var(--ring)" } : undefined}>
              {pIndex > 0 && <span className="ui-btn ui-btn-outline pointer-events-none"><i className="bi bi-arrow-left"></i>{settings.backLabel || "Back"}</span>}
              {allowDraft && <span className="ui-btn ui-btn-ghost pointer-events-none"><i className="bi bi-bookmark"></i>Save for later</span>}
              <span className={"ui-btn ui-btn-primary pointer-events-none " + ({ right: "ms-auto", full: "flex-1 justify-center" }[settings.buttonAlign || "right"] || "")} style={{ minWidth: 120 }}>{pIndex === pages.length - 1 ? submitLabel || "Submit" : <>{settings.nextLabel || "Next"}<i className="bi bi-arrow-right"></i></>}</span>
            </div>
          </div>
        </div>
      </section>

      {/* settings of the chosen field, heading or buttons */}
      {(() => {
        const special = sel === "__header" ? { title: "Heading", body: <HeaderProps title={title} onTitle={onTitle} theme={theme} onTheme={onTheme} settings={settings} onSettings={onSettings} /> }
          : sel === "__submit" ? { title: "Buttons", body: <ButtonProps settings={settings} onSettings={onSettings} steps={pages.length} /> }
          : located ? { title: FIELD_META[located.f.type]?.label || "Field", body: <Props key={located.f.id} field={located.f} pages={pages} pageIndex={located.i} update={update} moveToPage={moveToPage} usedMaps={usedMaps} /> } : null;
        if (desktop) return (
          <aside className="rounded-xl border bg-card p-3 sticky top-2" style={{ maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
            {special ? (
              <>
                <div className="flex items-center justify-between mb-2"><span className="text-sm font-semibold text-foreground">{special.title}</span><button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Close" onClick={() => setSel(null)}><i className="bi bi-x-lg"></i></button></div>
                {special.body}
              </>
            ) : <div className="text-sm text-muted-foreground text-center py-10"><i className="bi bi-hand-index d-block mb-1" style={{ fontSize: 20 }}></i>Click any part of the form</div>}
          </aside>
        );
        return special && <Modal title={special.title} onClose={() => setSel(null)} footer={<button type="button" className="ui-btn ui-btn-primary" onClick={() => setSel(null)}>Done</button>}>{special.body}</Modal>;
      })()}
      {palette && <Modal title="Add field" onClose={() => setPalette(false)}>{Palette}</Modal>}
    </div>
  );
}
