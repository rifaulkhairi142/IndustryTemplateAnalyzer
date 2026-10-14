import React, { useRef, useState } from 'react';
import { useFlow } from '../../flow/FlowContext';
import { WORKFLOW_PRESETS } from '../../flow/WorkflowPresets';
import {
  Workflow,
  Plus,
  Bookmark,
  Download,
  Upload,
  Trash2,
  FileSpreadsheet,
  Database,
  CheckCircle2,
  Split,
  Table,
  Cpu,
  Layers,
} from 'lucide-react';

export default function FlowNavbar() {
  const {
    viewMode,
    setViewMode,
    setIsAddNodeDrawerOpen,
    loadPreset,
    clearCanvas,
    exportFlow,
    importFlow,
    workbooks,
    activeWorkbookId,
    selectWorkbook,
    uploadWorkbook,
    loadSamples,
    dbStatus,
    isLoading,
  } = useFlow();

  const fileInputRef = useRef(null);
  const flowJsonInputRef = useRef(null);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadWorkbook(file);
      e.target.value = '';
    }
  };

  const handleFlowJsonUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        importFlow(event.target.result);
      };
      reader.readAsText(file);
      e.target.value = '';
    }
  };

  const currentWb = workbooks.find((w) => w.workbook_id === activeWorkbookId);

  return (
    <header className="h-14 shrink-0 border-b border-slate-200 bg-white px-4 flex items-center justify-between z-30 shadow-2xs">
      {/* Brand & Mode Switcher */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Workflow size={17} />
          </div>
          <div>
            <h1 className="text-xs font-bold text-slate-900 leading-tight">Formula Intelligence</h1>
            <span className="text-[10px] text-slate-500 font-medium">Visual Node Pipeline</span>
          </div>
        </div>

        {/* View Mode Switcher Tabs */}
        <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs ml-2">
          <button
            type="button"
            onClick={() => setViewMode('flow')}
            className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'flow'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Kanvas node penuh"
          >
            <Workflow size={13} />
            Flow Canvas
          </button>

          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'split'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Split view: Node di kiri, Spreadsheet di kanan"
          >
            <Split size={13} />
            Split View (50/50)
          </button>

          <button
            type="button"
            onClick={() => setViewMode('spreadsheet')}
            className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'spreadsheet'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Spreadsheet Luckysheet layar penuh"
          >
            <Table size={13} />
            Spreadsheet Focus
          </button>
        </div>
      </div>

      {/* Middle: Active Workbook Selector & PostgreSQL Status */}
      <div className="hidden lg:flex items-center gap-2 text-xs">
        {workbooks.length > 0 && (
          <div className="flex items-center gap-1.5 border border-slate-200 bg-slate-50 px-2.5 py-1 rounded-lg">
            <FileSpreadsheet size={13} className="text-blue-600" />
            <select
              value={activeWorkbookId || ''}
              onChange={(e) => selectWorkbook(e.target.value)}
              className="bg-transparent font-medium text-slate-800 outline-none text-xs cursor-pointer max-w-44 truncate"
            >
              {workbooks.map((w) => (
                <option key={w.workbook_id} value={w.workbook_id}>
                  {w.filename} ({w.total_formulas || 0} fml)
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-500 font-medium bg-slate-50 border border-slate-200">
          <Database size={11} className={dbStatus?.connected ? 'text-emerald-500' : 'text-slate-400'} />
          <span>PostgreSQL: {dbStatus?.connected ? <strong className="text-emerald-700">{dbStatus.schema}</strong> : 'Mem'}</span>
        </div>
      </div>

      {/* Right Toolbar Actions */}
      <div className="flex items-center gap-1.5">
        {/* Add Node Button */}
        <button
          type="button"
          onClick={() => setIsAddNodeDrawerOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-2xs cursor-pointer"
        >
          <Plus size={14} />
          <span>Add Node</span>
        </button>

        {/* Workflow Presets Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsPresetsOpen(!isPresetsOpen)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition shadow-2xs cursor-pointer"
          >
            <Bookmark size={13} className="text-amber-500" />
            <span>Presets</span>
          </button>

          {isPresetsOpen && (
            <div
              className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1.5 space-y-1 animate-fadeIn"
              onClick={() => setIsPresetsOpen(false)}
            >
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Alur Kerja Siap Pakai:
              </div>
              {WORKFLOW_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => loadPreset(p.id)}
                  className="w-full p-2 text-left rounded-lg hover:bg-blue-50/60 transition flex flex-col gap-0.5 cursor-pointer"
                >
                  <span className="text-xs font-bold text-slate-800">{p.title}</span>
                  <span className="text-[10px] text-slate-500 line-clamp-1">{p.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export Flow */}
        <button
          type="button"
          onClick={exportFlow}
          className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-lg transition cursor-pointer"
          title="Ekspor alur pipeline ke JSON"
        >
          <Download size={14} />
        </button>

        {/* Import Flow */}
        <input
          ref={flowJsonInputRef}
          type="file"
          accept=".json"
          onChange={handleFlowJsonUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => flowJsonInputRef.current?.click()}
          className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-lg transition cursor-pointer"
          title="Impor alur pipeline dari file JSON"
        >
          <Upload size={14} />
        </button>

        {/* Clear Flow */}
        <button
          type="button"
          onClick={clearCanvas}
          className="p-1.5 text-slate-400 hover:text-rose-600 border border-slate-200 hover:bg-rose-50 rounded-lg transition cursor-pointer"
          title="Kosongkan kanvas alur"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </header>
  );
}
