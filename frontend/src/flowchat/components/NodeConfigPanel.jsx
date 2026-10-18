import React, { useEffect, useState } from 'react';
import { useBots } from '../context/BotContext.jsx';
import { NODE_TYPES } from '../data/nodeTypes';
import { uid } from '../utils/id';
import { flowMediaApi, templatesApi } from '../../api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';

export default function NodeConfigPanel({
  bot,
  selectedNodeId,
  setSelectedNodeId,
  connectingFrom,
  setConnectingFrom,
  readOnly = false,
}) {
  const { bots = [], forms = [], updateNodeData, deleteNode, setConnection } = useBots() || {};
  const toast = useToast();
  const node = selectedNodeId && bot?.nodes ? bot.nodes[selectedNodeId] : null;
  const [keywordsInput, setKeywordsInput] = useState('');
  const [uploadingNodeMedia, setUploadingNodeMedia] = useState(false);
  const waTemplates = useApi(() => templatesApi.list({ perPage: 300, channel: 'whatsapp' }), []);
  const flowMedia = useApi(() => flowMediaApi.list(), []);

  useEffect(() => {
    if (!node || node.type !== 'start') {
      setKeywordsInput('');
      return;
    }
    setKeywordsInput((node.data?.keywords || []).join(', '));
  }, [node?.id, node?.type]);

  if (!node) {
    return null;
  }

  const def = NODE_TYPES[node.type] || { label: 'Node', color: 'var(--muted-foreground)', icon: 'bi-box', description: '' };
  const patch = (data) => !readOnly && updateNodeData(bot.id, node.id, data);
  const commitKeywords = () => {
    const parsed = String(keywordsInput || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    patch({ keywords: parsed });
  };
  const otherNodes = Object.values(bot?.nodes || {}).filter((n) => n && n.id !== node.id);
  const templateOptions = (waTemplates.data || [])
    .filter((t) => (t.channel || 'whatsapp') === 'whatsapp')
    .map((t) => ({
      id: t._id,
      name: t.name,
      language: t.language || 'en',
      status: t.status || 'Draft',
      body: t.body || t.components?.find?.((c) => c?.type === 'BODY')?.text || '',
    }))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

  const mediaOptions = (Array.isArray(flowMedia.data) ? flowMedia.data : [])
    .filter((m) => (node?.data?.mediaType ? m.type === node.data.mediaType : true))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

  const handleMediaUpload = async (file) => {
    if (!file || !node || node.type !== 'mediaMessage') return;
    if (file.size > 5 * 1024 * 1024) {
      toast('Media file must be 5 MB or smaller', 'error');
      return;
    }

    setUploadingNodeMedia(true);
    try {
      const guessedName = String(file.name || 'media').replace(/\.[^.]+$/, '');
      const res = await flowMediaApi.create({
        name: guessedName,
        type: node.data?.mediaType || 'image',
        file,
      });
      const asset = res?.data?.asset || res?.asset;
      if (!asset?.url) throw new Error('Media URL not returned');
      patch({ mediaUrl: asset.url, filename: node.data?.filename || asset.fileName || '' });
      flowMedia.reload();
      toast('Media uploaded and linked to this node');
    } catch (err) {
      toast(err.message || 'Failed to upload media', 'error');
    } finally {
      setUploadingNodeMedia(false);
    }
  };

  // Compute outputs dynamically
  let outputs = [];
  if (def.outputs === 'dynamic') {
    outputs = (node.data?.buttons || []).map((b) => ({ key: b.id || b.label, label: b.label || 'Option' }));
  } else if (def.outputs === 'dynamic_condition') {
    const branches = (node.data?.branches || []).map((b, i) => ({
      key: b.id || `branch_${i}`,
      label: b.label || `Branch ${i + 1}`,
    }));
    outputs = [...branches, { key: 'else', label: node.data?.elseLabel || 'Default (Else)' }];
  } else {
    outputs = def.outputs || [];
  }

  return (
    <div className="config-panel is-open">
      {/* Read-Only Notice */}
      {readOnly && (
        <div className="fc-lock-note"><i className="bi bi-lock-fill"></i>Published — switch to draft to edit</div>
      )}

      {/* Header */}
      <div className="fc-panel-head">
        <span className="palette-icon-sm" style={{ background: def.color || 'var(--muted-foreground)', width: 32, height: 32, fontSize: 14 }}>
          <i className={`bi ${def.icon || 'bi-box'}`}></i>
        </span>
        <div className="min-w-0 flex-grow-1">
          <div className="fw-semibold text-truncate" style={{ fontSize: 15 }}>{def.label}</div>
          {def.description && <div className="text-muted" style={{ fontSize: 12, lineHeight: 1.35 }}>{def.description}</div>}
        </div>
        {node.id !== bot.startNodeId && !readOnly && (
          <button
            type="button"
            className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon"
            style={{ color: 'var(--destructive)' }}
            onClick={() => { deleteNode(bot.id, node.id); setSelectedNodeId(null); }}
            title="Delete block"
            aria-label="Delete block"
          >
            <i className="bi bi-trash3"></i>
          </button>
        )}
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" onClick={() => setSelectedNodeId(null)} title="Close" aria-label="Close">
          <i className="bi bi-x-lg"></i>
        </button>
      </div>

      {/* Field Editors */}
      <fieldset disabled={readOnly}>
        {/* START BLOCK */}
        {node.type === 'start' && (
          <>
            <Label>Trigger Keywords</Label>
            <input
              className="form-control mb-1"
              placeholder="hi, hello, start, enquiry, know more"
              value={keywordsInput}
              onChange={(e) => {
                const val = e.target.value;
                setKeywordsInput(val);
                const parsed = String(val || '')
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
                patch({ keywords: parsed });
              }}
              onBlur={commitKeywords}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitKeywords();
                }
              }}
            />
            <HelpText>Type comma-separated keywords (e.g. <code>know more, hi, enquiry</code>). Matching is case-insensitive.</HelpText>
          </>
        )}

        {/* MESSAGE BLOCK */}
        {node.type === 'message' && (
          <>
            <Label>Message Text</Label>
            <textarea
              className="form-control mb-1"
              rows={5}
              value={node.data?.text || ''}
              onChange={(e) => patch({ text: e.target.value })}
            />
            <HelpText>
              Insert saved variables using <code className="inline-var">{'{{variable_name}}'}</code> or <code className="inline-var">{'{{api_response.title}}'}</code>.
            </HelpText>
          </>
        )}

        {/* TEMPLATE MESSAGE BLOCK */}
        {node.type === 'templateMessage' && (
          <>
            <Label>Template Name</Label>
            <select
              className="form-select mb-2"
              value={node.data?.templateName || ''}
              onChange={(e) => {
                const selectedName = e.target.value;
                const tpl = templateOptions.find((t) => t.name === selectedName);
                patch({
                  templateName: selectedName,
                  languageCode: tpl?.language || node.data?.languageCode || 'en',
                  previewText: tpl?.body || node.data?.previewText || '',
                });
              }}
            >
              <option value="">— Select WhatsApp Manager Template —</option>
              {templateOptions.map((tpl) => (
                <option key={`${tpl.name}:${tpl.language}:${tpl.id}`} value={tpl.name}>
                  {tpl.name} ({tpl.language}) • {tpl.status}
                </option>
              ))}
            </select>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <HelpText>
                Dropdown shows templates available in WhatsApp manager/CRM sync.
              </HelpText>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-pill"
                onClick={() => waTemplates.reload()}
              >
                <i className={`bi ${waTemplates.loading ? 'bi-arrow-repeat spin' : 'bi-arrow-repeat'} me-1`}></i>
                Refresh
              </button>
            </div>
            {waTemplates.error && (
              <div className="alert alert-warning py-2 px-3 small mb-3">
                Could not load templates. Please check integration and try refresh.
              </div>
            )}

            <Label>Language Code</Label>
            <input
              className="form-control mb-3"
              value={node.data?.languageCode || 'en'}
              onChange={(e) => patch({ languageCode: e.target.value })}
              placeholder="en"
            />

            <Label>Template Params (comma-separated)</Label>
            <input
              className="form-control mb-1"
              value={node.data?.paramsCsv || ''}
              onChange={(e) => patch({ paramsCsv: e.target.value })}
              placeholder="{{name}}, {{order_id}}"
            />
            <HelpText>Use plain values or variables. They will be sent in order as template body params.</HelpText>

            <Label>Preview Text (optional)</Label>
            <textarea
              className="form-control"
              rows={3}
              value={node.data?.previewText || ''}
              onChange={(e) => patch({ previewText: e.target.value })}
            />
          </>
        )}

        {/* MEDIA MESSAGE BLOCK */}
        {node.type === 'mediaMessage' && (
          <>
            <Label>Media Type</Label>
            <select
              className="form-select mb-3"
              value={node.data?.mediaType || 'image'}
              onChange={(e) => patch({ mediaType: e.target.value, mediaUrl: '' })}
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="document">Document</option>
              <option value="audio">Audio</option>
            </select>

            <Label>Select from Manage Media</Label>
            <select
              className="form-select mb-2"
              value={node.data?.mediaUrl || ''}
              onChange={(e) => patch({ mediaUrl: e.target.value })}
            >
              <option value="">— Select uploaded media URL —</option>
              {mediaOptions.map((m) => (
                <option key={m._id} value={m.url}>{m.name} ({m.type})</option>
              ))}
            </select>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <HelpText>Use reusable URLs from Manage Media to avoid re-upload.</HelpText>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => flowMedia.reload()}>
                <i className={`bi ${flowMedia.loading ? 'bi-arrow-repeat spin' : 'bi-arrow-repeat'} me-1`}></i>
                Refresh
              </button>
            </div>

            <Label>Upload New Media</Label>
            <input
              type="file"
              className="form-control mb-2"
              accept={
                (node.data?.mediaType || 'image') === 'image'
                  ? 'image/*'
                  : (node.data?.mediaType || 'image') === 'video'
                    ? 'video/*'
                    : (node.data?.mediaType || 'image') === 'document'
                      ? 'application/pdf'
                      : 'audio/*'
              }
              onChange={(e) => handleMediaUpload(e.target.files?.[0])}
              disabled={uploadingNodeMedia}
            />
            {uploadingNodeMedia && (
              <div className="small text-muted mb-3">
                <span className="spinner-border spinner-border-sm me-1" />Uploading...
              </div>
            )}

            <Label>Media URL</Label>
            <input
              className="form-control mb-3"
              value={node.data?.mediaUrl || ''}
              onChange={(e) => patch({ mediaUrl: e.target.value })}
            />

            <Label>Caption</Label>
            <textarea
              className="form-control mb-3"
              rows={2}
              value={node.data?.caption || ''}
              onChange={(e) => patch({ caption: e.target.value })}
            />

            <Label>Filename (documents only)</Label>
            <input
              className="form-control"
              value={node.data?.filename || ''}
              onChange={(e) => patch({ filename: e.target.value })}
              placeholder="brochure.pdf"
            />
          </>
        )}

        {/* LIST MESSAGE BLOCK */}
        {node.type === 'listMessage' && (
          <>
            <Label>Message Text</Label>
            <textarea
              className="form-control mb-3"
              rows={3}
              value={node.data?.text || ''}
              onChange={(e) => patch({ text: e.target.value })}
            />

            <Label>Button Title</Label>
            <input
              className="form-control mb-3"
              value={node.data?.buttonTitle || 'View options'}
              onChange={(e) => patch({ buttonTitle: e.target.value })}
            />

            <Label>List Options</Label>
            {(node.data?.buttons || []).map((btn, i) => (
              <div className="input-group mb-2" key={btn.id || i}>
                <input
                  className="form-control"
                  value={btn.label || ''}
                  onChange={(e) => {
                    const buttons = [...(node.data.buttons || [])];
                    buttons[i] = { ...btn, label: e.target.value };
                    patch({ buttons });
                  }}
                />
                <button
                  className="btn btn-outline-danger"
                  disabled={(node.data.buttons || []).length <= 1}
                  onClick={() => patch({ buttons: (node.data.buttons || []).filter((b) => b.id !== btn.id) })}
                >
                  <i className="bi bi-x"></i>
                </button>
              </div>
            ))}
            <button
              className="btn btn-sm btn-outline-primary rounded-pill mt-1 mb-2"
              onClick={() => patch({ buttons: [...(node.data?.buttons || []), { id: uid('opt'), label: 'New Option' }] })}
            >
              <i className="bi bi-plus-lg me-1"></i> Add Option
            </button>
          </>
        )}

        {/* LOCATION MESSAGE BLOCK */}
        {node.type === 'locationMessage' && (
          <>
            <Label>Latitude</Label>
            <input
              className="form-control mb-3"
              value={node.data?.latitude || ''}
              onChange={(e) => patch({ latitude: e.target.value })}
              placeholder="28.6139"
            />
            <Label>Longitude</Label>
            <input
              className="form-control mb-3"
              value={node.data?.longitude || ''}
              onChange={(e) => patch({ longitude: e.target.value })}
              placeholder="77.2090"
            />
            <Label>Place Name (optional)</Label>
            <input
              className="form-control mb-3"
              value={node.data?.name || ''}
              onChange={(e) => patch({ name: e.target.value })}
            />
            <Label>Address (optional)</Label>
            <textarea
              className="form-control"
              rows={2}
              value={node.data?.address || ''}
              onChange={(e) => patch({ address: e.target.value })}
            />
          </>
        )}

        {/* BUTTONS BLOCK */}
        {node.type === 'buttons' && (
          <>
            <Label>Message Text</Label>
            <textarea
              className="form-control mb-3"
              rows={3}
              value={node.data?.text || ''}
              onChange={(e) => patch({ text: e.target.value })}
            />
            <Label>Buttons (max 3 on WhatsApp)</Label>
            {(node.data?.buttons || []).map((btn, i) => (
              <div className="input-group mb-2" key={btn.id || i}>
                <input
                  className="form-control"
                  value={btn.label || ''}
                  onChange={(e) => {
                    const buttons = [...(node.data.buttons || [])];
                    buttons[i] = { ...btn, label: e.target.value };
                    patch({ buttons });
                  }}
                />
                <button
                  className="btn btn-outline-danger"
                  disabled={(node.data.buttons || []).length <= 1}
                  onClick={() => patch({ buttons: (node.data.buttons || []).filter((b) => b.id !== btn.id) })}
                >
                  <i className="bi bi-x"></i>
                </button>
              </div>
            ))}
            {(node.data?.buttons || []).length < 3 && (
              <button
                className="btn btn-sm btn-outline-primary rounded-pill mt-1 mb-2"
                onClick={() => patch({ buttons: [...(node.data?.buttons || []), { id: uid('btn'), label: 'New Option' }] })}
              >
                <i className="bi bi-plus-lg me-1"></i> Add Button
              </button>
            )}
          </>
        )}

        {/* QUESTION BLOCK */}
        {node.type === 'question' && (
          <>
            <Label>Question Text</Label>
            <textarea
              className="form-control mb-3"
              rows={3}
              value={node.data?.text || ''}
              onChange={(e) => patch({ text: e.target.value })}
            />
            <Label>Save Answer as Variable</Label>
            <input
              className="form-control mb-3"
              value={node.data?.variableName || ''}
              onChange={(e) => patch({ variableName: e.target.value.replace(/\s/g, '_') })}
            />
            <Label>Expected Input Type</Label>
            <select
              className="form-select"
              value={node.data?.inputType || 'text'}
              onChange={(e) => patch({ inputType: e.target.value })}
            >
              <option value="text">Free text</option>
              <option value="number">Number</option>
              <option value="email">Email</option>
            </select>
          </>
        )}

        {/* WHATSAPP FORM BLOCK */}
        {node.type === 'whatsappForm' && (
          <>
            <Label>Select WhatsApp Form</Label>
            <select
              className="form-select mb-3"
              value={node.data?.formId || ''}
              onChange={(e) => patch({ formId: e.target.value })}
            >
              <option value="">— Choose a WhatsApp Form —</option>
              {(forms || []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({(f.fields || []).length} fields)
                </option>
              ))}
            </select>

            {node.data?.formId && (
              <div className="bg-light p-3 rounded-3 mb-3 border">
                {(() => {
                  const form = forms.find((f) => f.id === node.data.formId);
                  if (!form) return <div className="text-muted small">Form not found.</div>;
                  return (
                    <div>
                      <div className="fw-bold small mb-1">{form.name}</div>
                      <div className="text-muted small mb-2">{form.description}</div>
                      <div className="text-uppercase text-muted fw-bold" style={{ fontSize: 10 }}>Form Fields:</div>
                      <ul className="mb-0 ps-3 small text-muted">
                        {(form.fields || []).map((fld) => (
                          <li key={fld.id}>
                            <strong>{fld.label}</strong> ({fld.type}) {fld.required && <span className="text-danger">*</span>} ➔ <code className="inline-var">{`{{${node.data?.saveResponseAs || 'form_data'}.${fld.fieldKey}}}`}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
              </div>
            )}

            <Label>Save Form Response in Variable</Label>
            <input
              className="form-control mb-1"
              value={node.data?.saveResponseAs || 'form_data'}
              onChange={(e) => patch({ saveResponseAs: e.target.value.replace(/\s/g, '_') })}
            />
            <HelpText>
              Access collected fields in subsequent messages as <code className="inline-var">{`{{${node.data?.saveResponseAs || 'form_data'}.field_name}}`}</code>.
            </HelpText>
          </>
        )}

        {/* API REQUEST BLOCK */}
        {node.type === 'apiRequest' && (
          <>
            <Label>Method & URL</Label>
            <div className="input-group mb-3">
              <select
                className="form-select"
                style={{ maxWidth: 100 }}
                value={node.data?.method || 'GET'}
                onChange={(e) => patch({ method: e.target.value })}
              >
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>DELETE</option>
              </select>
              <input
                className="form-control"
                value={node.data?.url || ''}
                onChange={(e) => patch({ url: e.target.value })}
                placeholder="https://api.example.com/..."
              />
            </div>

            <Label>Headers</Label>
            {(node.data?.headers || []).map((h, i) => (
              <div className="input-group input-group-sm mb-2" key={i}>
                <input
                  className="form-control"
                  placeholder="Key"
                  value={h.key || ''}
                  onChange={(e) => {
                    const headers = [...(node.data.headers || [])];
                    headers[i] = { ...h, key: e.target.value };
                    patch({ headers });
                  }}
                />
                <input
                  className="form-control"
                  placeholder="Value"
                  value={h.value || ''}
                  onChange={(e) => {
                    const headers = [...(node.data.headers || [])];
                    headers[i] = { ...h, value: e.target.value };
                    patch({ headers });
                  }}
                />
                <button
                  className="btn btn-outline-danger"
                  onClick={() => patch({ headers: (node.data.headers || []).filter((_, idx) => idx !== i) })}
                >
                  <i className="bi bi-x"></i>
                </button>
              </div>
            ))}
            <button
              className="btn btn-sm btn-outline-primary rounded-pill mb-3"
              onClick={() => patch({ headers: [...(node.data?.headers || []), { key: '', value: '' }] })}
            >
              <i className="bi bi-plus-lg me-1"></i> Add Header
            </button>

            {(node.data?.method === 'POST' || node.data?.method === 'PUT') && (
              <>
                <Label>Request Body (JSON)</Label>
                <textarea
                  className="form-control mb-3"
                  rows={4}
                  value={node.data?.body || ''}
                  onChange={(e) => patch({ body: e.target.value })}
                  placeholder='{ "lead_id": "{{lead_id}}" }'
                />
              </>
            )}

            <Label>Save Response as Variable</Label>
            <input
              className="form-control mb-1"
              value={node.data?.saveResponseAs || 'api_response'}
              onChange={(e) => patch({ saveResponseAs: e.target.value.replace(/\s/g, '_') })}
            />
            <HelpText>
              Access response fields with <code className="inline-var">{`{{${node.data?.saveResponseAs || 'api_response'}.field}}`}</code>.
            </HelpText>
          </>
        )}

        {/* ADVANCED MULTIPLE CONDITION BLOCK */}
        {node.type === 'condition' && (
          <>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <Label>Condition Branches ({(node.data?.branches || []).length})</Label>
              <button
                className="btn btn-sm btn-outline-primary rounded-pill px-2"
                onClick={() => {
                  const branches = [
                    ...(node.data?.branches || []),
                    {
                      id: uid('branch'),
                      label: `Branch ${(node.data?.branches || []).length + 1}`,
                      matchType: 'AND',
                      rules: [{ variable: 'api_response.status', operator: 'equals', value: '1' }],
                    },
                  ];
                  patch({ branches });
                }}
              >
                <i className="bi bi-plus-lg me-1"></i> Add Branch
              </button>
            </div>

            {(node.data?.branches || []).map((branch, bIdx) => (
              <div className="border rounded-3 p-3 bg-light mb-3" key={branch.id || bIdx}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <input
                    className="form-control form-control-sm fw-bold"
                    style={{ maxWidth: 180 }}
                    value={branch.label}
                    onChange={(e) => {
                      const branches = [...(node.data.branches || [])];
                      branches[bIdx] = { ...branch, label: e.target.value };
                      patch({ branches });
                    }}
                    placeholder="Branch Name"
                  />
                  <div className="d-flex align-items-center gap-2">
                    <select
                      className="form-select form-select-sm"
                      style={{ width: 85 }}
                      value={branch.matchType || 'AND'}
                      onChange={(e) => {
                        const branches = [...(node.data.branches || [])];
                        branches[bIdx] = { ...branch, matchType: e.target.value };
                        patch({ branches });
                      }}
                    >
                      <option value="AND">ALL (AND)</option>
                      <option value="OR">ANY (OR)</option>
                    </select>
                    {(node.data?.branches || []).length > 1 && (
                      <button
                        className="btn btn-sm btn-outline-danger p-0 px-2"
                        onClick={() => {
                          const branches = (node.data.branches || []).filter((_, i) => i !== bIdx);
                          patch({ branches });
                        }}
                      >
                        <i className="bi bi-trash3"></i>
                      </button>
                    )}
                  </div>
                </div>

                {/* Rules in this Branch */}
                {(branch.rules || []).map((rule, rIdx) => (
                  <div className="bg-white p-2 rounded-2 border mb-2" key={rIdx}>
                    <div className="mb-1">
                      <input
                        className="form-control form-control-sm font-monospace"
                        placeholder="Variable: api_response.userId"
                        value={rule.variable || ''}
                        onChange={(e) => {
                          const branches = [...(node.data.branches || [])];
                          const rules = [...(branch.rules || [])];
                          rules[rIdx] = { ...rule, variable: e.target.value };
                          branches[bIdx] = { ...branch, rules };
                          patch({ branches });
                        }}
                      />
                    </div>
                    <div className="d-flex gap-1">
                      <select
                        className="form-select form-select-sm"
                        value={rule.operator || 'equals'}
                        onChange={(e) => {
                          const branches = [...(node.data.branches || [])];
                          const rules = [...(branch.rules || [])];
                          rules[rIdx] = { ...rule, operator: e.target.value };
                          branches[bIdx] = { ...branch, rules };
                          patch({ branches });
                        }}
                      >
                        <option value="equals">Equals (==)</option>
                        <option value="not_equals">Not Equals (!=)</option>
                        <option value="contains">Contains</option>
                        <option value="greater_than">Greater than (&gt;)</option>
                        <option value="less_than">Less than (&lt;)</option>
                      </select>
                      <input
                        className="form-control form-control-sm"
                        placeholder="Value (e.g. 1)"
                        value={rule.value || ''}
                        onChange={(e) => {
                          const branches = [...(node.data.branches || [])];
                          const rules = [...(branch.rules || [])];
                          rules[rIdx] = { ...rule, value: e.target.value };
                          branches[bIdx] = { ...branch, rules };
                          patch({ branches });
                        }}
                      />
                      {(branch.rules || []).length > 1 && (
                        <button
                          className="btn btn-sm btn-outline-danger p-0 px-2"
                          onClick={() => {
                            const branches = [...(node.data.branches || [])];
                            const rules = (branch.rules || []).filter((_, i) => i !== rIdx);
                            branches[bIdx] = { ...branch, rules };
                            patch({ branches });
                          }}
                        >
                          <i className="bi bi-x"></i>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  className="btn btn-sm btn-link p-0 text-decoration-none small"
                  onClick={() => {
                    const branches = [...(node.data.branches || [])];
                    const rules = [...(branch.rules || []), { variable: '', operator: 'equals', value: '' }];
                    branches[bIdx] = { ...branch, rules };
                    patch({ branches });
                  }}
                >
                  <i className="bi bi-plus-circle me-1"></i> Add Variable Rule ({branch.matchType || 'AND'})
                </button>
              </div>
            ))}

            <Label>Default Fallback Branch (Else)</Label>
            <input
              className="form-control form-control-sm mb-3"
              value={node.data?.elseLabel || 'Default (Else)'}
              onChange={(e) => patch({ elseLabel: e.target.value })}
            />
          </>
        )}

        {/* SUBCHATBOT BLOCK */}
        {node.type === 'subchatbot' && (
          <>
            <Label>Target Chatbot</Label>
            <select
              className="form-select"
              value={node.data?.targetBotId || ''}
              onChange={(e) => patch({ targetBotId: e.target.value })}
            >
              <option value="">{bots.some((b) => b && b.id !== bot?.id) ? 'Select a chatbot' : 'No other chatbots yet'}</option>
              {bots
                .filter((b) => b && b.id !== bot?.id) // every other bot of this account (older bots have no clientId)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
            <HelpText>The conversation will jump into that chatbot's Start block.</HelpText>
          </>
        )}

        {/* END BLOCK */}
        {node.type === 'end' && (
          <>
            <Label>Optional Closing Message</Label>
            <textarea
              className="form-control"
              rows={3}
              value={node.data?.text || ''}
              onChange={(e) => patch({ text: e.target.value })}
            />
          </>
        )}

        {/* CONNECTION OUTPUT DROPDOWNS */}
        {outputs.length > 0 && (
          <>
            <hr className="my-3" />
            <Label>Connects to</Label>
            {outputs.map((out) => (
              <div className="mb-2" key={out.key}>
                <div className="text-muted small mb-1">{out.label || out.key}</div>
                <select
                  className="form-select form-select-sm"
                  value={node.connections?.[out.key] || ''}
                  onChange={(e) => setConnection(bot.id, node.id, out.key, e.target.value || null)}
                >
                  <option value="">— Not connected —</option>
                  {otherNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {NODE_TYPES[n.type]?.label || n.type} — {shortLabel(n)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </>
        )}
      </fieldset>

      <VariablesHelp bot={bot} forms={forms} />
    </div>
  );
}

function shortLabel(n) {
  if (!n) return '';
  const t = n.data?.text || n.data?.url || n.data?.formId || n.id;
  return (t || '').slice(0, 28);
}

function Label({ children }) {
  return <label className="form-label mb-1">{children}</label>;
}
function HelpText({ children }) {
  return <div className="text-muted mb-3" style={{ fontSize: 11.5 }}>{children}</div>;
}

function VariablesHelp({ bot, forms = [] }) {
  const vars = new Set();
  Object.values(bot?.nodes || {}).forEach((n) => {
    if (n?.type === 'question' && n?.data?.variableName) vars.add(n.data.variableName);
    if (n?.type === 'apiRequest' && n?.data?.saveResponseAs) vars.add(n.data.saveResponseAs);
    if (n?.type === 'whatsappForm' && n?.data?.saveResponseAs) {
      const formKey = n.data.saveResponseAs;
      vars.add(formKey);
      const form = forms.find((f) => f.id === n.data?.formId);
      (form?.fields || []).forEach((f) => vars.add(`${formKey}.${f.fieldKey}`));
    }
  });
  if (vars.size === 0) return null;
  return (
    <div className="mt-4 pt-3 border-top">
      <div className="text-uppercase text-muted fw-bold mb-2" style={{ fontSize: 10.5, letterSpacing: '.06em' }}>
        Available Flow Variables
      </div>
      <div className="d-flex flex-wrap gap-1">
        {[...vars].map((v) => (
          <code className="inline-var" key={v}>{`{{${v}}}`}</code>
        ))}
      </div>
    </div>
  );
}
