import { randomBytes } from "crypto";
import { EmailTrack } from "../models/CrmMore";
import { appUrl } from "./pm/messages";

/** Where tracking links point: this API as the outside world reaches it. */
const apiBase = async (tenant: any) => (process.env.PUBLIC_API_URL || (await appUrl(tenant))).replace(/\/+$/, "");

/**
 * Prepare an email to a lead so opens and clicks are counted: links go through
 * a redirect and a 1×1 image is added at the end.
 */
export async function trackedHtml(tenant: any, lead: any, subject: string, html: string): Promise<string> {
  try {
    const token = randomBytes(12).toString("base64url");
    await EmailTrack.create({ tenant, lead, subject, token });
    const base = await apiBase(tenant);
    const withLinks = html.replace(/href="(https?:\/\/[^"]+)"/gi, (_m, url) => `href="${base}/webhooks/e/c/${token}?u=${encodeURIComponent(url)}"`);
    return `${withLinks}<img src="${base}/webhooks/e/o/${token}.gif" width="1" height="1" alt="" style="display:none">`;
  } catch {
    return html;
  }
}
