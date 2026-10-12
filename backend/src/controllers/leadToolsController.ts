import { Request, Response } from "express";
import { Types } from "mongoose";
import { Lead, LEAD_PRIORITIES, phoneKeyOf } from "../models/Lead";
import { LeadActivity } from "../models/LeadActivity";
import { FollowUp } from "../models/FollowUp";
import { LeadStatus, LeadSource } from "../models/Masters";
import { Registration } from "../models/Registration";
import { Conversation } from "../models/Messaging";
import { asyncHandler, ok, ApiError, audit } from "../utils/http";
import {
  changeLeadStatus, assignLead, assignableOwners, refreshLead, logActivity, cleanPhone, isValidPhone, isValidEmail,
} from "../services/leadService";
import { applyLeadAssignment } from "../services/workflowEngine";
import { buildLeadFilter, deleteLeads } from "./leadController";
import { CustomField } from "../models/ModuleSetup";
import { maskContacts } from "../services/leadService";
import { scopeLeadFilter, leadOwnerScope, canSeeLead } from "../services/leadAccess";
import { normalizeFollowUpType } from "./followUpController";
import { localDateTime, isDateKey, daysFromNow, localDateKey } from "../utils/dates";

const MAX_BULK = 1000;
const MAX_IMPORT = 5000;
const MAX_EXPORT = 20000;
export const IMPORT_FIELDS = ["name", "phone", "email", "altPhone", "course", "grade", "city", "state", "country", "source", "owner", "status", "tags", "value", "note", "branch"] as const;
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
const can = (req: Request, module: string, action: string) => !!(req.perms || []).find((p: any) => p.module === module)?.[action as "view"];

/** Ids a bulk action applies to: an explicit list, or everything matching the list's filters. */
async function bulkTargets(req: Request): Promise<Types.ObjectId[]> {
  const b = req.body || {};
  if (b.allMatching) {
    const filter = await buildLeadFilter(req, b.filters || {});
    const rows = await Lead.find(filter).select("_id").limit(MAX_BULK + 1).lean();
    if (rows.length > MAX_BULK) throw new ApiError(400, `More than ${MAX_BULK} leads match. Narrow the filters first.`);
    return rows.map((r: any) => r._id);
  }
  const ids = (Array.isArray(b.ids) ? b.ids : []).filter((x: any) => Types.ObjectId.isValid(String(x)));
  if (!ids.length) throw new ApiError(400, "Select at least one lead");
  if (ids.length > MAX_BULK) throw new ApiError(400, `Select at most ${MAX_BULK} leads at a time`);
  const rows = await Lead.find(await scopeLeadFilter(req, { tenant: req.tenantId, _id: { $in: ids } })).select("_id").lean();
  return rows.map((r: any) => r._id);
}

