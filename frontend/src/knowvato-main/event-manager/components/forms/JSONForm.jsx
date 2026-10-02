import DateInput from "../../../../components/DateInput";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiPlus, FiSearch, FiRefreshCcw, FiMoreVertical } from "react-icons/fi";
import { toast } from "react-toastify";
import { useEventData } from "../context/EventDataContext";
import { BiEdit, BiUpload, BiGroup, BiTrash } from "react-icons/bi";
import { useNavigate } from "../../lib/router-shim";

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
    type: "text",
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
  } = useEventData();
  const navigate = useNavigate();

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState(() =>
    createEmptyForm(userFields, categories),
  );
  const [editData, setEditData] = useState(() =>
    createEmptyForm(userFields, categories),
  );

  const filteredEvents = useMemo(
    () =>
      events.filter((e) =>
        [e.eventName, e.venue, e.organizer]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
      ),
    [events, searchTerm],
  );

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

  const handleSave = () => {
    if (!formData.eventName || !formData.startDate || !formData.endDate) {
      toast.error("Event Name, From Date, and To Date are required.");
      return;
    }
    addEvent(formData);
    toast.success('"' + formData.eventName + '" created.');
    setFormData(createEmptyForm(userFields, categories));
    setIsCreating(false);
  };

  const handleEditSave = (eventId) => {
    if (!editData.eventName || !editData.startDate || !editData.endDate) {
      toast.error("Event Name, From Date, and To Date are required.");
      return;
    }
    updateEvent(eventId, editData);
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
    deleteEvent(event.id);
    toast.success('"' + event.eventName + '" deleted.');
  };

  const handleUploadData = (event) =>
    navigate("/events/" + event.id + "/upload");

  const handleAttendees = (event) => {
    setSelectedEventId(event.id);
    navigate("/attendees?event=" + event.id);
  };

  const startEdit = (event) => {
    setEditingId(event.id);
    setEditData({
      eventName: event.eventName,
      startDate: event.startDate,
      endDate: event.endDate,
      venue: event.venue,
      organizer: event.organizer,
      attendeeFieldSettings: buildAttendeeFieldSettings(
        userFields,
        event.attendeeFields || [],
      ),
      categories: buildCategorySettings(categories, event.categories || []),
    });
  };

  const cancelCreate = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormData(createEmptyForm(userFields, categories));
  };

  return (
    <div className="container-fluid p-2 fade-in">
      {/* Header */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body p-3">
          <nav aria-label="breadcrumb" className="mb-2">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item">
                <span className="text-muted">Manage Event</span>
              </li>
              {isCreating || editingId ? (
                <React.Fragment>
                  <li className="breadcrumb-item">
                    <button
                      type="button"
                      className="btn btn-link p-0 text-decoration-none"
                      style={{ fontSize: "inherit", lineHeight: "inherit" }}
                      onClick={cancelCreate}
                    >
                      Create Event
                    </button>
                  </li>
                  <li className="breadcrumb-item active">
                    {isCreating ? "New Event" : "Edit Event"}
                  </li>
                </React.Fragment>
              ) : (
                <li className="breadcrumb-item active">Create Event</li>
              )}
            </ol>
          </nav>

          <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-sm-between gap-2">
            <div className="d-flex flex-column flex-sm-row gap-2 flex-grow-1">
              <h2 className="fw-bold mb-0 me-3">Events</h2>
              <div className="input-group" style={{ maxWidth: 280 }}>
                <span className="input-group-text bg-white">
                  <FiSearch size={15} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search event..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setSearchTerm("")}
              >
                <FiRefreshCcw className="me-1" /> Refresh
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setIsCreating(true);
                  setEditingId(null);
                  setFormData(createEmptyForm(userFields, categories));
                }}
              >
                <FiPlus className="me-1" /> Add Event
              </button>
            </div>
          </div>
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

      {/* Event list */}
      {!isCreating && (
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
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-5 text-muted">
                          No events found. Click <strong>Add Event</strong> to
                          create one.
                        </td>
                      </tr>
                    ) : (
                      filteredEvents.map((event) => {
                        if (editingId === event.id) {
                          return (
                            <tr key={event.id} className="table-warning">
                              <td colSpan={6} className="p-3">
                                <EventForm
                                  data={editData}
                                  onChange={handleInput(setEditData)}
                                  {...makeToggles(editData, true)}
                                />
                                <div className="d-flex gap-2 mt-2">
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleEditSave(event.id)}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm"
                                    onClick={() => setEditingId(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={event.id}>
                            <td>
                              <div className="fw-semibold">
                                {event.eventName}
                              </div>
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
                              <StatusBadge status={event.status} />
                            </td>
                            <td className="text-center">
                              <ActionDropdown
                                onEdit={() => startEdit(event)}
                                onUpload={() => handleUploadData(event)}
                                onAttendees={() => handleAttendees(event)}
                                onDelete={() => handleDelete(event)}
                              />
                            </td>
                          </tr>
                        );
                      })
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
                    {editingId === event.id ? (
                      <React.Fragment>
                        <EventForm
                          data={editData}
                          onChange={handleInput(setEditData)}
                          {...makeToggles(editData, true)}
                        />
                        <div className="d-flex gap-2 mt-2">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleEditSave(event.id)}
                          >
                            Save
                          </button>
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </React.Fragment>
                    ) : (
                      <React.Fragment>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <div className="fw-bold">{event.eventName}</div>
                            <small className="text-muted">
                              {event.attendeeCount || 0} attendees
                            </small>
                          </div>
                          <StatusBadge status={event.status} />
                        </div>
                        <div className="row g-1 small text-muted mb-3">
                          <div className="col-12">
                            {event.startDate} - {event.endDate}
                          </div>
                          <div className="col-12">
                            {event.venue || "\u2014"}
                          </div>
                          <div className="col-12">
                            {event.organizer || "\u2014"}
                          </div>
                        </div>
                        <ActionDropdown
                          onEdit={() => startEdit(event)}
                          onUpload={() => handleUploadData(event)}
                          onAttendees={() => handleAttendees(event)}
                          onDelete={() => handleDelete(event)}
                          fullWidth
                        />
                      </React.Fragment>
                    )}
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
}) => {
  return (
    <div className="row g-3">
      {/* LEFT column: basic info + attendee fields */}
      <div className="col-12 col-lg-6">
        <div className="card border-0 shadow-sm">
          <div className="card-body p-3">
            <div className="row g-2">
              <div className="col-12 col-md-6">
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
              <div className="col-12 col-md-6">
                <label className="form-label small fw-semibold mb-1">
                  Venue
                </label>
                <input
                  className="form-control form-control-sm"
                  name="venue"
                  value={data.venue}
                  onChange={onChange}
                  placeholder="Enter venue"
                />
              </div>
              <div className="col-6 col-md-3">
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
              <div className="col-6 col-md-3">
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

            {/* Attendee fields */}
            <div className="card border-0 shadow-sm mt-3">
              <div className="card-body p-3">
                <h5 className="fw-semibold mb-1">Attendee Details</h5>
                <p className="small text-muted mb-3">
                  Select the attendee fields to collect.
                </p>
                <div className="row g-2">
                  {data.attendeeFieldSettings?.map((field) => (
                    <div key={field.fieldId} className="col-12">
                      <div className="border rounded-2 p-3 d-flex flex-column flex-md-row justify-content-between gap-3 align-items-start align-items-md-center">
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
                        <div className="d-flex flex-column flex-sm-row gap-2 align-items-start">
                          <label className="form-check form-check-inline mb-0">
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
                              "form-check form-check-inline mb-0" +
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
                            <span className="form-check-label">Required</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* END left column */}

      {/* RIGHT column: categories */}
      <div className="col-12 col-lg-6">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-body p-3">
            <h5 className="fw-semibold mb-1">Categories</h5>
            <p className="small text-muted mb-3">
              Choose which category options should be available for this event.
            </p>
            <div className="row g-2">
              {data.categories?.length === 0 ? (
                <div className="col-12 text-muted small">
                  No active categories available. Add categories in Setup.
                </div>
              ) : (
                data.categories?.map((category) => (
                  <div key={category.categoryId} className="col-12">
                    <div className="border rounded-2 p-3 d-flex flex-column flex-md-row justify-content-between gap-3 align-items-start align-items-md-center">
                      <div className="flex-grow-1">
                        <div className="fw-semibold d-flex align-items-center gap-2">
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
                        <div className="small text-muted mt-1">
                          {category.color.toUpperCase()}
                        </div>
                      </div>
                      <div className="form-check form-check-inline mb-0">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={category.enabled}
                          onChange={() => onCategoryToggle(category.categoryId)}
                        />
                        <span className="form-check-label">Use</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      {/* END right column */}
    </div>
  );
};

// ── StatusBadge ───────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const map = {
    Draft: "bg-warning text-dark",
    Active: "bg-success",
    Imported: "bg-info text-dark",
  };
  return (
    <span className={"badge " + (map[status] || "bg-secondary")}>
      {status || "Draft"}
    </span>
  );
};

// ── ActionDropdown ────────────────────────────────────────────────────────────

const ActionDropdown = ({
  onEdit,
  onUpload,
  onAttendees,
  onDelete,
  fullWidth,
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

  // FIX: icon is already a JSX element — was incorrectly accessed as icon.icon before
  const ITEMS = [
    { label: "Edit Event", icon: <BiEdit />, fn: onEdit },
    { label: "Upload Data", icon: <BiUpload />, fn: onUpload },
    { label: "Attendees", icon: <BiGroup />, fn: onAttendees },
  ];

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
        <FiMoreVertical size={15} />
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: pos.top,
            right: pos.right,
            zIndex: 9999,
            background: "#fff",
            border: "1px solid #e2e8f0",
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
              <span>{icon}</span>
              {label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid #f1f5f9", margin: "4px 0" }} />
          <button
            type="button"
            className="dropdown-item py-2 px-3 text-danger d-flex align-items-center gap-2"
            onClick={() => choose(onDelete)}
          >
            <span>
              <BiTrash />
            </span>
            Delete
          </button>
        </div>
      )}
    </React.Fragment>
  );
};

export default CreateEventPage;
