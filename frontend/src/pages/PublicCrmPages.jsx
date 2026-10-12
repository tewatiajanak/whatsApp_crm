import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { crmApi } from "../api";
import { runPaymentAction } from "../api/payments";
import { useApi } from "../hooks/useApi";
import { Spinner, Chip } from "../components/ui";
import { formatDate, formatDateTime } from "../utils/dateFormat";
import { money } from "../components/lead/leadUtils";
import { downloadFeePdf, downloadOfferPdf } from "../utils/pdf";
import { Link } from "react-router-dom";

// Pages a lead opens from a link we send them — no login.
function Shell({ organisation, children }) {
  return (
    <div className="crm-theme min-h-screen flex items-start sm:items-center justify-center p-4" style={{ background: "var(--page-bg)" }}>
      <div className="w-full" style={{ maxWidth: 460 }}>
        {organisation && <div className="text-center text-sm font-semibold text-foreground mb-3">{organisation}</div>}
        {children}
      </div>
    </div>
  );
}
const Card = ({ children }) => <div className="rounded-xl border bg-card p-5 mb-3">{children}</div>;
const Problem = ({ error }) => <Shell><Card><div className="text-sm text-foreground text-center">{error?.message || "This link is not valid."}</div></Card></Shell>;

function usePay() {
  const [paying, setPaying] = useState("");
  const [error, setError] = useState("");
  async function pay(token) {
    setPaying(token);
    setError("");
    try { const res = await crmApi.startFeePayment(token); await runPaymentAction(res.data.action); }
    catch (e) { setError(e.message || "Could not start the payment"); setPaying(""); }
  }
  return { paying, error, pay };
}

