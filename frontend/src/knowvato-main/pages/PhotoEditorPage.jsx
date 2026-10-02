import React, { useState, useRef } from "react";
import {
  Image as ImageIcon,
  Upload,
  Crop,
  RotateCw,
  Sliders,
  Sparkles,
  Type,
  Download,
  Trash2,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Wand2,
  Layers,
  Palette,
  Eye,
  AlertCircle,
} from "lucide-react";

export default function PhotoEditorPage() {
  const [image, setImage] = useState(null);
  const [imageName, setImageName] = useState("");
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [blur, setBlur] = useState(0);
  const [activeTool, setActiveTool] = useState("adjust");
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImage(url);
      setImageName(file.name);
      // Reset adjustments
      setRotation(0);
      setBrightness(100);
      setContrast(100);
      setSaturation(100);
      setBlur(0);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setImage(url);
      setImageName(file.name);
      setRotation(0);
      setBrightness(100);
      setContrast(100);
      setSaturation(100);
      setBlur(0);
    }
  };

  const resetAll = () => {
    setRotation(0);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setBlur(0);
    setZoom(100);
  };

  const filterStyle = {
    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`,
    transform: `rotate(${rotation}deg) scale(${zoom / 100})`,
    transition: "transform 0.15s ease, filter 0.15s ease",
  };

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] bg-slate-900 text-slate-100 rounded-xl overflow-hidden border border-slate-800 shadow-md">
      {/* Top Header & Action Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-pink-500 to-indigo-500 flex items-center justify-center text-white font-bold shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-white">Photo Studio</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                Workspace Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400 m-0">
              {image ? imageName : "Upload an image to start editing"}
            </p>
          </div>
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center gap-2">
          {image && (
            <>
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(25, z - 25))}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="text-[11px] font-mono px-2 text-slate-300 min-w-[45px] text-center">
                  {zoom}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(300, z + 25))}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors flex items-center gap-1.5 text-xs"
                title="Rotate 90°"
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Rotate</span>
              </button>

              <button
                type="button"
                onClick={resetAll}
                className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition-colors text-xs"
                title="Reset all adjustments"
              >
                Reset
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{image ? "Replace Photo" : "Upload Photo"}</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>
      </div>

      {/* Main Studio Body */}
      <div className="flex flex-1 min-h-0">
        {/* Center: Canvas / Image Viewport */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex-1 flex items-center justify-center p-6 bg-slate-950/70 overflow-hidden relative"
        >
          {image ? (
            <div className="max-w-full max-h-full flex items-center justify-center overflow-hidden rounded-lg shadow-2xl bg-black/40 border border-slate-800/60 p-2">
              <img
                src={image}
                alt="Working draft"
                style={filterStyle}
                className="max-h-[calc(100vh-220px)] max-w-full object-contain rounded-md select-none"
              />
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="max-w-md w-full p-10 border-2 border-dashed border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/5 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200"
            >
              <div className="h-16 w-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 mb-4 shadow-inner">
                <ImageIcon className="h-8 w-8" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">Drag and drop your image here</h3>
              <p className="text-xs text-slate-400 mb-4">Supports PNG, JPG, WEBP, SVG up to 25MB</p>
              <button
                type="button"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Browse Files
              </button>
            </div>
          )}
        </div>

        {/* Right Tool Sidebar */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 overflow-y-auto">
          {/* Tool Tabs */}
          <div className="grid grid-cols-3 p-2 gap-1 border-b border-slate-800 bg-slate-950">
            <button
              type="button"
              onClick={() => setActiveTool("adjust")}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTool === "adjust"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sliders className="h-3.5 w-3.5 text-indigo-400" />
              <span>Adjust</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTool("filters")}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTool === "filters"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Palette className="h-3.5 w-3.5 text-pink-400" />
              <span>Filters</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTool("tools")}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTool === "tools"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Wand2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Effects</span>
            </button>
          </div>

          {/* Adjustments Panel */}
          <div className="p-4 space-y-5 flex-1">
            {activeTool === "adjust" && (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Color & Lighting
                </div>

                {/* Brightness */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Brightness</span>
                    <span className="text-slate-400 font-mono">{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Contrast */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Contrast</span>
                    <span className="text-slate-400 font-mono">{contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Saturation */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Saturation</span>
                    <span className="text-slate-400 font-mono">{saturation}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={saturation}
                    onChange={(e) => setSaturation(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Blur */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Blur Effect</span>
                    <span className="text-slate-400 font-mono">{blur}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={blur}
                    onChange={(e) => setBlur(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            )}

            {activeTool === "filters" && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Presets & Styles
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: "Original", b: 100, c: 100, s: 100 },
                    { name: "Vibrant", b: 110, c: 120, s: 140 },
                    { name: "B&W Mono", b: 105, c: 130, s: 0 },
                    { name: "Vintage Warm", b: 105, c: 90, s: 80 },
                    { name: "High Contrast", b: 100, c: 160, s: 110 },
                    { name: "Muted Cool", b: 95, c: 95, s: 60 },
                  ].map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => {
                        setBrightness(p.b);
                        setContrast(p.c);
                        setSaturation(p.s);
                      }}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500 text-left transition-colors cursor-pointer"
                    >
                      <div className="text-xs font-medium text-slate-200">{p.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Preset tone</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTool === "tools" && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Advanced Tools
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <Crop className="h-4 w-4 text-emerald-400" />
                    <span>Crop & Aspect Ratio</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <Type className="h-4 w-4 text-indigo-400" />
                    <span>Text & Watermarks</span>
                  </div>
                </div>
              </div>
            )}

            {/* Work in progress note */}
            <div className="mt-6 p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-200/90 flex gap-2.5">
              <AlertCircle className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-indigo-200 font-semibold mb-0.5">Photo Editor Module</strong>
                Ready for full image manipulation tools and custom effects pipeline.
              </div>
            </div>
          </div>

          {/* Bottom Export Action */}
          {image && (
            <div className="p-3 border-t border-slate-800 bg-slate-950 shrink-0">
              <a
                href={image}
                download={`edited_${imageName || "photo.png"}`}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 text-decoration-none shadow-xs transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Export Photo</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