/** POST /leads/bulk { ids | allMatching+filters, action, … } */
export const bulk = asyncHandler(async (req: Request, res: Response) => {
  const tenant = req.tenantId;
  const b = req.body || {};
  const action = str(b.action);
  const user = req.auth?.name;
  const ids = await bulkTargets(req);
  if (!ids.length) throw new ApiError(404, "No matching leads");
  let done = 0;
  const errors: string[] = [];

  switch (action) {
    case "assign": {
      const owner = str(b.owner) || "Unassigned";
      if (owner !== "Unassigned" && !(await assignableOwners(tenant)).includes(owner)) throw new ApiError(400, `${owner} is not an active user`);
      for (const lead of await Lead.find({ tenant, _id: { $in: ids } })) {
        if (lead.owner === owner) continue;
        await assignLead({ tenant, lead, owner, user, silent: true });
        done++;
      }
      break;
    }
    case "status": {
      if (!b.statusId) throw new ApiError(400, "Choose a status");
      for (const id of ids) {
        try {
          await changeLeadStatus({ tenant, leadId: String(id), statusId: b.statusId, subStatusId: b.subStatusId, lostReason: b.lostReason, user });
          done++;
        } catch (e: any) {
          if (errors.length < 5) errors.push(e.message);
        }
      }
      break;
    }
    case "addTag":
    case "removeTag": {
      const tag = str(b.tag);
      if (!tag) throw new ApiError(400, "Enter a tag");
      const r = await Lead.updateMany(
        { tenant, _id: { $in: ids } },
        action === "addTag" ? { $addToSet: { tags: tag } } : { $pull: { tags: tag } }
      );
      done = r.modifiedCount;
      break;
    }
    case "priority": {
      if (!(LEAD_PRIORITIES as readonly string[]).includes(b.priority)) throw new ApiError(400, "Priority must be hot, warm or cold");
      const r = await Lead.updateMany({ tenant, _id: { $in: ids } }, { $set: { priority: b.priority, priorityManual: true } });
      done = r.modifiedCount;
      break;
    }
    case "followup": {
      if (!isDateKey(b.date)) throw new ApiError(400, "Choose a follow-up date");
      const due = localDateTime(b.date, str(b.time) || "10:00");
      const type = normalizeFollowUpType(b.type);
      for (const lead of await Lead.find({ tenant, _id: { $in: ids } })) {
        await FollowUp.create({
          tenant, lead: lead._id, leadName: lead.name, phone: lead.phone, due, dueDate: due, dueTime: str(b.time) || "10:00",
          type, note: str(b.note), remark: str(b.note), owner: lead.owner, assignedTo: lead.owner, status: lead.status,
        });
        await logActivity({ tenant, lead: lead._id, type: "followup_scheduled", by: user, title: `${type} follow-up scheduled`, detail: str(b.note), meta: { due } });
        await refreshLead(lead);
        done++;
      }
      break;
    }
    case "delete": {
      if (!can(req, "leads", "del")) throw new ApiError(403, "Forbidden: need del on leads");
      done = await deleteLeads(tenant, ids, user);
      break;
    }
    default:
      throw new ApiError(400, "Unknown bulk action");
  }

  await audit({ tenant, user, action: `BULK_${action.toUpperCase()}`, module: "Leads", entity: `${done} lead(s)`, next: str(b.owner || b.tag || b.priority) });
  ok(res, { matched: ids.length, done, errors });
});

/* ───────────── import ───────────── */

/**
 * POST /leads/import { rows, dryRun, onDuplicate: "skip" | "update", defaults }
 * Rows are plain objects keyed by the lead field names. A dry run returns the
 * same per-row verdicts without saving anything.
 */
