import React, { useState } from 'react';
import { useBots } from '../context/BotContext.jsx';

export default function MetaSettingsModal({ bot, onClose }) {
  const { updateBotSettings } = useBots();
  const [form, setForm] = useState({ ...(bot.meta || {}) });
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${window.location.origin}/webhooks/whatsapp/${bot.id}`;

  const save = (e) => {
    e.preventDefault();
    updateBotSettings(bot.id, form);
    onClose();
  };

  const copyWebhook = () => {
    navigator.clipboard?.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="modal d-block" style={{ background: 'rgba(15,23,42,.45)', zIndex: 1060 }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content rounded-4 border-0 shadow">
          <div className="modal-header border-0 pb-0">
            <div>
              <h5 className="modal-title fw-bold mb-0">
                <i className="bi bi-whatsapp text-success me-2"></i>WhatsApp Cloud API (Meta)
              </h5>
            </div>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <form onSubmit={save}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Phone Number ID</label>
                  <input className="form-control" value={form.phoneNumberId || ''} placeholder="e.g. 109xxxxxxxxxx"
                    onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">WhatsApp Business Account ID</label>
                  <input className="form-control" value={form.wabaId || ''} placeholder="e.g. 123xxxxxxxxxx"
                    onChange={(e) => setForm({ ...form, wabaId: e.target.value })} />
                </div>
                <div className="col-12">
                  <label className="form-label small fw-semibold">Permanent Access Token</label>
                  <input type="password" className="form-control" value={form.accessToken || ''} placeholder="EAAG..."
                    onChange={(e) => setForm({ ...form, accessToken: e.target.value })} />
                  <div className="text-muted mt-1" style={{ fontSize: 11.5 }}>
                    Generate this from Meta Business Suite → System Users, with <code className="inline-var">whatsapp_business_messaging</code> permission.
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label small fw-semibold">Webhook Verify Token</label>
                  <input className="form-control" value={form.verifyToken || ''} placeholder="a custom secret string"
                    onChange={(e) => setForm({ ...form, verifyToken: e.target.value })} />
                </div>

                <div className="col-12">
                  <div className="fc-card p-3 bg-light border-0">
                    <div className="small fw-semibold mb-1"><i className="bi bi-link-45deg me-1"></i>Your Webhook URL</div>
                    <div className="d-flex gap-2">
                      <input className="form-control form-control-sm bg-white" readOnly value={webhookUrl} />
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={copyWebhook}>
                        {copied ? <i className="bi bi-check2 text-success"></i> : <i className="bi bi-clipboard"></i>}
                      </button>
                    </div>
                    <div className="text-muted mt-2" style={{ fontSize: 11 }}>
                      Paste this Webhook URL + your Verify Token into Meta Developer App → WhatsApp → Configuration → Webhook.
                    </div>
                  </div>
                </div>
              </div>

              <div className="d-flex gap-2 mt-4">
                <button type="button" className="btn btn-light flex-fill rounded-pill" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-brand flex-fill rounded-pill">Save Settings</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
