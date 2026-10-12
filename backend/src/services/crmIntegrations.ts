import { createHash } from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { ApiError } from "../utils/http";
import { Lead } from "../models/Lead";
import { FollowUp } from "../models/FollowUp";
import { User } from "../models/User";
import { CrmSettings, ICrmSettings, crmSettingsFor } from "../models/CrmExtras";
import { encryptSecret, decryptSecret } from "./payments/crypto";
import { captureEnquiry } from "./leadCapture";
import { logActivity, refreshLead } from "./leadService";
import { notify } from "./pm/messages";

const MIN = 60_000;
const short = (e: any) => String(e?.message || e).slice(0, 200);
/** Read "a.b.0.c" out of an object. */
const dig = (obj: any, path: string) => String(path || "").split(".").filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), obj);

/* ───────────── mailbox: replies from leads land on their timeline ───────────── */

export async function pollInbox(tenant: any, s: ICrmSettings) {
  const box = s.inbox;
  if (!box?.enabled || !box.host || !box.user || !box.pass) return;
  if (box.lastCheck && Date.now() - new Date(box.lastCheck).getTime() < 2 * MIN) return;
  let error = "";
  let lastUid = box.lastUid || 0;
  try {
    const { ImapFlow } = await import("imapflow");
    const { simpleParser } = await import("mailparser");
    const client = new ImapFlow({ host: box.host, port: box.port || 993, secure: box.secure !== false, auth: { user: box.user, pass: decryptSecret(box.pass) }, logger: false });
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const status: any = client.mailbox;
      // first run: start from now, so years of old mail are not pulled in
      if (!lastUid) lastUid = Math.max(0, Number(status?.uidNext || 1) - 1);
      else {
        for await (const msg of client.fetch(`${lastUid + 1}:*`, { uid: true, source: true }, { uid: true })) {
          if (msg.uid <= lastUid) continue;
          lastUid = Math.max(lastUid, msg.uid);
          const mail: any = await simpleParser(msg.source as Buffer);
          const from = String(mail.from?.value?.[0]?.address || "").toLowerCase();
          if (!from) continue;
          const lead = await Lead.findOne({ tenant, email: from });
          if (!lead) continue;
          lead.lastActivity = new Date();
          await lead.save();
          await logActivity({ tenant, lead: lead._id, type: "email", by: lead.name, title: `Email reply: ${String(mail.subject || "(no subject)").slice(0, 200)}`, detail: String(mail.text || "").trim().slice(0, 2000), at: mail.date || new Date() });
          const owner: any = lead.owner && lead.owner !== "Unassigned" ? await User.findOne({ tenant, name: lead.owner, status: "Active" }).select("_id").lean() : null;
          if (owner) await notify({ tenantId: tenant, users: [owner._id], category: "crm_lead", title: `${lead.name} replied by email`, body: String(mail.subject || "").slice(0, 120), link: `/crm/leads?lead=${lead._id}` });
          await refreshLead(lead);
        }
      }
    } finally {
      lock.release();
      await client.logout().catch(() => undefined);
    }
  } catch (e) {
    error = short(e);
  }
  await CrmSettings.updateOne({ _id: s._id }, { $set: { "inbox.lastUid": lastUid, "inbox.lastCheck": new Date(), "inbox.lastError": error } });
}

/** Try the mailbox settings now and say whether they work. */
export async function testInbox(s: ICrmSettings) {
  const box = s.inbox;
  if (!box.host || !box.user || !box.pass) throw new ApiError(400, "Enter the mail server, user and password first");
  const { ImapFlow } = await import("imapflow");
  const client = new ImapFlow({ host: box.host, port: box.port || 993, secure: box.secure !== false, auth: { user: box.user, pass: decryptSecret(box.pass) }, logger: false });
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    const count = Number((client.mailbox as any)?.exists || 0);
    lock.release();
    await client.logout().catch(() => undefined);
    return { ok: true, messages: count };
  } catch (e: any) {
    throw new ApiError(400, `Could not open the mailbox: ${short(e?.responseText || e)}`);
  }
}

/* ───────────── pull leads from any portal that offers a JSON API ───────────── */

