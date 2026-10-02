import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fetchUserFields,
  createUserField,
  patchUserField,
  removeUserField,
  fetchCategories,
  createCategory,
  patchCategory,
  removeCategory,
  fetchEventTypes,
  createEventType,
  patchEventType,
  removeEventType,
  fetchEvents,
  createEvent,
  patchEvent,
  removeEvent,
  fetchAttendees,
  createAttendee,
  bulkCreateAttendees,
  markAttendeesPassGenerated,
  patchAttendee,
  removeAttendee,
  fetchEventLogs,
  createEventLog,
} from "../services/api";

// Fire-and-forget log helper — never throws so it never blocks user actions
const addLog = (payload) => {
  createEventLog({
    changedBy: "Admin",
    changedAt: new Date().toISOString(),
    ...payload,
  }).catch(() => {});
};

const EventDataContext = createContext({});

export const EventDataProvider = ({ children }) => {
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [attendees, setAttendees] = useState([]);
  const [userFields, setUserFields] = useState([]);
  const [categories, setCategories] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);

  // ── Bootstrap: load all data on mount ───────────────────────────────────
  useEffect(() => {
    setEventsLoading(true);
    fetchEvents()
      .then(setEvents)
      .catch(console.error)
      .finally(() => setEventsLoading(false));
    fetchUserFields().then(setUserFields).catch(console.error);
    fetchCategories().then(setCategories).catch(console.error);
    fetchEventTypes().then(setEventTypes).catch(console.error);
    // Load all attendees for dashboard analytics
    fetchAttendees().then(setAttendees).catch(console.error);
  }, []);

  // ── User Fields ──────────────────────────────────────────────────────────
  const addUserField = useCallback(async ({ label, type, active, options }) => {
    const payload = {
      label: label.trim(),
      type,
      active: Boolean(active),
      options: Array.isArray(options)
        ? options
        : String(options || "")
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean),
    };
    const saved = await createUserField(payload);
    setUserFields((prev) => [saved, ...prev]);
  }, []);

  const updateUserField = useCallback(async (id, updates) => {
    const saved = await patchUserField(id, updates);
    setUserFields((prev) => prev.map((f) => (f.id === id ? saved : f)));
  }, []);

  const deleteUserField = useCallback(async (id) => {
    await removeUserField(id);
    setUserFields((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // ── Event Types ──────────────────────────────────────────────────────────
  const addEventType = useCallback(async ({ label, active }) => {
    const saved = await createEventType({
      label: label.trim(),
      active: Boolean(active),
    });
    setEventTypes((prev) => [saved, ...prev]);
  }, []);

  const updateEventType = useCallback(async (id, updates) => {
    const saved = await patchEventType(id, updates);
    setEventTypes((prev) => prev.map((t) => (t.id === id ? saved : t)));
  }, []);

  const deleteEventType = useCallback(async (id) => {
    await removeEventType(id);
    setEventTypes((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Categories ───────────────────────────────────────────────────────────
  const addCategory = useCallback(async ({ label, color, active }) => {
    const saved = await createCategory({
      label: label.trim(),
      color: color || "#6c757d",
      active: Boolean(active),
    });
    setCategories((prev) => [saved, ...prev]);
  }, []);

  const updateCategory = useCallback(async (id, updates) => {
    const saved = await patchCategory(id, updates);
    setCategories((prev) => prev.map((c) => (c.id === id ? saved : c)));
  }, []);

  const deleteCategory = useCallback(async (id) => {
    await removeCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // ── Events ───────────────────────────────────────────────────────────────
  const addEvent = useCallback(async (formData) => {
    const saved = await createEvent({
      eventName: formData.eventName,
      startDate: formData.startDate,
      endDate: formData.endDate,
      venue: formData.venue || "",
      organizer: formData.organizer || "",
      eventType: formData.eventType || "",
      city: formData.city || "",
      capacity: formData.capacity || 0,
      startTime: formData.startTime || "",
      endTime: formData.endTime || "",
      description: formData.description || "",
      ...(formData.extra || {}),
      attendeeFields: formData.attendeeFieldSettings || [],
      categories: formData.categories || [],
    });
    setEvents((prev) => [saved, ...prev]);
    setSelectedEventId(saved.id);
    addLog({
      eventId: String(saved.id),
      action: "Event Created",
      entity: "event",
      entityId: String(saved.id),
      entityName: saved.eventName,
      oldData: null,
      newData: {
        eventName: saved.eventName,
        startDate: saved.startDate,
        endDate: saved.endDate,
        venue: saved.venue,
        organizer: saved.organizer,
        ...(saved.attendeeFields?.length
          ? { attendeeFields: saved.attendeeFields }
          : {}),
        ...(saved.categories?.length ? { categories: saved.categories } : {}),
      },
    });
    return saved;
  }, []);

  const updateEvent = useCallback(async (id, data, oldEvent) => {
    const saved = await patchEvent(id, data);
    setEvents((prev) => prev.map((e) => (e.id === id ? saved : e)));
    const changedFields = {};
    const oldFields = {};
    Object.keys(data).forEach((k) => {
      if (JSON.stringify(oldEvent?.[k]) !== JSON.stringify(data[k])) {
        // the registration form is large — record that it changed, not its contents
        const big = k === "form" || k === "passLayout";
        oldFields[k] = big ? "Previous design" : oldEvent?.[k];
        changedFields[k] = big ? "Design updated" : data[k];
      }
    });
    if (Object.keys(changedFields).length) {
      addLog({
        eventId: String(id),
        action: "Event Updated",
        entity: "event",
        entityId: String(id),
        entityName: saved.eventName,
        oldData: oldFields,
        newData: changedFields,
      });
    }
    return saved;
  }, []);

  const deleteEvent = useCallback(async (id, eventName) => {
    addLog({
      eventId: String(id),
      action: "Event Deleted",
      entity: "event",
      entityId: String(id),
      entityName: eventName || String(id),
      oldData: null,
      newData: null,
    });
    await removeEvent(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setAttendees((prev) => prev.filter((a) => a.eventId !== id));
    setSelectedEventId((prev) => (prev === id ? null : prev));
  }, []);

  const saveEventPassDesign = useCallback(async (id, design) => {
    const saved = await patchEvent(id, {
      passDesign: design,
      passDesignSaved: true,
    });
    setEvents((prev) => prev.map((e) => (e.id === id ? saved : e)));
    addLog({
      eventId: String(id),
      action: "Pass Design Saved",
      entity: "pass",
      entityId: String(id),
      entityName: saved.eventName,
      oldData: null,
      newData: null,
    });
  }, []);

  // ── Attendees ────────────────────────────────────────────────────────────
  const addSingleAttendee = useCallback(async (eventId, data) => {
    const saved = await createAttendee(eventId, data);
    setAttendees((prev) => [saved, ...prev]);
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? {
              ...e,
              attendeeCount: (e.attendeeCount || 0) + 1,
              status: "Active",
            }
          : e,
      ),
    );
    addLog({
      eventId: String(eventId),
      action: "Attendees Imported",
      entity: "attendee",
      entityId: String(saved.id),
      entityName: saved.name,
      oldData: null,
      newData: { name: saved.name, phone: saved.phone, email: saved.email },
    });
  }, []);

  const addAttendees = useCallback(async (eventId, list) => {
    const inserted = await bulkCreateAttendees(eventId, list);
    setAttendees((prev) => [...inserted, ...prev]);
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? {
              ...e,
              attendeeCount: (e.attendeeCount || 0) + inserted.length,
              status: "Active",
            }
          : e,
      ),
    );
    addLog({
      eventId: String(eventId),
      action: "Attendees Imported",
      entity: "attendee",
      entityId: "",
      entityName: `${inserted.length} attendees`,
      oldData: null,
      newData: {
        count: inserted.length,
        names: inserted.slice(0, 5).map((a) => a.name),
      },
    });
  }, []);

  const updateAttendee = useCallback(async (id, data, oldAttendee) => {
    const saved = await patchAttendee(id, data);
    setAttendees((prev) => prev.map((a) => (a.id === id ? saved : a)));
    const changedFields = {};
    const oldFields = {};
    Object.keys(data).forEach((k) => {
      if (JSON.stringify(oldAttendee?.[k]) !== JSON.stringify(data[k])) {
        oldFields[k] = oldAttendee?.[k];
        changedFields[k] = data[k];
      }
    });
    if (Object.keys(changedFields).length) {
      addLog({
        eventId: String(saved.eventId),
        action: "Attendee Updated",
        entity: "attendee",
        entityId: String(id),
        entityName: saved.name || String(id),
        oldData: oldFields,
        newData: changedFields,
      });
    }
    return saved;
  }, []);

  const deleteAttendee = useCallback(async (id) => {
    await removeAttendee(id);
    setAttendees((prev) => {
      const next = prev.filter((a) => a.id !== id);
      const removed = prev.find((a) => a.id === id);
      if (removed) {
        addLog({
          eventId: String(removed.eventId),
          action: "Attendee Deleted",
          entity: "attendee",
          entityId: String(id),
          entityName: removed.name || String(id),
          oldData: {
            name: removed.name,
            phone: removed.phone,
            email: removed.email,
            category: removed.category,
          },
          newData: null,
        });
        setEvents((evs) =>
          evs.map((e) =>
            e.id === removed.eventId
              ? {
                  ...e,
                  attendeeCount: next.filter(
                    (a) => a.eventId === removed.eventId,
                  ).length,
                }
              : e,
          ),
        );
      }
      return next;
    });
  }, []);

  const updateAttendeeStatus = useCallback(async (id, status) => {
    const now = new Date().toISOString();
    const updates = {
      status,
      ...(status === "checked-in" && { checkInTime: now }),
      ...(status === "checked-out" && { checkOutTime: now }),
    };
    const saved = await patchAttendee(id, updates);
    setAttendees((prev) => prev.map((a) => (a.id === id ? saved : a)));
  }, []);

  const markPassesGenerated = useCallback(async (eventId) => {
    const updated = await markAttendeesPassGenerated(eventId);
    setAttendees((prev) =>
      prev.map((a) => {
        const u = updated.find((item) => item.id === a.id);
        return u || a;
      }),
    );
    const savedEvent = await patchEvent(eventId, { passStatus: "generated" });
    setEvents((prev) => prev.map((e) => (e.id === eventId ? savedEvent : e)));
    addLog({
      eventId: String(eventId),
      action: "Passes Downloaded",
      entity: "pass",
      entityId: String(eventId),
      entityName: savedEvent.eventName,
      oldData: null,
      newData: { count: updated.length },
    });
  }, []);

  // ── Legacy bulk-import (Bulk QR Codes page) ──────────────────────────────
  const [importedRows, setImportedRows] = useState([]);

  const syncImportedRowsForEvent = useCallback(
    (eventId, parsedRows, metadata = {}) => {
      if (!eventId) return false;
      const nextRows = (parsedRows || []).map((row) => ({
        id: `${eventId}-${row.id || row.index || Date.now()}`,
        eventId,
        sourceFile: metadata.sourceFile,
        contentType: metadata.contentType,
        qrName: row.normalized?.qr_name || "",
        value: row.value || "",
        valid: Boolean(row.valid),
        duplicate: Boolean(row.duplicate),
        display: row.display || [],
        createdAt: new Date().toISOString(),
      }));
      setImportedRows((prev) => [
        ...nextRows,
        ...prev.filter((r) => r.eventId !== eventId),
      ]);
      const validCount = nextRows.filter((r) => r.valid).length;
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? {
                ...e,
                imported: validCount > 0,
                importedCount: validCount,
                status: validCount > 0 ? "Imported" : "Draft",
              }
            : e,
        ),
      );
      return true;
    },
    [],
  );

  const value = useMemo(
    () => ({
      events,
      eventsLoading,
      setEvents,
      importedRows,
      setImportedRows,
      attendees,
      setAttendees,
      selectedEventId,
      setSelectedEventId,
      userFields,
      categories,
      eventTypes,
      addEventType,
      updateEventType,
      deleteEventType,
      addUserField,
      updateUserField,
      deleteUserField,
      addCategory,
      updateCategory,
      deleteCategory,
      addEvent,
      updateEvent,
      deleteEvent,
      addSingleAttendee,
      addAttendees,
      updateAttendee,
      deleteAttendee,
      saveEventPassDesign,
      markPassesGenerated,
      updateAttendeeStatus,
      syncImportedRowsForEvent,
      fetchEventLogs,
    }),
    [
      events,
      eventsLoading,
      importedRows,
      attendees,
      selectedEventId,
      userFields,
      categories,
      eventTypes,
      addEventType,
      updateEventType,
      deleteEventType,
      addUserField,
      updateUserField,
      deleteUserField,
      addCategory,
      updateCategory,
      deleteCategory,
      addEvent,
      updateEvent,
      deleteEvent,
      addSingleAttendee,
      addAttendees,
      updateAttendee,
      deleteAttendee,
      saveEventPassDesign,
      markPassesGenerated,
      updateAttendeeStatus,
      syncImportedRowsForEvent,
    ],
  );

  return (
    <EventDataContext.Provider value={value}>
      {children}
    </EventDataContext.Provider>
  );
};

export const useEventData = () => useContext(EventDataContext);
