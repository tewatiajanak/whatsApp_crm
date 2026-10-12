// Real PDF files for the documents a lead keeps: fee invoice / receipt, and offer letter.
// jsPDF is loaded only when a PDF is actually asked for.

const rupees = (n) => "Rs. " + new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
const day = (d) => { if (!d) return ""; const x = new Date(d); return `${String(x.getDate()).padStart(2, "0")}-${String(x.getMonth() + 1).padStart(2, "0")}-${x.getFullYear()}`; };

async function sheet() {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;
  const text = (t, x, opts = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size || 10);
    doc.setTextColor(opts.muted ? 110 : 20);
    doc.text(String(t ?? ""), x, y, { align: opts.align || "left", maxWidth: opts.maxWidth });
  };
  const line = () => { doc.setDrawColor(215); doc.line(M, y, W - M, y); };
  // start a new page when the next block would run off the bottom
  const room = (need) => { if (y + need > H - M) { doc.addPage(); y = M; } };
  const para = (t, opts = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size || 10);
    for (const l of doc.splitTextToSize(String(t ?? ""), W - 2 * M)) { room(16); text(l, M, opts); y += (opts.size || 10) + 5; }
  };
  return { doc, W, M, text, line, room, para, get y() { return y; }, set y(v) { y = v; } };
}

/** Tax invoice once the fee is fully paid, otherwise a receipt for what has come in. */
export async function downloadFeePdf(f) {
  const s = await sheet();
  const paid = f.status === "paid";
  s.text(f.organisation || "Receipt", s.M, { bold: true, size: 16 });
  s.text(paid && f.invoiceNo ? "TAX INVOICE" : "RECEIPT", s.W - s.M, { bold: true, size: 12, align: "right" });
  s.y += 16;
  for (const l of String(f.billing?.address || "").split("\n").filter(Boolean)) { s.text(l, s.M, { muted: true }); s.y += 13; }
  if (f.billing?.gstin) { s.text(`GSTIN ${f.billing.gstin}`, s.M, { muted: true }); s.y += 13; }
  s.y += 8; s.line(); s.y += 22;

  s.text("Billed to", s.M, { muted: true });
  s.text(paid && f.invoiceNo ? "Invoice no." : "Receipt no.", s.W - s.M - 150, { muted: true });
  s.y += 14;
  s.text(f.name, s.M, { bold: true, size: 11 });
  s.text((paid && f.invoiceNo) || f.receiptNo || "-", s.W - s.M - 150, { bold: true, size: 11 });
  s.y += 14;
  s.text("Date", s.W - s.M - 150, { muted: true });
  s.y += 14;
  s.text(day(f.paidAt || f.payments?.[f.payments.length - 1]?.at || new Date()), s.W - s.M - 150);
  s.y += 26; s.line(); s.y += 18;

  s.text("Description", s.M, { bold: true });
  s.text("Amount", s.W - s.M, { bold: true, align: "right" });
  s.y += 10; s.line(); s.y += 18;
  s.text(f.title, s.M, { maxWidth: s.W - 2 * s.M - 130 });
  s.text(rupees(f.amount), s.W - s.M, { align: "right" });
  s.y += 18;
  if (f.discount > 0) { s.text("Concession", s.M, { muted: true }); s.text(`- ${rupees(f.discount)}`, s.W - s.M, { align: "right" }); s.y += 18; }
  if (f.billing?.gst > 0) {
    s.text("Taxable value", s.M, { muted: true }); s.text(rupees(f.billing.taxable), s.W - s.M, { align: "right" }); s.y += 16;
    s.text(`GST ${f.billing.gstPercent}%`, s.M, { muted: true }); s.text(rupees(f.billing.gst), s.W - s.M, { align: "right" }); s.y += 16;
  }
  s.line(); s.y += 18;
  s.text("Total", s.M, { bold: true, size: 11 });
  s.text(rupees(f.amount - (f.discount || 0)), s.W - s.M, { bold: true, size: 11, align: "right" });
  s.y += 30;

  if ((f.payments || []).length) {
    s.text("Payments received", s.M, { bold: true }); s.y += 10; s.line(); s.y += 16;
    for (const p of f.payments) {
      s.room(16);
      s.text(`${day(p.at)}   ${p.mode}   ${p.receiptNo}`, s.M, { muted: true });
      s.text(rupees(p.amount), s.W - s.M, { align: "right" });
      s.y += 16;
    }
    s.y += 6;
  }
  s.text(paid ? "Paid in full" : `Balance due: ${rupees(f.balance)}`, s.M, { bold: true, size: 11 });
  s.y += 40;
  s.text("This is a computer-generated document and needs no signature.", s.M, { muted: true, size: 8 });
  s.doc.save(`${paid && f.invoiceNo ? f.invoiceNo : f.receiptNo || "receipt"}.pdf`);
}

/** The offer letter, with the acceptance record once the applicant has answered. */
export async function downloadOfferPdf(a) {
  const s = await sheet();
  s.text(a.organisation || "Offer of admission", s.M, { bold: true, size: 16 });
  s.y += 22; s.line(); s.y += 24;
  s.text("OFFER OF ADMISSION", s.M, { bold: true, size: 12 });
  s.text(`Application ${a.appNo}`, s.W - s.M, { muted: true, align: "right" });
  s.y += 18;
  s.text(day(a.offer.sentAt), s.M, { muted: true });
  s.y += 26;
  s.para(a.offer.text, { size: 11 });
  s.y += 10;
  if (a.offer.amount > 0) s.para(`Amount to confirm the seat: ${rupees(a.offer.amount)}`, { bold: true });
  if (a.offer.validTill) s.para(`This offer is valid till ${day(a.offer.validTill)}.`);
  if (a.offer.response) {
    s.y += 18; s.room(60); s.line(); s.y += 20;
    s.para(`Offer ${a.offer.response}${a.offer.signedBy ? ` by ${a.offer.signedBy}` : ""} on ${day(a.offer.respondedAt)}.`, { bold: true });
    s.para("Accepted electronically by typing the applicant's name.", { size: 8 });
  }
  s.doc.save(`offer-${a.appNo}.pdf`);
}
