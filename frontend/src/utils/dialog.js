// Themed replacements for the browser's confirm() and alert(), usable from any
// code (not just React components). Both draw with the app's own colours.

function el(tag, css, text) {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (text !== undefined) e.textContent = text;
  return e;
}

const BTN = "height:34px;padding:0 14px;border-radius:8px;font:600 12.5px 'DM Sans','Segoe UI',sans-serif;cursor:pointer;";

/** Ask a yes/no question. Resolves true when confirmed. */
export function askConfirm(text, { confirmLabel = "Delete", danger = true } = {}) {
  return new Promise((resolve) => {
    const back = el("div", "position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:16px");
    const box = el("div", "width:100%;max-width:380px;background:var(--card,#fff);color:var(--foreground,#111);border:1px solid var(--border,#e5e7eb);border-radius:14px;padding:16px;box-shadow:0 20px 50px rgba(0,0,0,.25)");
    const msg = el("div", "font:600 14px 'DM Sans','Segoe UI',sans-serif;white-space:pre-wrap", String(text));
    const row = el("div", "display:flex;justify-content:flex-end;gap:8px;margin-top:16px");
    const no = el("button", `${BTN}background:var(--card,#fff);color:var(--foreground,#111);border:1px solid var(--border,#e5e7eb)`, "Cancel");
    const yes = el("button", `${BTN}background:var(--${danger ? "destructive" : "primary"},#2249b7);color:#fff;border:1px solid transparent`, confirmLabel);
    const done = (answer) => { document.removeEventListener("keydown", onKey); back.remove(); resolve(answer); };
    const onKey = (e) => { if (e.key === "Escape") done(false); };
    no.onclick = () => done(false);
    yes.onclick = () => done(true);
    back.onclick = (e) => { if (e.target === back) done(false); };
    document.addEventListener("keydown", onKey);
    row.append(no, yes);
    box.append(msg, row);
    back.append(box);
    document.body.append(back);
    yes.focus();
  });
}

/** Show a short message that goes away by itself. */
export function showNotice(text, type = "info") {
  const colour = type === "error" ? "var(--destructive,#e62b34)" : "var(--foreground,#111)";
  const note = el("div", `position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2000;max-width:calc(100vw - 32px);background:${colour};color:#fff;border-radius:10px;padding:10px 16px;font:500 13px 'DM Sans','Segoe UI',sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);white-space:pre-wrap`, String(text));
  document.body.append(note);
  setTimeout(() => note.remove(), 4000);
}
