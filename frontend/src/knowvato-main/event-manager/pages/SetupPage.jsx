import React, { useState, useEffect, lazy, Suspense } from "react";
const PassTemplateTab = lazy(() => import("./PassTemplateEditor"));
const FormDesignerPage = lazy(() => import("./FormDesignerPage"));
const FormTemplatePage = lazy(() => import("./FormTemplatePage"));
import { useEventData } from "../context/EventDataContext";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useAuth } from "../context/AuthContext";
import {
  FiPlus,
  FiTrash2,
  FiUser,
  FiShield,
  FiEdit2,
  FiX,
  FiClock,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import {
  fetchUserTypes,
  createUserType,
  patchUserType,
  removeUserType,
  fetchAppUsers,
  createAppUser,
  patchAppUser,
  removeAppUser,
} from "../services/api";

// ── Constants ─────────────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "date", label: "Date" },
  { value: "choice", label: "Choice" },
  { value: "multiple-choice", label: "Multiple Choice" },
];

const PERMISSION_GROUPS = [
  {
    group: "Events",
    color: "var(--info)",
    bg: "#eff6ff",
    permissions: [
      { key: "events.view", label: "View Events" },
      { key: "events.create", label: "Create Event" },
      { key: "events.edit", label: "Edit Event" },
      { key: "events.delete", label: "Delete Event" },
    ],
  },
  {
    group: "Attendees",
    color: "var(--success)",
    bg: "#f0fdf4",
    permissions: [
      { key: "attendees.view", label: "View Attendees" },
      { key: "attendees.add", label: "Add Attendee" },
      { key: "attendees.import", label: "Import (CSV / JSON)" },
      { key: "attendees.edit", label: "Edit Attendee" },
      { key: "attendees.delete", label: "Delete Attendee" },
      { key: "attendees.export", label: "Export Attendees" },
    ],
  },
  {
    group: "Pass",
    color: "var(--warning)",
    bg: "#fffbeb",
    permissions: [
      { key: "pass.design", label: "Design Pass" },
      { key: "pass.generate", label: "Generate Pass" },
      { key: "pass.download", label: "Download Pass" },
    ],
  },
  {
    group: "Scan",
    color: "var(--primary)",
    bg: "#faf5ff",
    permissions: [
      { key: "scan.access", label: "Access Scan Page" },
      { key: "scan.checkin", label: "Check In" },
      { key: "scan.checkout", label: "Check Out" },
      { key: "scan.stats", label: "View Scan Stats" },
      { key: "scan.search", label: "Manual Search Check-in" },
    ],
  },
  {
    group: "Reports & Activity",
    color: "#6366F1",
    bg: "#eef2ff",
    permissions: [
      { key: "reports.dashboard", label: "View Dashboard" },
      { key: "reports.attendance", label: "View Attendance Records" },
      { key: "reports.activity", label: "View Activity Log" },
      { key: "reports.export", label: "Export Reports" },
    ],
  },
  {
    group: "Setup",
    color: "var(--muted-foreground)",
    bg: "var(--background)",
    permissions: [
      { key: "setup.access", label: "Access Setup" },
      { key: "setup.userTypes", label: "Manage User Types" },
      { key: "setup.users", label: "Manage Users" },
      { key: "setup.categories", label: "Manage Categories" },
      { key: "setup.eventTypes", label: "Manage Event Types" },
      { key: "setup.fields", label: "Manage Custom Fields" },
      { key: "setup.config", label: "Manage Configuration" },
    ],
  },
];

// Flat list used for badge labels
const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.permissions);

const CONFIG_OPTIONS = [
  {
    key: "allowCheckout",
    label: "Allow Check Out",
    desc: "Enable the check-out action on the scan page.",
  },
  {
    key: "requireConfirmation",
    label: "Require Confirmation",
    desc: "Prompt before confirming a check-in.",
  },
  {
    key: "showStatsOnScan",
    label: "Show Attendance Stats",
    desc: "Display attendance statistics panel on the scan page.",
  },
  {
    key: "enableManualCheckin",
    label: "Enable Manual Check-in",
    desc: "Allow search-based check-in via the Search tab.",
  },
  {
    key: "autoClosePopup",
    label: "Auto Close Scan Popup",
    desc: "Automatically close the scan result popup after 8 seconds.",
  },
  {
    key: "showCategoryBadge",
    label: "Show Category Badge",
    desc: "Display attendee category badge in scan result.",
  },
];

const DEFAULT_CONFIG = {
  allowCheckout: true,
  requireConfirmation: false,
  showStatsOnScan: true,
  enableManualCheckin: true,
  autoClosePopup: true,
  showCategoryBadge: true,
};

const INITIAL_FIELD_FORM = {
  label: "",
  type: "text",
  active: true,
  options: "",
};
const INITIAL_CATEGORY_FORM = { label: "", color: "var(--info)", active: true };
const INITIAL_EVENT_TYPE_FORM = { label: "", active: true };
const INITIAL_USER_TYPE_FORM = {
  name: "",
  permissions: [],
  requiresTwoFactor: false,
};
const INITIAL_USER_FORM = {
  userId: "",
  name: "",
  mobile: "",
  email: "",
  userTypeId: "",
  password: "",
  active: true,
};

// ── SetupPage ─────────────────────────────────────────────────────────────────

