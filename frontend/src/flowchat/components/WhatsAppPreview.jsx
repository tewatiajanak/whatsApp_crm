import React, { useEffect, useRef, useState } from 'react';
import { useBots } from '../context/BotContext.jsx';

function resolvePath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function renderTemplate(text, vars) {
  if (!text) return '';
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, path) => {
    const val = resolvePath(vars, path);
    if (val === undefined) return `(${path})`;
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  });
}

function mockApiResponse(node, vars) {
  const statuses = ['Active', 'Approved', 'Under Review', 'Verified'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  return {
    ok: true,
    status: 200,
    data: {
      status,
      id: vars?.application_id || vars?.order_id || 'GW-2026-9812',
      title: 'Sample Record Output',
      userId: 1,
      message: 'Simulated API response.',
    },
  };
}

async function executeApiRequest(node, vars) {
  const method = (node.data?.method || 'GET').toUpperCase();
  let rawUrl = (node.data?.url || '').trim();
  if (!rawUrl) {
    return { ok: false, status: 400, data: { error: 'No API URL specified' } };
  }

  const url = renderTemplate(rawUrl, vars);
  const headers = {};
  (node.data?.headers || []).forEach((h) => {
    if (h && h.key && h.key.trim()) {
      headers[h.key.trim()] = renderTemplate(h.value || '', vars);
    }
  });

  let body = undefined;
  if ((method === 'POST' || method === 'PUT' || method === 'PATCH') && node.data?.body) {
    body = renderTemplate(node.data.body, vars);
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      method,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body,
    });

    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { responseText: text };
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (err) {
    console.warn('[FlowChat API] Direct fetch error or CORS restriction:', err);
    return mockApiResponse(node, vars);
  }
}

function evalSingleRule(a, operator, b) {
  const num = (v) => parseFloat(v);
  const strA = String(a ?? '').toLowerCase().trim();
  const strB = String(b ?? '').toLowerCase().trim();
  switch (operator) {
    case 'equals':
      return strA === strB;
    case 'not_equals':
      return strA !== strB;
    case 'contains':
      return strA.includes(strB);
    case 'greater_than':
      return num(a) > num(b);
    case 'less_than':
      return num(a) < num(b);
    default:
      return strA === strB;
  }
}

