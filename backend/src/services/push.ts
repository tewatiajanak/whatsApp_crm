import { crmSettingsFor } from "../models/CrmExtras";
import { PushSub } from "../models/CrmMore";
import { encryptSecret, decryptSecret } from "./payments/crypto";

/** The tenant's push keys, made the first time they are needed. */
export async function pushKeys(tenant: any): Promise<{ publicKey: string; privateKey: string }> {
  const s = await crmSettingsFor(tenant);
  if (!s.push.publicKey || !s.push.privateKey) {
    const webpush = (await import("web-push")).default;
    const k = webpush.generateVAPIDKeys();
    s.push.publicKey = k.publicKey;
    s.push.privateKey = encryptSecret(k.privateKey);
    await s.save();
  }
  return { publicKey: s.push.publicKey, privateKey: decryptSecret(s.push.privateKey) };
}

/** Show a notification on these users' phones and browsers (wherever they allowed it). Never throws. */
export async function sendPush(tenant: any, users: any[], note: { title: string; body?: string; url?: string }) {
  try {
    const subs = await PushSub.find({ tenant, user: { $in: users } }).lean();
    if (!subs.length) return;
    const webpush = (await import("web-push")).default;
    const keys = await pushKeys(tenant);
    const payload = JSON.stringify({ title: note.title, body: note.body || "", url: note.url || "/" });
    for (const sub of subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys } as any, payload, {
          vapidDetails: { subject: "mailto:admin@localhost", publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 3600,
        });
      } catch (e: any) {
        // the browser dropped this subscription (uninstalled, permission removed)
        if (e?.statusCode === 404 || e?.statusCode === 410) await PushSub.deleteOne({ _id: sub._id });
      }
    }
  } catch (e: any) {
    console.error("[push] failed:", e?.message || e);
  }
}
