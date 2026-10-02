import DateInput from "./DateInput";
import { useState, useEffect } from "react";
import { leadsApi } from "../api";
import { useToast } from "../context/ToastContext";
import { Spinner, ErrorBox } from "./ui";

export default function RegistrationSlider({ lead, onClose, onSaved }) {
  const toast = useToast();
  const [isClosing, setIsClosing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    studentName: "",
    phone: "",
    email: "",
    fatherName: "",
    motherName: "",
    dob: "",
    gender: "Male",
    category: "General",
    program: "",
    academicYear: "2026-2027",
    address: "",
    city: "",
    state: "",
    previousSchool: "",
    percentage: "",
    registrationFee: "1000",
    paymentMode: "UPI",
    paymentStatus: "Paid",
    transactionId: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
    remarks: "",
    docMarksheet: true,
    docIdentity: true,
    docPhoto: true,
  });

  useEffect(() => {
    if (lead) {
      setForm((prev) => ({
        ...prev,
        studentName: lead.name || "",
        phone: lead.phone || "",
        email: lead.email || "",
        program: lead.serviceTracks?.[0]?.service?.name || lead.service || "B.Tech Computer Science",
        city: lead.city || "",
        state: lead.state || "",
      }));
    }
  }, [lead]);

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleClose = () => {
    setIsClosing(true);
  };

  async function handleRegister(e) {
    e.preventDefault();
    setSaving(true);
    try {
      // Update lead status to "Registered" or save registration data
      await leadsApi.update(lead._id, {
        name: form.studentName,
        phone: form.phone,
        email: form.email,
        registrationData: form,
        currentRemark: `Student Registration Completed for ${form.program} (Fee: ₹${form.registrationFee} - ${form.paymentStatus})`,
      });

      toast(`Student Registration created successfully for ${form.studentName}!`);
      onSaved?.();
      onClose();
    } catch (err) {
      toast(err.message || "Failed to submit student registration", "error");
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
          width: 650,
          animation: isClosing ? "slideOutRight 0.4s ease-out forwards" : "slideInRight 0.4s ease-out",
        }}
        onAnimationEnd={() => isClosing && onClose()}
      >
        <div className="offcanvas-header border-bottom bg-light py-3 px-4">
          <div>
            <h5 className="offcanvas-title fw-bold text-primary mb-0 d-flex align-items-center gap-2">
              <i className="bi bi-clipboard-check text-primary"></i> Student Registration Form
            </h5>
          </div>
          <button className="btn-close" onClick={handleClose}></button>
        </div>

        <div className="offcanvas-body p-4">
          <form onSubmit={handleRegister}>
            {/* Section 1: Basic Student Details */}
            <div className="mb-4 p-3 border rounded-3 bg-white shadow-xs">
              <h6 className="fw-semibold text-secondary mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-person-badge text-primary"></i> 1. Student Personal Details
              </h6>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Student Full Name *</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    required
                    value={form.studentName}
                    onChange={(e) => set("studentName", e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Mobile Number *</label>
                  <input
                    type="tel"
                    className="form-control form-control-sm"
                    required
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Email Address</label>
                  <input
                    type="email"
                    className="form-control form-control-sm"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Date of Birth</label>
                  <DateInput
                    className="form-control form-control-sm"
                    value={form.dob}
                    onChange={(e) => set("dob", e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Father / Guardian Name</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={form.fatherName}
                    onChange={(e) => set("fatherName", e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Gender</label>
                  <select
                    className="form-select form-select-sm"
                    value={form.gender}
                    onChange={(e) => set("gender", e.target.value)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Program & Admission Selection */}
            <div className="mb-4 p-3 border rounded-3 bg-white shadow-xs">
              <h6 className="fw-semibold text-secondary mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-book text-success"></i> 2. Program & Academic Details
              </h6>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Program / Course *</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    required
                    value={form.program}
                    onChange={(e) => set("program", e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Academic Session</label>
                  <select
                    className="form-select form-select-sm"
                    value={form.academicYear}
                    onChange={(e) => set("academicYear", e.target.value)}
                  >
                    <option value="2026-2027">2026-2027</option>
                    <option value="2027-2028">2027-2028</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Admission Quota / Category</label>
                  <select
                    className="form-select form-select-sm"
                    value={form.category}
                    onChange={(e) => set("category", e.target.value)}
                  >
                    <option value="General">General Quota</option>
                    <option value="Management">Management Quota</option>
                    <option value="Merit">Merit Scholarship</option>
                    <option value="NRI">NRI / Foreign Quota</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Previous Percentage / CGPA</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. 88.5%"
                    value={form.percentage}
                    onChange={(e) => set("percentage", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Fee & Payment Status */}
            <div className="mb-4 p-3 border rounded-3 bg-white shadow-xs">
              <h6 className="fw-semibold text-secondary mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-currency-rupee text-warning"></i> 3. Registration Fee & Payment
              </h6>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Registration Fee Amount (₹)</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={form.registrationFee}
                    onChange={(e) => set("registrationFee", e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Payment Mode</label>
                  <select
                    className="form-select form-select-sm"
                    value={form.paymentMode}
                    onChange={(e) => set("paymentMode", e.target.value)}
                  >
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Cash">Cash at Counter</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="Card">Credit / Debit Card</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Payment Status</label>
                  <select
                    className="form-select form-select-sm"
                    value={form.paymentStatus}
                    onChange={(e) => set("paymentStatus", e.target.value)}
                  >
                    <option value="Paid">Paid / Received</option>
                    <option value="Pending">Pending</option>
                    <option value="Partial">Partial Payment</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Txn Reference No.</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={form.transactionId}
                    onChange={(e) => set("transactionId", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Document Verification Checklist */}
            <div className="mb-4 p-3 border rounded-3 bg-white shadow-xs">
              <h6 className="fw-semibold text-secondary mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-file-earmark-check text-info"></i> 4. Document Verification Checklist
              </h6>
              <div className="d-flex flex-wrap gap-4">
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="docMarksheet"
                    checked={form.docMarksheet}
                    onChange={(e) => set("docMarksheet", e.target.checked)}
                  />
                  <label className="form-check-label small" htmlFor="docMarksheet">
                    Marksheet Copies Submitted
                  </label>
                </div>
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="docIdentity"
                    checked={form.docIdentity}
                    onChange={(e) => set("docIdentity", e.target.checked)}
                  />
                  <label className="form-check-label small" htmlFor="docIdentity">
                    Aadhaar / ID Proof Verified
                  </label>
                </div>
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="docPhoto"
                    checked={form.docPhoto}
                    onChange={(e) => set("docPhoto", e.target.checked)}
                  />
                  <label className="form-check-label small" htmlFor="docPhoto">
                    Passport Photos Attached
                  </label>
                </div>
              </div>
            </div>

            {/* Submit Action Buttons */}
            <div className="d-flex align-items-center justify-content-end gap-2 pt-2 border-top">
              <button type="button" className="btn btn-outline-secondary" onClick={handleClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary d-inline-flex align-items-center gap-2" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm"></span>}
                <i className="bi bi-check-circle-fill"></i> Complete Student Registration
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
