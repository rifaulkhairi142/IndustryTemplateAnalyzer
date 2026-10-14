import React from 'react';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import { Table, Maximize2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export default function SpreadsheetViewerNode({ id, data }) {
  const {
    activeWorkbookId,
    activeSheetName,
    selectedRange,
    highlights,
    zoomRatio,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    setViewMode,
    removeNode,
  } = useFlow();

  const activeCoord = selectedRange?.coordinate || 'Belum dipilih';

  return (
    <BaseNode
      id={id}
      category="visual"
      icon={Table}
      title="Spreadsheet Anchor (Grid)"
      subtitle={`Sheet: ${activeSheetName || 'None'}`}
      inputs={[
        { id: 'workbook_id', label: 'WB ID', tooltip: 'ID Workbook' },
        { id: 'sheet_name', label: 'Sheet', tooltip: 'Sheet aktif' },
        { id: 'highlights', label: 'Highlights', tooltip: 'Array sorotan warna sel' },
      ]}
      outputs={[
        { id: 'selected_cell', label: 'Clicked Cell', tooltip: 'Sel yang diklik pengguna di spreadsheet' },
        { id: 'selected_range', label: 'Range', tooltip: 'Range yang diblok pengguna' },
        { id: 'active_sheet', label: 'Sheet', tooltip: 'Sheet yang sedang dibuka' },
      ]}
      onDelete={() => removeNode(id)}
      minWidth="min-w-[320px]"
    >
      <div className="flex flex-col gap-2">
        {/* Status Box */}
        <div className="rounded-lg border border-cyan-200 bg-cyan-50/60 p-2.5 flex flex-col gap-1 text-xs">
          <div className="flex items-center justify-between font-bold text-cyan-950">
            <span>Sel Grid Aktif:</span>
            <span className="font-mono bg-white px-2 py-0.5 rounded border border-cyan-200 text-cyan-800">
              {activeSheetName}!{activeCoord}
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-cyan-800 pt-1 border-t border-cyan-100">
            <span>Sorotan Warna Aktif: <strong>{highlights.length} sel</strong></span>
            <span>Zoom: <strong>{Math.round(zoomRatio * 100)}%</strong></span>
          </div>
        </div>

        {/* Zoom & Viewmode Action Bar */}
        <div className="flex items-center justify-between gap-1 pt-1">
          <div className="flex items-center gap-1 border border-slate-200 bg-slate-50 rounded p-1">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-200 transition cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut size={12} />
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              className="text-[10px] font-mono px-1 font-bold text-slate-700 hover:text-blue-600"
              title="Reset Zoom"
            >
              {Math.round(zoomRatio * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-200 transition cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn size={12} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setViewMode('split')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-cyan-700 hover:bg-cyan-800 text-white font-medium text-xs transition cursor-pointer shadow-2xs"
            title="Buka tampilan Split View (Node di kiri, Spreadsheet di kanan)"
          >
            <Maximize2 size={12} />
            Buka Split View
          </button>
        </div>
      </div>
    </BaseNode>
  );
}