export async function pullPortals(tenant: any, s: ICrmSettings) {
  const pulls: any[] = (s.pulls || []).map((p: any) => (typeof p.toObject === "function" ? p.toObject() : { ...p }));
  let changed = false;
  for (const p of pulls) {
    if (!p.enabled || !/^https:\/\//i.test(p.url || "")) continue;
    if (p.lastPull && Date.now() - new Date(p.lastPull).getTime() < 10 * MIN) continue;
    changed = true;
    p.lastPull = new Date();
    p.lastError = "";
    try {
      let headers: Record<string, string> = {};
      try { headers = JSON.parse(decryptSecret(p.headers || "") || "{}"); } catch { /* no headers */ }
      const r = await fetch(p.url, { headers: { Accept: "application/json", ...headers } });
      if (!r.ok) throw new Error(`The portal replied ${r.status}`);
      const body: any = await r.json();
      const rows = p.listPath ? dig(body, p.listPath) : body;
      if (!Array.isArray(rows)) throw new Error("No list of leads found at that path");
      const seen = new Set<string>(p.seen || []);
      const map = p.map || {};
      for (const row of rows.slice(0, 500)) {
        const data: Record<string, string> = {};
        for (const k of ["name", "phone", "email", "city", "state", "course", "message"]) { const v = map[k] ? dig(row, map[k]) : row?.[k]; if (v !== undefined && v !== null) data[k] = String(v); }
        // each enquiry is taken once: by the portal's own id when it has one
        const id = String(map.id ? dig(row, map.id) ?? "" : "") || createHash("sha1").update(`${data.phone}|${data.message || ""}|${data.name}`).digest("hex").slice(0, 16);
        if (seen.has(id)) continue;
        seen.add(id);
        await captureEnquiry(tenant, data, p.name, { source: p.name, user: p.name }).catch(() => undefined);
      }
      p.seen = [...seen].slice(-3000);
    } catch (e) {
      p.lastError = short(e);
    }
  }
  if (changed) await CrmSettings.updateOne({ _id: s._id }, { $set: { pulls } });
}

/* ───────────── Google Calendar, both ways ───────────── */

const SCOPE = "https://www.googleapis.com/auth/calendar.events";
export const googleReady = (s: ICrmSettings) => !!s.google?.clientId && !!s.google?.clientSecret;
const redirectUri = (apiBase: string) => `${apiBase}/webhooks/google/callback`;

/** Where to send the user to give access to their calendar. */
export async function googleAuthUrl(tenant: any, uid: string, apiBase: string) {
  const s = await crmSettingsFor(tenant);
  if (!googleReady(s)) throw new ApiError(400, "Google Calendar is not set up. Add the client ID and secret in CRM Settings → Calendar.");
  const state = jwt.sign({ uid, tenant: String(tenant), purpose: "google" }, config.jwtSecret, { expiresIn: "10m" } as jwt.SignOptions);
  const q = new URLSearchParams({ client_id: s.google.clientId, redirect_uri: redirectUri(apiBase), response_type: "code", scope: `${SCOPE} email`, access_type: "offline", prompt: "consent", state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

/** Google sent the user back with a code: keep the refresh token against that user. */
export async function googleCallback(code: string, state: string, apiBase: string) {
  let who: any;
  try { who = jwt.verify(state, config.jwtSecret); } catch { throw new ApiError(400, "This link has expired. Start again from the CRM."); }
  if (who.purpose !== "google") throw new ApiError(400, "Not a calendar link");
  const s = await crmSettingsFor(who.tenant);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: s.google.clientId, client_secret: decryptSecret(s.google.clientSecret), redirect_uri: redirectUri(apiBase), grant_type: "authorization_code" }),
  });
  const tok: any = await r.json();
  if (!r.ok || !tok.refresh_token) throw new ApiError(400, `Google did not grant access: ${tok.error_description || tok.error || "no refresh token"}`);
  let email = "";
  try { email = JSON.parse(Buffer.from(String(tok.id_token || "").split(".")[1] || "", "base64url").toString() || "{}").email || ""; } catch { /* not needed */ }
  await User.updateOne({ _id: who.uid, tenant: who.tenant }, { $set: { google: { refreshToken: encryptSecret(tok.refresh_token), email, syncToken: new Date().toISOString(), connectedAt: new Date() } } });
  return who.tenant;
}

async function accessToken(s: ICrmSettings, user: any): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: s.google.clientId, client_secret: decryptSecret(s.google.clientSecret), refresh_token: decryptSecret(user.google.refreshToken), grant_type: "refresh_token" }),
  });
  const tok: any = await r.json();
  if (!r.ok) {
    // access was taken away on the Google side: stop trying
    if (tok.error === "invalid_grant") await User.updateOne({ _id: user._id }, { $set: { google: null } });
    throw new Error(tok.error_description || tok.error || "Google refused the token");
  }
  return tok.access_token;
}

