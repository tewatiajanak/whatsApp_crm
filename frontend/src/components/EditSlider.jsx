import { useState, useEffect } from "react";
import { leadsApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useToast } from "../context/ToastContext";
import { Spinner, ErrorBox } from "./ui";

export default function EditSlider({ lead, onClose, onSaved }) {
  const toast = useToast();
  const leadData = useApi(() => leadsApi.get(lead._id), [lead._id]);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
  };

  useEffect(() => {
    if (leadData.data) {
      setForm({
        name: leadData.data.name || "",
        phone: leadData.data.phone || "",
        email: leadData.data.email || "",
        city: leadData.data.city || "",
        state: leadData.data.state || "",
        country: leadData.data.country || ""
      });
    }
  }, [leadData.data]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      await leadsApi.update(lead._id, form);
      toast("Lead updated successfully");
      onSaved?.();
      onClose();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="offcanvas-backdrop fade show" onClick={handleClose}></div>
      <div
        className="offcanvas offcanvas-end show"
        style={{
          visibility: "visible",
          width: 500,
          animation: isClosing ? "slideOutRight 0.5s ease-out forwards" : "slideInRight 0.5s ease-out"
        }}
        onAnimationEnd={() => isClosing && onClose()}
      >
        <div className="offcanvas-header border-bottom">
          <h5 className="offcanvas-title">Edit Lead</h5>
          <button className="btn-close" onClick={handleClose}></button>
        </div>

        <div className="offcanvas-body">
          {leadData.loading ? (
            <Spinner />
          ) : leadData.error ? (
            <ErrorBox error={leadData.error} />
          ) : (
            <>
              <div className="mb-3">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  className="form-control"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">City</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="e.g., Bangalore"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">State</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.state}
                  onChange={(e) => set("state", e.target.value)}
                  placeholder="e.g., Karnataka"
                />
              </div>

              <div className="mb-4">
                <label className="form-label">Country</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.country}
                  onChange={(e) => set("country", e.target.value)}
                  placeholder="e.g., India"
                />
              </div>

              <div className="d-grid gap-2">
                <button className="btn btn-primary" disabled={saving} onClick={save}>
                  {saving && <span className="spinner-border spinner-border-sm me-2" />}
                  Save Changes
                </button>
                <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
