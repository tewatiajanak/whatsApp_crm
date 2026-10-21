import { useEffect, useMemo, useRef, useState } from "react";
import DateInput from "../DateInput";
import { money } from "../lead/leadUtils";

/* Shared by the public form page, the embed and the builder preview.
   The server checks every answer again; these checks only save a round trip. */

export const ANSWERLESS = new Set(["heading"]);
const isEmpty = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length) || v === false;
const PHONE_OK = (v) => String(v || "").replace(/\D/g, "").length >= 10 && String(v || "").replace(/\D/g, "").length <= 15;
const EMAIL_OK = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ""));

export function isVisible(f, data, byId, seen = new Set()) {
  if (!f.showIf || !f.showIf.field) return true;
  if (seen.has(f.id)) return false;
  seen.add(f.id);
  const dep = byId.get(f.showIf.field);
  if (!dep || !isVisible(dep, data, byId, seen)) return f.showIf.op === "empty";
  const v = data[dep.id];
  const has = (x) => (Array.isArray(v) ? v.map(String).includes(x) : String(v ?? "") === x);
  if (f.showIf.op === "eq") return has(f.showIf.value);
  if (f.showIf.op === "neq") return !has(f.showIf.value);
  if (f.showIf.op === "filled") return !isEmpty(v);
  if (f.showIf.op === "empty") return isEmpty(v);
  return true;
}

function checkField(f, v, files) {
  if (f.type === "file") {
    const list = files[f.id] || [];
    if (!list.length) return f.required ? `${f.label} is required` : "";
    for (const x of list) if (x.size > (f.maxSizeMb || 5) * 1024 * 1024) return `File is larger than ${f.maxSizeMb || 5} MB`;
    return "";
  }
  if (isEmpty(v)) return f.required ? (f.type === "consent" ? "Please tick to continue" : `${f.label} is required`) : "";
  const n = Number(v);
  if (f.type === "email" && !EMAIL_OK(v)) return "Enter a valid email address";
  if (f.type === "phone" && !PHONE_OK(v)) return "Enter a valid phone number";
  if (f.type === "url" && !/^https?:\/\/\S+\.\S+/i.test(v)) return "Enter a full link starting with http:// or https://";
  if (f.type === "number") {
    if (!Number.isFinite(n)) return `${f.label} must be a number`;
    if (f.min !== null && f.min !== undefined && n < f.min) return `${f.label} must be at least ${f.min}`;
    if (f.max !== null && f.max !== undefined && n > f.max) return `${f.label} must be at most ${f.max}`;
  }
  if (["text", "textarea"].includes(f.type)) {
    if (f.minLength && v.length < f.minLength) return `${f.label} needs at least ${f.minLength} characters`;
    if (f.maxLength && v.length > f.maxLength) return `${f.label} can have at most ${f.maxLength} characters`;
  }
  if (f.type === "checkbox" && f.max && v.length > f.max) return `Pick up to ${f.max}`;
  if (f.pattern && typeof v === "string") {
    try { if (!new RegExp(`^(?:${f.pattern})$`).test(v)) return f.patternMessage || `${f.label} is not in the right format`; } catch { /* the server checks */ }
  }
  return "";
}

function SignaturePad({ value, onChange, invalid }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  useEffect(() => {
    const c = ref.current;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio; c.height = 140 * ratio;
    const ctx = c.getContext("2d");
    ctx.scale(ratio, ratio); ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#111";
    if (value && value.startsWith("data:image/")) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, c.offsetWidth, 140); img.src = value; }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pos = (e) => { const r = ref.current.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return [p.clientX - r.left, p.clientY - r.top]; };
  const start = (e) => { e.preventDefault(); drawing.current = true; const ctx = ref.current.getContext("2d"); ctx.beginPath(); ctx.moveTo(...pos(e)); };
  const move = (e) => { if (!drawing.current) return; e.preventDefault(); const ctx = ref.current.getContext("2d"); ctx.lineTo(...pos(e)); ctx.stroke(); };
  const end = () => { if (!drawing.current) return; drawing.current = false; onChange(ref.current.toDataURL("image/png")); };
  const clear = () => { const c = ref.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); onChange(""); };
  return (
    <div>
      <canvas ref={ref} className="w-full rounded-lg border bg-white touch-none" style={{ height: 140, borderColor: invalid ? "var(--destructive)" : undefined, cursor: "crosshair" }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      <div className="flex justify-end mt-1"><button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={clear}><i className="bi bi-eraser"></i>Clear</button></div>
    </div>
  );
}

