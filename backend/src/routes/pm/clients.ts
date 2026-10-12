import { Router } from "express";
import { ok, asyncHandler, ApiError, audit, paginated } from "../../utils/http";
import { User } from "../../models/User";
import { PmClient } from "../../models/pm/Client";
import { PmProduct } from "../../models/pm/Product";
import { pmRight, visibleFilter } from "../../services/pm/visibility";

/** Clients and their contacts (SPOCs). Own/Team visibility follows the account manager. */
const r = Router();
const AUDIT = "Project Management";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const rx = (q: any) => new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

async function clientBody(req: any, body: any, existing?: any) {
  const out: any = {};
  const has = (k: string) => body[k] !== undefined;
  if (has("name") || !existing) {
    out.name = String(body.name || "").trim();
    if (!out.name) throw new ApiError(400, "Enter the client name");
  }
  if (has("code") || !existing) {
    out.code = String(body.code || "").trim().toUpperCase();
    if (!out.code) throw new ApiError(400, "Enter the client code");
    if (await PmClient.exists({ tenant: req.tenantId, code: out.code, _id: { $ne: existing?._id } })) throw new ApiError(409, "Another client already has this code");
  }
  for (const k of ["address", "city", "state"]) if (has(k)) out[k] = String(body[k] || "").trim();
  if (has("agreementDate")) {
    out.agreementDate = String(body.agreementDate || "").slice(0, 10);
    if (out.agreementDate && (!/^\d{4}-\d{2}-\d{2}$/.test(out.agreementDate) || isNaN(new Date(out.agreementDate).getTime()))) throw new ApiError(400, "Choose a valid agreement date");
  }
  if (has("status")) out.status = body.status === "Inactive" ? "Inactive" : "Active";
  if (has("accountManager")) {
    const id = body.accountManager?._id || body.accountManager || null;
    if (id && !(await User.exists({ _id: id, tenant: req.tenantId }))) throw new ApiError(400, "Choose an account manager");
    out.accountManager = id;
  }
  if (has("products")) {
    const ids = [...new Set((Array.isArray(body.products) ? body.products : []).map((p: any) => String(p?._id || p)))];
    const found = await PmProduct.countDocuments({ tenant: req.tenantId, _id: { $in: ids } });
    if (found !== ids.length) throw new ApiError(400, "Choose valid products");
    out.products = ids;
  }
  if (has("contacts")) {
    const list = (Array.isArray(body.contacts) ? body.contacts : []).map((c: any, i: number) => {
      const name = String(c?.name || "").trim();
      const email = String(c?.email || "").trim().toLowerCase();
      const mobile = String(c?.mobile || "").replace(/[^\d+]/g, "");
      if (!name) throw new ApiError(400, `SPOC ${i + 1}: enter the name`);
      if (email && !EMAIL.test(email)) throw new ApiError(400, `SPOC ${i + 1}: enter a valid email`);
      if (c?.portalAccess && !email) throw new ApiError(400, `SPOC ${i + 1}: portal access needs an email`);
      return { ...(c?._id ? { _id: c._id } : {}), name, designation: String(c?.designation || "").trim(), email, mobile, primary: !!c?.primary, portalAccess: !!c?.portalAccess };
    });
    // exactly one primary contact when there are contacts
    const first = list.findIndex((c: any) => c.primary);
    list.forEach((c: any, i: number) => (c.primary = i === (first === -1 ? 0 : first)));
    out.contacts = list;
  }
  return out;
}

r.get(
  "/clients",
  pmRight("clients", "view"),
  asyncHandler(async (req: any, res: any) => {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(String(req.query.perPage || "50"), 10) || 50));
    const filter: any = { tenant: req.tenantId, ...(await visibleFilter(req, "accountManager")) };
    if (req.query.status === "Active" || req.query.status === "Inactive") filter.status = req.query.status;
    if (req.query.product) filter.products = req.query.product;
    if (req.query.q) filter.$or = [{ name: rx(req.query.q) }, { code: rx(req.query.q) }, { city: rx(req.query.q) }];
    const [items, total] = await Promise.all([
      PmClient.find(filter).sort({ name: 1 }).skip((page - 1) * perPage).limit(perPage).populate("accountManager", "name photo").populate("products", "name code").lean(),
      PmClient.countDocuments(filter),
    ]);
    paginated(res, items, total, page, perPage);
  })
);

r.get(
  "/clients/:id",
  pmRight("clients", "view"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await PmClient.findOne({ _id: req.params.id, tenant: req.tenantId, ...(await visibleFilter(req, "accountManager")) })
      .populate("accountManager", "name photo")
      .populate("products", "name code")
      .lean();
    if (!doc) throw new ApiError(404, "Client not found");
    ok(res, doc);
  })
);

r.post(
  "/clients",
  pmRight("clients", "create"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await PmClient.create({ ...(await clientBody(req, req.body)), tenant: req.tenantId });
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: AUDIT, entity: `Client ${doc.name}` });
    ok(res, doc, 201);
  })
);

r.patch(
  "/clients/:id",
  pmRight("clients", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const existing = await PmClient.findOne({ _id: req.params.id, tenant: req.tenantId, ...(await visibleFilter(req, "accountManager")) });
    if (!existing) throw new ApiError(404, "Client not found");
    Object.assign(existing, await clientBody(req, req.body, existing));
    await existing.save();
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: AUDIT, entity: `Client ${existing.name}` });
    ok(res, existing);
  })
);

r.delete(
  "/clients/:id",
  pmRight("clients", "del"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await PmClient.findOneAndDelete({ _id: req.params.id, tenant: req.tenantId, ...(await visibleFilter(req, "accountManager")) });
    if (!doc) throw new ApiError(404, "Client not found");
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: AUDIT, entity: `Client ${doc.name}` });
    ok(res, { deleted: true });
  })
);

export default r;
