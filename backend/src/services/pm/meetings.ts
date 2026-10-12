import crypto from "crypto";
import { PmMaster } from "../../models/pm/Setup";
import { PmTemplate } from "../../models/pm/Template";
import { PmMeeting } from "../../models/pm/Meeting";
import { appUrl, everyMinute, kick, notify, queueMessages, Recipient } from "./messages";

const fmt = (d: string) => d.split("-").reverse().join("-");
export const newToken = () => crypto.randomBytes(18).toString("hex");

/** A calendar file (.ics) for a meeting, so it lands in the attendee's calendar. */
export function icsFor(m: any, method: "REQUEST" | "CANCEL" = "REQUEST") {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(`${m.date}T${m.from}:00+05:30`);
  const end = new Date(`${m.date}T${m.to}:00+05:30`);
  const esc = (s: string) => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Project Management//EN", `METHOD:${method}`, "BEGIN:VEVENT",
    `UID:${m._id}@pm`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(m.title)}`, `LOCATION:${esc(m.mode === "online" ? m.link : m.mode === "hybrid" ? [m.location, m.link].filter(Boolean).join(" / ") : m.location)}`, `DESCRIPTION:${esc(m.agenda)}`,
    `STATUS:${method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`, `SEQUENCE:${method === "CANCEL" ? 1 : 0}`, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

/** The template category of a meeting type: Training for a type flagged as training, else Meeting. */
async function templateFor(tenantId: any, typeId: any, channel: "email" | "whatsapp") {
  const type: any = typeId ? await PmMaster.findById(typeId).lean() : null;
  const category = type?.flags?.isTraining ? "Training" : "Meeting";
  return (
    (await PmTemplate.findOne({ tenant: tenantId, channel, category, active: true }).sort({ createdAt: 1 }).lean()) ||
    (await PmTemplate.findOne({ tenant: tenantId, channel, category: "Meeting", active: true }).sort({ createdAt: 1 }).lean())
  );
}

/**
 * Tell the attendees about a meeting: invite, update, cancellation or reminder.
 * Email carries the .ics file; WhatsApp and in-app go alongside.
 */
export async function announceMeeting(tenantId: any, meeting: any, kind: "invite" | "update" | "cancel" | "reminder", only?: string[]) {
  const base = await appUrl(tenantId);
  const attendees = (meeting.attendees || []).filter((a: any) => !only || only.includes(String(a._id)));
  if (!attendees.length) return;
  const online = meeting.mode === "online" || meeting.mode === "hybrid";
  const join = online && kind !== "cancel" ? meeting.link || "" : "";
  const prefix = { invite: "", update: "Updated: ", cancel: "Cancelled: ", reminder: "Reminder: " }[kind];
  const extra = {
    "meeting.title": `${prefix}${meeting.title}`,
    "meeting.date": fmt(meeting.date),
    "meeting.time": `${meeting.from} – ${meeting.to}`,
    // an online or online + offline meeting carries its joining link, so every template shows it
    "meeting.location": [meeting.mode === "online" ? "" : meeting.location, online ? `Online${join ? `: ${join}` : ""}` : ""].filter(Boolean).join(" + "),
    "meeting.join": join,
  };
  const linkOf = (r: Recipient) => {
    const a = attendees.find((x: any) => (x.email && x.email === r.email) || (x.mobile && x.mobile === r.mobile));
    return { "meeting.link": kind === "cancel" ? "" : online && meeting.link && kind === "reminder" ? meeting.link : `${base}/pm/meeting/${a?.token || ""}` };
  };
  const recipients: Recipient[] = attendees.map((a: any) => ({ name: a.name, email: a.email, mobile: a.mobile, spoc: a.isClient, userId: a.user ? String(a.user) : undefined }));
  const refs = { projectId: meeting.project || undefined, extra };

  for (const channel of ["email", "whatsapp"] as const) {
    if (channel === "email" && meeting.emailInvite === false) continue;
    const tpl = await templateFor(tenantId, meeting.type, channel);
    if (!tpl) continue;
    await queueMessages({
      tenantId, channel, templateId: tpl._id, recipients, refs, event: `meeting_${kind}`, refKind: "meeting", refId: meeting._id, perRecipient: linkOf,
      attachments: channel === "email" && kind !== "reminder" ? [{ filename: "invite.ics", content: icsFor(meeting, kind === "cancel" ? "CANCEL" : "REQUEST"), contentType: "text/calendar; method=" + (kind === "cancel" ? "CANCEL" : "REQUEST") }] : undefined,
    });
  }
  await notify({
    tenantId, users: attendees.filter((a: any) => a.user).map((a: any) => a.user), except: kind === "reminder" ? undefined : meeting.organizer, category: "meeting",
    title: `${prefix}${meeting.title}`, body: `${fmt(meeting.date)}, ${meeting.from} – ${meeting.to}`, link: `/modules/projects/meetings?open=${meeting._id}`,
  });
  kick();
}

/** Reminders: N minutes before the start, each one once. */
everyMinute(async () => {
  const now = Date.now();
  const soon = new Date(now + 8 * 86_400_000);
  const meetings: any[] = await PmMeeting.find({ status: "scheduled", startsAt: { $gt: new Date(now), $lte: soon }, isDemo: { $ne: true } }).lean();
  for (const m of meetings) {
    for (const mins of m.reminders || []) {
      if ((m.firedReminders || []).includes(mins) || now < new Date(m.startsAt).getTime() - mins * 60_000) continue;
      const got = await PmMeeting.updateOne({ _id: m._id, firedReminders: { $ne: mins } }, { $addToSet: { firedReminders: mins } });
      if (got.modifiedCount) await announceMeeting(m.tenant, m, "reminder");
    }
  }
});
