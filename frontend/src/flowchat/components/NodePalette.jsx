import React from 'react';
import { NODE_TYPES, PALETTE_ORDER } from '../data/nodeTypes';

export default function NodePalette({ readOnly = false }) {
  const handleDragStart = (e, type) => {
    if (readOnly) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('application/flowchat-node-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="palette">
      <div className="palette-title">Blocks</div>
      {readOnly && <div className="palette-lock"><i className="bi bi-lock-fill"></i>Published — read-only</div>}
      {PALETTE_ORDER.filter((t) => t !== 'start').map((type) => {
        const def = NODE_TYPES[type];
        if (!def) return null;
        return (
          <div
            key={type}
            className={`palette-item ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
            draggable={!readOnly}
            onDragStart={(e) => handleDragStart(e, type)}
            title={readOnly ? 'Published Flow is locked. Switch to Draft to edit.' : def.description}
            style={{ cursor: readOnly ? 'not-allowed' : 'grab' }}
          >
            <span className="palette-icon-sm" style={{ background: def.color || 'var(--muted-foreground)' }}>
              <i className={`bi ${def.icon || 'bi-box'}`}></i>
            </span>
            <span className="palette-label">{def.label}</span>
            {!readOnly && <i className="bi bi-grip-vertical palette-grip"></i>}
          </div>
        );
      })}
    </div>
  );
}