const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const lastGoogleRun = new Map<string, number>();

/** Keep each connected person's follow-ups and their Google Calendar in step. */
export async function syncGoogle(tenant: any, s: ICrmSettings) {
  if (!googleReady(s)) return;
  const users: any[] = await User.find({ tenant, status: "Active", "google.refreshToken": { $exists: true, $ne: "" } }).select("name google").lean();
  for (const user of users) {
    const key = String(user._id);
    if (Date.now() - (lastGoogleRun.get(key) || 0) < 2 * MIN) continue;
    lastGoogleRun.set(key, Date.now());
    try {
      const token = await accessToken(s, user);
      const call = (url: string, method = "GET", body?: any) => fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const stamp = () => new Date(Date.now() + 1000);

      // CRM → Google: follow-ups that are new or changed since they were last sent
      const changed = await FollowUp.find({
        tenant, owner: user.name, due: { $gte: new Date(Date.now() - 24 * 60 * MIN) },
        $or: [{ gcalSyncedAt: null }, { $expr: { $gt: ["$updatedAt", "$gcalSyncedAt"] } }],
      }).limit(50);
      for (const f of changed) {
        if (f.done && !f.gcalEventId) { await FollowUp.updateOne({ _id: f._id }, { $set: { gcalSyncedAt: stamp() } }); continue; }
        const event = {
          summary: `${f.done ? "✓ " : ""}${f.type}: ${f.leadName || "Lead"}`,
          description: [f.note, f.phone].filter(Boolean).join("\n"),
          start: { dateTime: new Date(f.due).toISOString() },
          end: { dateTime: new Date(new Date(f.due).getTime() + 30 * MIN).toISOString() },
          extendedProperties: { private: { crmFollowUp: String(f._id), crmSource: "1" } },
        };
        const r = f.gcalEventId ? await call(`${CAL}/${f.gcalEventId}`, "PATCH", event) : await call(CAL, "POST", event);
        const out: any = await r.json().catch(() => ({}));
        // the event was removed in Google: make it again next time
        if (r.status === 404 || r.status === 410) { await FollowUp.updateOne({ _id: f._id }, { $set: { gcalEventId: "", gcalSyncedAt: null } }); continue; }
        if (r.ok && out.id) await FollowUp.updateOne({ _id: f._id }, { $set: { gcalEventId: out.id, gcalSyncedAt: stamp() } });
      }

      // Google → CRM: our events that were moved or deleted there
      const since = user.google.syncToken || new Date(Date.now() - 24 * 60 * MIN).toISOString();
      const now = new Date().toISOString();
      const r = await call(`${CAL}?${new URLSearchParams({ privateExtendedProperty: "crmSource=1", updatedMin: since, showDeleted: "true", singleEvents: "true", maxResults: "100" })}`);
      const list: any = await r.json().catch(() => ({}));
      for (const ev of list.items || []) {
        const id = ev.extendedProperties?.private?.crmFollowUp;
        const f = id ? await FollowUp.findOne({ _id: id, tenant }) : null;
        if (!f) { if (ev.status !== "cancelled" && id) await call(`${CAL}/${ev.id}`, "DELETE"); continue; }
        if (f.done) continue;
        if (ev.status === "cancelled") {
          await FollowUp.updateOne({ _id: f._id }, { $set: { done: true, completedAt: new Date(), outcome: "Cancelled in Google Calendar", gcalEventId: "", gcalSyncedAt: stamp() } });
          await logActivity({ tenant, lead: f.lead, type: "followup_done", by: user.name, title: "Follow-up cancelled in Google Calendar" });
          await refreshLead(f.lead);
          continue;
        }
        const start = ev.start?.dateTime ? new Date(ev.start.dateTime) : null;
        // only a change made in Google after our last send counts, so the two never chase each other
        if (start && Math.abs(start.getTime() - new Date(f.due).getTime()) > MIN && new Date(ev.updated).getTime() > new Date(f.gcalSyncedAt || 0).getTime()) {
          await FollowUp.updateOne({ _id: f._id }, { $set: { due: start, dueDate: start, remindedAt: null, gcalSyncedAt: stamp() } });
          await logActivity({ tenant, lead: f.lead, type: "followup_rescheduled", by: user.name, title: "Follow-up moved in Google Calendar" });
          await refreshLead(f.lead);
        }
      }
      await User.updateOne({ _id: user._id }, { $set: { "google.syncToken": now } });
    } catch (e) {
      console.error(`[crm] Google Calendar sync failed for ${user.name}:`, short(e));
    }
  }
}
