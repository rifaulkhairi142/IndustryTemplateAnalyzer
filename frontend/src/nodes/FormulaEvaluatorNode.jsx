import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import { api } from '../services/api';
import { Calculator, Play, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function FormulaEvaluatorNode({ id, data }) {
  const { activeWorkbookId, activeSheetName, selectedRange, updateNodeData, removeNode } = useFlow();

  const [isLoading, setIsLoading] = useState(false);
  const [overrideFormula, setOverrideFormula] = useState(data.override_formula || '');

  const effectiveWbId = data.inputs?.workbook_id || data.workbook_id || activeWorkbookId;
  const effectiveSheet = data.inputs?.sheet_name || data.sheet_name || activeSheetName;
  const targetCell = data.inputs?.cell || data.cell || selectedRange?.coordinate || 'B8';

  const evalResult = data.eval_result || null;

  const handleEvaluate = async () => {
    if (!effectiveWbId || !effectiveSheet || !targetCell) return;
    setIsLoading(true);
    try {
      const res = await api.evaluateCell({
        workbook_id: effectiveWbId,
        sheet_name: effectiveSheet,
        cell: targetCell,
        formula: overrideFormula.trim() || null,
      });

      updateNodeData(id, {
        eval_result: res,
        computed_value: res.computed_value,
        formula: res.formula,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const isMatch = evalResult && String(evalResult.computed_value) === String(evalResult.cached_value);

  return (
    <BaseNode
      id={id}
      category="engine"
      icon={Calculator}
      title="Formula Evaluator"
      subtitle={`Hitung: ${effectiveSheet || ''}!${targetCell}`}
      inputs={[
        { id: 'workbook_id', label: 'WB ID', tooltip: 'ID Workbook' },
        { id: 'sheet_name', label: 'Sheet', tooltip: 'Sheet target' },
        { id: 'cell', label: 'Cell', tooltip: 'Koordinat sel target' },
      ]}
      outputs={[
        { id: 'computed_value', label: 'Value', tooltip: 'Nilai kalkulasi Python engine' },
      ]}
      status={isLoading ? 'running' : evalResult ? 'success' : 'idle'}
      onDelete={() => removeNode(id)}
      minWidth="min-w-[300px]"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] bg-slate-50 border border-slate-200 rounded p-1.5 font-medium">
          <span className="text-slate-500">Target Sel:</span>
          <span className="font-mono font-bold text-amber-700">
            {effectiveSheet}!{targetCell}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-500 font-semibold">Formula Override (Opsional untuk What-If):</label>
          <input
            type="text"
            placeholder="e.g. =SUM(B4:B7) atau kosongkan"
            value={overrideFormula}
            onChange={(e) => setOverrideFormula(e.target.value)}
            className="font-mono text-xs px-2 py-1 rounded border border-slate-200 bg-white outline-none focus:border-amber-500"
          />
        </div>

        <button
          type="button"
          onClick={handleEvaluate}
          disabled={isLoading || !targetCell}
          className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition cursor-pointer shadow-2xs disabled:opacity-50"
        >
          {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
          Evaluasi Nilai Formula
        </button>
      </div>

      {evalResult && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 text-xs">
          {evalResult.formula && (
            <div className="font-mono text-[11px] bg-slate-50 border border-slate-200 p-1.5 rounded text-slate-800 break-all">
              {evalResult.formula}
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded border border-amber-200 bg-amber-50/60 p-2 flex flex-col gap-0.5">
              <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">Hasil Python:</span>
              <span className="text-base font-bold text-amber-950 truncate">
                {evalResult.computed_value !== null ? String(evalResult.computed_value) : 'None'}
              </span>
            </div>

            <div className="rounded border border-slate-200 bg-slate-50 p-2 flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Excel Cache:</span>
              <span className="text-base font-bold text-slate-800 truncate">
                {evalResult.cached_value !== null ? String(evalResult.cached_value) : 'None'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            {isMatch ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 size={12} /> Hasil sesuai presisi dengan Excel
              </span>
            ) : (
              <span className="text-amber-700 font-medium flex items-center gap-1">
                <AlertCircle size={12} /> Terdapat variasi format angka atau evaluasi dinamis
              </span>
            )}
          </div>
        </div>
      )}
    </BaseNode>
  );
}
