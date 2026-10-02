import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  Megaphone,
  BarChart3,
  Loader2,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { aiApi } from "../api";
import { getToken } from "../api/client";
import { appStore } from "../api/appStore";

export default function AICopilotWidget() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("gemini-1.5-flash");
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text: "👋 **Hello! I'm your KnowVato AI Copilot.**\n\nI can directly execute operational tasks in your project:\n- 🤖 **Create Chatbots** (e.g. *\"Create chatbot with keyword 'Learn' and ask for course\"*)\n- 📅 **Create Events & Passes** (e.g. *\"Create Event 'Open House' and generate passes but dont shoot email\"*)\n- 📢 **Run Campaigns** (e.g. *\"Run WhatsApp campaign on attached list\"*)\n- 📊 **Query CRM/DB** (e.g. *\"Show total leads and conversion stats\"*)",
      suggestions: [
        "Create chatbot with keyword 'Learn'",
        "Create Event & generate passes (no email)",
        "Run WhatsApp campaign on contacts",
        "Show CRM leads overview",
      ],
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // 1. Fetch AI status & listen to toggle changes
  const checkStatus = async () => {
    if (!getToken()) {
      const local = appStore.getItem("knowvato_ai_enabled") === "true";
      setIsEnabled(local);
      return;
    }

    try {
      const res = await aiApi.getConfig();
      const data = res?.data || {};
      const active = Boolean(data.enabled);
      setIsEnabled(active);
      if (data.provider) setProvider(data.provider);
      if (data.model) setModel(data.model);
    } catch {
      const local = appStore.getItem("knowvato_ai_enabled") === "true";
      setIsEnabled(local);
    }
  };

  useEffect(() => {
    checkStatus();

    const handleStatusChange = () => {
      checkStatus();
    };

    window.addEventListener("knowvato_ai_status_changed", handleStatusChange);
    window.addEventListener("storage", handleStatusChange);

    return () => {
      window.removeEventListener("knowvato_ai_status_changed", handleStatusChange);
      window.removeEventListener("storage", handleStatusChange);
    };
  }, []);

  // 2. Auto-scroll on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, loading]);

  // 3. Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputText || "").trim();
    if (!text || loading) return;

    const userMsg = {
      id: `usr_${Date.now()}`,
      role: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      const res = await aiApi.executeCommand({
        prompt: text,
        history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
      });

      const data = res?.data || {};
      const botMsg = {
        id: `bot_${Date.now()}`,
        role: "assistant",
        text: data.reply || "Operation completed.",
        actionExecuted: data.actionExecuted,
        links: data.links || [],
        suggestions: data.suggestions || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errorMsg = {
        id: `err_${Date.now()}`,
        role: "assistant",
        text: `⚠️ **Error executing task:** ${err.message || "Failed to contact AI service"}. Please verify API Key in Configuration ➔ AI Integration.`,
        links: [{ label: "Open AI Settings", url: "/modules/integrations-ai" }],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        text: "👋 Chat history cleared. How can I help you with CRM or event operations?",
        suggestions: [
          "Create chatbot with keyword 'Learn'",
          "Create Event & generate passes (no email)",
          "Run WhatsApp campaign on contacts",
          "Show CRM leads overview",
        ],
      },
    ]);
  };

  // If AI is not enabled by user in settings, do not render floating widget
  if (!isEnabled) {
    return null;
  }

  return (
    <>
      {/* Floating Action Button (Bottom Right) */}
      {!isOpen && (
        <div
          role="button"
          tabIndex={0}
          className="position-fixed d-flex align-items-center gap-1"
          style={{
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            background: "rgba(17, 24, 39, 0.88)",
            color: "#ffffff",
            borderRadius: "999px",
            padding: "6px 10px",
            fontSize: "11.5px",
            fontWeight: "600",
            letterSpacing: "0.02em",
            boxShadow: "0 8px 16px rgba(2, 6, 23, 0.22)",
            transition: "all 0.25s ease-in-out",
            cursor: "pointer",
            userSelect: "none",
          }}
          onClick={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsOpen(true);
            }
          }}
          title="Open KnowVato AI Copilot"
        >
          <span
            className="d-inline-flex align-items-center justify-content-center"
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #10b981 0%, #0ea5a4 100%)",
            }}
          >
            <Sparkles style={{ width: 12, height: 12 }} />
          </span>
          <span>Ask</span>
        </div>
      )}

      {/* Floating Chat Drawer Window */}
      {isOpen && (
        <div
          className="position-fixed shadow-2xl bg-white d-flex flex-column border"
          style={{
            bottom: "20px",
            right: "20px",
            width: isExpanded ? "560px" : "410px",
            height: isExpanded ? "700px" : "560px",
            maxWidth: "94vw",
            maxHeight: "90vh",
            borderRadius: "16px",
            zIndex: 10000,
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {/* Header */}
          <div
            className="p-3 d-flex align-items-center justify-content-between text-white"
            style={{
              background: "linear-gradient(135deg, #065f46 0%, #047857 50%, #1d4ed8 100%)",
            }}
          >
            <div className="d-flex align-items-center gap-2 min-w-0">
              <div
                className="rounded-circle bg-white text-emerald-700 d-flex align-items-center justify-content-center flex-shrink-0 shadow-xs"
                style={{ width: 32, height: 32 }}
              >
                <Sparkles style={{ width: 18, height: 18, color: "#059669" }} />
              </div>
              <div className="min-w-0">
                <div className="d-flex align-items-center gap-1.5">
                  <span className="fw-bold" style={{ fontSize: "13.5px" }}>
                    KnowVato AI Copilot
                  </span>
                  <span
                    className="badge bg-emerald-900 text-emerald-200"
                    style={{ fontSize: "9.5px", padding: "2px 5px", textTransform: "capitalize" }}
                  >
                    {provider}
                  </span>
                </div>
                <div style={{ fontSize: "10.5px", opacity: 0.85 }} className="d-flex align-items-center gap-1">
                  <ShieldCheck style={{ width: 11, height: 11 }} />
                  <span>Strict Operational DB Boundary</span>
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center gap-1">
              <button
                className="btn btn-sm btn-link text-white p-1"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button
                className="btn btn-sm btn-link text-white p-1"
                onClick={handleResetChat}
                title="Clear Chat History"
              >
                <RotateCcw size={15} />
              </button>
              <button
                className="btn btn-sm btn-link text-white p-1"
                onClick={() => setIsOpen(false)}
                title="Close AI Copilot"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Chat Messages Body */}
          <div
            className="flex-grow-1 p-3 overflow-y-auto"
            style={{
              background: "#f8fafc",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {messages.map((m) => {
              const isBot = m.role === "assistant";
              return (
                <div
                  key={m.id}
                  className={`d-flex flex-column ${isBot ? "align-items-start" : "align-items-end"}`}
                  style={{ maxWidth: "100%" }}
                >
                  <div
                    className="p-3 shadow-2xs"
                    style={{
                      maxWidth: "92%",
                      borderRadius: isBot ? "14px 14px 14px 2px" : "14px 14px 2px 14px",
                      background: isBot ? "#ffffff" : "#2563eb",
                      color: isBot ? "#1e293b" : "#ffffff",
                      fontSize: "13px",
                      lineHeight: "1.5",
                      border: isBot ? "1px solid #e2e8f0" : "none",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {/* Render message text with simple markdown support */}
                    <div
                      dangerouslySetInnerHTML={{
                        __html: formatMarkdown(m.text),
                      }}
                    />

                    {/* Operational Action Result Links */}
                    {m.links && m.links.length > 0 && (
                      <div className="mt-2 pt-2 border-top d-flex flex-wrap gap-1.5" style={{ borderColor: isBot ? "#f1f5f9" : "rgba(255,255,255,0.2)" }}>
                        {m.links.map((l, idx) => (
                          <Link
                            key={idx}
                            to={l.url}
                            className={`btn btn-sm py-1 px-2 text-decoration-none d-inline-flex align-items-center gap-1 rounded-pill ${
                              isBot ? "btn-outline-primary" : "btn-light text-primary"
                            }`}
                            style={{ fontSize: "11px", fontWeight: "600" }}
                            onClick={() => {
                              if (window.innerWidth < 768) setIsOpen(false);
                            }}
                          >
                            <span>{l.label}</span>
                            <ExternalLink size={11} />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Suggestion Chips */}
                  {isBot && m.suggestions && m.suggestions.length > 0 && (
                    <div className="d-flex flex-wrap gap-1 mt-1.5" style={{ maxWidth: "95%" }}>
                      {m.suggestions.map((s, idx) => (
                        <button
                          key={idx}
                          className="btn btn-sm bg-white border text-secondary py-1 px-2 rounded-pill shadow-2xs hover-lift text-start text-truncate"
                          style={{ fontSize: "11px", maxWidth: "100%" }}
                          onClick={() => handleSendMessage(s)}
                        >
                          ⚡ {s}
                        </button>
                      ))}
                    </div>
                  )}

                  {m.timestamp && (
                    <span
                      className="text-muted mt-0.5 px-1"
                      style={{ fontSize: "9.5px" }}
                    >
                      {m.timestamp}
                    </span>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="d-flex align-items-center gap-2 p-2.5 bg-white rounded-3 border align-self-start shadow-2xs" style={{ maxWidth: "80%" }}>
                <Loader2 className="animate-spin text-primary" size={16} />
                <span className="text-secondary" style={{ fontSize: "12px" }}>
                  Executing operational task in CRM...
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Form */}
          <div className="p-2.5 bg-white border-top">
            <div className="input-group">
              <textarea
                ref={inputRef}
                rows={1}
                className="form-control"
                placeholder="Type operational command (e.g. Create bot with keyword 'Learn')..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                style={{
                  fontSize: "12.5px",
                  borderRadius: "10px 0 0 10px",
                  resize: "none",
                  maxHeight: "80px",
                }}
              />
              <button
                className="btn btn-primary d-flex align-items-center justify-content-center px-3"
                onClick={() => handleSendMessage()}
                disabled={loading || !inputText.trim()}
                style={{ borderRadius: "0 10px 10px 0" }}
                title="Send Command"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              </button>
            </div>
            <div className="d-flex align-items-center justify-content-between mt-1 px-1 text-muted" style={{ fontSize: "10px" }}>
              <span>Press <kbd style={{ fontSize: "9px" }}>Enter</kbd> to execute</span>
              <Link to="/modules/integrations-ai" className="text-muted hover:text-primary text-decoration-none">
                ⚙️ AI Settings
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Simple markdown formatter helper for bold, bullet lists, code
function formatMarkdown(text) {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Inline code `code`
  html = html.replace(/`(.*?)`/g, "<code style='background: #f1f5f9; padding: 1px 4px; border-radius: 4px; color: #0f172a;'>$1</code>");

  // Bullet points
  html = html.replace(/^\s*[-•]\s*(.*)$/gm, "<div style='margin-left: 12px; margin-bottom: 2px;'>• $1</div>");

  return html;
}
