import { runAll, apiLogin, api, APP } from "./rec.mjs";
import { scenes as crmCore, BTN, FIELD, NAV } from "./scenes-crm.mjs";
import fs from "fs";

const S = (text) => `::-p-xpath((//button[starts-with(normalize-space(.), ${JSON.stringify(text)})] | //a[starts-with(normalize-space(.), ${JSON.stringify(text)})] | //*[@role='tab'][starts-with(normalize-space(.), ${JSON.stringify(text)})])[1])`;
const TXT = (text) => `::-p-xpath((//*[self::h1 or self::h2 or self::h3 or self::div or self::span or self::label][normalize-space(text())=${JSON.stringify(text)}])[1])`;
const ROW = (n = 1) => `::-p-xpath((//table//tbody//tr)[${n}])`;
const DLG = "[role=dialog]";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = async (s) => { await s.page.keyboard.press("Escape"); await sleep(600); };

/* ───────────── demo data, removed at the end ───────────── */
const demo = { forms: [], leads: [], regs: [], companies: [], deals: [], products: [], quotes: [] };
let ctx = {};
async function seed() {
  const t = await apiLogin();
  const f = (await api(t, "POST", "/crm/forms", { template: "enquiry", name: "Campus Visit Enquiry" })).data;
  demo.forms.push(f._id);
  await api(t, "PATCH", `/crm/forms/${f._id}`, { title: "Book a campus visit", slug: `campus-visit-${Date.now().toString(36).slice(-4)}`, settings: { createApplication: true, submitLabel: "Book my visit", successMessage: "Thanks {name}! Your reference is {ref}. We will call you to fix a time." }, status: "live" });
  const full = (await api(t, "GET", `/crm/forms/${f._id}`)).data;
  ctx.form = full;
  const fields = full.pages[0].fields;
  const id = (m) => fields.find((x) => x.map === m)?.id;
  const consent = fields.find((x) => x.type === "consent")?.id;
  const course = fields.find((x) => x.map === "course");
  const opts = full.resolvedPages[0].fields.find((x) => x.id === course?.id)?.options || [];
  const people = [["Aarav Khanna", "+919810011201", "Delhi"], ["Ishita Rao", "+919810011202", "Noida"], ["Kabir Sethi", "+919810011203", "Gurugram"]];
  for (const [name, phone, city] of people) {
    const data = { [id("name")]: name, [id("phone")]: phone, [id("email")]: `${name.split(" ")[0].toLowerCase()}@example.com`, [id("city")]: city, [consent]: true };
    if (course) data[course.id] = opts[0] || "BBA";
    const fd = new FormData(); fd.append("payload", JSON.stringify({ data, utm: { source: "instagram", campaign: "open-day" } }));
    const r = await fetch(`${API_BASE}/public/forms/${full.slug}/submit`, { method: "POST", body: fd });
    if (!r.ok) console.error("seed submit", r.status, await r.text());
  }
  const subs = (await api(t, "GET", `/crm/forms/${f._id}/submissions`)).data || [];
  for (const s of subs) { if (s.lead) demo.leads.push(s.lead); if (s.registration) demo.regs.push(s.registration); }

  const co = (await api(t, "POST", "/crm/companies", { name: "Sunrise Tech Pvt Ltd", industry: "Education", city: "Pune", email: "it@sunrise.example.com", contacts: [{ name: "Neha Joshi", role: "Principal", phone: "+919820055501", primary: true }] })).data;
  demo.companies.push(co._id); ctx.company = co;
  for (const p of [["School ERP licence", 120000, "Year"], ["Implementation & training", 40000, "Nos"], ["Mobile app", 30000, "Year"]]) demo.products.push((await api(t, "POST", "/crm/products", { name: p[0], price: p[1], unit: p[2], taxPercent: 18, category: "Software" })).data._id);
  const stages = (await api(t, "GET", "/crm/deal-stages")).data;
  const st = (k, i) => stages.filter((s) => s.kind === k)[i]?._id;
  const d1 = (await api(t, "POST", "/crm/deals", { title: "Sunrise Tech – ERP rollout", company: co._id, contactName: "Neha Joshi", stage: st("open", 2), expectedClose: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10), items: [{ product: demo.products[0], qty: 1 }, { product: demo.products[1], qty: 1, discountPct: 10 }], priority: "high" })).data;
  const d2 = (await api(t, "POST", "/crm/deals", { title: "Greenfield School – Mobile app", stage: st("open", 3), value: 85000, contactName: "Amit Verma", expectedClose: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) })).data;
  const d3 = (await api(t, "POST", "/crm/deals", { title: "Delhi Scholars – CRM", stage: st("open", 0), value: 60000, contactName: "Ritu Kapoor" })).data;
  demo.deals.push(d1._id, d2._id, d3._id); ctx.deal = d1;
  const q = (await api(t, "POST", "/crm/quotes", { deal: d1._id })).data;
  demo.quotes.push(q._id); ctx.quote = q;
  await api(t, "POST", `/crm/quotes/${q._id}/send`, { channel: "link" });
}
const API_BASE = "http://localhost:4001/api";
async function cleanup() {
  const t = await apiLogin();
  for (const id of demo.quotes) await api(t, "DELETE", `/crm/quotes/${id}`);
  // quotes made during the recording (duplicates)
  const qs = (await api(t, "GET", "/crm/quotes?q=Sunrise&perPage=200")).data || [];
  for (const q of qs) await api(t, "DELETE", `/crm/quotes/${q._id}`);
  for (const id of demo.deals) await api(t, "DELETE", `/crm/deals/${id}`);
  for (const id of demo.companies) await api(t, "DELETE", `/crm/companies/${id}`);
  for (const id of demo.products) await api(t, "DELETE", `/crm/products/${id}`);
  // the public-fill scene adds one more submission
  for (const fid of demo.forms) { const subs = (await api(t, "GET", `/crm/forms/${fid}/submissions?perPage=200`)).data || []; for (const s of subs) { if (s.lead && !demo.leads.includes(s.lead)) demo.leads.push(s.lead); if (s.registration && !demo.regs.includes(s.registration)) demo.regs.push(s.registration); } }
  for (const id of demo.regs) await api(t, "DELETE", `/registrations/${id}`);
  for (const id of demo.forms) await api(t, "DELETE", `/crm/forms/${id}`);
  for (const id of demo.leads) await api(t, "DELETE", `/leads/${id}`);
  for (const d of (await api(t, "GET", "/crm/reports/saved?kind=dashboard")).data || []) if (d.name === "Admissions overview" && new Date(d.createdAt) > started) await api(t, "DELETE", `/crm/reports/saved/${d._id}`);
}
const started = new Date();

