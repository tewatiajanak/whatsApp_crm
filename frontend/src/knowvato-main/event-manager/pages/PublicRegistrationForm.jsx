import DateInput from "../../../components/DateInput";
import React, { useEffect, useState } from "react";
import { useParams } from "../lib/router-shim";
import { fetchForm, fetchFormBySlug, fetchPublicEvent, publicRegister } from "../services/api";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const SYSTEM_FIELD_IDS = ["name", "email", "mobile"];

const PublicRegistrationForm = () => {
  const { eventId, formId, eventSlug, formSlug } = useParams();

  const [event, setEvent] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Helper function to convert event name to slug
  const generateSlugFromName = (name) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "");
  };

  useEffect(() => {
    const loadPublicForm = async () => {
      setLoading(true);
      setError("");
      try {
        if (formId) {
          const fetchedForm = await fetchForm(formId);
          setForm(fetchedForm);
          const data = await fetchPublicEvent(fetchedForm.eventId);
          setEvent(data);
          const init = {};
          (fetchedForm.fields || [])
            .filter((f) => f.enabled !== false)
            .forEach((f) => {
              init[f.fieldId] = f.type === "multiple-choice" ? [] : "";
            });
          const enabledCategories = (data.categories || []).filter(
            (c) =>
              c.enabled &&
              (fetchedForm.selectedCategories || []).includes(
                c.categoryId || c.id || c._id,
              ),
          );
          if (enabledCategories.length > 0) {
            init.category = "";
          }
          setFormData(init);
        } else if (formSlug) {
          try {
            const fetchedForm = await fetchFormBySlug(formSlug);
            setForm(fetchedForm);
            const eventData = await fetchPublicEvent(fetchedForm.eventId);
            setEvent(eventData);
            const init = {};
            (fetchedForm.fields || [])
              .filter((f) => f.enabled !== false)
              .forEach((f) => {
                init[f.fieldId] = f.type === "multiple-choice" ? [] : "";
              });
            const enabledCategories = (eventData.categories || []).filter(
              (c) =>
                c.enabled &&
                (fetchedForm.selectedCategories || []).includes(
                  c.categoryId || c.id || c._id,
                ),
            );
            if (enabledCategories.length > 0) {
              init.category = "";
            }
            setFormData(init);
          } catch (slugErr) {
            setError("This form is unavailable or does not exist.");
          }
        } else if (eventSlug) {
          // Handle slug-based URL like /event/annual_day_june
          try {
            const data = await fetchPublicEvent(eventSlug);
            setEvent(data);
            const init = {};
            (data.attendeeFields || [])
              .filter((f) => f.enabled)
              .forEach((f) => {
                init[f.fieldId] = f.type === "multiple-choice" ? [] : "";
              });
            const enabledCategories = (data.categories || []).filter(
              (c) => c.enabled,
            );
            if (enabledCategories.length > 0) {
              init.category = "";
            }
            setFormData(init);
          } catch (slugErr) {
            setError(
              "This registration form is unavailable or the event does not exist.",
            );
          }
        } else if (eventId) {
          const data = await fetchPublicEvent(eventId);
          setEvent(data);
          const init = {};
          (data.attendeeFields || [])
            .filter((f) => f.enabled)
            .forEach((f) => {
              init[f.fieldId] = f.type === "multiple-choice" ? [] : "";
            });
          const enabledCategories = (data.categories || []).filter(
            (c) => c.enabled,
          );
          if (enabledCategories.length > 0) {
            init.category = "";
          }
          setFormData(init);
        } else {
          setError("Event ID or slug is required.");
        }
      } catch (err) {
        setError(
          "This registration form is unavailable or the event does not exist.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadPublicForm();
  }, [eventId, formId, eventSlug, formSlug]);

  const enabledFields = event
    ? form
      ? (form.fields || []).filter((f) => f.enabled !== false)
      : (event.attendeeFields || []).filter((f) => f.enabled)
    : [];

  const enabledCategories = event
    ? (event.categories || [])
        .filter((c) => c.enabled)
        .filter((category) =>
          form
            ? (form.selectedCategories || []).includes(
                category.categoryId || category.id || category._id,
              )
            : true,
        )
    : [];

  const handleChange = (fieldId, value) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleCheckboxToggle = (fieldId, option) => {
    setFormData((prev) => {
      const current = prev[fieldId] || [];
      return {
        ...prev,
        [fieldId]: current.includes(option)
          ? current.filter((o) => o !== option)
          : [...current, option],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");

    // Validate required fields
    for (const field of enabledFields) {
      if (!field.required) continue;
      const val = formData[field.fieldId];
      if (!val || (Array.isArray(val) && val.length === 0)) {
        setSubmitError(`"${field.label}" is required.`);
        return;
      }
    }

    // Email validation
    const emailField = enabledFields.find((f) => f.fieldId === "email");
    if (emailField) {
      const email = formData.email;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setSubmitError("Please enter a valid email address.");
        return;
      }
    }

    // Mobile number validation
    const mobileField = enabledFields.find((f) => f.fieldId === "mobile");
    if (mobileField) {
      const mobile = formData.mobile;
      if (mobile) {
        const cleanMobile = mobile.replace(/\D/g, "");
        if (cleanMobile.length < 10 || cleanMobile.length > 15) {
          setSubmitError("Please enter a valid mobile number (10-15 digits).");
          return;
        }
        if (!/^\d+$/.test(cleanMobile)) {
          setSubmitError("Mobile number should contain only digits.");
          return;
        }
      }
    }

    // Validate category if required
    if (enabledCategories.length > 0 && !formData.category) {
      setSubmitError("Please select a category.");
      return;
    }

    // Map fieldId back to Attendee model keys for system fields
    const payload = {};
    if (enabledCategories.length > 0) {
      payload.category = formData.category;
    }
    enabledFields.forEach((f) => {
      const val = formData[f.fieldId];
      if (f.fieldId === "mobile") {
        payload.phone = val;
      } else if (SYSTEM_FIELD_IDS.includes(f.fieldId)) {
        payload[f.fieldId] = val;
      } else {
        payload[f.fieldId] = Array.isArray(val) ? val.join(", ") : val;
      }
    });

    setSubmitting(true);
    try {
      // Use eventId from params or from form (if using formSlug)
      const targetEventId =
        eventId || form?.eventId || event?.id || event?._id;
      if (!targetEventId) {
        setSubmitError("Event ID is missing. Please try accessing the form again.");
        return;
      }
      await publicRegister(targetEventId, payload);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    const val = formData[field.fieldId] ?? "";

    // Handle form field input types (from form designer)
    if (field.inputType === "dropdown") {
      const options = (field.options || "").split(",").map(opt => opt.trim()).filter(Boolean);
      return (
        <select
          className="form-select"
          style={{
            borderRadius: 10,
            borderColor: "var(--border)",
            padding: "12px 16px",
          }}
          value={val}
          onChange={(e) => handleChange(field.fieldId, e.target.value)}
          required={field.required}
        >
          <option value="">— Select an option —</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (field.inputType === "textarea") {
      return (
        <textarea
          className="form-control"
          style={{
            borderRadius: 10,
            borderColor: "var(--border)",
            padding: "12px 16px",
          }}
          value={val}
          onChange={(e) => handleChange(field.fieldId, e.target.value)}
          required={field.required}
          rows={4}
        />
      );
    }

    if (field.inputType === "checkbox") {
      return (
        <label className="form-check">
          <input
            type="checkbox"
            className="form-check-input"
            checked={val === true || val === "true"}
            onChange={(e) => handleChange(field.fieldId, e.target.checked)}
          />
          <span className="form-check-label">{field.label}</span>
        </label>
      );
    }

    if (field.type === "choice") {
      return (
        <select
          className="form-select"
          style={{
            borderRadius: 10,
            borderColor: "var(--border)",
            padding: "12px 16px",
          }}
          value={val}
          onChange={(e) => handleChange(field.fieldId, e.target.value)}
          required={field.required}
        >
          <option value="">— Select an option —</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "multiple-choice") {
      const checked = formData[field.fieldId] || [];
      return (
        <div className="d-flex flex-column gap-2">
          {(field.options || []).map((opt) => (
            <label key={opt} className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                checked={checked.includes(opt)}
                onChange={() => handleCheckboxToggle(field.fieldId, opt)}
              />
              <span className="form-check-label">{opt}</span>
            </label>
          ))}
        </div>
      );
    }

    if (field.type === "date") {
      return (
        <DateInput
          className="form-control"
          style={{
            borderRadius: 10,
            borderColor: "var(--border)",
            padding: "12px 16px",
          }}
          value={val}
          onChange={(e) => handleChange(field.fieldId, e.target.value)}
          required={field.required}
        />
      );
    }

    const inputType = field.inputType || "text";
    let finalType = "text";
    let pattern = null;
    let title = null;

    if (inputType === "email" || field.fieldId === "email") {
      finalType = "email";
      title = "Please enter a valid email address";
    } else if (inputType === "number" || field.fieldId === "mobile") {
      finalType = "tel";
      pattern = "[0-9]{10,15}";
      title = "Mobile number should be 10-15 digits";
    }

    return (
      <input
        type={finalType}
        className="form-control"
        style={{
          borderRadius: 10,
          borderColor: "var(--border)",
          padding: "12px 16px",
        }}
        value={val}
        onChange={(e) => handleChange(field.fieldId, e.target.value)}
        required={field.required}
        placeholder={field.placeholder || field.label}
        pattern={pattern}
        title={title}
        inputMode={field.fieldId === "mobile" ? "numeric" : "text"}
      />
    );
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--background)",
        }}
      >
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <div className="text-muted">Loading registration form...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--background)",
        }}
      >
        <div className="container" style={{ maxWidth: 560 }}>
          <div
            className="card border-0"
            style={{
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
            }}
          >
            <div className="card-body p-5 text-center">
              <i
                className="bi bi-exclamation-circle text-danger mb-3"
                style={{ fontSize: 48, display: "block" }}
              />
              <h4 className="fw-bold mb-2">Registration Unavailable</h4>
              <p className="text-muted mb-0">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--background)",
        }}
      >
        <div className="container" style={{ maxWidth: 560 }}>
          <div
            className="card border-0"
            style={{
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
            }}
          >
            <div className="card-body p-5 text-center">
              <div className="mb-4">
                <i
                  className="bi bi-check-circle text-success"
                  style={{ fontSize: 64, display: "block" }}
                />
              </div>
              <h4 className="fw-bold mb-2">Registration Successful!</h4>
              <p className="text-muted mb-4">
                Thank you for registering for{" "}
                <strong>{event?.eventName}</strong>. We look forward to seeing
                you!
              </p>
              <button
                className="btn btn-lg"
                style={{
                  background:
                    "linear-gradient(135deg, var(--primary) 0%, var(--primary) 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: 10,
                }}
                onClick={() => {
                  setSubmitted(false);
                  const init = {};
                  enabledFields.forEach((f) => {
                    init[f.fieldId] = f.type === "multiple-choice" ? [] : "";
                  });
                  if (enabledCategories.length > 0) {
                    init.category = "";
                  }
                  setFormData(init);
                  setSubmitError("");
                }}
              >
                Register Another Person
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render custom form design if available
  if (form?.elements && Array.isArray(form.elements) && form.elements.length > 0) {
    const bgElement = form.elements.find((e) => e.label === "Background Image");
    const logoElement = form.elements.find((e) => e.label === "Logo");
    const titleElement = form.elements.find((e) => e.label === "Form Title");

    return (
      <div style={{ minHeight: "100vh", background: "var(--background)" }}>
        {/* Background */}
        {bgElement?.imageUrl && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundImage: `url(${bgElement.imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: bgElement.opacity || 0.25,
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Content Container */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: form?.alignment === "left" ? "flex-start" : form?.alignment === "right" ? "flex-end" : "center",
            padding: "2rem 1rem",
          }}
        >
          {/* Form Card */}
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "white",
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
              padding: "2.5rem 2rem",
              marginLeft: form?.alignment === "left" ? "2rem" : "auto",
              marginRight: form?.alignment === "right" ? "2rem" : "auto",
            }}
          >
            {/* Logo */}
            {logoElement?.imageUrl && (
              <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                <img
                  src={logoElement.imageUrl}
                  alt="Logo"
                  style={{
                    maxWidth: "100px",
                    maxHeight: "60px",
                    height: "auto",
                  }}
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              </div>
            )}

            {/* Title */}
            {titleElement?.content && (
              <h2
                style={{
                  textAlign: "center",
                  marginBottom: "1.5rem",
                  fontSize: "24px",
                  fontWeight: "700",
                  color: titleElement.color || "#1e293b",
                }}
              >
                {titleElement.content}
              </h2>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* Category Field */}
              {enabledCategories.length > 0 && (
                <div className="mb-4">
                  <label
                    className="form-label fw-semibold mb-2"
                    style={{ fontSize: 14 }}
                  >
                    Category <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    style={{
                      borderRadius: 10,
                      borderColor: "var(--border)",
                      padding: "12px 16px",
                    }}
                    value={formData.category || ""}
                    onChange={(e) => handleChange("category", e.target.value)}
                    required
                  >
                    <option value="">— Select a category —</option>
                    {enabledCategories.map((cat) => (
                      <option key={cat.categoryId} value={cat.label}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dynamic Fields */}
              {enabledFields.map((field) => (
                <div className="mb-4" key={field.fieldId}>
                  <label
                    className="form-label fw-semibold mb-2"
                    style={{ fontSize: 14 }}
                  >
                    {field.label}
                    {field.required && (
                      <span className="text-danger ms-1">*</span>
                    )}
                  </label>
                  {renderField(field)}
                </div>
              ))}

              {/* Error Message */}
              {submitError && (
                <div
                  className="alert alert-danger py-3 mb-4"
                  style={{ borderRadius: 10 }}
                >
                  <i className="bi bi-exclamation-circle me-2" />
                  {submitError}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-lg w-100"
                style={{
                  background:
                    "linear-gradient(135deg, var(--primary) 0%, var(--primary) 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: 600,
                  padding: "14px 24px",
                  transition: "all 0.3s ease",
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.8 : 1,
                }}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Submitting...
                  </>
                ) : (
                  "Register Now"
                )}
              </button>
            </form>

            {/* Footer */}
            <div
              style={{
                textAlign: "center",
                marginTop: "2rem",
                paddingTop: "1.5rem",
                borderTop: "1px solid var(--border)",
                fontSize: "12px",
                color: "var(--muted-foreground)",
              }}
            >
              <i className="bi bi-shield-check me-1" style={{ color: "var(--primary)" }} />
              Powered by Event Management
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback to default design for events without custom form
  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      {/* Hero Section */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--primary) 0%, var(--primary) 100%)",
          padding: "3rem 1.5rem",
          color: "white",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: "0.5rem" }}>
            Event Management · Registration
          </div>
          <h1
            style={{ fontSize: 32, fontWeight: "bold", marginBottom: "0.5rem" }}
          >
            {event?.eventName}
          </h1>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "2rem",
              fontSize: 14,
              opacity: 0.95,
            }}
          >
            {event?.startDate && (
              <div>
                <i className="bi bi-calendar-event me-2" />
                {new Date(event.startDate).toLocaleDateString("en-IN", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            )}
            {event?.venue && (
              <div>
                <i className="bi bi-geo-alt me-2" />
                {event.venue}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Form Container */}
      <div
        style={{
          maxWidth: 520,
          marginTop: "-2rem",
          marginBottom: "3rem",
          position: "relative",
          zIndex: 10,
          marginLeft: form?.alignment === "left" ? "2rem" : form?.alignment === "right" ? "auto" : "auto",
          marginRight: form?.alignment === "right" ? "2rem" : form?.alignment === "left" ? "auto" : "auto",
        }}
      >
        <div
          className="card border-0"
          style={{
            borderRadius: 16,
            boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
          }}
        >
          <div className="card-body p-5">
            <form onSubmit={handleSubmit} noValidate>
              {/* Category Field */}
              {enabledCategories.length > 0 && (
                <div className="mb-4">
                  <label
                    className="form-label fw-semibold mb-2"
                    style={{ fontSize: 14 }}
                  >
                    Category <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    style={{
                      borderRadius: 10,
                      borderColor: "var(--border)",
                      padding: "12px 16px",
                    }}
                    value={formData.category || ""}
                    onChange={(e) => handleChange("category", e.target.value)}
                    required
                  >
                    <option value="">— Select a category —</option>
                    {enabledCategories.map((cat) => (
                      <option key={cat.categoryId} value={cat.label}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dynamic Fields */}
              {enabledFields.map((field) => (
                <div className="mb-4" key={field.fieldId}>
                  <label
                    className="form-label fw-semibold mb-2"
                    style={{ fontSize: 14 }}
                  >
                    {field.label}
                    {field.required && (
                      <span className="text-danger ms-1">*</span>
                    )}
                  </label>
                  {renderField(field)}
                </div>
              ))}

              {/* Error Message */}
              {submitError && (
                <div
                  className="alert alert-danger py-3 mb-4"
                  style={{ borderRadius: 10 }}
                >
                  <i className="bi bi-exclamation-circle me-2" />
                  {submitError}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-lg w-100"
                style={{
                  background:
                    "linear-gradient(135deg, var(--primary) 0%, var(--primary) 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: 600,
                  padding: "14px 24px",
                  transition: "all 0.3s ease",
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.8 : 1,
                }}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Submitting...
                  </>
                ) : (
                  "Register Now"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div
          className="text-center mt-4"
          style={{ fontSize: 12, color: "var(--muted-foreground)" }}
        >
          <i className="bi bi-shield-check me-1" style={{ color: "var(--primary)" }} />
          Powered by Event Management
        </div>
      </div>
    </div>
  );
};

export default PublicRegistrationForm;
