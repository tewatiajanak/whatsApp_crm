// More elements: forms, dynamic lists and extra content pieces.
// Registered the same way as the core set in registry.jsx.
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Star, Search } from "lucide-react";
import { registerComponent, RichHtml, A, T, Btn, Img, Head, Empty, band, toneControl, headControls, colsControl, Icon, safeImage, safeHref } from "./registry";

/* ───────────── Forms ───────────── */
function FormView({ attrs, props, ctx }) {
  const [state, setState] = useState("idle"); // idle | sending | done | error
  const [message, setMessage] = useState("");
  async function submit(e) {
    e.preventDefault();
    if (ctx.mode === "editor") return;
    const fd = new FormData(e.currentTarget);
    const data = {};
    (props.fields || []).forEach((f, i) => { data[f.label || `Field ${i + 1}`] = f.type === "checkbox" ? (fd.get(`f${i}`) ? "Yes" : "No") : String(fd.get(`f${i}`) || ""); });
    if (!ctx.submitForm) { setState("done"); setMessage("Preview: not submitted"); return; }
    setState("sending");
    try { await ctx.submitForm({ form: props.name || "Form", data, website_url: String(fd.get("website_url") || "") }); setState("done"); setMessage(props.successMessage || "Thank you. We will be in touch."); }
    catch (err) { setState("error"); setMessage(err.message || "Could not send. Please try again."); }
  }
  if (state === "done") return <div {...attrs}><div className="wb-note" role="status">{message}</div></div>;
  return (
    <form {...attrs} onSubmit={submit} noValidate={ctx.mode === "editor"}>
      {(props.fields || []).map((f, i) => {
        const common = { name: `f${i}`, required: !!f.required, className: "wb-input", "aria-label": f.label };
        return f.type === "checkbox" ? (
          <label key={i} className="wb-field" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><input type="checkbox" name={`f${i}`} required={!!f.required} style={{ marginTop: 5 }} /><span style={{ margin: 0, fontWeight: 400 }}>{f.label}{f.required && " *"}</span></label>
        ) : (
          <label key={i} className="wb-field"><span>{f.label}{f.required && " *"}</span>
            {f.type === "textarea" ? <textarea rows={4} {...common} /> : f.type === "select" ? <select {...common} defaultValue=""><option value="" disabled>Select</option>{String(f.options || "").split("\n").filter(Boolean).map((o) => <option key={o}>{o}</option>)}</select> : <input type={["email", "tel", "number", "date"].includes(f.type) ? f.type : "text"} {...common} />}
          </label>);
      })}
      {/* bots fill this; people never see it */}
      <input type="text" name="website_url" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
      {state === "error" && <div className="wb-note" role="alert" style={{ marginBottom: 12 }}>{message}</div>}
      <button type="submit" className="wb-btn primary" disabled={state === "sending"}>{state === "sending" ? "Sending…" : props.submitLabel || "Send"}</button>
    </form>);
}
const FORM_FIELD = [{ key: "label", label: "Label", type: "text" }, { key: "type", label: "Type", type: "select", options: [["text", "Text"], ["email", "Email"], ["tel", "Phone"], ["number", "Number"], ["date", "Date"], ["textarea", "Long text"], ["select", "Dropdown"], ["checkbox", "Checkbox"]] }, { key: "options", label: "Options (one per line)", type: "textarea" }, { key: "required", label: "Required", type: "toggle" }];
const CONTACT_FIELDS = [{ label: "Name", type: "text", required: true }, { label: "Email", type: "email", required: true }, { label: "Phone", type: "tel", required: false }, { label: "Message", type: "textarea", required: true }];
registerComponent({
  type: "Form", label: "Form", category: "Forms", keywords: ["contact", "enquiry", "lead", "inputs"],
  defaultProps: { name: "Contact", fields: CONTACT_FIELDS, submitLabel: "Send message", successMessage: "Thank you. We will be in touch." },
  controls: [{ key: "name", label: "Form name", type: "text" }, { key: "fields", label: "Fields", type: "items", fields: FORM_FIELD }, { key: "submitLabel", label: "Button", type: "text" }, { key: "successMessage", label: "Message after sending", type: "textarea" }],
  Component: FormView,
});
registerComponent({
  type: "FormSection", label: "Contact form section", category: "Forms", keywords: ["contact", "enquiry", "get in touch"],
  defaultProps: { tone: "soft", eyebrow: "Contact", heading: "Send us a message", text: "We reply within one working day.", name: "Contact", fields: CONTACT_FIELDS, submitLabel: "Send message", successMessage: "Thank you. We will be in touch." },
  controls: [toneControl, ...headControls, { key: "name", label: "Form name", type: "text" }, { key: "fields", label: "Fields", type: "items", fields: FORM_FIELD }, { key: "submitLabel", label: "Button", type: "text" }, { key: "successMessage", label: "Message after sending", type: "textarea" }],
  Component: ({ attrs, props, node, ctx }) => <section {...attrs} className={`wb-section ${band(props.tone)}`}><div className="wb-container" style={{ maxWidth: 680 }}><Head node={node} props={props} ctx={ctx} /><div className="wb-card" style={{ color: "var(--wb-color-text)" }}><FormView attrs={{}} props={props} ctx={ctx} /></div></div></section>,
});
registerComponent({
  type: "Newsletter", label: "Newsletter signup", category: "Forms", keywords: ["subscribe", "email", "updates"],
  defaultProps: { tone: "brand", heading: "Get our updates", text: "News and offers, once a month.", name: "Newsletter", fields: [{ label: "Email", type: "email", required: true }], submitLabel: "Subscribe", successMessage: "You are subscribed. Thank you." },
  controls: [toneControl, { key: "heading", label: "Heading", type: "text" }, { key: "text", label: "Text", type: "textarea" }, { key: "submitLabel", label: "Button", type: "text" }, { key: "successMessage", label: "Message after sending", type: "textarea" }],
  Component: ({ attrs, props, node, ctx }) => <section {...attrs} className={`wb-section ${band(props.tone)}`}><div className="wb-container wb-center" style={{ maxWidth: 560 }}><T tag="h2" node={node} prop="heading" value={props.heading} ctx={ctx} />{props.text && <p className="wb-lead">{props.text}</p>}<div style={{ marginTop: 18, textAlign: "left", color: "var(--wb-color-text)" }}><FormView attrs={{}} props={props} ctx={ctx} /></div></div></section>,
});

