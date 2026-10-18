import crypto from "crypto";
import fs from "fs/promises";
import {
  WhatsAppProvider,
  SendResult,
  InboundEvent,
  ProviderCredentials,
  normalizePhone,
  InteractiveButton,
  InteractiveListSection,
} from "./types";

/**
 * Meta direct — connects directly to Meta Graph API (WhatsApp Cloud API).
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
export class MetaProvider implements WhatsAppProvider {
  readonly vendor = "meta" as const;
  private apiVersion: string;
  private token: string;
  private phoneNumberIdValue: string;
  private defaultWabaId: string;
  private appSecret: string;
  private verifyTokenValue: string;

  constructor(creds: ProviderCredentials) {
    this.apiVersion = creds.extra?.apiVersion || "v21.0";
    this.token = creds.accessToken || "";
    this.phoneNumberIdValue = creds.phoneNumberId || "";
    this.defaultWabaId = creds.wabaId || creds.extra?.wabaId || "";
    this.appSecret = creds.appSecret || "";
    this.verifyTokenValue = creds.verifyToken || "";
  }

  get isLive() {
    return !!this.token && !!this.phoneNumberIdValue;
  }

  get verifyToken() {
    return this.verifyTokenValue;
  }

  // Expose IDs for higher-level service validation/routing.
  get wabaId() {
    return this.defaultWabaId;
  }

  get phoneNumberId() {
    return this.phoneNumberIdValue;
  }

  private assertTokenIsHeaderSafe() {
    if (!this.token) {
      throw new Error("Meta access token is missing for the active account");
    }
    if (this.token.includes("•") || /[^\x00-\xFF]/.test(this.token)) {
      throw new Error("Saved Meta access token is masked/corrupted. Re-enter token in WhatsApp Integration and save again.");
    }
  }

  private async get(path: string): Promise<any> {
    this.assertTokenIsHeaderSafe();
    const url = `https://graph.facebook.com/${this.apiVersion}/${path}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.token}` },
    });
    const json: any = await res.json();
    if (!res.ok) {
      const err = json?.error || json || {};
      const msg = String(err?.message || "");
      if (err?.code === 100 && msg.includes("message_templates")) {
        throw new Error("Meta rejected template fetch: saved WABA ID is invalid for template APIs. Please use WhatsApp Account ID (not Phone Number ID).");
      }
      throw new Error(`Meta API ${res.status}: ${JSON.stringify(err)}`);
    }
    return json;
  }

  private async post(path: string, body: any): Promise<any> {
    this.assertTokenIsHeaderSafe();
    const url = `https://graph.facebook.com/${this.apiVersion}/${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: any = await res.json();
    if (!res.ok) {
      const err = json?.error || json || {};
      const msg = String(err?.message || "");
      if (err?.code === 100 && msg.includes("message_templates")) {
        throw new Error("Meta rejected template request: saved WABA ID is invalid for template APIs. Please use WhatsApp Account ID (not Phone Number ID).");
      }
      throw new Error(`Meta API ${res.status}: ${JSON.stringify(err)}`);
    }
    return json;
  }

  private async del(path: string): Promise<any> {
    this.assertTokenIsHeaderSafe();
    const url = `https://graph.facebook.com/${this.apiVersion}/${path}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.token}` },
    });
    const json: any = await res.json();
    if (!res.ok) {
      const err = json?.error || json || {};
      const msg = String(err?.message || "");
      if (err?.code === 100 && msg.includes("message_templates")) {
        throw new Error("Meta rejected template delete: saved WABA ID is invalid for template APIs. Please use WhatsApp Account ID (not Phone Number ID).");
      }
      throw new Error(`Meta API ${res.status}: ${JSON.stringify(err)}`);
    }
    return json;
  }

  async sendTemplate(
    to: string,
    templateName: string,
    languageCode = "en",
    components?: any[]
  ): Promise<SendResult> {
    const payload: any = {
      messaging_product: "whatsapp",
      to: normalizePhone(to),
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components && components.length > 0 ? { components } : {}),
      },
    };
    const json = await this.post(`${this.phoneNumberIdValue}/messages`, payload);
    return { waMessageId: json.messages?.[0]?.id, simulated: false, raw: json };
  }

  async sendText(to: string, text: string, previewUrl = true): Promise<SendResult> {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhone(to),
      type: "text",
      text: { preview_url: previewUrl, body: text },
    };
    const json = await this.post(`${this.phoneNumberIdValue}/messages`, payload);
    return { waMessageId: json.messages?.[0]?.id, simulated: false, raw: json };
  }

  async sendMedia(
    to: string,
    mediaType: "image" | "video" | "document" | "audio",
    mediaUrl: string,
    caption?: string,
    filename?: string
  ): Promise<SendResult> {
    const mediaPayload: any = { link: mediaUrl };
    if (caption && ["image", "video", "document"].includes(mediaType)) {
      mediaPayload.caption = caption;
    }
    if (filename && mediaType === "document") {
      mediaPayload.filename = filename;
    }

    const payload = {
      messaging_product: "whatsapp",
      to: normalizePhone(to),
      type: mediaType,
      [mediaType]: mediaPayload,
    };

    const json = await this.post(`${this.phoneNumberIdValue}/messages`, payload);
    return { waMessageId: json.messages?.[0]?.id, simulated: false, raw: json };
  }

  async sendLocation(
    to: string,
    lat: number,
    lng: number,
    name?: string,
    address?: string
  ): Promise<SendResult> {
    const payload = {
      messaging_product: "whatsapp",
      to: normalizePhone(to),
      type: "location",
      location: {
        latitude: lat,
        longitude: lng,
        name: name || "",
        address: address || "",
      },
    };
    const json = await this.post(`${this.phoneNumberIdValue}/messages`, payload);
    return { waMessageId: json.messages?.[0]?.id, simulated: false, raw: json };
  }

  async sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: InteractiveButton[],
    header?: { type: "text" | "image"; textOrUrl: string },
    footer?: string
  ): Promise<SendResult> {
    const interactiveObj: any = {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    };

    if (header) {
      if (header.type === "text") {
        interactiveObj.header = { type: "text", text: header.textOrUrl };
      } else {
        interactiveObj.header = { type: "image", image: { link: header.textOrUrl } };
      }
    }
    if (footer) {
      interactiveObj.footer = { text: footer };
    }

    const payload = {
      messaging_product: "whatsapp",
      to: normalizePhone(to),
      type: "interactive",
      interactive: interactiveObj,
    };

    const json = await this.post(`${this.phoneNumberIdValue}/messages`, payload);
    return { waMessageId: json.messages?.[0]?.id, simulated: false, raw: json };
  }

  async sendInteractiveList(
    to: string,
    bodyText: string,
    buttonTitle: string,
    sections: InteractiveListSection[],
    header?: string,
    footer?: string
  ): Promise<SendResult> {
    const interactiveObj: any = {
      type: "list",
      body: { text: bodyText },
      action: {
        button: buttonTitle.slice(0, 20),
        sections: sections.map((sec) => ({
          title: sec.title,
          rows: sec.rows.map((r) => ({
            id: r.id,
            title: r.title.slice(0, 24),
            ...(r.description ? { description: r.description.slice(0, 72) } : {}),
          })),
        })),
      },
    };

    if (header) {
      interactiveObj.header = { type: "text", text: header };
    }
    if (footer) {
      interactiveObj.footer = { text: footer };
    }

    const payload = {
      messaging_product: "whatsapp",
      to: normalizePhone(to),
      type: "interactive",
      interactive: interactiveObj,
    };

    const json = await this.post(`${this.phoneNumberIdValue}/messages`, payload);
    return { waMessageId: json.messages?.[0]?.id, simulated: false, raw: json };
  }

  /* --- Meta Template Management Graph API --- */

  async createMetaTemplate(wabaId: string, templatePayload: any): Promise<any> {
    const targetWabaId = wabaId || this.defaultWabaId;
    if (!targetWabaId) throw new Error("WABA ID is required to create Meta templates");
    return this.post(`${targetWabaId}/message_templates`, templatePayload);
  }

  async fetchMetaTemplates(wabaId: string): Promise<any[]> {
    const targetWabaId = wabaId || this.defaultWabaId;
    if (!targetWabaId) throw new Error("WABA ID is required to fetch Meta templates");
    const json = await this.get(`${targetWabaId}/message_templates?limit=100`);
    return json.data || [];
  }

  async getMetaTemplateById(templateId: string): Promise<any> {
    if (!templateId) throw new Error("Template ID is required to fetch Meta template");
    return this.get(`${templateId}?fields=id,name,status,category,language,components,rejection_reason,rejected_reason`);
  }

  async editMetaTemplateById(templateId: string, payload: any): Promise<any> {
    if (!templateId) throw new Error("Template ID is required to edit Meta template");
    return this.post(templateId, payload);
  }

  async uploadMetaMedia(filePath: string, mimeType?: string, fileName?: string): Promise<any> {
    if (!this.phoneNumberIdValue) throw new Error("Phone Number ID is required to upload media");
    this.assertTokenIsHeaderSafe();

    const bytes = await fs.readFile(filePath);
    const contentType = mimeType || "application/octet-stream";
    const blob = new Blob([bytes], { type: contentType });
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", contentType);
    form.append("file", blob, fileName || "upload");

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberIdValue}/media`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
      body: form,
    });
    const json: any = await res.json();
    if (!res.ok) {
      const err = json?.error || json || {};
      throw new Error(`Meta API ${res.status}: ${JSON.stringify(err)}`);
    }
    return json;
  }

  async deleteMetaTemplate(wabaId: string, templateName: string): Promise<any> {
    const targetWabaId = wabaId || this.defaultWabaId;
    if (!targetWabaId) throw new Error("WABA ID is required to delete Meta template");
    return this.del(`${targetWabaId}/message_templates?name=${encodeURIComponent(templateName)}`);
  }

  /* --- Meta Profile Graph API --- */

  async getPhoneProfile(): Promise<any> {
    if (!this.phoneNumberIdValue) throw new Error("Phone Number ID is not configured");
    return this.get(
      `${this.phoneNumberIdValue}?fields=display_phone_number,verified_name,code_verification_status,quality_rating,whatsapp_business_account`
    );
  }

  async updateBusinessProfile(profileData: any): Promise<any> {
    if (!this.phoneNumberIdValue) throw new Error("Phone Number ID is not configured");
    return this.post(`${this.phoneNumberIdValue}/whatsapp_business_profile`, {
      messaging_product: "whatsapp",
      ...profileData,
    });
  }

  verifyWebhook(rawBody: Buffer, headers: Record<string, any>): boolean {
    if (!this.appSecret) return true; // dev mode: trust if appSecret is unconfigured
    const signature = headers["x-hub-signature-256"];
    if (!signature) return false;
    const expected = "sha256=" + crypto.createHmac("sha256", this.appSecret).update(rawBody).digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  parseInbound(body: any): InboundEvent[] {
    const events: InboundEvent[] = [];
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};

        // 1. Template Status Updates from Meta
        if (change.field === "message_template_status_update" || value.event) {
          events.push({
            kind: "template_status_update",
            templateId: value.message_template_id,
            templateName: value.message_template_name,
            templateStatus: value.event || value.status,
          });
        }

        // 2. Message Delivery/Read Statuses
        for (const st of value.statuses || []) {
          events.push({
            kind: "status",
            waMessageId: st.id,
            status: st.status,
            // keep Meta's code so the report can explain it, e.g. "(#131026) Message undeliverable — details"
            errorReason: st.errors?.[0] ? `${st.errors[0].code ? `(#${st.errors[0].code}) ` : ""}${st.errors[0].title || st.errors[0].message || "failed"}${st.errors[0].error_data?.details ? ` — ${st.errors[0].error_data.details}` : ""}` : undefined,
            timestamp: st.timestamp ? new Date(+st.timestamp * 1000) : new Date(),
          });
        }

        // 3. Incoming Messages
        for (const msg of value.messages || []) {
          const evt: InboundEvent = {
            kind: "message",
            from: msg.from,
            to: value.metadata?.display_phone_number,
            messageType: msg.type,
            timestamp: msg.timestamp ? new Date(+msg.timestamp * 1000) : new Date(),
          };

          if (msg.type === "text") {
            evt.text = msg.text?.body;
          } else if (["image", "video", "document", "audio"].includes(msg.type)) {
            const media = msg[msg.type];
            evt.mediaUrl = media?.id; // media ID
            evt.mediaCaption = media?.caption;
            evt.mediaFilename = media?.filename;
            evt.text = media?.caption || `[${msg.type.toUpperCase()}] ${media?.filename || ""}`;
          } else if (msg.type === "location") {
            evt.location = {
              latitude: msg.location?.latitude,
              longitude: msg.location?.longitude,
              name: msg.location?.name,
              address: msg.location?.address,
            };
            evt.text = `[LOCATION] ${msg.location?.name || `${msg.location?.latitude}, ${msg.location?.longitude}`}`;
          } else if (msg.type === "interactive") {
            const interactive = msg.interactive;
            if (interactive?.type === "button_reply") {
              evt.interactiveReply = {
                id: interactive.button_reply.id,
                title: interactive.button_reply.title,
                type: "button_reply",
              };
              evt.text = interactive.button_reply.title;
            } else if (interactive?.type === "list_reply") {
              evt.interactiveReply = {
                id: interactive.list_reply.id,
                title: interactive.list_reply.title,
                description: interactive.list_reply.description,
                type: "list_reply",
              };
              evt.text = interactive.list_reply.title;
            }
          } else if (msg.type === "button") {
            evt.interactiveReply = {
              id: msg.button?.payload || msg.button?.text,
              title: msg.button?.text,
              type: "button_reply",
            };
            evt.text = msg.button?.text;
          } else {
            evt.text = `[${msg.type}]`;
          }

          events.push(evt);
        }
      }
    }
    return events;
  }
}
