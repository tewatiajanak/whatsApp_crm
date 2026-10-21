// Training GIF recorder: drives the app in headless Chrome, captions each step, highlights what is clicked,
// and stitches the screenshots into one GIF per feature with ffmpeg.
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

export const APP = "http://localhost:5173";
export const API = "http://localhost:4001/api";
const FFMPEG = path.join(path.dirname(new URL(import.meta.url).pathname), "node_modules/ffmpeg-static/ffmpeg");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WORK = path.join(path.dirname(new URL(import.meta.url).pathname), "frames");
export const OUT = process.env.OUT || "/Users/edunextion/Downloads/whatsApp CRM/docs/training";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let cachedToken = "";
export async function apiLogin(fresh = false) {
  if (cachedToken && !fresh) return cachedToken;
  for (let i = 0; i < 8; i++) {
    const r = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "priya@greenwood.edu", password: "password123" }) });
    if (r.ok) { cachedToken = (await r.json()).data.token; return cachedToken; }
    // the API allows 600 requests a minute; wait it out
    await sleep(15000);
  }
  throw new Error("Could not sign in");
}
export async function api(token, method, url, body) {
  const r = await fetch(API + url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  return r.json().catch(() => ({}));
}

const OVERLAY_CSS = `
#__cap{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483647;max-width:86%;display:flex;align-items:center;gap:12px;
  background:rgba(15,23,42,.92);color:#fff;font:600 17px/1.35 -apple-system,Segoe UI,sans-serif;padding:12px 20px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
#__cap b{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;border-radius:50%;background:#14b8a6;font-size:14px}
#__ring{position:fixed;z-index:2147483646;border:3px solid #f97316;border-radius:10px;box-shadow:0 0 0 6px rgba(249,115,22,.25);pointer-events:none;transition:none}
#__dot{position:fixed;z-index:2147483647;width:22px;height:22px;border-radius:50%;background:rgba(249,115,22,.9);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none;transform:translate(-50%,-50%)}
#__title{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:linear-gradient(135deg,#0f766e,#134e4a);color:#fff;font-family:-apple-system,Segoe UI,sans-serif;text-align:center;padding:40px}
#__title .m{font:600 16px/1 inherit;letter-spacing:.12em;text-transform:uppercase;opacity:.75}
#__title .t{font:700 46px/1.15 inherit}
#__title .s{font:400 21px/1.4 inherit;opacity:.9;max-width:820px}
.ai-copilot-fab,[class*="copilot"] button[aria-label="Ask"]{display:none!important}`;

export class Scene {
  constructor(page, name) { this.page = page; this.name = name; this.frames = []; this.n = 0; this.dir = path.join(WORK, name); fs.rmSync(this.dir, { recursive: true, force: true }); fs.mkdirSync(this.dir, { recursive: true }); }
  async prep() {
    await this.page.evaluate((css) => {
      if (!document.getElementById("__css")) { const s = document.createElement("style"); s.id = "__css"; s.textContent = css; document.head.appendChild(s); }
      // the floating Ask button is not part of the lesson
      document.querySelectorAll("button").forEach((b) => { if (b.textContent.trim() === "Ask" && getComputedStyle(b).position === "fixed") b.style.display = "none"; });
      document.querySelectorAll("*").forEach((el) => { if (el.textContent?.trim() === "Ask" && getComputedStyle(el).position === "fixed") el.style.display = "none"; });
    }, OVERLAY_CSS);
  }
  async shot(holdMs = 1200) {
    await this.prep();
    const file = path.join(this.dir, `${String(this.frames.length).padStart(3, "0")}.png`);
    await this.page.screenshot({ path: file });
    this.frames.push({ file, ms: holdMs });
  }
  async title(module, title, sub) {
    await this.prep();
    await this.page.evaluate((m, t, s) => { const d = document.createElement("div"); d.id = "__title"; d.innerHTML = `<div class="m"></div><div class="t"></div><div class="s"></div>`; d.querySelector(".m").textContent = m; d.querySelector(".t").textContent = t; d.querySelector(".s").textContent = s; document.body.appendChild(d); }, module, title, sub);
    await this.shot(2600);
    await this.page.evaluate(() => document.getElementById("__title")?.remove());
  }
  async cap(text) {
    this.n += 1;
    await this.page.evaluate((t, n) => { let c = document.getElementById("__cap"); if (!c) { c = document.createElement("div"); c.id = "__cap"; document.body.appendChild(c); } c.innerHTML = `<b></b><span></span>`; c.querySelector("b").textContent = n; c.querySelector("span").textContent = t; }, text, this.n);
  }
  async clearMarks() { await this.page.evaluate(() => { document.getElementById("__ring")?.remove(); document.getElementById("__dot")?.remove(); }); }
  async find(sel, timeout = 8000) {
    const el = await this.page.waitForSelector(sel, { visible: true, timeout });
    await el.evaluate((e) => e.scrollIntoView({ block: "center", inline: "nearest" }));
    await sleep(250);
    return el;
  }
  async mark(el, dot = true) {
    const box = await el.boundingBox();
    if (!box) return;
    await this.page.evaluate((b, dot) => {
      let r = document.getElementById("__ring"); if (!r) { r = document.createElement("div"); r.id = "__ring"; document.body.appendChild(r); }
      Object.assign(r.style, { left: `${b.x - 6}px`, top: `${b.y - 6}px`, width: `${b.width + 12}px`, height: `${b.height + 12}px` });
      document.getElementById("__dot")?.remove();
      if (dot) { const d = document.createElement("div"); d.id = "__dot"; Object.assign(d.style, { left: `${b.x + b.width / 2}px`, top: `${b.y + b.height / 2}px` }); document.body.appendChild(d); }
    }, box, dot);
  }
  /** caption, point at it, click, show the result */
  async click(sel, text, { wait = 900, hold = 1600, after = 1400 } = {}) {
    if (text) await this.cap(text);
    const el = await this.find(sel);
    await this.mark(el);
    await this.shot(hold);
    await this.clearMarks();
    await el.click();
    await sleep(wait);
    if (after) await this.shot(after);
  }
  /** caption and highlight without clicking */
  async point(sel, text, hold = 2200) {
    if (text) await this.cap(text);
    const el = await this.find(sel);
    await this.mark(el, false);
    await this.shot(hold);
    await this.clearMarks();
  }
  async type(sel, value, text, { hold = 1400, clear = true } = {}) {
    if (text) await this.cap(text);
    const el = await this.find(sel);
    await this.mark(el, false);
    await el.click({ clickCount: 3 });
    if (clear) await this.page.keyboard.press("Backspace");
    // a few frames while typing
    const parts = Math.min(3, Math.max(1, Math.ceil(value.length / 8)));
    const size = Math.ceil(value.length / parts);
    for (let i = 0; i < parts; i++) { await el.type(value.slice(i * size, (i + 1) * size), { delay: 10 }); await this.shot(i === parts - 1 ? hold : 350); }
    await this.clearMarks();
  }
  async select(sel, value, text, hold = 1500) {
    if (text) await this.cap(text);
    const el = await this.find(sel);
    await this.mark(el, false);
    await this.shot(900);
    await this.page.select(sel, value);
    await sleep(500);
    await this.shot(hold);
    await this.clearMarks();
  }
  async go(url, text, hold = 1800) {
    for (let i = 0; i < 4; i++) {
      await this.page.goto(APP + url, { waitUntil: "networkidle2" });
      await sleep(1200);
      if (url === "/login" || !this.page.url().includes("/login")) break;
      // signed out (rate limit or an expired session): wait, sign in again, retry
      await sleep(20000);
      await signIn(this.page, await apiLogin(true));
    }
    if (text) { await this.cap(text); await this.shot(hold); }
  }
  async scroll(y, text, hold = 1800) {
    if (text) await this.cap(text);
    await this.page.evaluate((y) => { const m = document.querySelector("main") || document.scrollingElement; (document.querySelector("[data-scroll-root]") || m).scrollBy({ top: y }); window.scrollBy({ top: y }); }, y);
    await sleep(500);
    await this.shot(hold);
  }
  async end(text = "That's it!") { await this.cap(text); await this.shot(2200); }

  /** frames → GIF (two-pass palette keeps the UI colours crisp) */
  render() {
    fs.mkdirSync(OUT, { recursive: true });
    const list = this.frames.map((f) => `file '${f.file}'\nduration ${(f.ms / 1000).toFixed(2)}`).join("\n") + `\nfile '${this.frames[this.frames.length - 1].file}'\n`;
    const listFile = path.join(this.dir, "list.txt");
    fs.writeFileSync(listFile, list);
    const gif = path.join(OUT, `${this.name}.gif`);
    const vf = "fps=8,scale=1100:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle";
    execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listFile, "-vf", vf, "-loop", "0", gif]);
    return { gif, frames: this.frames.length, seconds: Math.round(this.frames.reduce((a, f) => a + f.ms, 0) / 1000), kb: Math.round(fs.statSync(gif).size / 1024) };
  }
}

