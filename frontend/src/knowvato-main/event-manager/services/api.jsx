// Data layer for the Event Manager pages. Nothing is persisted in the browser.
//
// Events, attendees and activity logs are real MongoDB collections behind
// /api/events, /api/attendees and /api/event-logs. The smaller setup lists
// (user fields, categories, forms, pass templates) are kept as one JSON value
// each in the server-side app store (/api/app-store).
//
// EXCEPTION: `fetchEventTypes` (and its create/patch/remove siblings)
// call the real backend at /event-types since PHASE-4 shipped that model
// for real. The other collections go through the app store.

import { http } from "../../../api";
import { appStore } from "../../../api/appStore";

const PREFIX = "em_mock_";
const delay = (v, ms = 80) => new Promise((r) => setTimeout(() => r(v), ms));

const read = (key) => {
  try {
    const raw = appStore.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const write = (key, data) => {
  try {
    appStore.setItem(PREFIX + key, JSON.stringify(data));
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

const unwrap = (res) => res?.data ?? res;
// A browser that still held old local data uploads it right after sign-in; let
// that finish so the server can fold it into the collections before we read.
const settled = () => appStore.whenIdle();

// Events
export const fetchEvents = async () => {
  await settled();
  return unwrap(await http.get("/events"));
};
export const createEvent = async (d) => unwrap(await http.post("/events", d));
export const patchEvent = async (id, d) => unwrap(await http.patch(`/events/${id}`, d));
export const removeEvent = async (id) => unwrap(await http.del(`/events/${id}`));

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

// Attendees
const eventQuery = (eventId) => (eventId ? `?eventId=${encodeURIComponent(eventId)}` : "");
export const fetchAttendees = async (eventId) => {
  await settled();
  return unwrap(await http.get(`/attendees${eventQuery(eventId)}`));
};
export const createAttendee = async (eventId, data) =>
  unwrap(await http.post("/attendees", { ...data, eventId }));
export const bulkCreateAttendees = async (eventId, attendees) =>
  unwrap(await http.post("/attendees/bulk", { eventId, attendees }));
export const markAttendeesPassGenerated = async (eventId) =>
  unwrap(await http.post("/attendees/mark-pass-generated", { eventId }));
export const patchAttendee = async (id, d) => unwrap(await http.patch(`/attendees/${id}`, d));
export const removeAttendee = async (id) => unwrap(await http.del(`/attendees/${id}`));

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
export const fetchEventLogs = async (eventId) => {
  await settled();
  return unwrap(await http.get(`/event-logs${eventQuery(eventId)}`));
};
export const createEventLog = async (data) => unwrap(await http.post("/event-logs", data));
export const clearEventLogs = async (eventId) => unwrap(await http.del(`/event-logs${eventQuery(eventId)}`));

// Public registration
export const fetchPublicEvent = async (eventId) => {
  try {
    return unwrap(await http.get(`/events/${eventId}`));
  } catch {
    return null;
  }
};
export const fetchFormBySlug = async (slug) => {
  const all = read("forms");
  return delay(all.find((f) => f.slug === slug) || null);
};
export const publicRegister = (eventId, data) =>
  createAttendee(eventId, { ...data, status: "registered" });

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
