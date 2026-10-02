import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import QRCodeStyling from "qr-code-styling";
import { toast } from "react-toastify";
import { useParams, useNavigate } from "../lib/router-shim";
import { useEventData } from "../context/EventDataContext";
import PassPreviewModal from "../../event-pass/PassPreviewModal";

// ── Themed building blocks (match the app-wide UI kit) ────────────────────────

const LABEL_CLS = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";
const TH_CLS = "px-4 py-3 text-left font-medium";

const ModalShell = ({ title, onClose, onBack, maxWidth = 560, children }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4"
    style={{ background: "rgba(15, 23, 42, 0.45)" }}
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <div className="w-full rounded-xl border bg-card shadow-lg flex flex-col" style={{ maxWidth, maxHeight: "90vh" }}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" onClick={onBack} title="Back">
              <i className="bi bi-arrow-left" />
            </button>
          )}
          <div className="text-sm font-semibold text-foreground truncate">{title}</div>
        </div>
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" onClick={onClose} title="Close">
          <i className="bi bi-x-lg" />
        </button>
      </div>
      <div className="p-4 overflow-y-auto">{children}</div>
    </div>
  </div>
);

// ── Country codes & phone helpers ─────────────────────────────────────────────

const COUNTRY_CODES = [
  { code: "+91",  country: "India",        digits: 10 },
  { code: "+1",   country: "USA / Canada", digits: 10 },
  { code: "+44",  country: "UK",           digits: 10 },
  { code: "+971", country: "UAE",          digits: 9  },
  { code: "+65",  country: "Singapore",    digits: 8  },
  { code: "+60",  country: "Malaysia",     digits: 9  },
  { code: "+61",  country: "Australia",    digits: 9  },
  { code: "+49",  country: "Germany",      digits: 11 },
  { code: "+33",  country: "France",       digits: 9  },
  { code: "+86",  country: "China",        digits: 11 },
];

// Parse a stored phone string into { code, number }
const parsePhoneValue = (fullPhone) => {
  if (!fullPhone) return { code: "+91", number: "" };
  const s = fullPhone.toString().trim();
  for (const cc of COUNTRY_CODES) {
    if (s.startsWith(cc.code + " ")) return { code: cc.code, number: s.slice(cc.code.length + 1) };
    if (s.startsWith(cc.code))       return { code: cc.code, number: s.slice(cc.code.length) };
  }
  // "919876543210" style (no +)
  const allDigits = s.replace(/\D/g, "");
  for (const cc of COUNTRY_CODES) {
    const codeDigits = cc.code.slice(1);
    if (allDigits.startsWith(codeDigits) && allDigits.length === codeDigits.length + cc.digits)
      return { code: cc.code, number: allDigits.slice(codeDigits.length) };
  }
  return { code: "+91", number: allDigits };
};

// Validation helpers ──────────────────────────────────────────────────────────

const validatePhone = (v) => {
  if (!v) return true;
  const digits = v.toString().replace(/[\s\-\(\)\.\+]/g, "");
  // Accept 10 digits (plain mobile) or 12 digits (country code + 10, e.g. 91XXXXXXXXXX)
  return /^\d{10}$/.test(digits) || /^\d{12}$/.test(digits);
};

// ── PhoneInput component ──────────────────────────────────────────────────────

