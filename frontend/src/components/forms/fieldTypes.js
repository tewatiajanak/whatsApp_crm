// Field types the form builder offers, grouped for the palette.
export const FIELD_GROUPS = [
  { label: "Basic", types: [
    { type: "text", label: "Text", icon: "fonts" },
    { type: "textarea", label: "Long text", icon: "text-paragraph" },
    { type: "email", label: "Email", icon: "envelope" },
    { type: "phone", label: "Phone", icon: "telephone" },
    { type: "number", label: "Number", icon: "123" },
    { type: "date", label: "Date", icon: "calendar3" },
    { type: "time", label: "Time", icon: "clock" },
    { type: "url", label: "Link", icon: "link-45deg" },
  ] },
  { label: "Choice", types: [
    { type: "select", label: "Dropdown", icon: "menu-button-wide" },
    { type: "radio", label: "Choice", icon: "ui-radios" },
    { type: "checkbox", label: "Checkboxes", icon: "ui-checks" },
    { type: "yesno", label: "Yes / No", icon: "toggle-on" },
    { type: "rating", label: "Rating", icon: "star" },
  ] },
  { label: "Upload & sign", types: [
    { type: "file", label: "Upload", icon: "upload" },
    { type: "signature", label: "Signature", icon: "pen" },
    { type: "consent", label: "Consent", icon: "check2-square" },
  ] },
  { label: "Layout", types: [
    { type: "heading", label: "Section", icon: "type-h2" },
    { type: "hidden", label: "Hidden", icon: "eye-slash" },
  ] },
];
export const FIELD_META = Object.fromEntries(FIELD_GROUPS.flatMap((g) => g.types).map((t) => [t.type, t]));
export const CHOICE_TYPES = new Set(["select", "radio", "checkbox"]);

export const LEAD_TARGETS = [
  { value: "name", label: "Name" }, { value: "phone", label: "Phone" }, { value: "email", label: "Email" },
  { value: "altPhone", label: "Other phone" }, { value: "city", label: "City" }, { value: "state", label: "State" },
  { value: "country", label: "Country" }, { value: "course", label: "Course" }, { value: "grade", label: "Class / grade" },
  { value: "branch", label: "Branch" }, { value: "note", label: "Note" },
];
// a sensible lead field for a new field of this type
export const AUTO_MAP = { email: "email", phone: "phone" };

export const OPTION_SOURCES = [
  { value: "custom", label: "My list" }, { value: "courses", label: "Courses" }, { value: "branches", label: "Branches" },
  { value: "grades", label: "Grades" }, { value: "sessions", label: "Academic sessions" },
];
export const SHOW_OPS = [
  { value: "eq", label: "is" }, { value: "neq", label: "is not" }, { value: "filled", label: "is answered" }, { value: "empty", label: "is empty" },
];
export const FORM_KINDS = [
  { value: "enquiry", label: "Enquiry", color: "var(--info)" }, { value: "application", label: "Application", color: "var(--primary)" },
  { value: "registration", label: "Registration", color: "var(--success)" }, { value: "event", label: "Event", color: "var(--warning)" },
  { value: "feedback", label: "Feedback", color: "var(--muted-foreground)" }, { value: "other", label: "Other", color: "var(--muted-foreground)" },
];
export const FORM_STATUS = {
  draft: { label: "Draft", color: "var(--muted-foreground)" },
  live: { label: "Live", color: "var(--success)" },
  closed: { label: "Closed", color: "var(--destructive)" },
};
export const SUB_STATUS = {
  new: { label: "New", color: "var(--info)" },
  review: { label: "In review", color: "var(--warning)" },
  accepted: { label: "Accepted", color: "var(--success)" },
  rejected: { label: "Rejected", color: "var(--destructive)" },
  draft: { label: "Draft", color: "var(--muted-foreground)" },
};

let n = 0;
export const newId = () => "f" + Date.now().toString(36).slice(-4) + (n++).toString(36) + Math.random().toString(36).slice(2, 4);

export function newField(type) {
  const meta = FIELD_META[type] || FIELD_META.text;
  const f = { id: newId(), type, label: type === "consent" ? "I agree to the terms" : type === "heading" ? "Section" : meta.label, required: false, width: "full", options: [], optionSource: "custom", map: "", defaultValue: "", param: "", min: null, max: null, minLength: null, maxLength: null, pattern: "", patternMessage: "", accept: "", maxSizeMb: 5, multiple: false, showIf: null };
  if (CHOICE_TYPES.has(type)) f.options = ["Option 1", "Option 2"];
  if (type === "rating") f.max = 5;
  if (type === "file") f.accept = ".pdf,image/*";
  return f;
}
