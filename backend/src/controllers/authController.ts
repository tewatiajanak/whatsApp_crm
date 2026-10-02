import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User, UserType, effectivePerms } from "../models/User";
import { checkOtp, otpAvailable, readChallenge, startOtp } from "../services/userAccess";
import { signToken } from "../utils/jwt";
import { ApiError, asyncHandler, ok, audit } from "../utils/http";

const loginSchema = z.object({
  // email address or mobile number
  email: z.string().min(3),
  password: z.string().min(1),
});

/** Finish a sign-in: stamp it, issue the token, describe the user. */
async function completeLogin(user: any, res: Response) {
  user.lastLogin = new Date();
  await user.save();
  const token = signToken({ uid: String(user._id), tenant: String(user.tenant), name: user.name, email: user.email });
  await audit({ tenant: user.tenant, user: user.name, action: "LOGIN", module: "Auth", entity: user.email });
  const perms = effectivePerms(user.userType?.perms, user.permOverrides, user.category?.perms);
  ok(res, {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      // the role, carrying the permissions this user actually has
      userType: { _id: user.userType?._id, name: user.userType?.name, perms },
      tenant: user.tenant,
      mustChangePassword: !!user.mustChangePassword,
    },
  });
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email: identifier, password } = loginSchema.parse(req.body);
  const id = identifier.trim();
  const digits = id.replace(/\D/g, "");
  const user = await User.findOne(
    id.includes("@") ? { email: id.toLowerCase() } : { $or: [{ email: id.toLowerCase() }, ...(digits.length >= 7 ? [{ mobile: digits }] : [])] }
  ).populate("userType category");
  if (!user) throw new ApiError(401, "Invalid credentials");
  if (user.status !== "Active") throw new ApiError(403, "Account is not active");

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) throw new ApiError(401, "Invalid credentials");

  // User types with OTP sign-in get a one-time code by email before they are let in.
  // Without a working mail server the code could never arrive, so the step is skipped.
  if ((user.category as any)?.otpLogin && otpAvailable()) {
    const { challenge, sentTo } = await startOtp(user);
    return ok(res, { otpRequired: true, challenge, sentTo });
  }

  await completeLogin(user, res);
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { challenge, code } = z.object({ challenge: z.string().min(10), code: z.string().min(4).max(8) }).parse(req.body);
  const user = await User.findById(readChallenge(challenge)).populate("userType category");
  if (!user || user.status !== "Active") throw new ApiError(401, "Invalid credentials");
  await checkOtp(user, code);
  await completeLogin(user, res);
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = z
    .object({ currentPassword: z.string().min(1), newPassword: z.string().min(8, "The new password needs at least 8 characters") })
    .parse(req.body);
  const user = await User.findById(req.auth!.uid);
  if (!user) throw new ApiError(404, "User not found");
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new ApiError(400, "The current password is not correct");
  if (currentPassword === newPassword) throw new ApiError(400, "Choose a password different from the current one");
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  await user.save();
  await audit({ tenant: user.tenant, user: user.name, action: "UPDATE", module: "Auth", entity: "Password changed" });
  ok(res, { changed: true });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user: any = await User.findById(req.auth!.uid).populate("userType category");
  if (!user) throw new ApiError(404, "User not found");
  ok(res, { user, perms: effectivePerms(user.userType?.perms, user.permOverrides, user.category?.perms) });
});