const PhoneInput = ({ value, onChange, isInvalid }) => {
  const parsed = useMemo(() => parsePhoneValue(value), [value]);
  const [code, setCode] = useState(parsed.code);
  const [number, setNumber] = useState(parsed.number);

  useEffect(() => {
    setCode(parsed.code);
    setNumber(parsed.number);
  }, [parsed.code, parsed.number]);

  const maxDigits = COUNTRY_CODES.find((c) => c.code === code)?.digits || 10;

  const handleCode = (e) => {
    const newCode = e.target.value;
    setCode(newCode);
    onChange(number ? `${newCode} ${number}` : "");
  };

  const handleNumber = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, maxDigits);
    setNumber(digits);
    onChange(digits ? `${code} ${digits}` : "");
  };

  return (
    <div className="flex gap-2">
      <select
        className="ui-input shrink-0"
        style={{ width: 84, padding: "0 8px", borderColor: isInvalid ? "var(--destructive)" : undefined }}
        value={code}
        onChange={handleCode}
      >
        {COUNTRY_CODES.map((cc) => (
          <option key={cc.code} value={cc.code}>{cc.code}</option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="numeric"
        className="ui-input flex-1 min-w-0"
        style={{ borderColor: isInvalid ? "var(--destructive)" : undefined }}
        placeholder={`${maxDigits} digits`}
        maxLength={maxDigits}
        value={number}
        onChange={handleNumber}
      />
    </div>
  );
};

const validateEmail = (v) => {
  if (!v) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.toString());
};

const normalizeKey = (k) =>
  k
    ?.toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "";

const getCol = (row, ...keys) => {
  const norm = {};
  Object.entries(row).forEach(([k, v]) => { norm[normalizeKey(k)] = v; });
  for (const key of keys) {
    const nk = normalizeKey(key);
    if (norm[nk] != null && norm[nk] !== "") return norm[nk].toString().trim();
  }
  return "";
};

// Finds a phone value from any column whose header contains "phone" or "mobile"
const getPhoneCol = (row) => {
  const norm = {};
  Object.entries(row).forEach(([k, v]) => { norm[normalizeKey(k)] = v; });
  // Exact keys first
  const exactKeys = ["phone", "mobile", "phonenumber", "mobilenumber",
    "mobileno", "phoneno", "contactnumber", "mobilephone", "cellnumber", "mob"];
  for (const k of exactKeys) {
    if (norm[k] != null && norm[k] !== "") return norm[k].toString().trim();
  }
  // Fuzzy: any key that contains "phone" or "mobile"
  for (const [k, v] of Object.entries(norm)) {
    if ((k.includes("phone") || k.includes("mobile")) && v != null && v !== "") {
      return v.toString().trim();
    }
  }
  return "";
};

const DEFAULT_CATEGORIES = [
  { name: "VIP", color: "var(--warning)" },
  { name: "General", color: "var(--info)" },
  { name: "Staff", color: "var(--success)" },
  { name: "Speaker", color: "#8B5CF6" },
  { name: "Press", color: "#EF4444" },
];

// ── Import Modal ──────────────────────────────────────────────────────────────

const ImportModal = ({ eventId, event, existingAttendees, onClose, onImported }) => {
  const fileRef = useRef(null);
  const [step, setStep] = useState("main");
  const [validRows, setValidRows] = useState([]);
  const [invalidRows, setInvalidRows] = useState([]);
  const [dupRows, setDupRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [allowDuplicates, setAllowDuplicates] = useState(true);
  const [importedCount, setImportedCount] = useState(0);

  // Active categories and custom fields from this event
  const activeCats = (event?.categories || []).filter((c) => c.enabled === true);
  const catNames = activeCats.map((c) => c.label);

  // Normalized labels of the fixed columns — skip any user field that duplicates them
  const FIXED_NORMALIZED = new Set([
    "name", "fullname", "attendee",
    "phone", "mobile", "phonenumber", "mobilenumber",
    "email", "emailid", "emailaddress",
    "category", "type", "group",
    "organization", "company", "org",
  ]);
  const customFields = (event?.attendeeFields || []).filter((f) => {
    const key = normalizeKey(f.label);
    return f.enabled !== false && !FIXED_NORMALIZED.has(key);
  });

  const downloadFormat = () => {
    const allFields = event?.attendeeFields || [];
    const hasMobile = allFields.find((f) => f.fieldId === "mobile")?.enabled !== false;
    const hasEmail = allFields.find((f) => f.fieldId === "email")?.enabled !== false;
    const hasCat = activeCats.length > 0;
    const hasOrg = allFields.some((f) => normalizeKey(f.label) === "organization" && f.enabled === true);

    // Build headers dynamically — only enabled fields
    const headers = ["Name*"];
    if (hasMobile) headers.push("Phone");
    if (hasEmail) headers.push("Email");
    if (hasCat) headers.push("Category");
    if (hasOrg) headers.push("Organization");
    customFields.forEach((f) => headers.push(f.required ? `${f.label}*` : f.label));

    // Example rows — include only enabled columns
    const cat1 = catNames[0] || "";
    const cat2 = catNames[1] || catNames[0] || "";
    const ex1 = ["Ravi Kumar"];
    const ex2 = ["Priya Singh"];
    if (hasMobile) { ex1.push("9876543210"); ex2.push("918527270287"); }
    if (hasEmail) { ex1.push("ravi@example.com"); ex2.push("priya@example.com"); }
    if (hasCat) { ex1.push(cat1); ex2.push(cat2); }
    if (hasOrg) { ex1.push("Infosys"); ex2.push("TCS"); }
    customFields.forEach((f) => { ex1.push(f.options?.[0] || ""); ex2.push(""); });
    const examples = [ex1, ex2];

    // Category reference sheet from event categories
    const catRows = activeCats.length > 0
      ? activeCats.map((c) => [c.label, c.color])
      : DEFAULT_CATEGORIES.map((c) => [c.name, c.color]);

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet([headers, ...examples]);
    ws1["!cols"] = headers.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws1, "Attendees");
    const ws2 = XLSX.utils.aoa_to_sheet([["Category", "Color"], ...catRows]);
    ws2["!cols"] = [{ wch: 16 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Categories");
    XLSX.writeFile(wb, "attendees_template.xlsx");
    toast.success("Template downloaded.");
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext)) {
      toast.error("Please upload an Excel or CSV file.");
      e.target.value = "";
      return;
    }
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target.result), {
          type: "array",
        });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const existPhones = new Set(
          existingAttendees
            .map((a) => a.phone?.replace(/\D/g, ""))
            .filter(Boolean),
        );
        const existEmails = new Set(
          existingAttendees.map((a) => a.email?.toLowerCase()).filter(Boolean),
        );
        const seenPhones = new Set(),
          seenEmails = new Set();
        const valid = [],
          invalid = [],
          dup = [];

        json.forEach((row, i) => {
          const name = getCol(row, "name", "full name", "fullname", "attendee");
          const phone = getPhoneCol(row);
          const email = getCol(row, "email", "emailid", "emailaddress");
          const category = getCol(row, "category", "type", "group");
          const organization = getCol(row, "organization", "company", "org");

          // Extract values for each enabled custom field
          const customValues = {};
          customFields.forEach((f) => {
            customValues[f.label] = getCol(row, f.label);
          });

          const errors = [];
          if (!name) errors.push("Name required");

          // Phone: blank is OK; if provided must match country code + correct digit count
          if (phone && !validatePhone(phone)) errors.push("Invalid phone — enter 10 digits (e.g. 9876543210) or 12 digits with country code (e.g. 919876543210)");

          // Email: blank is OK; if provided must match email format
          if (email && !validateEmail(email)) errors.push("Invalid email address");

          // Category: blank is OK; if provided must be one of the event's categories
          if (category && catNames.length > 0) {
            const catMatch = catNames.some(
              (c) => c.toLowerCase() === category.toLowerCase()
            );
            if (!catMatch) errors.push(`Invalid category "${category}" — use values from Categories sheet`);
          }

          // Validate required custom fields
          customFields.filter((f) => f.required).forEach((f) => {
            if (!customValues[f.label]) errors.push(`${f.label} required`);
          });

          const phoneKey = phone.replace(/\D/g, "");
          const emailKey = email.toLowerCase();

          if (phoneKey && seenPhones.has(phoneKey))
            errors.push("Duplicate phone in file");
          else if (phoneKey) seenPhones.add(phoneKey);
          if (emailKey && seenEmails.has(emailKey))
            errors.push("Duplicate email in file");
          else if (emailKey) seenEmails.add(emailKey);
          if (phoneKey && existPhones.has(phoneKey))
            errors.push("Phone already exists");
          if (emailKey && existEmails.has(emailKey))
            errors.push("Email already exists");

          const record = {
            row: i + 2,
            name,
            phone,
            email,
            category,
            organization,
            customValues,
            errors,
          };
          if (
            errors.some(
              (e) => e.includes("Duplicate") || e.includes("already exists"),
            )
          )
            dup.push(record);
          else if (errors.length > 0) invalid.push(record);
          else valid.push(record);
        });

        setValidRows(valid);
        setInvalidRows(invalid);
        setDupRows(dup);
        setStep("validate");
      } catch {
        toast.error("Failed to parse file.");
      }
      e.target.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirm = () => {
    setImporting(true);
    const toImport = allowDuplicates ? [...validRows, ...dupRows] : validRows;
    const rows = toImport.map(({ name, phone, email, category, organization, customValues }) => ({
      name,
      phone,
      email,
      category,
      organization,
      ...(customValues || {}),
    }));
    setImportedCount(rows.length);
    onImported(rows);
    setStep("success");
    setImporting(false);
  };

  const importCount = allowDuplicates ? validRows.length + dupRows.length : validRows.length;

  return (
    <ModalShell
      title={step === "main" ? "Import Registrants" : step === "validate" ? "Validation Results" : "Import Complete"}
      onClose={onClose}
      onBack={step === "validate" ? () => setStep("main") : undefined}
    >
      {step === "main" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            className="rounded-xl border bg-card p-4 text-center hover:bg-accent transition-colors"
            onClick={downloadFormat}
          >
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg mb-2"
              style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}
            >
              <i className="bi bi-download" style={{ fontSize: 18 }} />
            </span>
            <div className="text-sm font-semibold text-foreground">Download Format</div>
          </button>
          <button
            type="button"
            className="rounded-xl border bg-card p-4 text-center hover:bg-accent transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg mb-2"
              style={{ background: "var(--success-bg)", color: "var(--success)" }}
            >
              <i className="bi bi-upload" style={{ fontSize: 18 }} />
            </span>
            <div className="text-sm font-semibold text-foreground">Import Data</div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: "none" }}
              onChange={handleFile}
            />
          </button>
        </div>
      )}

      {step === "validate" && (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            File: <span className="font-semibold text-foreground">{fileName}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
              <i className="bi bi-check" /> {validRows.length} Valid
            </span>
            {invalidRows.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium" style={{ background: "var(--destructive-bg)", color: "var(--destructive)" }}>
                <i className="bi bi-x" /> {invalidRows.length} Invalid
              </span>
            )}
            {dupRows.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
                <i className="bi bi-exclamation-triangle" /> {dupRows.length} Duplicate
              </span>
            )}
          </div>
          {(invalidRows.length > 0 || dupRows.length > 0) && (
            <div className="rounded-lg border overflow-hidden">
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                      <th className="px-3 py-2 text-left font-medium" style={{ width: 56 }}>Row</th>
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...invalidRows, ...dupRows].map((r) => (
                      <tr key={r.row} className="border-t">
                        <td className="px-3 py-1.5">{r.row}</td>
                        <td className="px-3 py-1.5">{r.name || "—"}</td>
                        <td
                          className="px-3 py-1.5"
                          style={{ color: dupRows.includes(r) ? "var(--warning)" : "var(--destructive)" }}
                        >
                          {r.errors.join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {dupRows.length > 0 && (
            <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer" style={{ background: "var(--warning-bg)" }}>
              <input
                type="checkbox"
                checked={allowDuplicates}
                onChange={(e) => setAllowDuplicates(e.target.checked)}
              />
              Allow duplicate phone / email — same contact can appear for multiple attendees
            </label>
          )}
          <div
            className="rounded-lg px-3 py-2 text-xs font-medium"
            style={
              importCount === 0
                ? { background: "var(--destructive-bg)", color: "var(--destructive)" }
                : { background: "var(--success-bg)", color: "var(--success)" }
            }
          >
            {importCount === 0
              ? "No rows to import. Fix the issues and try again."
              : `${importCount} row${importCount !== 1 ? "s" : ""} ready to import.${
                  dupRows.length > 0 && !allowDuplicates ? " Duplicates will be skipped." : ""
                }${
                  dupRows.length > 0 && allowDuplicates
                    ? ` Includes ${dupRows.length} duplicate entr${dupRows.length !== 1 ? "ies" : "y"}.`
                    : ""
                }`}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="ui-btn ui-btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-primary"
              onClick={handleConfirm}
              disabled={importCount === 0 || importing}
            >
              <i className="bi bi-check" /> Import {importCount} Registrants
            </button>
          </div>
        </div>
      )}

      {step === "success" && (
        <div className="text-center py-4">
          <span
            className="inline-flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--success-bg)", color: "var(--success)" }}
          >
            <i className="bi bi-check-lg" style={{ fontSize: 22 }} />
          </span>
          <div className="text-base font-semibold text-foreground mt-3">{importedCount} Registrants Imported</div>
          <button type="button" className="ui-btn ui-btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      )}
    </ModalShell>
  );
};

