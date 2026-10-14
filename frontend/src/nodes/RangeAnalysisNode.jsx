import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import { api } from '../services/api';
import { Layers, Globe, Zap, Pin, Play, RefreshCw, Eye } from 'lucide-react';

export default function RangeAnalysisNode({ id, data }) {
  const {
    activeWorkbookId,
    activeSheetName,
    selectedRange,
    setHighlights,
    updateNodeData,
    removeNode,
  } = useFlow();

  const [isLoading, setIsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  const effectiveWbId = data.inputs?.workbook_id || data.workbook_id || activeWorkbookId;
  const effectiveSheet = data.inputs?.sheet_name || data.sheet_name || activeSheetName;
  const targetRange = data.inputs?.range || data.range || (selectedRange?.isRange ? selectedRange.coordinate : 'B2:F10');

  const rangeData = data.range_data || null;
  const summary = rangeData?.summary || {
    cross_sheet_count: 0,
    local_formula_count: 0,
    hardcoded_count: 0,
    empty_count: 0,
    total_cells: 0,
  };
  const cells = rangeData?.cells || [];

  const handleAnalyzeRange = async () => {
    if (!effectiveWbId || !effectiveSheet || !targetRange) return;
    setIsLoading(true);
    try {
      const res = await api.analyzeRange({
        workbook_id: effectiveWbId,
        sheet_name: effectiveSheet,
        range: targetRange,
      });

      // Apply heatmap highlights to spreadsheet
      const hl = [];
      res.cells.forEach((c) => {
        let color = null;
        if (c.category === 'cross_sheet') color = '#7dd3fc';
        else if (c.category === 'local_formula') color = '#c7d2fe';
        else if (c.category === 'hardcoded') color = '#fde68a';
        if (color) {
          hl.push({ sheet: effectiveSheet, coordinate: c.coordinate, color });
        }
      });
      setHighlights(hl);

      updateNodeData(id, {
        range_data: res,
        range_summary: res.summary,
        categorized_cells: res.cells,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCells = cells.filter((c) => {
    if (activeCategory === 'all') return true;
    return c.category === activeCategory;
  });

  return (
    <BaseNode
      id={id}
      category="engine"
      icon={Layers}
      title="Range Heatmap Inspector"
      subtitle={`${effectiveSheet || ''}!${targetRange}`}
      inputs={[
        { id: 'workbook_id', label: 'WB ID', tooltip: 'ID Workbook' },
        { id: 'sheet_name', label: 'Sheet', tooltip: 'Sheet target' },
        { id: 'range', label: 'Range', tooltip: 'Area range sel (misal B2:F10)' },
      ]}
      outputs={[
        { id: 'range_summary', label: 'Summary', tooltip: 'Rangkuman metrik 4 kategori' },
        { id: 'categorized_cells', label: 'Cells', tooltip: 'Daftar sel terklasifikasi' },
      ]}
      status={isLoading ? 'running' : rangeData ? 'success' : 'idle'}
      onDelete={() => removeNode(id)}
      minWidth="min-w-[340px]"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] bg-slate-50 border border-slate-200 rounded p-1.5 font-medium">
          <span className="text-slate-500">Target Range:</span>
          <span className="font-mono font-bold text-purple-700">{effectiveSheet}!{targetRange}</span>
        </div>

        <button
          type="button"
          onClick={handleAnalyzeRange}
          disabled={isLoading || !targetRange}
          className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs transition cursor-pointer shadow-2xs disabled:opacity-50"
        >
          {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
          Inspect Range & Heatmap
        </button>
      </div>

      {rangeData && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
          {/* 4 Metrics Breakdown Cards */}
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveCategory(activeCategory === 'cross_sheet' ? 'all' : 'cross_sheet')}
              className={`p-2 rounded border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                activeCategory === 'cross_sheet'
                  ? 'bg-sky-100 border-sky-400 ring-1 ring-sky-300'
                  : 'bg-sky-50/60 border-sky-200 hover:bg-sky-100'
              }`}
            >
              <span className="text-[10px] font-bold text-sky-800 flex items-center gap-1">
                <Globe size={11} className="text-sky-600" /> Cross-Sheet
              </span>
              <span className="text-base font-bold text-sky-950">{summary.cross_sheet_count}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory(activeCategory === 'local_formula' ? 'all' : 'local_formula')}
              className={`p-2 rounded border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                activeCategory === 'local_formula'
                  ? 'bg-indigo-100 border-indigo-400 ring-1 ring-indigo-300'
                  : 'bg-indigo-50/60 border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              <span className="text-[10px] font-bold text-indigo-800 flex items-center gap-1">
                <Zap size={11} className="text-indigo-600" /> Local Formula
              </span>
              <span className="text-base font-bold text-indigo-950">{summary.local_formula_count}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory(activeCategory === 'hardcoded' ? 'all' : 'hardcoded')}
              className={`p-2 rounded border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                activeCategory === 'hardcoded'
                  ? 'bg-amber-100 border-amber-400 ring-1 ring-amber-300'
                  : 'bg-amber-50/60 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                <Pin size={11} className="text-amber-600" /> Hardcoded
              </span>
              <span className="text-base font-bold text-amber-950">{summary.hardcoded_count}</span>
            </button>

            <div className="p-2 rounded border border-slate-200 bg-slate-50 flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-500">Empty Cells</span>
              <span className="text-base font-bold text-slate-700">{summary.empty_count}</span>
            </div>
          </div>

          {/* Filtered Cells Mini List */}
          <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pt-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Daftar Sel ({filteredCells.length}):
            </div>
            {filteredCells.slice(0, 15).map((c) => (
              <div
                key={c.coordinate}
                className="p-1 rounded border border-slate-100 bg-white hover:bg-slate-50 flex items-center justify-between text-[11px]"
              >
                <span className="font-mono font-bold text-slate-800">{c.coordinate}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                    c.category === 'cross_sheet'
                      ? 'bg-sky-100 text-sky-800'
                      : c.category === 'local_formula'
                      ? 'bg-indigo-100 text-indigo-800'
                      : c.category === 'hardcoded'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {c.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </BaseNode>
  );
}
