// src/pages/QRGeneratorPage.jsx
import React, { useState } from "react";
import {
  BiGlobe,
  BiText,
  BiEnvelope,
  BiPhone,
  BiMessageSquare,
  BiLogoWhatsapp,
  BiWifi,
  BiIdCard,
} from "react-icons/bi";
import { useQR } from "../context/QRContext";
import QRPreview from "../components/qr/QRPreview";
import QRCustomizer from "../components/qr/QRCustomizer";
import LogoUploader from "../components/qr/LogoUploader";
import DownloadOptions from "../components/qr/DownloadOptions";
import URLForm from "../components/forms/URLForm";
import TextForm from "../components/forms/TextForm";
import EmailForm from "../components/forms/EmailForm";
import PhoneForm from "../components/forms/PhoneForm";
import SMSForm from "../components/forms/SMSForm";
import WhatsAppForm from "../components/forms/WhatsAppForm";
import WiFiForm from "../components/forms/WiFiForm";
import VCardForm from "../components/forms/VCardForm";

const QRGeneratorPage = () => {
  const { qrData, updateQRData, loading } = useQR();
  const [activeTab, setActiveTab] = useState("url");

  const contentTypes = [
    { id: "url", name: "Website URL", icon: BiGlobe },
    { id: "whatsapp", name: "WhatsApp", icon: BiLogoWhatsapp },
    { id: "email", name: "Email", icon: BiEnvelope },
    { id: "wifi", name: "WiFi", icon: BiWifi },
    { id: "vcard", name: "vCard", icon: BiIdCard },

    // { id: "text", name: "Plain Text", icon: BiText },
    // { id: "phone", name: "Phone", icon: BiPhone },
    // { id: "sms", name: "SMS", icon: BiMessageSquare },
  ];

  const renderForm = () => {
    switch (activeTab) {
      case "url":
        return <URLForm />;
      case "text":
        return <TextForm />;
      case "email":
        return <EmailForm />;
      case "phone":
        return <PhoneForm />;
      // case "sms":
      //   return <SMSForm />;
      case "whatsapp":
        return <WhatsAppForm />;
      case "wifi":
        return <WiFiForm />;
      case "vcard":
        return <VCardForm />;
      default:
        return <URLForm />;
    }
  };

  return (
    <div className="container-fluid p-1 fade-in">
      <div className="row">
        <div className="col-12 mb-3">
          <h1 className="display-6 fw-bold">QR Code Generator</h1>
        </div>
      </div>

      <div className="row mb-3">
        <div className="col-12">
          <div className="card shadow-sm border-0 rounded-5">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-start align-items-md-center flex-column flex-md-row gap-3">
                <div className="qr-content-selector d-flex flex-wrap gap-2 align-items-center w-100">
                  {contentTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.id}
                        onClick={() => {
                          setActiveTab(type.id);
                          updateQRData({
                            type: type.id,
                            value: "",
                            email: "",
                            subject: "",
                            body: "",
                            phoneNumber: "",
                            message: "",
                            ssid: "",
                            password: "",
                            encryption: "WPA",
                            hidden: false,
                            fullName: "",
                            phone: "",
                            organization: "",
                            title: "",
                            website: "",
                            address: "",
                          });
                        }}
                        className={`qr-type-button btn btn-sm d-inline-flex align-items-center justify-content-center gap-2 ${
                          activeTab === type.id ? "btn-primary" : "btn-outline-secondary"
                        }`}
                        style={{ height: "38px", minHeight: "38px", fontSize: "13px", fontWeight: "500", borderRadius: "8px", padding: "0 14px" }}
                      >
                        <Icon className="flex-shrink-0" style={{ fontSize: "16px" }} />
                        <span>{type.name}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="logo-uploader-wrapper w-100 w-md-auto">
                  <LogoUploader />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          <div className="card shadow-sm border-0 rounded-5 mb-4">
            <div className="card-body p-4">{renderForm()}</div>
          </div>

          <div className="card shadow-sm border-0 rounded-5 mb-4">
            <div className="card-body p-4">
              <QRCustomizer />
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div
            className="card shadow-sm border-0 rounded-5 sticky-top"
            style={{ top: "20px" }}
          >
            <div className="card-body p-4 text-center">
              <QRPreview />
              <div className="mt-4 mb-3">
                <div className="d-flex align-items-center justify-content-center mb-2 gap-3">
                  <label className="form-label small mb-0">QR Size:</label>
                  <div className="fw-bold">{qrData.size || 0}px</div>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    style={{ width: "90px" }}
                    min={50}
                    max={2000}
                    step={1}
                    value={qrData.size === undefined || qrData.size === null ? "" : qrData.size}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        updateQRData({ size: "" });
                        return;
                      }
                      const val = parseInt(raw, 10);
                      if (!isNaN(val)) {
                        updateQRData({ size: val });
                      }
                    }}
                    onBlur={(e) => {
                      let val = parseInt(e.target.value, 10);
                      if (isNaN(val) || val < 50) val = 50;
                      if (val > 2000) val = 2000;
                      updateQRData({ size: val });
                    }}
                  />
                </div>
                <input
                  type="range"
                  className="form-range"
                  min="50"
                  max="2000"
                  step="10"
                  value={Number(qrData.size) || 50}
                  onChange={(e) =>
                    updateQRData({
                      size: parseInt(e.target.value, 10),
                    })
                  }
                />
              </div>
              <hr className="my-4" />
              <DownloadOptions />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRGeneratorPage;