export function FieldInput({ f, value, set, files, setFiles, invalid }) {
  const cls = "ui-input w-full" + (invalid ? " is-invalid" : "");
  const style = invalid ? { borderColor: "var(--destructive)" } : undefined;
  const id = `ff-${f.id}`;
  switch (f.type) {
    case "textarea": return <textarea id={id} className={cls} style={{ ...style, minHeight: 96, height: "auto", paddingTop: 8 }} value={value || ""} maxLength={f.maxLength || 5000} onChange={(e) => set(e.target.value)} />;
    case "email": return <input id={id} type="email" inputMode="email" autoComplete="email" className={cls} style={style} value={value || ""} onChange={(e) => set(e.target.value)} />;
    case "phone": return <input id={id} type="tel" inputMode="tel" autoComplete="tel" className={cls} style={style} value={value || ""} onChange={(e) => set(e.target.value.replace(/[^\d+\-\s()]/g, ""))} />;
    case "number": return <input id={id} type="number" inputMode="decimal" className={cls} style={style} value={value ?? ""} min={f.min ?? undefined} max={f.max ?? undefined} onChange={(e) => set(e.target.value)} />;
    case "url": return <input id={id} type="url" inputMode="url" className={cls} style={style} value={value || ""} onChange={(e) => set(e.target.value)} />;
    case "date": return <DateInput id={id} className={cls} style={style} value={value || ""} onChange={(e) => set(e.target.value)} />;
    case "time": return <input id={id} type="time" className={cls} style={style} value={value || ""} onChange={(e) => set(e.target.value)} />;
    case "select":
      return (
        <select id={id} className={cls} style={style} value={value || ""} onChange={(e) => set(e.target.value)}>
          <option value="">Select</option>
          {(f.options || []).map((o) => <option key={o}>{o}</option>)}
        </select>
      );
    case "radio":
      return (
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {(f.options || []).map((o) => (
            <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => set(o)}
              className={"ui-btn " + (value === o ? "ui-btn-primary" : "ui-btn-outline")} style={invalid && value !== o ? { borderColor: "var(--destructive)" } : undefined}>{o}</button>
          ))}
        </div>
      );
    case "checkbox": {
      const list = Array.isArray(value) ? value : [];
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {(f.options || []).map((o) => (
            <label key={o} className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-sm text-foreground" style={list.includes(o) ? { borderColor: "var(--primary)", background: "color-mix(in srgb, var(--primary) 6%, transparent)" } : undefined}>
              <input type="checkbox" className="form-check-input m-0" checked={list.includes(o)} onChange={(e) => set(e.target.checked ? [...list, o] : list.filter((x) => x !== o))} />{o}
            </label>
          ))}
        </div>
      );
    }
    case "yesno":
      return <div className="flex gap-2">{["Yes", "No"].map((o) => <button key={o} type="button" onClick={() => set(o)} className={"ui-btn " + (value === o ? "ui-btn-primary" : "ui-btn-outline")} style={{ minWidth: 80 }}>{o}</button>)}</div>;
    case "rating": {
      const max = f.max || 5;
      return (
        <div className="flex gap-1">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" className="ui-btn ui-btn-ghost ui-btn-icon" aria-label={`${n} of ${max}`} onClick={() => set(n)}>
              <i className={`bi bi-star${Number(value) >= n ? "-fill" : ""}`} style={{ fontSize: 22, color: Number(value) >= n ? "var(--warning)" : "var(--muted-foreground)" }}></i>
            </button>
          ))}
        </div>
      );
    }
    case "file": {
      const list = files[f.id] || [];
      return (
        <div>
          {list.map((x, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2 mb-1.5 text-sm">
              <i className={`bi bi-${/^image\//.test(x.type) ? "image" : "file-earmark-text"} text-muted-foreground`}></i>
              <span className="truncate flex-1 text-foreground">{x.name}</span>
              <span className="text-xs text-muted-foreground">{(x.size / 1024 / 1024).toFixed(1)} MB</span>
              <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" aria-label="Remove" onClick={() => setFiles(list.filter((_, j) => j !== i))}><i className="bi bi-x-lg"></i></button>
            </div>
          ))}
          {(f.multiple || !list.length) && (
            <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 cursor-pointer text-sm text-muted-foreground hover:text-foreground" style={invalid ? { borderColor: "var(--destructive)" } : undefined}>
              <i className="bi bi-upload"></i>Choose file
              <input type="file" className="d-none" accept={f.accept || undefined} multiple={!!f.multiple} onChange={(e) => { setFiles([...list, ...Array.from(e.target.files || [])].slice(0, f.multiple ? 5 : 1)); e.target.value = ""; }} />
            </label>
          )}
          <div className="text-[11px] text-muted-foreground mt-1">{[f.accept && f.accept.replace(/image\/\*/g, "Images").replace(/,/g, ", "), `Max ${f.maxSizeMb || 5} MB`].filter(Boolean).join(" · ")}</div>
        </div>
      );
    }
    case "signature": return <SignaturePad value={value} onChange={set} invalid={invalid} />;
    case "consent":
      return (
        <label className="flex items-start gap-2 cursor-pointer text-sm text-foreground">
          <input type="checkbox" className="form-check-input mt-0.5" checked={!!value} onChange={(e) => set(e.target.checked)} style={invalid ? { borderColor: "var(--destructive)" } : undefined} />
          <span>{f.label}{f.required && <span style={{ color: "var(--destructive)" }}> *</span>}</span>
        </label>
      );
    default: return <input id={id} type="text" className={cls} style={style} value={value || ""} maxLength={f.maxLength || 2000} autoComplete={f.map === "name" ? "name" : f.map === "city" ? "address-level2" : undefined} onChange={(e) => set(e.target.value)} />;
  }
}