const SetupPage = () => {
  const {
    userFields,
    addUserField,
    updateUserField,
    deleteUserField,
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    eventTypes,
    addEventType,
    updateEventType,
    deleteEventType,
  } = useEventData();

  const [activeTab, setActiveTab] = useState("fields");
  const [error, setError] = useState("");

  // Existing tab forms
  const [fieldForm, setFieldForm] = useState(INITIAL_FIELD_FORM);
  const [categoryForm, setCategoryForm] = useState(INITIAL_CATEGORY_FORM);
  const [eventTypeForm, setEventTypeForm] = useState(INITIAL_EVENT_TYPE_FORM);

  // User Types state
  const [userTypes, setUserTypes] = useState([]);
  const [userTypeForm, setUserTypeForm] = useState(INITIAL_USER_TYPE_FORM);
  const [utLoading, setUtLoading] = useState(false);
  const [editingUT, setEditingUT] = useState(null); // null = create, object = edit
  const [userTypeLogs, setUserTypeLogs] = useLocalStorage("user_type_logs", []);
  const [showLogs, setShowLogs] = useState(false);

  const { user: authUser } = useAuth();

  // Users state
  const [appUsers, setAppUsers] = useState([]);
  const [userForm, setUserForm] = useState(INITIAL_USER_FORM);
  const [uLoading, setULoading] = useState(false);
  const [pwModal, setPwModal] = useState(null);
  const [showPwInput, setShowPwInput] = useState(false);
  const [editUserModal, setEditUserModal] = useState(null); // user object being edited
  const [editUserForm, setEditUserForm] = useState({});
  const [userEditLogs, setUserEditLogs] = useLocalStorage("user_edit_logs", []);
  const [showUserLogs, setShowUserLogs] = useState(false);

  // Configuration state (server app store)
  const [config, setConfig] = useLocalStorage("app_config", DEFAULT_CONFIG);

  // Auto Scheme state (server app store)
  const [autoScheme, setAutoScheme] = useLocalStorage("user_id_auto_scheme", {
    isAuto: false,
    prefix: "",
    separator: "",
    startingNumber: 1,
    zeroPadding: 3,
    postfix: "",
    counter: 1,
  });

  useEffect(() => {
    fetchUserTypes().then(setUserTypes).catch(console.error);
    fetchAppUsers().then(setAppUsers).catch(console.error);
  }, []);

  const handleChange = (setter) => (e) => {
    const { name, value, type, checked } = e.target;
    setter((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const tabItemClass = (tab) =>
    `d-block w-100 text-start border-0 bg-transparent py-1 px-2 rounded small ${
      activeTab === tab ? "fw-semibold" : "text-secondary"
    }`;

  // ── Existing handlers ──────────────────────────────────────────────────────

  const handleAddField = () => {
    if (!fieldForm.label.trim()) {
      setError("Field label is required.");
      return;
    }
    addUserField(fieldForm);
    setFieldForm(INITIAL_FIELD_FORM);
    setError("");
  };

  const handleAddCategory = () => {
    if (!categoryForm.label.trim()) {
      setError("Category label is required.");
      return;
    }
    addCategory(categoryForm);
    setCategoryForm(INITIAL_CATEGORY_FORM);
    setError("");
  };

  const handleAddEventType = () => {
    if (!eventTypeForm.label.trim()) {
      setError("Event type label is required.");
      return;
    }
    addEventType(eventTypeForm);
    setEventTypeForm(INITIAL_EVENT_TYPE_FORM);
    setError("");
  };

  // ── User Types handlers ────────────────────────────────────────────────────

  const pushLog = (entry) =>
    setUserTypeLogs((prev) =>
      [
        { ...entry, id: Date.now(), timestamp: new Date().toISOString() },
        ...prev,
      ].slice(0, 200),
    );

  const togglePermission = (key) => {
    setUserTypeForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  };

  const handleStartEdit = (ut) => {
    setEditingUT(ut);
    setUserTypeForm({
      name: ut.name,
      permissions: [...(ut.permissions || [])],
      requiresTwoFactor: ut.requiresTwoFactor || false,
    });
    setError("");
  };

  const handleCancelEdit = () => {
    setEditingUT(null);
    setUserTypeForm(INITIAL_USER_TYPE_FORM);
    setError("");
  };

  const handleSaveUserType = async () => {
    if (!userTypeForm.name.trim()) {
      setError("User type name is required.");
      return;
    }
    setUtLoading(true);
    try {
      if (editingUT) {
        // Edit mode — compute diff for log
        const oldPerms = editingUT.permissions || [];
        const newPerms = userTypeForm.permissions;
        const added = newPerms.filter((p) => !oldPerms.includes(p));
        const removed = oldPerms.filter((p) => !newPerms.includes(p));
        const saved = await patchUserType(editingUT.id, {
          name: userTypeForm.name.trim(),
          permissions: newPerms,
          requiresTwoFactor: userTypeForm.requiresTwoFactor,
        });
        setUserTypes((prev) =>
          prev.map((t) => (t.id === editingUT.id ? saved : t)),
        );
        pushLog({
          action: "updated",
          name: userTypeForm.name.trim(),
          prev: editingUT.name,
          changes: {
            ...(editingUT.name !== userTypeForm.name.trim() && {
              nameChanged: {
                from: editingUT.name,
                to: userTypeForm.name.trim(),
              },
            }),
            ...(added.length && { added }),
            ...(removed.length && { removed }),
          },
        });
        setEditingUT(null);
      } else {
        // Create mode
        const saved = await createUserType({
          name: userTypeForm.name.trim(),
          permissions: userTypeForm.permissions,
          requiresTwoFactor: userTypeForm.requiresTwoFactor,
        });
        setUserTypes((prev) => [saved, ...prev]);
        pushLog({
          action: "created",
          name: userTypeForm.name.trim(),
          changes: { permissions: userTypeForm.permissions },
        });
      }
      setUserTypeForm(INITIAL_USER_TYPE_FORM);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setUtLoading(false);
    }
  };

  const handleDeleteUserType = async (ut) => {
    await removeUserType(ut.id).catch(console.error);
    setUserTypes((prev) => prev.filter((t) => t.id !== ut.id));
    pushLog({ action: "deleted", name: ut.name, changes: {} });
    if (editingUT?.id === ut.id) handleCancelEdit();
  };

  // ── App Users handlers ─────────────────────────────────────────────────────

  const buildUserId = (scheme, num) => {
    const padded = String(num).padStart(Number(scheme.zeroPadding) || 0, "0");
    const sep = scheme.separator || "";
    return `${scheme.prefix}${scheme.prefix ? sep : ""}${padded}${scheme.postfix ? sep : ""}${scheme.postfix}`;
  };

  const handleAddUser = async () => {
    let finalUserId = userForm.userId.trim();
    if (autoScheme.isAuto) {
      finalUserId = buildUserId(autoScheme, autoScheme.counter);
    }
    if (!finalUserId) {
      setError("User ID is required.");
      return;
    }
    if (!userForm.name.trim()) {
      setError("Name is required.");
      return;
    }
    setULoading(true);
    try {
      const saved = await createAppUser({
        userId: finalUserId,
        name: userForm.name.trim(),
        mobile: userForm.mobile.trim(),
        email: userForm.email.trim(),
        userTypeId: userForm.userTypeId,
        password: userForm.password,
        active: userForm.active,
      });
      setAppUsers((prev) => [saved, ...prev]);
      setUserForm(INITIAL_USER_FORM);
      if (autoScheme.isAuto)
        setAutoScheme((p) => ({ ...p, counter: p.counter + 1 }));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setULoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    await removeAppUser(id).catch(console.error);
    setAppUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const handleToggleUserActive = async (user) => {
    const saved = await patchAppUser(user.id, { active: !user.active }).catch(
      console.error,
    );
    if (saved)
      setAppUsers((prev) => prev.map((u) => (u.id === user.id ? saved : u)));
  };

  const handleChangePassword = async () => {
    if (!pwModal?.value?.trim()) return;
    const saved = await patchAppUser(pwModal.userId, {
      password: pwModal.value.trim(),
    }).catch(console.error);
    if (saved)
      setAppUsers((prev) =>
        prev.map((u) => (u.id === pwModal.userId ? saved : u)),
      );
    setPwModal(null);
  };

  const openEditUser = (u) => {
    setEditUserModal(u);
    setEditUserForm({
      name: u.name,
      mobile: u.mobile || "",
      email: u.email || "",
      userTypeId: u.userTypeId || "",
    });
  };

  const handleSaveEditUser = async () => {
    if (!editUserForm.name?.trim()) return;
    const saved = await patchAppUser(editUserModal.id, {
      name: editUserForm.name.trim(),
      mobile: editUserForm.mobile.trim(),
      email: editUserForm.email.trim(),
      userTypeId: editUserForm.userTypeId,
    }).catch(console.error);
    if (!saved) return;

    // Build change diff for log
    const fields = {
      name: "Name",
      mobile: "Mobile",
      email: "Email",
      userTypeId: "User Type",
    };
    const changes = {};
    Object.keys(fields).forEach((k) => {
      const oldVal = editUserModal[k] || "";
      const newVal =
        (k === "userTypeId" ? editUserForm[k] : editUserForm[k]?.trim()) || "";
      if (String(oldVal) !== String(newVal)) {
        const label =
          k === "userTypeId"
            ? {
                from:
                  userTypes.find((t) => t.id === oldVal)?.name || oldVal || "—",
                to:
                  userTypes.find((t) => t.id === newVal)?.name || newVal || "—",
              }
            : { from: oldVal || "—", to: newVal || "—" };
        changes[fields[k]] = label;
      }
    });

    if (Object.keys(changes).length) {
      setUserEditLogs((prev) =>
        [
          {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            changedBy: authUser?.name || authUser?.userId || "Unknown",
            targetUser: editUserModal.name,
            targetUserId: editUserModal.userId,
            changes,
          },
          ...prev,
        ].slice(0, 300),
      );
    }

    setAppUsers((prev) => prev.map((u) => (u.id === saved.id ? saved : u)));
    setEditUserModal(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const TABS = [
    { key: "fields", label: "User Defined Field" },
    { key: "categories", label: "Categories" },
    { key: "eventTypes", label: "Event Type" },
    { key: "userTypes", label: "User Types" },
    { key: "users", label: "Users" },
    { key: "autoScheme", label: "Auto Scheme" },
    { key: "passTemplate", label: "Pass Template" },
    { key: "formDesigner", label: "Form Designer" },
    { key: "formTemplates", label: "Form Templates" },
    { key: "configuration", label: "Configuration" },
  ];

  return (
    <div
      className="container-fluid fade-in d-flex flex-column"
      style={{ padding: "4px", minHeight: "calc(100vh - 1.45rem)" }}
    >
      <div className="card border-0 shadow-sm mb-1">
        <div className="card-body p-2">
          <h5 className="fw-bold mb-0">Setup</h5>
        </div>
      </div>

      <div className="d-flex flex-grow-1" style={{ gap: "4px" }}>
        {/* Sidebar */}
        <div style={{ flex: "0 0 240px", maxWidth: "240px", position: "sticky", top: "70px", alignSelf: "start" }}>
          <div className="card border-0 shadow-sm">
            <div className="card-body p-3">
              <h6 className="fw-semibold mb-3">Setup Menu</h6>
              <div className="d-flex flex-column gap-1">
                {TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={tabItemClass(key)}
                    style={
                      activeTab === key ? { color: "var(--theme-button)" } : {}
                    }
                    onClick={() => {
                      setActiveTab(key);
                      setError("");
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-grow-1 min-w-0">
          {/* ── User Defined Fields ── */}
          {activeTab === "fields" && (
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-3">
                <h5 className="fw-semibold mb-1">User Defined Fields</h5>
                <div className="small text-muted mb-3">
                  Add custom attendee fields and activate them for events.
                </div>
                <div className="row g-2 align-items-end">
                  <div className="col-12 col-md-5">
                    <label className="form-label small fw-semibold mb-1">
                      Label
                    </label>
                    <input
                      name="label"
                      value={fieldForm.label}
                      onChange={handleChange(setFieldForm)}
                      className="form-control form-control-sm"
                      placeholder="e.g. Company"
                    />
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label small fw-semibold mb-1">
                      Type
                    </label>
                    <select
                      name="type"
                      value={fieldForm.type}
                      onChange={handleChange(setFieldForm)}
                      className="form-select form-select-sm"
                    >
                      {FIELD_TYPES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-2 d-flex align-items-center">
                    <label className="form-check mb-0">
                      <input
                        type="checkbox"
                        name="active"
                        checked={fieldForm.active}
                        onChange={handleChange(setFieldForm)}
                        className="form-check-input"
                      />
                      <span className="form-check-label ms-2">Active</span>
                    </label>
                  </div>
                  {(fieldForm.type === "choice" ||
                    fieldForm.type === "multiple-choice") && (
                    <div className="col-12 col-md-9">
                      <label className="form-label small fw-semibold mb-1">
                        Options
                      </label>
                      <input
                        name="options"
                        value={fieldForm.options}
                        onChange={handleChange(setFieldForm)}
                        className="form-control form-control-sm"
                        placeholder="Enter comma-separated options"
                      />
                    </div>
                  )}
                </div>
                {error && <div className="text-danger small mt-2">{error}</div>}
                <div className="d-flex justify-content-end mt-3">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleAddField}
                  >
                    <FiPlus className="me-1" /> Add Field
                  </button>
                </div>
                <div className="mt-4">
                  {userFields.length === 0 ? (
                    <div className="text-muted small">
                      No custom fields yet.
                    </div>
                  ) : (
                    <div className="list-group list-group-flush">
                      {userFields.map((field) => (
                        <div
                          key={field.id}
                          className="list-group-item d-flex justify-content-between align-items-center py-3"
                        >
                          <div>
                            <div className="fw-semibold">{field.label}</div>
                            <div className="small text-muted">
                              {field.type === "multiple-choice"
                                ? "Multiple Choice"
                                : field.type === "choice"
                                  ? "Choice"
                                  : field.type}
                            </div>
                            {field.options?.length > 0 && (
                              <div className="small text-muted">
                                Options: {field.options.join(", ")}
                              </div>
                            )}
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <label className="form-check form-switch mb-0">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={field.active}
                                onChange={() =>
                                  updateUserField(field.id, {
                                    active: !field.active,
                                  })
                                }
                              />
                              <span className="form-check-label ms-2">
                                Active
                              </span>
                            </label>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => deleteUserField(field.id)}
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Categories ── */}
          {activeTab === "categories" && (
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-3">
                <h5 className="fw-semibold mb-1">Categories</h5>
                <div className="small text-muted mb-3">
                  Create categories with colors and turn them on or off.
                </div>
                <div className="row g-2 align-items-end">
                  <div className="col-12 col-md-5">
                    <label className="form-label small fw-semibold mb-1">
                      Label
                    </label>
                    <input
                      name="label"
                      value={categoryForm.label}
                      onChange={handleChange(setCategoryForm)}
                      className="form-control form-control-sm"
                      placeholder="e.g. VIP"
                    />
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label small fw-semibold mb-1">
                      Color
                    </label>
                    <input
                      type="color"
                      name="color"
                      value={categoryForm.color}
                      onChange={handleChange(setCategoryForm)}
                      className="form-control form-control-color form-control-sm"
                    />
                  </div>
                  <div className="col-12 col-md-2 d-flex align-items-center">
                    <label className="form-check mb-0">
                      <input
                        type="checkbox"
                        name="active"
                        checked={categoryForm.active}
                        onChange={handleChange(setCategoryForm)}
                        className="form-check-input"
                      />
                      <span className="form-check-label ms-2">Active</span>
                    </label>
                  </div>
                  <div className="col-12 col-md-2 d-flex justify-content-end">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm w-100"
                      onClick={handleAddCategory}
                    >
                      <FiPlus className="me-1" /> Add
                    </button>
                  </div>
                </div>
                {error && <div className="text-danger small mt-2">{error}</div>}
                <div className="mt-4">
                  {categories.length === 0 ? (
                    <div className="text-muted small">No categories yet.</div>
                  ) : (
                    <div className="list-group list-group-flush">
                      {categories.map((category) => (
                        <div
                          key={category.id}
                          className="list-group-item d-flex justify-content-between align-items-center py-3"
                        >
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
                          <div className="d-flex align-items-center gap-2">
                            <label className="form-check form-switch mb-0">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={category.active}
                                onChange={() =>
                                  updateCategory(category.id, {
                                    active: !category.active,
                                  })
                                }
                              />
                              <span className="form-check-label ms-2">
                                Active
                              </span>
                            </label>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => deleteCategory(category.id)}
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Event Types ── */}
          {activeTab === "eventTypes" && (
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-3">
                <h5 className="fw-semibold mb-1">Event Types</h5>
                <div className="small text-muted mb-3">
                  Define event types that can be assigned when creating an
                  event.
                </div>
                <div className="row g-2 align-items-end">
                  <div className="col-12 col-md-7">
                    <label className="form-label small fw-semibold mb-1">
                      Label
                    </label>
                    <input
                      name="label"
                      value={eventTypeForm.label}
                      onChange={handleChange(setEventTypeForm)}
                      className="form-control form-control-sm"
                      placeholder="e.g. Conference"
                    />
                  </div>
                  <div className="col-12 col-md-2 d-flex align-items-center">
                    <label className="form-check mb-0">
                      <input
                        type="checkbox"
                        name="active"
                        checked={eventTypeForm.active}
                        onChange={handleChange(setEventTypeForm)}
                        className="form-check-input"
                      />
                      <span className="form-check-label ms-2">Active</span>
                    </label>
                  </div>
                  <div className="col-12 col-md-3 d-flex justify-content-end">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm w-100"
                      onClick={handleAddEventType}
                    >
                      <FiPlus className="me-1" /> Add Type
                    </button>
                  </div>
                </div>
                {error && <div className="text-danger small mt-2">{error}</div>}
                <div className="mt-4">
                  {eventTypes.length === 0 ? (
                    <div className="text-muted small">No event types yet.</div>
                  ) : (
                    <div className="list-group list-group-flush">
                      {eventTypes.map((type) => (
                        <div
                          key={type.id}
                          className="list-group-item d-flex justify-content-between align-items-center py-3"
                        >
                          <div className="fw-semibold">{type.label}</div>
                          <div className="d-flex align-items-center gap-2">
                            <label className="form-check form-switch mb-0">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={type.active}
                                onChange={() =>
                                  updateEventType(type.id, {
                                    active: !type.active,
                                  })
                                }
                              />
                              <span className="form-check-label ms-2">
                                Active
                              </span>
                            </label>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => deleteEventType(type.id)}
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── User Types ── */}
          {activeTab === "userTypes" && (
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-3">
                {/* Header */}
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <h5 className="fw-semibold mb-0">User Types</h5>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                    onClick={() => setShowLogs((v) => !v)}
                  >
                    <FiClock size={13} />
                    <span>Logs</span>
                    {userTypeLogs.length > 0 && (
                      <span
                        className="badge rounded-pill ms-1"
                        style={{
                          background: "var(--primary)",
                          color: "var(--card)",
                          fontSize: 10,
                        }}
                      >
                        {userTypeLogs.length}
                      </span>
                    )}
                    {showLogs ? (
                      <FiChevronUp size={12} />
                    ) : (
                      <FiChevronDown size={12} />
                    )}
                  </button>
                </div>
                <div className="small text-muted mb-4">
                  Define roles and assign granular permissions per module.
                </div>

                {/* Edit Logs panel */}
                {showLogs && (
                  <div
                    className="mb-4 rounded-3 border"
                    style={{ background: "#fafafa" }}
                  >
                    <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
                      <span className="small fw-semibold">Change Log</span>
                      {userTypeLogs.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-link btn-sm text-danger p-0"
                          style={{ fontSize: 11 }}
                          onClick={() => setUserTypeLogs([])}
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    {userTypeLogs.length === 0 ? (
                      <div className="text-muted small px-3 py-3">
                        No changes recorded yet.
                      </div>
                    ) : (
                      <div style={{ maxHeight: 260, overflowY: "auto" }}>
                        {userTypeLogs.map((log) => {
                          const dot =
                            log.action === "created"
                              ? "var(--success)"
                              : log.action === "updated"
                                ? "var(--info)"
                                : "#EF4444";
                          return (
                            <div
                              key={log.id}
                              className="d-flex gap-3 px-3 py-2 border-bottom"
                              style={{ fontSize: 12 }}
                            >
                              <div className="flex-shrink-0 d-flex flex-column align-items-center pt-1">
                                <span
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: dot,
                                    display: "block",
                                  }}
                                />
                              </div>
                              <div className="flex-grow-1">
                                <div>
                                  <span className="fw-semibold">
                                    {log.name}
                                  </span>
                                  <span
                                    className="ms-2 badge rounded-pill"
                                    style={{
                                      background: dot + "22",
                                      color: dot,
                                      fontSize: 10,
                                    }}
                                  >
                                    {log.action}
                                  </span>
                                </div>
                                {log.action === "updated" && (
                                  <div className="mt-1 d-flex flex-column gap-1">
                                    {log.changes?.nameChanged && (
                                      <span className="text-muted">
                                        Renamed:{" "}
                                        <em>{log.changes.nameChanged.from}</em>{" "}
                                        → <em>{log.changes.nameChanged.to}</em>
                                      </span>
                                    )}
                                    {log.changes?.added?.length > 0 && (
                                      <div className="d-flex flex-wrap gap-1 align-items-center">
                                        <span style={{ color: "var(--success)" }}>
                                          + Added:
                                        </span>
                                        {log.changes.added.map((k) => (
                                          <span
                                            key={k}
                                            className="badge rounded-pill"
                                            style={{
                                              background: "#dcfce7",
                                              color: "#166534",
                                              fontSize: 10,
                                            }}
                                          >
                                            {ALL_PERMISSIONS.find(
                                              (p) => p.key === k,
                                            )?.label || k}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {log.changes?.removed?.length > 0 && (
                                      <div className="d-flex flex-wrap gap-1 align-items-center">
                                        <span style={{ color: "#EF4444" }}>
                                          − Removed:
                                        </span>
                                        {log.changes.removed.map((k) => (
                                          <span
                                            key={k}
                                            className="badge rounded-pill"
                                            style={{
                                              background: "#fee2e2",
                                              color: "#991b1b",
                                              fontSize: 10,
                                            }}
                                          >
                                            {ALL_PERMISSIONS.find(
                                              (p) => p.key === k,
                                            )?.label || k}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {!log.changes?.nameChanged &&
                                      !log.changes?.added?.length &&
                                      !log.changes?.removed?.length && (
                                        <span className="text-muted">
                                          No changes detected.
                                        </span>
                                      )}
                                  </div>
                                )}
                                {log.action === "created" &&
                                  log.changes?.permissions?.length > 0 && (
                                    <div className="text-muted mt-1">
                                      {log.changes.permissions.length}{" "}
                                      permission
                                      {log.changes.permissions.length !== 1
                                        ? "s"
                                        : ""}{" "}
                                      assigned
                                    </div>
                                  )}
                              </div>
                              <div
                                className="flex-shrink-0 text-muted"
                                style={{ fontSize: 10, whiteSpace: "nowrap" }}
                              >
                                {new Date(log.timestamp).toLocaleString()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Form — create or edit */}
                <div
                  className="rounded-3 p-3 mb-3"
                  style={{
                    background: editingUT ? "#fffbeb" : "var(--background)",
                    border: editingUT
                      ? "1px solid #fde68a"
                      : "1px solid var(--border)",
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <span className="small fw-semibold">
                      {editingUT
                        ? `Editing: ${editingUT.name}`
                        : "New User Type"}
                    </span>
                    {editingUT && (
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-secondary"
                        onClick={handleCancelEdit}
                      >
                        <FiX size={14} className="me-1" /> Cancel
                      </button>
                    )}
                  </div>

                  <div className="mb-3" style={{ maxWidth: 320 }}>
                    <label className="form-label small fw-semibold mb-1">
                      Role Name
                    </label>
                    <input
                      value={userTypeForm.name}
                      onChange={(e) =>
                        setUserTypeForm((p) => ({ ...p, name: e.target.value }))
                      }
                      className="form-control form-control-sm"
                      placeholder="e.g. Admin, Operator, Volunteer"
                    />
                  </div>

                  <div className="small fw-semibold mb-2">Permissions</div>
                  <div className="row g-2 mb-3">
                    {PERMISSION_GROUPS.map(
                      ({ group, color, bg, permissions }) => {
                        const groupKeys = permissions.map((p) => p.key);
                        const allChecked = groupKeys.every((k) =>
                          userTypeForm.permissions.includes(k),
                        );
                        const someChecked = groupKeys.some((k) =>
                          userTypeForm.permissions.includes(k),
                        );
                        const toggleGroup = () => {
                          setUserTypeForm((prev) => {
                            const rest = prev.permissions.filter(
                              (k) => !groupKeys.includes(k),
                            );
                            return {
                              ...prev,
                              permissions: allChecked
                                ? rest
                                : [...rest, ...groupKeys],
                            };
                          });
                        };
                        return (
                          <div key={group} className="col-12 col-md-6 col-xl-4">
                            <div
                              className="rounded-3 p-3 h-100"
                              style={{
                                background: bg,
                                border: `1px solid ${color}22`,
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <span
                                  className="fw-semibold small"
                                  style={{ color }}
                                >
                                  {group}
                                </span>
                                <label
                                  className="form-check mb-0 d-flex align-items-center gap-1"
                                  style={{ cursor: "pointer" }}
                                >
                                  <input
                                    type="checkbox"
                                    className="form-check-input mt-0"
                                    checked={allChecked}
                                    ref={(el) => {
                                      if (el)
                                        el.indeterminate =
                                          someChecked && !allChecked;
                                    }}
                                    onChange={toggleGroup}
                                  />
                                  <span
                                    className="form-check-label"
                                    style={{ fontSize: 11, color: "var(--muted-foreground)" }}
                                  >
                                    All
                                  </span>
                                </label>
                              </div>
                              <div className="d-flex flex-column gap-1">
                                {permissions.map(({ key, label }) => (
                                  <label
                                    key={key}
                                    className="form-check mb-0 d-flex align-items-center gap-2"
                                    style={{ cursor: "pointer" }}
                                  >
                                    <input
                                      type="checkbox"
                                      className="form-check-input mt-0"
                                      checked={userTypeForm.permissions.includes(
                                        key,
                                      )}
                                      onChange={() => togglePermission(key)}
                                    />
                                    <span className="form-check-label small">
                                      {label}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>

                  {/* 2FA requirement toggle */}
                  <div
                    className="d-flex align-items-center justify-content-between p-3 rounded-3 mb-3"
                    style={{
                      background: userTypeForm.requiresTwoFactor
                        ? "#fffbeb"
                        : "var(--background)",
                      border: `1px solid ${userTypeForm.requiresTwoFactor ? "#fde68a" : "var(--border)"}`,
                      transition: "all 0.2s",
                    }}
                  >
                    <div>
                      <div className="fw-semibold small d-flex align-items-center gap-2">
                        <i
                          className="bi bi-shield-lock"
                          style={{
                            color: userTypeForm.requiresTwoFactor
                              ? "#d97706"
                              : "var(--muted-foreground)",
                          }}
                        />
                        Require Two-Factor Authentication (2FA)
                      </div>
                      <div className="text-muted" style={{ fontSize: 11 }}>
                        Users of this type must verify via Google Authenticator
                        on every login.
                      </div>
                    </div>
                    <div className="form-check form-switch mb-0 ms-3 flex-shrink-0">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={userTypeForm.requiresTwoFactor}
                        onChange={(e) =>
                          setUserTypeForm((p) => ({
                            ...p,
                            requiresTwoFactor: e.target.checked,
                          }))
                        }
                        style={{
                          width: "2.5em",
                          height: "1.25em",
                          cursor: "pointer",
                        }}
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="text-danger small mb-2">{error}</div>
                  )}
                  <div className="d-flex justify-content-end gap-2">
                    {editingUT && (
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveUserType}
                      disabled={utLoading}
                    >
                      {editingUT ? (
                        <>
                          <FiEdit2 size={12} className="me-1" /> Update
                        </>
                      ) : (
                        <>
                          <FiPlus className="me-1" /> Add User Type
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* User Types Table */}
                <div className="mt-2">
                  {userTypes.length === 0 ? (
                    <div className="text-muted small">No user types yet.</div>
                  ) : (
                    <div className="table-responsive">
                      <table
                        className="table table-sm table-hover align-middle mb-0"
                        style={{ fontSize: 13 }}
                      >
                        <thead style={{ background: "var(--background)" }}>
                          <tr>
                            <th
                              className="fw-semibold"
                              style={{ width: "20%" }}
                            >
                              Name
                            </th>
                            <th
                              className="fw-semibold"
                              style={{ width: "70%" }}
                            >
                              Permissions
                            </th>
                            <th
                              className="fw-semibold text-center"
                              style={{ width: "10%" }}
                            >
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {userTypes.map((ut) => (
                            <tr
                              key={ut.id}
                              style={
                                editingUT?.id === ut.id
                                  ? { background: "#fffbeb" }
                                  : {}
                              }
                            >
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <FiShield
                                    size={14}
                                    style={{ color: "var(--primary)", flexShrink: 0 }}
                                  />
                                  <div className="flex-grow-1">
                                    <div className="fw-semibold">{ut.name}</div>
                                    {ut.requiresTwoFactor && (
                                      <span
                                        className="badge d-inline-flex align-items-center gap-1 mt-1"
                                        style={{
                                          background: "#fffbeb",
                                          color: "#d97706",
                                          border: "1px solid #fde68a",
                                          fontSize: 10,
                                        }}
                                      >
                                        <i className="bi bi-shield-lock" />
                                        2FA Required
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td>
                                {ut.permissions?.length > 0 ? (
                                  <div className="d-flex flex-wrap gap-1">
                                    {PERMISSION_GROUPS.map(
                                      ({
                                        group,
                                        color,
                                        bg,
                                        permissions: gPerms,
                                      }) => {
                                        const granted = gPerms.filter((p) =>
                                          ut.permissions.includes(p.key),
                                        );
                                        if (granted.length === 0) return null;
                                        return (
                                          <div
                                            key={group}
                                            className="d-inline-flex flex-wrap align-items-center gap-1 px-2 py-1 rounded-2"
                                            style={{
                                              background: bg,
                                              border: `1px solid ${color}33`,
                                              fontSize: 11,
                                            }}
                                          >
                                            <span
                                              style={{ color, fontWeight: 600 }}
                                            >
                                              {group}:
                                            </span>
                                            {granted.map((p) => (
                                              <span
                                                key={p.key}
                                                className="badge rounded-pill"
                                                style={{
                                                  background: color + "22",
                                                  color,
                                                  fontSize: 10,
                                                }}
                                              >
                                                {p.label}
                                              </span>
                                            ))}
                                          </div>
                                        );
                                      },
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted small">
                                    No permissions assigned
                                  </span>
                                )}
                              </td>
                              <td className="text-center">
                                <div className="d-flex gap-1 justify-content-center">
                                  <button
                                    type="button"
                                    className="btn btn-outline-primary btn-sm"
                                    onClick={() => handleStartEdit(ut)}
                                    disabled={
                                      !!editingUT && editingUT.id !== ut.id
                                    }
                                    title="Edit"
                                  >
                                    <FiEdit2 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={() => handleDeleteUserType(ut)}
                                    title="Delete"
                                  >
                                    <FiTrash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Users ── */}
          {activeTab === "users" && (
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <h5 className="fw-semibold mb-0">Users</h5>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                    onClick={() => setShowUserLogs((v) => !v)}
                  >
                    <i className="bi bi-clock-history" />
                    <span>Edit Logs</span>
                    {userEditLogs.length > 0 && (
                      <span
                        className="badge rounded-pill ms-1"
                        style={{
                          background: "var(--primary)",
                          color: "var(--card)",
                          fontSize: 10,
                        }}
                      >
                        {userEditLogs.length}
                      </span>
                    )}
                    <i
                      className={`bi bi-chevron-${showUserLogs ? "up" : "down"}`}
                      style={{ fontSize: 10 }}
                    />
                  </button>
                </div>
                <div className="small text-muted mb-3">
                  Add users and assign them a user type.
                </div>

                {/* Edit Logs panel */}
                {/* Edit Logs — full view, hides form & table */}
                {showUserLogs ? (
                  <div
                    className="rounded-3 border"
                    style={{ background: "#fafafa" }}
                  >
                    <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
                      <span className="small fw-semibold">User Edit Log</span>
                      {userEditLogs.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-link btn-sm text-danger p-0"
                          style={{ fontSize: 11 }}
                          onClick={() => setUserEditLogs([])}
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    {userEditLogs.length === 0 ? (
                      <div className="text-center py-5 text-muted small">
                        <i
                          className="bi bi-clock-history d-block mb-2"
                          style={{ fontSize: 28, opacity: 0.3 }}
                        />
                        No edits recorded yet.
                      </div>
                    ) : (
                      <div>
                        {userEditLogs.map((log, idx) => (
                          <div
                            key={log.id}
                            className="px-4 py-3"
                            style={{
                              borderBottom:
                                idx < userEditLogs.length - 1
                                  ? "1px solid var(--border)"
                                  : "none",
                            }}
                          >
                            {/* Who & when */}
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <div className="d-flex align-items-center gap-2">
                                <span
                                  className="d-flex align-items-center justify-content-center rounded-circle"
                                  style={{
                                    width: 30,
                                    height: 30,
                                    background: "#f3e8ff",
                                    flexShrink: 0,
                                  }}
                                >
                                  <i
                                    className="bi bi-person"
                                    style={{ color: "var(--primary)", fontSize: 13 }}
                                  />
                                </span>
                                <div>
                                  <span
                                    className="fw-semibold"
                                    style={{ fontSize: 13 }}
                                  >
                                    {log.targetUser}
                                  </span>
                                  <span
                                    className="text-muted ms-1"
                                    style={{ fontSize: 12 }}
                                  >
                                    ({log.targetUserId})
                                  </span>
                                  <span
                                    className="text-muted mx-1"
                                    style={{ fontSize: 12 }}
                                  >
                                    ·
                                  </span>
                                  <span
                                    className="text-muted"
                                    style={{ fontSize: 12 }}
                                  >
                                    edited by
                                  </span>
                                  <span
                                    className="fw-semibold ms-1"
                                    style={{ color: "var(--primary)", fontSize: 12 }}
                                  >
                                    {log.changedBy}
                                  </span>
                                </div>
                              </div>
                              <span
                                className="text-muted"
                                style={{
                                  fontSize: 11,
                                  whiteSpace: "nowrap",
                                  paddingTop: 2,
                                }}
                              >
                                <i className="bi bi-clock me-1" />
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                            </div>

                            {/* Changes */}
                            <div className="ms-5 d-flex flex-column gap-2">
                              {Object.entries(log.changes).map(
                                ([field, { from, to }]) => (
                                  <div
                                    key={field}
                                    className="d-flex align-items-center gap-2 flex-wrap p-2 rounded-2"
                                    style={{
                                      background: "var(--card)",
                                      border: "1px solid var(--border)",
                                      fontSize: 12,
                                    }}
                                  >
                                    <span
                                      className="badge fw-semibold"
                                      style={{
                                        background: "var(--accent)",
                                        color: "#6d28d9",
                                        fontSize: 11,
                                      }}
                                    >
                                      {field}
                                    </span>
                                    <span
                                      className="px-2 py-1 rounded-2 fw-semibold"
                                      style={{
                                        background: "#fee2e2",
                                        color: "#991b1b",
                                        textDecoration: "line-through",
                                        fontSize: 12,
                                      }}
                                    >
                                      {from}
                                    </span>
                                    <i
                                      className="bi bi-arrow-right"
                                      style={{ color: "var(--muted-foreground)" }}
                                    />
                                    <span
                                      className="px-2 py-1 rounded-2 fw-semibold"
                                      style={{
                                        background: "#dcfce7",
                                        color: "#166534",
                                        fontSize: 12,
                                      }}
                                    >
                                      {to}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Add user form */}
                    <div
                      className="rounded-3 p-3 mb-4"
                      style={{
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {/* Row 1 */}
                      <div className="row g-2 align-items-end mb-2">
                        <div className="col-12 col-md-3">
                          <label className="form-label small fw-semibold mb-1">
                            User ID <span className="text-danger">*</span>
                            {autoScheme.isAuto && (
                              <span
                                className="ms-2 badge rounded-pill"
                                style={{
                                  background: "#dcfce7",
                                  color: "#166534",
                                  fontSize: 10,
                                }}
                              >
                                Auto
                              </span>
                            )}
                          </label>
                          {autoScheme.isAuto ? (
                            <div
                              className="form-control form-control-sm d-flex align-items-center gap-2"
                              style={{
                                background: "#f0fdf4",
                                border: "1px solid #86efac",
                                color: "#166534",
                                fontFamily: "monospace",
                                fontWeight: 600,
                              }}
                            >
                              <i
                                className="bi bi-magic"
                                style={{ fontSize: 12 }}
                              />
                              {buildUserId(autoScheme, autoScheme.counter)}
                            </div>
                          ) : (
                            <div className="input-group input-group-sm">
                              <span className="input-group-text">
                                <i className="bi bi-person-badge" />
                              </span>
                              <input
                                value={userForm.userId}
                                onChange={(e) =>
                                  setUserForm((p) => ({
                                    ...p,
                                    userId: e.target.value.replace(/\s/g, ""),
                                  }))
                                }
                                className="form-control form-control-sm"
                                placeholder="e.g. janak01"
                              />
                            </div>
                          )}
                        </div>
                        <div className="col-12 col-md-3">
                          <label className="form-label small fw-semibold mb-1">
                            Name <span className="text-danger">*</span>
                          </label>
                          <input
                            value={userForm.name}
                            onChange={(e) =>
                              setUserForm((p) => ({
                                ...p,
                                name: e.target.value,
                              }))
                            }
                            className="form-control form-control-sm"
                            placeholder="Full name"
                          />
                        </div>
                        <div className="col-12 col-md-3">
                          <label className="form-label small fw-semibold mb-1">
                            Mobile
                          </label>
                          <input
                            value={userForm.mobile}
                            onChange={(e) =>
                              setUserForm((p) => ({
                                ...p,
                                mobile: e.target.value,
                              }))
                            }
                            className="form-control form-control-sm"
                            placeholder="98765 43210"
                          />
                        </div>
                        <div className="col-12 col-md-3">
                          <label className="form-label small fw-semibold mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            value={userForm.email}
                            onChange={(e) =>
                              setUserForm((p) => ({
                                ...p,
                                email: e.target.value,
                              }))
                            }
                            className="form-control form-control-sm"
                            placeholder="user@example.com"
                          />
                        </div>
                      </div>
                      {/* Row 2 */}
                      <div className="row g-2 align-items-end">
                        <div className="col-12 col-md-3">
                          <label className="form-label small fw-semibold mb-1">
                            User Type
                          </label>
                          <select
                            value={userForm.userTypeId}
                            onChange={(e) =>
                              setUserForm((p) => ({
                                ...p,
                                userTypeId: e.target.value,
                              }))
                            }
                            className="form-select form-select-sm"
                          >
                            <option value="">— Select —</option>
                            {userTypes.map((ut) => (
                              <option key={ut.id} value={ut.id}>
                                {ut.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-12 col-md-3">
                          <label className="form-label small fw-semibold mb-1">
                            Password
                          </label>
                          <div className="input-group input-group-sm">
                            <input
                              type={showPwInput ? "text" : "password"}
                              value={userForm.password}
                              onChange={(e) =>
                                setUserForm((p) => ({
                                  ...p,
                                  password: e.target.value,
                                }))
                              }
                              className="form-control form-control-sm"
                              placeholder="Set password"
                            />
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm px-2"
                              onClick={() => setShowPwInput((v) => !v)}
                            >
                              <i
                                className={`bi ${showPwInput ? "bi-eye-slash" : "bi-eye"}`}
                              />
                            </button>
                          </div>
                        </div>
                        <div className="col-12 col-md-6 d-flex align-items-end justify-content-end">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm px-4"
                            onClick={handleAddUser}
                            disabled={uLoading}
                          >
                            <i className="bi bi-plus-lg me-1" /> Add User
                          </button>
                        </div>
                      </div>
                      {error && (
                        <div className="text-danger small mt-2">{error}</div>
                      )}
                    </div>

                    {/* Users table */}
                    {appUsers.length === 0 ? (
                      <div className="text-muted small">No users yet.</div>
                    ) : (
                      <div className="table-responsive">
                        <table
                          className="table table-sm table-hover align-middle mb-0"
                          style={{ fontSize: 13 }}
                        >
                          <thead style={{ background: "var(--background)" }}>
                            <tr>
                              <th className="fw-semibold" style={{ width: 36 }}>
                                #
                              </th>
                              <th className="fw-semibold">User ID</th>
                              <th className="fw-semibold">Name</th>
                              <th className="fw-semibold">Mobile</th>
                              <th className="fw-semibold">Email</th>
                              <th className="fw-semibold">User Type</th>
                              <th className="fw-semibold text-center">
                                Status
                              </th>
                              <th className="fw-semibold text-center">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {appUsers.map((u, idx) => {
                              const ut = userTypes.find(
                                (t) => t.id === u.userTypeId,
                              );
                              return (
                                <tr key={u.id}>
                                  <td className="text-muted">{idx + 1}</td>
                                  <td>
                                    <span
                                      className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded-2"
                                      style={{
                                        background: "#f3e8ff",
                                        color: "#7e22ce",
                                        fontSize: 12,
                                        fontFamily: "monospace",
                                        fontWeight: 600,
                                      }}
                                    >
                                      <i
                                        className="bi bi-person-badge"
                                        style={{ fontSize: 11 }}
                                      />
                                      {u.userId || "—"}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="d-flex align-items-center gap-2">
                                      <span
                                        className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                                        style={{
                                          width: 28,
                                          height: 28,
                                          background: "#f3e8ff",
                                        }}
                                      >
                                        <i
                                          className="bi bi-person"
                                          style={{
                                            color: "var(--primary)",
                                            fontSize: 13,
                                          }}
                                        />
                                      </span>
                                      <span className="fw-semibold">
                                        {u.name}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    {u.mobile ? (
                                      <span className="d-flex align-items-center gap-1 text-muted">
                                        <i
                                          className="bi bi-telephone"
                                          style={{ fontSize: 11 }}
                                        />
                                        {u.mobile}
                                      </span>
                                    ) : (
                                      <span className="text-muted">—</span>
                                    )}
                                  </td>
                                  <td>
                                    {u.email ? (
                                      <span className="d-flex align-items-center gap-1 text-muted">
                                        <i
                                          className="bi bi-envelope"
                                          style={{ fontSize: 11 }}
                                        />
                                        {u.email}
                                      </span>
                                    ) : (
                                      <span className="text-muted">—</span>
                                    )}
                                  </td>
                                  <td>
                                    {ut ? (
                                      <span
                                        className="badge rounded-pill"
                                        style={{
                                          background: "#f3e8ff",
                                          color: "#7e22ce",
                                          fontSize: 11,
                                        }}
                                      >
                                        {ut.name}
                                      </span>
                                    ) : (
                                      <span className="text-muted">—</span>
                                    )}
                                  </td>
                                  <td className="text-center">
                                    <div className="form-check form-switch d-inline-flex mb-0">
                                      <input
                                        type="checkbox"
                                        className="form-check-input"
                                        checked={u.active}
                                        onChange={() =>
                                          handleToggleUserActive(u)
                                        }
                                        style={{ cursor: "pointer" }}
                                      />
                                    </div>
                                  </td>
                                  <td className="text-center">
                                    <div className="d-flex justify-content-center gap-1">
                                      <button
                                        type="button"
                                        className="btn btn-outline-primary btn-sm px-2"
                                        title="Edit User"
                                        onClick={() => openEditUser(u)}
                                      >
                                        <i className="bi bi-pencil" />
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-outline-secondary btn-sm px-2"
                                        title="Change Password"
                                        onClick={() =>
                                          setPwModal({
                                            userId: u.id,
                                            name: u.name,
                                            value: "",
                                          })
                                        }
                                      >
                                        <i className="bi bi-key" />
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-outline-danger btn-sm px-2"
                                        title="Delete"
                                        onClick={() => handleDeleteUser(u.id)}
                                      >
                                        <i className="bi bi-trash" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Change Password Modal */}
          {pwModal && (
            <div
              className="modal d-block"
              style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={(e) => e.target === e.currentTarget && setPwModal(null)}
            >
              <div
                className="modal-dialog modal-dialog-centered"
                style={{ maxWidth: 360 }}
              >
                <div className="modal-content border-0 shadow">
                  <div className="modal-header border-0 pb-0">
                    <h6 className="modal-title fw-semibold d-flex align-items-center gap-2">
                      <i className="bi bi-key" style={{ color: "var(--primary)" }} />
                      Change Password
                    </h6>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setPwModal(null)}
                    />
                  </div>
                  <div className="modal-body pt-2">
                    <p className="text-muted small mb-3">
                      Setting new password for <strong>{pwModal.name}</strong>
                    </p>
                    <div className="input-group">
                      <span className="input-group-text">
                        <i className="bi bi-lock" />
                      </span>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="New password"
                        value={pwModal.value}
                        onChange={(e) =>
                          setPwModal((p) => ({ ...p, value: e.target.value }))
                        }
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleChangePassword()
                        }
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="modal-footer border-0 pt-0">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setPwModal(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleChangePassword}
                      disabled={!pwModal.value.trim()}
                    >
                      <i className="bi bi-check-lg me-1" /> Update Password
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit User Modal */}
          {editUserModal && (
            <div
              className="modal d-block"
              style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={(e) =>
                e.target === e.currentTarget && setEditUserModal(null)
              }
            >
              <div
                className="modal-dialog modal-dialog-centered"
                style={{ maxWidth: 500 }}
              >
                <div className="modal-content border-0 shadow">
                  <div className="modal-header border-0 pb-0">
                    <h6 className="modal-title fw-semibold d-flex align-items-center gap-2">
                      <i
                        className="bi bi-pencil-square"
                        style={{ color: "var(--primary)" }}
                      />
                      Edit User
                      <span
                        className="text-muted fw-normal"
                        style={{ fontSize: 12 }}
                      >
                        ({editUserModal.userId})
                      </span>
                    </h6>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setEditUserModal(null)}
                    />
                  </div>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label small fw-semibold mb-1">
                          Name <span className="text-danger">*</span>
                        </label>
                        <input
                          className="form-control form-control-sm"
                          value={editUserForm.name}
                          onChange={(e) =>
                            setEditUserForm((p) => ({
                              ...p,
                              name: e.target.value,
                            }))
                          }
                          placeholder="Full name"
                          autoFocus
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-semibold mb-1">
                          Mobile
                        </label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">
                            <i className="bi bi-telephone" />
                          </span>
                          <input
                            className="form-control"
                            value={editUserForm.mobile}
                            onChange={(e) =>
                              setEditUserForm((p) => ({
                                ...p,
                                mobile: e.target.value,
                              }))
                            }
                            placeholder="Mobile number"
                          />
                        </div>
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-semibold mb-1">
                          Email
                        </label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">
                            <i className="bi bi-envelope" />
                          </span>
                          <input
                            type="email"
                            className="form-control"
                            value={editUserForm.email}
                            onChange={(e) =>
                              setEditUserForm((p) => ({
                                ...p,
                                email: e.target.value,
                              }))
                            }
                            placeholder="Email address"
                          />
                        </div>
                      </div>
                      <div className="col-12">
                        <label className="form-label small fw-semibold mb-1">
                          User Type
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={editUserForm.userTypeId}
                          onChange={(e) =>
                            setEditUserForm((p) => ({
                              ...p,
                              userTypeId: e.target.value,
                            }))
                          }
                        >
                          <option value="">— Select type —</option>
                          {userTypes.map((ut) => (
                            <option key={ut.id} value={ut.id}>
                              {ut.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer border-0 pt-0">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setEditUserModal(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveEditUser}
                      disabled={!editUserForm.name?.trim()}
                    >
                      <i className="bi bi-check-lg me-1" /> Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Auto Scheme ── */}
          {activeTab === "autoScheme" &&
            (() => {
              const previewIds = Array.from({ length: 6 }, (_, i) =>
                buildUserId(autoScheme, (autoScheme.counter || 1) + i),
              );
              return (
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body p-3">
                    <h5 className="fw-semibold mb-1">Auto Scheme</h5>
                    <div className="small text-muted mb-4">
                      Define an automatic User ID generation scheme. When
                      enabled, User IDs are generated sequentially on the Users
                      page.
                    </div>

                    <div className="row g-4">
                      {/* Settings — full width */}
                      <div className="col-12">
                        {/* Enable toggle */}
                        <div
                          className="d-flex align-items-center gap-3 p-3 rounded-3 mb-4"
                          style={{
                            background: autoScheme.isAuto
                              ? "#f0fdf4"
                              : "var(--background)",
                            border: `1px solid ${autoScheme.isAuto ? "#86efac" : "var(--border)"}`,
                            transition: "all 0.2s",
                          }}
                        >
                          <div className="form-check form-switch mb-0">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id="isAutoSwitch"
                              checked={autoScheme.isAuto}
                              onChange={(e) =>
                                setAutoScheme((p) => ({
                                  ...p,
                                  isAuto: e.target.checked,
                                }))
                              }
                              style={{
                                width: "2.5em",
                                height: "1.25em",
                                cursor: "pointer",
                              }}
                            />
                          </div>
                          <label
                            htmlFor="isAutoSwitch"
                            style={{ cursor: "pointer" }}
                          >
                            <div className="fw-semibold small">
                              Enable Auto Scheme
                            </div>
                            <div
                              className="text-muted"
                              style={{ fontSize: 12 }}
                            >
                              {autoScheme.isAuto
                                ? "User IDs are auto-generated on the Users page."
                                : "Manual User ID entry is used on the Users page."}
                            </div>
                          </label>
                          {autoScheme.isAuto && (
                            <span
                              className="ms-auto badge"
                              style={{
                                background: "#dcfce7",
                                color: "#166534",
                                fontSize: 11,
                              }}
                            >
                              Active
                            </span>
                          )}
                        </div>

                        {/* Scheme fields */}
                        <fieldset disabled={!autoScheme.isAuto}>
                          <div className="row g-3">
                            <div className="col-4">
                              <label className="form-label small fw-semibold mb-1">
                                Prefix
                              </label>
                              <input
                                className="form-control form-control-sm"
                                placeholder="e.g. USR, EMP"
                                value={autoScheme.prefix}
                                onChange={(e) =>
                                  setAutoScheme((p) => ({
                                    ...p,
                                    prefix: e.target.value.replace(/\s/g, ""),
                                  }))
                                }
                              />
                              <div
                                className="text-muted mt-1"
                                style={{ fontSize: 11 }}
                              >
                                Text before the number
                              </div>
                            </div>
                            <div className="col-4">
                              <label className="form-label small fw-semibold mb-1">
                                Separator
                              </label>
                              <select
                                className="form-select form-select-sm"
                                value={autoScheme.separator}
                                onChange={(e) =>
                                  setAutoScheme((p) => ({
                                    ...p,
                                    separator: e.target.value,
                                  }))
                                }
                              >
                                <option value="">None</option>
                                <option value="-">Hyphen ( - )</option>
                                <option value="/">Slash ( / )</option>
                                <option value="_">Underscore ( _ )</option>
                                <option value=".">Dot ( . )</option>
                              </select>
                              <div
                                className="text-muted mt-1"
                                style={{ fontSize: 11 }}
                              >
                                Between prefix/postfix & number
                              </div>
                            </div>
                            <div className="col-4">
                              <label className="form-label small fw-semibold mb-1">
                                Postfix
                              </label>
                              <input
                                className="form-control form-control-sm"
                                placeholder="e.g. @org"
                                value={autoScheme.postfix}
                                onChange={(e) =>
                                  setAutoScheme((p) => ({
                                    ...p,
                                    postfix: e.target.value.replace(/\s/g, ""),
                                  }))
                                }
                              />
                              <div
                                className="text-muted mt-1"
                                style={{ fontSize: 11 }}
                              >
                                Text after the number
                              </div>
                            </div>
                            <div className="col-6">
                              <label className="form-label small fw-semibold mb-1">
                                Starting Number
                              </label>
                              <input
                                type="number"
                                min={1}
                                className="form-control form-control-sm"
                                value={autoScheme.startingNumber}
                                onChange={(e) =>
                                  setAutoScheme((p) => ({
                                    ...p,
                                    startingNumber: Number(e.target.value),
                                    counter: Number(e.target.value),
                                  }))
                                }
                              />
                              <div
                                className="text-muted mt-1"
                                style={{ fontSize: 11 }}
                              >
                                Sequence begins here
                              </div>
                            </div>
                            <div className="col-6">
                              <label className="form-label small fw-semibold mb-1">
                                Zero Padding
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={10}
                                className="form-control form-control-sm"
                                value={autoScheme.zeroPadding}
                                onChange={(e) =>
                                  setAutoScheme((p) => ({
                                    ...p,
                                    zeroPadding: Number(e.target.value),
                                  }))
                                }
                              />
                              <div
                                className="text-muted mt-1"
                                style={{ fontSize: 11 }}
                              >
                                Min digits (pad with zeros)
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 d-flex align-items-center gap-2">
                            <span className="small text-muted">
                              Next counter value:
                            </span>
                            <span
                              className="badge rounded-pill"
                              style={{
                                background: "var(--accent)",
                                color: "#6d28d9",
                                fontSize: 12,
                              }}
                            >
                              {autoScheme.counter}
                            </span>
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm ms-auto"
                              onClick={() =>
                                setAutoScheme((p) => ({
                                  ...p,
                                  counter: p.startingNumber,
                                }))
                              }
                            >
                              <i className="bi bi-arrow-counterclockwise me-1" />{" "}
                              Reset Counter
                            </button>
                          </div>
                        </fieldset>
                      </div>

                      {/* Preview — full width, centered */}
                      <div className="col-12 text-center">
                        <div className="small fw-semibold mb-2 text-muted">
                          Preview
                        </div>
                        <div className="d-flex flex-wrap justify-content-center gap-2">
                          {previewIds.map((id, i) => (
                            <span
                              key={i}
                              className="px-3 py-1 rounded-2 fw-semibold"
                              style={{
                                background: "#f3e8ff",
                                color: "#7e22ce",
                                fontSize: 13,
                                fontFamily: "monospace",
                              }}
                            >
                              {id || "—"}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

          {/* ── Pass Template ── */}
          {activeTab === "passTemplate" && (
            <Suspense
              fallback={
                <div className="card border-0 shadow-sm h-100 d-flex align-items-center justify-content-center">
                  <div className="spinner-border text-primary" />
                </div>
              }
            >
              <PassTemplateTab />
            </Suspense>
          )}

          {/* ── Form Designer ── */}
          {activeTab === "formDesigner" && (
            <Suspense
              fallback={
                <div className="card border-0 shadow-sm h-100 d-flex align-items-center justify-content-center">
                  <div className="spinner-border text-primary" />
                </div>
              }
            >
              <FormDesignerPage />
            </Suspense>
          )}

          {/* ── Form Templates ── */}
          {activeTab === "formTemplates" && (
            <Suspense
              fallback={
                <div className="card border-0 shadow-sm h-100 d-flex align-items-center justify-content-center">
                  <div className="spinner-border text-primary" />
                </div>
              }
            >
              <FormTemplatePage />
            </Suspense>
          )}

          {/* ── Configuration ── */}
          {activeTab === "configuration" && (
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-3">
                <h5 className="fw-semibold mb-1">Configuration</h5>
                <div className="small text-muted mb-4">
                  Enable or disable application-level features.
                </div>

                <div className="d-flex flex-column gap-3">
                  {CONFIG_OPTIONS.map(({ key, label, desc }) => (
                    <div
                      key={key}
                      className="d-flex justify-content-between align-items-center p-3 rounded-3"
                      style={{
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div>
                        <div className="fw-semibold small">{label}</div>
                        <div className="text-muted" style={{ fontSize: 12 }}>
                          {desc}
                        </div>
                      </div>
                      <div className="form-check form-switch mb-0 ms-3 flex-shrink-0">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={config[key] ?? DEFAULT_CONFIG[key]}
                          onChange={() =>
                            setConfig((prev) => ({
                              ...prev,
                              [key]: !(prev[key] ?? DEFAULT_CONFIG[key]),
                            }))
                          }
                          style={{ width: "2.5em", height: "1.25em" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 d-flex justify-content-end">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setConfig(DEFAULT_CONFIG)}
                  >
                    Reset to Defaults
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
