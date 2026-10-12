import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../config/db";
import { Tenant } from "../models/Tenant";
import { User, UserType, MODULES, IPermission } from "../models/User";
import { LeadStatus, SubStatus, LeadSource } from "../models/Masters";
import { Service } from "../models/Service";
import { Contact } from "../models/Contact";
import { Lead } from "../models/Lead";
import { FollowUp } from "../models/FollowUp";
import { Template, Campaign, Conversation, Message } from "../models/Messaging";
import { Integration, AuditLog } from "../models/System";
import { WhatsAppAccount } from "../models/WhatsAppAccount";
import { ChatbotRule } from "../models/ChatbotRule";

const fullPerm = (m: string): IPermission => ({ module: m, view: true, create: true, edit: true, del: true });

async function wipe() {
  await Promise.all([
    Tenant.deleteMany({}), User.deleteMany({}), UserType.deleteMany({}),
    LeadStatus.deleteMany({}), SubStatus.deleteMany({}), LeadSource.deleteMany({}),
    Contact.deleteMany({}), Lead.deleteMany({}), FollowUp.deleteMany({}),
    Template.deleteMany({}), Campaign.deleteMany({}), Conversation.deleteMany({}),
    Message.deleteMany({}), Integration.deleteMany({}), AuditLog.deleteMany({}),
    WhatsAppAccount.deleteMany({}), ChatbotRule.deleteMany({}),
    Service.deleteMany({}),
  ]);
}

