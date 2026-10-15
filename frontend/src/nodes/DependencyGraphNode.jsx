import React, { useMemo, useState } from 'react';
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

  const [maxVisibleDepth, setMaxVisibleDepth] = useState(null);

  const filteredNodes = useMemo(() => {
    if (maxVisibleDepth === null) return nodes;
    return nodes.filter((n) => (n.depth || 0) <= maxVisibleDepth);
  }, [nodes, maxVisibleDepth]);

  const filteredEdges = useMemo(() => {
    if (maxVisibleDepth === null) return edges;
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  }, [edges, filteredNodes, maxVisibleDepth]);

  const maxDepthInNodes = useMemo(() => {
    if (!nodes.length) return 1;
    return Math.max(...nodes.map((n) => n.depth || 0));
  }, [nodes]);

  const terminalNodesCount = useMemo(() => {
    return nodes.filter((n) => n.node_type === 'terminal').length;
  }, [nodes]);

  return (
    <BaseNode
      id={id}
      category="visual"
      icon={GitFork}
      title="Dependency Graph Visualizer"
      subtitle={`${filteredNodes.length}/${nodes.length} nodes • ${filteredEdges.length} edges`}
      inputs={[
        { id: 'graph_data', label: 'Graph', tooltip: 'Data graf dari FormulaTracerNode' },
      ]}
      outputs={[
        { id: 'selected_node_coord', label: 'Node', tooltip: 'Koordinat sel yang dipilih di graf' },
      ]}
      onDelete={() => removeNode(id)}
      onFullscreen={graphData ? () => openGraphModal(graphData) : undefined}
      minWidth="min-w-[340px]"
    >
      {!graphData || nodes.length === 0 ? (
        <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 border border-dashed border-slate-200 rounded-lg">
          Hubungkan port Graph dari FormulaTracerNode untuk melihat visualisasi alur dependensi
        </div>
      ) : (
        <div className="flex flex-col gap-2 relative">
          {/* Header Bar */}
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-cyan-800 font-bold text-xs">{target}</span>
              <span className="text-[10px] text-slate-400 font-normal">
                ({graphData.direction || 'precedents'})
              </span>
            </div>

            <button
              type="button"
              onClick={() => openGraphModal(graphData)}
              className="inline-flex items-center gap-1.5 text-[11px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-2.5 py-1 rounded-md font-bold transition cursor-pointer shadow-xs"
              title="Buka Graf Lengkap (Zoom, Pan, Ciutkan/Expand)"
            >
              <Maximize2 size={12} /> Buka Graf Interaktif
            </button>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-3 gap-1.5 text-[10px] bg-slate-100/70 p-2 rounded-md border border-slate-200/80">
            <div className="flex flex-col">
              <span className="text-slate-400">Total Node</span>
              <span className="font-bold text-slate-700 text-xs">{nodes.length}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400">Input Statis</span>
              <span className="font-bold text-emerald-600 text-xs">{terminalNodesCount}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400">Kedalaman</span>
              <span className="font-bold text-amber-600 text-xs">Level {maxDepthInNodes}</span>
            </div>
          </div>

          {hasCircular && (
            <div className="text-[10px] text-rose-800 bg-rose-50 border border-rose-200 p-1.5 rounded-md flex items-center gap-1.5">
              <AlertOctagon size={13} className="text-rose-600 shrink-0" />
              <span>Siklus referensi melingkar (Circular) terdeteksi di graf</span>
            </div>
          )}

          {/* Level Filter Bar */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
            <span className="font-medium">Filter Tampilan:</span>
            <div className="inline-flex bg-white rounded border border-slate-200 text-[10px] font-semibold">
              <button
                type="button"
                onClick={() => setMaxVisibleDepth(null)}
                className={`px-2 py-0.5 rounded-l transition cursor-pointer ${
                  maxVisibleDepth === null ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Semua
              </button>
              {Array.from({ length: Math.min(3, maxDepthInNodes) }, (_, i) => i + 1).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setMaxVisibleDepth(lvl)}
                  className={`px-2 py-0.5 transition cursor-pointer ${
                    maxVisibleDepth === lvl ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  L{lvl}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
}