/* ───────────── Dynamic ───────────── */
function Pager({ result, ctx }) {
  if (!result || result.totalPages <= 1) return null;
  const go = (page) => ctx.setQuery?.({ page });
  const pages = Array.from({ length: result.totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === result.totalPages || Math.abs(p - result.page) <= 2);
  return (
    <nav className="wb-pager" aria-label="Pages">
      <button type="button" disabled={result.page <= 1} onClick={() => go(result.page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
      {pages.map((p) => <button type="button" key={p} aria-current={p === result.page ? "page" : undefined} onClick={() => go(p)}>{p}</button>)}
      <button type="button" disabled={result.page >= result.totalPages} onClick={() => go(result.page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
    </nav>);
}
function SearchBar({ ctx }) {
  const [q, setQ] = useState(ctx.query?.q || "");
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); ctx.setQuery?.({ q, page: 1 }); }} style={{ display: "flex", gap: 8, marginBottom: 20, maxWidth: 420 }}>
      <input className="wb-input" type="search" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      <button type="submit" className="wb-btn primary" aria-label="Search"><Search size={16} /></button>
    </form>);
}
registerComponent({
  type: "Repeater", label: "Data list", category: "Dynamic", isContainer: true, repeatable: true, keywords: ["repeater", "collection", "loop", "dynamic", "blog", "products"],
  defaultProps: { columns: 3, showSearch: false, emptyText: "Nothing to show yet" },
  controls: [colsControl(4), { key: "showSearch", label: "Show search box", type: "toggle" }, { key: "emptyText", label: "Text when empty", type: "text" }],
  Component: ({ attrs, props, node, children, ctx, repeat }) => {
    const bound = !!node.repeat?.source;
    return (
      <div {...attrs}>
        {bound && props.showSearch && node.repeat.paginate && <SearchBar ctx={ctx} />}
        {!bound ? <Empty ctx={ctx} label="Choose a data source in the Data tab" /> : children.length ? <div className="wb-grid" style={{ "--cols": Number(props.columns) || 3, alignItems: "stretch" }}>{children}</div> : (node.children || []).length === 0 ? <Empty ctx={ctx} label="Add elements — they repeat for every record" /> : <p className="wb-muted wb-center">{props.emptyText}</p>}
        {bound && node.repeat.paginate && <Pager result={repeat} ctx={ctx} />}
      </div>);
  },
});
registerComponent({
  type: "Breadcrumbs", label: "Breadcrumbs", category: "Dynamic", keywords: ["path", "navigation", "trail"],
  defaultProps: { current: "{{ item.title | default:\"\" }}" }, controls: [{ key: "current", label: "Current page text", type: "text" }],
  Component: ({ attrs, props, ctx }) => <nav {...attrs} aria-label="Breadcrumb"><ol className="wb-crumbs"><li><A href="/" ctx={ctx}>Home</A></li><li aria-hidden="true">/</li><li aria-current="page">{props.current || ctx.pageInfo?.title}</li></ol></nav>,
});

/* ───────────── content pieces ───────────── */
registerComponent({
  type: "IconBox", label: "Icon box", category: "Interactive", keywords: ["feature", "service", "icon"],
  defaultProps: { icon: "Star", title: "Feature title", text: "A short line about this feature.", href: "" },
  controls: [{ key: "icon", label: "Icon", type: "icon" }, { key: "title", label: "Title", type: "text" }, { key: "text", label: "Text", type: "textarea" }, { key: "href", label: "Link", type: "link" }],
  Component: ({ attrs, props, node, ctx }) => <div {...attrs}><div className="wb-icon-badge"><Icon name={props.icon} /></div><T tag="h4" node={node} prop="title" value={props.title} ctx={ctx} /><p className="wb-muted">{props.text}</p>{safeHref(props.href) && <A href={props.href} ctx={ctx}>Learn more →</A>}</div>,
});
registerComponent({
  type: "ButtonGroup", label: "Button group", category: "Interactive", keywords: ["buttons", "actions", "cta"],
  defaultProps: { align: "flex-start", items: [{ label: "Get started", href: "", variant: "primary" }, { label: "Learn more", href: "", variant: "outline" }] },
  controls: [{ key: "align", label: "Align", type: "select", options: [["flex-start", "Left"], ["center", "Centre"], ["flex-end", "Right"]] }, { key: "items", label: "Buttons", type: "items", fields: [{ key: "label", label: "Label", type: "text" }, { key: "href", label: "Link", type: "link" }, { key: "variant", label: "Style", type: "select", options: [["primary", "Primary"], ["outline", "Outline"], ["light", "Light"], ["link", "Text link"]] }] }],
  Component: ({ attrs, props, ctx }) => <div {...attrs} className="wb-btns" style={{ justifyContent: props.align }}>{(props.items || []).map((b, i) => <Btn key={i} label={b.label} href={b.href} variant={b.variant} ctx={ctx} />)}</div>,
});
registerComponent({
  type: "Table", label: "Table", category: "Typography", keywords: ["rows", "columns", "data", "comparison"],
  defaultProps: { header: "Plan | Price | Includes", rows: "Basic | ₹999 | Email support\nStandard | ₹2,499 | Priority support\nPremium | ₹4,999 | Dedicated manager" },
  controls: [{ key: "header", label: "Header (cells split by |)", type: "text" }, { key: "rows", label: "Rows (one per line, cells split by |)", type: "textarea" }],
  Component: ({ attrs, props }) => { const cells = (line) => String(line).split("|").map((c) => c.trim()); return <div {...attrs} className="wb-table-wrap"><table className="wb-table"><thead><tr>{cells(props.header).map((c, i) => <th key={i} scope="col">{c}</th>)}</tr></thead><tbody>{String(props.rows || "").split("\n").filter(Boolean).map((r, i) => <tr key={i}>{cells(r).map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>; },
});
function CountdownView({ attrs, props }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = new Date(props.date).getTime() - now;
  if (!props.date || isNaN(left)) return <div {...attrs}><div className="wb-ph" style={{ minHeight: 70 }}>Choose a date</div></div>;
  if (left <= 0) return <div {...attrs}><div className="wb-note">{props.endText}</div></div>;
  const parts = [["Days", Math.floor(left / 86_400_000)], ["Hours", Math.floor(left / 3_600_000) % 24], ["Minutes", Math.floor(left / 60_000) % 60], ["Seconds", Math.floor(left / 1000) % 60]];
  return <div {...attrs} className="wb-count" role="timer">{parts.map(([l, v]) => <div key={l}><b suppressHydrationWarning>{String(v).padStart(2, "0")}</b><span style={{ fontSize: "var(--wb-small)" }}>{l}</span></div>)}</div>;
}
registerComponent({ type: "Countdown", label: "Countdown", category: "Interactive", keywords: ["timer", "launch", "event", "offer"], defaultProps: { date: "", endText: "This has started." }, controls: [{ key: "date", label: "Date and time", type: "datetime" }, { key: "endText", label: "Text when finished", type: "text" }], Component: CountdownView });
registerComponent({
  type: "Progress", label: "Progress bars", category: "Interactive", keywords: ["skills", "percent", "bars"],
  defaultProps: { items: [{ label: "Design", value: 90 }, { label: "Development", value: 80 }, { label: "Support", value: 95 }] },
  controls: [{ key: "items", label: "Bars", type: "items", fields: [{ key: "label", label: "Label", type: "text" }, { key: "value", label: "Percent", type: "number" }] }],
  Component: ({ attrs, props }) => <div {...attrs}>{(props.items || []).map((it, i) => { const v = Math.max(0, Math.min(100, Number(it.value) || 0)); return <div key={i} style={{ marginBottom: 14 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span>{it.label}</span><span className="wb-muted">{v}%</span></div><div className="wb-bar" role="progressbar" aria-label={it.label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${v}%` }} /></div></div>; })}</div>,
});
registerComponent({
  type: "Timeline", label: "Timeline", category: "Interactive", keywords: ["history", "milestones", "journey"],
  defaultProps: { items: [{ when: "2015", title: "We started", text: "A small team with a clear idea." }, { when: "2019", title: "We grew", text: "New office, more clients." }, { when: "Today", title: "Still improving", text: "The same care, a bigger team." }] },
  controls: [{ key: "items", label: "Entries", type: "items", fields: [{ key: "when", label: "When", type: "text" }, { key: "title", label: "Title", type: "text" }, { key: "text", label: "Text", type: "textarea" }] }],
  Component: ({ attrs, props }) => <div {...attrs} className="wb-timeline">{(props.items || []).map((it, i) => <div key={i}><div className="wb-eyebrow" style={{ marginBottom: 2 }}>{it.when}</div><h5 style={{ marginBottom: 4 }}>{it.title}</h5><p className="wb-muted">{it.text}</p></div>)}</div>,
});
registerComponent({
  type: "Steps", label: "Steps", category: "Sections", keywords: ["process", "how it works", "numbered"],
  defaultProps: { tone: "none", eyebrow: "", heading: "How it works", text: "", items: [{ title: "Tell us what you need", text: "Share a few details." }, { title: "Get a plan", text: "We suggest the best option." }, { title: "We deliver", text: "On time, with updates." }] },
  controls: [toneControl, ...headControls, { key: "items", label: "Steps", type: "items", fields: [{ key: "title", label: "Title", type: "text" }, { key: "text", label: "Text", type: "textarea" }] }],
  Component: ({ attrs, props, node, ctx }) => <section {...attrs} className={`wb-section ${band(props.tone)}`}><div className="wb-container"><Head node={node} props={props} ctx={ctx} /><div className="wb-grid" style={{ "--cols": Math.min(4, (props.items || []).length || 1) }}>{(props.items || []).map((it, i) => <div key={i}><div className="wb-step-n">{i + 1}</div><h4>{it.title}</h4><p className="wb-muted">{it.text}</p></div>)}</div></div></section>,
});
registerComponent({
  type: "Alert", label: "Notice", category: "Interactive", keywords: ["alert", "announcement", "banner", "info"],
  defaultProps: { text: "Admissions for the new session are open.", linkLabel: "", href: "" }, controls: [{ key: "text", label: "Text", type: "textarea" }, { key: "linkLabel", label: "Link text", type: "text" }, { key: "href", label: "Link", type: "link" }],
  Component: ({ attrs, props, node, ctx }) => <div {...attrs} className="wb-note" role="note"><T node={node} prop="text" value={props.text} ctx={ctx} />{props.linkLabel && <> <A href={props.href} ctx={ctx}>{props.linkLabel}</A></>}</div>,
});
registerComponent({
  type: "Badges", label: "Tags", category: "Interactive", keywords: ["badges", "labels", "chips", "categories"],
  defaultProps: { items: "New\nPopular\nLimited" }, controls: [{ key: "items", label: "Tags (one per line)", type: "textarea" }],
  Component: ({ attrs, props }) => <div {...attrs} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{(Array.isArray(props.items) ? props.items : String(props.items || "").split("\n")).filter(Boolean).map((t, i) => <span key={i} className="wb-badge">{t}</span>)}</div>,
});
function CarouselView({ attrs, props, ctx }) {
  const slides = props.items || [];
  const [i, setI] = useState(0);
  const cur = slides[Math.min(i, slides.length - 1)];
  if (!cur) return <div {...attrs}><div className="wb-ph">Add slides</div></div>;
  const go = (d) => setI((i + d + slides.length) % slides.length);
  const bg = safeImage(cur.image);
  return (
    <div {...attrs} role="region" aria-roledescription="carousel" aria-label={props.label || "Slides"}>
      <div className="wb-carousel">
        <div className="wb-slide" style={bg ? { backgroundImage: `url("${encodeURI(bg)}")` } : undefined}><div><h3>{cur.title}</h3>{cur.text && <p>{cur.text}</p>}{cur.buttonLabel && <div style={{ marginTop: 12 }}><Btn label={cur.buttonLabel} href={cur.href} variant="light" ctx={ctx} /></div>}</div></div>
        {slides.length > 1 && <><button type="button" className="wb-car-btn" style={{ left: 12 }} aria-label="Previous slide" onClick={() => go(-1)}><ChevronLeft size={18} /></button><button type="button" className="wb-car-btn" style={{ right: 12 }} aria-label="Next slide" onClick={() => go(1)}><ChevronRight size={18} /></button></>}
      </div>
      {slides.length > 1 && <div className="wb-dots">{slides.map((_, j) => <button type="button" key={j} aria-label={`Slide ${j + 1}`} aria-current={j === i} onClick={() => setI(j)} />)}</div>}
    </div>);
}
registerComponent({
  type: "Carousel", label: "Carousel", category: "Media", keywords: ["slider", "slides", "banner"],
  defaultProps: { items: [{ title: "First slide", text: "A short line for this slide.", image: "", buttonLabel: "", href: "" }, { title: "Second slide", text: "A short line for this slide.", image: "", buttonLabel: "", href: "" }] },
  controls: [{ key: "items", label: "Slides", type: "items", fields: [{ key: "title", label: "Title", type: "text" }, { key: "text", label: "Text", type: "textarea" }, { key: "image", label: "Image URL", type: "image" }, { key: "buttonLabel", label: "Button", type: "text" }, { key: "href", label: "Button link", type: "link" }] }],
  Component: CarouselView,
});
registerComponent({ type: "HtmlBlock", label: "HTML", category: "Embeds", keywords: ["code", "custom", "markup"], defaultProps: { html: "<p>Custom HTML. Scripts and event handlers are removed.</p>" }, controls: [{ key: "html", label: "HTML", type: "textarea" }], Component: ({ attrs, props }) => <RichHtml attrs={attrs} html={props.html} /> });
registerComponent({
  type: "PriceList", label: "Price list", category: "Sections", keywords: ["menu", "rates", "services", "restaurant", "salon"],
  defaultProps: { tone: "none", eyebrow: "", heading: "Price list", text: "", items: [{ name: "Item one", note: "Short description", price: "₹250" }, { name: "Item two", note: "Short description", price: "₹400" }, { name: "Item three", note: "Short description", price: "₹550" }] },
  controls: [toneControl, ...headControls, { key: "items", label: "Items", type: "items", fields: [{ key: "name", label: "Name", type: "text" }, { key: "note", label: "Description", type: "text" }, { key: "price", label: "Price", type: "text" }] }],
  Component: ({ attrs, props, node, ctx }) => <section {...attrs} className={`wb-section ${band(props.tone)}`}><div className="wb-container" style={{ maxWidth: 760 }}><Head node={node} props={props} ctx={ctx} />{(props.items || []).map((it, i) => <div className="wb-price-row" key={i}><span><b>{it.name}</b>{it.note && <><br /><span className="wb-muted" style={{ fontSize: "var(--wb-small)" }}>{it.note}</span></>}</span><b>{it.price}</b></div>)}</div></section>,
});
registerComponent({
  type: "BusinessHours", label: "Opening hours", category: "Sections", keywords: ["hours", "timings", "schedule", "open"],
  defaultProps: { heading: "Opening hours", items: [{ day: "Monday – Friday", hours: "9 am – 6 pm" }, { day: "Saturday", hours: "10 am – 4 pm" }, { day: "Sunday", hours: "Closed" }] },
  controls: [{ key: "heading", label: "Heading", type: "text" }, { key: "items", label: "Rows", type: "items", fields: [{ key: "day", label: "Day", type: "text" }, { key: "hours", label: "Hours", type: "text" }] }],
  Component: ({ attrs, props }) => <div {...attrs}>{props.heading && <h4>{props.heading}</h4>}{(props.items || []).map((it, i) => <div className="wb-price-row" key={i}><span>{it.day}</span><b>{it.hours}</b></div>)}</div>,
});
registerComponent({ type: "Audio", label: "Audio", category: "Media", keywords: ["podcast", "music", "sound"], defaultProps: { src: "", title: "Audio" }, controls: [{ key: "src", label: "Audio file URL (https)", type: "text" }, { key: "title", label: "Title", type: "text" }], Component: ({ attrs, props }) => <div {...attrs}>{safeImage(props.src) ? <audio controls preload="none" src={safeImage(props.src)} aria-label={props.title} style={{ width: "100%" }} /> : <div className="wb-ph" style={{ minHeight: 60 }}>Paste an audio file link</div>}</div> });
registerComponent({ type: "Marquee", label: "Scrolling text", category: "Interactive", keywords: ["ticker", "marquee", "news", "announcement"], defaultProps: { text: "Admissions open  •  New batch starts soon  •  Call us today" }, controls: [{ key: "text", label: "Text", type: "textarea" }], Component: ({ attrs, props }) => <div {...attrs} className="wb-marquee"><div>{props.text}</div></div> });
registerComponent({
  type: "Rating", label: "Rating", category: "Interactive", keywords: ["stars", "review", "score"],
  defaultProps: { value: 5, text: "Rated 4.9 by 200+ customers" }, controls: [{ key: "value", label: "Stars (1–5)", type: "number" }, { key: "text", label: "Text", type: "text" }],
  Component: ({ attrs, props }) => { const v = Math.max(0, Math.min(5, Math.round(Number(props.value) || 0))); return <div {...attrs} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span role="img" aria-label={`${v} out of 5`} style={{ display: "inline-flex", color: "var(--wb-color-accent)" }}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={18} fill={n <= v ? "currentColor" : "none"} aria-hidden="true" />)}</span><span className="wb-muted">{props.text}</span></div>; },
});
registerComponent({ type: "Anchor", label: "Anchor", category: "Navigation", keywords: ["jump", "id", "scroll target"], defaultProps: { name: "section" }, controls: [{ key: "name", label: "Anchor name (link with #name)", type: "text" }], Component: ({ attrs, props, ctx }) => <div {...attrs} id={String(props.name || "").replace(/[^A-Za-z0-9_-]/g, "")}>{ctx.mode === "editor" && <div className="wb-ph" style={{ minHeight: 28, fontSize: 12 }}>#{props.name}</div>}</div> });
registerComponent({
  type: "ImageCard", label: "Image card", category: "Media", keywords: ["post", "product", "card", "thumbnail"],
  defaultProps: { image: "", eyebrow: "", title: "Card title", text: "A short description.", href: "", linkLabel: "Read more" },
  controls: [{ key: "image", label: "Image URL", type: "image" }, { key: "eyebrow", label: "Label", type: "text" }, { key: "title", label: "Title", type: "text" }, { key: "text", label: "Text", type: "textarea" }, { key: "href", label: "Link", type: "link" }, { key: "linkLabel", label: "Link text", type: "text" }],
  Component: ({ attrs, props, ctx }) => <article {...attrs} className="wb-card" style={{ padding: 0, overflow: "hidden", height: "100%" }}><Img src={props.image} alt={props.title} className="" style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover" }} /><div style={{ padding: 20 }}>{props.eyebrow && <div className="wb-eyebrow">{props.eyebrow}</div>}<h4>{props.title}</h4><p className="wb-muted">{props.text}</p>{safeHref(props.href) && props.linkLabel && <div style={{ marginTop: 12 }}><A href={props.href} ctx={ctx}>{props.linkLabel} →</A></div>}</div></article>,
});
