import React from 'react';
import { NODE_TYPES } from '../data/nodeTypes';

export function getOutputs(node) {
  if (!node) return [];
  const def = NODE_TYPES[node.type];
  if (!def) return [];
  if (def.outputs === 'dynamic') {
    return (node.data?.buttons || []).map((b) => ({ key: b.id || b.label, label: b.label || 'Option' }));
  }
  if (def.outputs === 'dynamic_condition') {
    const branches = (node.data?.branches || []).map((b, i) => ({
      key: b.id || `branch_${i}`,
      label: b.label || `Branch ${i + 1}`,
    }));
    return [...branches, { key: 'else', label: node.data?.elseLabel || 'Default (Else)' }];
  }
  return def.outputs || [];
}

function previewText(node, bots, forms) {
  if (!node || !node.data) return '';
  switch (node.type) {
    case 'start':
      return `Triggers on: ${(node.data.keywords || []).join(', ') || 'any message'}`;
    case 'message':
      return node.data.text || '';
    case 'templateMessage':
      return `Template: ${node.data.templateName || 'not_set'} (${node.data.languageCode || 'en'})`;
    case 'mediaMessage':
      return `${(node.data.mediaType || 'image').toUpperCase()} • ${node.data.mediaUrl || 'media not set'}`;
    case 'listMessage':
      return node.data.text || '';
    case 'locationMessage':
      return `Lat: ${node.data.latitude || '-'}, Lng: ${node.data.longitude || '-'}`;
    case 'buttons':
      return node.data.text || '';
    case 'question':
      return `${node.data.text || ''}\nSaves to {{${node.data.variableName || 'var'}}}`;
    case 'whatsappForm': {
      const form = forms?.find((f) => f.id === node.data?.formId);
      return form
        ? `Form: ${form.name}\nSaves to {{${node.data?.saveResponseAs || 'form_data'}}}`
        : 'Select a WhatsApp Form in settings';
    }
    case 'apiRequest':
      return `${node.data.method || 'GET'} ${node.data.url || ''}`;
    case 'condition': {
      const branches = node.data?.branches || [];
      if (branches.length === 0) return 'No conditions configured';
      return `${branches.length} branch${branches.length === 1 ? '' : 'es'} (${branches.map((b) => b.label || 'Rule').join(', ')})`;
    }
    case 'subchatbot': {
      const target = bots?.find((b) => b.id === node.data?.targetBotId);
      return target ? `Hands off to: ${target.name}` : 'No sub-chatbot selected yet';
    }
    case 'end':
      return node.data.text || 'Ends the conversation';
    default:
      return '';
  }
}

export default function NodeCard({
  node,
  bots = [],
  forms = [],
  selected,
  connectingFrom,
  readOnly = false,
  onSelect,
  onMouseDownHeader,
  onPortClick,
  onOutPortMouseDown,
  onInPortMouseUp,
  onBodyClickWhileConnecting,
  registerRef,
  registerPortRef,
  registerInPortRef,
}) {
  if (!node) return null;
  const def = NODE_TYPES[node.type] || { label: 'Node', color: 'var(--muted-foreground)', icon: 'bi-box' };
  const outputs = getOutputs(node);
  const isConnectSource = connectingFrom?.nodeId === node.id;
  const isSingleNextOutput = outputs.length === 1 && outputs[0].key === 'next';

  const posX = typeof node.position?.x === 'number' ? node.position.x : 60;
  const posY = typeof node.position?.y === 'number' ? node.position.y : 60;

  return (
    <div
      ref={(el) => registerRef && registerRef(node.id, el)}
      className={`flow-node ${selected ? 'selected' : ''}`}
      style={{ left: posX, top: posY, cursor: readOnly ? 'default' : 'grab' }}
      onClick={(e) => {
        e.stopPropagation();
        if (connectingFrom && !isConnectSource && !readOnly) {
          onBodyClickWhileConnecting(node.id);
        } else {
          onSelect(node.id);
        }
      }}
    >
      {/* Incoming port on LEFT edge (all nodes except Start) */}
      {node.type !== 'start' && (
        <div className="in-port">
          <div
            ref={(el) => registerInPortRef && registerInPortRef(node.id, el)}
            className="port-dot connected"
            title="Input connection (Left)"
            onMouseUp={(e) => {
              e.stopPropagation();
              if (!readOnly) onInPortMouseUp && onInPortMouseUp(node.id);
            }}
          ></div>
        </div>
      )}

      {/* Header */}
      <div
        className="flow-node-head"
        style={{ background: def.color || 'var(--muted-foreground)' }}
        onMouseDown={(e) => !readOnly && onMouseDownHeader(e, node.id)}
      >
        <i className={`bi ${def.icon || 'bi-box'}`}></i>
        <span className="text-truncate">{def.label}</span>
      </div>

      {/* Body preview */}
      <div className="flow-node-body">{previewText(node, bots, forms) || <em className="text-muted">Not configured</em>}</div>

      {/* Single Next Output (Right edge, vertically centered) */}
      {isSingleNextOutput && (
        <div className="out-port-single">
          <div
            ref={(el) => registerPortRef && registerPortRef(node.id, 'next', el)}
            className={`port-dot ${node.connections?.next ? 'connected' : ''} ${
              connectingFrom?.nodeId === node.id && connectingFrom?.outputKey === 'next' ? 'connecting-active' : ''
            }`}
            title={readOnly ? 'Locked in Published Mode' : 'Connect next step (Right)'}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (!readOnly) onOutPortMouseDown && onOutPortMouseDown(e, node.id, 'next');
                }}
            onClick={(e) => {
              e.stopPropagation();
              if (!readOnly) onPortClick(node.id, 'next');
            }}
          ></div>
        </div>
      )}

      {/* Multiple Outputs / Dynamic Branches (Each branch on the right edge) */}
      {!isSingleNextOutput && outputs.length > 0 && (
        <div className="flow-node-outputs">
          {outputs.map((out) => (
            <div className="flow-node-port" key={out.key}>
              <span className="text-truncate me-3">{out.label || out.key}</span>
              <div
                ref={(el) => registerPortRef && registerPortRef(node.id, out.key, el)}
                className={`port-dot ${node.connections?.[out.key] ? 'connected' : ''} ${
                  connectingFrom?.nodeId === node.id && connectingFrom?.outputKey === out.key ? 'connecting-active' : ''
                }`}
                title={readOnly ? 'Locked in Published Mode' : `Connect "${out.label || out.key}" to another block`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (!readOnly) onOutPortMouseDown && onOutPortMouseDown(e, node.id, out.key);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!readOnly) onPortClick(node.id, out.key);
                }}
              ></div>
            </div>
          ))}
        </div>
      )}

      {/* Terminal Node (no outputs) */}
      {outputs.length === 0 && (
        <div className="flow-node-port text-muted" style={{ fontSize: 10.5 }}>
          <span>End of branch</span>
        </div>
      )}
    </div>
  );
}
