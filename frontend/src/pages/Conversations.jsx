import { useState, useEffect, useRef, useCallback } from "react";
import { conversationsApi, templatesApi, leadsApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useToast } from "../context/ToastContext";
import { Spinner, EmptyState, Avatar } from "../components/ui";

function extractInlineButtons(text) {
  if (!text) return { cleanText: "", options: [] };
  const match = text.match(/\[buttons?:\s*([^\]]+)\]/i);
  if (!match) return { cleanText: text, options: [] };
  const options = match[1]
    .split("|")
    .map((v) => v.trim())
    .filter(Boolean);
  const cleanText = text.replace(match[0], "").replace(/\s{2,}/g, " ").trim();
  return { cleanText, options };
}

export default function Conversations() {
  const toast = useToast();
  const convs = useApi(() => conversationsApi.list({ perPage: 100 }), []);
  const templates = useApi(() => templatesApi.list({ status: "Approved" }), []);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState("");
  const [templateMenu, setTemplateMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [interactiveBtns, setInteractiveBtns] = useState([
    { id: "btn_1", title: "View Fees" },
    { id: "btn_2", title: "Book Visit" },
  ]);
  const messagesRef = useRef(null);

  const refreshConversationsSilently = useCallback(async () => {
    try {
      const res = await conversationsApi.list({ perPage: 100 });
      const next = res && Object.prototype.hasOwnProperty.call(res, "data") ? res.data : res;
      convs.setData(next || []);
    } catch {
      // Keep current UI state on background refresh failure.
    }
  }, [convs]);

  const list = convs.data || [];
  const active = list.find((c) => c._id === activeId) || list[0];
  const filteredList = list.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [c.name, c.phone, c.last].some((v) => String(v || "").toLowerCase().includes(q));
  });
  const windowOpen = active ? new Date(active.windowExpiresAt).getTime() > Date.now() : false;

  useEffect(() => {
    if (!activeId && list.length) setActiveId(list[0]._id);
  }, [list, activeId]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      refreshConversationsSilently();
    }, 2500);
    return () => clearInterval(id);
  }, [refreshConversationsSilently]);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [activeId, active?.messages?.length]);

  async function send() {
    if (!draft.trim() || !active) return;
    try {
      await conversationsApi.reply(active._id, { text: draft });
      setDraft("");
      refreshConversationsSilently();
    } catch (e) {
      toast(e.message, "error");
    }
  }

  async function sendInteractive() {
    if (!draft.trim() || !active) return;
    try {
      await conversationsApi.reply(active._id, {
        type: "buttons",
        text: draft,
        buttons: interactiveBtns.filter((b) => b.title.trim()),
      });
      setDraft("");
      setInteractiveMode(false);
      toast("Interactive Buttons sent");
      refreshConversationsSilently();
    } catch (e) {
      toast(e.message, "error");
    }
  }

  async function sendTemplate(name) {
    try {
      await conversationsApi.reply(active._id, { template: name });
      toast("Template sent");
      refreshConversationsSilently();
    } catch (e) {
      toast(e.message, "error");
    }
  }

  async function convertToLead() {
    try {
      await leadsApi.convert({ name: active.name, phone: active.phone, source: undefined });
      toast("Converted to lead");
    } catch (e) {
      toast(e.message, "error");
    }
  }

  if (convs.loading && !convs.data) return <Spinner />;
  if (!list.length)
    return (
      <EmptyState
        icon="chat-dots"
        text="No conversations yet. In the WhatsApp Business model, customers message you first."
      />
    );

  return (
    <div className="chat-grid">
      {/* list */}
      <div className="chat-list">
        <div className="wa-list-top">
          <Avatar name="You" size={36} />
          <div className="wa-list-top-actions ms-auto">
            <i className="bi bi-circle"></i>
            <i className="bi bi-chat-left-text"></i>
            <i className="bi bi-three-dots-vertical"></i>
          </div>
        </div>

        <div className="wa-list-search">
          <i className="bi bi-search"></i>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or start new chat"
          />
        </div>

        <div className="p-2 border-bottom small text-secondary d-flex justify-content-between align-items-center">
          <span>Inbox · {list.length}</span>
          <span className="badge text-bg-light">
            <i className="bi bi-arrow-down-left"></i> User-initiated
          </span>
        </div>
        {filteredList.map((c) => {
          const open = new Date(c.windowExpiresAt).getTime() > Date.now();
          return (
            <div
              key={c._id}
              className={"conv-item" + (active?._id === c._id ? " active" : "")}
              onClick={() => {
                setActiveId(c._id);
                if (c.unread) conversationsApi.markRead(c._id).then(refreshConversationsSilently);
              }}
            >
              <Avatar name={c.name} size={40} />
              <div className="flex-grow-1 min-w-0">
                <div className="d-flex justify-content-between">
                  <span className="fw-medium text-truncate">{c.name}</span>
                  <span className="text-secondary" style={{ fontSize: 10 }}>
                    {c.lastTime}
                  </span>
                </div>
                <div className="text-secondary text-truncate" style={{ fontSize: 12 }}>
                  {c.last}
                </div>
                <div className="mt-1">
                  {open ? (
                    <span className="badge text-bg-success" style={{ fontSize: 9 }}>
                      Open
                    </span>
                  ) : (
                    <span className="badge text-bg-warning" style={{ fontSize: 9 }}>
                      Window closed
                    </span>
                  )}
                  {c.unread > 0 && (
                    <span className="badge text-bg-success ms-1" style={{ fontSize: 9 }}>
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* thread */}
      <div className="chat-thread d-flex flex-column" style={{ height: "100%" }}>
        {active && (
          <>
            <div className="wa-thread-head">
              <Avatar name={active.name} size={38} />
              <div className="flex-grow-1">
                <div className="fw-semibold">{active.name}</div>
                <div className="text-secondary" style={{ fontSize: 11 }}>
                  {active.phone} ·{" "}
                  {windowOpen ? (
                    <span className="text-success">window open</span>
                  ) : (
                    <span className="text-warning">window closed</span>
                  )}
                </div>
              </div>
              <button className="btn btn-sm wa-convert-btn" type="button" onClick={convertToLead}>
                <i className="bi bi-flag me-1"></i>Convert to lead
              </button>
            </div>

            <div className="messages flex-grow-1 overflow-auto p-3" ref={messagesRef}>
              <div className="text-center mb-3">
                <span className="badge text-bg-light">
                  Conversation started by {active.name.split(" ")[0]}
                </span>
              </div>
              {(active.messages || []).map((m, i) => (
                <div key={i} className={"bubble " + (m.from === "me" ? "me" : "them")}>
                  {(() => {
                    const inlineButtons = extractInlineButtons(m.text || "");
                    const directButtons = Array.isArray(m.buttons) ? m.buttons.map((b) => b.title || b.label).filter(Boolean) : [];
                    const buttons = directButtons.length ? directButtons : inlineButtons.options;
                    return (
                      <>
                  {m.type === "template" && (
                    <div className="text-success fw-semibold mb-1" style={{ fontSize: 10 }}>
                      <i className="bi bi-file-text me-1"></i>Template · {m.template}
                    </div>
                  )}
                  {inlineButtons.cleanText || m.text}
                  {buttons.length > 0 && (
                    <div className="wa-msg-buttons">
                      {buttons.map((btn) => (
                        <button
                          key={btn}
                          type="button"
                          className="wa-msg-btn"
                          onClick={() => setDraft(btn)}
                        >
                          {btn}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="text-secondary text-end" style={{ fontSize: 10 }}>
                    {m.time} {m.from === "me" ? <i className="bi bi-check2-all"></i> : null}
                  </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>

            {!windowOpen && (
              <div className="alert alert-warning rounded-0 mb-0 py-2 small">
                <i className="bi bi-exclamation-triangle me-1"></i>24-hour window closed — only approved templates can be sent.
              </div>
            )}

            {/* Interactive Buttons Config Drawer */}
            {interactiveMode && (
              <div className="p-2 border-top bg-light">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="small fw-semibold">Interactive Buttons Config</span>
                  <button className="btn btn-sm btn-close" type="button" onClick={() => setInteractiveMode(false)}></button>
                </div>
                {interactiveBtns.map((b, idx) => (
                  <input
                    key={idx}
                    className="form-control form-control-sm mb-1"
                    placeholder={`Button ${idx + 1} Title`}
                    value={b.title}
                    onChange={(e) => {
                      const copy = [...interactiveBtns];
                      copy[idx].title = e.target.value;
                      setInteractiveBtns(copy);
                    }}
                  />
                ))}
                <button className="btn btn-sm btn-wa w-100 mt-2" type="button" onClick={sendInteractive}>
                  Send Interactive Message
                </button>
              </div>
            )}

            <div className="p-2 bg-white border-top d-flex gap-2 align-items-center wa-compose">
              <button
                className={`btn btn-sm ${interactiveMode ? "btn-secondary" : "btn-outline-secondary"}`}
                title="Send Interactive Buttons"
                type="button"
                disabled={!windowOpen}
                onClick={() => setInteractiveMode(!interactiveMode)}
              >
                <i className="bi bi-ui-checks"></i>
              </button>

              <button className="wa-compose-icon" type="button" title="Emoji">
                <i className="bi bi-emoji-smile"></i>
              </button>

              <input
                className="form-control"
                placeholder={windowOpen ? "Type a message..." : "Window closed — use a template"}
                value={draft}
                disabled={!windowOpen}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !interactiveMode) {
                    e.preventDefault();
                    send();
                  }
                }}
              />

              <button className="wa-compose-icon" type="button" title="Attach">
                <i className="bi bi-paperclip"></i>
              </button>

              <div style={{ position: "relative" }}>
                <button className="btn btn-outline-secondary" type="button" title="Send template" onClick={() => setTemplateMenu((v) => !v)}>
                  <i className="bi bi-file-text"></i>
                </button>
                {templateMenu && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 30 }} onClick={() => setTemplateMenu(false)} />
                    <div className="rounded-lg border bg-card shadow-lg" style={{ position: "absolute", right: 0, bottom: "calc(100% + 6px)", zIndex: 40, minWidth: 220, maxHeight: 280, overflowY: "auto", padding: 4 }}>
                      {!(templates.data || []).length && <div className="px-2 py-2 text-xs text-muted-foreground">No approved templates.</div>}
                      {(templates.data || []).map((t) => (
                        <button key={t._id} type="button" className="block w-full text-left px-2 py-1.5 text-sm text-foreground rounded border-0 bg-transparent hover:bg-accent/40" onClick={() => { setTemplateMenu(false); sendTemplate(t.name); }}>
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <button className="btn btn-wa wa-send-btn" type="button" disabled={!windowOpen} onClick={send}>
                <i className="bi bi-send"></i>
              </button>
            </div>
          </>
        )}
      </div>

      {/* details */}
      <div className="chat-aside p-3">
        {active && (
          <>
            <div className="text-center mb-3">
              <Avatar name={active.name} size={64} />
              <div className="fw-semibold mt-2">{active.name}</div>
              <div className="text-secondary small">{active.phone}</div>
            </div>
            <dl className="row small">
              <dt className="col-5 text-secondary fw-normal">Started by</dt>
              <dd className="col-7">{active.name.split(" ")[0]}</dd>
              <dt className="col-5 text-secondary fw-normal">Window</dt>
              <dd className="col-7">{windowOpen ? "Open" : "Closed"}</dd>
              <dt className="col-5 text-secondary fw-normal">Assigned</dt>
              <dd className="col-7">{active.assigned || "—"}</dd>
              <dt className="col-5 text-secondary fw-normal">Category</dt>
              <dd className="col-7">{active.category || "—"}</dd>
            </dl>
          </>
        )}
      </div>
    </div>
  );
}
