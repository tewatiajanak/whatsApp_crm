// Frontend-only mock of the original REST API.
// Persists each collection to localStorage so pages behave end-to-end
// without a backend. Swap this file for a real fetch wrapper when you
// wire the AWS backend in VS Code — all signatures match the original.
//
// EXCEPTION: `fetchEventTypes` (and its create/patch/remove siblings)
// call the real backend at /event-types since PHASE-4 shipped that model
// for real. The other endpoints are still localStorage-backed.

import { http } from "../../../api";

const PREFIX = "em_mock_";
const delay = (v, ms = 80) => new Promise((r) => setTimeout(() => r(v), ms));

const read = (key) => {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const write = (key, data) => {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {}
};
const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

const list = (key) => delay(read(key));
const create = (key, data) => {
  const all = read(key);
  const row = { ...data, id: data?.id || uid(), createdAt: new Date().toISOString() };
  all.unshift(row);
  write(key, all);
  return delay(row);
};
const update = (key, id, updates) => {
  const all = read(key);
  const idx = all.findIndex((x) => x.id === id);
  if (idx === -1) return delay(null);
  all[idx] = { ...all[idx], ...updates, id };
  write(key, all);
  return delay(all[idx]);
};
const remove = (key, id) => {
  const all = read(key).filter((x) => x.id !== id);
  write(key, all);
  return delay({ ok: true });
};
const find = (key, id) => delay(read(key).find((x) => x.id === id) || null);

// User Fields
export const fetchUserFields = () => list("user-fields");
export const createUserField = (d) => create("user-fields", d);
export const patchUserField = (id, d) => update("user-fields", id, d);
export const removeUserField = (id) => remove("user-fields", id);

// Categories
export const fetchCategories = () => list("categories");
export const createCategory = (d) => create("categories", d);
export const patchCategory = (id, d) => update("categories", id, d);
export const removeCategory = (id) => remove("categories", id);

// Events
export const fetchEvents = () => list("events");
export const createEvent = (d) => create("events", d);
export const patchEvent = (id, d) => update("events", id, d);
export const removeEvent = (id) => remove("events", id);

// Event Types — REAL backend (PHASE-4 shipped).
// Normalized to the mock shape the old Event Manager pages expect:
//   `.id` (Mongo _id), `.label` (alias of name), `.active` (alias of isActive).
const normalizeEventType = (it) => {
  if (!it) return it;
  return {
    ...it,
    id: it._id || it.id,
    label: it.name || it.label,
    active: it.isActive !== undefined ? it.isActive : it.active !== false,
  };
};
export const fetchEventTypes = async () => {
  try {
    const res = await http.get("/event-types?perPage=200&sort=sortOrder");
    const items = res?.data ?? res?.items ?? (Array.isArray(res) ? res : []);
    return items.map(normalizeEventType);
  } catch (e) {
    // Fallback to local mock if backend unreachable (dev without server up)
    console.warn("[event-manager] /event-types unavailable, falling back to local", e?.message);
    return read("event-types");
  }
};
// Translate old field names (label, active) → backend names (name, isActive)
const denormalizeEventType = (d) => {
  if (!d) return d;
  const out = { ...d };
  if (out.label !== undefined && out.name === undefined) out.name = out.label;
  if (out.active !== undefined && out.isActive === undefined) out.isActive = out.active;
  delete out.label;
  delete out.active;
  return out;
};
export const createEventType = async (d) => {
  const payload = denormalizeEventType(d);
  // key is required by backend; auto-derive from name if missing
  if (!payload.key && payload.name) {
    payload.key = String(payload.name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 40);
  }
  const res = await http.post("/event-types", payload);
  return normalizeEventType(res?.data ?? res);
};
export const patchEventType = async (id, d) => {
  const res = await http.patch(`/event-types/${id}`, denormalizeEventType(d));
  return normalizeEventType(res?.data ?? res);
};
export const removeEventType = async (id) => {
  await http.del(`/event-types/${id}`);
  return { ok: true };
};

// Attendees (kept eventId arg for signature compatibility)
export const fetchAttendees = (eventId) => {
  const all = read("attendees");
  return delay(eventId ? all.filter((a) => a.eventId === eventId) : all);
};
export const createAttendee = (eventId, data) =>
  create("attendees", { ...data, eventId });
export const bulkCreateAttendees = (eventId, attendees) => {
  const all = read("attendees");
  const created = attendees.map((a) => ({
    ...a,
    eventId,
    id: a.id || uid(),
    createdAt: new Date().toISOString(),
  }));
  write("attendees", [...created, ...all]);
  return delay(created);
};
export const patchAttendee = (id, d) => update("attendees", id, d);
export const removeAttendee = (id) => remove("attendees", id);

// Pass Templates
export const fetchPassTemplates = () => list("pass-templates");
export const createPassTemplate = (d) => create("pass-templates", d);
export const updatePassTemplate = (id, d) => update("pass-templates", id, d);
export const deletePassTemplate = (id) => remove("pass-templates", id);

// Auth stubs
export const loginUser = async (userId, password) =>
  delay({ user: { id: userId, name: userId, permissions: [] }, token: "mock" });
export const verify2FA = async () => delay({ ok: true });

// User Types
export const fetchUserTypes = () => list("user-types");
export const createUserType = (d) => create("user-types", d);
export const patchUserType = (id, d) => update("user-types", id, d);
export const removeUserType = (id) => remove("user-types", id);

// App Users
export const fetchAppUsers = () => list("app-users");
export const createAppUser = (d) => create("app-users", d);
export const patchAppUser = (id, d) => update("app-users", id, d);
export const removeAppUser = (id) => remove("app-users", id);

// Event Logs
export const fetchEventLogs = (eventId) => {
  const all = read("event-logs");
  return delay(eventId ? all.filter((l) => l.eventId === eventId) : all);
};
export const createEventLog = (data) => create("event-logs", data);
export const clearEventLogs = (eventId) => {
  const all = read("event-logs").filter((l) => l.eventId !== eventId);
  write("event-logs", all);
  return delay({ ok: true });
};

// Public registration
export const fetchPublicEvent = (eventId) => find("events", eventId);
export const fetchFormBySlug = async (slug) => {
  const all = read("forms");
  return delay(all.find((f) => f.slug === slug) || null);
};
export const publicRegister = (eventId, data) =>
  create("attendees", { ...data, eventId, status: "registered" });

// Forms
export const fetchForms = () => list("forms");
export const fetchForm = (id) => find("forms", id);
export const createForm = (d) => create("forms", d);
export const updateForm = (id, d) => update("forms", id, d);
export const deleteForm = (id) => remove("forms", id);

// Form Templates
export const fetchFormTemplates = () => list("form-templates");
export const createFormTemplate = (d) => create("form-templates", d);
export const deleteFormTemplate = (id) => remove("form-templates", id);
