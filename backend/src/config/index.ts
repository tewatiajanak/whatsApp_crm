import dotenv from "dotenv";
dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    // Don't crash dev for optional secrets; warn instead.
    console.warn(`[config] Missing env var ${name}`);
    return "";
  }
  return v;
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "4000", 10),
  clientOrigin: process.env.CLIENT_ORIGIN || "*",

  mongoUri: required("MONGO_URI", "mongodb://127.0.0.1:27017/whatsapp_crm"),

  jwtSecret: required("JWT_SECRET", "dev-insecure-secret-change-me"),
  jwtExpires: process.env.JWT_EXPIRES || "7d",

  // Public https URL of this API as payment gateways reach it (webhooks, return
  // URLs). When empty it is derived from the incoming request.
  publicUrl: (process.env.PUBLIC_API_URL || "").replace(/\/+$/, ""),
  // Event dates and times are entered as local wall-clock values; this is the
  // UTC offset they are in (India by default).
  timezoneOffset: process.env.APP_TZ_OFFSET || "+05:30",
  // Key used to encrypt payment gateway secrets at rest (falls back to JWT_SECRET).
  paymentEncryptionKey: process.env.PAYMENT_ENCRYPTION_KEY || "",

  redisUrl: process.env.REDIS_URL || "",
  useQueue: (process.env.USE_QUEUE || "false") === "true",

  whatsapp: {
    mode: (process.env.WHATSAPP_MODE || "simulation") as "simulation" | "live",
    apiVersion: process.env.WHATSAPP_API_VERSION || "v21.0",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    wabaId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "my-webhook-verify-token",
    appSecret: process.env.WHATSAPP_APP_SECRET || "",
  },
};

export const isLiveWhatsApp = () =>
  config.whatsapp.mode === "live" &&
  !!config.whatsapp.accessToken &&
  !!config.whatsapp.phoneNumberId;
