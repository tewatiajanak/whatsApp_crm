import { Router } from "express";
import { ok, asyncHandler, ApiError } from "../utils/http";
import { EmEvent, EmAttendee } from "../models/EventManager";
import { PaymentGateway, PaymentTransaction } from "../models/Payment";
import { initiatePayment, publicBase } from "../services/payments";
import { config } from "../config";

/**
 * Public side of an event's registration form (no sign-in):
 *
 *   GET  /public/events/:id            what the live form needs to draw itself
 *   POST /public/events/:id/register   submit a registration (and start payment)
 *   GET  /public/payments/:txnId       outcome of a registration payment
 *
 * Only events whose form is published are visible here, and only the fields
 * the form needs are returned.
 */
const r = Router();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REPEATER_MAX = 50;
const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || v === false || (Array.isArray(v) && !v.length);
const clip = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 2000) : v);

/* The same rules as the form itself (frontend event-form/schema.ts) — the
   browser is not trusted to have applied them. */

/** A field with a condition counts only while the field it depends on matches. */
function isFieldVisible(f: any, fields: any[], values: Record<string, any>, depth = 0): boolean {
  const w = f.showWhen;
  if (!w?.field) return true;
  const ctrl = fields.find((x) => x.key === w.field);
  if (!ctrl || ctrl.key === f.key) return true;
  if (depth < 5 && !ctrl.hidden && !isFieldVisible(ctrl, fields, values, depth + 1)) return false;
  const v = values[ctrl.key];
  const filled = !isEmpty(v);
  if (w.op === "filled") return filled;
  if (w.op === "empty") return !filled;
  const target = String(w.value ?? "");
  const hit = Array.isArray(v)
    ? ctrl.type === "repeater" ? String(v.length) === target : v.map(String).includes(target)
    : ctrl.type === "consent" ? (v ? "yes" : "no") === target.toLowerCase()
    : String(v ?? "") === target;
  return w.op === "is" ? hit : !hit;
}

const defaultFor = (f: any): any => {
  const d = String(f.defaultValue ?? "").trim();
  if (f.type === "multiselect") return d ? d.split(",").map((x: string) => x.trim()).filter(Boolean) : [];
  if (f.type === "consent") return /^(yes|true|1)$/i.test(d);
  return d;
};

const checkOne = (type: string, label: string, required: boolean, v: unknown): string => {
  if (isEmpty(v)) return required ? `${label} is required` : "";
  if (type === "email" && !EMAIL.test(String(v))) return "Enter a valid email address";
  if (type === "phone" && String(v).replace(/\D/g, "").length < 7) return "Enter a valid mobile number";
  if (type === "number" && !Number.isFinite(Number(v))) return "Enter a number";
  return "";
};
const inOptions = (options: unknown, v: unknown) => !Array.isArray(options) || !options.length || options.map(String).includes(String(v));

/** Validate the submitted answers and return only what the form asks for. */
function readAnswers(fields: any[], raw: Record<string, any>) {
  const data: Record<string, any> = {};
  const errors: Record<string, string> = {};
  // hidden fields always carry their configured value, whatever was sent
  const values: Record<string, any> = { ...raw };
  fields.filter((f) => f.hidden).forEach((f) => { values[f.key] = defaultFor(f); });

  for (const f of fields) {
    if (f.hidden) {
      if (!isEmpty(values[f.key])) data[f.key] = Array.isArray(values[f.key]) ? values[f.key].join(", ") : values[f.key];
      continue;
    }
    if (!isFieldVisible(f, fields, values)) continue; // closed by its condition: not asked, not saved
    let v = clip(values[f.key]);

    if (f.type === "repeater") {
      const rows: any[] = Array.isArray(v) ? v : [];
      const subs: any[] = Array.isArray(f.subFields) ? f.subFields : [];
      const min = Math.max(f.required ? 1 : 0, Number(f.minRows) || 0);
      const max = Math.min(REPEATER_MAX, Number(f.maxRows) || REPEATER_MAX);
      if (rows.length < min) errors[f.key] = min === 1 ? `Add at least one ${String(f.itemLabel || "entry").toLowerCase()}` : `At least ${min} are needed`;
      else if (rows.length > max) errors[f.key] = `At most ${max} are allowed`;
      const cleaned = rows.slice(0, max).map((row, i) => {
        const out: Record<string, any> = {};
        subs.forEach((sf) => {
          const cell = clip(row?.[sf.key]);
          const e = checkOne(sf.type, sf.label, !!sf.required, cell) || (!isEmpty(cell) && sf.type === "dropdown" && !inOptions(sf.options, cell) ? "Choose an option from the list" : "");
          if (e) errors[`${f.key}.${i}.${sf.key}`] = e;
          else if (!isEmpty(cell)) out[sf.key] = cell;
        });
        return out;
      });
      if (cleaned.length) data[f.key] = cleaned;
      continue;
    }

    const e = checkOne(f.type, f.label, !!f.required, v);
    if (e) {
      errors[f.key] = e;
      continue;
    }
    if (isEmpty(v)) continue;
    if (f.type === "multiselect") {
      const list = (Array.isArray(v) ? v : [v]).map(String).slice(0, 100);
      if (list.some((x) => !inOptions(f.options, x))) errors[f.key] = "Choose options from the list";
      else if (f.minSelect && list.length < f.minSelect) errors[f.key] = `Choose at least ${f.minSelect}`;
      else if (f.maxSelect && list.length > f.maxSelect) errors[f.key] = `Choose at most ${f.maxSelect}`;
      v = list.join(", ");
    } else if (f.type === "dropdown" && f.key !== "category" && !inOptions(f.options, v)) {
      errors[f.key] = "Choose an option from the list";
    }
    data[f.key] = v;
  }
  return { data, errors };
}

