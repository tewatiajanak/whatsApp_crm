import React, { useState } from "react";
import { QrCode, Layers, Sparkles } from "lucide-react";
import QRGeneratorPage from "@/event-manager/pages/QRGeneratorPage";
import ImportQRPage from "@/event-manager/pages/ImportQRPage";

export default function QRCodeUtilityPage() {
  const [activeTab, setActiveTab] = useState("generate"); // "generate" | "bulk"

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
      {/* Top Tab Bar Navigation */}
      <div className="bg-white border rounded-xl p-2.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <QrCode className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight m-0">QR Code Studio</h1>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex p-1 bg-slate-100/90 rounded-lg border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveTab("generate")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "generate"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <QrCode className="h-4 w-4 text-indigo-600" />
            <span>Generate QR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bulk")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "bulk"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="h-4 w-4 text-sky-600" />
            <span>Bulk QR</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="tab-content-area">
        {activeTab === "generate" ? (
          <div className="animate-in fade-in duration-200">
            <QRGeneratorPage />
          </div>
        ) : (
          <div className="animate-in fade-in duration-200">
            <ImportQRPage />
          </div>
        )}
      </div>
    </div>
  );
}
