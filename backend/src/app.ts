import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import { config } from "./config";
import { errorHandler, notFound } from "./middleware/auth";
import apiRoutes from "./routes";
import webhookRoutes from "./routes/webhooks";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin === "*" ? true : config.clientOrigin.split(","), credentials: true }));
  if (config.env !== "test") app.use(morgan("dev"));

  // capture raw body for webhook signature verification
  app.use(
    express.json({
      // org details carries up to 5 base64 login images + logo (~7.5MB); stays under Mongo's 16MB doc cap
      limit: "12mb",
      verify: (req: any, _res, buf) => {
        if (req.originalUrl.startsWith("/webhooks")) req.rawBody = buf;
      },
    })
  );

  // health
  app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now(), mode: config.whatsapp.mode }));

  // static files for managed media library
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // webhooks (public)
  app.use("/webhooks", webhookRoutes);

  // rate-limited API
  const limiter = rateLimit({ windowMs: 60_000, max: 600, standardHeaders: true, legacyHeaders: false });
  app.use("/api", limiter, apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
