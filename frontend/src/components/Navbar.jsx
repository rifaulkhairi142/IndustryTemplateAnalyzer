
import React, { useRef } from 'react';

export default function Navbar({
  workbooks,
  activeWorkbookId,
  onSelectWorkbook,
  onUploadFile,
  onLoadSamples,
  isLoading,
  activeWorkbookMeta,
  totalAnomaliesCount,
  dbStatus,
}) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];

    if (file) {
      onUploadFile(file);
      e.target.value = '';
    }
  };

  return (
    <nav className="h-14 shrink-0 border-b border-slate-200 bg-white px-5 flex items-center justify-between">
      {/* Brand & Database Schema Status */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-900">
          Formula Intelligence
        </span>



        {activeWorkbookMeta && (
          <div className="hidden md:flex items-center gap-3 border-l border-slate-200 pl-3 text-xs text-slate-500">
            <span>{activeWorkbookMeta.sheets?.length || 0} sheets</span>
            <span>{activeWorkbookMeta.total_formulas || 0} formulas</span>

            {totalAnomaliesCount > 0 && (
              <span className="text-red-600 font-medium">
                {totalAnomaliesCount} anomalies
              </span>
            )}
          </div>
        )}
      </div>

      {/* Workbook Selector */}
      <div className="flex items-center gap-3">
        {workbooks.length > 0 && (
          <select
            aria-label="Select workbook"
            className="max-w-56 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-slate-400 font-medium"
            value={activeWorkbookId || ''}
            onChange={(e) => onSelectWorkbook(e.target.value)}
          >
            {workbooks.map((wb) => (
              <option key={wb.workbook_id} value={wb.workbook_id}>
                {wb.filename}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Actions */}

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xlsm,.xltx"
          onChange={handleFileChange}
        />

        <button
          type="button"
          onClick={onLoadSamples}
          disabled={isLoading}
          className="rounded-md px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition"
        >
          Demo Models
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition"
        >
          {isLoading ? 'Loading...' : 'Upload Excel'}
        </button>
      </div>
    </nav>
  );
}
