import React, { useMemo, useState } from "react";
import { flowMediaApi } from "../../api";
import { useApi } from "../../hooks/useApi";
import { useToast } from "../../context/ToastContext";

const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

export default function MediaManager() {
  const toast = useToast();
  const mediaList = useApi(() => flowMediaApi.list(), []);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [usageFilter, setUsageFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", type: "image", file: null });

  const rows = useMemo(() => Array.isArray(mediaList.data) ? mediaList.data : [], [mediaList.data]);
  const filteredRows = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    return rows.filter((row) => {
      const matchesType = typeFilter === "all" ? true : row?.type === typeFilter;
      const matchesUsage =
        usageFilter === "all"
          ? true
          : usageFilter === "in_use"
            ? Boolean(row?.inUse)
            : !row?.inUse;
      const hay = `${row?.name || ""} ${row?.fileName || ""} ${row?.url || ""}`.toLowerCase();
      const matchesSearch = !q || hay.includes(q);
      return matchesType && matchesUsage && matchesSearch;
    });
  }, [rows, searchQuery, typeFilter, usageFilter]);

  function resetForm() {
    setForm({ name: "", type: "image", file: null });
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast("Media name is required", "error");
      return;
    }
    if (!form.file) {
      toast("Please select a file", "error");
      return;
    }
    if (form.file.size > MAX_MEDIA_BYTES) {
      toast("Media file must be 5 MB or smaller", "error");
      return;
    }

    setSaving(true);
    try {
      await flowMediaApi.create({ name: form.name.trim(), type: form.type, file: form.file });
      toast("Media added successfully");
      setShowAdd(false);
      resetForm();
      mediaList.reload();
    } catch (err) {
      toast(err.message || "Failed to add media", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editing?._id) return;
    if (!form.name.trim()) {
      toast("Media name is required", "error");
      return;
    }

    setSaving(true);
    try {
      await flowMediaApi.update(editing._id, { name: form.name.trim(), type: form.type });
      toast("Media updated");
      setShowEdit(false);
      setEditing(null);
      resetForm();
      mediaList.reload();
    } catch (err) {
      toast(err.message || "Failed to update media", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row) {
    if (!row?._id) return;
    if (row.inUse) return;
    if (!confirm(`Delete media '${row.name}'?`)) return;
    try {
      await flowMediaApi.remove(row._id);
      toast("Media deleted");
      mediaList.reload();
    } catch (err) {
      toast(err.message || "Failed to delete media", "error");
    }
  }

  function copyUrl(url) {
    navigator.clipboard.writeText(url || "").then(() => {
      toast("Media URL copied");
    }).catch(() => {
      toast("Could not copy URL", "error");
    });
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
        <div>
          <h5 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-collection-play text-primary"></i>
            Manage Media
          </h5>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            resetForm();
            setShowAdd(true);
          }}
        >
          <i className="bi bi-plus-lg me-1"></i>Add Media
        </button>
      </div>

      <div className="table-responsive">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <div className="input-group input-group-sm" style={{ maxWidth: 360 }}>
            <span className="input-group-text bg-white"><i className="bi bi-search"></i></span>
            <input
              className="form-control"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by media name, file, or URL"
            />
          </div>
          <select className="form-select form-select-sm" style={{ maxWidth: 180 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="document">Document</option>
            <option value="audio">Audio</option>
          </select>
          <select className="form-select form-select-sm" style={{ maxWidth: 180 }} value={usageFilter} onChange={(e) => setUsageFilter(e.target.value)}>
            <option value="all">All Usage</option>
            <option value="in_use">In Use</option>
            <option value="not_in_use">Not In Use</option>
          </select>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => {
              setSearchQuery("");
              setTypeFilter("all");
              setUsageFilter("all");
            }}
          >
            Clear
          </button>
        </div>

        <table className="table table-hover align-middle">
          <thead>
            <tr>
              <th>Media Name</th>
              <th>Type</th>
              <th>File</th>
              <th>Media URL</th>
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!mediaList.loading && filteredRows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted small">No media found.</td>
              </tr>
            )}
            {filteredRows.map((row) => {
              const usageText = row?.inUse
                ? `In use by ${row?.usage?.templateCount || 0} template(s) and ${row?.usage?.botCount || 0} chatbot(s)`
                : "Not in use";

              return (
                <tr key={row._id}>
                  <td>
                    <div className="fw-semibold">{row.name}</div>
                    <div className="small text-muted">{usageText}</div>
                  </td>
                  <td>
                    <span className="badge rounded-pill text-bg-light text-uppercase">{row.type}</span>
                  </td>
                  <td>{row.fileName}</td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span className="small text-truncate" style={{ maxWidth: 320 }}>{row.url}</span>
                      <button className="btn btn-sm btn-outline-secondary" title="Copy URL" onClick={() => copyUrl(row.url)}>
                        <i className="bi bi-clipboard"></i>
                      </button>
                    </div>
                  </td>
                  <td className="text-end">
                    <div className="d-inline-flex gap-1">
                      <a className="btn btn-sm icon-only-action text-info" href={row.url} target="_blank" rel="noreferrer" title="View">
                        <i className="bi bi-eye"></i>
                      </a>
                      <button
                        className="btn btn-sm icon-only-action text-primary"
                        title="Edit"
                        onClick={() => {
                          setEditing(row);
                          setForm({ name: row.name || "", type: row.type || "image", file: null });
                          setShowEdit(true);
                        }}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button
                        className="btn btn-sm icon-only-action text-danger"
                        title={row.inUse ? "Delete disabled: media in use" : "Delete"}
                        disabled={Boolean(row.inUse)}
                        onClick={() => handleDelete(row)}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <Modal title="Add Media" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAddSubmit} className="d-flex flex-column gap-3">
            <div>
              <label className="form-label small fw-semibold">Media Name</label>
              <input className="form-control" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="form-label small fw-semibold">Type</label>
              <select className="form-select" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="document">Document (PDF)</option>
                <option value="audio">Audio</option>
              </select>
            </div>
            <div>
              <label className="form-label small fw-semibold">Upload File</label>
              <input
                type="file"
                className="form-control"
                accept={form.type === "image" ? "image/*" : form.type === "video" ? "video/*" : form.type === "document" ? "application/pdf" : "audio/*"}
                onChange={(e) => setForm((p) => ({ ...p, file: e.target.files?.[0] || null }))}
              />
              <div className="small text-muted mt-1">Maximum file size: 5 MB</div>
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showEdit && (
        <Modal title="Edit Media" onClose={() => setShowEdit(false)}>
          <form onSubmit={handleEditSubmit} className="d-flex flex-column gap-3">
            <div>
              <label className="form-label small fw-semibold">Media Name</label>
              <input className="form-control" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="form-label small fw-semibold">Type</label>
              <select className="form-select" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="document">Document (PDF)</option>
                <option value="audio">Audio</option>
              </select>
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setShowEdit(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                Update
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal d-block" style={{ background: "rgba(15,23,42,.45)", zIndex: 1060 }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content rounded-4 border-0 p-2 shadow">
          <div className="modal-header border-0">
            <h6 className="modal-title fw-bold">{title}</h6>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body pt-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
