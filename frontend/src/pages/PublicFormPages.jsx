import { useEffect, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { formsApi } from "../api";
import { useApi } from "../hooks/useApi";
import { Spinner, Chip } from "../components/ui";
import FormRenderer from "../components/forms/FormRenderer";
import { formatDateTime } from "../utils/dateFormat";
import { money } from "../components/lead/leadUtils";

function Shell({ children, bg, embed }) {
  return (
    <div className="crm-theme min-h-screen flex items-start justify-center px-3 py-6 sm:py-10" style={{ background: embed ? "transparent" : bg || "var(--page-bg)" }}>
      {children}
    </div>
  );
}
const Note = ({ icon = "info-circle", text }) => (
  <div className="w-full rounded-xl border bg-card p-6 text-center" style={{ maxWidth: 520 }}>
    <i className={`bi bi-${icon} text-muted-foreground`} style={{ fontSize: 26 }}></i>
    <div className="text-sm text-foreground mt-2">{text}</div>
  </div>
);

/** In an iframe, tell the host page how tall the form is so it never scrolls inside. */
function useEmbedHeight(on) {
  useEffect(() => {
    if (!on || window.parent === window) return undefined;
    const send = () => window.parent.postMessage({ type: "crm-form-height", height: document.documentElement.scrollHeight }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(document.body);
    send();
    return () => ro.disconnect();
  }, [on]);
}

/** /f/:slug — anyone with the link fills the form in. */
export function PublicFormPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";
  const resume = params.get("resume") || "";
  const form = useApi(() => formsApi.publicForm(slug, { view: resume ? "" : "1", resume }), [slug]);
  useEmbedHeight(embed);
  const f = form.data;
  const draftToken = useRef("");
  useEffect(() => { if (f?.draft?.token) draftToken.current = f.draft.token; }, [f?.draft?.token]);

  useEffect(() => { if (f?.title) document.title = f.title; }, [f?.title]);

  // answers handed in on the link: ?name=Asha&course=BBA (each field's own URL name)
  const prefill = useMemo(() => {
    const out = {};
    for (const fl of (f?.pages || []).flatMap((p) => p.fields)) {
      const v = fl.param ? params.get(fl.param) : null;
      if (v !== null && v !== undefined) out[fl.id] = fl.type === "checkbox" ? v.split(",") : v;
    }
    return { ...out, ...(f?.draft?.data || {}) };
  }, [f]); // eslint-disable-line react-hooks/exhaustive-deps
  const utm = useMemo(() => {
    const u = {};
    for (const k of ["source", "medium", "campaign", "term", "content"]) if (params.get(`utm_${k}`)) u[k] = params.get(`utm_${k}`);
    return u;
  }, [params]);

  if (form.loading && !f) return <Shell embed={embed}><Spinner /></Shell>;
  if (!f) return <Shell embed={embed}><Note icon="link-45deg" text={form.error?.message || "This form link is not valid."} /></Shell>;
  if (!f.open) return <Shell embed={embed} bg={f.theme?.background}><Note icon="lock" text={f.reason} /></Shell>;

  const visitorId = (() => { try { return localStorage.getItem("crm_visitor") || ""; } catch { return ""; } })();
  const base = { utm, referrer: document.referrer || "", ref: params.get("ref") || "", visitorId, via: params.get("via") === "staff" ? "Staff" : "Online" };

  async function onSubmit(data, files, hp) {
    const fd = new FormData();
    fd.append("payload", JSON.stringify({ ...base, data, token: draftToken.current, _hp: hp }));
    for (const [id, list] of Object.entries(files)) for (const x of list) fd.append(id, x, x.name);
    const res = await formsApi.submit(slug, fd);
    if (embed && window.parent !== window) window.parent.postMessage({ type: "crm-form-submitted", refNo: res.data.refNo }, "*");
    return res.data;
  }
  async function onDraft(data, page) {
    const res = await formsApi.draft(slug, { ...base, data, page, token: draftToken.current, sendLink: true });
    draftToken.current = res.data.token;
    return res.data;
  }

  return (
    <Shell embed={embed} bg={f.theme?.background}>
      <FormRenderer form={f} initial={prefill} initialPage={f.draft?.page || 0} onSubmit={onSubmit} onDraft={onDraft} onFirstInput={() => formsApi.start(slug).catch(() => undefined)} embedded={embed} />
    </Shell>
  );
}

/** /f/receipt/:token — the person's own copy, printable. */
export function FormReceiptPage() {
  const { token } = useParams();
  const r = useApi(() => formsApi.receipt(token), [token]);
  const d = r.data;
  if (r.loading && !d) return <Shell><Spinner /></Shell>;
  if (!d) return <Shell><Note icon="link-45deg" text={r.error?.message || "This link is not valid."} /></Shell>;
  return (
    <Shell>
      <div className="w-full" style={{ maxWidth: 640, ...(d.color ? { "--primary": d.color } : {}) }}>
        <div className="rounded-xl border bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {d.logo ? <img src={d.logo} alt="" style={{ height: 34, maxWidth: 140, objectFit: "contain" }} /> : d.organisation && <div className="text-sm font-semibold text-muted-foreground">{d.organisation}</div>}
              <h1 className="text-lg font-semibold text-foreground mt-2 mb-0">{d.form}</h1>
              <div className="text-xs text-muted-foreground mt-0.5"><span className="font-mono font-semibold text-foreground">{d.refNo}</span> · {formatDateTime(d.submittedAt)}</div>
            </div>
            <Chip color="var(--primary)">{d.status}</Chip>
          </div>

          {d.fee && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 mt-4">
              <div className="text-sm"><div className="text-muted-foreground text-xs">{d.fee.title}</div><div className="font-semibold text-foreground">{money(d.fee.amount)}</div></div>
              {d.fee.paid ? <Chip color="var(--success)" icon="check-circle">Paid</Chip> : <a className="ui-btn ui-btn-primary ui-btn-sm print:hidden" href={d.fee.link}><i className="bi bi-credit-card"></i>Pay {money(d.fee.balance)}</a>}
            </div>
          )}

          <dl className="mt-4 divide-y">
            {d.answers.map((a) => (
              <div key={a.id} className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 py-2">
                <dt className="text-xs text-muted-foreground">{a.label}</dt>
                <dd className="text-sm text-foreground m-0 break-words whitespace-pre-line">{a.value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap gap-2 mt-4 print:hidden">
            <button type="button" className="ui-btn ui-btn-outline" onClick={() => window.print()}><i className="bi bi-printer"></i>Print</button>
            {d.applicationLink && <a className="ui-btn ui-btn-outline" href={d.applicationLink}><i className="bi bi-clipboard-check"></i>Track application</a>}
          </div>
        </div>
      </div>
    </Shell>
  );
}
