import { Request, Response } from "express";
import { Types } from "mongoose";
import { Lead } from "../models/Lead";
import { LeadActivity } from "../models/LeadActivity";
import { FollowUp } from "../models/FollowUp";
import { LeadStatus, LeadSource } from "../models/Masters";
import { asyncHandler, ok } from "../utils/http";
import { buildLeadFilter, STALE_DAYS } from "./leadController";
import { startOfLocalDay, localDateKey, localDateTime, isDateKey } from "../utils/dates";

const pct = (part: number, whole: number) => (whole ? +((part / whole) * 100).toFixed(1) : 0);
const AGE_BANDS: Array<[string, number]> = [["0–3 days", 3], ["4–7 days", 7], ["8–14 days", 14], ["15–30 days", 30], ["Over 30 days", Infinity]];

/**
 * GET /leads/analytics?createdFrom&createdTo&owner&source
 * Also served at /conversion/stats — `totals`, `funnel`, `bySource` and
 * `byOwner` keep the shape the older screens read.
 */
export const analytics = asyncHandler(async (req: Request, res: Response) => {
  const tenant = req.tenantId;
  const filter = await buildLeadFilter(req);
  const [statuses, sources, leads] = await Promise.all([
    LeadStatus.find({ tenant }).sort({ order: 1, createdAt: 1 }).lean(),
    LeadSource.find({ tenant }).lean(),
    Lead.find(filter).select("status source owner value score priority createdAt statusChangedAt firstContactedAt lastActivity nextFollowUp lostReason").lean(),
  ]);
  const st = new Map(statuses.map((s: any) => [String(s._id), s]));
  const stateOf = (l: any) => { const s: any = st.get(String(l.status)); return s?.isWon ? "won" : s?.isLost ? "lost" : "open"; };
  const rows = leads.map((l: any) => ({ ...l, state: stateOf(l) }));
  const ids = rows.map((l) => l._id);

  const won = rows.filter((l) => l.state === "won");
  const lost = rows.filter((l) => l.state === "lost");
  const open = rows.filter((l) => l.state === "open");
  const sod = startOfLocalDay().getTime();
  const staleBefore = Date.now() - STALE_DAYS * 86_400_000;

  const responded = rows.filter((l) => l.firstContactedAt);
  const avgResponseHours = responded.length
    ? +(responded.reduce((s, l) => s + Math.max(0, new Date(l.firstContactedAt).getTime() - new Date(l.createdAt).getTime()), 0) / responded.length / 3_600_000).toFixed(1)
    : null;
  const avgDaysToWin = won.length
    ? +(won.reduce((s, l) => s + Math.max(0, new Date(l.statusChangedAt || l.lastActivity).getTime() - new Date(l.createdAt).getTime()), 0) / won.length / 86_400_000).toFixed(1)
    : null;

  const totals = {
    leads: rows.length,
    open: open.length,
    won: won.length,
    lost: lost.length,
    convRate: pct(won.length, rows.length),
    pipelineValue: open.reduce((s, l) => s + (l.value || 0), 0),
    wonValue: won.reduce((s, l) => s + (l.value || 0), 0),
    untouched: open.filter((l) => !l.firstContactedAt).length,
    stale: open.filter((l) => new Date(l.lastActivity || l.createdAt).getTime() < staleBefore).length,
    overdueFollowUps: open.filter((l) => l.nextFollowUp && new Date(l.nextFollowUp).getTime() < sod).length,
    noFollowUp: open.filter((l) => !l.nextFollowUp).length,
    avgResponseHours,
    avgDaysToWin,
  };

  // funnel: how many leads reached each stage or went further
  const funnel = statuses.filter((s: any) => !s.isLost).map((s: any) => ({
    status: s.name,
    color: s.color,
    count: rows.filter((l) => l.state !== "lost" && ((st.get(String(l.status)) as any)?.order || 0) >= s.order).length,
  }));
  const byStatus = statuses.map((s: any) => {
    const set = rows.filter((l) => String(l.status) === String(s._id));
    return { status: s.name, color: s.color, isWon: !!s.isWon, isLost: !!s.isLost, count: set.length, value: set.reduce((x, l) => x + (l.value || 0), 0) };
  }).filter((r) => r.count > 0);

  const sourceRow = (name: string, color: string, set: any[]) => {
    const w = set.filter((l) => l.state === "won");
    return {
      source: name, color, total: set.length, won: w.length, lost: set.filter((l) => l.state === "lost").length,
      open: set.filter((l) => l.state === "open").length, rate: pct(w.length, set.length), wonValue: w.reduce((s, l) => s + (l.value || 0), 0),
    };
  };
  const bySource = [
    ...sources.map((s: any) => sourceRow(s.name, s.color, rows.filter((l) => String(l.source) === String(s._id)))),
    sourceRow("No source", "#94a3b8", rows.filter((l) => !l.source)),
  ].filter((r) => r.total > 0).sort((a, b) => b.total - a.total);

  // counsellor activity over the same leads
  const T = new Types.ObjectId(String(tenant));
  const perOwner = (Mdl: any, match: any, by: string) =>
    ids.length ? Mdl.aggregate([{ $match: { tenant: T, lead: { $in: ids }, ...match } }, { $group: { _id: by, n: { $sum: 1 } } }]) : Promise.resolve([]);
  const [fuDone, fuOverdue, calls] = await Promise.all([
    perOwner(FollowUp, { done: true }, "$owner"),
    perOwner(FollowUp, { done: false, due: { $lt: startOfLocalDay() } }, "$owner"),
    perOwner(LeadActivity, { type: "call" }, "$by"),
  ]);
  const num = (list: any[], key: string) => list.find((x: any) => x._id === key)?.n || 0;
  const byOwner = [...new Set(rows.map((l) => l.owner || "Unassigned"))].map((owner) => {
    const set = rows.filter((l) => (l.owner || "Unassigned") === owner);
    const w = set.filter((l) => l.state === "won");
    return {
      owner, total: set.length, open: set.filter((l) => l.state === "open").length, won: w.length,
      lost: set.filter((l) => l.state === "lost").length, rate: pct(w.length, set.length),
      wonValue: w.reduce((s, l) => s + (l.value || 0), 0),
      followUpsDone: num(fuDone, owner), followUpsOverdue: num(fuOverdue, owner), calls: num(calls, owner),
    };
  }).sort((a, b) => b.won - a.won || b.total - a.total);

  // daily trend across the chosen range (default: last 30 days)
  const toKey = isDateKey(req.query.createdTo) ? String(req.query.createdTo).slice(0, 10) : localDateKey();
  const fromKey = isDateKey(req.query.createdFrom)
    ? String(req.query.createdFrom).slice(0, 10)
    : localDateKey(localDateTime(toKey).getTime() - 29 * 86_400_000);
  const days: string[] = [];
  for (let t = localDateTime(fromKey).getTime(), end = localDateTime(toKey).getTime(); t <= end && days.length < 92; t += 86_400_000) days.push(localDateKey(t + 43_200_000));
  const createdBy = new Map<string, number>();
  const wonBy = new Map<string, number>();
  for (const l of rows) {
    const k = localDateKey(l.createdAt);
    createdBy.set(k, (createdBy.get(k) || 0) + 1);
    if (l.state === "won") { const w = localDateKey(l.statusChangedAt || l.lastActivity); wonBy.set(w, (wonBy.get(w) || 0) + 1); }
  }
  const trend = days.map((d) => ({ date: d, leads: createdBy.get(d) || 0, won: wonBy.get(d) || 0 }));

  const reasons = new Map<string, number>();
  for (const l of lost) { const r = l.lostReason || "Not recorded"; reasons.set(r, (reasons.get(r) || 0) + 1); }
  const lostReasons = [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);

  const aging = AGE_BANDS.map(([label, max], i) => {
    const min = i === 0 ? -1 : AGE_BANDS[i - 1][1];
    return { label, count: open.filter((l) => { const age = (Date.now() - new Date(l.createdAt).getTime()) / 86_400_000; return age > min && age <= max; }).length };
  });

  const byPriority = ["hot", "warm", "cold"].map((p) => ({ priority: p, count: open.filter((l) => l.priority === p).length }));

  ok(res, { totals, funnel, byStatus, bySource, byOwner, trend, lostReasons, aging, byPriority, range: { from: fromKey, to: toKey } });
});
