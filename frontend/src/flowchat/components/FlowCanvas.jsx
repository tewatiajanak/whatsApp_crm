import React, { useLayoutEffect, useRef, useState, useCallback } from 'react';
import { useBots } from '../context/BotContext.jsx';
import NodeCard, { getOutputs } from './NodeCard.jsx';
import { NODE_TYPES, PALETTE_ORDER } from '../data/nodeTypes.js';

function areLinesEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      Math.abs(a[i].x1 - b[i].x1) > 0.5 ||
      Math.abs(a[i].y1 - b[i].y1) > 0.5 ||
      Math.abs(a[i].x2 - b[i].x2) > 0.5 ||
      Math.abs(a[i].y2 - b[i].y2) > 0.5
    ) {
      return false;
    }
  }
  return true;
}

export default function FlowCanvas({
  bot,
  selectedNodeId,
  setSelectedNodeId,
  connectingFrom,
  setConnectingFrom,
  readOnly = false,
}) {
  const { bots = [], forms = [], addNode, updateNodePosition, setConnection } = useBots() || {};
  const wrapRef = useRef(null);
  const innerRef = useRef(null);
  const portRefs = useRef({});
  const inPortRefs = useRef({});
  const [lines, setLines] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [dragWire, setDragWire] = useState(null); // { nodeId, outputKey, mouseX, mouseY }
  const [contextMenu, setContextMenu] = useState(null); // { left, top, canvasX, canvasY }
  const dragState = useRef(null); // { nodeId, offsetX, offsetY }

  const nodes = Object.values(bot?.nodes || {});

  const registerPortRef = useCallback((nodeId, key, el) => {
    if (el) {
      portRefs.current[`${nodeId}:${key}`] = el;
    } else {
      delete portRefs.current[`${nodeId}:${key}`];
    }
  }, []);

  const registerInPortRef = useCallback((nodeId, el) => {
    if (el) {
      inPortRefs.current[nodeId] = el;
    } else {
      delete inPortRefs.current[nodeId];
    }
  }, []);

  const recomputeLines = useCallback(() => {
    if (!innerRef.current || !bot?.nodes) return;
    const baseRect = innerRef.current.getBoundingClientRect();
    const next = [];
    const allNodes = Object.values(bot.nodes);
    
    allNodes.forEach((node) => {
      if (!node) return;
      Object.entries(node.connections || {}).forEach(([key, targetId]) => {
        if (!targetId || !bot.nodes[targetId]) return;
        const fromEl = portRefs.current[`${node.id}:${key}`];
        const toEl = inPortRefs.current[targetId];
        if (!fromEl || !toEl) return;
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        next.push({
          id: `${node.id}:${key}->${targetId}`,
          x1: (fromRect.left + fromRect.width / 2 - baseRect.left) / zoom,
          y1: (fromRect.top + fromRect.height / 2 - baseRect.top) / zoom,
          x2: (toRect.left + toRect.width / 2 - baseRect.left) / zoom,
          y2: (toRect.top + toRect.height / 2 - baseRect.top) / zoom,
        });
      });
    });

    setLines((prev) => (areLinesEqual(prev, next) ? prev : next));
  }, [bot?.nodes, zoom]);

  useLayoutEffect(() => {
    recomputeLines();
    const timer = setTimeout(recomputeLines, 60);
    window.addEventListener('resize', recomputeLines);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', recomputeLines);
    };
  }, [recomputeLines]);

  // ---- Mouse Wheel Zoom (Ctrl/Cmd + Wheel) ----
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      setZoom((z) => Math.min(1.8, Math.max(0.4, Number((z + delta).toFixed(2)))));
    }
  };

  // ---- Node dragging on canvas ----
  const onMouseDownHeader = (e, nodeId) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const node = bot?.nodes?.[nodeId];
    if (!node || !innerRef.current) return;
    const rect = innerRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / zoom;
    const mouseY = (e.clientY - rect.top) / zoom;
    const posX = typeof node.position?.x === 'number' ? node.position.x : 60;
    const posY = typeof node.position?.y === 'number' ? node.position.y : 60;
    dragState.current = {
      nodeId,
      offsetX: mouseX - posX,
      offsetY: mouseY - posY,
    };
    setSelectedNodeId(nodeId);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e) => {
    if (readOnly || !dragState.current || !innerRef.current || !bot) return;
    const rect = innerRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / zoom;
    const mouseY = (e.clientY - rect.top) / zoom;
    const x = Math.max(20, Math.round(mouseX - dragState.current.offsetX));
    const y = Math.max(20, Math.round(mouseY - dragState.current.offsetY));
    updateNodePosition(bot.id, dragState.current.nodeId, { x, y });
    requestAnimationFrame(recomputeLines);
  };

  const onMouseUp = () => {
    dragState.current = null;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  // ---- Connecting ports ----
  const onPortClick = (nodeId, outputKey) => {
    if (readOnly) return;
    setConnectingFrom({ nodeId, outputKey });
    setDragWire(null);
  };

  const onBodyClickWhileConnecting = (targetNodeId) => {
    if (readOnly || !connectingFrom || !bot) return;
    if (targetNodeId === connectingFrom.nodeId) return;
    setConnection(bot.id, connectingFrom.nodeId, connectingFrom.outputKey, targetNodeId);
    setConnectingFrom(null);
    setDragWire(null);
  };

  const onOutPortMouseDown = (e, nodeId, outputKey) => {
    if (readOnly) return;
    setConnectingFrom({ nodeId, outputKey });
    setDragWire({ nodeId, outputKey, mouseX: e.clientX, mouseY: e.clientY });

    const move = (evt) => {
      setDragWire((prev) => (prev ? { ...prev, mouseX: evt.clientX, mouseY: evt.clientY } : prev));
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      setDragWire(null);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onInPortMouseUp = (targetNodeId) => {
    if (readOnly || !connectingFrom || !bot) return;
    if (targetNodeId === connectingFrom.nodeId) return;
    setConnection(bot.id, connectingFrom.nodeId, connectingFrom.outputKey, targetNodeId);
    setConnectingFrom(null);
    setDragWire(null);
  };

  const addNodeAt = (type, x, y) => {
    if (readOnly || !bot) return;
    const id = addNode(bot.id, type, { x, y });
    setSelectedNodeId(id);
    requestAnimationFrame(recomputeLines);
  };

  // ---- Drop new node from palette exactly at cursor drop location ----
  const onDragOver = (e) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = (e) => {
    if (readOnly) return;
    e.preventDefault();
    const type = e.dataTransfer.getData('application/flowchat-node-type');
    if (!type || !innerRef.current || !bot) return;
    const rect = innerRef.current.getBoundingClientRect();
    const x = Math.max(20, Math.round((e.clientX - rect.left) / zoom - 130));
    const y = Math.max(20, Math.round((e.clientY - rect.top) / zoom - 22));
    addNodeAt(type, x, y);
  };

  const zoomIn = () => setZoom((z) => Math.min(1.8, Number((z + 0.1).toFixed(1))));
  const zoomOut = () => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(1))));
  const resetZoom = () => setZoom(1);

  return (
    <div
      className="canvas-wrap"
      ref={wrapRef}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onWheel={handleWheel}
      onContextMenu={(e) => {
        if (readOnly || !innerRef.current) return;
        e.preventDefault();
        const wrapRect = wrapRef.current?.getBoundingClientRect();
        const innerRect = innerRef.current.getBoundingClientRect();
        const canvasX = Math.max(20, Math.round((e.clientX - innerRect.left) / zoom - 130));
        const canvasY = Math.max(20, Math.round((e.clientY - innerRect.top) / zoom - 22));
        setContextMenu({
          left: Math.max(10, Math.round((e.clientX - (wrapRect?.left || 0)) - 10)),
          top: Math.max(10, Math.round((e.clientY - (wrapRect?.top || 0)) - 10)),
          canvasX,
          canvasY,
        });
      }}
      onClick={() => {
        setSelectedNodeId(null);
        setConnectingFrom(null);
        setContextMenu(null);
      }}
    >
      {connectingFrom && !readOnly && (
        <div className="connecting-banner">
          <i className="bi bi-link-45deg me-1"></i> Click another block to connect, or click empty space to cancel
        </div>
      )}

      {/* Floating Canvas Zoom Controls */}
      <div className="canvas-zoom-controls" onClick={(e) => e.stopPropagation()}>
        <button className="zoom-action-btn" onClick={zoomOut} title="Zoom Out (-)">
          <i className="bi bi-dash"></i>
        </button>
        <button className="zoom-level-btn" onClick={resetZoom} title="Click to Reset 100%">
          {Math.round(zoom * 100)}%
        </button>
        <button className="zoom-action-btn" onClick={zoomIn} title="Zoom In (+)">
          <i className="bi bi-plus"></i>
        </button>
        <button className="zoom-action-btn ms-1" onClick={resetZoom} title="Reset to 100%">
          <i className="bi bi-arrows-fullscreen" style={{ fontSize: 11 }}></i>
        </button>
      </div>

      <div
        className="canvas-inner"
        ref={innerRef}
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <svg width="3600" height="2600" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <defs>
            <marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
              <polygon points="0 0, 8 3.5, 0 7" style={{ fill: "var(--muted-foreground)" }} />
            </marker>
          </defs>
          {lines.map((l) => {
            const dx = Math.max(50, Math.abs(l.x2 - l.x1) * 0.5);
            const path = `M ${l.x1} ${l.y1} C ${l.x1 + dx} ${l.y1}, ${l.x2 - dx} ${l.y2}, ${l.x2} ${l.y2}`;
            return (
              <g key={l.id}>
                <path d={path} stroke="transparent" strokeWidth="12" fill="none" />
                <path
                  d={path}
                  style={{ stroke: "color-mix(in srgb, var(--muted-foreground) 60%, transparent)" }}
                  strokeWidth="2.5"
                  fill="none"
                  markerEnd="url(#arrow)"
                />
              </g>
            );
          })}
          {dragWire && (() => {
            const baseRect = innerRef.current?.getBoundingClientRect();
            const fromEl = portRefs.current[`${dragWire.nodeId}:${dragWire.outputKey}`];
            if (!baseRect || !fromEl) return null;
            const fromRect = fromEl.getBoundingClientRect();
            const x1 = (fromRect.left + fromRect.width / 2 - baseRect.left) / zoom;
            const y1 = (fromRect.top + fromRect.height / 2 - baseRect.top) / zoom;
            const x2 = (dragWire.mouseX - baseRect.left) / zoom;
            const y2 = (dragWire.mouseY - baseRect.top) / zoom;
            const dx = Math.max(50, Math.abs(x2 - x1) * 0.5);
            const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
            return (
              <path
                d={path}
                style={{ stroke: "var(--primary)" }}
                strokeWidth="2.5"
                fill="none"
                strokeDasharray="5 4"
              />
            );
          })()}
        </svg>

        {nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            bots={bots}
            forms={forms}
            selected={selectedNodeId === node.id}
            connectingFrom={connectingFrom}
            readOnly={readOnly}
            onSelect={setSelectedNodeId}
            onMouseDownHeader={onMouseDownHeader}
            onPortClick={onPortClick}
            onOutPortMouseDown={onOutPortMouseDown}
            onInPortMouseUp={onInPortMouseUp}
            onBodyClickWhileConnecting={onBodyClickWhileConnecting}
            registerRef={() => {}}
            registerPortRef={registerPortRef}
            registerInPortRef={registerInPortRef}
          />
        ))}
      </div>

      {contextMenu && !readOnly && (
        <div
          className="canvas-context-menu"
          style={{ left: contextMenu.left, top: contextMenu.top }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="canvas-context-title">Add Node</div>
          {PALETTE_ORDER.filter((t) => t !== 'start').map((type) => {
            const def = NODE_TYPES[type];
            if (!def) return null;
            return (
              <button
                key={type}
                className="canvas-context-item"
                onClick={() => {
                  addNodeAt(type, contextMenu.canvasX, contextMenu.canvasY);
                  setContextMenu(null);
                }}
              >
                <i className={`bi ${def.icon}`}></i>
                <span>{def.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