export const importLeads = asyncHandler(async (req: Request, res: Response) => {
  const tenant = req.tenantId;
  const b = req.body || {};
  const rows: any[] = Array.isArray(b.rows) ? b.rows : [];
  if (!rows.length) throw new ApiError(400, "The file has no rows");
  if (rows.length > MAX_IMPORT) throw new ApiError(400, `Import at most ${MAX_IMPORT} rows at a time`);
  const dryRun = !!b.dryRun;
  const onDuplicate = b.onDuplicate === "update" ? "update" : "skip";
  const defaults = b.defaults || {};
  const user = req.auth?.name;

  const [statuses, sources, owners, existing] = await Promise.all([
    LeadStatus.find({ tenant }).sort({ order: 1, createdAt: 1 }).lean(),
    LeadSource.find({ tenant }).lean(),
    assignableOwners(tenant),
    Lead.find({ tenant }).select("phoneKey email course city state country grade altPhone value branch").lean(),
  ]);
  if (!statuses.length) throw new ApiError(400, "No lead statuses are set up yet. Add one in Setup.");
  const statusByName = new Map(statuses.map((s: any) => [s.name.toLowerCase(), s]));
  const defaultStatus: any = statuses.find((s: any) => String(s._id) === String(defaults.statusId)) || statuses[0];
  const sourceByName = new Map(sources.map((s: any) => [s.name.toLowerCase(), s]));
  const defaultSource: any = sources.find((s: any) => String(s._id) === String(defaults.source)) || null;
  const ownerByName = new Map(owners.map((o) => [o.toLowerCase(), o]));
  const defaultOwner = ownerByName.get(str(defaults.owner).toLowerCase()) || (req.leadVisibility === "own" ? user || "" : "");
  const known = new Map(existing.map((l: any) => [l.phoneKey, l]));
  const seen = new Set<string>();

  const results: any[] = [];
  const toCreate: any[] = [];
  const toUpdate: Array<{ id: any; set: any }> = [];
  const newSources = new Map<string, string>();

  rows.forEach((raw, i) => {
    const r: any = Object.fromEntries(IMPORT_FIELDS.map((k) => [k, str(raw?.[k])]));
    const row = i + 1;
    const phone = cleanPhone(r.phone);
    const key = phoneKeyOf(phone);
    const email = r.email.toLowerCase();
    const fail = (reason: string) => results.push({ row, name: r.name, phone: r.phone, result: "invalid", reason });

    if (!r.name) return fail("Name is missing");
    if (!isValidPhone(phone)) return fail("Phone number is not valid");
    if (email && !isValidEmail(email)) return fail("Email is not valid");
    if (seen.has(key)) return results.push({ row, name: r.name, phone, result: "duplicate", reason: "Repeated in this file" });
    seen.add(key);

    const status: any = (r.status && statusByName.get(r.status.toLowerCase())) || defaultStatus;
    const srcName = r.source.toLowerCase();
    const source: any = (srcName && sourceByName.get(srcName)) || null;
    if (srcName && !source) newSources.set(srcName, r.source);
    const owner = ownerByName.get(r.owner.toLowerCase()) || defaultOwner || "Unassigned";
    const tags = [...new Set([...r.tags.split(/[;,|]/), ...(Array.isArray(defaults.tags) ? defaults.tags : [])].map((t: string) => str(t)).filter(Boolean))];
    const fields: any = {
      name: r.name, email: email || undefined, course: r.course, city: r.city, state: r.state, country: r.country,
      grade: r.grade, altPhone: r.altPhone ? cleanPhone(r.altPhone) : "", value: Number(r.value) || 0, branch: r.branch,
    };
    // columns matched to custom fields arrive as cf_<key>
    const customFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw || {})) if (/^cf_[a-z0-9_]+$/i.test(k) && str(v)) customFields[k.slice(3)] = str(v);

    const dup: any = known.get(key);
    if (dup) {
      if (onDuplicate === "skip") return results.push({ row, name: r.name, phone, result: "duplicate", reason: "Already a lead" });
      // only fill what the saved lead is missing; nothing already there is overwritten
      const set: any = {};
      for (const [k, v] of Object.entries(fields)) if (k !== "name" && v && !dup[k]) set[k] = v;
      if (!Object.keys(set).length) return results.push({ row, name: r.name, phone, result: "duplicate", reason: "Already a lead, nothing new to add" });
      toUpdate.push({ id: dup._id, set });
      return results.push({ row, name: r.name, phone, result: "updated" });
    }

    toCreate.push({
      doc: {
        tenant, ...fields, phone, phoneKey: key, status: status._id, source: source?._id || defaultSource?._id,
        owner, tags, customFields, lastActivity: new Date(), statusChangedAt: new Date(), capturedFrom: "Import",
        notes: r.note ? [{ text: r.note, by: user || "System", at: new Date() }] : [],
      },
      newSource: source ? "" : srcName,
      closed: !!(status.isWon || status.isLost),
    });
    results.push({ row, name: r.name, phone, result: "created" });
  });

  const count = (k: string) => results.filter((x) => x.result === k).length;
  const summary = { total: rows.length, created: count("created"), updated: count("updated"), duplicate: count("duplicate"), invalid: count("invalid") };
  const problems = results.filter((x) => x.result === "invalid" || x.result === "duplicate").slice(0, 200);
  if (dryRun) return ok(res, { dryRun: true, summary, problems, newSources: [...newSources.values()] });

  // sources named in the file that do not exist yet
  for (const [lower, name] of newSources) {
    const created = await LeadSource.create({ tenant, name });
    sourceByName.set(lower, created);
  }
  for (const c of toCreate) if (c.newSource) c.doc.source = (sourceByName.get(c.newSource) as any)?._id;

  const due = daysFromNow(1);
  const inserted = toCreate.length ? await Lead.insertMany(toCreate.map((c) => ({ ...c.doc, nextFollowUp: c.closed ? null : due }))) : [];
  if (inserted.length) {
    const open = inserted.filter((_, i) => !toCreate[i].closed);
    await Promise.all([
      LeadActivity.insertMany(inserted.map((l) => ({ tenant, lead: l._id, type: "imported", title: "Imported", by: user || "System", at: new Date() }))),
      open.length
        ? FollowUp.insertMany(open.map((l) => ({
            tenant, lead: l._id, leadName: l.name, phone: l.phone, due, dueDate: due, type: "Call",
            note: "First contact", owner: l.owner, assignedTo: l.owner, status: l.status,
          })))
        : Promise.resolve(),
    ]);
    // unassigned rows go through the assignment workflow, one at a time so round-robin stays fair
    for (const l of inserted) {
      if (l.owner !== "Unassigned") continue;
      await applyLeadAssignment(l as any, tenant!);
      if (l.owner !== "Unassigned") await FollowUp.updateMany({ tenant, lead: l._id, done: false }, { $set: { owner: l.owner, assignedTo: l.owner } });
    }
    // imports can be thousands of rows: score them in the background
    void (async () => { for (const l of inserted) await refreshLead(l._id).catch(() => undefined); })();
  }
  for (const u of toUpdate) await Lead.updateOne({ _id: u.id, tenant }, { $set: { ...u.set, lastActivity: new Date() } });

  await audit({ tenant, user, action: "IMPORT", module: "Leads", entity: `${inserted.length} created, ${toUpdate.length} updated`, next: `${rows.length} rows` });
  ok(res, { dryRun: false, summary, problems });
});

