import { Request, Response } from "express";
import { Model } from "mongoose";
import { asyncHandler, ok, paginated, ApiError, audit } from "../utils/http";

/**
 * Build standard list/get/create/update/remove handlers for a tenant-scoped model.
 * All queries are automatically filtered by req.tenantId so tenants never see
 * each other's data.
 */
export function crud<T>(Mdl: Model<T>, opts: { module: string; searchFields?: string[]; populate?: string; defaultSort?: Record<string, 1 | -1> } = { module: "generic" }) {
  return {
    list: asyncHandler(async (req: Request, res: Response) => {
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
      const perPage = Math.min(200, Math.max(1, parseInt(String(req.query.perPage || "50"), 10) || 50));
      // a route may narrow the list first (e.g. to the people whose records this user may see)
      const filter: any = { tenant: req.tenantId, ...((req as any).assignedScope || {}) };

      // simple field filters passed as query params
      for (const [k, v] of Object.entries(req.query)) {
        if (["page", "perPage", "q", "sort", "tenant"].includes(k) || k.startsWith("$")) continue;
        // plain values only: ?owner[$ne]=x must not become a Mongo operator
        if (typeof v !== "string") continue;
        if (v !== "" && v !== "All") filter[k] = v;
      }
      // text search
      if (typeof req.query.q === "string" && req.query.q && opts.searchFields?.length) {
        const rx = new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filter.$or = opts.searchFields.map((f) => ({ [f]: rx }));
      }

      const sort: any = req.query.sort ? { [String(req.query.sort).replace(/^-/, "")]: String(req.query.sort).startsWith("-") ? -1 : 1 } : opts.defaultSort || { createdAt: -1 };

      let query = Mdl.find(filter).sort(sort).skip((page - 1) * perPage).limit(perPage);
      if (opts.populate) query = query.populate(opts.populate) as any;

      const [items, total] = await Promise.all([query, Mdl.countDocuments(filter)]);
      paginated(res, items, total, page, perPage);
    }),

    get: asyncHandler(async (req: Request, res: Response) => {
      let q = Mdl.findOne({ _id: req.params.id, tenant: req.tenantId });
      if (opts.populate) q = q.populate(opts.populate) as any;
      const item = await q;
      if (!item) throw new ApiError(404, `${opts.module} not found`);
      ok(res, item);
    }),

    create: asyncHandler(async (req: Request, res: Response) => {
      const item = await Mdl.create({ ...req.body, tenant: req.tenantId });
      await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: opts.module, entity: (req.body.name || (item as any)._id) });
      ok(res, item, 201);
    }),

    update: asyncHandler(async (req: Request, res: Response) => {
      // a record can never be moved to another tenant or given a new id
      const { tenant: _t, _id: _i, ...changes } = req.body || {};
      const item = await Mdl.findOneAndUpdate(
        { _id: req.params.id, tenant: req.tenantId },
        { $set: changes },
        { new: true, runValidators: true }
      );
      if (!item) throw new ApiError(404, `${opts.module} not found`);
      await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: opts.module, entity: (req.body.name || (item as any)._id) });
      ok(res, item);
    }),

    remove: asyncHandler(async (req: Request, res: Response) => {
      const item = await Mdl.findOneAndDelete({ _id: req.params.id, tenant: req.tenantId });
      if (!item) throw new ApiError(404, `${opts.module} not found`);
      await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: opts.module, entity: (item as any).name || req.params.id });
      ok(res, { deleted: true });
    }),
  };
}
