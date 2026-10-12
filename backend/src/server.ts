import { createApp } from "./app";
import { connectDB } from "./config/db";
import { config } from "./config";
import { startPmEngine } from "./services/pm/messages";
import { startVerification } from "./services/pm/verification";
import { backfillLeadKeys, backfillLeadScores } from "./services/leadService";
import { startCrmEngine } from "./services/crmScheduler";

async function main() {
  await connectDB();
  const app = createApp();
  // Project Management: auto Email/WhatsApp, reminders and notifications
  startPmEngine();
  startVerification();
  // Lead CRM: follow-up reminders, first-response alerts, automation steps, scheduled reports
  startCrmEngine();
  backfillLeadKeys().then(backfillLeadScores).catch((e) => console.error("[leads] backfill failed:", e));
  app.listen(config.port, "0.0.0.0", () => {
    console.log(`\n  WhatsApp CRM API running`);
    console.log(`  → http://localhost:${config.port}`);
    console.log(`  → network: http://192.168.1.15:${config.port}`);
    console.log(`  → health:  /health`);
    console.log(`  → api:     /api`);
    console.log(`  → webhook: /webhooks/whatsapp`);
    console.log(`  → WhatsApp mode: ${config.whatsapp.mode}\n`);
  });
}

main().catch((e) => {
  console.error("Fatal startup error:", e);
  process.exit(1);
});
