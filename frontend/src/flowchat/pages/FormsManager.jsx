import React, { useState } from 'react';
import { useBots } from '../context/BotContext.jsx';
import { uid } from '../utils/id';
import '../flowchat.css';

export default function FormsManager() {
  const { forms = [], addForm, updateForm, deleteForm, duplicateForm, isFormInUse, toggleFormStatus } = useBots() || {};
  const [selectedFormId, setSelectedFormId] = useState(forms[0]?.id || null);
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFormTitle, setNewFormTitle] = useState('');

  const activeForm = forms.find((f) => f.id === selectedFormId) || forms[0] || null;

  const handleCreateNew = (e) => {
    e.preventDefault();
    if (!newFormTitle.trim()) return;
    const created = addForm({
      name: newFormTitle.trim(),
      description: 'Collect details from user in an interactive WhatsApp form.',
      submitButtonText: 'Submit Form',
      submitSuccessMessage: 'Thank you! Your form response has been received.',
      targetApiUrl: '',
      status: 'active',
      fields: [
        { id: uid('field'), label: 'Full Name', fieldKey: 'full_name', type: 'text', required: true, placeholder: '' },
        { id: uid('field'), label: 'Phone Number', fieldKey: 'phone', type: 'phone', required: true, placeholder: '' },
        { id: uid('field'), label: 'Email Address', fieldKey: 'email', type: 'email', required: false, placeholder: '' },
      ],
    });
    setNewFormTitle('');
    setShowCreateModal(false);
    setSelectedFormId(created.id);
  };

  const handleAddField = () => {
    if (!activeForm) return;
    const newField = {
      id: uid('field'),
      label: 'New Field',
      fieldKey: 'field_' + (activeForm.fields.length + 1),
      type: 'text',
      required: true,
      placeholder: '',
      options: ['Option 1', 'Option 2'],
    };
    updateForm(activeForm.id, {
      fields: [...activeForm.fields, newField],
    });
    setEditingFieldId(newField.id);
  };

  const handleUpdateField = (fieldId, patch) => {
    if (!activeForm) return;
    const updatedFields = activeForm.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f));
    updateForm(activeForm.id, { fields: updatedFields });
  };

  const handleDeleteField = (fieldId) => {
    if (!activeForm || activeForm.fields.length <= 1) return;
    const updatedFields = activeForm.fields.filter((f) => f.id !== fieldId);
    updateForm(activeForm.id, { fields: updatedFields });
  };

  return (
    <div className="forms-manager">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h4 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <span className="brand-logo" style={{ width: 32, height: 32, fontSize: 16, background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}>
              <i className="bi bi-ui-checks"></i>
            </span>
            WhatsApp Interactive Forms Builder
          </h4>
        </div>
        <button className="btn btn-brand btn-sm rounded-pill px-3" onClick={() => setShowCreateModal(true)}>
          <i className="bi bi-plus-lg me-1"></i> Create WhatsApp Form
        </button>
      </div>

      <div className="row g-4">
        <div className="col-12">
          <div className="fc-card p-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="text-uppercase text-muted fw-bold" style={{ fontSize: 11, letterSpacing: '.06em' }}>
                WhatsApp Forms ({forms.length})
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Form Name</th>
                    <th style={{ width: 140 }}>Status</th>
                    <th style={{ width: 180 }} className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {forms.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-muted small">No forms created yet.</td>
                    </tr>
                  )}
                  {forms.map((f) => {
                    const inUse = isFormInUse?.(f.id);
                    return (
                      <tr key={f.id} className={selectedFormId === f.id ? 'table-active' : ''}>
                        <td>
                          <div className="fw-semibold">{f.name}</div>
                          <div className="text-muted small">{(f.fields || []).length} fields</div>
                        </td>
                        <td>
                          <button
                            className={`btn btn-sm rounded-pill ${f.status === 'inactive' ? 'btn-outline-secondary' : 'btn-outline-success'}`}
                            onClick={() => toggleFormStatus?.(f.id)}
                          >
                            {f.status === 'inactive' ? 'Inactive' : 'Active'}
                          </button>
                        </td>
                        <td className="text-end">
                          <div className="d-inline-flex align-items-center gap-1">
                            <button
                              className="btn btn-sm icon-only-action text-info"
                              title="View"
                              onClick={() => {
                                setSelectedFormId(f.id);
                                setEditingFieldId(null);
                              }}
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                            <button
                              className="btn btn-sm icon-only-action text-primary"
                              title="Edit"
                              onClick={() => {
                                setSelectedFormId(f.id);
                                setEditingFieldId(f.fields?.[0]?.id || null);
                              }}
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              className="btn btn-sm icon-only-action text-secondary"
                              title="Duplicate"
                              onClick={() => duplicateForm(f.id)}
                            >
                              <i className="bi bi-copy"></i>
                            </button>
                            <button
                              className="btn btn-sm icon-only-action text-danger"
                              title={inUse ? 'Delete disabled: form is used in chatbot flow' : 'Delete'}
                              disabled={Boolean(inUse)}
                              onClick={() => {
                                if (confirm(`Delete form "${f.name}"?`)) deleteForm(f.id);
                              }}
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

        {/* Center Editor & Right Preview */}
        {activeForm ? (
          <>
            {/* Form Fields & Properties Editor */}
            <div className="col-12 col-lg-7">
              <div className="fc-card p-4">
                <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                  <h6 className="fw-bold mb-0">Form Configuration</h6>
                  <span className="text-muted small font-monospace">ID: {activeForm.id}</span>
                </div>

                {/* Form Title & Description */}
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Form Title / Headline</label>
                  <input
                    className="form-control"
                    value={activeForm.name || ''}
                    onChange={(e) => updateForm(activeForm.id, { name: e.target.value })}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold">Description / Subtitle</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={activeForm.description || ''}
                    onChange={(e) => updateForm(activeForm.id, { description: e.target.value })}
                  />
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label small fw-semibold">Submit Button Text</label>
                    <input
                      className="form-control form-control-sm"
                      value={activeForm.submitButtonText || 'Submit Form'}
                      onChange={(e) => updateForm(activeForm.id, { submitButtonText: e.target.value })}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label small fw-semibold">Target API URL (Optional)</label>
                    <input
                      className="form-control form-control-sm"
                      value={activeForm.targetApiUrl || ''}
                      onChange={(e) => updateForm(activeForm.id, { targetApiUrl: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label small fw-semibold">Success Message on Submit</label>
                  <input
                    className="form-control form-control-sm"
                    value={activeForm.submitSuccessMessage || ''}
                    onChange={(e) => updateForm(activeForm.id, { submitSuccessMessage: e.target.value })}
                  />
                </div>

                {/* Fields Builder */}
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="fw-bold small text-uppercase text-muted" style={{ letterSpacing: '.05em' }}>
                    Form Fields ({(activeForm.fields || []).length})
                  </div>
                  <button className="btn btn-sm btn-outline-primary rounded-pill px-3" onClick={handleAddField}>
                    <i className="bi bi-plus-lg me-1"></i> Add Field
                  </button>
                </div>

                <div className="d-flex flex-column gap-2 mb-3">
                  {(activeForm.fields || []).map((field, idx) => {
                    const isEditing = editingFieldId === field.id;
                    return (
                      <div className="border rounded-3 p-3 bg-white" key={field.id}>
                        <div className="d-flex align-items-center justify-content-between">
                          <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-light text-dark border">{idx + 1}</span>
                            <span className="fw-semibold" style={{ fontSize: 13.5 }}>{field.label}</span>
                            {field.required ? (
                              <span className="badge bg-danger-subtle text-danger border border-danger-subtle" style={{ fontSize: 10 }}>Mandatory *</span>
                            ) : (
                              <span className="badge bg-secondary-subtle text-secondary" style={{ fontSize: 10 }}>Optional</span>
                            )}
                            <code className="small text-primary font-monospace">{`{{${field.fieldKey}}}`}</code>
                          </div>
                          <div className="d-flex align-items-center gap-1">
                            <button
                              className="btn btn-sm btn-light border py-0 px-2"
                              onClick={() => setEditingFieldId(isEditing ? null : field.id)}
                            >
                              <i className={`bi ${isEditing ? 'bi-chevron-up' : 'bi-pencil'}`}></i>
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger py-0 px-2"
                              disabled={activeForm.fields.length <= 1}
                              onClick={() => handleDeleteField(field.id)}
                            >
                              <i className="bi bi-trash3"></i>
                            </button>
                          </div>
                        </div>

                        {isEditing && (
                          <div className="mt-3 pt-3 border-top">
                            <div className="row g-2 mb-2">
                              <div className="col-7">
                                <label className="form-label small fw-semibold mb-1">Field Label</label>
                                <input
                                  className="form-control form-control-sm"
                                  value={field.label}
                                  onChange={(e) => handleUpdateField(field.id, { label: e.target.value })}
                                />
                              </div>
                              <div className="col-5">
                                <label className="form-label small fw-semibold mb-1">Field Type</label>
                                <select
                                  className="form-select form-select-sm"
                                  value={field.type}
                                  onChange={(e) => handleUpdateField(field.id, { type: e.target.value })}
                                >
                                  <option value="text">Text Input</option>
                                  <option value="number">Number</option>
                                  <option value="email">Email</option>
                                  <option value="phone">Phone / WhatsApp</option>
                                  <option value="date">Date Picker</option>
                                  <option value="select">Dropdown / Select</option>
                                </select>
                              </div>
                            </div>

                            <div className="row g-2 mb-2">
                              <div className="col-12">
                                <label className="form-label small fw-semibold mb-1">Variable Key</label>
                                <input
                                  className="form-control form-control-sm"
                                  value={field.fieldKey}
                                  onChange={(e) =>
                                    handleUpdateField(field.id, { fieldKey: e.target.value.toLowerCase().replace(/\s+/g, '_') })
                                  }
                                />
                              </div>
                            </div>

                            {field.type === 'select' && (
                              <div className="mb-2">
                                <label className="form-label small fw-semibold mb-1">Dropdown Options (comma separated)</label>
                                <input
                                  className="form-control form-control-sm"
                                  value={(field.options || []).join(', ')}
                                  onChange={(e) =>
                                    handleUpdateField(field.id, {
                                      options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                                    })
                                  }
                                />
                              </div>
                            )}

                            <div className="form-check form-switch mt-2">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`req_${field.id}`}
                                checked={field.required}
                                onChange={(e) => handleUpdateField(field.id, { required: e.target.checked })}
                              />
                              <label className="form-check-label small fw-semibold" htmlFor={`req_${field.id}`}>
                                Mandatory / Required Field
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Live WhatsApp Native Form Simulator */}
            <div className="col-12 col-lg-4 d-flex justify-content-center">
              <div className="wa-phone" style={{ width: 330 }}>
                <div className="wa-screen" style={{ height: 600 }}>
                  <div className="wa-header">
                    <i className="bi bi-arrow-left" style={{ fontSize: 13 }}></i>
                    <div className="rounded-circle bg-light" style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="bi bi-ui-checks text-dark" style={{ fontSize: 14 }}></i>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>WhatsApp Flow Form</div>
                      <div style={{ fontSize: 10.5, opacity: 0.85 }}>preview</div>
                    </div>
                  </div>

                  <div className="p-3 overflow-y-auto bg-white flex-grow-1">
                    <h6 className="fw-bold mb-1">{activeForm.name}</h6>
                    <p className="text-muted small mb-3">{activeForm.description}</p>
                    <hr className="my-2" />

                    <form onSubmit={(e) => e.preventDefault()}>
                      {(activeForm.fields || []).map((field) => (
                        <div className="mb-3" key={field.id}>
                          <label className="form-label small fw-semibold mb-1" style={{ fontSize: 12 }}>
                            {field.label} {field.required && <span className="text-danger">*</span>}
                          </label>
                          {field.type === 'select' ? (
                            <select className="form-select form-select-sm" defaultValue="">
                              <option value="" disabled></option>
                              {(field.options || []).map((opt, i) => (
                                <option key={i} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'date' ? 'date' : 'text'}
                              className="form-control form-control-sm"
                            />
                          )}
                        </div>
                      ))}

                      <button className="btn btn-brand w-100 rounded-pill mt-3 py-2 fw-semibold" style={{ fontSize: 13 }}>
                        {activeForm.submitButtonText || 'Submit'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="col-12 col-lg-9 text-center p-5 fc-card">
            <i className="bi bi-ui-checks text-muted mb-3" style={{ fontSize: 36 }}></i>
            <h5>No Form Selected</h5>
            <p className="text-muted">Create a new WhatsApp form to start collecting lead data.</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal d-block" style={{ background: 'rgba(15,23,42,.45)', zIndex: 1060 }} onClick={() => setShowCreateModal(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0 p-2 shadow">
              <div className="modal-header border-0">
                <h6 className="modal-title fw-bold">Create New WhatsApp Form</h6>
                <button className="btn-close" onClick={() => setShowCreateModal(false)}></button>
              </div>
              <div className="modal-body pt-0">
                <form onSubmit={handleCreateNew}>
                  <label className="form-label small fw-semibold">Form Name</label>
                  <input
                    className="form-control mb-4"
                    autoFocus
                    value={newFormTitle}
                    onChange={(e) => setNewFormTitle(e.target.value)}
                  />
                  <button className="btn btn-brand w-100 rounded-pill">Create & Open Editor</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