/* ───────────── export ───────────── */

/** A CSV cell: quoted, and never starting with a character a spreadsheet would run as a formula. */
const cell = (v: unknown) => {
  let s = v === undefined || v === null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s) && isNaN(Number(s))) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

/** GET /leads/export — the current list filters, as a CSV file. */
export const exportLeads = asyncHandler(async (req: Request, res: Response) => {
  const filter = await buildLeadFilter(req);
  const leads: any[] = await Lead.find(filter).sort({ createdAt: -1 }).limit(MAX_EXPORT).populate("status source subStatus", "name").lean();
  const custom = await CustomField.find({ tenant: req.tenantId, module: "crm", isActive: { $ne: false } }).select("key label").lean();
  const head = ["Name", "Phone", "Email", "Status", "Sub-status", "Source", "Owner", "Priority", "Score", "Course", "Grade", "City", "State", "Value", "Tags", "Next follow-up", "Last activity", "Lost reason", "Created", "Branch", ...custom.map((c: any) => c.label)];
  const lines = [head.map(cell).join(",")];
  for (const l of maskContacts(req, leads)) {
    lines.push([
      l.name, l.phone, l.email, l.status?.name, l.subStatus?.name, l.source?.name, l.owner, l.priority, l.score, l.course, l.grade,
      l.city, l.state, l.value, (l.tags || []).join("; "),
      l.nextFollowUp ? localDateKey(l.nextFollowUp) : "", l.lastActivity ? localDateKey(l.lastActivity) : "", l.lostReason,
      l.createdAt ? localDateKey(l.createdAt) : "", l.branch, ...custom.map((c: any) => l.customFields?.[c.key] ?? ""),
    ].map(cell).join(","));
  }
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "EXPORT", module: "Leads", entity: `${leads.length} lead(s)` });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="leads-${localDateKey()}.csv"`);
  res.send("﻿" + lines.join("\r\n"));
});

/* ───────────── duplicates ───────────── */

/** GET /leads/duplicates — leads that share a phone number or an email. */
export const duplicates = asyncHandler(async (req: Request, res: Response) => {
  const tenant = new Types.ObjectId(String(req.tenantId));
  const scope = await leadOwnerScope(req);
  const inView = scope ? { owner: { $in: scope } } : {};
  const group = (field: string, match: any) =>
    Lead.aggregate([
      { $match: { tenant, ...inView, ...match } },
      { $group: { _id: field, ids: { $push: "$_id" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 200 },
    ]);
  const [byPhone, byEmail] = await Promise.all([
    group("$phoneKey", { phoneKey: { $nin: ["", null] } }),
    group({ $toLower: "$email" } as any, { email: { $nin: ["", null] } }),
  ]);

  const seen = new Set<string>();
  const sets: Array<{ reason: string; key: string; ids: any[] }> = [];
  for (const [reason, groups] of [["Same phone", byPhone], ["Same email", byEmail]] as const) {
    for (const g of groups) {
      const sig = g.ids.map(String).sort().join(",");
      if (seen.has(sig)) continue;
      seen.add(sig);
      sets.push({ reason, key: String(g._id), ids: g.ids });
    }
  }
  const leads: any[] = await Lead.find({ tenant, _id: { $in: sets.flatMap((s) => s.ids) } })
    .select("name phone email owner status source score createdAt lastActivity followUpCount").populate("status source", "name color").lean();
  const byId = new Map(leads.map((l) => [String(l._id), l]));
  ok(res, sets.map((s) => ({
    reason: s.reason,
    key: s.key,
    leads: s.ids.map((id) => byId.get(String(id))).filter(Boolean).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
  })));
});

/** POST /leads/merge { primaryId, duplicateIds } — fold duplicates into one lead. */
export const merge = asyncHandler(async (req: Request, res: Response) => {
  const tenant = req.tenantId;
  const { primaryId, duplicateIds } = req.body || {};
  if (!Types.ObjectId.isValid(String(primaryId)) || !Array.isArray(duplicateIds) || !duplicateIds.length) {
    throw new ApiError(400, "Choose the lead to keep and at least one duplicate");
  }
  const primary = (await canSeeLead(req, primaryId)) ? await Lead.findOne({ _id: primaryId, tenant }) : null;
  if (!primary) throw new ApiError(404, "Lead not found");
  const dups = await Lead.find({ ...(await scopeLeadFilter(req, { tenant })), _id: { $in: duplicateIds.filter((x: any) => Types.ObjectId.isValid(String(x)) && String(x) !== String(primaryId)) } });
  if (!dups.length) throw new ApiError(400, "Nothing to merge");
  const dupIds = dups.map((d) => d._id);

  for (const d of dups) {
    for (const k of ["email", "course", "city", "state", "country", "grade", "altPhone", "lostReason"] as const) {
      if (!(primary as any)[k] && (d as any)[k]) (primary as any)[k] = (d as any)[k];
    }
    if (!primary.source && d.source) primary.source = d.source;
    if ((!primary.owner || primary.owner === "Unassigned") && d.owner) primary.owner = d.owner;
    // a different phone on the duplicate is kept as the alternate number
    if (!primary.altPhone && phoneKeyOf(d.phone) !== phoneKeyOf(primary.phone)) primary.altPhone = d.phone;
    primary.value = Math.max(primary.value || 0, d.value || 0);
    primary.tags = [...new Set([...(primary.tags || []), ...(d.tags || [])])];
    primary.notes.push(...(d.notes || []));
    primary.enquiryCount = (primary.enquiryCount || 1) + (d.enquiryCount || 1);
    primary.followUpCount = (primary.followUpCount || 0) + (d.followUpCount || 0);
    for (const t of d.serviceTracks || []) {
      if (!primary.serviceTracks.some((p) => String(p.service) === String(t.service))) primary.serviceTracks.push(t);
    }
    if (d.firstContactedAt && (!primary.firstContactedAt || d.firstContactedAt < primary.firstContactedAt)) primary.firstContactedAt = d.firstContactedAt;
    if (d.lastContactedAt && (!primary.lastContactedAt || d.lastContactedAt > primary.lastContactedAt)) primary.lastContactedAt = d.lastContactedAt;
  }
  primary.notes.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  primary.lastActivity = new Date();
  await primary.save();

  await Promise.all([
    FollowUp.updateMany({ tenant, lead: { $in: dupIds } }, { $set: { lead: primary._id, leadName: primary.name, phone: primary.phone } }),
    LeadActivity.updateMany({ tenant, lead: { $in: dupIds } }, { $set: { lead: primary._id } }),
    Registration.updateMany({ tenant, lead: { $in: dupIds } }, { $set: { lead: primary._id } }),
    Conversation.updateMany({ tenant, lead: { $in: dupIds } }, { $set: { lead: primary._id } }),
  ]);
  await Lead.deleteMany({ tenant, _id: { $in: dupIds } });
  await logActivity({ tenant, lead: primary._id, type: "merged", by: req.auth?.name, title: `Merged ${dups.length} duplicate${dups.length === 1 ? "" : "s"}`, detail: dups.map((d) => `${d.name} (${d.phone})`).join(", ") });
  await refreshLead(primary);
  await audit({ tenant, user: req.auth?.name, action: "MERGE", module: "Leads", entity: primary.name, next: `${dups.length} merged` });
  ok(res, await primary.populate("status source subStatus"));
});
