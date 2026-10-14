import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import { api } from '../services/api';
import {
  GitCommit,
  ArrowUpLeft,
  ArrowDownRight,
  Terminal,
  Clock,
  Copy,
  Check,
  AlertOctagon,
  Play,
  GitFork,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

export default function FormulaTracerNode({ id, data }) {
  const {
    activeWorkbookId,
    activeSheetName,
    selectedRange,
    setHighlights,
    openGraphModal,
    updateNodeData,
    removeNode,
  } = useFlow();

  const [isLoading, setIsLoading] = useState(false);
  const [direction, setDirection] = useState(data.direction || 'precedents');
  const [maxDepth, setMaxDepth] = useState(data.max_depth || 15);
  const [isLogsExpanded, setIsLogsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const effectiveWbId = data.inputs?.workbook_id || data.workbook_id || activeWorkbookId;
  const effectiveSheet = data.inputs?.sheet_name || data.sheet_name || activeSheetName;
  const targetCell = data.inputs?.cell || data.inputs?.coordinate || data.cell || selectedRange?.coordinate || 'B8';

  const traceData = data.trace_data || null;
  const logs = traceData?.execution_logs || [];
  const elapsed = traceData?.elapsed_seconds !== undefined ? traceData.elapsed_seconds : 0;
  const terminalSources = traceData?.terminal_sources || [];
  const hasCircular = traceData?.has_circular_reference;

  const handleExecuteTrace = async () => {
    if (!effectiveWbId || !effectiveSheet || !targetCell) return;
    setIsLoading(true);
    try {
      const result = await api.traceFormula({
        workbook_id: effectiveWbId,
        sheet_name: effectiveSheet,
        cell: targetCell,
        direction,
        max_depth: maxDepth,
      });

      // Highlight on sheet
      const hl = [];
      result.nodes.forEach((n) => {
        if (n.node_type === 'target') hl.push({ sheet: n.sheet, coordinate: n.coordinate, color: '#38bdf8' });
        else if (n.node_type === 'terminal') hl.push({ sheet: n.sheet, coordinate: n.coordinate, color: '#a7f3d0' });
        else if (n.node_type === 'circular') hl.push({ sheet: n.sheet, coordinate: n.coordinate, color: '#fecdd3' });
        else hl.push({ sheet: n.sheet, coordinate: n.coordinate, color: '#bfdbfe' });
      });
      setHighlights(hl);

      const graph = {
        target: `${effectiveSheet}!${targetCell}`,
        direction,
        nodes: result.nodes,
        edges: result.edges,
        has_circular: result.has_circular_reference,
        circular_paths: result.circular_paths,
      };

      updateNodeData(id, {
        trace_data: result,
        graph_data: graph,
        terminal_sources: result.terminal_sources || [],
        execution_logs: result.execution_logs || [],
        circular_paths: result.circular_paths || [],
        direction,
        max_depth: maxDepth,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLogs = () => {
    if (!logs.length) return;
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <BaseNode
      id={id}
      category="engine"
      icon={GitCommit}
      title="Formula Tracer"
      subtitle={`${effectiveSheet || ''}!${targetCell} (${direction})`}
      inputs={[
        { id: 'workbook_id', label: 'WB ID', tooltip: 'ID Workbook' },
        { id: 'sheet_name', label: 'Sheet', tooltip: 'Nama sheet target' },
        { id: 'cell', label: 'Cell', tooltip: 'Koordinat sel target (misal B8)' },
      ]}
      outputs={[
        { id: 'trace_data', label: 'Trace Data', tooltip: 'Hasil penelusuran lengkap' },
        { id: 'graph_data', label: 'Graph', tooltip: 'Data graf SVG dependensi' },
        { id: 'terminal_sources', label: 'Terminals', tooltip: 'Sumber input konstan' },
      ]}
      status={isLoading ? 'running' : traceData ? 'success' : 'idle'}
      onDelete={() => removeNode(id)}
      minWidth="min-w-[340px]"
    >
      {/* Target & Config Bar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] bg-slate-50 border border-slate-200 rounded p-1.5 font-medium">
          <span className="text-slate-500">Target:</span>
          <span className="font-mono font-bold text-blue-700">
            {effectiveSheet}!{targetCell}
          </span>
        </div>

        {/* Direction Switch */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setDirection('precedents')}
            className={`flex items-center justify-center gap-1 py-1 px-2 rounded text-xs font-semibold transition cursor-pointer ${
              direction === 'precedents'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ArrowUpLeft size={13} />
            Precedents
          </button>

          <button
            type="button"
            onClick={() => setDirection('dependents')}
            className={`flex items-center justify-center gap-1 py-1 px-2 rounded text-xs font-semibold transition cursor-pointer ${
              direction === 'dependents'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ArrowDownRight size={13} />
            Dependents
          </button>
        </div>

        {/* Max Depth Slider */}
        <div className="flex items-center justify-between text-[11px] text-slate-600 gap-2">
          <span>Max Depth: <strong>{maxDepth}</strong></span>
          <input
            type="range"
            min="1"
            max="30"
            value={maxDepth}
            onChange={(e) => setMaxDepth(parseInt(e.target.value, 10))}
            className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        {/* Execute Button */}
        <button
          type="button"
          onClick={handleExecuteTrace}
          disabled={isLoading || !targetCell}
          className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition cursor-pointer shadow-2xs disabled:opacity-50"
        >
          <Play size={12} />
          {isLoading ? 'Sedang Melacak Dependensi...' : 'Execute Trace'}
        </button>
      </div>

      {/* Trace Results Section */}
      {traceData && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
          {/* Quick Metrics Bar */}
          <div className="flex items-center justify-between text-[11px] bg-emerald-50 border border-emerald-200 rounded p-1.5 font-medium text-emerald-800">
            <span>{traceData.nodes?.length || 0} node diproses</span>
            <span className="flex items-center gap-1 text-[10px]">
              <Clock size={11} /> {elapsed}s
            </span>
            <button
              type="button"
              onClick={() => openGraphModal(data.graph_data)}
              className="text-amber-700 hover:text-amber-800 font-bold underline flex items-center gap-0.5 cursor-pointer"
            >
              <GitFork size={11} /> Visual Graph
            </button>
          </div>

          {/* Circular Reference Warning */}
          {hasCircular && (
            <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center gap-1.5">
              <AlertOctagon size={14} className="text-rose-600 shrink-0" />
              <span>Circular reference terdeteksi! Rantai siklus diamankan.</span>
            </div>
          )}

          {/* Terminal Sources Chips */}
          {terminalSources.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Akar Input Konstan ({terminalSources.length}):
              </div>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {terminalSources.slice(0, 10).map((t) => (
                  <span
                    key={t.id}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono"
                    title={`Nilai: ${t.value}`}
                  >
                    {t.sheet !== effectiveSheet ? `${t.sheet}!` : ''}{t.coordinate}
                  </span>
                ))}
                {terminalSources.length > 10 && (
                  <span className="text-[10px] text-slate-400">+{terminalSources.length - 10} more</span>
                )}
              </div>
            </div>
          )}

          {/* Execution Engine Logs Drawer */}
          <div className="rounded border border-slate-800 bg-slate-900 text-slate-200 overflow-hidden text-[10px]">
            <div
              className="px-2 py-1 bg-slate-950 flex items-center justify-between cursor-pointer select-none"
              onClick={() => setIsLogsExpanded(!isLogsExpanded)}
            >
              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                <Terminal size={11} /> Engine Logs ({logs.length})
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyLogs();
                  }}
                  className="p-0.5 text-slate-400 hover:text-white"
                  title="Salin log"
                >
                  {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                </button>
                {isLogsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </div>
            </div>

            {isLogsExpanded && (
              <div className="p-2 font-mono text-[9px] max-h-36 overflow-y-auto space-y-0.5 bg-slate-900/90 text-slate-300">
                {logs.map((line, idx) => (
                  <div key={idx} className="truncate">{line}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </BaseNode>
  );
}
