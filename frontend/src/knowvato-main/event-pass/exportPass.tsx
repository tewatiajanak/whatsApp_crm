import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import PassRenderer from "./PassRenderer";
import { type PassContext, type PassDesign, type PassField, passValue } from "./schema";

/** QR images for every QR block of a design, for one pass ID. */
export async function buildQrUrls(design: PassDesign, passId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    design.blocks
      .filter((b) => b.type === "qr")
      .map(async (b) => {
        out[b.id] = await QRCode.toDataURL(passId || "PASS", {
          margin: 0,
          width: Math.max(240, (b.props.size || 130) * 3),
          errorCorrectionLevel: "M",
          color: { dark: /^#[0-9a-f]{6}$/i.test(b.props.color || "") ? b.props.color : "#000000", light: "#ffffff" },
        });
      })
  );
  return out;
}

let frame: HTMLIFrameElement | null = null;

/**
 * A blank document to draw passes in. The app's own stylesheets use colour
 * functions the image library cannot read, so the pass is rendered away from
 * them; the frame only loads the pass font.
 */
async function exportFrame(): Promise<Document> {
  if (!frame || !frame.contentDocument) {
    frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1400px;height:1400px;border:0;visibility:hidden";
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(
      '<!doctype html><html><head><meta charset="utf-8">' +
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap">' +
        '<style>html,body{margin:0;padding:0;background:transparent}</style></head><body></body></html>'
    );
    doc.close();
  }
  const doc = frame.contentDocument!;
  try {
    await (doc as any).fonts?.load("700 16px 'DM Sans'");
    await (doc as any).fonts?.ready;
  } catch {
    /* fall back to the system font */
  }
  return doc;
}

/**
 * html2canvas works out where a font's baseline is by measuring a tiny image
 * next to some text in THIS page. The app's CSS reset makes every image a
 * block, which throws that measurement off and draws all text too low. While an
 * export runs, let that one probe image sit inline again.
 */
async function withMetricFix<T>(run: () => Promise<T>): Promise<T> {
  const style = document.createElement("style");
  style.textContent =
    'body > div[style*="visibility: hidden"][style*="white-space: nowrap"] > img { display: inline !important; }' +
    'body > div[style*="visibility: hidden"][style*="white-space: nowrap"] { line-height: normal !important; }';
  document.head.appendChild(style);
  try {
    return await run();
  } finally {
    style.remove();
  }
}

const imagesLoaded = (root: HTMLElement) =>
  Promise.all(
    Array.from(root.querySelectorAll("img")).map((img) =>
      img.complete && img.naturalWidth ? Promise.resolve() : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); })
    )
  );

/** Render one pass to a canvas, `scale` times its on-screen size (3 ≈ print quality). */
export async function passToCanvas(design: PassDesign, ctx: PassContext, fields: PassField[], scale = 3): Promise<HTMLCanvasElement> {
  const doc = await exportFrame();
  const qrUrls = await buildQrUrls(design, passValue(ctx, "passId"));
  const host = doc.createElement("div");
  host.style.cssText = "display:inline-block;background:transparent";
  doc.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<PassRenderer design={design} ctx={ctx} qrUrls={qrUrls} fields={fields} />));
    await imagesLoaded(host);
    return await withMetricFix(() =>
      html2canvas(host.firstElementChild as HTMLElement, { scale, backgroundColor: null, useCORS: true, logging: false })
    );
  } finally {
    root.unmount();
    host.remove();
  }
}

export const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create the image"))), "image/png"));