/**
 * form: { title, pages, theme, settings, logo, organisation }
 * onSubmit(data, files, page) → { refNo, message, payUrl, receipt, redirectUrl } — throws { message, details.fields }
 * onDraft(data, page) → { link } (optional)
 */
export default function FormRenderer({ form, initial = {}, initialPage = 0, onSubmit, onDraft, onFirstInput, preview = false, embedded = false }) {
  const pages = form.pages || [];
  const all = useMemo(() => pages.flatMap((p) => p.fields), [pages]);
  const byId = useMemo(() => new Map(all.map((f) => [f.id, f])), [all]);
  const [data, setData] = useState(() => {
    const d = { ...initial };
    for (const f of all) if (d[f.id] === undefined && f.defaultValue && !ANSWERLESS.has(f.type) && f.type !== "file") d[f.id] = f.type === "checkbox" ? [f.defaultValue] : f.defaultValue;
    return d;
  });
  const [files, setFilesState] = useState({});
  const [page, setPage] = useState(Math.min(initialPage, Math.max(0, pages.length - 1)));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState(null);
  const [draftLink, setDraftLink] = useState("");
  const [hp, setHp] = useState("");
  const touched = useRef(false);
  const top = useRef(null);

  const set = (id, v) => {
    if (!touched.current) { touched.current = true; onFirstInput?.(); }
    setData((d) => ({ ...d, [id]: v }));
    setErrors((e) => (e[id] ? { ...e, [id]: "" } : e));
  };
  const setFiles = (id, list) => { setFilesState((x) => ({ ...x, [id]: list })); setErrors((e) => (e[id] ? { ...e, [id]: "" } : e)); };

  const shown = (p) => (pages[p]?.fields || []).filter((f) => isVisible(f, data, byId));
  const validate = (p) => {
    const errs = {};
    for (const f of shown(p)) if (!ANSWERLESS.has(f.type) && f.type !== "hidden") { const m = checkField(f, data[f.id], files); if (m) errs[f.id] = m; }
    setErrors(errs);
    if (Object.keys(errs).length) setTimeout(() => document.getElementById(`ffw-${Object.keys(errs)[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
    return !Object.keys(errs).length;
  };
  const scrollTop = () => top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const next = () => { if (validate(page)) { setPage((p) => Math.min(pages.length - 1, p + 1)); scrollTop(); } };
  const back = () => { setPage((p) => Math.max(0, p - 1)); scrollTop(); };

  const fee = form.settings?.fee;
  const amount = fee ? (fee.amountFrom && fee.amounts && Object.prototype.hasOwnProperty.call(fee.amounts, String(data[fee.amountFrom] ?? "")) ? Number(fee.amounts[String(data[fee.amountFrom])]) : Number(fee.amount) || 0) : 0;
  const last = page === pages.length - 1;
  const align = form.settings?.buttonAlign || "right";

  async function submit(e) {
    e.preventDefault();
    if (!last) return next();
    if (!validate(page)) return;
    // fields on earlier steps can be hidden or changed by a later answer: check them all once more
    for (let p = 0; p < pages.length; p++) if (!validate(p)) { setPage(p); return; }
    const clean = {};
    for (const f of all) if (!ANSWERLESS.has(f.type) && f.type !== "file" && isVisible(f, data, byId) && data[f.id] !== undefined) clean[f.id] = data[f.id];
    if (preview) { setDone({ refNo: "PREVIEW", message: form.settings?.successMessage || "", preview: true }); return; }
    setBusy(true); setProblem("");
    try {
      const out = await onSubmit(clean, files, hp);
      if (out?.redirectUrl && !out.payUrl) { window.location.href = out.redirectUrl; return; }
      setDone(out || {});
      scrollTop();
    } catch (err) {
      const fields = err.details?.fields || {};
      if (Object.keys(fields).length) {
        setErrors(fields);
        const p = pages.findIndex((pg) => pg.fields.some((f) => fields[f.id]));
        if (p >= 0) setPage(p);
      }
      setProblem(err.message || "Could not submit. Try again.");
    } finally { setBusy(false); }
  }

  async function saveDraft() {
    if (preview || !onDraft) return;
    setBusy(true); setProblem("");
    try { const out = await onDraft(data, page); setDraftLink(out.link); }
    catch (err) { setProblem(err.message); }
    finally { setBusy(false); }
  }

  const color = form.theme?.color;
  const wrapStyle = color ? { "--primary": color, "--ring": `color-mix(in srgb, ${color} 25%, transparent)` } : undefined;
  const maxW = form.theme?.width === "wide" ? 860 : 640;

  if (done) {
    return (
      <div ref={top} style={{ ...wrapStyle, maxWidth: maxW }} className="w-full mx-auto">
        <div className="rounded-xl border bg-card p-6 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-3" style={{ background: "var(--success-bg, color-mix(in srgb, var(--success) 12%, transparent))", color: "var(--success)" }}><i className="bi bi-check-lg" style={{ fontSize: 28 }}></i></div>
          <div className="text-lg font-semibold text-foreground">Submitted</div>
          {done.refNo && <div className="text-sm text-muted-foreground mt-1">Reference <span className="font-mono font-semibold text-foreground">{done.refNo}</span></div>}
          {done.message && <div className="text-sm text-foreground mt-3 whitespace-pre-line">{done.message}</div>}
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            {done.payUrl && <a className="ui-btn ui-btn-primary" href={done.payUrl}><i className="bi bi-credit-card"></i>Pay {money(done.amount)}</a>}
            {done.receipt && <a className="ui-btn ui-btn-outline" href={done.receipt} target={embedded ? "_blank" : undefined} rel="noreferrer"><i className="bi bi-receipt"></i>View submission</a>}
            {done.redirectUrl && done.payUrl && <a className="ui-btn ui-btn-ghost" href={done.redirectUrl}>Continue</a>}
            {done.preview && <span className="text-xs text-muted-foreground">Preview · nothing was saved</span>}
          </div>
        </div>
      </div>
    );
  }

  const progress = pages.length > 1 ? Math.round(((page + 1) / pages.length) * 100) : 0;
  return (
    <form ref={top} onSubmit={submit} noValidate style={{ ...wrapStyle, maxWidth: maxW }} className="w-full mx-auto">
      <div className="rounded-xl border bg-card overflow-hidden">
        {form.theme?.cover && <img src={form.theme.cover} alt="" className="w-full object-cover" style={{ maxHeight: 180 }} />}
        <div className="p-4 sm:p-6">
          {(form.logo || form.organisation) && (
            <div className="flex items-center gap-2 mb-3">
              {form.logo && <img src={form.logo} alt="" style={{ height: 36, maxWidth: 140, objectFit: "contain" }} />}
              {!form.logo && <span className="text-sm font-semibold text-muted-foreground">{form.organisation}</span>}
            </div>
          )}
          <h1 className="text-xl font-semibold text-foreground leading-tight">{form.title || form.name}</h1>

          {pages.length > 1 && form.settings?.showProgress !== false && (
            <div className="mt-4">
              <div className="hidden sm:flex items-center gap-1 mb-2">
                {pages.map((p, i) => (
                  <button key={p.id} type="button" disabled={i > page} onClick={() => i < page && setPage(i)} className="flex items-center gap-1.5 text-xs font-medium flex-1 min-w-0 border-0 bg-transparent p-0 text-left" style={{ color: i <= page ? "var(--primary)" : "var(--muted-foreground)" }}>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0 text-[10px]" style={{ background: i < page ? "var(--primary)" : "transparent", color: i < page ? "#fff" : undefined, border: "1.5px solid currentColor" }}>{i < page ? <i className="bi bi-check"></i> : i + 1}</span>
                    <span className="truncate">{p.title}</span>
                  </button>
                ))}
              </div>
              <div className="sm:hidden text-xs font-medium mb-1.5" style={{ color: "var(--primary)" }}>Step {page + 1} of {pages.length} · {pages[page]?.title}</div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted-background, var(--muted))" }}><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "var(--primary)" }} /></div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 mt-5">
            {shown(page).map((f) => {
              if (f.type === "hidden") return null;
              if (f.type === "heading") return <div key={f.id} className="sm:col-span-2 pt-2 border-b pb-1.5"><h2 className="text-base font-semibold text-foreground m-0">{f.label}</h2></div>;
              const full = f.width !== "half";
              return (
                <div key={f.id} id={`ffw-${f.id}`} className={full ? "sm:col-span-2" : ""}>
                  {f.type !== "consent" && <label htmlFor={`ff-${f.id}`} className="block text-sm font-medium text-foreground mb-1.5">{f.label}{f.required && <span style={{ color: "var(--destructive)" }}> *</span>}</label>}
                  <FieldInput f={f} value={data[f.id]} set={(v) => set(f.id, v)} files={files} setFiles={(l) => setFiles(f.id, l)} invalid={!!errors[f.id]} />
                  {errors[f.id] && <div className="text-xs mt-1" style={{ color: "var(--destructive)" }}>{errors[f.id]}</div>}
                </div>
              );
            })}
          </div>

          {/* bots fill this; people never see it */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} aria-hidden="true" />

          {last && amount > 0 && (
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 mt-5 text-sm">
              <span className="text-muted-foreground">{fee.title || "Fee"}</span>
              <span className="font-semibold text-foreground">{money(amount)}</span>
            </div>
          )}

          {problem && <div className="alert alert-danger py-2 small mt-4 mb-0"><i className="bi bi-exclamation-triangle me-1"></i>{problem}</div>}
          {draftLink && (
            <div className="rounded-lg border px-3 py-2.5 mt-4 text-sm flex flex-wrap items-center gap-2">
              <i className="bi bi-bookmark-check" style={{ color: "var(--success)" }}></i>
              <span className="text-foreground">Saved</span>
              <input readOnly className="ui-input flex-1 font-mono text-xs" style={{ minWidth: 180 }} value={draftLink} onFocus={(e) => e.target.select()} />
              <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => navigator.clipboard?.writeText(draftLink)}><i className="bi bi-copy"></i>Copy</button>
            </div>
          )}

          <div className={"flex flex-wrap items-center gap-2 mt-6 " + (align === "center" ? "justify-center" : "")}>
            {page > 0 && <button type="button" className="ui-btn ui-btn-outline" onClick={back} disabled={busy}><i className="bi bi-arrow-left"></i>{form.settings?.backLabel || "Back"}</button>}
            {form.settings?.allowDraft && onDraft && !preview && <button type="button" className="ui-btn ui-btn-ghost" onClick={saveDraft} disabled={busy}><i className="bi bi-bookmark"></i>Save for later</button>}
            <button type="submit" className={"ui-btn ui-btn-primary " + ({ right: "ms-auto", full: "flex-1 justify-center" }[align] || "")} disabled={busy} style={{ minWidth: 120 }}>
              {busy ? "Sending…" : last ? <>{form.settings?.submitLabel || "Submit"}{amount > 0 ? ` · ${money(amount)}` : ""}</> : <>{form.settings?.nextLabel || "Next"}<i className="bi bi-arrow-right"></i></>}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
