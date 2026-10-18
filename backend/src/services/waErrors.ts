/**
 * Turn a raw WhatsApp send / delivery error into something a person can act on.
 * Errors arrive as "Meta API 400: {json}", "(#131030) title", webhook titles, or plain text.
 */
export interface WaFailure {
  code: string;    // Meta error code when known, else ""
  title: string;   // short reason
  fix: string;     // what to do about it
  raw: string;     // the original text (for support)
}

const KNOWN: Record<string, [string, string]> = {
  "131030": ["Number not in the allowed list", "Your WhatsApp number is in test mode. Add this number under Meta › WhatsApp › API Setup › 'To', or switch to a live (verified) number."],
  "131026": ["Number can't receive the message", "The number isn't on WhatsApp, uses an old app version, or hasn't accepted WhatsApp's terms. Check the number."],
  "131047": ["24-hour reply window closed", "More than 24 hours since this person last messaged you. Send an approved template instead of a normal message."],
  "131048": ["Blocked for spam (rate limit)", "Too many people blocked or reported recent messages. Slow down and improve message quality."],
  "131049": ["Meta chose not to deliver", "Meta limits how many marketing messages one person gets. Try again later or use a utility template."],
  "131050": ["Person stopped marketing messages", "This person opted out of marketing messages from your business."],
  "131051": ["Message type not supported", "This kind of message can't be sent. Use text, media or an approved template."],
  "131052": ["Media download failed", "The person's WhatsApp couldn't download the file. Check the media link."],
  "131053": ["Media upload failed", "The file couldn't be uploaded. Check its type and size."],
  "131056": ["Too many messages to this number", "You sent too many messages to the same number in a short time. Wait and retry."],
  "131008": ["Required value missing", "A template variable or required field is empty. Fill every template variable."],
  "131009": ["Value not valid", "A template variable or field has an invalid value. Check the campaign's variables."],
  "131021": ["Can't send to your own number", "The recipient is the sending number itself."],
  "131031": ["Business account locked", "Your WhatsApp Business account is restricted. Check Meta Business Manager."],
  "131042": ["Payment issue on Meta account", "Add or fix the payment method in Meta Business Manager › WhatsApp › Payment settings."],
  "131045": ["Sending number not registered", "Register / verify the sending phone number in Meta before sending."],
  "131000": ["WhatsApp error (temporary)", "Something went wrong on WhatsApp's side. Resend later."],
  "132000": ["Wrong number of template variables", "The template expects a different number of variables. Fix the variables and resend."],
  "132001": ["Template not found", "The template name or language doesn't exist on Meta (or isn't approved yet). Sync templates and pick an approved one."],
  "132005": ["Template text too long", "Filled-in variables make the message too long. Shorten the variable values."],
  "132007": ["Template breaks WhatsApp's format rules", "Remove forbidden characters or formatting from the variable values."],
  "132012": ["Template variable format wrong", "A variable value doesn't match the format the template expects (e.g. media, date, currency)."],
  "132015": ["Template paused", "Meta paused this template for low quality. Use another template or wait for it to be reactivated."],
  "132016": ["Template disabled", "Meta disabled this template. Create and approve a new one."],
  "133010": ["Sending number not registered", "Register the phone number with the WhatsApp Cloud API."],
  "130429": ["Sending too fast (rate limit)", "The account's message throughput limit was hit. Resend the failed ones later."],
  "130472": ["Held back by a Meta experiment", "Meta held this marketing message back for this person. Nothing to fix; try later."],
  "131016": ["WhatsApp service unavailable", "WhatsApp is temporarily down. Resend later."],
  "190": ["Access token expired or invalid", "Reconnect WhatsApp in Setup › Integrations (generate a new access token)."],
  "100": ["Invalid request", "A setting or value sent to Meta is wrong. Check the WhatsApp account settings and the template."],
  "10": ["Permission denied", "The access token is missing WhatsApp permissions. Reconnect with whatsapp_business_messaging permission."],
  "200": ["Permission denied", "The access token is missing WhatsApp permissions. Reconnect with whatsapp_business_messaging permission."],
  "368": ["Temporarily blocked for policy violations", "Meta blocked sending for policy reasons. Check Account Quality in Meta Business Manager."],
  "80007": ["Account rate limit reached", "The WhatsApp Business account hit its rate limit. Resend later."],
  "470": ["24-hour reply window closed", "Send an approved template instead of a normal message."],
};

export function explainWaError(input: unknown): WaFailure {
  const raw = String(input || "").trim();
  if (!raw) return { code: "", title: "Failed", fix: "", raw };
  let code = "", message = "", details = "";
  // "Meta API 400: {json}" or bare JSON
  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const j = JSON.parse(raw.slice(jsonStart));
      const e = j.error || j;
      code = String(e.code ?? "");
      message = String(e.error_user_title || e.message || e.title || "");
      details = String(e.error_data?.details || e.error_user_msg || "");
    } catch { /* not JSON */ }
  }
  if (!code) { const m = raw.match(/\(#?(\d{2,6})\)/) || raw.match(/\bcode[:= ]+(\d{2,6})/i); if (m) code = m[1]; }
  if (!message) message = raw.replace(/^Meta API \d+:\s*/, "").replace(/\(#\d+\)\s*/, "");
  const known = KNOWN[code];
  if (known) return { code, title: known[0], fix: known[1], raw };
  // plain-language errors from our own checks (no WhatsApp account, network…)
  if (/no whatsapp account|not connected|not configured/i.test(raw)) return { code: "", title: "WhatsApp not connected", fix: "Connect a WhatsApp number in Setup › Integrations.", raw };
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed|network/i.test(raw)) return { code: "", title: "Couldn't reach WhatsApp", fix: "Network problem while sending. Resend the failed ones.", raw };
  const title = (message.replace(/\s+/g, " ").trim() || "Failed").slice(0, 120);
  return { code, title, fix: details && details !== title ? details.slice(0, 240) : "", raw };
}