/** /pay/:token — pay one fee, or see its receipt. */
export function PublicPayPage() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const fee = useApi(() => crmApi.publicFee(token), [token]);
  const { paying, error, pay } = usePay();
  const back = params.get("payment");
  // the gateway's confirmation can land a moment after the browser returns
  useEffect(() => {
    if (back !== "paid" && back !== "pending") return undefined;
    const t = setInterval(() => { if (fee.data?.status === "pending") fee.reload(); }, 4000);
    return () => clearInterval(t);
  }, [back, fee.data?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (fee.loading && !fee.data) return <Shell><Spinner /></Shell>;
  if (!fee.data) return <Problem error={fee.error} />;
  const f = fee.data;
  return (
    <Shell organisation={f.organisation}>
      <Card>
        <div className="text-xs text-muted-foreground">{f.name}</div>
        <div className="text-base font-semibold text-foreground mt-0.5">{f.title}</div>
        <div className="text-3xl font-semibold text-foreground mt-3">{money(f.status === "pending" ? f.balance : f.amount - f.discount)}</div>
        {f.status === "pending" && (f.paid > 0 || f.discount > 0) && <div className="text-xs text-muted-foreground mt-1">of {money(f.amount)}{f.discount > 0 ? ` · ${money(f.discount)} concession` : ""}{f.paid > 0 ? ` · ${money(f.paid)} already paid` : ""}</div>}
        {f.status === "paid" ? (
          <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
            <div className="font-semibold"><i className="bi bi-check-circle me-1"></i>Paid</div>
            <div className="text-xs mt-1">{f.invoiceNo ? `Invoice ${f.invoiceNo} · ` : ""}{formatDateTime(f.paidAt)}</div>
          </div>
        ) : f.status === "cancelled" ? (
          <div className="mt-4 text-sm text-muted-foreground">This fee was cancelled. Nothing is due.</div>
        ) : (
          <>
            {f.dueDate && <div className="text-xs text-muted-foreground mt-1">Due by {formatDate(f.dueDate)}</div>}
            {back === "failed" && <div className="mt-3 text-xs" style={{ color: "var(--destructive)" }}>The payment did not go through. You can try again.</div>}
            {(back === "paid" || back === "pending") && <div className="mt-3 text-xs text-muted-foreground">Confirming your payment…</div>}
            {error && <div className="mt-3 text-xs" style={{ color: "var(--destructive)" }}>{error}</div>}
            {f.canPayOnline
              ? <button type="button" className="ui-btn ui-btn-primary w-full mt-4" style={{ height: 42 }} disabled={!!paying} onClick={() => pay(token)}>{paying ? "Opening payment…" : `Pay ${money(f.balance)}`}</button>
              : <div className="mt-4 text-sm text-muted-foreground">Online payment is not available. Please pay at the office.</div>}
          </>
        )}
        {!!f.payments.length && (
          <div className="mt-4 border-t pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Payments</div>
            {f.payments.map((p) => <div key={p.receiptNo} className="flex justify-between text-xs py-0.5"><span className="text-muted-foreground">{formatDate(p.at)} · {p.mode} · {p.receiptNo}</span><span className="text-foreground font-medium">{money(p.amount)}</span></div>)}
          </div>
        )}
        {f.status === "paid" && f.billing?.gst > 0 && (
          <div className="mt-3 border-t pt-3 text-xs">
            <div className="flex justify-between py-0.5"><span className="text-muted-foreground">Taxable value</span><span>{money(f.billing.taxable)}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-muted-foreground">GST {f.billing.gstPercent}%</span><span>{money(f.billing.gst)}</span></div>
            <div className="flex justify-between py-0.5 font-semibold"><span>Total</span><span>{money(f.amount - f.discount)}</span></div>
          </div>
        )}
        {(f.billing?.gstin || f.billing?.address) && <div className="mt-3 text-[11px] text-muted-foreground whitespace-pre-wrap">{f.billing.address}{f.billing.gstin ? `\nGSTIN ${f.billing.gstin}` : ""}</div>}
      </Card>
      {f.paid > 0 && <button type="button" className="ui-btn ui-btn-outline w-full print:hidden" onClick={() => downloadFeePdf(f)}><i className="bi bi-file-earmark-pdf"></i>Download {f.status === "paid" ? "invoice" : "receipt"} (PDF)</button>}
    </Shell>
  );
}

/** /application/:token — where an application stands, the offer, and fees to pay. */
export function PublicApplicationPage() {
  const { token } = useParams();
  const app = useApi(() => crmApi.publicApplication(token), [token]);
  const { paying, error, pay } = usePay();
  const [answering, setAnswering] = useState(false);
  const [problem, setProblem] = useState("");
  const [signedBy, setSignedBy] = useState("");
  const [docKind, setDocKind] = useState("Mark sheet");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function upload(file) {
    setUploading(true);
    setUploadError("");
    try { await crmApi.uploadApplicantDocument(token, file, docKind); app.reload(); }
    catch (e) { setUploadError(e.message); }
    finally { setUploading(false); }
  }

  if (app.loading && !app.data) return <Shell><Spinner /></Shell>;
  if (!app.data) return <Problem error={app.error} />;
  const a = app.data;
  const at = (stage) => a.history.filter((h) => h.stage === stage).pop()?.at;
  const reached = a.stages.indexOf(a.stage);

  async function answer(response) {
    setAnswering(true);
    setProblem("");
    try { await crmApi.answerOffer(token, response, signedBy); app.reload(); }
    catch (e) { setProblem(e.message); }
    finally { setAnswering(false); }
  }

  return (
    <Shell organisation={a.organisation}>
      <Card>
        <div className="text-xs text-muted-foreground">Application {a.appNo}</div>
        <div className="text-base font-semibold text-foreground mt-0.5">{a.name}</div>
        {a.course && <div className="text-sm text-muted-foreground">{a.course}</div>}
        <div className="mt-2"><Chip color="var(--primary)">{a.stage}</Chip></div>
        <ol className="list-none p-0 m-0 mt-4 space-y-2.5">
          {a.stages.filter((s) => !/reject/i.test(s) || a.stage === s).map((s) => {
            const i = a.stages.indexOf(s);
            const done = at(s) || (reached >= 0 && i <= reached && !/reject/i.test(a.stage));
            return (
              <li key={s} className="flex items-center gap-2.5 text-sm">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0" style={{ background: done ? "var(--primary)" : "var(--muted-background)", color: done ? "#fff" : "var(--muted-foreground)", fontSize: 11 }}>
                  {done ? <i className="bi bi-check"></i> : i + 1}
                </span>
                <span className={done ? "text-foreground font-medium" : "text-muted-foreground"}>{s}</span>
                {at(s) && <span className="text-[11px] text-muted-foreground ms-auto">{formatDate(at(s))}</span>}
              </li>
            );
          })}
        </ol>
      </Card>

      {a.offer && (
        <Card>
          <div className="text-sm font-semibold text-foreground mb-2">Your offer</div>
          <div className="text-sm text-foreground whitespace-pre-wrap">{a.offer.text}</div>
          {a.offer.validTill && <div className="text-xs text-muted-foreground mt-2">Valid till {formatDate(a.offer.validTill)}</div>}
          {problem && <div className="mt-2 text-xs" style={{ color: "var(--destructive)" }}>{problem}</div>}
          {a.offer.response ? (
            <div className="mt-3"><Chip color={a.offer.response === "accepted" ? "var(--success)" : "var(--destructive)"}>You {a.offer.response} this offer</Chip>
              {a.offer.signedBy && <div className="text-[11px] text-muted-foreground mt-1">Signed by {a.offer.signedBy} · {formatDateTime(a.offer.respondedAt)}</div>}</div>
          ) : (
            <>
              <input className="ui-input w-full mt-4" placeholder="Type your full name to accept" value={signedBy} onChange={(e) => setSignedBy(e.target.value)} />
              <div className="flex gap-2 mt-2">
                <button type="button" className="ui-btn ui-btn-outline flex-1" disabled={answering} onClick={() => answer("decline")}>Decline</button>
                <button type="button" className="ui-btn ui-btn-primary flex-1" disabled={answering || signedBy.trim().length < 3} onClick={() => answer("accept")}>Accept offer</button>
              </div>
            </>
          )}
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm mt-3 print:hidden" onClick={() => downloadOfferPdf(a)}><i className="bi bi-file-earmark-pdf"></i>Download offer letter (PDF)</button>
        </Card>
      )}

      {!!a.fees.length && (
        <Card>
          <div className="text-sm font-semibold text-foreground mb-2">Fees</div>
          {error && <div className="mb-2 text-xs" style={{ color: "var(--destructive)" }}>{error}</div>}
          {a.fees.map((f) => (
            <div key={f.token} className="flex items-center justify-between gap-3 py-2 border-t first:border-t-0">
              <div className="min-w-0">
                <div className="text-sm text-foreground truncate">{f.title}</div>
                <div className="text-[11px] text-muted-foreground">{f.status === "paid" ? `Paid · receipt ${f.receiptNo}` : f.dueDate ? `Due ${formatDate(f.dueDate)}` : "Due"}</div>
              </div>
              {f.status === "paid"
                ? <span className="text-sm font-semibold" style={{ color: "var(--success)" }}>{money(f.amount)}</span>
                : <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" disabled={!!paying} onClick={() => pay(f.token)}>{paying === f.token ? "Opening…" : `Pay ${money(f.amount)}`}</button>}
            </div>
          ))}
        </Card>
      )}
      {a.canUpload && (
        <Card>
          <div className="text-sm font-semibold text-foreground mb-2">Your documents</div>
          {a.documents.map((d, i) => <div key={i} className="flex justify-between gap-2 text-xs py-1 border-t first:border-t-0"><span className="text-foreground truncate">{d.category ? `${d.category} · ` : ""}{d.name}</span><span className="text-muted-foreground flex-shrink-0">{formatDate(d.createdAt)}</span></div>)}
          {uploadError && <div className="my-2 text-xs" style={{ color: "var(--destructive)" }}>{uploadError}</div>}
          <div className="flex gap-2 mt-2 print:hidden">
            <select className="ui-input flex-1" value={docKind} onChange={(e) => setDocKind(e.target.value)}>{["Mark sheet", "ID proof", "Photo", "Address proof", "Certificate", "Other"].map((k) => <option key={k}>{k}</option>)}</select>
            <label className="ui-btn ui-btn-outline m-0"><i className="bi bi-upload"></i>{uploading ? "Sending…" : "Upload"}
              <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
            </label>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">PDF, JPG or PNG, up to 8 MB.</div>
        </Card>
      )}
    </Shell>
  );
}

/** /partner/:token — a referral partner's own page: their leads and commission. */
export function PublicPartnerPage() {
  const { token } = useParams();
  const page = useApi(() => crmApi.publicPartner(token), [token]);
  if (page.loading && !page.data) return <Shell><Spinner /></Shell>;
  if (!page.data) return <Problem error={page.error} />;
  const p = page.data;
  return (
    <Shell organisation={p.organisation}>
      <Card>
        <div className="text-xs text-muted-foreground">Referral partner · code {p.code}</div>
        <div className="text-base font-semibold text-foreground mt-0.5">{p.name}</div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {[["Leads referred", p.leads], ["Admissions", p.won], ["Earned", money(p.earned)], ["Yet to be paid", money(p.due)]].map(([label, value]) => (
            <div key={label} className="rounded-lg border px-3 py-2"><div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div><div className="text-base font-semibold text-foreground">{value}</div></div>
          ))}
        </div>
      </Card>
      <Card>
        <div className="text-sm font-semibold text-foreground mb-2">Your referrals</div>
        {!p.list.length ? <div className="text-sm text-muted-foreground">No referrals yet.</div> : p.list.map((l, i) => (
          <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-t first:border-t-0">
            <span className="min-w-0"><span className="block text-sm text-foreground truncate">{l.name}</span><span className="block text-[11px] text-muted-foreground">{formatDate(l.at)}</span></span>
            <Chip color={l.won ? "var(--success)" : l.lost ? "var(--destructive)" : "var(--primary)"}>{l.status || "New"}</Chip>
          </div>
        ))}
      </Card>
    </Shell>
  );
}

/** /book/:token — pick a time for a call or visit with a counsellor. */
export function PublicBookingPage() {
  const { token } = useParams();
  const page = useApi(() => crmApi.publicBooking(token), [token]);
  const [pick, setPick] = useState({ date: "", time: "" });
  const [form, setForm] = useState({ name: "", phone: "", kind: "Call", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  if (page.loading && !page.data) return <Shell><Spinner /></Shell>;
  if (!page.data) return <Problem error={page.error} />;
  const b = page.data;
  const day = b.days.find((d) => d.date === pick.date) || b.days[0];

  async function book() {
    setBusy(true);
    setError("");
    try { const r = await crmApi.book(token, { ...form, date: day.date, time: pick.time }); setDone(r.data); }
    catch (e) { setError(e.message); page.reload(); setPick((p) => ({ ...p, time: "" })); }
    finally { setBusy(false); }
  }

  if (done) return (
    <Shell organisation={b.organisation}>
      <Card>
        <div className="text-center">
          <i className="bi bi-check-circle" style={{ fontSize: 34, color: "var(--success)" }}></i>
          <div className="text-base font-semibold text-foreground mt-2">You are booked</div>
          <div className="text-sm text-muted-foreground mt-1">{done.date.split("-").reverse().join("-")} at {done.time} with {done.counsellor}</div>
        </div>
      </Card>
    </Shell>
  );

  return (
    <Shell organisation={b.organisation}>
      <Card>
        <div className="text-xs text-muted-foreground">Book a time with</div>
        <div className="text-base font-semibold text-foreground">{b.counsellor}</div>
        {!b.days.length ? <div className="text-sm text-muted-foreground mt-3">{b.away ? `${b.counsellor} is away right now.` : "No free times in the next few days."}</div> : (
          <>
            <div className="flex gap-1.5 overflow-x-auto mt-3 pb-1">
              {b.days.map((d) => <button key={d.date} type="button" className={"ui-btn ui-btn-sm flex-shrink-0 " + (day.date === d.date ? "ui-btn-primary" : "ui-btn-outline")} onClick={() => setPick({ date: d.date, time: "" })}>{d.date.slice(8)}-{d.date.slice(5, 7)}</button>)}
            </div>
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {day.times.map((t) => <button key={t} type="button" className={"ui-btn ui-btn-sm " + (pick.time === t ? "ui-btn-primary" : "ui-btn-outline")} onClick={() => setPick({ date: day.date, time: t })}>{t}</button>)}
            </div>
            <div className="space-y-2 mt-4">
              <input className="ui-input w-full" placeholder="Your name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <input className="ui-input w-full" type="tel" placeholder="Phone number" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              <select className="ui-input w-full" value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}><option value="Call">Phone call</option><option value="Visit">Visit in person</option><option value="Meeting">Online meeting</option></select>
              <input className="ui-input w-full" placeholder="Anything we should know? (optional)" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
            {error && <div className="mt-2 text-xs" style={{ color: "var(--destructive)" }}>{error}</div>}
            <button type="button" className="ui-btn ui-btn-primary w-full mt-3" style={{ height: 42 }} disabled={busy || !pick.time || !form.name.trim() || form.phone.replace(/\D/g, "").length < 7} onClick={book}>{busy ? "Booking…" : pick.time ? `Book ${pick.time}` : "Choose a time"}</button>
          </>
        )}
      </Card>
    </Shell>
  );
}

/** /applicant — sign in with a phone number and a one-time code to see every application. */
export function ApplicantLoginPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("phone");
  const [apps, setApps] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(fn) {
    setBusy(true);
    setError("");
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const sendCode = () => run(async () => { await crmApi.applicantCode(phone); setStep("code"); });
  const verify = () => run(async () => { const r = await crmApi.applicantVerify(phone, code); setApps(r.data.applications); });

  return (
    <Shell>
      <Card>
        <div className="text-base font-semibold text-foreground">Your application</div>
        {apps ? (
          !apps.length ? <div className="text-sm text-muted-foreground mt-2">No applications found for this number.</div> : (
            <div className="mt-3">
              {apps.map((a) => (
                <Link key={a.token} to={`/application/${a.token}`} className="flex items-center justify-between gap-2 py-2.5 border-t first:border-t-0 no-underline">
                  <span className="min-w-0"><span className="block text-sm font-medium text-foreground">{a.appNo}</span><span className="block text-xs text-muted-foreground truncate">{a.course || "Application"} · {formatDate(a.at)}</span></span>
                  <Chip color="var(--primary)">{a.stage}</Chip>
                </Link>
              ))}
            </div>
          )
        ) : step === "phone" ? (
          <>
            <div className="text-xs text-muted-foreground mt-1">Enter the mobile number you applied with.</div>
            <input className="ui-input w-full mt-3" type="tel" inputMode="numeric" autoFocus placeholder="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendCode()} />
            {error && <div className="mt-2 text-xs" style={{ color: "var(--destructive)" }}>{error}</div>}
            <button type="button" className="ui-btn ui-btn-primary w-full mt-3" style={{ height: 42 }} disabled={busy || phone.replace(/\D/g, "").length < 10} onClick={sendCode}>{busy ? "Sending…" : "Send me a code"}</button>
          </>
        ) : (
          <>
            <div className="text-xs text-muted-foreground mt-1">If that number has an application, a 6-digit code is on its way.</div>
            <input className="ui-input w-full mt-3 text-center" style={{ letterSpacing: 6, fontSize: 18 }} inputMode="numeric" maxLength={6} autoFocus placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && code.length === 6 && verify()} />
            {error && <div className="mt-2 text-xs" style={{ color: "var(--destructive)" }}>{error}</div>}
            <button type="button" className="ui-btn ui-btn-primary w-full mt-3" style={{ height: 42 }} disabled={busy || code.length !== 6} onClick={verify}>{busy ? "Checking…" : "View my application"}</button>
            <button type="button" className="ui-btn ui-btn-ghost w-full mt-1" disabled={busy} onClick={() => { setStep("phone"); setCode(""); setError(""); }}>Use another number</button>
          </>
        )}
      </Card>
    </Shell>
  );
}