async function seed() {
  await connectDB();
  console.log("[seed] wiping existing data…");
  await wipe();

  const tenant = await Tenant.create({ name: "Greenwood International", plan: "growth", phoneNumberId: "DEMO_PNID" });
  const T = tenant._id;

  /* user types */
  const adminType = await UserType.create({ tenant: T, name: "Administrator", desc: "Full access", perms: MODULES.map(fullPerm) });
  const managerType = await UserType.create({ tenant: T, name: "Admissions Manager", desc: "Manage leads, follow-ups, team", perms: MODULES.map((m) => ({ module: m, view: true, create: m !== "setup", edit: m !== "setup", del: false })) });
  const counsellorType = await UserType.create({ tenant: T, name: "Counsellor", desc: "Work assigned leads & chats", perms: MODULES.map((m) => ({ module: m, view: ["dashboard", "leads", "followups", "chat", "contacts"].includes(m), create: ["leads", "followups", "chat"].includes(m), edit: ["leads", "followups", "chat"].includes(m), del: false })) });
  const viewerType = await UserType.create({ tenant: T, name: "Read-only", desc: "Dashboards & reports", perms: MODULES.map((m) => ({ module: m, view: ["dashboard", "reports", "conversion"].includes(m), create: false, edit: false, del: false })) });

  /* users (password = "password123" for all demo users) */
  const hash = await bcrypt.hash("password123", 10);
  const owners = ["Priya Kothari", "Rahul Bhatt", "Ananya Saxena", "Karthik Iyer", "Megha Rao"];
  await User.create([
    { tenant: T, name: "Priya Kothari", email: "priya@greenwood.edu", passwordHash: hash, userType: adminType._id, status: "Active" },
    { tenant: T, name: "Rahul Bhatt", email: "rahul@greenwood.edu", passwordHash: hash, userType: managerType._id, status: "Active" },
    { tenant: T, name: "Ananya Saxena", email: "ananya@greenwood.edu", passwordHash: hash, userType: counsellorType._id, status: "Active" },
    { tenant: T, name: "Karthik Iyer", email: "karthik@greenwood.edu", passwordHash: hash, userType: counsellorType._id, status: "Active" },
    { tenant: T, name: "Megha Rao", email: "megha@greenwood.edu", passwordHash: hash, userType: viewerType._id, status: "Inactive" },
  ]);

  /* statuses */
  const statusDefs = [
    { name: "New", color: "#2563eb", followUpRequired: "Yes", order: 1 },
    { name: "Contacted", color: "#0891b2", followUpRequired: "Yes", order: 2 },
    { name: "Qualified", color: "#7c3aed", followUpRequired: "Yes", order: 3 },
    { name: "Visit Booked", color: "#d97706", followUpRequired: "Yes", order: 4 },
    { name: "Negotiation", color: "#ca8a04", followUpRequired: "Yes", order: 5 },
    { name: "Admitted", color: "#00a884", followUpRequired: "No", order: 6, isWon: true },
    { name: "Lost", color: "#dc2626", followUpRequired: "No", order: 7, isLost: true },
  ];
  const statuses = await LeadStatus.create(statusDefs.map((s) => ({ ...s, tenant: T })));
  const byName: any = Object.fromEntries(statuses.map((s) => [s.name, s]));

  /* services (custom pipelines) + a few service-specific statuses */
  const services = await Service.create([
    { tenant: T, name: "Admissions CRM", key: "crm", color: "#0085a8", icon: "mortarboard", order: 1, builtIn: true },
    { tenant: T, name: "WhatsApp", key: "whatsapp", color: "#25d366", icon: "whatsapp", order: 2, builtIn: true },
    { tenant: T, name: "Event Management", key: "events", color: "#7c3aed", icon: "calendar-event", order: 3, builtIn: true },
  ]);
  const svc: any = Object.fromEntries(services.map((s) => [s.key, s]));

  // WhatsApp-specific statuses (its own pipeline)
  const waStatuses = await LeadStatus.create([
    { tenant: T, offerings: [svc.whatsapp._id], name: "Enquiry", color: "#25d366", followUpRequired: "Yes", order: 1 },
    { tenant: T, offerings: [svc.whatsapp._id], name: "In Conversation", color: "#0891b2", followUpRequired: "Yes", order: 2 },
    { tenant: T, offerings: [svc.whatsapp._id], name: "Deal Won", color: "#16a34a", followUpRequired: "No", order: 3, isWon: true },
    { tenant: T, offerings: [svc.whatsapp._id], name: "Not Interested", color: "#dc2626", followUpRequired: "No", order: 4, isLost: true },
  ]);
  // Event Management-specific statuses
  const evStatuses = await LeadStatus.create([
    { tenant: T, offerings: [svc.events._id], name: "Invited", color: "#7c3aed", followUpRequired: "Yes", order: 1 },
    { tenant: T, offerings: [svc.events._id], name: "Registered", color: "#2563eb", followUpRequired: "Yes", order: 2 },
    { tenant: T, offerings: [svc.events._id], name: "Attended", color: "#16a34a", followUpRequired: "No", order: 3, isWon: true },
    { tenant: T, offerings: [svc.events._id], name: "Next Year", color: "#d97706", followUpRequired: "Yes", order: 4 },
  ]);
  // a couple of service-specific sub-statuses
  await SubStatus.create([
    { tenant: T, status: waStatuses[1]._id, name: "Awaiting reply" },
    { tenant: T, status: evStatuses[3]._id, name: "Budget approved" },
    { tenant: T, status: evStatuses[3]._id, name: "Re-engage in Q1" },
  ]);

  await SubStatus.create([
    { tenant: T, status: byName["New"]._id, name: "Untouched" },
    { tenant: T, status: byName["New"]._id, name: "Auto-imported" },
    { tenant: T, status: byName["Contacted"]._id, name: "Call back later" },
    { tenant: T, status: byName["Contacted"]._id, name: "No response" },
    { tenant: T, status: byName["Qualified"]._id, name: "Budget confirmed" },
    { tenant: T, status: byName["Visit Booked"]._id, name: "Campus tour fixed" },
    { tenant: T, status: byName["Negotiation"]._id, name: "Fee concession asked" },
    { tenant: T, status: byName["Lost"]._id, name: "Chose competitor" },
    { tenant: T, status: byName["Lost"]._id, name: "Out of budget" },
  ]);

  const sourceDefs = [
    { name: "WhatsApp Campaign", color: "#00a884" },
    { name: "WhatsApp Inbound", color: "#16a34a" },
    { name: "Facebook Lead Form", color: "#1877f2" },
    { name: "Google Form", color: "#ea4335" },
    { name: "Website", color: "#6366f1" },
    { name: "Referral", color: "#db2777" },
    { name: "Walk-in", color: "#64748b" },
  ];
  const sources = await LeadSource.create(sourceDefs.map((s) => ({ ...s, tenant: T })));

  /* contacts */
  const firstNames = ["Aanya", "Vivaan", "Aarav", "Diya", "Ishaan", "Saanvi", "Reyansh", "Anaya", "Vihaan", "Myra", "Arjun", "Kiara", "Sai", "Aadhya", "Krishna", "Pari", "Dhruv", "Riya"];
  const cats = ["Admission", "Fee", "Transport", "Exam", "General"];
  const contacts = await Contact.create(
    firstNames.map((fn, i) => ({
      tenant: T,
      name: `${fn} ${["Sharma", "Patel", "Reddy", "Singh", "Mehta", "Iyer"][i % 6]}`,
      phone: `+9198${String(2000000000 + i * 778201).slice(0, 8)}`,
      email: `${fn.toLowerCase()}@example.com`,
      category: cats[i % cats.length],
      tags: i % 3 === 0 ? ["Hot Lead"] : i % 3 === 1 ? ["Fee Pending"] : ["Admission Lead"],
      optIn: i % 9 !== 0,
      lifecycleStage: (["Lead", "Lead", "Prospect", "Customer"] as const)[i % 4],
      value: 20000 + ((i * 7919) % 90000),
      assigned: owners[i % owners.length],
    }))
  );

  /* courses */
  const courses = ["Class XI – Science (PCM)", "Class XI – Science (PCB)", "Class XI – Commerce", "Class IX Admission", "Class VI Admission"];

  /* leads from first 14 contacts */
  const today = new Date();
  const leadDocs: any[] = [];
  const fuDocs: any[] = [];
  for (let i = 0; i < 14; i++) {
    const c = contacts[i];
    const status = statuses[i % 6];
    const offset = [-2, -1, 0, 0, 1, 2, 3, 5][i % 8];
    const due = new Date(today); due.setDate(today.getDate() + offset); due.setHours(10 + (i % 7), 0, 0, 0);
    const closed = status.isWon || status.isLost;
    const sub = await SubStatus.findOne({ tenant: T, status: status._id });
    const lead = await Lead.create({
      tenant: T, name: c.name, phone: c.phone, email: c.email, contact: c._id,
      status: status._id, subStatus: sub?._id || null, source: sources[i % sources.length]._id,
      owner: owners[i % owners.length], course: courses[i % courses.length],
      value: c.value, score: 40 + ((i * 37) % 60),
      nextFollowUp: closed ? null : due, lastActivity: new Date(),
      // multi-service tracks: every lead is in the CRM service; some also in WhatsApp / Events
      serviceTracks: [
        { service: svc.crm._id, status: status._id, subStatus: sub?._id || null, owner: owners[i % owners.length], value: c.value, nextFollowUp: closed ? null : due, isClosed: closed },
        ...(i % 2 === 0 ? [{ service: svc.whatsapp._id, status: waStatuses[i % waStatuses.length]._id, owner: owners[(i + 1) % owners.length], value: 0, nextFollowUp: i % 4 === 0 ? null : due, isClosed: [2, 3].includes(i % waStatuses.length) }] : []),
        ...(i % 3 === 0 ? [{ service: svc.events._id, status: evStatuses[3]._id, owner: owners[(i + 2) % owners.length], value: 0, nextFollowUp: (() => { const d = new Date(today); d.setMonth(d.getMonth() + 7); return d; })(), isClosed: false }] : []),
      ],
    });
    leadDocs.push(lead);
    if (!closed) {
      fuDocs.push({
        tenant: T, lead: lead._id, service: svc.crm._id, leadName: lead.name, phone: lead.phone, due,
        type: (["Call", "WhatsApp", "Email", "Visit"] as const)[i % 4],
        note: ["Discuss fee structure", "Share brochure", "Confirm campus visit", "Follow up on documents"][i % 4],
        owner: lead.owner, status: status._id,
      });
    }
    // event "Next Year" follow-up for the leads engaged in Events
    if (i % 3 === 0) {
      const d = new Date(today); d.setMonth(d.getMonth() + 7);
      fuDocs.push({
        tenant: T, lead: lead._id, service: svc.events._id, leadName: lead.name, phone: lead.phone, due: d,
        type: "Call", note: "Event Management — re-engage next year", owner: lead.owner, status: evStatuses[3]._id,
      });
    }
  }
  await FollowUp.create(fuDocs);

  /* templates */
  await Template.create([
    { tenant: T, channel: "whatsapp", name: "fee_due_reminder_v3", language: "en", category: "Utility", status: "Approved", body: "Hi {{1}}, your fee of ₹{{2}} is due on {{3}}." },
    { tenant: T, channel: "whatsapp", name: "admission_welcome", language: "en", category: "Marketing", status: "Approved", body: "Welcome to Greenwood, {{1}}!" },
    { tenant: T, channel: "whatsapp", name: "campus_visit_invite", language: "en", category: "Marketing", status: "Approved", body: "Hi {{1}}, book your campus visit today." },
    { tenant: T, channel: "whatsapp", name: "exam_schedule", language: "en", category: "Utility", status: "Pending", body: "Exam dates for {{1}} are out." },
    { tenant: T, channel: "email", name: "welcome_email", subject: "Welcome to Greenwood International", language: "en", category: "Marketing", status: "Approved", body: "<p>Dear {{1}},</p><p>Thank you for your interest in Greenwood International. We're delighted to help with admissions for {{2}}.</p><p>Warm regards,<br/>Admissions Team</p>" },
    { tenant: T, channel: "email", name: "fee_reminder_email", subject: "Fee payment reminder", language: "en", category: "Utility", status: "Approved", body: "<p>Dear {{1}},</p><p>This is a reminder that your fee of ₹{{2}} is due on {{3}}.</p>" },
  ]);

  /* a couple of campaigns */
  await Campaign.create([
    { tenant: T, name: "Fee Reminder – Nov 2026", template: "fee_due_reminder_v3", category: "Fee", status: "Completed", audienceSize: 2418, sent: 2418, delivered: 2380, read: 1602, failed: 38, createdBy: "Priya Kothari" },
    { tenant: T, name: "Class XI Admissions Open", template: "admission_welcome", category: "Admission", status: "Running", audienceSize: 1840, sent: 1200, delivered: 1170, read: 760, failed: 30, createdBy: "Rahul Bhatt" },
  ]);

  /* conversations (user-initiated) */
  const openers = ["Hi, is admission for Class XI Science still open?", "What is the fee structure?", "Do you provide transport from Indiranagar?", "I saw your ad, please share details.", "Is hostel facility available?", "What documents are needed?", "Can we visit campus this weekend?", "Please share the brochure."];
  for (let i = 0; i < 10; i++) {
    const c = contacts[i];
    const opened = new Date(Date.now() - (i % 3) * 20 * 3600 * 1000);
    const within = i % 3 !== 0;
    const expires = new Date(opened.getTime() + 24 * 3600 * 1000);
    const hhmm = `${String(opened.getHours()).padStart(2, "0")}:${String(opened.getMinutes()).padStart(2, "0")}`;
    const messages: any[] = [{ from: "them", time: hhmm, type: "text", text: openers[i % openers.length], at: opened }];
    if (i % 4 !== 3) messages.push({ from: "me", time: hhmm, type: "text", text: "Hello! Happy to help — could you share the student's current class?", agent: c.assigned, at: new Date(opened.getTime() + 180000) });
    await Conversation.create({
      tenant: T, contact: c._id, name: c.name, phone: c.phone, category: c.category,
      assigned: c.assigned, unread: i % 3 === 0 ? 1 + (i % 3) : 0, priority: i % 5 === 0,
      tags: c.tags, windowOpenedAt: opened, windowExpiresAt: within ? expires : new Date(Date.now() - 3600 * 1000),
      last: messages[messages.length - 1].text, lastTime: hhmm, messages,
    });
  }

  /* integrations */
  await Integration.create([
    { tenant: T, key: "int_wa", name: "WhatsApp Cloud API", category: "Messaging", icon: "whatsapp", connected: true, account: "Greenwood · +91 99999 00001", desc: "Send & receive WhatsApp, templates, webhooks" },
    { tenant: T, key: "int_fb", name: "Facebook Lead Ads", category: "Lead source", icon: "globe", connected: true, account: "Greenwood Admissions", desc: "Auto-import leads from Facebook forms" },
    { tenant: T, key: "int_gform", name: "Google Forms", category: "Lead source", icon: "doc", connected: false, desc: "Pull form responses in as leads" },
    { tenant: T, key: "int_email", name: "Email (SMTP/IMAP)", category: "Messaging", icon: "inbox", connected: true, account: "admissions@greenwood.edu", desc: "Send and log email" },
    { tenant: T, key: "int_sms", name: "SMS Gateway", category: "Messaging", icon: "phone", connected: false, desc: "Transactional & promotional SMS" },
    { tenant: T, key: "int_api", name: "Open REST API", category: "Developer", icon: "plug", connected: true, account: "2 keys active", desc: "Push/pull leads via API key & webhooks" },
  ]);

  await AuditLog.create({ tenant: T, user: "System", action: "SEED", module: "System", entity: "Initial dataset", next: "Seeded" });

  /* WhatsApp vendor accounts — multiple configured, exactly one active */
  await WhatsAppAccount.create([
    {
      tenant: T, label: "Demo (Simulation)", vendor: "simulation", active: true,
      senderNumber: "+91 99999 00001", health: "ok", healthNote: "Simulation — no real sending",
    },
    {
      tenant: T, label: "Meta Direct – Admissions", vendor: "meta", active: false,
      senderNumber: "+91 99999 00002", phoneNumberId: "", accessToken: "", appSecret: "",
      verifyToken: "greenwood-verify", extra: { apiVersion: "v21.0" },
      health: "unknown", healthNote: "Add Meta credentials to go live",
    },
    {
      tenant: T, label: "Pinnacle – Marketing number", vendor: "pinnacle", active: false,
      senderNumber: "+91 99999 00003", apiBaseUrl: "", apiKey: "", verifyToken: "pinnacle-verify",
      health: "unknown", healthNote: "Add Pinnacle API key + base URL (from their doc) to go live",
    },
  ]);

  /* Automated Chatbot Rules */
  await ChatbotRule.create([
    {
      tenant: T,
      name: "Fee Structure Inquiry Bot",
      triggerType: "keyword",
      keywords: ["fee", "fees", "cost", "pricing", "payment"],
      matchType: "contains",
      actionType: "send_buttons",
      actionPayload: {
        text: "Here is information regarding Greenwood Fee Structure for 2026-27. What would you like to explore?",
        buttons: [
          { id: "fee_class11", title: "Class XI Fees" },
          { id: "fee_hostel", title: "Hostel & Transport" },
          { id: "talk_counsellor", title: "Talk to Counsellor" },
        ],
      },
      active: true,
      order: 1,
    },
    {
      tenant: T,
      name: "Admission Inquiry Auto-Response",
      triggerType: "keyword",
      keywords: ["admission", "apply", "course", "seat", "join"],
      matchType: "contains",
      actionType: "send_template",
      actionPayload: {
        templateName: "admission_welcome",
        languageCode: "en",
        counsellorName: "Priya Kothari",
      },
      active: true,
      order: 2,
    },
    {
      tenant: T,
      name: "Default Greeting Menu",
      triggerType: "default",
      keywords: [],
      matchType: "contains",
      actionType: "send_text",
      actionPayload: {
        text: "Welcome to Greenwood International School Admissions Helpline! Reply 'FEE' for fee structure or 'ADMISSION' to apply.",
      },
      active: true,
      order: 99,
    },
  ]);

  console.log("\n[seed] done ✓");
  console.log("  Tenant:", tenant.name);
  console.log("  Login:  priya@greenwood.edu / password123  (Administrator)");
  console.log("          ananya@greenwood.edu / password123 (Counsellor — limited perms)");
  console.log(`  Leads: ${leadDocs.length} · Follow-ups: ${fuDocs.length} · Contacts: ${contacts.length}\n`);

  await disconnectDB();
  process.exit(0);
}

seed().catch((e) => {
  console.error("[seed] error:", e);
  process.exit(1);
});
