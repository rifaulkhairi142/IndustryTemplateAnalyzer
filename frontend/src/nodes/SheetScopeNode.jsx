import React, { useEffect } from 'react';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import { Layers, Eye, EyeOff } from 'lucide-react';

export default function SheetScopeNode({ id, data }) {
  const {
    activeWorkbookId,
    activeWorkbookMeta,
    activeSheetName,
    changeSheet,
    updateNodeData,
    removeNode,
  } = useFlow();

  // Connected workbook ID from input port or global active workbook
  const effectiveWbId = data.inputs?.workbook_id || data.workbook_id || activeWorkbookId;
  const sheets = activeWorkbookMeta?.sheets || [];
  const selectedSheetName = data.sheet_name || activeSheetName || sheets[0]?.name || '';
  const currentSheetMeta = sheets.find((s) => s.name === selectedSheetName);

  useEffect(() => {
    if (selectedSheetName && data.sheet_name !== selectedSheetName) {
      updateNodeData(id, {
        sheet_name: selectedSheetName,
        sheet_meta: currentSheetMeta,
        workbook_id: effectiveWbId,
      });
    }
  }, [id, selectedSheetName, currentSheetMeta, effectiveWbId]);

  const handleSelectSheet = (name) => {
    const meta = sheets.find((s) => s.name === name);
    updateNodeData(id, {
      sheet_name: name,
      sheet_meta: meta,
      workbook_id: effectiveWbId,
    });
    changeSheet(name);
  };

  const isHidden = currentSheetMeta?.state === 'hidden' || currentSheetMeta?.state === 'veryHidden';

  return (
    <BaseNode
      id={id}
      category="scope"
      icon={Layers}
      title="Sheet Scope"
      subtitle={selectedSheetName ? `Sheet: ${selectedSheetName}` : 'Pilih sheet'}
      inputs={[
        { id: 'workbook_id', label: 'WB ID', tooltip: 'ID Workbook dari WorkbookSourceNode' },
      ]}
      outputs={[
        { id: 'sheet_name', label: 'Sheet', tooltip: 'Nama sheet yang aktif' },
        { id: 'sheet_meta', label: 'Meta', tooltip: 'Metadata dimensi dan jumlah formula' },
      ]}
      onDelete={() => removeNode(id)}
    >
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-slate-600">Pilih Sheet:</label>
        <select
          value={selectedSheetName}
          onChange={(e) => handleSelectSheet(e.target.value)}
          disabled={!sheets.length}
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-purple-500 shadow-2xs"
        >
          {sheets.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name} {s.state !== 'visible' ? `(${s.state})` : ''} - {s.formula_count} formula
            </option>
          ))}
        </select>
      </div>

      {currentSheetMeta && (
        <div className="rounded-lg border border-purple-100 bg-purple-50/60 p-2.5 text-[11px] flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-purple-950 flex items-center gap-1">
              {isHidden ? <EyeOff size={13} className="text-amber-600" /> : <Eye size={13} className="text-purple-600" />}
              {currentSheetMeta.name}
            </span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                isHidden ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-purple-100 text-purple-800'
              }`}
            >
              {currentSheetMeta.state}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-600">
            <div>Dimensi: <strong>{currentSheetMeta.max_row || 0}R × {currentSheetMeta.max_column || 0}C</strong></div>
            <div>Formula: <strong>{currentSheetMeta.formula_count || 0}</strong></div>
            <div>Total Sel: <strong>{currentSheetMeta.cell_count || 0}</strong></div>
            <div>Sheet Index: <strong>{currentSheetMeta.index}</strong></div>
          </div>
        </div>
      )}
    </BaseNode>
  );
}
