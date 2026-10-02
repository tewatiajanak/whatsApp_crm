import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBots } from '../context/BotContext.jsx';
import { systemApi } from '../../api';
import '../flowchat.css';

export default function FlowChatDashboard() {
  const { clients = [], bots = [], addClient, createBot, deleteBot, duplicateBot } = useBots() || {};
  const navigate = useNavigate();

  const [showBotModal, setShowBotModal] = useState(false);
  const [botName, setBotName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeVendor, setActiveVendor] = useState('');
  const [statusLoading, setStatusLoading] = useState(true);

  const activeClient = clients?.[0];
  const clientBots = (bots || []).filter((b) => {
    if (!b) return false;
    if (!searchQuery.trim()) return true;
    return b.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await systemApi.status();
        if (!isMounted) return;
        setActiveVendor((res?.data?.activeVendor || '').toLowerCase());
      } catch {
        if (!isMounted) return;
        setActiveVendor('simulation');
      } finally {
        if (isMounted) setStatusLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const isSimulation = !activeVendor || activeVendor.includes('simulation');
  const isMetaLive = activeVendor === 'meta';
  const statusText = statusLoading
    ? 'Checking...'
    : isMetaLive
      ? 'Meta Connected'
      : isSimulation
        ? 'Simulation'
        : 'Vendor Connected';
  const statusClass = statusLoading
    ? 'text-secondary border-secondary-subtle bg-light'
    : isMetaLive
      ? 'text-success border-success-subtle bg-success-subtle'
      : isSimulation
        ? 'text-warning-emphasis border-warning-subtle bg-warning-subtle'
        : 'text-primary border-primary-subtle bg-primary-subtle';

  const handleCreateBot = (e) => {
    e.preventDefault();
    if (!botName.trim()) return;
    // Ensure there is at least one client to attach the bot to
    const clientId = activeClient?.id || clients[0]?.id || addClient('Default Organization', '').id;
    const bot = createBot(clientId, botName.trim());
    setBotName('');
    setShowBotModal(false);
    navigate(`/crm/chatbot/builder/${bot.id}`);
  };

  return (
    <div className="flowchat-dashboard">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h4 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <span className="brand-logo" style={{ width: 32, height: 32, fontSize: 16 }}>
              <i className="bi bi-diagram-3-fill"></i>
            </span>
            Chatbot Visual Flow Builder (FlowChat Studio)
            <span className={`badge rounded-pill border ${statusClass}`} style={{ fontSize: 11 }}>
              <i className={`bi ${isMetaLive ? 'bi-meta' : isSimulation ? 'bi-cpu' : 'bi-plug'} me-1`}></i>
              {statusText}
            </span>
          </h4>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-brand btn-sm rounded-pill px-3" onClick={() => setShowBotModal(true)}>
            <i className="bi bi-plus-lg me-1"></i> New Chatbot Flow
          </button>
        </div>
      </div>

      <div className="row g-4">
        {/* Bots list (full width) */}
        <div className="col-12">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div>
              <h5 className="fw-bold mb-0">Chatbot Flows</h5>
              <div className="text-muted small">{clientBots.length} active chatbot flow(s)</div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div className="input-group input-group-sm search-input-group" style={{ width: 220 }}>
                <span className="input-group-text bg-white"><i className="bi bi-search"></i></span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search flows…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Name</th>
                      <th style={{ width: '15%' }}>Status</th>
                      <th style={{ width: '15%' }}>Blocks</th>
                      <th style={{ width: '20%' }}>Updated</th>
                      <th style={{ width: '10%' }} className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientBots.map((bot) => {
                      if (!bot) return null;
                      const nodeCount = Object.keys(bot.nodes || {}).length;
                      return (
                        <tr key={bot.id}>
                          <td>
                            <div className="fw-bold">{bot.name}</div>
                            <div className="text-muted small">{bot.description || ''}</div>
                          </td>
                          <td>
                            <span className={`badge rounded-pill ${bot.status === 'live' ? 'badge-status-live' : 'badge-status-draft'}`}>
                              <i className={`bi ${bot.status === 'live' ? 'bi-broadcast' : 'bi-pencil'} me-1`}></i>
                              {bot.status === 'live' ? 'Live' : 'Draft'}
                            </span>
                          </td>
                          <td>{nodeCount}</td>
                          <td>{new Date(bot.updatedAt || Date.now()).toLocaleDateString()}</td>
                          <td className="text-end">
                            <div className="d-inline-flex align-items-center gap-1">
                              <button
                                className="btn btn-sm icon-only-action text-primary"
                                onClick={() => navigate(`/crm/chatbot/builder/${bot.id}`)}
                                title="Open"
                                aria-label="Open"
                              >
                                <i className="bi bi-box-arrow-up-right"></i>
                              </button>
                              <button
                                className="btn btn-sm icon-only-action text-secondary"
                                onClick={() => duplicateBot(bot.id)}
                                title="Duplicate"
                                aria-label="Duplicate"
                              >
                                <i className="bi bi-copy"></i>
                              </button>
                              <button
                                className="btn btn-sm icon-only-action text-danger"
                                onClick={() => { if (confirm(`Delete flow "${bot.name}"?`)) deleteBot(bot.id); }}
                                title="Delete"
                                aria-label="Delete"
                              >
                                <i className="bi bi-trash3"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
        </div>
      </div>

      {/* New bot modal */}
      {showBotModal && (
        <Modal title={`New Chatbot Flow for ${activeClient?.name || 'Client'}`} onClose={() => setShowBotModal(false)}>
          <form onSubmit={handleCreateBot}>
            <label className="form-label small fw-semibold">Chatbot Flow Name</label>
            <input
              className="form-control mb-4"
              autoFocus
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="e.g. Admission Enquiry & Fee Bot"
            />
            <button className="btn btn-brand w-100 rounded-pill">Create & Open Builder</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal d-block" style={{ background: 'rgba(15,23,42,.45)', zIndex: 1060 }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content rounded-4 border-0 p-2 shadow">
          <div className="modal-header border-0">
            <h6 className="modal-title fw-bold">{title}</h6>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body pt-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