function evalBranchRules(branch, vars) {
  const rules = branch?.rules || [];
  if (rules.length === 0) return true;
  const matchType = branch?.matchType || 'AND';

  if (matchType === 'OR') {
    return rules.some((r) => {
      const val = resolvePath(vars, r.variable);
      return evalSingleRule(val, r.operator || 'equals', r.value || '');
    });
  } else {
    return rules.every((r) => {
      const val = resolvePath(vars, r.variable);
      return evalSingleRule(val, r.operator || 'equals', r.value || '');
    });
  }
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function extractInlineButtons(text) {
  if (!text) return { cleanText: '', options: [] };
  const match = text.match(/\[buttons?:\s*([^\]]+)\]/i);
  if (!match) return { cleanText: text, options: [] };

  const options = match[1]
    .split('|')
    .map((v) => v.trim())
    .filter(Boolean);

  const cleanText = text
    .replace(match[0], '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { cleanText, options };
}

export default function WhatsAppPreview({ bot }) {
  const { bots = [], forms = [] } = useBots() || {};
  const [messages, setMessages] = useState([]);
  const [vars, setVars] = useState({});
  const [currentBotId, setCurrentBotId] = useState(bot?.id);
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [typing, setTyping] = useState(false);
  const [awaiting, setAwaiting] = useState('keyword'); // 'keyword' | 'text' | 'form' | null | 'done'
  const [inputVal, setInputVal] = useState('');
  const [mediaErrors, setMediaErrors] = useState({});
  const [activeFormModal, setActiveFormModal] = useState(null); // form object to fill
  const [formInputs, setFormInputs] = useState({});
  const scrollRef = useRef(null);
  const timeoutRef = useRef(null);

  const startNode = bot?.nodes?.[bot?.startNodeId];
  const triggerKeywords = startNode?.data?.keywords || [];

  const restart = () => {
    clearTimeout(timeoutRef.current);
    setVars({});
    setInputVal('');
    setCurrentBotId(bot?.id);
    setCurrentNodeId(null);
    setTyping(false);
    setAwaiting('keyword');
    setMediaErrors({});
    setActiveFormModal(null);
    setFormInputs({});
    setMessages([
      {
        from: 'system',
        text: '💬 Type a keyword (e.g. "' + (triggerKeywords[0] || 'hi') + '") to test the bot flow, or click a quick prompt.',
        at: nowTime(),
      },
    ]);
  };

  useEffect(() => {
    restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  useEffect(() => {
    if (!currentNodeId) return;
    const activeBot = bots?.find((b) => b.id === currentBotId);
    const node = activeBot?.nodes?.[currentNodeId];
    if (!node) return;

    clearTimeout(timeoutRef.current);

    const step = async () => {
      switch (node.type) {
        case 'start': {
          goTo(node.connections?.next);
          break;
        }
        case 'message': {
          pushBot(renderTemplate(node.data?.text || '', vars));
          goTo(node.connections?.next);
          break;
        }
        case 'templateMessage': {
          const name = node.data?.templateName || 'template_not_set';
          const lang = node.data?.languageCode || 'en';
          const preview = renderTemplate(node.data?.previewText || '', vars);
          pushSystem(`📄 Template sent: ${name} (${lang})`);
          if (preview) pushBot(preview);
          goTo(node.connections?.next);
          break;
        }
        case 'mediaMessage': {
          const mt = String(node.data?.mediaType || 'image').toLowerCase();
          const caption = renderTemplate(node.data?.caption || '', vars);
          const url = renderTemplate(node.data?.mediaUrl || '', vars);
          pushBot(caption, undefined, { mediaType: mt, mediaUrl: url });
          goTo(node.connections?.next);
          break;
        }
        case 'listMessage': {
          pushBot(renderTemplate(node.data?.text || '', vars), node.data?.buttons || []);
          setAwaiting(null);
          break;
        }
        case 'locationMessage': {
          const lat = node.data?.latitude || '';
          const lng = node.data?.longitude || '';
          const name = node.data?.name ? ` (${renderTemplate(node.data.name, vars)})` : '';
          pushBot(`📍 Location${name}: ${lat}, ${lng}`);
          goTo(node.connections?.next);
          break;
        }
        case 'buttons': {
          pushBot(renderTemplate(node.data?.text || '', vars), node.data?.buttons || []);
          setAwaiting(null);
          break;
        }
        case 'question': {
          pushBot(renderTemplate(node.data?.text || '', vars));
          setAwaiting('text');
          break;
        }
        case 'whatsappForm': {
          const form = forms?.find((f) => f.id === node.data?.formId);
          if (!form) {
            pushSystem('⚠️ WhatsApp Form not selected in node settings.');
            goTo(node.connections?.cancelled || node.connections?.submitted);
            return;
          }
          if (String(form.status || 'active').toLowerCase() === 'inactive') {
            pushSystem(`⚠️ Form "${form.name}" is inactive.`);
            goTo(node.connections?.cancelled || node.connections?.next);
            return;
          }
          pushFormCard(form, node);
          setAwaiting('form');
          break;
        }
        case 'apiRequest': {
          setTyping(true);
          const res = await executeApiRequest(node, vars);
          setTyping(false);
          const key = (node.data?.saveResponseAs || 'api_response').trim();
          const newVars = { ...vars, [key]: res.data };
          setVars(newVars);
          pushSystem(`🌐 API ${node.data?.method || 'GET'} → ${res.status || (res.ok ? 200 : 400)} ${res.ok ? 'OK' : 'FAIL'}`);
          goTo(res.ok ? node.connections?.success : node.connections?.error);
          return;
        }
        case 'condition': {
          // Multiple branch evaluation
          const branches = node.data?.branches || [];
          let targetConnection = node.connections?.else || null;
          let matchedBranchName = node.data?.elseLabel || 'Default (Else)';

          for (const branch of branches) {
            if (evalBranchRules(branch, vars)) {
              targetConnection = node.connections?.[branch.id] || null;
              matchedBranchName = branch.label || 'Branch';
              break;
            }
          }

          pushSystem(`↳ Condition matched: "${matchedBranchName}"`);
          goTo(targetConnection);
          break;
        }
        case 'subchatbot': {
          const target = bots?.find((b) => b.id === node.data?.targetBotId);
          if (!target) {
            pushSystem('⚠️ No sub-chatbot connected here.');
            setAwaiting('done');
            return;
          }
          pushSystem(`↳ Handed off to "${target.name}"`);
          setCurrentBotId(target.id);
          setCurrentNodeId(target.startNodeId);
          return;
        }
        case 'end': {
          if (node.data?.text) pushBot(renderTemplate(node.data.text, vars));
          setAwaiting('done');
          break;
        }
        default:
          break;
      }
    };

    setTyping(true);
    timeoutRef.current = setTimeout(() => {
      setTyping(false);
      step();
    }, 400);

    return () => clearTimeout(timeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNodeId, currentBotId]);

  const pushBot = (text, buttons, meta = {}) => setMessages((m) => [...m, { from: 'bot', text, buttons, at: nowTime(), ...meta }]);
  const pushUser = (text) => setMessages((m) => [...m, { from: 'user', text, at: nowTime() }]);
  const pushSystem = (text) => setMessages((m) => [...m, { from: 'system', text, at: nowTime() }]);
  const pushFormCard = (form, node) =>
    setMessages((m) => [...m, { from: 'form_card', form, node, at: nowTime() }]);
  const markMediaError = (key) => setMediaErrors((prev) => ({ ...prev, [key]: true }));

  const goTo = (nodeId) => setCurrentNodeId(nodeId || null);

  const handleButtonClick = (label, targetId) => {
    pushUser(label);
    setAwaiting(null);
    goTo(targetId);
  };

  const handleOpenForm = (form, node) => {
    setActiveFormModal({ form, node });
    const initialInputs = {};
    (form.fields || []).forEach((f) => {
      initialInputs[f.fieldKey] = vars?.[f.fieldKey] || '';
    });
    setFormInputs(initialInputs);
  };

  const handleFormSubmitModal = (e) => {
    e.preventDefault();
    if (!activeFormModal) return;
    const { form, node } = activeFormModal;

    // Validate required fields
    for (const f of form.fields || []) {
      if (f.required && !String(formInputs[f.fieldKey] || '').trim()) {
        alert(`Please fill mandatory field: "${f.label}"`);
        return;
      }
    }

    const saveKey = (node.data?.saveResponseAs || 'form_data').trim();
    const newVars = {
      ...vars,
      [saveKey]: { ...formInputs },
    };
    setVars(newVars);
    setActiveFormModal(null);
    setAwaiting(null);

    pushUser(`📝 Submitted "${form.name}"`);
    if (form.submitSuccessMessage) {
      pushBot(renderTemplate(form.submitSuccessMessage, newVars));
    }

    // If form has auto target API URL, simulate or post
    if (form.targetApiUrl) {
      pushSystem(`🌐 Auto-posted form to ${form.targetApiUrl}`);
    }

    goTo(node.connections?.submitted);
  };

  const handleSendMessage = (textToSend) => {
    const txt = (textToSend || inputVal).trim();
    if (!txt || typing) return;
    setInputVal('');

    pushUser(txt);

    // Question answering
    if (awaiting === 'text') {
      const activeBot = bots?.find((b) => b.id === currentBotId);
      const node = activeBot?.nodes?.[currentNodeId];
      if (node?.type === 'question') {
        const varName = (node.data?.variableName || 'user_reply').trim();
        setVars((v) => ({ ...v, [varName]: txt }));
      }
      setAwaiting(null);
      goTo(node?.connections?.next);
      return;
    }

    // Trigger keyword
    const activeStartNode = bot?.nodes?.[bot?.startNodeId];
    const keywords = activeStartNode?.data?.keywords || [];
    const normalizedInput = txt.toLowerCase();

    const matchesKeyword =
      keywords.length === 0 ||
      keywords.some((k) => normalizedInput.includes(k.toLowerCase().trim()) || k.toLowerCase().trim().includes(normalizedInput));

    if (matchesKeyword) {
      setCurrentBotId(bot.id);
      setAwaiting(null);
      goTo(activeStartNode?.connections?.next || activeStartNode?.id);
    } else {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        pushBot(
          `Hello! I am ${bot.name}. Send one of the trigger keywords (${keywords.join(', ') || 'hi'}) to start.`
        );
      }, 500);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSendMessage(inputVal);
  };

  const activeBotForButtons = bots?.find((b) => b.id === currentBotId);
  const currentNode = activeBotForButtons?.nodes?.[currentNodeId];
  const suggestedChips = triggerKeywords.length > 0 ? triggerKeywords : ['Hi', 'Hello', 'Start'];

  return (
    <div className="preview-rail">
      <div className="d-flex align-items-center justify-content-between w-100 mb-3" style={{ maxWidth: 300 }}>
        <div className="fw-bold small text-uppercase text-muted" style={{ letterSpacing: '.05em' }}>
          <i className="bi bi-whatsapp me-1"></i> WhatsApp Web Preview
        </div>
        <button className="btn btn-sm btn-light rounded-pill shadow-xs border" onClick={restart} title="Restart chat">
          <i className="bi bi-arrow-clockwise me-1"></i> Restart
        </button>
      </div>

      <div className="wa-phone position-relative">
        <div className="wa-screen">
          <div className="wa-header">
            <div className="wa-avatar">
              <i className="bi bi-robot"></i>
            </div>
            <div className="wa-header-meta">
              <div className="wa-header-title">{activeBotForButtons?.name || bot?.name || 'Chatbot'}</div>
              <div className="wa-header-subtitle">online</div>
            </div>
            <div className="wa-header-actions ms-auto">
              <i className="bi bi-search"></i>
              <i className="bi bi-three-dots-vertical"></i>
            </div>
          </div>

          <div className="wa-messages" ref={scrollRef}>
            {messages.map((m, i) => (
              <React.Fragment key={i}>
                {m.from === 'system' && <div className="wa-bubble system">{m.text}</div>}

                {m.from === 'form_card' && (
                  <div className="wa-bubble bot wa-interactive-card p-2" style={{ maxWidth: '90%' }}>
                    <div className="d-flex align-items-center gap-1 fw-bold mb-1" style={{ fontSize: 11.5, color: '#0b6a61' }}>
                      <i className="bi bi-ui-checks"></i> WhatsApp Flow Form
                    </div>
                    <div className="fw-bold mb-1" style={{ fontSize: 13 }}>{m.form?.name}</div>
                    <div className="text-muted small mb-2" style={{ fontSize: 11.5 }}>{m.form?.description}</div>
                    <button
                      className="wa-btn-reply"
                      style={{ fontSize: 12 }}
                      disabled={i !== messages.length - 1}
                      onClick={() => handleOpenForm(m.form, m.node)}
                    >
                      <i className="bi bi-pencil-square me-1"></i>{m.form?.submitButtonText || 'Fill Form'}
                    </button>
                    <div className="wa-meta">{m.at}</div>
                  </div>
                )}

                {m.from !== 'system' && m.from !== 'form_card' && (
                  <div className={`wa-bubble ${m.from}`}>
                    {(() => {
                      const inlineButtons = extractInlineButtons(m.text || '');
                      const hasNodeButtons = Array.isArray(m.buttons) && m.buttons.length > 0;
                      const parsedButtons = inlineButtons.options || [];
                      const showButtons = hasNodeButtons || parsedButtons.length > 0;

                      return (
                        <>
                    {m.mediaUrl && (
                      <div className="mb-2">
                        {m.mediaType === 'image' && !mediaErrors[`${i}:${m.mediaUrl}`] && (
                          <img
                            src={m.mediaUrl}
                            alt="media"
                            style={{ width: '100%', maxWidth: 230, borderRadius: 10, display: 'block' }}
                            loading="lazy"
                            onError={() => markMediaError(`${i}:${m.mediaUrl}`)}
                          />
                        )}
                        {m.mediaType === 'video' && !mediaErrors[`${i}:${m.mediaUrl}`] && (
                          <video
                            src={m.mediaUrl}
                            controls
                            style={{ width: '100%', maxWidth: 230, borderRadius: 10, display: 'block' }}
                            onError={() => markMediaError(`${i}:${m.mediaUrl}`)}
                          />
                        )}
                        {m.mediaType === 'audio' && !mediaErrors[`${i}:${m.mediaUrl}`] && (
                          <audio
                            src={m.mediaUrl}
                            controls
                            style={{ width: '100%', maxWidth: 230 }}
                            onError={() => markMediaError(`${i}:${m.mediaUrl}`)}
                          />
                        )}
                        {m.mediaType === 'document' && (
                          <a
                            href={m.mediaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-sm btn-light border"
                          >
                            <i className="bi bi-file-earmark-pdf me-1"></i> Open Document
                          </a>
                        )}

                        {mediaErrors[`${i}:${m.mediaUrl}`] && m.mediaType !== 'document' && (
                          <div className="alert alert-warning py-1 px-2 mb-2" style={{ fontSize: 11 }}>
                            Media preview failed to load. Check URL or server reachability.
                          </div>
                        )}

                        {m.mediaType !== 'document' && (
                          <div className="mt-1" style={{ fontSize: 10.5 }}>
                            <a href={m.mediaUrl} target="_blank" rel="noreferrer">View media</a>
                          </div>
                        )}
                      </div>
                    )}
                    <div>{inlineButtons.cleanText || m.text}</div>
                    {showButtons && (
                      <div className="wa-buttons">
                        {hasNodeButtons &&
                          m.buttons.map((b) => (
                            <button
                              key={b.id || b.label}
                              className="wa-btn-reply"
                              disabled={i !== messages.length - 1}
                              onClick={() => handleButtonClick(b.label || 'Option', currentNode?.connections?.[b.id])}
                            >
                              {b.label}
                            </button>
                          ))}

                        {!hasNodeButtons &&
                          parsedButtons.map((label) => (
                            <button
                              key={label}
                              className="wa-btn-reply"
                              disabled={i !== messages.length - 1}
                              onClick={() => handleSendMessage(label)}
                            >
                              {label}
                            </button>
                          ))}
                      </div>
                    )}
                    <div className="wa-meta">
                      {m.at} {m.from === 'user' ? <i className="bi bi-check2-all" aria-label="sent"></i> : null}
                    </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </React.Fragment>
            ))}
            {typing && (
              <div className="wa-bubble bot typing-dots">
                <span></span><span></span><span></span>
              </div>
            )}
          </div>

          <div className="wa-chips-row">
            <span className="text-muted" style={{ fontSize: 10.5, alignSelf: 'center', marginRight: 2 }}>
              Quick:
            </span>
            {suggestedChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                className="wa-chip-btn"
                onClick={() => handleSendMessage(chip)}
              >
                💬 {chip}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <form className="wa-footer" onSubmit={handleFormSubmit}>
            <button type="button" className="wa-icon-btn" title="Emoji"><i className="bi bi-emoji-smile"></i></button>
            <input
              value={inputVal}
              disabled={typing}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Type a message"
            />
            <button type="button" className="wa-icon-btn" title="Attach"><i className="bi bi-paperclip"></i></button>
            <button className="wa-send-btn" type="submit" disabled={!inputVal.trim() || typing}>
              <i className="bi bi-send-fill" style={{ fontSize: 13 }}></i>
            </button>
          </form>

        {/* Interactive In-Phone Form Modal */}
          {activeFormModal && (
            <div
              className="position-absolute top-0 start-0 w-100 h-100 bg-white d-flex flex-column z-3"
              style={{ borderRadius: 26, overflow: 'hidden' }}
            >
              <div className="wa-header justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-x-lg cursor-pointer" onClick={() => setActiveFormModal(null)}></i>
                  <span className="fw-bold small">{activeFormModal.form.name}</span>
                </div>
                <button
                  className="btn btn-sm btn-link text-white text-decoration-none p-0"
                  onClick={() => {
                    setActiveFormModal(null);
                    pushUser('Form Cancelled');
                    goTo(activeFormModal.node.connections?.cancelled);
                  }}
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleFormSubmitModal} className="p-3 flex-grow-1 overflow-y-auto">
                <p className="text-muted small mb-3">{activeFormModal.form.description}</p>
                {(activeFormModal.form.fields || []).map((fld) => (
                  <div className="mb-3" key={fld.id}>
                    <label className="form-label small fw-semibold mb-1" style={{ fontSize: 12 }}>
                      {fld.label} {fld.required && <span className="text-danger">*</span>}
                    </label>
                    {fld.type === 'select' ? (
                      <select
                        className="form-select form-select-sm"
                        value={formInputs[fld.fieldKey] || ''}
                        onChange={(e) => setFormInputs({ ...formInputs, [fld.fieldKey]: e.target.value })}
                        required={fld.required}
                      >
                        <option value=""></option>
                        {(fld.options || []).map((opt, oi) => (
                          <option key={oi} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={fld.type === 'number' ? 'number' : fld.type === 'email' ? 'email' : fld.type === 'date' ? 'date' : 'text'}
                        className="form-control form-control-sm"
                        value={formInputs[fld.fieldKey] || ''}
                        onChange={(e) => setFormInputs({ ...formInputs, [fld.fieldKey]: e.target.value })}
                        required={fld.required}
                      />
                    )}
                  </div>
                ))}

                <button className="btn btn-brand w-100 rounded-pill mt-3 py-2 fw-semibold" style={{ fontSize: 13 }}>
                  {activeFormModal.form.submitButtonText || 'Submit Form'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
