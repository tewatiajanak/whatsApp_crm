import { createHash, randomInt } from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { ApiError } from "../utils/http";
import { IUser, PasswordPolicy } from "../models/User";
import { decryptSecret } from "./payments/crypto";
import { emailMode, sendEmail } from "./email";

/* ───────────── default password ───────────── */

export const PART_LABELS: Record<string, string> = { mobile: "Mobile number", email: "Email ID", dob: "Date of birth (DDMMYYYY)" };

/** "Mobile number + Date of birth (DDMMYYYY)" — what a rule is, in words. */
export const describeRule = (p: { mode: string; parts: string[] }) =>
  p.mode === "fixed" ? "the fixed password" : p.parts.map((x) => PART_LABELS[x] || x).join(" + ");

const partValue = (part: string, u: { mobile?: string; email?: string; dob?: string }): string => {
  if (part === "mobile") return String(u.mobile || "").replace(/\D/g, "");
  if (part === "email") return String(u.email || "").trim().toLowerCase();
  if (part === "dob") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(u.dob || ""));
    return m ? `${m[3]}${m[2]}${m[1]}` : "";
  }
  return "";
};

/** The policy for a kind of user; a sensible default until one is saved. */
export async function policyFor(tenantId: string, kind: "internal" | "client") {
  const saved = await PasswordPolicy.findOne({ tenant: tenantId, kind }).lean();
  return saved || { kind, mode: "parts" as const, parts: ["mobile"], fixed: "", forceChange: true };
}

/** Work out a new user's default password from the policy. Throws when a needed detail is missing. */
export async function defaultPassword(tenantId: string, kind: "internal" | "client", user: { mobile?: string; email?: string; dob?: string }) {
  const policy = await policyFor(tenantId, kind);
  let password = "";
  if (policy.mode === "fixed") {
    password = decryptSecret(policy.fixed);
    if (!password) throw new ApiError(400, "The password policy uses a fixed password, but none is set. Set it in Password Policy.");
  } else {
    for (const part of policy.parts) {
      const v = partValue(part, user);
      if (!v) throw new ApiError(400, `${PART_LABELS[part] || part} is needed: the default password is made from it`);
      password += v;
    }
  }
  if (password.length < 4) throw new ApiError(400, "The default password would be too short. Check the Password Policy.");
  return { password, rule: describeRule(policy), forceChange: policy.forceChange !== false };
}

/* ───────────── one-time code at sign-in ───────────── */

/** Codes go out by email; without a live mail server they cannot be delivered. */
export const otpAvailable = () => emailMode() === "live";

const hashCode = (code: string) => createHash("sha256").update(`${code}:${config.jwtSecret}`).digest("hex");
const OTP_MINUTES = 10;

export async function startOtp(user: IUser) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  user.otp = { hash: hashCode(code), expires: new Date(Date.now() + OTP_MINUTES * 60_000), attempts: 0 };
  await user.save();
  await sendEmail({
    to: user.email,
    subject: "Your sign-in code",
    text: `Your sign-in code is ${code}. It is valid for ${OTP_MINUTES} minutes. If you did not try to sign in, ignore this email.`,
  });
  const challenge = jwt.sign({ uid: String(user._id), purpose: "otp" }, config.jwtSecret, { expiresIn: `${OTP_MINUTES}m` } as jwt.SignOptions);
  const [name, domain] = user.email.split("@");
  return { challenge, sentTo: `${name.slice(0, 2)}${"•".repeat(Math.max(2, name.length - 2))}@${domain}` };
}

/** uid from a valid OTP challenge token, else throws. */
export function readChallenge(challenge: string): string {
  try {
    const p: any = jwt.verify(challenge, config.jwtSecret);
    if (p.purpose !== "otp" || !p.uid) throw new Error("wrong purpose");
    return String(p.uid);
  } catch {
    throw new ApiError(401, "This sign-in attempt has expired. Sign in again.");
  }
}

export async function checkOtp(user: IUser, code: string): Promise<void> {
  const otp = user.otp;
  if (!otp || !otp.expires || otp.expires.getTime() < Date.now()) throw new ApiError(401, "The code has expired. Sign in again.");
  if (otp.attempts >= 5) throw new ApiError(429, "Too many wrong codes. Sign in again.");
  if (hashCode(String(code).trim()) !== otp.hash) {
    otp.attempts += 1;
    user.markModified("otp");
    await user.save();
    throw new ApiError(401, "That code is not correct");
  }
  user.otp = null;
}
