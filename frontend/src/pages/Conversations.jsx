import { useState, useEffect, useRef, useCallback } from "react";
import { conversationsApi, templatesApi, leadsApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useToast } from "../context/ToastContext";
import { Spinner, EmptyState, Avatar } from "../components/ui";

const EMOJIS = ["😀", "😊", "🙂", "😉", "😍", "🤝", "👍", "🙏", "👏", "🎉", "✅", "📌", "📞", "📅", "📍", "💬", "⏰", "🔥", "💯", "❤️"];

const FILTERS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

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

function isOpen(c) {
  return c ? new Date(c.windowExpiresAt).getTime() > Date.now() : false;
}

// "5h 20m left" for an open 24-hour window
function windowLeft(c) {
  const ms = new Date(c?.windowExpiresAt).getTime() - Date.now();
  if (!(ms > 0)) return "";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h ? `${h}h ${m}m left` : `${m}m left`;
}

export default function Conversations() {
  const toast = useToast();
  const convs = useApi(() => conversationsApi.list({ perPage: 100 }), []);
  const templates = useApi(() => templatesApi.list({ status: "Approved" }), []);
  const [activeId, setActiveId] = useState(null);
  const [mobileThread, setMobileThread] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [draft, setDraft] = useState("");
  const [templateMenu, setTemplateMenu] = useState(false);
  const [emojiMenu, setEmojiMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sending, setSending] = useState(false);
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [interactiveBtns, setInteractiveBtns] = useState([
    { id: "btn_1", title: "View Fees" },
    { id: "btn_2", title: "Book Visit" },
  ]);
  const messagesRef = useRef(null);
  const inputRef = useRef(null);

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
  const unreadTotal = list.reduce((n, c) => n + (c.unread > 0 ? 1 : 0), 0);
  const filteredList = list.filter((c) => {
    if (filter === "unread" && !(c.unread > 0)) return false;
    if (filter === "open" && !isOpen(c)) return false;
    if (filter === "closed" && isOpen(c)) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [c.name, c.phone, c.last].some((v) => String(v || "").toLowerCase().includes(q));
  });
  const windowOpen = isOpen(active);

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

  function openConversation(c) {
    setActiveId(c._id);
    setMobileThread(true);
    setInteractiveMode(false);
    if (c.unread) conversationsApi.markRead(c._id).then(refreshConversationsSilently);
  }

  async function send() {
    if (!draft.trim() || !active || sending) return;
    setSending(true);
    try {
      await conversationsApi.reply(active._id, { text: draft });
      setDraft("");
      refreshConversationsSilently();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSending(false);
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

  function addEmoji(e) {
    setDraft((d) => d + e);
    setEmojiMenu(false);
    inputRef.current?.focus();
  }

  if (convs.loading && !convs.data) return <Spinner />;
  if (!list.length)
    return (
      <div className="wa-shell wa-shell-empty">
        <EmptyState icon="chat-dots" text="No conversations yet" />
      </div>
    );

  const templateList = templates.data || [];

  return (
    <div className={"wa-shell" + (mobileThread ? " is-thread" : "") + (showDetails ? "" : " no-aside")}>
      {/* ---------- list ---------- */}
      <aside className="wa-list">
        <div className="wa-list-head">
          <div className="wa-list-title">
            <span>Chats</span>
            <span className="wa-count">{list.length}</span>
          </div>
          {unreadTotal > 0 && <span className="wa-unread-note">{unreadTotal} unread</span>}
        </div>

        <div className="wa-list-tools">
          <div className="ui-search wa-search">
            <span className="ui-search-icon"><i className="bi bi-search"></i></span>
            <input className="ui-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" />
            {search && (
              <button type="button" className="wa-search-clear" onClick={() => setSearch("")} aria-label="Clear">
                <i className="bi bi-x"></i>
              </button>
            )}
          </div>
          <div className="wa-chips" role="tablist">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={filter === f.value}
                className={"wa-chip" + (filter === f.value ? " active" : "")}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="wa-list-body">
          {!filteredList.length && <div className="wa-list-empty">No chats</div>}
          {filteredList.map((c) => {
            const open = isOpen(c);
            const selected = active?._id === c._id;
            return (
              <button
                type="button"
                key={c._id}
                className={"wa-conv" + (selected ? " active" : "") + (c.unread > 0 ? " unread" : "")}
                onClick={() => openConversation(c)}
              >
                <span className="wa-avatar-wrap">
                  <Avatar name={c.name} size={40} />
                  <span className={"wa-presence " + (open ? "on" : "off")} title={open ? "Window open" : "Window closed"} />
                </span>
                <span className="wa-conv-main">
                  <span className="wa-conv-row">
                    <span className="wa-conv-name">{c.name}</span>
                    <span className="wa-conv-time">{c.lastTime}</span>
                  </span>
                  <span className="wa-conv-row">
                    <span className="wa-conv-last">{c.last || c.phone}</span>
                    {c.unread > 0 && <span className="wa-unread">{c.unread}</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ---------- thread ---------- */}
      <section className="wa-thread">
        {active && (
          <>
            <header className="wa-thread-bar">
              <button type="button" className="wa-ibtn wa-back" onClick={() => setMobileThread(false)} aria-label="Back">
                <i className="bi bi-arrow-left"></i>
              </button>
              <Avatar name={active.name} size={38} />
              <div className="wa-thread-who">
                <div className="wa-thread-name">{active.name}</div>
                <div className="wa-thread-sub">
                  <span>{active.phone}</span>
                  <span className={"wa-status " + (windowOpen ? "on" : "off")}>
                    <span className="dot" />
                    {windowOpen ? windowLeft(active) || "Open" : "Window closed"}
                  </span>
                </div>
              </div>
              <button className="ui-btn ui-btn-outline ui-btn-sm wa-convert" type="button" onClick={convertToLead}>
                <i className="bi bi-flag"></i>
                <span>Convert to lead</span>
              </button>
              <button
                type="button"
                className={"wa-ibtn wa-details-toggle" + (showDetails ? " active" : "")}
                onClick={() => setShowDetails((v) => !v)}
                title="Details"
              >
                <i className="bi bi-layout-sidebar-reverse"></i>
              </button>
            </header>

            <div className="wa-chat-messages" ref={messagesRef}>
              <div className="wa-system-chip">
                <i className="bi bi-lock"></i>
                Conversation started by {active.name.split(" ")[0]}
              </div>
              {(active.messages || []).map((m, i) => {
                const mine = m.from === "me";
                const inlineButtons = extractInlineButtons(m.text || "");
                const directButtons = Array.isArray(m.buttons) ? m.buttons.map((b) => b.title || b.label).filter(Boolean) : [];
                const buttons = directButtons.length ? directButtons : inlineButtons.options;
                return (
                  <div key={i} className={"wa-msg " + (mine ? "me" : "them")}>
                    {m.type === "template" && (
                      <div className="wa-msg-tag">
                        <i className="bi bi-file-earmark-text"></i>
                        {m.template}
                      </div>
                    )}
                    <div className="wa-msg-text">{inlineButtons.cleanText || m.text}</div>
                    <div className="wa-msg-meta">
                      {m.time}
                      {mine && <i className="bi bi-check2-all"></i>}
                    </div>
                    {buttons.length > 0 && (
                      <div className="wa-msg-btns">
                        {buttons.map((btn) => (
                          <button key={btn} type="button" onClick={() => setDraft(btn)}>
                            <i className="bi bi-reply"></i>
                            {btn}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!windowOpen && (
              <div className="wa-closed-bar">
                <i className="bi bi-clock-history"></i>
                <span>24h window closed — templates only</span>
                <button type="button" className="ui-btn ui-btn-primary ui-btn-sm ms-auto" onClick={() => setTemplateMenu(true)}>
                  <i className="bi bi-file-earmark-text"></i>
                  Template
                </button>
              </div>
            )}

            {interactiveMode && (
              <div className="wa-interactive">
                <div className="wa-interactive-head">
                  <span><i className="bi bi-ui-checks"></i> Buttons</span>
                  <button type="button" className="wa-ibtn" onClick={() => setInteractiveMode(false)} aria-label="Close">
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
                <div className="wa-interactive-grid">
                  {interactiveBtns.map((b, idx) => (
                    <input
                      key={idx}
                      className="ui-input"
                      aria-label={`Button ${idx + 1}`}
                      value={b.title}
                      onChange={(e) => {
                        const copy = [...interactiveBtns];
                        copy[idx].title = e.target.value;
                        setInteractiveBtns(copy);
                      }}
                    />
                  ))}
                </div>
                <button className="ui-btn ui-btn-primary ui-btn-sm" type="button" disabled={!draft.trim()} onClick={sendInteractive}>
                  <i className="bi bi-send"></i>
                  Send with buttons
                </button>
              </div>
            )}

            <div className="wa-composer">
              <div className="wa-composer-box">
                <div className="wa-pop-anchor">
                  <button className="wa-ibtn" type="button" title="Emoji" disabled={!windowOpen} onClick={() => setEmojiMenu((v) => !v)}>
                    <i className="bi bi-emoji-smile"></i>
                  </button>
                  {emojiMenu && (
                    <>
                      <div className="wa-pop-backdrop" onClick={() => setEmojiMenu(false)} />
                      <div className="wa-pop wa-emoji-pop">
                        {EMOJIS.map((e) => (
                          <button key={e} type="button" onClick={() => addEmoji(e)}>{e}</button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <input
                  ref={inputRef}
                  className="wa-composer-input"
                  placeholder={windowOpen ? "Type a message" : "Window closed"}
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

                <button
                  className={"wa-ibtn" + (interactiveMode ? " active" : "")}
                  title="Interactive buttons"
                  type="button"
                  disabled={!windowOpen}
                  onClick={() => setInteractiveMode(!interactiveMode)}
                >
                  <i className="bi bi-ui-checks"></i>
                </button>

                <div className="wa-pop-anchor">
                  <button className={"wa-ibtn" + (templateMenu ? " active" : "")} type="button" title="Send template" onClick={() => setTemplateMenu((v) => !v)}>
                    <i className="bi bi-file-earmark-text"></i>
                  </button>
                  {templateMenu && (
                    <>
                      <div className="wa-pop-backdrop" onClick={() => setTemplateMenu(false)} />
                      <div className="wa-pop wa-template-pop">
                        <div className="wa-pop-title">Approved templates</div>
                        {!templateList.length && <div className="wa-pop-empty">No approved templates</div>}
                        {templateList.map((t) => (
                          <button
                            key={t._id}
                            type="button"
                            className="wa-pop-item"
                            onClick={() => {
                              setTemplateMenu(false);
                              sendTemplate(t.name);
                            }}
                          >
                            <i className="bi bi-file-earmark-text"></i>
                            <span className="text-truncate">{t.name}</span>
                            {t.category && <span className="wa-pop-cat">{t.category}</span>}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <button className="wa-send" type="button" disabled={!windowOpen || !draft.trim() || sending} onClick={send} aria-label="Send">
                <i className="bi bi-send-fill"></i>
              </button>
            </div>
          </>
        )}
      </section>

      {/* ---------- details ---------- */}
      <aside className="wa-aside">
        {active && (
          <>
            <div className="wa-aside-profile">
              <Avatar name={active.name} size={64} />
              <div className="wa-aside-name">{active.name}</div>
              <div className="wa-aside-phone">{active.phone}</div>
              <span className={"wa-status pill " + (windowOpen ? "on" : "off")}>
                <span className="dot" />
                {windowOpen ? "Window open" : "Window closed"}
              </span>
            </div>
            <div className="wa-aside-section">
              <div className="wa-aside-label">Details</div>
              <dl className="wa-kv">
                <dt>Started by</dt>
                <dd>{active.name.split(" ")[0]}</dd>
                <dt>Window</dt>
                <dd>{windowOpen ? windowLeft(active) || "Open" : "Closed"}</dd>
                <dt>Assigned</dt>
                <dd>{active.assigned || "—"}</dd>
                <dt>Category</dt>
                <dd>{active.category || "—"}</dd>
                <dt>Messages</dt>
                <dd>{(active.messages || []).length}</dd>
              </dl>
            </div>
            <div className="wa-aside-section">
              <button className="ui-btn ui-btn-primary ui-btn-sm w-100" type="button" onClick={convertToLead}>
                <i className="bi bi-flag"></i>
                Convert to lead
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
