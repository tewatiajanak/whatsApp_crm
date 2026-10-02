// Time field in the app's own look: hour, minute and AM/PM are picked
// directly — no browser popup. The value in/out stays "HH:mm" (24-hour),
// exactly like <input type="time">, and onChange receives { target: { value } }.
const HOURS = ["12", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"];
const STEP_MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

const parse = (value) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(value || "");
  if (!m) return null;
  const h24 = Math.min(23, Number(m[1]));
  return { hour: String(h24 % 12 || 12).padStart(2, "0"), minute: m[2], pm: h24 >= 12 };
};
const build = ({ hour, minute, pm }) => {
  const h24 = (Number(hour) % 12) + (pm ? 12 : 0);
  return `${String(h24).padStart(2, "0")}:${minute}`;
};

export default function TimeInput({ value, onChange, disabled, allowEmpty = false, className = "" }) {
  const t = parse(value);
  const emit = (patch) => {
    // picking any part of an empty time starts from 9:00 AM
    const next = { ...(t || { hour: "09", minute: "00", pm: false }), ...patch };
    onChange?.({ target: { value: build(next) } });
  };
  // keep a minute that isn't on the 5-minute grid (e.g. 11:59) selectable
  const minutes = t && !STEP_MINUTES.includes(t.minute) ? [...STEP_MINUTES, t.minute].sort() : STEP_MINUTES;
  const select = { height: "var(--input-height, 34px)", padding: "0 6px", textAlign: "center", minWidth: 0 };
  const seg = (active) => ({
    height: "var(--input-height, 34px)",
    padding: "0 10px",
    border: 0,
    fontSize: 12,
    fontWeight: 600,
    background: active ? "var(--primary)" : "var(--card)",
    color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
    cursor: disabled ? "not-allowed" : "pointer",
  });

  return (
    <div className={`flex items-center gap-1.5 ${className}`} style={{ opacity: disabled ? 0.55 : 1 }}>
      <select className="ui-input flex-1" style={select} value={t?.hour || ""} disabled={disabled} onChange={(e) => emit({ hour: e.target.value })} aria-label="Hour">
        {!t && <option value="">HH</option>}
        {HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-muted-foreground" style={{ fontWeight: 600 }}>:</span>
      <select className="ui-input flex-1" style={select} value={t?.minute || ""} disabled={disabled} onChange={(e) => emit({ minute: e.target.value })} aria-label="Minute">
        {!t && <option value="">MM</option>}
        {minutes.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <div className="inline-flex shrink-0 overflow-hidden" style={{ border: "1px solid var(--border)", borderRadius: "var(--control-radius, 8px)" }}>
        <button type="button" disabled={disabled} style={seg(!!t && !t.pm)} onClick={() => emit({ pm: false })}>AM</button>
        <button type="button" disabled={disabled} style={seg(!!t && t.pm)} onClick={() => emit({ pm: true })}>PM</button>
      </div>
      {allowEmpty && t && !disabled && (
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon shrink-0" title="Clear time" onClick={() => onChange?.({ target: { value: "" } })}>
          <i className="bi bi-x-lg" style={{ fontSize: 11 }} />
        </button>
      )}
    </div>
  );
}
