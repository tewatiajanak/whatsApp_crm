import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../utils/jwt";
import { ApiError } from "../utils/http";
import { User, UserType, IPermission, effectivePerms } from "../models/User";

// augment Express Request
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: JwtPayload;
      perms?: IPermission[];
      tenantId?: string;
    }
  }
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new ApiError(401, "Missing bearer token");

    const payload = verifyToken(token);
    // tokens issued for one purpose (e.g. the OTP step) are not a session
    if ((payload as any).purpose) throw new ApiError(401, "Invalid token");
    req.auth = payload;
    req.tenantId = payload.tenant;

    // load role permissions (could be cached in prod)
    const user: any = await User.findById(payload.uid).populate("userType category");
    if (!user || user.status !== "Active") throw new ApiError(401, "User inactive or not found");
    // role → the user's own exceptions → capped by the user type
    req.perms = effectivePerms(user.userType?.perms, user.permOverrides, user.category?.perms);

    next();
  } catch (e) {
    next(e instanceof ApiError ? e : new ApiError(401, "Invalid or expired token"));
  }
};

// permission guard factory: require(module, action)
export const require_ = (module: string, action: "view" | "create" | "edit" | "del") => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const p = (req.perms || []).find((x) => x.module === module);
    if (!p || !p[action]) {
      return next(new ApiError(403, `Forbidden: need ${action} on ${module}`));
    }
    next();
  };
};

// central error handler
export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  // Mongo unique-index violation → 409 with a readable message
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {}).filter((k) => k !== "tenant" && k !== "module").join(", ");
    return res.status(409).json({ ok: false, error: `A record with this ${field || "value"} already exists` });
  }
  const status = err.status || 500;
  if (status >= 500) console.error("[error]", err);
  res.status(status).json({
    ok: false,
    error: err.message || "Internal Server Error",
    details: err.details,
  });
};

export const notFound = (_req: Request, res: Response) =>
  res.status(404).json({ ok: false, error: "Route not found" });
