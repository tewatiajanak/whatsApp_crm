import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBots } from '../context/BotContext.jsx';
import NodePalette from '../components/NodePalette.jsx';
import FlowCanvas from '../components/FlowCanvas.jsx';
import NodeConfigPanel from '../components/NodeConfigPanel.jsx';
import WhatsAppPreview from '../components/WhatsAppPreview.jsx';
import MetaSettingsModal from '../components/MetaSettingsModal.jsx';
import '../flowchat.css';

export default function BotBuilder() {
  const { botId } = useParams();
  const navigate = useNavigate();
  const { bots, updateBotMeta } = useBots() || {};
  const bot = bots?.find((b) => b.id === botId);

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null); // { nodeId, outputKey }
  const [showSettings, setShowSettings] = useState(false);
  const [nameDraft, setNameDraft] = useState(bot?.name || '');
  const [editingName, setEditingName] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [showPalette, setShowPalette] = useState(true);

  if (!bot) {
    return (
      <div className="crm-theme crm-page d-flex flex-column align-items-center justify-content-center vh-100 bg-light">
        <div className="text-center p-5 bg-white rounded-4 shadow-sm" style={{ maxWidth: 450 }}>
          <i className="bi bi-robot text-muted mb-3" style={{ fontSize: 42 }}></i>
          <h5 className="fw-bold">Chatbot Flow Not Found</h5>
          <p className="text-muted mb-4">This chatbot flow may have been deleted or doesn't exist.</p>
          <button className="btn btn-brand rounded-pill px-4" onClick={() => navigate('/crm/chatbot')}>
            <i className="bi bi-arrow-left me-1"></i> Return to Chatbot Studio
          </button>
        </div>
      </div>
    );
  }

  const isPublished = bot.status === 'live';

  const commitName = () => {
    if (nameDraft.trim() && !isPublished) updateBotMeta(bot.id, { name: nameDraft.trim() });
    setEditingName(false);
  };

  return (
    <div className="builder-shell crm-theme crm-page">
      {/* Top bar */}
      <div className="builder-topbar">
        <button
          type="button"
          className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon me-3"
          onClick={() => navigate('/crm/chatbot')}
          title="Back to chatbots"
          aria-label="Back to chatbots"
        >
          <i className="bi bi-arrow-left"></i>
        </button>

        {editingName && !isPublished ? (
          <input
            className="form-control form-control-sm fw-bold"
            style={{ width: 260 }}
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && commitName()}
          />
        ) : (
          <div
            className="fw-bold d-flex align-items-center"
            style={{ fontSize: 16, cursor: isPublished ? 'default' : 'pointer' }}
            onClick={() => {
              if (!isPublished) {
                setNameDraft(bot.name);
                setEditingName(true);
              }
            }}
            title={isPublished ? 'Flow is published' : 'Click to rename'}
          >
            {bot.name}
            {!isPublished && <i className="bi bi-pencil-fill text-muted ms-2" style={{ fontSize: 11 }}></i>}
          </div>
        )}

        <span className={`badge rounded-pill ms-3 ${isPublished ? 'badge-status-live' : 'badge-status-draft'}`} style={{ fontWeight: 600 }}>
          <i className={`bi ${isPublished ? 'bi-broadcast' : 'bi-pencil'} me-1`}></i>
          {isPublished ? 'Live on WhatsApp' : 'Draft Flow'}
        </span>

        {isPublished && (
          <span className="badge bg-secondary-subtle text-secondary border ms-2 small d-none d-sm-inline">
            <i className="bi bi-lock-fill me-1"></i>Read-Only
          </span>
        )}

        {/* View toggles */}
        <div className="d-none d-md-flex ms-4 fc-seg" role="group" aria-label="Panels">
          <button type="button" className={showPalette ? 'on' : ''} aria-pressed={showPalette} onClick={() => setShowPalette(!showPalette)}>
            <i className="bi bi-grid"></i>Blocks
          </button>
          <button type="button" className={showPreview ? 'on' : ''} aria-pressed={showPreview} onClick={() => setShowPreview(!showPreview)}>
            <i className="bi bi-phone"></i>Phone preview
          </button>
        </div>

        <div className="ms-auto d-flex align-items-center gap-2">
          <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => setShowSettings(true)}>
            <i className="bi bi-gear"></i>Meta API
          </button>

          {isPublished ? (
            <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => updateBotMeta(bot.id, { status: 'draft' })}>
              <i className="bi bi-pencil-square"></i>Edit (switch to draft)
            </button>
          ) : (
            <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => updateBotMeta(bot.id, { status: 'live' })}>
              <i className="bi bi-broadcast"></i>Publish
            </button>
          )}
        </div>
      </div>

      {/* Body: palette | canvas | config | preview */}
      <div className="builder-body">
        {showPalette && <NodePalette readOnly={isPublished} />}
        <FlowCanvas
          bot={bot}
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={setSelectedNodeId}
          connectingFrom={connectingFrom}
          setConnectingFrom={setConnectingFrom}
          readOnly={isPublished}
        />
        <NodeConfigPanel
          bot={bot}
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={setSelectedNodeId}
          connectingFrom={connectingFrom}
          setConnectingFrom={setConnectingFrom}
          readOnly={isPublished}
        />
        {showPreview && <WhatsAppPreview bot={bot} />}
      </div>

      {showSettings && <MetaSettingsModal bot={bot} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
