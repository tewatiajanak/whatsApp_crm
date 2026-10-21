import { money } from "../lead/leadUtils";

// Same arithmetic as the server (routes/crmSales.ts › totals); the server's numbers are the ones saved.
export function lineAmount(i) {
  const gross = (Number(i.qty) || 0) * (Number(i.price) || 0);
  const taxable = gross - (gross * (Number(i.discountPct) || 0)) / 100;
  return Math.round((taxable + (taxable * (Number(i.taxPct) || 0)) / 100) * 100) / 100;
}
export function sumLines(items, adjustment = 0) {
  let subtotal = 0, discount = 0, tax = 0;
  for (const i of items) {
    const gross = (Number(i.qty) || 0) * (Number(i.price) || 0);
    const d = (gross * (Number(i.discountPct) || 0)) / 100;
    subtotal += gross; discount += d; tax += ((gross - d) * (Number(i.taxPct) || 0)) / 100;
  }
  const r = (n) => Math.round(n * 100) / 100;
  return { subtotal: r(subtotal), discount: r(discount), tax: r(tax), total: r(subtotal - discount + tax + (Number(adjustment) || 0)) };
}
export const blankLine = () => ({ product: "", name: "", description: "", qty: 1, unit: "Nos", price: 0, discountPct: 0, taxPct: 0 });

export default function LineItems({ items, setItems, products = [], readOnly }) {
  const set = (i, patch) => setItems(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const pick = (i, id) => {
    const p = products.find((x) => x._id === id);
    set(i, p ? { product: p._id, name: p.name, unit: p.unit || "Nos", price: p.price, taxPct: p.taxPercent, description: p.description || "" } : { product: "" });
  };
  const cell = "ui-input w-full";
  return (
    <div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="rounded-lg border p-2">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-12 sm:col-span-5">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Item *</label>
                {products.length > 0 && !readOnly && (
                  <select className={cell + " mb-1"} aria-label="Product" value={it.product ? String(it.product._id || it.product) : ""} onChange={(e) => pick(i, e.target.value)}>
                    <option value="">Type below or pick a product</option>
                    {products.filter((p) => p.active || String(p._id) === String(it.product)).map((p) => <option key={p._id} value={p._id}>{p.name}{p.sku ? ` · ${p.sku}` : ""}</option>)}
                  </select>
                )}
                <input className={cell} aria-label="Item name" readOnly={readOnly} value={it.name} onChange={(e) => set(i, { name: e.target.value })} />
              </div>
              <div className="col-span-3 sm:col-span-1"><label className="text-[10px] uppercase tracking-wider text-muted-foreground">Qty</label><input type="number" min="0" step="any" className={cell} readOnly={readOnly} value={it.qty} onChange={(e) => set(i, { qty: e.target.value })} /></div>
              <div className="col-span-4 sm:col-span-2"><label className="text-[10px] uppercase tracking-wider text-muted-foreground">Price</label><input type="number" min="0" step="any" className={cell} readOnly={readOnly} value={it.price} onChange={(e) => set(i, { price: e.target.value })} /></div>
              <div className="col-span-2 sm:col-span-1"><label className="text-[10px] uppercase tracking-wider text-muted-foreground">Disc %</label><input type="number" min="0" max="100" className={cell} readOnly={readOnly} value={it.discountPct} onChange={(e) => set(i, { discountPct: e.target.value })} /></div>
              <div className="col-span-3 sm:col-span-1"><label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tax %</label><input type="number" min="0" max="100" className={cell} readOnly={readOnly} value={it.taxPct} onChange={(e) => set(i, { taxPct: e.target.value })} /></div>
              <div className="col-span-10 sm:col-span-1 flex flex-col justify-end"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</div><div className="text-sm font-semibold text-foreground py-1.5">{money(lineAmount(it))}</div></div>
              {!readOnly && <div className="col-span-2 sm:col-span-1 flex items-end justify-end"><button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Remove line" onClick={() => setItems(items.filter((_, k) => k !== i))}><i className="bi bi-trash"></i></button></div>}
            </div>
          </div>
        ))}
      </div>
      {!readOnly && <button type="button" className="ui-btn ui-btn-outline ui-btn-sm mt-2" onClick={() => setItems([...items, blankLine()])}><i className="bi bi-plus-lg"></i>Add line</button>}
    </div>
  );
}

export function Totals({ items, adjustment = 0, adjustmentLabel }) {
  const t = sumLines(items, adjustment);
  const row = (l, v, strong) => <div className={"flex justify-between gap-4 " + (strong ? "text-base font-semibold text-foreground border-t pt-1.5 mt-1" : "text-sm text-muted-foreground")}><span>{l}</span><span className={strong ? "" : "text-foreground"}>{v}</span></div>;
  return (
    <div className="ms-auto" style={{ maxWidth: 300 }}>
      {row("Subtotal", money(t.subtotal))}
      {t.discount > 0 && row("Discount", `− ${money(t.discount)}`)}
      {row("Tax", money(t.tax))}
      {Number(adjustment) !== 0 && row(adjustmentLabel || "Adjustment", `${Number(adjustment) < 0 ? "− " : ""}${money(Math.abs(Number(adjustment)))}`)}
      {row("Total", money(t.total), true)}
    </div>
  );
}
