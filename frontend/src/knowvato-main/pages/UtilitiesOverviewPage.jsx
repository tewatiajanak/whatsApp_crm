import React from "react";
import { Link } from "react-router-dom";
import {
  QrCode,
  Film,
  Image as ImageIcon,
  Sparkles,
  ArrowRight,
  Layers,
  Scissors,
  Wand2,
  Download,
  Sliders,
} from "lucide-react";

export default function UtilitiesOverviewPage() {
  const utilityCards = [
    {
      title: "QR Code Studio",
      subtitle: "Single & Bulk Generation",
      description:
        "Generate custom styled QR codes with logos, colors, and multiple data types (URL, WhatsApp, vCard, WiFi) or batch generate from Excel/CSV.",
      icon: QrCode,
      path: "/modules/utilities/qr",
      badge: "2-in-1 Tabs",
      color: "from-indigo-600 to-violet-600",
      accentBg: "bg-indigo-50 text-indigo-600 border-indigo-200",
      features: ["Custom Shapes & Logos", "Batch Excel/CSV Import", "Vector & PNG Exports", "Live Preview"],
    },
    {
      title: "Video Editor",
      subtitle: "Compress, Trim & Multi-Track",
      description:
        "In-browser client-side video editor powered by WebAssembly FFmpeg. Compress large videos without quality loss and edit multi-track clips.",
      icon: Film,
      path: "/modules/utilities/video-edit",
      badge: "FFmpeg WASM",
      color: "from-purple-600 to-pink-600",
      accentBg: "bg-purple-50 text-purple-600 border-purple-200",
      features: ["Compress & Convert", "Timeline Trimming & Splitting", "Multi-Track Sequencing", "Custom Target Sizes"],
    },
    {
      title: "Photo Studio",
      subtitle: "Image Adjustments & Effects",
      description:
        "Dedicated photo enhancement workspace for cropping, color adjustments, preset filters, and branded watermarks.",
      icon: ImageIcon,
      path: "/modules/utilities/photo-edit",
      badge: "Studio Ready",
      color: "from-emerald-600 to-teal-600",
      accentBg: "bg-emerald-50 text-emerald-600 border-emerald-200",
      features: ["Color & Light Controls", "Filter Presets", "Rotate & Aspect Crop", "High-Res Export"],
    },
  ];

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
      {/* Header */}
      <div className="bg-white border rounded-2xl p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-xs">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight m-0">Utilities Suite</h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                  Creative Tools
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {utilityCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className={`p-3 rounded-xl border ${card.accentBg} shadow-2xs`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200/70">
                    {card.badge}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {card.title}
                  </h3>
                  <div className="text-xs font-medium text-slate-500">{card.subtitle}</div>
                  <p className="text-xs text-slate-600 mt-2.5 leading-relaxed line-clamp-3">
                    {card.description}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Key Features
                  </div>
                  {card.features.map((feat) => (
                    <div key={feat} className="flex items-center gap-2 text-xs text-slate-600">
                      <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100">
                <Link
                  to={card.path}
                  className="w-full py-2 px-3 bg-white hover:bg-slate-900 hover:text-white text-slate-800 border border-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-2xs transition-all text-decoration-none group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600"
                >
                  <span>Launch Tool</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
