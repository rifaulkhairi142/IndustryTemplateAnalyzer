import React, { useRef } from 'react';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import { FileSpreadsheet, Upload, Play, Database, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function WorkbookSourceNode({ id, data }) {
  const fileInputRef = useRef(null);
  const {
    workbooks,
    activeWorkbookId,
    selectWorkbook,
    uploadWorkbook,
    loadSamples,
    deleteWorkbook,
    dbStatus,
    isLoading,
    updateNodeData,
    removeNode,
  } = useFlow();

  const selectedWbId = data.workbook_id || activeWorkbookId || workbooks[0]?.workbook_id || '';
  const currentWb = workbooks.find((w) => w.workbook_id === selectedWbId);

  const handleSelectWb = (wbId) => {
    updateNodeData(id, {
      workbook_id: wbId,
      filename: workbooks.find((w) => w.workbook_id === wbId)?.filename || '',
      sheets: workbooks.find((w) => w.workbook_id === wbId)?.sheets || [],
      total_formulas: workbooks.find((w) => w.workbook_id === wbId)?.total_formulas || 0,
    });
    selectWorkbook(wbId);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadWorkbook(file);
      if (res && res.workbook_id) {
        updateNodeData(id, {
          workbook_id: res.workbook_id,
          filename: res.filename,
          sheets: res.sheets || [],
          total_formulas: res.total_formulas || 0,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      e.target.value = '';
    }
  };

  const handleLoadSamples = async () => {
    try {
      const res = await loadSamples();
      if (res && res.samples && res.samples.length > 0) {
        const first = res.samples[0];
        updateNodeData(id, {
          workbook_id: first.workbook_id,
          filename: first.filename,
          sheets: first.sheets || [],
          total_formulas: first.total_formulas || 0,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!selectedWbId || selectedWbId.startsWith('sample_')) return;
    if (window.confirm(`Hapus workbook ${currentWb?.filename}?`)) {
      await deleteWorkbook(selectedWbId);
    }
  };

  return (
    <BaseNode
      id={id}
      category="source"
      icon={FileSpreadsheet}
      title="Workbook Source"
      subtitle={currentWb?.filename || 'Pilih atau upload file Excel'}
      outputs={[
        { id: 'workbook_id', label: 'WB ID', tooltip: 'ID Workbook yang aktif' },
        { id: 'sheets_list', label: 'Sheets', tooltip: 'Daftar nama sheet' },
      ]}
      status={isLoading ? 'running' : 'idle'}
      onDelete={() => removeNode(id)}
    >
      {/* Dropdown Selector */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-slate-600">Pilih Workbook:</label>
        <select
          value={selectedWbId}
          onChange={(e) => handleSelectWb(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 shadow-2xs"
        >
          {workbooks.map((w) => (
            <option key={w.workbook_id} value={w.workbook_id}>
              {w.filename} ({w.total_formulas || 0} fml)
            </option>
          ))}
        </select>
      </div>

      {/* Info Card */}
      {currentWb && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-2 text-[11px] flex flex-col gap-1">
          <div className="flex items-center justify-between text-blue-900 font-semibold">
            <span className="truncate">{currentWb.filename}</span>
            <span className="px-1.5 py-0.2 bg-blue-200/60 text-blue-800 rounded text-[10px]">
              ID: {currentWb.workbook_id}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600 text-[10px]">
            <span>{currentWb.sheets?.length || 0} Sheet(s)</span>
            <span>{currentWb.total_formulas || 0} Total Formula</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xlsm,.xltx"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 text-xs transition shadow-2xs disabled:opacity-50 cursor-pointer"
        >
          <Upload size={13} />
          Upload Excel
        </button>

        <button
          type="button"
          onClick={handleLoadSamples}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium py-1.5 text-xs transition shadow-2xs disabled:opacity-50 cursor-pointer"
        >
          <Play size={12} />
          Demo Models
        </button>
      </div>

      {/* Database PostgreSQL Status Indicator */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1 text-slate-600">
          <Database size={11} className={dbStatus?.connected ? 'text-emerald-500' : 'text-slate-400'} />
          <span>PostgreSQL:</span>
          {dbStatus?.connected ? (
            <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
              <CheckCircle2 size={10} /> {dbStatus.schema || 'Ready'}
            </span>
          ) : (
            <span className="text-slate-500 italic">In-memory session</span>
          )}
        </div>

        {selectedWbId && !selectedWbId.startsWith('sample_') && (
          <button
            type="button"
            onClick={handleDelete}
            title="Hapus workbook dari memory dan database"
            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded transition cursor-pointer"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </BaseNode>
  );
}
