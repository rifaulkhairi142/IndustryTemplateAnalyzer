import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import { api } from '../services/api';
import { Split, Play, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function SheetComparatorNode({ id, data }) {
  const { workbooks, activeWorkbookId, activeSheetName, setHighlights, updateNodeData, removeNode } = useFlow();

  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState(data.mode || 'exact_formula');
  const [alignment, setAlignment] = useState(data.alignment || 'coordinate');
  const [syncTarget, setSyncTarget] = useState(data.sync_target || false);

  const baselineWb = data.inputs?.baseline_wb_id || data.baseline_wb || activeWorkbookId || workbooks[0]?.workbook_id || '';
  const baselineSheet = data.inputs?.baseline_sheet || data.baseline_sheet || activeSheetName || '';
  const baselineRange = data.inputs?.baseline_range || data.baseline_range || '';

  const targetWb = data.inputs?.target_wb_id || data.target_wb || (workbooks.length > 1 ? workbooks[1]?.workbook_id : activeWorkbookId) || '';
  const targetSheet = data.inputs?.target_sheet || data.target_sheet || baselineSheet || '';
  const targetRange = syncTarget ? baselineRange : (data.inputs?.target_range || data.target_range || '');

  const comparisonResult = data.comparison_result || null;
  const diffs = comparisonResult?.diffs || [];

  const handleRunComparison = async () => {
    if (!baselineWb || !baselineSheet || !targetWb || !targetSheet) return;
    setIsLoading(true);
    try {
      const res = await api.compareSheets({
        baseline_workbook_id: baselineWb,
        baseline_sheet_name: baselineSheet,
        target_workbook_id: targetWb,
        target_sheet_name: targetSheet,
        baseline_range: baselineRange.trim() || null,
        target_range: targetRange.trim() || null,
        mode,
        alignment,
      });

      // Highlights on baseline sheet
      const hl = res.diffs.map((d) => {
        let color = '#fef08a';
        if (d.diff_type === 'added') color = '#a7f3d0';
        if (d.diff_type === 'removed') color = '#fecdd3';
        if (d.diff_type === 'formula_changed') color = '#fed7aa';
        return {
          sheet: baselineSheet,
          coordinate: d.baseline_coordinate || d.coordinate,
          color,
        };
      });
      setHighlights(hl);

      updateNodeData(id, {
        comparison_result: res,
        diff_summary: {
          diff_count: res.diff_count,
          formula_changed_count: res.formula_changed_count,
          added_count: res.added_count,
          removed_count: res.removed_count,
          identical_count: res.identical_count,
        },
        diffs_list: res.diffs || [],
        mode,
        alignment,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const currentBaseEntry = workbooks.find((w) => w.workbook_id === baselineWb);
  const currentTargetEntry = workbooks.find((w) => w.workbook_id === targetWb);

  return (
    <BaseNode
      id={id}
      category="compare"
      icon={Split}
      title="Sheet Comparator"
      subtitle={`${baselineSheet || 'Base'} vs ${targetSheet || 'Target'}`}
      inputs={[
        { id: 'baseline_wb_id', label: 'Base WB', tooltip: 'Baseline Workbook ID' },
        { id: 'baseline_sheet', label: 'Base Sheet', tooltip: 'Baseline Sheet Name' },
        { id: 'baseline_range', label: 'Base Range', tooltip: 'Baseline Range (opsional)' },
        { id: 'target_wb_id', label: 'Target WB', tooltip: 'Target Workbook ID' },
        { id: 'target_sheet', label: 'Target Sheet', tooltip: 'Target Sheet Name' },
        { id: 'target_range', label: 'Target Range', tooltip: 'Target Range (opsional)' },
      ]}
      outputs={[
        { id: 'diff_summary', label: 'Summary', tooltip: 'Rangkuman perbedaan' },
        { id: 'diffs_list', label: 'Diffs', tooltip: 'Daftar rincian perbedaan sel' },
      ]}
      status={isLoading ? 'running' : comparisonResult ? 'success' : 'idle'}
      onDelete={() => removeNode(id)}
      minWidth="min-w-[360px]"
    >
      <div className="flex flex-col gap-2">
        {/* Baseline Config */}
        <div className="rounded-md border border-slate-200 bg-slate-50/70 p-2 flex flex-col gap-1 text-[11px]">
          <span className="font-bold text-slate-700">Baseline (Referensi):</span>
          <div className="grid grid-cols-2 gap-1">
            <select
              value={baselineWb}
              onChange={(e) => updateNodeData(id, { baseline_wb: e.target.value })}
              className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px]"
            >
              {workbooks.map((w) => (
                <option key={w.workbook_id} value={w.workbook_id}>{w.filename}</option>
              ))}
            </select>
            <select
              value={baselineSheet}
              onChange={(e) => updateNodeData(id, { baseline_sheet: e.target.value })}
              className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px]"
            >
              {(currentBaseEntry?.sheets || []).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            placeholder="Range (e.g. B4:F8 atau kosongkan)"
            value={baselineRange}
            onChange={(e) => updateNodeData(id, { baseline_range: e.target.value })}
            className="rounded border border-slate-200 bg-white px-1.5 py-1 font-mono text-[11px] uppercase"
          />
        </div>

        {/* Target Config */}
        <div className="rounded-md border border-slate-200 bg-slate-50/70 p-2 flex flex-col gap-1 text-[11px]">
          <span className="font-bold text-slate-700">Target (Pembanding):</span>
          <div className="grid grid-cols-2 gap-1">
            <select
              value={targetWb}
              onChange={(e) => updateNodeData(id, { target_wb: e.target.value })}
              className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px]"
            >
              {workbooks.map((w) => (
                <option key={w.workbook_id} value={w.workbook_id}>{w.filename}</option>
              ))}
            </select>
            <select
              value={targetSheet}
              onChange={(e) => updateNodeData(id, { target_sheet: e.target.value })}
              className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px]"
            >
              {(currentTargetEntry?.sheets || []).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            placeholder="Target range (opsional)"
            value={targetRange}
            onChange={(e) => updateNodeData(id, { target_range: e.target.value })}
            disabled={syncTarget}
            className="rounded border border-slate-200 bg-white px-1.5 py-1 font-mono text-[11px] uppercase disabled:bg-slate-100"
          />
        </div>

        {/* Mode & Alignment */}
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="rounded border border-slate-200 bg-white px-1.5 py-1"
          >
            <option value="exact_formula">Exact Formula</option>
            <option value="normalized_formula">Normalized Formula</option>
            <option value="values_only">Values Only</option>
          </select>

          <select
            value={alignment}
            onChange={(e) => setAlignment(e.target.value)}
            className="rounded border border-slate-200 bg-white px-1.5 py-1"
          >
            <option value="coordinate">Coordinate Alignment</option>
            <option value="structural">Structural Alignment</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleRunComparison}
          disabled={isLoading || !baselineSheet || !targetSheet}
          className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition cursor-pointer shadow-2xs disabled:opacity-50"
        >
          {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
          Run Comparison
        </button>
      </div>

      {comparisonResult && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="grid grid-cols-4 gap-1 text-center">
            <div className="p-1 rounded bg-amber-50 border border-amber-200 text-amber-900">
              <span className="text-[10px] block">Changed</span>
              <strong>{comparisonResult.formula_changed_count || 0}</strong>
            </div>
            <div className="p-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-900">
              <span className="text-[10px] block">Added</span>
              <strong>{comparisonResult.added_count || 0}</strong>
            </div>
            <div className="p-1 rounded bg-rose-50 border border-rose-200 text-rose-900">
              <span className="text-[10px] block">Removed</span>
              <strong>{comparisonResult.removed_count || 0}</strong>
            </div>
            <div className="p-1 rounded bg-slate-50 border border-slate-200 text-slate-700">
              <span className="text-[10px] block">Identical</span>
              <strong>{comparisonResult.identical_count || 0}</strong>
            </div>
          </div>
        </div>
      )}
    </BaseNode>
  );
}