// ── Edit Attendee Modal ───────────────────────────────────────────────────────

const EditModal = ({ attendee, eventCats, onSave, onClose, title = "Edit Registrant", saveLabel = "Save Changes" }) => {
  const [form, setForm] = useState({
    name: attendee.name,
    phone: attendee.phone,
    email: attendee.email,
    category: attendee.category,
    organization: attendee.organization,
  });

  const [errors, setErrors] = useState({});

  const handleSave = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required.";
    if (form.phone && !validatePhone(form.phone)) errs.phone = "Enter the correct number of digits for the selected country code.";
    if (form.email && !validateEmail(form.email)) errs.email = "Invalid email address.";
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onSave(form);
  };

  const errText = (msg) => msg && <div className="text-[11px] mt-1" style={{ color: "var(--destructive)" }}>{msg}</div>;

  return (
    <ModalShell title={title} onClose={onClose} maxWidth={460}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLS}>Name *</label>
          <input
            type="text"
            className="ui-input w-full"
            style={{ borderColor: errors.name ? "var(--destructive)" : undefined }}
            value={form.name}
            onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setErrors((p) => ({ ...p, name: "" })); }}
          />
          {errText(errors.name)}
        </div>
        <div>
          <label className={LABEL_CLS}>Phone</label>
          <PhoneInput
            value={form.phone}
            isInvalid={!!errors.phone}
            onChange={(val) => { setForm((p) => ({ ...p, phone: val })); setErrors((p) => ({ ...p, phone: "" })); }}
          />
          {errText(errors.phone)}
        </div>
        <div>
          <label className={LABEL_CLS}>Email</label>
          <input
            type="email"
            className="ui-input w-full"
            style={{ borderColor: errors.email ? "var(--destructive)" : undefined }}
            value={form.email}
            onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setErrors((p) => ({ ...p, email: "" })); }}
          />
          {errText(errors.email)}
        </div>
        <div>
          <label className={LABEL_CLS}>Organization</label>
          <input
            type="text"
            className="ui-input w-full"
            value={form.organization}
            onChange={(e) => setForm((p) => ({ ...p, organization: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL_CLS}>Category</label>
          <select
            className="ui-input w-full"
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
          >
            <option value="">— None —</option>
            {(eventCats?.length > 0 ? eventCats.map((c) => ({ name: c.label, color: c.color })) : DEFAULT_CATEGORIES).map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" className="ui-btn ui-btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="ui-btn ui-btn-primary" onClick={handleSave}>
          {saveLabel}
        </button>
      </div>
    </ModalShell>
  );
};

// ── Pass View Modal ───────────────────────────────────────────────────────────

const PASS_PREVIEW_W = 280;

const DEFAULT_PASS_LAYOUT = {
  headerTitle: {
    x: 18,
    y: 20,
    w: 320,
    h: 26,
    fontSize: 19,
    fontWeight: "700",
    fontStyle: "normal",
    fontFamily: "Segoe UI",
    color: "var(--card)",
  },
  headerSub: {
    x: 18,
    y: 52,
    w: 320,
    h: 18,
    fontSize: 13,
    fontWeight: "400",
    fontStyle: "normal",
    fontFamily: "Segoe UI",
    color: "rgba(255,255,255,0.82)",
  },
  headerBrand: {
    x: 330,
    y: 20,
    w: 80,
    h: 14,
    fontSize: 11,
    fontWeight: "400",
    fontStyle: "normal",
    fontFamily: "Segoe UI",
    color: "rgba(255,255,255,0.55)",
  },
  logo: { x: 330, y: 8, w: 72, h: 72, opacity: 1, src: null },
  categoryBadge: { x: 18, y: 120, w: 116, h: 28 },
  name: {
    x: 18,
    y: 160,
    w: 385,
    h: 34,
    fontSize: 24,
    fontWeight: "700",
    fontStyle: "normal",
    fontFamily: "Segoe UI",
    color: "#0f172a",
  },
  organization: {
    x: 18,
    y: 204,
    w: 385,
    h: 22,
    fontSize: 13,
    fontWeight: "400",
    fontStyle: "normal",
    fontFamily: "Segoe UI",
    color: "var(--foreground)",
  },
  phone: {
    x: 18,
    y: 230,
    w: 385,
    h: 22,
    fontSize: 13,
    fontWeight: "400",
    fontStyle: "normal",
    fontFamily: "Segoe UI",
    color: "var(--foreground)",
  },
  email: {
    x: 18,
    y: 256,
    w: 385,
    h: 22,
    fontSize: 13,
    fontWeight: "400",
    fontStyle: "normal",
    fontFamily: "Segoe UI",
    color: "var(--foreground)",
  },
  qr: { x: 135, y: 460, w: 150, h: 150 },
};

const PassViewModal = ({ attendee, event, onClose }) => {
  const [qrSrc, setQrSrc] = useState(null);

  // Check if using new elements-based design
  const fullDesign = event?.passDesign || {};
  const isNewDesign = fullDesign.elements && Array.isArray(fullDesign.elements);

  // Pick category-specific design if saved
  const catDesigns = fullDesign.categoryDesigns || {};
  const categoryDesign = catDesigns[attendee.category] || catDesigns["Default"];

  // Use new format if available
  const canvas = categoryDesign?.canvas || fullDesign.canvas || { width: 420, height: 640, background: "var(--card)" };
  const elements = categoryDesign?.elements || fullDesign.elements || [];

  // For backward compatibility with old format
  const design = categoryDesign || fullDesign;

  const passW = canvas.width;
  const passH = canvas.height;
  const S = PASS_PREVIEW_W / passW;
  const previewH = Math.round(passH * S);

  // Old format fallback values
  const primaryColor = design.primaryColor || "var(--primary)";
  const headerColor = design.headerColor || primaryColor;
  const qrColor = design.qrColor || "#000000";
  const bgColor = design.bgColor || canvas.background || "var(--card)";
  const bgImage = design.bgImage || null;
  const bgOpacity = design.bgOpacity ?? 60;
  const bgFit = design.bgFit || "cover";
  const bgPosX = design.bgPosX ?? 50;
  const bgPosY = design.bgPosY ?? 50;
  const showHeader = design.showHeader !== false;
  const headerHeight = design.headerHeight || 108;
  const headerConfig = design.headerConfig || {};
  const layout = { ...DEFAULT_PASS_LAYOUT, ...(design.layout || {}) };

  const eventCats = (event?.categories || []).filter((c) => c.enabled !== false);
  const catColor =
    eventCats.find((c) => c.label?.toLowerCase() === (attendee.category || "").toLowerCase())?.color ||
    DEFAULT_CATEGORIES.find((c) => c.name.toLowerCase() === (attendee.category || "").toLowerCase())?.color ||
    primaryColor;

  // Generate real QR code
  useEffect(() => {
    let active = true;
    const qr = new QRCodeStyling({
      width: 240,
      height: 240,
      type: "canvas",
      data: attendee.passId || "PASS",
      dotsOptions: { color: qrColor, type: "square" },
      backgroundOptions: { color: "var(--card)" },
      qrOptions: { errorCorrectionLevel: "M" },
    });
    qr.getRawData("png")
      .then((blob) => {
        if (!active) return;
        const url = URL.createObjectURL(blob);
        setQrSrc((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [attendee.passId, qrColor]);

  const passRadius = design.passRadius ?? 14;
  const bgSizeCSS = bgFit === "stretch" ? "100% 100%" : bgFit;
  const bgPosCSS = `${bgPosX}% ${bgPosY}%`;

  const elStyle = (el, defSize, defWeight, defColor) => ({
    fontWeight: el?.fontWeight || defWeight,
    fontSize: (el?.fontSize || defSize) * S,
    fontStyle: el?.fontStyle || "normal",
    fontFamily: `"${el?.fontFamily || "Segoe UI"}", Arial, sans-serif`,
    color: el?.color || defColor,
    whiteSpace: "nowrap",
  });

  return (
    <ModalShell title="Pass Preview" onClose={onClose} maxWidth={PASS_PREVIEW_W + 60}>
        <div className="text-xs text-muted-foreground mb-3">
              {attendee.name}
              {attendee.category && (
                <span style={{ color: catColor }}> · {attendee.category}</span>
              )}
        </div>

        <div
          style={{
            position: "relative",
            width: PASS_PREVIEW_W,
            height: previewH,
            margin: "0 auto",
            borderRadius: passRadius * S,
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
          }}
        >
          {/* Background */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: bgColor,
              backgroundImage: bgImage ? `url(${bgImage})` : undefined,
              backgroundSize: bgSizeCSS,
              backgroundPosition: bgPosCSS,
              backgroundRepeat: "no-repeat",
            }}
          />
          {bgImage && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `rgba(255,255,255,${(100 - bgOpacity) / 100})`,
              }}
            />
          )}
          {/* Border */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              border: `${2.5 * S}px solid ${primaryColor}`,
              borderRadius: passRadius * S,
              pointerEvents: "none",
              zIndex: 10,
            }}
          />

          {/* New elements-based design */}
          {isNewDesign && elements.length > 0 && (
            <>
              {elements.map((el) => {
                const substitute = (str) =>
                  (str || "")
                    .replace(/\{\{name\}\}/g, attendee.name || "")
                    .replace(/\{\{email\}\}/g, attendee.email || "")
                    .replace(/\{\{phone\}\}/g, attendee.phone || "")
                    .replace(/\{\{passId\}\}/g, attendee.passId || "")
                    .replace(/\{\{category\}\}/g, attendee.category || "")
                    .replace(/\{\{eventName\}\}/g, event?.eventName || "")
                    .replace(/\{\{venue\}\}/g, event?.venue || "")
                    .replace(/\{\{startDate\}\}/g, event?.startDate || "")
                    .replace(/\{\{endDate\}\}/g, event?.endDate || "");

                const isText = ["text", "header", "footer", "card"].includes(el.type);
                const isMedia = ["image", "logo"].includes(el.type);

                return (
                  <div
                    key={el.id}
                    style={{
                      position: "absolute",
                      left: el.x * S,
                      top: el.y * S,
                      width: el.w * S,
                      height: el.h * S,
                      zIndex: el.zIndex || 1,
                      background: el.bg || "transparent",
                      borderRadius: (el.borderRadius || 0) * S,
                      border:
                        (el.borderWidth || 0) > 0
                          ? `${el.borderWidth * S}px ${el.borderStyle} ${el.borderColor}`
                          : "none",
                      overflow: "hidden",
                      opacity: el.opacity ?? 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: el.textAlign === "center" ? "center" : el.textAlign === "right" ? "flex-end" : "flex-start",
                      padding: `${el.paddingY * S}px ${el.paddingX * S}px`,
                      boxSizing: "border-box",
                    }}
                  >
                    {isText && (
                      <div
                        style={{
                          fontSize: el.fontSize * S,
                          fontWeight: el.fontWeight,
                          fontFamily: el.fontFamily,
                          fontStyle: el.fontStyle,
                          textDecoration: el.textDecoration,
                          color: el.color,
                          textAlign: el.textAlign,
                          lineHeight: el.lineHeight,
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {substitute(el.content)}
                      </div>
                    )}
                    {el.type === "qr" && qrSrc && (
                      <img src={qrSrc} alt="QR" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    )}
                    {isMedia && el.imageUrl && (
                      <img src={el.imageUrl} alt={el.label} style={{ width: "100%", height: "100%", objectFit: el.objectFit || "cover" }} />
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* Old layout-based design (fallback) */}
          {!isNewDesign && showHeader && (
            <>
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: headerHeight * S,
                  background: headerColor,
                  zIndex: 2,
                }}
              />
              {layout.headerTitle?.visible !== false && (
                <div
                  style={{
                    position: "absolute",
                    left: (layout.headerTitle?.x || 18) * S,
                    top: (layout.headerTitle?.y || 20) * S,
                    zIndex: 3,
                    ...elStyle(layout.headerTitle, 19, "700", "var(--card)"),
                    overflow: "hidden",
                    maxWidth: (passW - (layout.headerTitle?.x || 18)) * S,
                  }}
                >
                  {headerConfig.customTitle || event?.eventName || "Event"}
                </div>
              )}
              {headerConfig.showDates !== false && layout.headerSub?.visible !== false && (
                <div
                  style={{
                    position: "absolute",
                    left: (layout.headerSub?.x || 18) * S,
                    top: (layout.headerSub?.y || 52) * S,
                    zIndex: 3,
                    ...elStyle(layout.headerSub, 13, "400", "rgba(255,255,255,0.82)"),
                  }}
                >
                  {[
                    event?.startDate,
                    event?.endDate && `– ${event.endDate}`,
                    headerConfig.showVenue !== false && event?.venue,
                  ]
                    .filter(Boolean)
                    .join("  ")}
                </div>
              )}
              {layout.headerBrand?.visible !== false && (
                <div
                  style={{
                    position: "absolute",
                    left: (layout.headerBrand?.x || 330) * S,
                    top: (layout.headerBrand?.y || 20) * S,
                    zIndex: 3,
                    ...elStyle(layout.headerBrand, 11, "400", "rgba(255,255,255,0.55)"),
                  }}
                >
                  {headerConfig.brandText || "KnowVato"}
                </div>
              )}
              {layout.logo?.src && layout.logo?.visible !== false && (
                <img
                  src={layout.logo.src}
                  alt="Logo"
                  style={{
                    position: "absolute",
                    zIndex: 5,
                    left: layout.logo.x * S,
                    top: layout.logo.y * S,
                    width: layout.logo.w * S,
                    height: layout.logo.h * S,
                    objectFit: "contain",
                    opacity: layout.logo.opacity ?? 1,
                  }}
                />
              )}
            </>
          )}

          {/* Category badge */}
          {!isNewDesign && layout.categoryBadge?.visible !== false && (
            <div
              style={{
                position: "absolute",
                zIndex: 3,
                left: layout.categoryBadge.x * S,
                top: layout.categoryBadge.y * S,
                width: layout.categoryBadge.w * S,
                height: layout.categoryBadge.h * S,
                background: catColor,
                color: "var(--card)",
                borderRadius: (layout.categoryBadge.h / 2) * S,
                fontSize: (layout.categoryBadge.fontSize || 11) * S,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                whiteSpace: "nowrap",
              }}
            >
              {attendee.category || "General"}
            </div>
          )}

          {/* Name */}
          {!isNewDesign && layout.name?.visible !== false && (
            <div
              style={{
                position: "absolute",
                zIndex: 3,
                left: layout.name.x * S,
                top: layout.name.y * S,
                ...elStyle(layout.name, 24, "700", "#0f172a"),
                overflow: "hidden",
                maxWidth: (passW - layout.name.x) * S,
              }}
            >
              {attendee.name || "—"}
            </div>
          )}
          {!isNewDesign && attendee.organization && layout.organization?.visible !== false && (
            <div
              style={{
                position: "absolute",
                zIndex: 3,
                left: layout.organization.x * S,
                top: layout.organization.y * S,
                ...elStyle(layout.organization, 13, "400", "var(--foreground)"),
              }}
            >
              ⊞ {attendee.organization}
            </div>
          )}
          {!isNewDesign && attendee.phone && layout.phone?.visible !== false && (
            <div
              style={{
                position: "absolute",
                zIndex: 3,
                left: layout.phone.x * S,
                top: layout.phone.y * S,
                ...elStyle(layout.phone, 13, "400", "var(--foreground)"),
              }}
            >
              ◉ {attendee.phone}
            </div>
          )}
          {!isNewDesign && attendee.email && layout.email?.visible !== false && (
            <div
              style={{
                position: "absolute",
                zIndex: 3,
                left: layout.email.x * S,
                top: layout.email.y * S,
                ...elStyle(layout.email, 13, "400", "var(--foreground)"),
              }}
            >
              ✉ {attendee.email}
            </div>
          )}

          {/* Custom images */}
          {!isNewDesign && Object.entries(layout)
            .filter(([k]) => k.startsWith("ci_"))
            .map(([k, el]) =>
              el.src && el.visible !== false ? (
                <img
                  key={k}
                  src={el.src}
                  alt="Custom"
                  style={{
                    position: "absolute",
                    zIndex: 3,
                    left: el.x * S,
                    top: el.y * S,
                    width: el.w * S,
                    height: el.h * S,
                    objectFit: "contain",
                    opacity: el.opacity ?? 1,
                  }}
                />
              ) : null,
            )}
          {/* Custom texts */}
          {!isNewDesign && Object.entries(layout)
            .filter(([k]) => k.startsWith("ct_"))
            .map(([k, el]) =>
              el.visible !== false ? (
                <div
                  key={k}
                  style={{
                    position: "absolute",
                    zIndex: 3,
                    left: el.x * S,
                    top: el.y * S,
                    ...elStyle(el, 14, "400", "var(--foreground)"),
                    opacity: el.opacity ?? 1,
                  }}
                >
                  {el.content || ""}
                </div>
              ) : null,
            )}

          {/* QR divider + QR */}
          {!isNewDesign && layout.qr?.visible !== false && (
            <>
              <div
                style={{
                  position: "absolute",
                  top: (layout.qr.y - 12) * S,
                  left: 18 * S,
                  right: 18 * S,
                  height: 1,
                  background: "var(--border)",
                  zIndex: 1,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  zIndex: 3,
                  left: layout.qr.x * S,
                  top: layout.qr.y * S,
                  width: layout.qr.w * S,
                  height: layout.qr.h * S,
                  background: "var(--border)",
                  borderRadius: 8 * S,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {qrSrc ? (
                  <img
                    src={qrSrc}
                    alt="QR"
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <span style={{ fontSize: 8 * S, color: "var(--muted-foreground)" }}>
                    Generating…
                  </span>
                )}
              </div>
            </>
          )}

          {/* Pass ID */}
          <div
            style={{
              position: "absolute",
              bottom: 6 * S,
              left: 0,
              right: 0,
              textAlign: "center",
              fontSize: 8 * S,
              color: "var(--muted-foreground)",
              fontFamily: "monospace",
              zIndex: 1,
            }}
          >
            {attendee.passId}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-3 mb-0">
          Pass ID: <code>{attendee.passId}</code>
        </p>
    </ModalShell>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const EventAttendeesPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { events, attendees, addSingleAttendee, addAttendees, updateAttendee, deleteAttendee, setSelectedEventId } =
    useEventData();

  // Tell the context which event is active so it fetches attendees
  useEffect(() => {
    if (eventId) setSelectedEventId(eventId);
  }, [eventId, setSelectedEventId]);

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterPass, setFilterPass] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const [showImport, setShowImport] = useState(false);

  // "Upload Data" opens this page at .../upload — start with the import dialog open.
  useEffect(() => {
    if (window.location.pathname.endsWith("/upload")) setShowImport(true);
  }, [eventId]);

  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);
  const [editTarget, setEditTarget] = useState(null);
  const [passPreviewTarget, setPassPreviewTarget] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const selectedEvent = useMemo(
    () =>
      events.find((e) => e.id === Number(eventId) || e.id === eventId) || null,
    [events, eventId],
  );

  const eventAttendees = useMemo(
    () => attendees.filter((a) => a.eventId === selectedEvent?.id),
    [attendees, selectedEvent],
  );

  // Active categories configured for this event
  const eventCats = useMemo(
    () => (selectedEvent?.categories || []).filter((c) => c.enabled === true),
    [selectedEvent],
  );

  const isPast = !!selectedEvent?.endDate &&
    selectedEvent.endDate < new Date().toISOString().split("T")[0];

  // Dynamic column visibility based on event field settings
  const showPhone = useMemo(() => {
    const fields = selectedEvent?.attendeeFields;
    if (!fields?.length) return true;
    const f = fields.find((f) => f.fieldId === "mobile");
    return f ? f.enabled !== false : true;
  }, [selectedEvent]);

  const showEmail = useMemo(() => {
    const fields = selectedEvent?.attendeeFields;
    if (!fields?.length) return true;
    const f = fields.find((f) => f.fieldId === "email");
    return f ? f.enabled !== false : true;
  }, [selectedEvent]);

  const showCat = useMemo(() => eventCats.length > 0, [eventCats]);

  const showOrg = useMemo(() => {
    const fields = selectedEvent?.attendeeFields;
    if (!fields?.length) return false;
    return fields.some(
      (f) => normalizeKey(f.label) === "organization" && f.enabled === true,
    );
  }, [selectedEvent]);

  const getCatColor = (name) => {
    const evtCat = eventCats.find((c) => c.label?.toLowerCase() === name?.toLowerCase());
    if (evtCat?.color) return evtCat.color;
    return DEFAULT_CATEGORIES.find((c) => c.name.toLowerCase() === name?.toLowerCase())?.color || "var(--muted-foreground)";
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const designSaved = selectedEvent?.passDesignSaved;
    return eventAttendees.filter((a) => {
      if (filterCat && a.category !== filterCat) return false;
      const hasPass = designSaved || a.passGenerated;
      if (filterPass === "generated" && !hasPass) return false;
      if (filterPass === "not-generated" && hasPass) return false;
      if (
        q &&
        !`${a.name} ${a.phone} ${a.email} ${a.organization}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [eventAttendees, search, filterCat, filterPass, selectedEvent]);

  const handleImported = async (list) => {
    if (!selectedEvent?.id) return;
    try {
      await addAttendees(selectedEvent.id, list);
      toast.success(`${list.length} registrants imported.`);
      setShowImport(false);
    } catch (err) {
      toast.error(err.message || "Failed to import registrants.");
    }
  };

  const handleDelete = (a) => {
    if (!window.confirm(`Remove "${a.name}"?`)) return;
    deleteAttendee(a.id);
    toast.success("Registrant removed.");
  };

  const handleEditSave = async (data) => {
    try {
      await updateAttendee(editTarget.id, data, editTarget);
      toast.success("Registrant updated.");
      setEditTarget(null);
    } catch (err) {
      toast.error(err.message || "Failed to update registrant.");
    }
  };

  const handleAddSave = async (data) => {
    try {
      await addSingleAttendee(selectedEvent.id, data);
      toast.success("Registrant added.");
      setShowAddModal(false);
    } catch (err) {
      toast.error(err.message || "Failed to add registrant.");
    }
  };

  const passGeneratedCount = eventAttendees.filter(
    (a) => a.passGenerated,
  ).length;

  const backToEvents = () => navigate("/modules/events/all");
  const colCount = 4 + (showPhone ? 1 : 0) + (showEmail ? 1 : 0) + (showCat ? 1 : 0) + (showOrg ? 1 : 0);
  const activeFilters = [filterCat, filterPass].filter(Boolean).length;

  if (!selectedEvent) {
    return (
      <div className="px-4 py-3 max-w-[1600px] mx-auto">
        <div className="rounded-xl border bg-card px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground mb-3">Event not found.</p>
          <button type="button" className="ui-btn ui-btn-primary" onClick={backToEvents}>
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-2 border-b">
        <div className="min-w-0">
          <button
            type="button"
            onClick={backToEvents}
            className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors"
            style={{ background: "transparent", border: 0, padding: 0 }}
          >
            <i className="bi bi-arrow-left" /> Back to Events
          </button>
          <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight truncate">
            {selectedEvent.eventName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {eventAttendees.length > 0 && (
            <button
              type="button"
              className="ui-btn ui-btn-outline"
              onClick={() => navigate(`/modules/events/${eventId}/passes`)}
            >
              <i className="bi bi-qr-code" /> Generate Pass
            </button>
          )}
          <button type="button" className="ui-btn ui-btn-outline" onClick={() => setShowAddModal(true)} disabled={isPast}>
            <i className="bi bi-person-plus" /> Add
          </button>
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => setShowImport(true)} disabled={isPast}>
            <i className="bi bi-cloud-upload" /> Import
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <i
            className="bi bi-search text-muted-foreground"
            style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 13, pointerEvents: "none" }}
          />
          <input
            type="text"
            className="ui-input w-full"
            style={{ paddingLeft: 32 }}
            placeholder="Search name, phone, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative" ref={filterRef}>
          <button
            type="button"
            className={`ui-btn ${activeFilters ? "ui-btn-primary" : "ui-btn-outline"}`}
            onClick={() => setFilterOpen((o) => !o)}
          >
            <i className="bi bi-funnel" /> Filter
            {activeFilters > 0 && <span className="text-[10px] font-semibold">({activeFilters})</span>}
          </button>
          {filterOpen && (
            <div
              className="rounded-xl border bg-card p-3 space-y-3"
              style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 40, minWidth: 240, boxShadow: "var(--shadow-lift)" }}
            >
              <div>
                <label className={LABEL_CLS}>Category</label>
                <select className="ui-input w-full" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
                  <option value="">All Categories</option>
                  {(eventCats.length > 0 ? eventCats.map((c) => c.label) : DEFAULT_CATEGORIES.map((c) => c.name)).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>Pass Status</label>
                <select className="ui-input w-full" value={filterPass} onChange={(e) => setFilterPass(e.target.value)}>
                  <option value="">All</option>
                  <option value="generated">Generated</option>
                  <option value="not-generated">Not Generated</option>
                </select>
              </div>
              <button
                type="button"
                className="ui-btn ui-btn-outline ui-btn-sm w-full"
                onClick={() => {
                  setFilterCat("");
                  setFilterPass("");
                  setFilterOpen(false);
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {eventAttendees.length}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className={TH_CLS} style={{ width: 64 }}>Sr No</th>
                <th className={TH_CLS}>Name</th>
                {showPhone && <th className={TH_CLS}>Phone</th>}
                {showEmail && <th className={TH_CLS}>Email</th>}
                {showCat && <th className={TH_CLS}>Category</th>}
                {showOrg && <th className={TH_CLS}>Organization</th>}
                <th className={TH_CLS}>Pass</th>
                <th className="px-4 py-3 font-medium" style={{ width: 96, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {eventAttendees.length === 0
                      ? "No attendees yet. Click Import to upload data, or Add to enter one."
                      : "No results match your filter."}
                  </td>
                </tr>
              ) : (
                filtered.map((a, i) => (
                  <tr key={a.id} className="border-t hover:bg-accent/30">
                    <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-foreground">{a.name || "—"}</td>
                    {showPhone && <td className="px-4 py-2.5">{a.phone || "—"}</td>}
                    {showEmail && (
                      <td className="px-4 py-2.5 truncate" style={{ maxWidth: 200 }}>
                        {a.email || "—"}
                      </td>
                    )}
                    {showCat && (
                      <td className="px-4 py-2.5">
                        {a.category ? (
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <span className="h-2 w-2 rounded-full" style={{ background: getCatColor(a.category) }} />
                            {a.category}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
                    {showOrg && <td className="px-4 py-2.5">{a.organization || "—"}</td>}
                    <td className="px-4 py-2.5">
                      {selectedEvent?.passDesignSaved || a.passGenerated ? (
                        <button
                          type="button"
                          className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon"
                          title="Preview pass"
                          onClick={() => setPassPreviewTarget(a)}
                          style={a.passGenerated ? { color: "var(--success)" } : undefined}
                        >
                          <i className="bi bi-eye" />
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5" style={{ textAlign: "right" }}>
                      {!isPast && (
                        <div className="inline-flex items-center gap-1">
                          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Edit" onClick={() => setEditTarget(a)}>
                            <i className="bi bi-pencil" />
                          </button>
                          <button type="button" className="ui-btn ui-btn-danger ui-btn-sm ui-btn-icon" title="Delete" onClick={() => handleDelete(a)}>
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <EditModal
          attendee={{ name: "", phone: "", email: "", category: "", organization: "" }}
          eventCats={eventCats}
          onSave={handleAddSave}
          onClose={() => setShowAddModal(false)}
          title="Add Registrant"
          saveLabel="Save"
        />
      )}
      {showImport && (
        <ImportModal
          eventId={selectedEvent.id}
          event={selectedEvent}
          existingAttendees={eventAttendees}
          onClose={() => setShowImport(false)}
          onImported={handleImported}
        />
      )}
      {editTarget && (
        <EditModal
          attendee={editTarget}
          eventCats={eventCats}
          onSave={handleEditSave}
          onClose={() => setEditTarget(null)}
        />
      )}
      {passPreviewTarget &&
        (selectedEvent.passLayout?.blocks ? (
          <PassPreviewModal attendee={passPreviewTarget} event={selectedEvent} onClose={() => setPassPreviewTarget(null)} />
        ) : (
          <PassViewModal attendee={passPreviewTarget} event={selectedEvent} onClose={() => setPassPreviewTarget(null)} />
        ))}
    </div>
  );
};


export default EventAttendeesPage;
