import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  GitFork,
  AlertOctagon,
  Terminal,
  Info,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  Maximize2,
  Minimize2,
  RefreshCw,
  Layers,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Move,
} from 'lucide-react';
import { api } from '../services/api';

export default function DependencyGraphModal({
  graphData,
  onClose,
  onSelectNode,
}) {
  if (!graphData) return null;

  // Internal state for graph data (supports incremental +1 next-level expansion)
  const [currentGraph, setCurrentGraph] = useState(graphData);
  useEffect(() => {
    setCurrentGraph(graphData);
  }, [graphData]);

  const { target, direction = 'precedents', has_circular } = currentGraph;
  const nodes = currentGraph.nodes || [];
  const edges = currentGraph.edges || [];

  // Metadata for re-tracing
  const workbookId = currentGraph.workbook_id || null;
  const sheetName = currentGraph.sheet_name || target?.split('!')?.[0] || 'Sheet1';
  const cellCoord = currentGraph.cell || target?.split('!')?.[1] || 'A1';

  // Current depth tracking
  const maxDepthInNodes = useMemo(() => {
    if (!nodes.length) return 1;
    return Math.max(...nodes.map((n) => n.depth || 0));
  }, [nodes]);

  const currentConfiguredDepth = currentGraph.max_depth_configured || maxDepthInNodes || 2;

  // Interactive Expand / Collapse State
  const [collapsedNodeIds, setCollapsedNodeIds] = useState(new Set());
  const [maxVisibleDepth, setMaxVisibleDepth] = useState(null); // null = all depths
  const [isTracingNextLevel, setIsTracingNextLevel] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Hover state for interactive rich tooltip
  const [tooltipState, setTooltipState] = useState(null);

  // Canvas Pan & Zoom States
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPanPos, setStartPanPos] = useState({ x: 0, y: 0 });

  // Helper to find immediate children in graph hierarchy
  const getChildrenOfNode = useCallback(
    (nodeId) => {
      if (direction === 'dependents') {
        return edges.filter((e) => e.source === nodeId).map((e) => e.target);
      } else {
        // Precedents: incoming arrow points to the formula cell, so precedent children are sources
        return edges.filter((e) => e.target === nodeId).map((e) => e.source);
      }
    },
    [direction, edges]
  );

  // Compute visible nodes based on collapsed state and maxVisibleDepth filter
  const { visibleNodes, visibleEdges, visibleNodeIds } = useMemo(() => {
    if (!nodes.length) return { visibleNodes: [], visibleEdges: [], visibleNodeIds: new Set() };

    const visIds = new Set();
    const rootNodes = nodes.filter((n) => (n.depth || 0) === 0);
    const queue = rootNodes.map((n) => n.id);
    rootNodes.forEach((n) => visIds.add(n.id));

    let head = 0;
    while (head < queue.length) {
      const currId = queue[head++];
      // If parent is collapsed by user, do not traverse its descendants
      if (collapsedNodeIds.has(currId)) {
        continue;
      }

      const childIds = getChildrenOfNode(currId);
      for (const cId of childIds) {
        const cNode = nodes.find((n) => n.id === cId);
        if (cNode) {
          const depth = cNode.depth || 0;
          if (maxVisibleDepth === null || depth <= maxVisibleDepth) {
            if (!visIds.has(cId)) {
              visIds.add(cId);
              queue.push(cId);
            }
          }
        }
      }
    }

    const filteredNodes = nodes.filter((n) => visIds.has(n.id));
    const filteredEdges = edges.filter(
      (e) => visIds.has(e.source) && visIds.has(e.target)
    );

    return { visibleNodes: filteredNodes, visibleEdges: filteredEdges, visibleNodeIds: visIds };
  }, [nodes, edges, collapsedNodeIds, maxVisibleDepth, getChildrenOfNode]);

  // Toggle Collapse / Expand for a specific node
  const handleToggleCollapse = (nodeId, e) => {
    e?.stopPropagation();
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Expand All Nodes
  const handleExpandAll = () => {
    setCollapsedNodeIds(new Set());
    setMaxVisibleDepth(null);
  };

  // Collapse All Nodes to Level 1
  const handleCollapseToLevel1 = () => {
    const toCollapse = new Set();
    nodes.forEach((n) => {
      if ((n.depth || 0) >= 1 && getChildrenOfNode(n.id).length > 0) {
        toCollapse.add(n.id);
      }
    });
    setCollapsedNodeIds(toCollapse);
  };

  // Incremental Next-Level Tracing Handler (+1 Depth)
  const handleTraceNextLevel = async () => {
    if (!workbookId || isTracingNextLevel) return;
    const nextDepth = currentConfiguredDepth + 1;
    setIsTracingNextLevel(true);
    setStatusMessage(`Melacak Level ${nextDepth}... Mohon tunggu.`);

    try {
      const result = await api.traceFormula({
        workbook_id: workbookId,
        sheet_name: sheetName,
        cell: cellCoord,
        direction,
        max_depth: nextDepth,
      });

      const updatedGraph = {
        target: `${sheetName}!${cellCoord}`,
        workbook_id: workbookId,
        sheet_name: sheetName,
        cell: cellCoord,
        direction,
        max_depth_configured: nextDepth,
        max_depth_reached: result.max_depth_reached,
        can_expand_further: result.can_expand_further,
        nodes: result.nodes,
        edges: result.edges,
        has_circular: result.has_circular_reference,
        circular_paths: result.circular_paths,
      };

      const newNodesCount = result.nodes.length - nodes.length;
      setCurrentGraph(updatedGraph);
      setStatusMessage(
        newNodesCount > 0
          ? `Sukses! Level ${nextDepth} berhasil dimuat (+${newNodesCount} node baru)`
          : `Level ${nextDepth} selesai: Tidak ada cabang dependensi lebih lanjut.`
      );
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error(err);
      setStatusMessage(`Gagal melacak level berikutnya: ${err.message || 'Error'}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setIsTracingNextLevel(false);
    }
  };

  // Group visible nodes by depth for stratified layered graph layout
  const layout = useMemo(() => {
    const depthMap = {};
    visibleNodes.forEach((n) => {
      const d = n.depth || 0;
      if (!depthMap[d]) depthMap[d] = [];
      depthMap[d].push(n);
    });

    const depths = Object.keys(depthMap).map(Number).sort((a, b) => a - b);
    const colWidth = 270;
    const rowHeight = 85;
    const paddingX = 80;
    const paddingY = 60;

    const nodeCoords = {};
    let maxRows = 0;

    depths.forEach((d, colIndex) => {
      const colNodes = depthMap[d];
      maxRows = Math.max(maxRows, colNodes.length);
      colNodes.forEach((node, rowIndex) => {
        const x = paddingX + colIndex * colWidth;
        const y = paddingY + rowIndex * rowHeight;
        nodeCoords[node.id] = { x, y, node };
      });
    });

    const svgWidth = Math.max(880, paddingX * 2 + (depths.length - 1) * colWidth + 220);
    const svgHeight = Math.max(520, paddingY * 2 + maxRows * rowHeight);

    return { nodeCoords, svgWidth, svgHeight };
  }, [visibleNodes]);

  // Fit Entire Graph inside Viewport
  const handleFitView = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const availableW = Math.max(200, rect.width - 80);
    const availableH = Math.max(200, rect.height - 80);
    const scaleX = availableW / Math.max(100, layout.svgWidth);
    const scaleY = availableH / Math.max(100, layout.svgHeight);
    const fitScale = Math.min(1.2, Math.max(0.3, Math.min(scaleX, scaleY)));
    const centerX = (rect.width - layout.svgWidth * fitScale) / 2;
    const centerY = (rect.height - layout.svgHeight * fitScale) / 2;
    setZoom(fitScale);
    setPan({ x: Math.max(20, centerX), y: Math.max(20, centerY) });
  }, [layout.svgWidth, layout.svgHeight]);

  // Reset View (Scale 1:1, centered)
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 50, y: 50 });
  };

  const handleZoomIn = () => {
    setZoom((z) => Math.min(2.5, Math.round((z + 0.15) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.25, Math.round((z - 0.15) * 100) / 100));
  };

  // Automatically fit graph to view on initial mount or target change
  useEffect(() => {
    const timer = setTimeout(() => {
      handleFitView();
    }, 60);
    return () => clearTimeout(timer);
  }, [currentGraph.target, handleFitView]);

  // Non-passive native mouse wheel listener for smooth zoom anchored to cursor
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheelHandler = (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;

      setZoom((prevZoom) => {
        const nextZoom = Math.min(2.5, Math.max(0.25, prevZoom * zoomFactor));
        setPan((prevPan) => ({
          x: mouseX - (mouseX - prevPan.x) * (nextZoom / prevZoom),
          y: mouseY - (mouseY - prevPan.y) * (nextZoom / prevZoom),
        }));
        return nextZoom;
      });
    };

    container.addEventListener('wheel', onWheelHandler, { passive: false });
    return () => container.removeEventListener('wheel', onWheelHandler);
  }, []);

  // Mouse Drag Canvas (Pan) Handlers
  const handleCanvasMouseDown = (e) => {
    // Only drag when clicking background, not buttons or specific node elements
    if (e.target.closest('button') || e.target.closest('[data-no-pan]')) return;
    setIsPanning(true);
    setStartPanPos({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    });
  };

  const handleCanvasMouseMove = (e) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPanPos.x,
        y: e.clientY - startPanPos.y,
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
  };

  // Helper for Node Types badge & styling
  const getNodeTypeConfig = (nodeType) => {
    switch (nodeType) {
      case 'target':
        return {
          label: '🎯 Target Cell (Sel Utama)',
          badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          borderColor: '#2563eb',
          bgFill: '#eff6ff',
        };
      case 'terminal':
        return {
          label: '🟢 Terminal Input (Nilai Statis)',
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          borderColor: '#059669',
          bgFill: '#ecfdf5',
        };
      case 'circular':
        return {
          label: '🔴 Circular Reference (Siklus)',
          badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          borderColor: '#e11d48',
          bgFill: '#fff1f2',
        };
      case 'dependent':
        return {
          label: '➡️ Dependent (Turunan)',
          badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          borderColor: '#6366f1',
          bgFill: '#f5f3ff',
        };
      case 'precedent':
      default:
        return {
          label: '⬅️ Precedent (Sumber)',
          badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          borderColor: '#0284c7',
          bgFill: '#f0f9ff',
        };
    }
  };

  // Node hover mouse event handlers
  const handleNodeMouseEnter = (e, node) => {
    const incoming = edges.filter((ed) => ed.target === node.id).length;
    const outgoing = edges.filter((ed) => ed.source === node.id).length;
    const children = getChildrenOfNode(node.id);
    const isCollapsed = collapsedNodeIds.has(node.id);

    setTooltipState({
      node,
      x: e.clientX,
      y: e.clientY,
      incoming,
      outgoing,
      childrenCount: children.length,
      isCollapsed,
    });
  };

  const handleNodeMouseMove = (e) => {
    setTooltipState((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
  };

  const handleNodeMouseLeave = () => {
    setTooltipState(null);
  };

  // Calculate clamped tooltip coordinates so it never gets clipped by screen bounds
  const getTooltipPosition = (x, y) => {
    const tooltipWidth = 380;
    const tooltipHeight = 290;
    const padding = 20;

    let left = x + 16;
    let top = y + 16;

    if (left + tooltipWidth > window.innerWidth - padding) {
      left = x - tooltipWidth - 16;
    }
    if (left < padding) {
      left = padding;
    }

    if (top + tooltipHeight > window.innerHeight - padding) {
      top = Math.max(padding, y - tooltipHeight - 16);
    }

    return { left, top, width: tooltipWidth };
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 z-[99999] animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white shadow-xs">
              <GitFork size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-800">
                  Formula Dependency Graph: <span className="text-blue-600 font-mono">{target}</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 uppercase">
                  {direction}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <span>
                  Menampilkan: <strong>{visibleNodes.length}</strong> dari {nodes.length} nodes
                </span>
                <span>•</span>
                <span>
                  Kedalaman Terpenetrasi: <strong>Level {maxDepthInNodes}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Incremental Next-Level Tracing Button */}
            {workbookId && (
              <button
                type="button"
                onClick={handleTraceNextLevel}
                disabled={isTracingNextLevel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer shadow-xs disabled:opacity-50"
                title="Lanjutkan penelusuran dependensi 1 level lebih dalam"
              >
                {isTracingNextLevel ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Plus size={13} />
                )}
                <span>
                  {isTracingNextLevel
                    ? 'Melacak...'
                    : `Trace Level ${currentConfiguredDepth + 1} (+1 Depth)`}
                </span>
              </button>
            )}

            <button
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/80 transition cursor-pointer"
              onClick={onClose}
              title="Tutup Modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Status / Alert Banner */}
        {statusMessage && (
          <div className="px-5 py-2 bg-indigo-50 border-b border-indigo-200 text-indigo-900 text-xs font-semibold flex items-center gap-2 animate-fadeIn shrink-0">
            <Sparkles size={14} className="text-indigo-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {has_circular && (
          <div className="px-5 py-2 bg-rose-50 border-b border-rose-200 flex items-center gap-2 text-rose-800 text-xs font-medium shrink-0">
            <AlertOctagon size={15} className="text-rose-600 shrink-0" />
            <span>Siklus referensi melingkar (Circular reference) terdeteksi! Penelusuran diamankan secara otomatis.</span>
          </div>
        )}

        {/* Interactive Controls Ribbon (Collapse / Expand & Depth Filters) */}
        <div className="px-5 py-2 bg-slate-100/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          {/* Depth Level Filter Pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1">
              <Layers size={13} /> Filter Level:
            </span>
            <div className="inline-flex bg-white rounded-md border border-slate-300 p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setMaxVisibleDepth(null)}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${
                  maxVisibleDepth === null
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Semua Level
              </button>
              {Array.from({ length: Math.min(6, maxDepthInNodes) }, (_, i) => i + 1).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setMaxVisibleDepth(lvl)}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    maxVisibleDepth === lvl
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Lvl {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Expand / Collapse Global Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExpandAll}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-[11px] transition cursor-pointer"
              title="Buka seluruh cabang yang diciutkan"
            >
              <Maximize2 size={11} /> Buka Semua (Expand)
            </button>
            <button
              type="button"
              onClick={handleCollapseToLevel1}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-[11px] transition cursor-pointer"
              title="Ciutkan seluruh cabang di bawah Level 1"
            >
              <Minimize2 size={11} /> Ciutkan ke Level 1
            </button>

            {collapsedNodeIds.size > 0 && (
              <span className="text-[11px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                {collapsedNodeIds.size} cabang diciutkan
              </span>
            )}
          </div>
        </div>

        {/* Graph Canvas Container (Interactive Pan & Zoom Canvas) */}
        <div
          ref={containerRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={() => {
            handleCanvasMouseUp();
            handleNodeMouseLeave();
          }}
          className={`flex-1 relative overflow-hidden bg-slate-50 transition-colors ${
            isPanning ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{ touchAction: 'none' }}
        >
          {/* Main Full-Size SVG Canvas */}
          <svg
            className="w-full h-full block"
            style={{ width: '100%', height: '100%' }}
          >
            <defs>
              <marker
                id="arrowhead-direct"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#2563eb" />
              </marker>
              <marker
                id="arrowhead-transitive"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
              </marker>
              <marker
                id="arrowhead-highlight"
                markerWidth="9"
                markerHeight="7"
                refX="8"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 9 3.5, 0 7" fill="#1d4ed8" />
              </marker>
            </defs>

            {/* Transformable Canvas Group: Pan & Zoom */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Draw Visible Edges */}
              {visibleEdges.map((e, idx) => {
                const src = layout.nodeCoords[e.source];
                const tgt = layout.nodeCoords[e.target];
                if (!src || !tgt) return null;

                const x1 = src.x + 160;
                const y1 = src.y + 23;
                const x2 = tgt.x;
                const y2 = tgt.y + 23;

                const dx = (x2 - x1) / 2;
                const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                const isDirect = e.edge_type === 'direct';
                const isConnected =
                  tooltipState &&
                  (e.source === tooltipState.node.id || e.target === tooltipState.node.id);
                const isDimmed = tooltipState && !isConnected;

                return (
                  <path
                    key={idx}
                    d={pathData}
                    fill="none"
                    stroke={
                      isConnected
                        ? '#1d4ed8'
                        : isDirect
                        ? isDimmed
                          ? '#93c5fd44'
                          : '#2563eb'
                        : isDimmed
                        ? '#cbd5e144'
                        : '#94a3b8'
                    }
                    strokeWidth={isConnected ? 3 : isDirect ? 2 : 1.5}
                    strokeDasharray={isConnected ? 'none' : isDirect ? 'none' : '4,3'}
                    markerEnd={
                      isConnected
                        ? 'url(#arrowhead-highlight)'
                        : isDirect
                        ? 'url(#arrowhead-direct)'
                        : 'url(#arrowhead-transitive)'
                    }
                    opacity={isDimmed ? 0.3 : 1}
                    className="transition-all duration-150"
                  />
                );
              })}

              {/* Draw Visible Nodes */}
              {Object.entries(layout.nodeCoords).map(([id, pos]) => {
                const node = pos.node;
                const config = getNodeTypeConfig(node.node_type);
                const isTarget = node.node_type === 'target';
                const isTerminal = node.node_type === 'terminal';
                const isHovered = tooltipState?.node.id === node.id;

                // Check children for collapse/expand toggle
                const childIds = getChildrenOfNode(node.id);
                const hasChildren = childIds.length > 0;
                const isCollapsed = collapsedNodeIds.has(node.id);

                return (
                  <g
                    key={id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => handleNodeMouseEnter(e, node)}
                    onMouseMove={handleNodeMouseMove}
                    onMouseLeave={handleNodeMouseLeave}
                    onClick={() => {
                      if (onSelectNode) onSelectNode(node.coordinate, node.sheet);
                      onClose();
                    }}
                  >
                    {/* Native SVG title as accessible fallback */}
                    <title>
                      {`${node.sheet ? `${node.sheet}!` : ''}${node.coordinate}\n` +
                        `Tipe: ${config.label}\n` +
                        `Kedalaman: Level ${node.depth ?? 0}\n` +
                        `Formula: ${node.formula || '(Input Manual / Konstanta)'}\n` +
                        `Nilai: ${node.value !== null && node.value !== undefined ? node.value : '(null)'}\n` +
                        (hasChildren
                          ? `Cabang Anak: ${childIds.length} sel (${isCollapsed ? 'Diciutkan' : 'Terbuka'})`
                          : '')}
                    </title>

                    {/* Main Node Box */}
                    <rect
                      width="160"
                      height="46"
                      rx="8"
                      fill={config.bgFill}
                      stroke={isHovered ? '#1d4ed8' : config.borderColor}
                      strokeWidth={isHovered ? 2.8 : isTarget ? 2.5 : 1.5}
                      filter={
                        isHovered
                          ? 'drop-shadow(0 6px 14px rgba(37,99,235,0.35))'
                          : 'drop-shadow(0 1px 3px rgba(0,0,0,0.06))'
                      }
                      className="transition-all duration-150"
                    />

                    {/* Node Title: Sheet and Coordinate */}
                    <text
                      x="12"
                      y="20"
                      fill="#0f172a"
                      fontSize="11"
                      fontWeight="700"
                      fontFamily="Inter, sans-serif"
                    >
                      {node.sheet ? `${node.sheet}!` : ''}{node.coordinate}
                    </text>

                    {/* Node Formula / Value Subtitle */}
                    <text
                      x="12"
                      y="36"
                      fill={isTerminal ? '#059669' : '#2563eb'}
                      fontSize="9.5"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {node.formula
                        ? node.formula.length > 18
                          ? node.formula.slice(0, 18) + '...'
                          : node.formula
                        : `val: ${
                            node.value !== null && node.value !== undefined
                              ? String(node.value).slice(0, 14)
                              : 'input'
                          }`}
                    </text>

                    {/* Interactive Collapse / Expand Toggle Button on Node */}
                    {hasChildren && (
                      <g
                        transform="translate(136, 6)"
                        data-no-pan="true"
                        onClick={(e) => handleToggleCollapse(node.id, e)}
                        className="cursor-pointer group"
                      >
                        <rect
                          width={isCollapsed ? 32 : 18}
                          height="16"
                          x={isCollapsed ? -14 : 0}
                          rx="4"
                          fill={isCollapsed ? '#f59e0b' : '#e2e8f0'}
                          stroke={isCollapsed ? '#d97706' : '#cbd5e1'}
                          strokeWidth="1"
                        />
                        {isCollapsed ? (
                          <text
                            x={isCollapsed ? 2 : 9}
                            y="11.5"
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="8.5"
                            fontWeight="bold"
                            fontFamily="Inter, sans-serif"
                          >
                            +{childIds.length}
                          </text>
                        ) : (
                          <text
                            x="9"
                            y="11"
                            textAnchor="middle"
                            fill="#475569"
                            fontSize="11"
                            fontWeight="bold"
                          >
                            -
                          </text>
                        )}
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Floating Navigation HUD Toolbar (Zoom & Pan Controls) */}
          <div
            data-no-pan="true"
            className="absolute bottom-4 left-6 z-20 flex items-center gap-1.5 bg-slate-900/90 text-white backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-2xl text-xs"
          >
            {/* Zoom Out Button */}
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
              title="Perkecil Graf (Zoom Out)"
            >
              <Minus size={13} />
            </button>

            {/* Zoom Percentage (Click to reset 100%) */}
            <button
              type="button"
              onClick={handleResetZoom}
              className="font-mono font-bold text-[11px] text-cyan-300 hover:text-cyan-200 min-w-[42px] text-center select-none cursor-pointer"
              title="Klik untuk reset zoom ke 100%"
            >
              {Math.round(zoom * 100)}%
            </button>

            {/* Zoom In Button */}
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
              title="Perbesar Graf (Zoom In)"
            >
              <Plus size={13} />
            </button>

            <div className="w-px h-4 bg-slate-700 mx-1" />

            {/* Fit to View Button */}
            <button
              type="button"
              onClick={handleFitView}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer text-[11px] font-medium"
              title="Sesuaikan seluruh graf agar pas di layar (Fit to View)"
            >
              <Maximize2 size={11} /> Fit View
            </button>

            {/* Reset 1:1 Button */}
            <button
              type="button"
              onClick={handleResetZoom}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer font-mono text-[11px]"
              title="Kembali ke skala asli 1:1"
            >
              <RotateCcw size={10} /> 1:1
            </button>

            <div className="w-px h-4 bg-slate-700 mx-1" />

            {/* Helpful Gesture Hint */}
            <span className="text-[10px] text-slate-400 select-none pl-1 flex items-center gap-1">
              <span>✋ Drag kanvas • Scroll untuk zoom</span>
            </span>
          </div>
        </div>

        {/* Floating Comprehensive Tooltip (100% UNTRUNCATED) */}
        {tooltipState && (
          <div
            className="fixed z-50 pointer-events-none transition-opacity duration-100 animate-fadeIn"
            style={{
              left: `${getTooltipPosition(tooltipState.x, tooltipState.y).left}px`,
              top: `${getTooltipPosition(tooltipState.x, tooltipState.y).top}px`,
              width: `${getTooltipPosition(tooltipState.x, tooltipState.y).width}px`,
            }}
          >
            <div className="bg-slate-900/95 text-white rounded-xl shadow-2xl border border-slate-700/80 backdrop-blur-md p-3.5 flex flex-col gap-2.5">
              {/* Header: Sheet, Cell Coordinate & Classification Badge */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-700/60 pb-2">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-base text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-500/30">
                      {tooltipState.node.coordinate}
                    </span>
                    <span
                      className="text-slate-300 font-semibold text-xs truncate max-w-[170px]"
                      title={tooltipState.node.sheet}
                    >
                      {tooltipState.node.sheet ? `${tooltipState.node.sheet}` : 'Active Sheet'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    Address: <strong className="font-mono text-slate-300">{tooltipState.node.id}</strong>
                  </span>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                    getNodeTypeConfig(tooltipState.node.node_type).badgeClass
                  }`}
                >
                  {getNodeTypeConfig(tooltipState.node.node_type).label}
                </span>
              </div>

              {/* Grid Location & Connection Statistics */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] bg-slate-800/40 p-2 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Posisi Grid:</span>
                  <span className="font-mono text-slate-200">
                    Row {tooltipState.node.row} : Col {tooltipState.node.col}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Level Kedalaman:</span>
                  <span className="font-mono text-amber-300 font-bold">
                    Depth Level {tooltipState.node.depth ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Precedents Langsung:</span>
                  <span className="font-mono text-cyan-300 font-semibold">
                    {tooltipState.incoming} input sel
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Dependents Langsung:</span>
                  <span className="font-mono text-indigo-300 font-semibold">
                    {tooltipState.outgoing} turunan sel
                  </span>
                </div>
              </div>

              {/* Full Formula Section - 100% LENGKAP TANPA DIPOTONG */}
              <div className="flex flex-col gap-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Formula Lengkap (Full Formula):
                  </span>
                  {tooltipState.node.formula && (
                    <span className="text-[9px] text-slate-400 font-mono">
                      {tooltipState.node.formula.length} karakter
                    </span>
                  )}
                </div>

                {tooltipState.node.formula ? (
                  <div className="bg-slate-950/95 border border-slate-800 rounded-lg p-2.5 font-mono text-xs text-emerald-300 break-all whitespace-pre-wrap select-all max-h-36 overflow-y-auto leading-relaxed shadow-inner">
                    {tooltipState.node.formula}
                  </div>
                ) : (
                  <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-2 text-slate-400 italic text-xs flex items-center gap-1.5">
                    <span>Input Konstan / Nilai Hardcoded (Bukan Formula)</span>
                  </div>
                )}
              </div>

              {/* Evaluated Value Section */}
              <div className="flex items-center justify-between bg-slate-800/70 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
                <span className="text-[11px] text-slate-400 font-medium">Nilai Hasil Evaluasi:</span>
                <span
                  className="font-mono font-bold text-amber-300 text-xs truncate max-w-[210px]"
                  title={String(tooltipState.node.value)}
                >
                  {tooltipState.node.value !== null && tooltipState.node.value !== undefined
                    ? typeof tooltipState.node.value === 'number'
                      ? tooltipState.node.value.toLocaleString()
                      : String(tooltipState.node.value)
                    : '(null / kosong)'}
                </span>
              </div>

              {/* Branch Collapse / Expand Info */}
              {tooltipState.childrenCount > 0 && (
                <div className="flex items-center justify-between bg-slate-800/50 px-2.5 py-1 rounded text-[10px] text-slate-300 border border-slate-700/40">
                  <span>Cabang Anak: <strong>{tooltipState.childrenCount} sel</strong></span>
                  <span className={tooltipState.isCollapsed ? 'text-amber-400 font-bold' : 'text-emerald-400 font-semibold'}>
                    {tooltipState.isCollapsed ? '🔴 Diciutkan (Klik [+] di node untuk buka)' : '🟢 Terbuka (Klik [-] di node untuk tutup)'}
                  </span>
                </div>
              )}

              {/* Footer Interactive Hint */}
              <div className="text-[10px] text-cyan-400/90 flex items-center justify-between pt-1 border-t border-slate-800">
                <span>💡 Klik node untuk membuka sel di spreadsheet</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
