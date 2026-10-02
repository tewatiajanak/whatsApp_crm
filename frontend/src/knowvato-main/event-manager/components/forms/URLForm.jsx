// src/components/forms/URLForm.jsx
import React, { useState } from "react";
import { useQR } from "../../context/QRContext";
import { toast } from "react-toastify";

const URLForm = () => {
  const { qrData, updateQRData } = useQR();
  const [url, setUrl] = useState(qrData.value || "");

  const validateAndUpdate = (value) => {
    setUrl(value);
    if (
      value &&
      (value.startsWith("http://") ||
        value.startsWith("https://") ||
        value.startsWith("www."))
    ) {
      let finalUrl = value;
      if (!value.startsWith("http://") && !value.startsWith("https://")) {
        finalUrl = "https://" + value;
      }
      updateQRData({ value: finalUrl });
    } else if (value === "") {
      updateQRData({ value: "" });
    }
  };

  return (
    <div className="url-form">
      <label className="form-label fw-bold">Website URL</label>
      <input
        type="url"
        className="form-control mb-2"
        placeholder="https://example.com"
        value={url}
        onChange={(e) => validateAndUpdate(e.target.value)}
      />
      <small className="text-muted">
        Enter any website URL. Include https:// for best results.
      </small>
    </div>
  );
};

export default URLForm;
