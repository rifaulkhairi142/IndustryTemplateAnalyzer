import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import { api } from '../services/api';
import { EyeOff, AlertTriangle, Play, RefreshCw, Rows3, Columns3, Sheet, ArrowDownRight } from 'lucide-react';

export default function HiddenTraceNode({ id, data }) {
  const {
    activeWorkbookId,
    activeSheetName,
    setHighlights,
    updateNodeData,
    removeNode,
  } = useFlow();

  const [isLoading, setIsLoading] = useState(false);
  const [scope, setScope] = useState(data.scope || 'active'); // 'active' | 'all'
  const [onlyInUse, setOnlyInUse] = useState(true);

  const effectiveWbId = data.inputs?.workbook_id || data.workbook_id || activeWorkbookId;
  const effectiveSheet = scope === 'active' ? (data.inputs?.sheet_name || data.sheet_name || activeSheetName) : null;

  const hiddenData = data.hidden_data || null;
  const summary = hiddenData?.summary || {
    total_hidden_rows: 0,
    hidden_rows_in_use: 0,
    total_hidden_cols: 0,
    hidden_cols_in_use: 0,
    total_hidden_sheets: 0,
    critical_visible_consumers_count: 0,
  };

  const handleScanHidden = async () => {
    if (!effectiveWbId) return;
    setIsLoading(true);
    try {
      const res = await api.getHiddenTrace({
        workbook_id: effectiveWbId,
        sheet_name: effectiveSheet,
        only_in_use: onlyInUse,
      });

      // Highlight hidden cells & their consumers
      const hl = [];
      (res.hidden_cells || []).forEach((c) => {
        hl.push({
          sheet: c.sheet,
          coordinate: c.coordinate,
          color: c.has_visible_consumer ? '#fecdd3' : '#fed7aa',
        });
      });
      setHighlights(hl);

      updateNodeData(id, {
        hidden_data: res,
        hidden_summary: res.summary,
        hidden_items: res.hidden_cells || [],
        scope,
        only_in_use: onlyInUse,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BaseNode
      id={id}
      category="engine"
      icon={EyeOff}
      title="Hidden Elements Tracer"
      subtitle={scope === 'active' ? `Sheet: ${effectiveSheet || 'Active'}` : 'Seluruh Workbook'}
      inputs={[
        { id: 'workbook_id', label: 'WB ID', tooltip: 'ID Workbook' },
        { id: 'sheet_name', label: 'Sheet', tooltip: 'Sheet filter (opsional)' },
      ]}
      outputs={[
        { id: 'hidden_summary', label: 'Summary', tooltip: 'Rangkuman elemen tersembunyi' },
        { id: 'hidden_items', label: 'Hidden Cells', tooltip: 'Daftar sel tersembunyi' },
      ]}
      status={isLoading ? 'running' : hiddenData ? 'success' : 'idle'}
      onDelete={() => removeNode(id)}
      minWidth="min-w-[340px]"
    >
      <div className="flex flex-col gap-2">
        {/* Scope and Filter Controls */}
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setScope('active')}
            className={`py-1 px-2 rounded font-medium text-[11px] transition cursor-pointer ${
              scope === 'active'
                ? 'bg-amber-600 text-white font-bold shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Active Sheet
          </button>
          <button
            type="button"
            onClick={() => setScope('all')}
            className={`py-1 px-2 rounded font-medium text-[11px] transition cursor-pointer ${
              scope === 'all'
                ? 'bg-amber-600 text-white font-bold shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Sheets
          </button>
        </div>

        <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyInUse}
            onChange={(e) => setOnlyInUse(e.target.checked)}
            className="rounded text-amber-600 focus:ring-amber-500"
          />
          Hanya elemen yang terpakai (In Use)
        </label>

        <button
          type="button"
          onClick={handleScanHidden}
          disabled={isLoading || !effectiveWbId}
          className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition cursor-pointer shadow-2xs disabled:opacity-50"
        >
          {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
          Pindai Elemen Tersembunyi
        </button>
      </div>

      {hiddenData && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
          {/* Critical Risk Banner */}
          {summary.critical_visible_consumers_count > 0 && (
            <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-900 text-[11px] flex items-center gap-1.5 font-medium">
              <AlertTriangle size={15} className="text-rose-600 shrink-0" />
              <span>
                <strong>{summary.critical_visible_consumers_count} Konsumen Kritis:</strong> Sel formula yang terlihat bergantung pada data yang tersembunyi!
              </span>
            </div>
          )}

          {/* Metric Summary Grid */}
          <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
            <div className="p-1.5 rounded border border-slate-200 bg-slate-50 flex flex-col items-center">
              <Rows3 size={12} className="text-slate-500 mb-0.5" />
              <span className="text-[10px] text-slate-500">Baris</span>
              <span className="font-bold text-slate-800">{summary.hidden_rows_in_use} / {summary.total_hidden_rows}</span>
            </div>

            <div className="p-1.5 rounded border border-slate-200 bg-slate-50 flex flex-col items-center">
              <Columns3 size={12} className="text-slate-500 mb-0.5" />
              <span className="text-[10px] text-slate-500">Kolom</span>
              <span className="font-bold text-slate-800">{summary.hidden_cols_in_use} / {summary.total_hidden_cols}</span>
            </div>

            <div className="p-1.5 rounded border border-slate-200 bg-slate-50 flex flex-col items-center">
              <Sheet size={12} className="text-slate-500 mb-0.5" />
              <span className="text-[10px] text-slate-500">Sheet</span>
              <span className="font-bold text-slate-800">{summary.total_hidden_sheets}</span>
            </div>
          </div>

          {/* Hidden Cells List */}
          <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Sel Tersembunyi Berdampak ({(hiddenData.hidden_cells || []).length}):
            </div>
            {(hiddenData.hidden_cells || []).slice(0, 10).map((c, idx) => (
              <div
                key={idx}
                className="p-1.5 rounded border border-slate-200 bg-white hover:bg-amber-50/50 flex items-center justify-between text-[11px]"
              >
                <div className="flex items-center gap-1 font-mono font-bold text-slate-800">
                  <span>{c.sheet}!{c.coordinate}</span>
                  {c.has_visible_consumer && (
                    <span className="px-1 py-0.2 rounded bg-rose-100 text-rose-700 text-[9px]">
                      Risiko
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 font-medium">
                  {c.dependents_count} kons.
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </BaseNode>
  );
}
