import React, { useMemo } from 'react';
import { X, GitFork, AlertOctagon, Terminal } from 'lucide-react';

export default function DependencyGraphModal({
  graphData,
  onClose,
  onSelectNode
}) {
  if (!graphData) return null;

  const { target, direction, nodes = [], edges = [], has_circular, circular_paths } = graphData;

  // Group nodes by depth for stratified layered graph layout
  const layout = useMemo(() => {
    const depthMap = {};
    nodes.forEach((n) => {
      const d = n.depth || 0;
      if (!depthMap[d]) depthMap[d] = [];
      depthMap[d].push(n);
    });

    const depths = Object.keys(depthMap).map(Number).sort((a, b) => a - b);
    const colWidth = 240;
    const rowHeight = 75;
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

    const svgWidth = Math.max(800, paddingX * 2 + (depths.length - 1) * colWidth + 180);
    const svgHeight = Math.max(500, paddingY * 2 + maxRows * rowHeight);

    return { nodeCoords, svgWidth, svgHeight };
  }, [nodes]);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[82vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white shadow-xs">
              <GitFork size={16} />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-800">
                Formula Dependency Graph: <span className="text-blue-600 font-mono">{target}</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Direction: {direction} • {nodes.length} nodes • {edges.length} connections
              </div>
            </div>
          </div>

          <button
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/80 transition cursor-pointer"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Circular Warning */}
        {has_circular && (
          <div className="px-5 py-2.5 bg-rose-50 border-b border-rose-200 flex items-center gap-2 text-rose-800 text-xs font-medium">
            <AlertOctagon size={16} className="text-rose-600 shrink-0" />
            <span>Circular reference cycle detected in the dependency path! Traversal bounded cleanly.</span>
          </div>
        )}

        {/* Graph Canvas */}
        <div className="flex-1 overflow-auto bg-slate-50 p-6 relative">
          <svg
            width={layout.svgWidth}
            height={layout.svgHeight}
            style={{ display: 'block', minWidth: '100%' }}
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
            </defs>

            {/* Draw Edges */}
            {edges.map((e, idx) => {
              const src = layout.nodeCoords[e.source];
              const tgt = layout.nodeCoords[e.target];
              if (!src || !tgt) return null;

              const x1 = src.x + 140;
              const y1 = src.y + 21;
              const x2 = tgt.x;
              const y2 = tgt.y + 21;

              // Curved bezier
              const dx = (x2 - x1) / 2;
              const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

              const isDirect = e.edge_type === 'direct';

              return (
                <path
                  key={idx}
                  d={pathData}
                  fill="none"
                  stroke={isDirect ? '#2563eb' : '#94a3b8'}
                  strokeWidth={isDirect ? 2 : 1.5}
                  strokeDasharray={isDirect ? 'none' : '4,3'}
                  markerEnd={isDirect ? 'url(#arrowhead-direct)' : 'url(#arrowhead-transitive)'}
                />
              );
            })}

            {/* Draw Nodes */}
            {Object.entries(layout.nodeCoords).map(([id, pos]) => {
              const node = pos.node;
              const isTarget = node.node_type === 'target';
              const isTerminal = node.node_type === 'terminal';
              const isCircular = node.node_type === 'circular';

              let borderColor = '#93c5fd';
              let bgFill = '#ffffff';

              if (isTarget) {
                borderColor = '#2563eb';
                bgFill = '#eff6ff';
              } else if (isTerminal) {
                borderColor = '#059669';
                bgFill = '#ecfdf5';
              } else if (isCircular) {
                borderColor = '#e11d48';
                bgFill = '#fff1f2';
              }

              return (
                <g
                  key={id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (onSelectNode) onSelectNode(node.coordinate, node.sheet);
                    onClose();
                  }}
                >
                  <rect
                    width="140"
                    height="42"
                    rx="8"
                    fill={bgFill}
                    stroke={borderColor}
                    strokeWidth={isTarget ? 2.5 : 1.5}
                    filter="drop-shadow(0 1px 3px rgba(0,0,0,0.06))"
                  />
                  <text
                    x="10"
                    y="18"
                    fill="#0f172a"
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="Inter, sans-serif"
                  >
                    {node.sheet ? `${node.sheet}!` : ''}{node.coordinate}
                  </text>
                  <text
                    x="10"
                    y="32"
                    fill={isTerminal ? '#059669' : '#2563eb'}
                    fontSize="9.5"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {node.formula
                      ? (node.formula.length > 16 ? node.formula.slice(0, 16) + '...' : node.formula)
                      : `val: ${node.value !== null && node.value !== undefined ? String(node.value).slice(0, 12) : 'input'}`}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
