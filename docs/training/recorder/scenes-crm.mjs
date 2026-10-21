import { runAll, APP } from "./rec.mjs";

// selector helpers
export const T = (tag, text) => `::-p-xpath(//${tag}[contains(normalize-space(.), ${JSON.stringify(text)})])`;
export const BTN = (text) => `::-p-xpath(//button[normalize-space(.)=${JSON.stringify(text)}] | //a[normalize-space(.)=${JSON.stringify(text)}])`;
export const BTNC = (text) => `::-p-xpath((//button[contains(normalize-space(.), ${JSON.stringify(text)})] | //a[contains(normalize-space(.), ${JSON.stringify(text)})])[1])`;
export const FIELD = (label, tag = "input", scope = "//div[@role='dialog']") => `::-p-xpath((${scope}//label[starts-with(normalize-space(.), ${JSON.stringify(label)})]/following::${tag}[1])[1])`;
export const NAV = (text) => `::-p-xpath(//aside//a[normalize-space(.)=${JSON.stringify(text)}] | //nav//a[normalize-space(.)=${JSON.stringify(text)}])`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const scenes = {
  "01-login": async (s, { page }) => {
    await page.evaluate(() => localStorage.removeItem("wacrm_token"));
    await s.go("/login");
    await s.title("Getting started", "Signing in", "Open the app link, type your email and password, and sign in.");
    await s.cap("Open the app link in your browser"); await s.shot(1800);
    await s.type("input[placeholder='Enter your email or username']", "priya@greenwood.edu", "Type your email");
    await s.type("input[placeholder='Enter your password']", "password123", "Type your password");
    await s.click("form button[type='submit']", "Click Login", { wait: 4000, after: 0 });
    await s.cap("You land on the Home dashboard"); await s.shot(2400);
    await s.end("Use the left menu to open any module");
  },

  "02-crm-dashboard": async (s) => {
    await s.go("/");
    await s.title("CRM", "CRM Dashboard", "Your admissions and sales at a glance: new leads, follow-ups due, conversions.");
    await s.click(NAV("CRM"), "Click CRM in the left menu", { wait: 2000 });
    await s.cap("The CRM menu opens with every CRM page"); await s.shot(2200);
    await s.scroll(420, "Scroll for charts and team numbers");
    await s.end("Click any number to open the matching leads");
  },

  "03-leads-list": async (s) => {
    await s.go("/crm/leads");
    await s.title("CRM", "Finding leads", "Quick views, search, filters and the board view.");
    await s.point("::-p-xpath(//button[starts-with(normalize-space(.),'My leads')])", "Quick views: My leads, Not contacted, Hot, Overdue …");
    await s.click("::-p-xpath(//button[starts-with(normalize-space(.),'Overdue')])", "Click a view to see only those leads", { wait: 1500 });
    await s.click("::-p-xpath(//button[starts-with(normalize-space(.),'All')])", "Back to All", { wait: 1200, after: 600 });
    await s.type("input[placeholder*='Name, phone']", "Patel", "Search by name, phone, email, course or city", { hold: 2000 });
    await s.type("input[placeholder*='Name, phone']", "", "Clear the search", { hold: 600 });
    await s.click(BTNC("Filters"), "More filters: source, course, dates, score, tags …", { wait: 900, hold: 1400, after: 2000 });
    await page_escape(s);
    await s.click("::-p-xpath((//button[.//i[contains(@class,'bi-kanban')]] | //button[@title='Board'] | //button[contains(@title,'oard')])[1])", "Switch to the board view", { wait: 1800, after: 2400 });
    await s.end("Drag a card to another column to change its status");
  },

  "04-add-lead": async (s) => {
    await s.go("/crm/leads");
    await s.title("CRM", "Adding a lead", "Add a walk-in or phone enquiry by hand in a few seconds.");
    await s.click(BTN("Add lead"), "Click Add lead", { wait: 900 });
    await s.type(FIELD("Name"), "Riya Malhotra", "Type the name");
    await s.type(FIELD("Phone"), "+91 98111 22334", "Type the phone. Duplicates are flagged straight away");
    await s.type(FIELD("Email"), "riya.m@example.com", "Email (optional)");
    await s.type(FIELD("Course"), "BBA", "Course they are interested in");
    await s.type(FIELD("City"), "Delhi", "City");
    await s.point(FIELD("Owner", "select"), "Leave Owner on Auto-assign, or pick a counsellor");
    await s.point("::-p-xpath(//div[@role='dialog']//button[normalize-space(.)='Add lead'])", "Click Add lead to save. A first follow-up is made for tomorrow", 2400);
    await s.end("The new lead appears at the top of the list");
  },

  "05-lead-details": async (s) => {
    await s.go("/crm/leads");
    await s.title("CRM", "Working a lead", "Call, WhatsApp, follow-up and the full history, all in one panel.");
    await s.click("::-p-xpath((//table//tbody//tr)[2])", "Click a lead to open it", { wait: 1800 });
    await s.point("::-p-xpath(//div[@role='dialog']//*[normalize-space(.)='Call' or normalize-space(.)='WhatsApp'][1]/..)", "Call, WhatsApp, Message, Follow-up, Register and Deal buttons");
    await s.point("::-p-xpath(//div[@role='dialog']//button[normalize-space(.)='Timeline'])", "Timeline: every call, message, note and status change");
    await s.click("::-p-xpath(//div[@role='dialog']//button[normalize-space(.)='Details'])", "Details: contact, course, source history, custom fields", { wait: 1000 });
    await s.click("::-p-xpath(//div[@role='dialog']//button[normalize-space(.)='Fees'])", "Fees: add a fee, take payment, share the pay link", { wait: 1000 });
    await s.click("::-p-xpath(//div[@role='dialog']//button[normalize-space(.)='Documents'])", "Documents: upload and view the lead's files", { wait: 1000 });
    await s.click("::-p-xpath(//div[@role='dialog']//button[normalize-space(.)='Timeline'])", "Back to the Timeline", { wait: 1000, after: 800 });
    await s.end("Close with × or Esc");
  },
};

async function page_escape(s) { await s.page.keyboard.press("Escape"); await sleep(500); }

if (process.argv[1].endsWith("scenes-crm.mjs")) {
  const only = process.argv.slice(2);
  const report = await runAll(scenes, only.length ? only : undefined);
  console.log(JSON.stringify(report, null, 1));
}
