import React, { useMemo } from 'react';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import { GitFork, Maximize2, AlertOctagon } from 'lucide-react';

export default function DependencyGraphNode({ id, data }) {
  const { openGraphModal, removeNode } = useFlow();

  const graphData = data.inputs?.graph_data || data.graph_data || null;
  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];
  const target = graphData?.target || 'None';
  const hasCircular = graphData?.has_circular;

  // Stratified SVG layout for mini preview
  const miniLayout = useMemo(() => {
    if (!nodes.length) return null;
    const depthMap = {};
    nodes.forEach((n) => {
      const d = n.depth || 0;
      if (!depthMap[d]) depthMap[d] = [];
      depthMap[d].push(n);
    });

    const depths = Object.keys(depthMap).map(Number).sort((a, b) => a - b);
    const colW = 60;
    const rowH = 26;
    const padX = 20;
    const padY = 20;

    const coords = {};
    let maxR = 0;

    depths.forEach((d, colIdx) => {
      const list = depthMap[d];
      maxR = Math.max(maxR, list.length);
      list.forEach((n, rowIdx) => {
        coords[n.id] = {
          x: padX + colIdx * colW,
          y: padY + rowIdx * rowH,
          node: n,
        };
      });
    });

    const w = Math.max(260, padX * 2 + (depths.length - 1) * colW + 40);
    const h = Math.max(120, padY * 2 + maxR * rowH);
    return { coords, w, h };
  }, [nodes]);

  return (
    <BaseNode
      id={id}
      category="visual"
      icon={GitFork}
      title="Dependency Graph Visualizer"
      subtitle={`${nodes.length} nodes • ${edges.length} edges`}
      inputs={[
        { id: 'graph_data', label: 'Graph', tooltip: 'Data graf dari FormulaTracerNode' },
      ]}
      outputs={[
        { id: 'selected_node_coord', label: 'Node', tooltip: 'Koordinat sel yang dipilih di graf' },
      ]}
      onDelete={() => removeNode(id)}
      minWidth="min-w-[340px]"
    >
      {!graphData || nodes.length === 0 ? (
        <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 border border-dashed border-slate-200 rounded-lg">
          Hubungkan port Graph dari FormulaTracerNode untuk melihat visualisasi alur dependensi
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Header Bar */}
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200">
            <span className="font-mono text-cyan-800">{target}</span>
            <button
              type="button"
              onClick={() => openGraphModal(graphData)}
              className="inline-flex items-center gap-1 text-[10px] bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded font-bold transition cursor-pointer"
            >
              <Maximize2 size={10} /> Fullscreen
            </button>
          </div>

          {hasCircular && (
            <div className="text-[10px] text-rose-800 bg-rose-50 border border-rose-200 p-1 rounded flex items-center gap-1">
              <AlertOctagon size={12} className="text-rose-600" />
              <span>Siklus melingkar terdeteksi</span>
            </div>
          )}

          {/* Mini SVG Preview */}
          {miniLayout && (
            <div className="h-32 bg-slate-50 border border-slate-200 rounded overflow-auto p-1 relative">
              <svg width={miniLayout.w} height={miniLayout.h} className="block">
                {/* Edges */}
                {edges.map((e, idx) => {
                  const s = miniLayout.coords[e.source];
                  const t = miniLayout.coords[e.target];
                  if (!s || !t) return null;
                  return (
                    <line
                      key={idx}
                      x1={s.x + 20}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                      strokeDasharray={e.edge_type === 'transitive' ? '2,2' : 'none'}
                    />
                  );
                })}

                {/* Nodes */}
                {nodes.map((n) => {
                  const pos = miniLayout.coords[n.id];
                  if (!pos) return null;
                  const isTarget = n.node_type === 'target';
                  const isTerm = n.node_type === 'terminal';
                  return (
                    <g key={n.id} transform={`translate(${pos.x}, ${pos.y})`}>
                      <circle
                        r={isTarget ? 7 : 5}
                        fill={isTarget ? '#0284c7' : isTerm ? '#10b981' : '#64748b'}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      <text
                        x="9"
                        y="3"
                        fontSize="8"
                        fontFamily="monospace"
                        fill="#334155"
                        fontWeight="bold"
                      >
                        {n.coordinate}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      )}
    </BaseNode>
  );
}
