import { ApiError } from "../utils/http";
import { convertToLead } from "./leadService";

/** Turn a public form submission into a lead (or a repeat enquiry on an existing one). */
export async function captureEnquiry(tenant: any, body: unknown, capturedFrom: string, extra: { source?: string; owner?: string; user?: string } = {}) {
  const values: any = body && typeof body === "object" ? body : {};
  const pickValue = (...keys: string[]) => {
    for (const key of keys) {
      const val = values[key];
      if (typeof val === "string" && val.trim()) return val.trim().slice(0, 500);
      if (typeof val === "number") return String(val);
    }
    return "";
  };

  // builder forms name their fields freely ("Parent Mobile No."), so fall back to a loose match on the key
  const loose = (rx: RegExp, not?: RegExp) => {
    const key = Object.keys(values).find((k) => rx.test(k) && !(not && not.test(k)) && typeof values[k] === "string" && values[k].trim());
    return key ? String(values[key]).trim().slice(0, 500) : "";
  };

  const name = pickValue("studentName", "name", "fullName", "student_name", "full_name") || loose(/name/i, /user|file|course|school/i);
  const phone = pickValue("mobileNumber", "phone", "mobile", "contactNumber", "phoneNumber", "whatsapp") || loose(/phone|mobile|contact|whats/i);
  if (!name || !phone) throw new ApiError(400, "Name and phone are required");

  const result = await convertToLead({
    tenant,
    name,
    phone,
    email: pickValue("emailId", "email") || loose(/e-?mail/i) || undefined,
    sourceKeyOrId: extra.source || pickValue("enquirySource", "source", "leadSource", "utm_source") || "Website",
    owner: extra.owner || undefined,
    course: pickValue("courseInterested", "course", "courseName") || undefined,
    city: pickValue("city", "cityName"),
    state: pickValue("state", "stateName"),
    grade: pickValue("grade", "class", "className"),
    note: pickValue("message", "msg", "query", "comments"),
    utm: {
      source: pickValue("utm_source"),
      medium: pickValue("utm_medium"),
      campaign: pickValue("utm_campaign"),
      term: pickValue("utm_term"),
      content: pickValue("utm_content"),
    },
    capturedFrom,
    branch: pickValue("branch", "campus"),
    partnerCode: pickValue("ref", "partner", "referral_code"),
    visitorId: pickValue("visitor_id", "vid"),
    user: extra.user || "Website",
  });
  // the public caller only needs to know it worked — never the saved record
  return { created: result.created };
}
