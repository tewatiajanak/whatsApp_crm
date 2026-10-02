import DateInput from "../../../components/DateInput";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiPlus, FiSearch, FiFilter } from "react-icons/fi";
import { toast } from "react-toastify";
import { useEventData } from "../context/EventDataContext";
import { useNavigate, useSearchParams } from "../lib/router-shim";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_SYSTEM_FIELDS = [
  {
    fieldId: "name",
    label: "Name",
    type: "text",
    enabled: true,
    required: true,
  },
  {
    fieldId: "email",
    label: "Email",
    type: "text",
    enabled: true,
    required: false,
  },
  {
    fieldId: "mobile",
    label: "Mobile Number",
    type: "number",
    enabled: true,
    required: false,
  },
];

const EMPTY_FORM = {
  eventName: "",
  startDate: "",
  endDate: "",
  venue: "",
  organizer: "",
  eventType: "",
  attendeeFieldSettings: DEFAULT_SYSTEM_FIELDS,
  categories: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const buildAttendeeFieldSettings = (userFields, existingSettings = []) => {
  const existingMap = new Map(
    existingSettings.map((item) => [item.fieldId, item]),
  );

  const systemSettings = DEFAULT_SYSTEM_FIELDS.map((field) => ({
    ...field,
    enabled: existingMap.has(field.fieldId)
      ? existingMap.get(field.fieldId).enabled
      : field.enabled,
    required: existingMap.has(field.fieldId)
      ? existingMap.get(field.fieldId).required
      : field.required,
  }));

  const activeUserFields = userFields
    .filter((f) => f.active)
    .map((f) => {
      const existing = existingMap.get(f.id);
      return {
        fieldId: f.id,
        label: f.label,
        type: f.type,
        enabled: existing ? existing.enabled : false,
        required: existing ? existing.required : false,
        options: f.options || [],
      };
    });

  const missingExisting = existingSettings.filter(
    (s) =>
      !DEFAULT_SYSTEM_FIELDS.some((f) => f.fieldId === s.fieldId) &&
      !userFields.some((f) => f.id === s.fieldId),
  );

  return [...systemSettings, ...activeUserFields, ...missingExisting];
};

const buildCategorySettings = (categories, existingSettings = []) => {
  const existingMap = new Map(
    existingSettings.map((item) => [item.categoryId, item]),
  );
  return categories
    .filter((c) => c.active)
    .map((c) => ({
      categoryId: c.id,
      label: c.label,
      color: c.color,
      enabled: existingMap.has(c.id) ? existingMap.get(c.id).enabled : false,
    }));
};

const createEmptyForm = (userFields, categories) => ({
  ...EMPTY_FORM,
  attendeeFieldSettings: buildAttendeeFieldSettings(userFields, []),
  categories: buildCategorySettings(categories, []),
});

// ── CreateEventPage ───────────────────────────────────────────────────────────

const CreateEventPage = () => {
  const {
    events,
    addEvent,
    updateEvent,
    deleteEvent,
    setSelectedEventId,
    userFields,
    categories,
    eventTypes,
  } = useEventData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isCreating = searchParams.get("mode") === "new";

  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState({
    eventType: "",
    fromDate: "",
    toDate: "",
  });
  const filterRef = useRef(null);

  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target))
        setFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);
  const [formData, setFormData] = useState(() =>
    createEmptyForm(userFields, categories),
  );
  const [editData, setEditData] = useState(() =>
    createEmptyForm(userFields, categories),
  );

  const activeFilterCount = [
    filter.eventType,
    filter.fromDate,
    filter.toDate,
  ].filter(Boolean).length;

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (
        searchTerm &&
        ![e.eventName, e.venue, e.organizer]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      )
        return false;
      if (filter.eventType && e.eventType !== filter.eventType) return false;
      if (filter.fromDate && e.startDate < filter.fromDate) return false;
      if (filter.toDate && e.endDate > filter.toDate) return false;
      return true;
    });
  }, [events, searchTerm, filter]);

  const handleInput = (setter) => (e) => {
    const { name, value } = e.target;
    setter((prev) => ({ ...prev, [name]: value }));
  };

  const updateAttendeeFieldSetting = (fieldId, updates, isEdit = false) => {
    const setter = isEdit ? setEditData : setFormData;
    setter((prev) => ({
      ...prev,
      attendeeFieldSettings: prev.attendeeFieldSettings.map((f) =>
        f.fieldId === fieldId ? { ...f, ...updates } : f,
      ),
    }));
  };

  const updateCategorySetting = (categoryId, updates, isEdit = false) => {
    const setter = isEdit ? setEditData : setFormData;
    setter((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.categoryId === categoryId ? { ...c, ...updates } : c,
      ),
    }));
  };

  const makeToggles = (data, isEdit) => ({
    onFieldToggle: (fieldId) =>
      updateAttendeeFieldSetting(
        fieldId,
        {
          enabled: !data.attendeeFieldSettings.find(
            (f) => f.fieldId === fieldId,
          )?.enabled,
        },
        isEdit,
      ),
    onFieldRequiredToggle: (fieldId) =>
      updateAttendeeFieldSetting(
        fieldId,
        {
          required: !data.attendeeFieldSettings.find(
            (f) => f.fieldId === fieldId,
          )?.required,
        },
        isEdit,
      ),
    onCategoryToggle: (categoryId) =>
      updateCategorySetting(
        categoryId,
        {
          enabled: !data.categories.find((c) => c.categoryId === categoryId)
            ?.enabled,
        },
        isEdit,
      ),
  });

  const handleSave = async () => {
    if (!formData.eventName || !formData.startDate || !formData.endDate) {
      toast.error("Event Name, From Date, and To Date are required.");
      return;
    }
    try {
      await addEvent(formData);
      toast.success('"' + formData.eventName + '" created.');
      setFormData(createEmptyForm(userFields, categories));
      navigate("/events");
    } catch (err) {
      toast.error(err.message || "Failed to create event.");
    }
  };

  const handleEditSave = (eventId) => {
    if (!editData.eventName || !editData.startDate || !editData.endDate) {
      toast.error("Event Name, From Date, and To Date are required.");
      return;
    }
    const oldEvent = events.find((e) => e.id === eventId);
    // Schema field is `attendeeFields`; editData uses `attendeeFieldSettings` — remap before saving
    const { attendeeFieldSettings, ...rest } = editData;
    const dataToSave = { ...rest, attendeeFields: attendeeFieldSettings };
    updateEvent(eventId, dataToSave, oldEvent);
    toast.success("Event updated.");
    setEditingId(null);
  };

  const handleDelete = (event) => {
    if (
      !window.confirm(
        'Delete "' +
          event.eventName +
          '"? This will also remove all attendees.',
      )
    )
      return;
    deleteEvent(event.id, event.eventName);
    toast.success('"' + event.eventName + '" deleted.');
  };

  const handleUploadData = (event) =>
    navigate("/events/" + event.id + "/upload");

  const handleAttendees = (event) => {
    navigate("/events/" + event.id + "/attendees");
  };

  const startEdit = (event) => {
    setEditingId(event.id);
    setEditData({
      eventName: event.eventName,
      startDate: event.startDate,
      endDate: event.endDate,
      venue: event.venue,
      organizer: event.organizer,
      eventType: event.eventType || "",
      attendeeFieldSettings: buildAttendeeFieldSettings(
        userFields,
        event.attendeeFields || [],
      ),
      categories: buildCategorySettings(categories, event.categories || []),
    });
  };

  const cancelCreate = () => {
    setEditingId(null);
    setFormData(createEmptyForm(userFields, categories));
    navigate("/events");
  };

  return (
    <div className="container-fluid p-2 fade-in">
      {/* Header */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body p-3">
          {(isCreating || editingId) && (
            <nav aria-label="breadcrumb" className="mb-2">
              <ol className="breadcrumb mb-0 app-breadcrumb">
                <li className="breadcrumb-item flex-shrink-0">
                  <button
                    type="button"
                    className="btn btn-link p-0 text-decoration-none"
                    style={{
                      fontSize: "inherit",
                      lineHeight: "inherit",
                      whiteSpace: "nowrap",
                    }}
                    onClick={cancelCreate}
                  >
                    Events
                  </button>
                </li>
                <li
                  className="breadcrumb-item active text-truncate"
                  style={{ minWidth: 0 }}
                >
                  {isCreating ? "New Event" : "Edit Event"}
                </li>
              </ol>
            </nav>
          )}

          {!isCreating && !editingId && (
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
                <h2 className="fw-bold mb-0 me-2">Events</h2>

                {/* Filter button with dropdown */}
                <div className="position-relative" ref={filterRef}>
                  <button
                    type="button"
                    className={`btn btn-sm d-inline-flex align-items-center justify-content-center gap-1.5 ${
                      activeFilterCount > 0 ? "btn-primary" : "btn-outline-secondary"
                    }`}
                    style={{ height: "36px", minHeight: "36px", fontSize: "13px", fontWeight: "500", borderRadius: "6px", padding: "0 12px" }}
                    onClick={() => setFilterOpen((o) => !o)}
                  >
                    <FiFilter className="flex-shrink-0" style={{ fontSize: "15px" }} />
                    <span>Filter</span>
                    {activeFilterCount > 0 && (
                      <span
                        className="badge bg-white text-primary ms-1"
                        style={{ fontSize: "10px" }}
                      >
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  {filterOpen && (
                    <div
                      className="card border-0 shadow-md"
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        zIndex: 999,
                        minWidth: 280,
                        padding: "0.85rem",
                        borderRadius: "8px",
                      }}
                    >
                      <div className="mb-2">
                        <label className="form-label small fw-semibold mb-1">
                          Event Type
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={filter.eventType}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              eventType: e.target.value,
                            }))
                          }
                        >
                          <option value="">All types</option>
                          {eventTypes
                            .filter((t) => t.active)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.label}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="mb-2">
                        <label className="form-label small fw-semibold mb-1">
                          From Date
                        </label>
                        <DateInput
                          className="form-control form-control-sm"
                          value={filter.fromDate}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              fromDate: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label small fw-semibold mb-1">
                          To Date
                        </label>
                        <DateInput
                          className="form-control form-control-sm"
                          value={filter.toDate}
                          onChange={(e) =>
                            setFilter((f) => ({ ...f, toDate: e.target.value }))
                          }
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary w-100 d-inline-flex align-items-center justify-content-center gap-1.5"
                        style={{ height: "32px", fontSize: "12px" }}
                        onClick={() => {
                          setFilter({
                            eventType: "",
                            fromDate: "",
                            toDate: "",
                          });
                          setFilterOpen(false);
                        }}
                      >
                        <span>Clear Filters</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Search */}
                <div
                  className="position-relative"
                  style={{ maxWidth: 260, width: "100%" }}
                >
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Search event..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ height: "36px", fontSize: "13px", borderRadius: "6px", paddingRight: "2.2rem" }}
                  />
                  <FiSearch
                    className="text-muted"
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      fontSize: "15px",
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-sm d-inline-flex align-items-center justify-content-center gap-1.5 shadow-xs"
                style={{ height: "36px", minHeight: "36px", fontSize: "13px", fontWeight: "500", borderRadius: "6px", padding: "0 14px" }}
                onClick={() => {
                  setEditingId(null);
                  setFormData(createEmptyForm(userFields, categories));
                  navigate("/events?mode=new");
                }}
              >
                <FiPlus className="flex-shrink-0" style={{ fontSize: "16px" }} />
                <span>Add Event</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create form */}
      {isCreating && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body p-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold mb-0">New Event</h5>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={cancelCreate}
              >
                Cancel
              </button>
            </div>
            <EventForm
              data={formData}
              onChange={handleInput(setFormData)}
              {...makeToggles(formData, false)}
              eventTypes={eventTypes}
            />
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={cancelCreate}
              >
                Discard
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSave}
              >
                Save Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit form \u2014 standalone card, same style as create */}
      {editingId && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body p-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold mb-0">Edit Event</h5>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </button>
            </div>
            <EventForm
              data={editData}
              onChange={handleInput(setEditData)}
              {...makeToggles(editData, true)}
              eventTypes={eventTypes}
            />
            <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-link btn-sm p-0"
                style={{ fontSize: 12, color: "var(--muted-foreground)" }}
                onClick={() => navigate(`/events/${editingId}/logs`)}
              >
                <i className="bi bi-clock-history me-1" />
                Activity Log
              </button>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setEditingId(null)}
                >
                  Discard
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleEditSave(editingId)}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event list \u2014 only when not creating or editing */}
      {!isCreating && !editingId && (
        <React.Fragment>
          {/* Desktop table */}
          <div className="card border-0 shadow-sm d-none d-md-block">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Event</th>
                      <th>Dates</th>
                      <th>Venue</th>
                      <th>Organizer</th>
                      <th>Status</th>
                      <th>Pass</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-5 text-muted">
                          No events found. Click <strong>Add Event</strong> to
                          create one.
                        </td>
                      </tr>
                    ) : (
                      filteredEvents.map((event) => (
                        <tr key={event.id}>
                          <td>
                            <div className="fw-semibold">{event.eventName}</div>
                            <small className="text-muted">
                              {event.attendeeCount || 0} attendees
                            </small>
                          </td>
                          <td>
                            <div>{event.startDate}</div>
                            <small className="text-muted">
                              to {event.endDate}
                            </small>
                          </td>
                          <td>{event.venue || "\u2014"}</td>
                          <td>{event.organizer || "\u2014"}</td>
                          <td>
                            <StatusBadge event={event} />
                          </td>
                          <td>
                            <PassStatusBadge event={event} />
                          </td>
                          <td className="text-center">
                            <ActionDropdown
                              onEdit={() => startEdit(event)}
                              onUpload={() => handleUploadData(event)}
                              onAttendees={() => handleAttendees(event)}
                              onLogs={() =>
                                navigate(`/events/${event.id}/logs`)
                              }
                              onDelete={() => handleDelete(event)}
                              isPast={
                                !!event.endDate &&
                                event.endDate <
                                  new Date().toISOString().split("T")[0]
                              }
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="d-md-none">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-5 text-muted">
                No events found.
              </div>
            ) : (
              filteredEvents.map((event) => (
                <div key={event.id} className="card border-0 shadow-sm mb-3">
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <div className="fw-bold">{event.eventName}</div>
                        <small className="text-muted">
                          {event.attendeeCount || 0} attendees
                        </small>
                      </div>
                      <div className="d-flex flex-column align-items-end gap-1">
                        <StatusBadge event={event} />
                        <PassStatusBadge event={event} />
                      </div>
                    </div>
                    <div className="row g-1 small text-muted mb-3">
                      <div className="col-12">
                        {event.startDate} - {event.endDate}
                      </div>
                      <div className="col-12">{event.venue || "\u2014"}</div>
                      <div className="col-12">
                        {event.organizer || "\u2014"}
                      </div>
                    </div>
                    <ActionDropdown
                      onEdit={() => startEdit(event)}
                      onUpload={() => handleUploadData(event)}
                      onAttendees={() => handleAttendees(event)}
                      onLogs={() => navigate(`/events/${event.id}/logs`)}
                      onDelete={() => handleDelete(event)}
                      isPast={
                        !!event.endDate &&
                        event.endDate < new Date().toISOString().split("T")[0]
                      }
                      fullWidth
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </React.Fragment>
      )}
    </div>
  );
};

// ── EventForm ─────────────────────────────────────────────────────────────────

const EventForm = ({
  data,
  onChange,
  onFieldToggle,
  onFieldRequiredToggle,
  onCategoryToggle,
  eventTypes = [],
}) => {
  return (
    <div>
      {/* ── Top row: key fields ── */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body p-3">
          <div className="row g-2">
            <div className="col-12 col-md-4">
              <label className="form-label small fw-semibold mb-1">
                Event Name *
              </label>
              <input
                className="form-control form-control-sm"
                name="eventName"
                value={data.eventName}
                onChange={onChange}
                placeholder="e.g. Annual Conference 2025"
              />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold mb-1">
                From Date *
              </label>
              <DateInput
                className="form-control form-control-sm"
                name="startDate"
                value={data.startDate}
                onChange={onChange}
              />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold mb-1">
                To Date *
              </label>
              <DateInput
                className="form-control form-control-sm"
                name="endDate"
                value={data.endDate}
                onChange={onChange}
              />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label small fw-semibold mb-1">
                Event Type
              </label>
              <select
                className="form-select form-select-sm"
                name="eventType"
                value={data.eventType}
                onChange={onChange}
              >
                <option value="">— Select type —</option>
                {eventTypes
                  .filter((t) => t.active)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
              </select>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label small fw-semibold mb-1">Venue</label>
              <input
                className="form-control form-control-sm"
                name="venue"
                value={data.venue}
                onChange={onChange}
                placeholder="Enter venue"
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label small fw-semibold mb-1">
                Organizer
              </label>
              <input
                className="form-control form-control-sm"
                name="organizer"
                value={data.organizer}
                onChange={onChange}
                placeholder="Organizer name"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom: Attendee Details (left) + Categories (right) ── */}
      <div className="row g-3">
        {/* LEFT: Attendee Details */}
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-3">
              <h5 className="fw-semibold mb-1">Attendee Details</h5>
              <p className="small text-muted mb-3">
                Select the attendee fields to collect.
              </p>
              <div className="row g-2">
                {data.attendeeFieldSettings?.map((field) => (
                  <div key={field.fieldId} className="col-12">
                    <div className="border rounded-2 p-3 d-flex justify-content-between align-items-center gap-3">
                      <div className="flex-grow-1">
                        <div className="fw-semibold">{field.label}</div>
                        <div className="small text-muted">
                          {field.type === "multiple-choice"
                            ? "Multiple choice"
                            : field.type === "choice"
                              ? "Choice"
                              : field.type}
                        </div>
                        {field.options?.length > 0 && (
                          <div className="small text-muted mt-1">
                            Options: {field.options.join(", ")}
                          </div>
                        )}
                      </div>
                      <div className="d-flex gap-3">
                        <label className="form-check mb-0">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={field.enabled}
                            onChange={() => onFieldToggle(field.fieldId)}
                          />
                          <span className="form-check-label">Use</span>
                        </label>
                        <label
                          className={
                            "form-check mb-0" +
                            (!field.enabled ? " text-muted" : "")
                          }
                        >
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={field.required}
                            disabled={!field.enabled}
                            onChange={() =>
                              onFieldRequiredToggle(field.fieldId)
                            }
                          />
                          <span className="form-check-label">Mandatory</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Categories */}
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-3">
              <h5 className="fw-semibold mb-1">Categories</h5>
              <p className="small text-muted mb-3">
                Choose which category options should be available for this
                event.
              </p>
              <div className="row g-2">
                {data.categories?.length === 0 ? (
                  <div className="col-12 text-muted small">
                    No active categories available. Add categories in Setup.
                  </div>
                ) : (
                  data.categories?.map((category) => (
                    <div key={category.categoryId} className="col-12">
                      <div className="border rounded-2 p-3 d-flex justify-content-between align-items-center gap-3">
                        <div className="d-flex align-items-center gap-2 fw-semibold">
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              display: "inline-block",
                              borderRadius: 4,
                              background: category.color,
                            }}
                          />
                          {category.label}
                        </div>
                        <label className="form-check mb-0">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={category.enabled}
                            onChange={() =>
                              onCategoryToggle(category.categoryId)
                            }
                          />
                          <span className="form-check-label">Use</span>
                        </label>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── StatusBadge ───────────────────────────────────────────────────────────────

const getEventStatus = (event) => {
  if (
    event.status === "Active" &&
    event.endDate &&
    event.endDate < new Date().toISOString().split("T")[0]
  )
    return "Completed";
  return event.status || "Draft";
};

const StatusBadge = ({ event }) => {
  const status = getEventStatus(event);
  const colorMap = {
    Draft: "var(--warning)",
    Active: "var(--success)",
    Completed: "var(--muted-foreground)",
  };
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: colorMap[status] || "var(--muted-foreground)",
      }}
    >
      {status}
    </span>
  );
};

// ── PassStatusBadge ───────────────────────────────────────────────────────────

const PassStatusBadge = ({ event }) => {
  if (event.passStatus === "sent")
    return (
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--success)" }}>
        Sent
      </span>
    );
  if (event.passDesignSaved || event.passStatus === "generated")
    return (
      <i
        className="bi bi-check-lg"
        style={{ color: "var(--success)", fontSize: 16 }}
      />
    );
  return <span className="text-muted">—</span>;
};

// ── EventLogsModal ────────────────────────────────────────────────────────────

const ACTION_META = {
  "Event Created": { icon: "bi-plus-circle", color: "var(--success)" },
  "Event Updated": { icon: "bi-pencil", color: "var(--info)" },
  "Event Deleted": { icon: "bi-trash", color: "var(--destructive)" },
  "Attendees Imported": { icon: "bi-cloud-upload", color: "var(--info)" },
  "Attendee Updated": { icon: "bi-person-check", color: "var(--warning)" },
  "Attendee Deleted": { icon: "bi-person-x", color: "var(--destructive)" },
  "Pass Design Saved": { icon: "bi-qr-code", color: "var(--primary)" },
  "Passes Downloaded": { icon: "bi-download", color: "var(--success)" },
};

const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const renderDiff = (oldData, newData) => {
  if (!oldData && !newData) return null;
  if (!oldData && newData) {
    return (
      <div className="mt-1" style={{ fontSize: 11, color: "var(--foreground)" }}>
        {Object.entries(newData).map(([k, v]) => (
          <div key={k}>
            <span className="text-muted">{k}:</span>{" "}
            {Array.isArray(v) ? v.join(", ") : String(v ?? "—")}
          </div>
        ))}
      </div>
    );
  }
  if (oldData && !newData) {
    return (
      <div className="mt-1" style={{ fontSize: 11, color: "var(--destructive)" }}>
        {Object.entries(oldData).map(([k, v]) => (
          <div key={k}>
            <span className="text-muted">{k}:</span> {String(v ?? "—")}
          </div>
        ))}
      </div>
    );
  }
  const keys = new Set([
    ...Object.keys(oldData || {}),
    ...Object.keys(newData || {}),
  ]);
  return (
    <div className="mt-1" style={{ fontSize: 11 }}>
      {[...keys].map((k) => (
        <div key={k} className="d-flex gap-2 align-items-baseline flex-wrap">
          <span className="text-muted" style={{ minWidth: 80 }}>
            {k}:
          </span>
          <span style={{ color: "var(--destructive)", textDecoration: "line-through" }}>
            {String(oldData?.[k] ?? "—")}
          </span>
          <i
            className="bi bi-arrow-right"
            style={{ fontSize: 9, color: "var(--muted-foreground)" }}
          />
          <span style={{ color: "var(--success)" }}>
            {String(newData?.[k] ?? "—")}
          </span>
        </div>
      ))}
    </div>
  );
};

const EventLogsModal = ({ event, onClose }) => {
  const { fetchEventLogs } = useEventData();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchEventLogs(event.id)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [event.id, fetchEventLogs]);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal-sheet"
        style={{
          maxWidth: 560,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h6 className="fw-bold mb-0">Activity Log</h6>
            <small className="text-muted">{event.eventName}</small>
          </div>
          <button type="button" className="btn-close" onClick={onClose} />
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div className="text-center text-muted py-4">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="text-center text-muted py-4">
              No activity recorded yet.
            </div>
          ) : (
            <div style={{ position: "relative", paddingLeft: 28 }}>
              <div
                style={{
                  position: "absolute",
                  left: 10,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: "var(--border)",
                }}
              />
              {logs.map((log) => {
                const meta = ACTION_META[log.action] || {
                  icon: "bi-circle",
                  color: "var(--muted-foreground)",
                };
                return (
                  <div
                    key={log._id}
                    className="mb-3"
                    style={{ position: "relative" }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: -28,
                        top: 2,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "var(--card)",
                        border: `2px solid ${meta.color}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <i
                        className={`bi ${meta.icon}`}
                        style={{ fontSize: 9, color: meta.color }}
                      />
                    </div>
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: meta.color,
                        }}
                      >
                        {log.action}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--muted-foreground)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fmtDate(log.changedAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                      {log.entityName && <span>{log.entityName}</span>}
                      <span className="ms-2 text-muted">
                        by {log.changedBy}
                      </span>
                    </div>
                    {renderDiff(log.oldData, log.newData)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── ActionDropdown ────────────────────────────────────────────────────────────

const ActionDropdown = ({
  onEdit,
  onUpload,
  onAttendees,
  onDelete,
  onLogs,
  fullWidth,
  isPast,
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        close();
      }
    };
    const onScroll = () => close();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((o) => !o);
  };

  const choose = (fn) => {
    fn();
    close();
  };

  const ITEMS = [
    !isPast && { label: "Edit Event", icon: "bi bi-pencil", fn: onEdit },
    { label: "Upload Data", icon: "bi bi-upload", fn: onUpload },
    { label: "Attendees", icon: "bi bi-people", fn: onAttendees },
    { label: "Activity Log", icon: "bi bi-clock-history", fn: onLogs },
  ].filter(Boolean);

  return (
    <React.Fragment>
      <button
        ref={btnRef}
        type="button"
        className={
          "btn btn-sm btn-outline-secondary" + (fullWidth ? " w-100" : "")
        }
        onClick={toggle}
        aria-label="Actions"
      >
        <i className="bi bi-list" />
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: pos.top,
            right: pos.right,
            zIndex: 9999,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 8px 28px rgba(15,23,42,0.14)",
            minWidth: 148,
            padding: "4px 0",
            fontSize: 13,
          }}
        >
          {ITEMS.map(({ label, icon, fn }) => (
            <button
              key={label}
              type="button"
              className="dropdown-item py-2 px-3 d-flex align-items-center gap-2"
              onClick={() => choose(fn)}
            >
              <i className={icon} />
              {label}
            </button>
          ))}
          {!isPast && (
            <React.Fragment>
              <div
                style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }}
              />
              <button
                type="button"
                className="dropdown-item py-2 px-3 text-danger d-flex align-items-center gap-2"
                onClick={() => choose(onDelete)}
              >
                <i className="bi bi-trash" />
                Delete
              </button>
            </React.Fragment>
          )}
        </div>
      )}
    </React.Fragment>
  );
};

export default CreateEventPage;