export async function launch() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 1280, height: 760, deviceScaleFactor: 1 }, args: ["--hide-scrollbars"] });
  const page = await browser.newPage();
  // "leave this page?" and other prompts must never block the recording
  page.on("dialog", (d) => d.accept().catch(() => undefined));
  return { browser, page };
}
export async function signIn(page, token) {
  await page.goto(APP + "/login", { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => localStorage.setItem("wacrm_token", t), token);
}

/** run scenes by name; one failing scene never stops the others */
export async function runAll(scenes, only) {
  const token = await apiLogin();
  const { browser, page } = await launch();
  const report = [];
  for (const [name, fn] of Object.entries(scenes)) {
    if (only && !only.includes(name)) continue;
    const s = new Scene(page, name);
    try {
      // a new sign-in ends the previous session, so every scene signs in afresh
      const t = await apiLogin();
      await signIn(page, t);
      await fn(s, { token: t, page });
      report.push({ name, ...s.render() });
    } catch (e) {
      report.push({ name, error: String(e.message).split("\n")[0], frames: s.frames.length });
      try { if (s.frames.length > 2) report.at(-1).partial = s.render(); } catch { /* nothing to save */ }
      await page.screenshot({ path: path.join(WORK, `${name}-FAILED.png`) }).catch(() => undefined);
    }
    await page.keyboard.press("Escape").catch(() => undefined);
  }
  await browser.close();
  return report;
}