/* ───────────── a simple guided tour of one page ───────────── */
const tour = (url, module, title, sub, steps, endText) => async (s) => {
  await s.go(url);
  await s.title(module, title, sub);
  for (const [kind, sel, text, opt] of steps) {
    if (kind === "cap") { await s.cap(sel); await s.shot(text || 2000); }
    else if (kind === "point") await s.point(sel, text);
    else if (kind === "click") await s.click(sel, text, opt);
    else if (kind === "type") await s.type(sel, text, opt);
    else if (kind === "esc") await esc(s);
    else if (kind === "scroll") await s.scroll(sel, text);
    else if (kind === "go") await s.go(sel, text);
  }
  await s.end(endText);
};

const scenes = {
  ...crmCore,
  "06-follow-ups": tour("/crm/followups", "CRM", "Follow-ups", "Every call and visit you planned, sorted into Today, Upcoming, Overdue and Completed.", [
    ["click", S("Overdue"), "Overdue: follow-ups that were missed"],
    ["click", S("Today"), "Today: your plan for the day"],
    ["point", ROW(1), "Mark one done with the outcome. The next follow-up is suggested"],
  ], "Follow-ups are created automatically for every new lead"),

  "07-activities": async (s) => {
    await s.go("/crm/leads");
    await s.title("CRM", "Notes, calls and activities", "Everything you do with a lead is logged on its Timeline.");
    await s.click(ROW(2), "Open a lead", { wait: 1600 });
    await s.point("::-p-xpath(//div[@role='dialog']//button[normalize-space(.)='Note'])", "Write a note");
    await s.click("::-p-xpath(//div[@role='dialog']//button[normalize-space(.)='Log call'])", "Log a call with its outcome", { wait: 800, after: 2200 });
    await s.cap("Set up your own activity types (Campus visit, Demo…) in CRM settings → Activity types"); await s.shot(2600);
    await esc(s);
    await s.go("/crm/activities", "CRM → Activities lists every logged activity");
    await s.point(S("Export Excel"), "Filter by type, person and dates, then export to Excel");
    await s.end("Activities add score points to the lead");
  },

  "08-queries": tour("/crm/queries", "CRM", "Queries help desk", "Track every question from a student or customer until it is resolved.", [
    ["point", S("Active"), "Tabs show how many queries are open, waiting or resolved"],
    ["point", S("Overdue"), "Overdue shows queries past their reply time"],
    ["click", S("New query"), "Click New query", { wait: 900 }],
    ["cap", "Pick the lead, category and priority, then write the question", 2600],
    ["esc"],
  ], "Reply from the query. The customer can get it on WhatsApp or email"),

  "09-lead-lists": tour("/crm/lists", "CRM", "Lead lists", "Save a group of leads once, then call, message or export them in one click.", [
    ["click", S("New list"), "Click New list", { wait: 900 }],
    ["cap", "Static list: you pick the leads. Smart list: a saved filter that updates itself", 3000],
    ["esc"],
    ["go", "/crm/leads", "Or tick leads on the Leads page → Add to list"],
  ], "Use a list as the audience of a Bulk Campaign"),

  "10-forms-create": async (s) => {
    await s.go("/crm/forms");
    await s.title("CRM → Forms", "Creating a form", "Enquiry, application, registration or event forms, ready in a minute.");
    await s.click(S("New form"), "Click New form", { wait: 1200 });
    await s.type(FIELD("Name"), "Scholarship Application", "Give it a name");
    await s.click("::-p-xpath(//div[@role='dialog']//button[contains(normalize-space(.),'Admission application')])", "Start from a template, or Blank", { wait: 600 });
    await s.point("::-p-xpath(//div[@role='dialog']//button[normalize-space(.)='Create'])", "Click Create to open the builder", 2200);
    await esc(s);
    await s.end("Templates: Enquiry, Admission, Event, Job, Contact us, Feedback");
  },

  "11-forms-builder": async (s) => {
    await s.go(`/crm/forms/${ctx.form._id}`);
    await s.title("CRM → Forms", "Building the form", "What you see is exactly what people fill in. Click any part to change it.");
    await s.point("aside", "Field types: text, phone, dropdown, upload, signature …");
    await s.click("::-p-xpath(//aside//button[normalize-space(.)='Date'])", "Click a field type to add it (or drag it onto the form)", { wait: 900 });
    await s.type("::-p-xpath(//aside[last()]//label[starts-with(normalize-space(.),'Label')]/following::input[1])", "Preferred visit date", "Its settings open on the right. Rename it");
    await s.click("::-p-xpath(//aside[last()]//label[contains(normalize-space(.),'Required')])", "Make it required", { wait: 500 });
    await s.click("::-p-xpath((//section//div[contains(@class,'group')])[last()])", "Click the buttons to change the Submit text and position", { wait: 800 });
    await s.point("::-p-xpath(//button[normalize-space(.)='Preview'])", "Preview it on desktop and phone");
    await s.cap("Click Save when done (or Ctrl+S)"); await s.shot(2000);
    await s.end("Leaving without saving? The browser asks first");
  },

  "12-forms-settings-share": async (s) => {
    await s.go(`/crm/forms/${ctx.form._id}?tab=settings`);
    await s.title("CRM → Forms", "Settings & sharing", "Thank-you message, dates, lead creation, fee, alerts, then share the link.");
    await s.cap("Settings: availability, lead, fee, notifications, look"); await s.shot(2400);
    await s.scroll(450, "Collect a fee: fixed, or based on an answer");
    await s.click(S("Share"), "Open the Share tab", { wait: 1500 });
    await s.point(S("Copy"), "Copy the link or send it on WhatsApp");
    await s.point(TXT("QR code"), "Download a QR code for posters");
    await s.point(TXT("Embed on a website"), "Paste the embed code on your website");
    await s.end("Campaign tracking adds utm tags so you know which ad worked");
  },

  "13-form-fill": async (s, { page }) => {
    await s.go(`/f/${ctx.form.slug}`);
    await s.title("CRM → Forms", "Filling in a form", "What a parent or student sees when they open your form link.");
    const fl = ctx.form.pages[0].fields;
    const id = (m) => fl.find((x) => x.map === m)?.id;
    await s.type(`#ff-${id("name")}`, "Meera Kapoor", "They open the link and fill it in");
    await s.type(`#ff-${id("phone")}`, "+91 98100 11299", "Errors are shown right under the field");
    await s.type(`#ff-${id("email")}`, "meera@example.com");
    const c = fl.find((x) => x.map === "course");
    if (c) { const opts = await page.$$eval(`#ff-${c.id} option`, (o) => o.map((x) => x.value).filter(Boolean)); if (opts[0]) await s.select(`#ff-${c.id}`, opts[0], "Pick the course"); }
    await s.type(`#ff-${id("city")}`, "Delhi");
    await s.click("::-p-xpath(//label[contains(.,'I agree')])", "Tick consent", { wait: 300, after: 0 });
    await s.click("button[type=submit]", "Submit", { wait: 2500 });
    await s.end("They get a reference number. A lead is created for your team");
  },

  "14-form-submissions": async (s) => {
    await s.go(`/crm/forms/${ctx.form._id}?tab=submissions`);
    await s.title("CRM → Forms", "Submissions", "Everything people sent, with status, files, payment and notes.");
    await s.point(S("All"), "Tabs: New, In review, Accepted, Rejected");
    await s.click(ROW(1), "Click a submission to open it", { wait: 1500 });
    await s.cap("Answers by step, files, the lead, payment and notes"); await s.shot(2600);
    await esc(s);
    await s.click(S("Analytics"), "Analytics: views, conversion, sources and drop-off", { wait: 1800, after: 2600 });
    await s.end("Export everything to Excel from the Submissions tab");
  },

  "15-applications-offer": async (s) => {
    await s.go("/crm/applications");
    await s.title("CRM", "Applications & offers", "Move applicants from Submitted to Enrolled and send offers by email and WhatsApp.");
    await s.point(S("All"), "Stage tabs with counts");
    await s.click(ROW(1), "Click an application", { wait: 1600 });
    await s.point("::-p-xpath(//div[@role='dialog']//select[@aria-label='Stage'])", "Move it to the next stage with a note");
    await s.click("::-p-xpath(//div[@role='dialog']//button[contains(normalize-space(.),'Make offer') or contains(normalize-space(.),'Send offer again')])", "Click Make offer", { wait: 1500 });
    await s.cap("Write the offer, set the fee and the last date"); await s.shot(2400);
    await s.point("::-p-xpath((//div[@role='dialog'])[last()]//label[contains(normalize-space(.),'WhatsApp')])", "Tick Email and/or WhatsApp and pick a template from Setup");
    await s.cap("Preview shows exactly what they will get"); await s.shot(2200);
    await esc(s); await esc(s);
    await s.end("They accept or decline from their link and can pay the fee");
  },

  "16-deals-pipeline": async (s) => {
    await s.go("/crm/deals");
    await s.title("CRM → Sales", "Deals pipeline", "Track every opportunity from first talk to won, with value and forecast.");
    await s.point("::-p-xpath((//button[contains(.,'Open pipeline')])[1]/..)", "Pipeline value, forecast, won this month, win rate, overdue");
    await s.cap("Drag a card to the next stage. Lost asks for a reason"); await s.shot(2400);
    await s.click("::-p-xpath((//div[@draggable='true'])[1])", "Click a deal to open it", { wait: 1600 });
    await s.scroll(380, "Products & services: lines, discount and tax make the value");
    await s.point("::-p-xpath(//div[@role='dialog']//button[contains(normalize-space(.),'Quotation')])", "Make a quotation from the deal");
    await esc(s);
    await s.click(S("Stages"), "Stages and their probability are yours to set", { wait: 1000, after: 2200 });
    await esc(s);
    await s.end("Open a lead → Deal to start a deal from an enquiry");
  },

  "17-companies": tour("/crm/companies", "CRM → Sales", "Companies", "Accounts with their people, deals and quotations.", [
    ["click", ROW(1), "Open a company", { wait: 1500 }],
    ["cap", "Details, GSTIN, people with a main contact", 2200],
    ["scroll", 400, "Its deals, quotations and notes"],
    ["esc"],
  ], "Add a company with New company"),

  "18-quotations": async (s) => {
    await s.go("/crm/quotes");
    await s.title("CRM → Sales", "Quotations", "Make a quotation, send it, and let the customer accept it online.");
    await s.click(ROW(1), "Open a quotation", { wait: 1600 });
    await s.scroll(350, "Lines, discount, tax and round off are worked out for you");
    await s.point("::-p-xpath(//div[@role='dialog']//button[contains(normalize-space(.),'Send')])", "Send by email or copy the link");
    await esc(s);
    await s.go(`/quote/${ctx.quote.token}`, "The customer opens the link");
    await s.point(S("Accept"), "They accept with their name, decline, or print a PDF");
    await s.end("You are notified and the deal is updated");
  },

  "19-products": tour("/crm/products", "CRM → Sales", "Products", "Your catalogue of products and services with price and GST.", [
    ["click", S("New product"), "Click New product", { wait: 900 }],
    ["cap", "Name, SKU, category, price, GST %, unit, HSN/SAC", 2400],
    ["esc"],
  ], "Pick products when you add lines to a deal or quotation"),

  "20-conversion": tour("/crm/conversion", "CRM", "Conversion dashboard", "Funnel, sources, cost per lead and counsellor performance.", [
    ["point", S("30 days"), "Pick the period"],
    ["scroll", 450, "Funnel and source performance"],
    ["scroll", 450, "Counsellor league table"],
  ], "Add ad spend to see cost per lead and per admission"),

  "21-targets": tour("/crm/targets", "CRM", "Targets", "Monthly targets per counsellor with live progress.", [
    ["click", S("Set targets"), "Set targets for the month", { wait: 1000 }],
    ["cap", "Leads, conversions and revenue for each person", 2400],
    ["esc"],
  ], "Progress bars update as work is done"),

  "22-report-builder": async (s) => {
    await s.go("/crm/reports");
    await s.title("CRM", "Report builder", "Build any report: pick the data, filters, grouping and numbers. Export to Excel.");
    await s.point("::-p-xpath((//label[normalize-space(.)='Report on']/following::select[1])[1])", "Report on: leads, follow-ups, applications, deals, fees, forms …");
    await s.point("::-p-xpath((//label[normalize-space(.)='Group by']/following::select[1])[1])", "Group by any field; dates by day, week, month or year");
    await s.point(S("Add a number"), "Add numbers: count, total, average, highest, lowest");
    await s.click(S("Add filter"), "Add filters: status is…, course contains…, score at least…", { wait: 700 });
    await s.point("::-p-xpath(//button[@title='pie'])", "See it as a bar, line or pie chart");
    await s.click("::-p-xpath(//button[contains(normalize-space(.),'Lead list (Excel)')])", "Or a list of records with the columns you pick", { wait: 1800, after: 2200 });
    await s.point(S("Export Excel"), "Export everything to Excel");
    await s.point("::-p-xpath(//button[normalize-space(.)='Save'])", "Save it to open again, or add it to a dashboard");
    await s.end("Ready-made reports are on the left to start from");
  },
  "22b-dashboards": async (s) => {
    await s.go("/crm/reports?tab=dashboards");
    await s.title("CRM", "Dashboards", "Your own dashboard of number cards, charts and tables, for any period.");
    await s.cap("Make a starter dashboard in one click, or build your own"); await s.shot(2400);
    await s.click("::-p-xpath(//button[contains(normalize-space(.),'starter dashboard')] | //button[normalize-space(.)='New dashboard'])", "Click New dashboard", { wait: 1000 });
    await s.type(FIELD("Name"), "Admissions overview", "Name it");
    await s.click("::-p-xpath(//div[@role='dialog']//button[normalize-space(.)='Create'])", "Create", { wait: 3500 });
    await s.cap("Cards show the number and the change against the previous period"); await s.shot(2600);
    await s.point("::-p-xpath((//label[normalize-space(.)='Period']/following::select[1] | //select[@aria-label='Period'])[1])", "Change the period for the whole dashboard");
    await s.click(S("Edit"), "Edit to add, move, resize or remove widgets", { wait: 900 });
    await s.click(S("Add widget"), "Add widget: card, bar, line, pie or table", { wait: 1500, after: 2600 });
    await esc(s);
    await s.end("Share a dashboard with everyone or keep it to yourself");
  },
  "31-approvals": async (s) => {
    await s.go("/crm/approvals");
    await s.title("CRM", "Approvals", "Concessions, refunds and big quotation discounts wait for the right person to approve.");
    await s.point(S("For me"), "For me: requests waiting for your yes or no");
    await s.click(S("My requests"), "My requests: what you asked for, and where it stands", { wait: 1000, after: 2000 });
    await s.click(S("Rules"), "Rules: what is approved on its own, and who approves", { wait: 1200 });
    await s.cap("Set a limit for automatic approval, and a second approver above an amount"); await s.shot(2800);
    await s.scroll(400, "Refunds and quotation discounts can need approval too");
    await esc(s);
    await s.end("The requester is told as soon as it is decided");
  },

  "23-contacts-partners": tour("/crm/contacts", "CRM", "Contacts & partners", "Your contact book, and referral partners who send you leads.", [
    ["point", S("Add contact"), "Add a contact"],
    ["go", "/crm/partners", "Referral partners"],
    ["point", S("Add partner"), "Each partner gets a link; leads from it are credited to them"],
  ]),

  "24-conversations": tour("/crm/chat", "WhatsApp Manager", "Conversations", "Chat with leads on WhatsApp from the CRM.", [
    ["point", S("Unread"), "Filter All, Unread, Open, Closed"],
    ["click", "::-p-xpath((//button[contains(@class,'wa-') or ancestor::*[contains(@class,'wa-list')]])[5])", "Open a chat", { wait: 1500 }],
    ["cap", "Reply, send a template, buttons or emoji. The 24-hour window is shown", 2600],
  ], "Convert to lead turns a new chat into a lead"),

  "25-bulk-campaigns": tour("/crm/campaigns", "WhatsApp Manager", "Bulk campaigns", "Send an approved WhatsApp template to many people at once.", [
    ["point", S("Recipient Lists"), "Import a list from Excel, or use a CRM lead list"],
    ["click", S("New Campaign"), "Click New Campaign", { wait: 1200 }],
    ["cap", "Pick the audience, the template and its values; send now or schedule", 2800],
    ["esc"],
    ["click", ROW(1), "Open a campaign to see its delivery report", { wait: 1500, after: 2400 }],
    ["esc"],
  ], "Resend to the ones who failed or did not read"),

  "26-templates": tour("/crm/templates", "WhatsApp Manager", "Templates", "WhatsApp templates approved by Meta, and email templates.", [
    ["point", S("Sync from Meta"), "Sync the templates you made in Meta"],
    ["click", S("New Meta Template"), "Or create one here and send it for approval", { wait: 1500, after: 2400 }],
    ["esc"],
  ]),

  "27-chatbot": tour("/crm/chatbot", "WhatsApp Manager", "Chatbot & bot flows", "Automatic WhatsApp replies and menus.", [
    ["point", S("Bot Flows"), "Bot flows: menus, questions and answers"],
    ["point", S("New Flow"), "Build a new flow on a drag-and-drop canvas"],
  ]),

  "28-automation": async (s) => {
    await s.go("/crm/automation");
    await s.title("CRM", "Automation", "Rules that work on their own: welcome messages, chasers and nurture journeys.");
    await s.cap("Ready-made rules to switch on, or make your own"); await s.shot(2200);
    await s.click(S("New rule"), "Click New rule", { wait: 1200 });
    await s.type(FIELD("Rule name"), "Welcome new enquiries", "Name it");
    await s.point("::-p-xpath(//div[@role='dialog']//select[@aria-label='When this happens'])", "1 · When: the event that starts it");
    await s.click("::-p-xpath(//div[@role='dialog']//button[contains(normalize-space(.),'Condition')])", "2 · Only if: add conditions, joined by AND / OR", { wait: 700 });
    await s.point("::-p-xpath(//div[@role='dialog']//select[@aria-label='When'])", "3 · Then do: each step runs right away or after a wait");
    await s.click("::-p-xpath((//div[@role='dialog']//button[normalize-space(.)='Name'])[1])", "Click a chip to put the lead's name in the message", { wait: 600 });
    await s.click("::-p-xpath(//div[@role='dialog']//button[contains(normalize-space(.),'Step')])", "Add more steps for a journey", { wait: 800 });
    await s.scroll(500, "A summary says exactly what the rule will do");
    await esc(s);
    await s.end("Run log shows every time a rule ran");
  },
  "29-crm-settings": tour("/crm/settings", "CRM", "CRM settings", "Reminders, telephony, SMS, lead capture, scoring and more.", [
    ["click", S("Assignment & rules"), "Assignment: auto-assign, working hours, duplicates", { wait: 900, after: 2000 }],
    ["click", S("Lead scoring"), "Lead scoring: points and Hot / Warm bands", { wait: 900, after: 2000 }],
    ["click", S("Activity types"), "Activity types: your own activities with fields", { wait: 900, after: 2000 }],
    ["click", S("Application stages"), "Application stages", { wait: 900, after: 2000 }],
  ], "Click Save after changes"),

  "30-crm-setup": tour("/crm/setup", "CRM", "CRM setup", "Statuses, sources, forms, academic masters, templates and integrations.", [
    ["click", S("Lead Statuses"), "Lead statuses with colours and sub-statuses", { wait: 1000, after: 2000 }],
    ["click", S("Sources"), "Lead sources", { wait: 1000, after: 1800 }],
    ["click", S("Email Template"), "Email and WhatsApp templates used in offers and messages", { wait: 1000, after: 2200 }],
  ]),

  /* ───────────── Event Manager ───────────── */
  "40-events-overview": tour("/modules/events", "Event Manager", "Events overview", "All your events, registrations and check-ins at a glance.", [
    ["cap", "Today's numbers and upcoming events", 2400],
    ["point", S("New event"), "Create a new event"],
  ]),
  "41-events-create": tour("/modules/events/all", "Event Manager", "Creating an event", "A step-by-step wizard: details, tickets, form, pass and messages.", [
    ["point", S("All"), "Status tabs: Draft, Scheduled, Live, Completed"],
    ["click", S("Create Event"), "Click Create Event", { wait: 1800 }],
    ["cap", "Fill the steps; save as draft any time", 2600],
  ]),
  "42-events-registrants": tour("/modules/events/registrants", "Event Manager", "Registrants", "Everyone who registered, their payment and pass.", [
    ["click", ROW(1), "Open a registrant", { wait: 1400, after: 2200 }],
    ["esc"],
  ]),
  "43-events-scan": tour("/modules/events/scan", "Event Manager", "Scan pass & attendance", "Check people in at the gate by scanning their QR pass.", [
    ["point", S("Check in"), "Choose Check in or Check out"],
    ["point", S("Start camera"), "Start the camera and scan the pass"],
    ["go", "/modules/events/attendance", "Attendance shows who came and when"],
  ]),
  "44-events-communication": tour("/modules/events/communication", "Event Manager", "Event communication", "Send WhatsApp or email to registrants of an event.", [
    ["point", S("WhatsApp"), "Pick the channel"],
    ["point", S("Approved template"), "Use an approved template or free text"],
    ["click", S("History"), "History of everything sent", { wait: 1000, after: 2000 }],
  ]),
  "45-events-payments": tour("/modules/events/payments", "Event Manager", "Event payments", "Online and offline payments for paid events.", [
    ["point", S("Record payment"), "Record a cash or bank payment"],
  ]),
  "46-events-setup": tour("/modules/events/setup", "Event Manager", "Event setup", "Categories, statuses, venues, certificates, pass and form design.", [
    ["click", S("Venue"), "Venues", { wait: 900, after: 1800 }],
    ["click", S("Pass Templates"), "Pass templates", { wait: 900, after: 1800 }],
  ]),

  /* ───────────── Project Management ───────────── */
  "50-pm-dashboard": tour("/modules/projects/dashboard", "Project Management", "PM dashboard", "Projects on track or delayed, overdue tasks and team load.", [
    ["cap", "Big numbers: active, on track, delayed, overdue tasks", 2600],
    ["scroll", 450, "Each project's progress and the team's load"],
  ]),
  "51-pm-projects": tour("/modules/projects/list", "Project Management", "Projects", "Create a project from a product template and follow it to sign-off.", [
    ["point", S("New project"), "New project: client, product and incharge"],
    ["click", ROW(1), "Open a project", { wait: 2000, after: 2400 }],
  ]),
  "52-pm-my-work": tour("/modules/projects/my-work", "Project Management", "Task planner", "Your tasks: overdue, due today, this week.", [
    ["cap", "Tick checklist items and complete tasks", 2400],
  ]),
  "53-pm-meetings-tickets": tour("/modules/projects/meetings", "Project Management", "Meetings & tickets", "Client meetings and trainings, and support tickets.", [
    ["point", S("New"), "Schedule a meeting or training"],
    ["go", "/modules/projects/tickets", "Tickets from clients with TAT"],
  ]),
  "54-pm-clients-team": tour("/modules/projects/clients", "Project Management", "Clients & team", "Client companies and your reporting hierarchy.", [
    ["point", S("Add client"), "Add a client with SPOC"],
    ["go", "/modules/projects/team", "Team hierarchy"],
  ]),
  "55-pm-reports": tour("/modules/projects/reports", "Project Management", "PM reports", "Delivery, TAT compliance, overdue tasks and more.", [
    ["click", S("Overdue Tasks"), "Pick a report", { wait: 1200, after: 2200 }],
    ["point", S("Export Excel"), "Export to Excel"],
  ]),

  /* ───────────── Website Builder, Front Office, Reports, Configuration ───────────── */
  "60-website-templates": tour("/modules/website/templates", "Website Builder", "Website templates", "Start a website from a ready-made design.", [
    ["click", S("Education"), "Filter by industry", { wait: 1200, after: 2000 }],
    ["point", S("Use template"), "Use a template to create your site"],
  ]),
  "61-websites": tour("/modules/website", "Website Builder", "Websites", "Pages, designer, menus, content and form inbox for each site.", [
    ["cap", "Open a site to edit its pages with drag and drop", 2600],
  ]),
  "62-landing-pages": tour("/modules/website/landing", "Website Builder", "Landing pages", "Quick landing pages and enquiry forms.", [
    ["point", S("Landing Page Wizard"), "Make a landing page with the wizard"],
  ]),
  "70-front-office": tour("/modules/front-office/visitors/today", "Front Office", "Visitors", "Check visitors in and out at reception.", [
    ["point", S("Check In Visitor"), "Check in a visitor"],
    ["point", S("Checked In"), "See who is inside now"],
  ]),
  "80-reports": tour("/modules/reports", "Reports & Analytics", "Reports", "Executive analytics and your own reports.", [
    ["point", S("This Month"), "Pick the period"],
    ["go", "/modules/reports/builder", "Report builder: columns, filters, sort"],
    ["point", S("Export CSV"), "Export"],
  ]),
  "90-users-roles": tour("/modules/configuration", "Configuration", "Users & roles", "Add users, give roles and set exactly what each role can do.", [
    ["click", S("Users"), "Users", { wait: 1500, after: 2200 }],
    ["click", S("Roles"), "Roles: rights per screen and whose data they see", { wait: 1500, after: 2400 }],
  ]),
  "91-integrations": tour("/modules/configuration", "Configuration", "Integrations", "WhatsApp, email, SMS, payment gateway and AI.", [
    ["click", S("WhatsApp Integration"), "WhatsApp Business API", { wait: 1500, after: 2000 }],
    ["click", S("Payment Gateway Integration"), "Payment gateway for online fees", { wait: 1500, after: 2000 }],
  ]),
};

const only = process.argv.slice(2);
try {
  await seed();
  const report = await runAll(scenes, only.length ? only : undefined);
  fs.writeFileSync(new URL("./report.json", import.meta.url), JSON.stringify(report, null, 1));
  for (const r of report) console.log(r.error ? `✘ ${r.name}: ${r.error}` : `✔ ${r.name} ${r.seconds}s ${r.kb}KB`);
} finally {
  await cleanup().catch((e) => console.error("cleanup", e.message));
}
