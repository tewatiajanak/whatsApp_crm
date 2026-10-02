import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { http } from "../../api";
import { runPaymentAction } from "../../api/payments";
import FormRenderer from "../event-form/FormRenderer";
import { type EventInfo, type FormDesign, type FormField, initialValues, isFieldVisible, validateValues } from "../event-form/schema";

type PublicEvent = EventInfo & { id: string; form: { fields: FormField[]; design: FormDesign }; full: boolean; closedReason?: string };
type Result = { kind: "paid" | "free" | "pending" | "failed" | "unpaid"; text: string };


/** The live registration form of an event — public, no sign-in. */
export default function PublicEventFormPage() {
  const { eventId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [loadError, setLoadError] = useState("");
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    http
      .get(`/public/events/${eventId}`)
      .then((res: any) => {
        setEvent(res.data);
        setValues(initialValues(res.data.form.fields || []));
        document.title = `${res.data.eventName} — Registration`;
      })
      .catch((e: any) => setLoadError(e?.message || "This registration form is not available"));
  }, [eventId]);

  // Back from the payment gateway: the server has already verified the result.
  useEffect(() => {
    const txn = searchParams.get("txn");
    if (!txn) return;
    http
      .get(`/public/payments/${txn}`)
      .then((res: any) => {
        const s = res?.data?.status;
        if (s === "paid") setResult({ kind: "paid", text: "Payment received. Your registration is confirmed." });
        else if (s === "pending") setResult({ kind: "pending", text: "Your payment is being processed. We will confirm your registration shortly." });
        else setResult({ kind: "failed", text: "The payment did not go through. Your details are saved — please contact the organiser to complete your registration." });
      })
      .catch(() => setResult({ kind: "pending", text: "We could not read the payment status. Please contact the organiser." }))
      .finally(() => setSearchParams({}, { replace: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const change = (key: string, value: any) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };

  const validate = () => {
    if (!event) return false;
    const errs = validateValues(event.form.fields, values);
    const consent = event.form.design.blocks.find((b) => b.type === "consent");
    if (consent && consent.props.required !== false && !values.__consent) errs.__consent = "Please tick this box to continue";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async () => {
    if (!event || submitting) return;
    setFormError("");
    if (!validate()) {
      setFormError("Please correct the highlighted fields.");
      return;
    }
    setSubmitting(true);
    try {
      // send only what is on screen; hidden fields are filled in by the server
      const data: Record<string, any> = {};
      event.form.fields.forEach((f) => {
        if (!f.hidden && isFieldVisible(f, event.form.fields, values)) data[f.key] = values[f.key];
      });
      const res: any = await http.post(`/public/events/${event.id}/register`, { values: data });
      const d = res.data;
      if (d.action) {
        await runPaymentAction(d.action); // leaves this page for the gateway
        return;
      }
      if (d.paymentError) setResult({ kind: "unpaid", text: d.paymentError });
      else if (d.paymentRequired) setResult({ kind: "unpaid", text: "You are registered. The organiser will contact you about the registration fee." });
      else setResult({ kind: "free", text: "You are registered. See you at the event!" });
    } catch (e: any) {
      if (e?.details && typeof e.details === "object") setErrors(e.details);
      setFormError(e?.message || "Could not submit the form. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const th = event?.form.design.theme;
  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: th?.pageBg || "#FAF8F5", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 440, background: th?.cardBg || "#fff", color: th?.text || "#253338", border: `1px solid ${th?.inputBorder || "#E1DFD7"}`, borderRadius: (th?.radius ?? 10) + 4, padding: 28, textAlign: "center" }}>
        {children}
      </div>
    </div>
  );

  if (loadError) return shell(<div style={{ fontSize: 15, fontWeight: 600 }}>{loadError}</div>);
  if (!event) return shell(<div style={{ fontSize: 14, color: "#66797D" }}>Loading…</div>);

  if (result) {
    const good = result.kind === "paid" || result.kind === "free";
    const color = good ? "#1D724D" : result.kind === "failed" ? "#C84630" : "#5A4A2A";
    return shell(
      <>
        <div style={{ width: 52, height: 52, borderRadius: "50%", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", background: `${color}1A`, color, fontSize: 24 }}>
          <i className={`bi ${good ? "bi-check-lg" : result.kind === "failed" ? "bi-x-lg" : "bi-hourglass-split"}`} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{event.eventName}</div>
        <div style={{ fontSize: 14, marginTop: 8, lineHeight: 1.5, color: th?.muted || "#66797D" }}>{result.text}</div>
      </>
    );
  }

  if (event.closedReason) {
    return shell(
      <>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{event.eventName}</div>
        <div style={{ fontSize: 14, marginTop: 8, color: th?.muted || "#66797D" }}>{event.closedReason}.</div>
      </>
    );
  }

  if (event.full) {
    return shell(
      <>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{event.eventName}</div>
        <div style={{ fontSize: 14, marginTop: 8, color: th?.muted || "#66797D" }}>Registrations for this event are full.</div>
      </>
    );
  }

  return (
    <div>
      <FormRenderer
        design={event.form.design}
        fields={event.form.fields}
        event={event}
        mode="live"
        values={values}
        errors={errors}
        onChange={change}
        onSubmit={submit}
        submitting={submitting}
        tail={formError ? <div style={{ fontSize: 13, color: "#DC2626", textAlign: "center" }}>{formError}</div> : undefined}
      />
    </div>
  );
}