/** A local date (+ optional HH:mm) as an instant, in the app's time zone. */
const localInstant = (date?: string, time?: string, fallbackTime = "23:59"): number => {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return NaN;
  const t = /^\d{2}:\d{2}$/.test(time || "") ? time : fallbackTime;
  return new Date(`${date.slice(0, 10)}T${t}:00${config.timezoneOffset}`).getTime();
};

/**
 * When registration stops: the closing date/time set on the event if any,
 * otherwise the end of the event's last day. Returns why it is closed, or "".
 */
export function closedReason(e: any, now = Date.now()): string {
  const manual = localInstant(e.registrationCloseDate, e.registrationCloseTime);
  if (Number.isFinite(manual) && now > manual) return "Registrations for this event are closed";
  const lastDay = localInstant(e.endDate || e.startDate, undefined);
  if (Number.isFinite(lastDay) && now > lastDay) return "This event is over — registrations are closed";
  return "";
}

async function publishedEvent(id: string) {
  const e: any = await EmEvent.findById(id).lean();
  if (!e || !e.form?.published) throw new ApiError(404, "This registration form is not available");
  return e;
}

const feeFor = (e: any, category?: string): number => {
  const fees = e.registrationFees || {};
  if (category && fees[category] !== undefined) return Number(fees[category]) || 0;
  return Number(e.registrationFee) || 0;
};

r.get(
  "/public/events/:id",
  asyncHandler(async (req: any, res: any) => {
    const e = await publishedEvent(req.params.id);
    const registered = await EmAttendee.countDocuments({ tenant: e.tenant, eventId: e._id });
    const capacity = Number(e.capacity) || 0;
    ok(res, {
      id: e._id,
      eventName: e.eventName,
      startDate: e.startDate,
      endDate: e.endDate,
      startTime: e.startTime,
      endTime: e.endTime,
      venue: e.venue,
      city: e.city,
      organizer: e.organizer,
      description: e.description,
      registrationFees: e.registrationFees || {},
      registrationFee: Number(e.registrationFee) || 0,
      form: { fields: e.form.fields || [], design: e.form.design },
      full: capacity > 0 && registered >= capacity,
      closedReason: closedReason(e),
    });
  })
);

r.post(
  "/public/events/:id/register",
  asyncHandler(async (req: any, res: any) => {
    const e = await publishedEvent(req.params.id);
    const values: Record<string, any> = req.body?.values && typeof req.body.values === "object" ? req.body.values : {};
    const fields: any[] = Array.isArray(e.form.fields) ? e.form.fields : [];

    const closed = closedReason(e);
    if (closed) throw new ApiError(409, closed);

    const capacity = Number(e.capacity) || 0;
    if (capacity > 0 && (await EmAttendee.countDocuments({ tenant: e.tenant, eventId: e._id })) >= capacity) {
      throw new ApiError(409, "Registrations for this event are full");
    }

    // Take only what the form asks for, and check it the same way the form does.
    const { data, errors } = readAnswers(fields, values);
    const categories = Object.keys(e.registrationFees || {});
    if (data.category && categories.length && !categories.includes(String(data.category))) errors.category = "Choose a category from the list";
    if (Object.keys(errors).length) {
      throw new ApiError(400, "Please correct the highlighted fields", errors);
    }

    const fee = feeFor(e, data.category);
    const gateway = fee > 0 ? await PaymentGateway.exists({ tenant: e.tenant, isActive: true }) : null;
    const attendee: any = await EmAttendee.create({
      ...data,
      name: String(data.name || ""),
      eventId: e._id,
      tenant: e.tenant,
      status: "registered",
      source: "public-form",
      fee,
      paymentStatus: fee > 0 ? (gateway ? "pending" : "unpaid") : "free",
    });

    let action: any = null;
    let paymentError: string | undefined;
    if (fee > 0 && gateway) {
      // The customer returns to the page they registered on (never a caller-chosen URL).
      const origin = String(req.headers.origin || "").replace(/\/+$/, "");
      try {
        const started = await initiatePayment(String(e.tenant), publicBase(req), {
          amount: fee,
          currency: "INR",
          purpose: `${e.eventName} registration`.slice(0, 100),
          customer: { name: attendee.name, email: data.email || "", phone: data.phone || "" },
          reference: { module: "events", id: String(attendee._id) },
          returnUrl: /^https?:\/\//i.test(origin) ? `${origin}/e/${e._id}` : undefined,
        });
        action = started.action;
        await EmAttendee.updateOne({ _id: attendee._id }, { $set: { paymentTxnId: started.txnId } });
      } catch (err: any) {
        paymentError = "Your registration is saved, but the payment could not be started. The organiser will contact you.";
        console.error("[public-events] payment start failed:", err?.message || err);
        await EmAttendee.updateOne({ _id: attendee._id }, { $set: { paymentStatus: "unpaid" } });
      }
    }

    ok(res, { attendeeId: attendee._id, fee, action, paymentError, paymentRequired: fee > 0 && !gateway }, 201);
  })
);

r.get(
  "/public/payments/:txnId",
  asyncHandler(async (req: any, res: any) => {
    const t = await PaymentTransaction.findOne({ txnId: req.params.txnId }).lean();
    if (!t) throw new ApiError(404, "Transaction not found");
    ok(res, { txnId: t.txnId, status: t.status, amount: t.amount, currency: t.currency });
  })
);

export default r;
