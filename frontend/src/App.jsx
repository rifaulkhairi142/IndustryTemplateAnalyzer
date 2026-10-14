import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FlowProvider, useFlow } from './flow/FlowContext';
import FlowNavbar from './components/flow/FlowNavbar';
import FlowCanvas from './components/flow/FlowCanvas';
import AddNodeDrawer from './components/flow/AddNodeDrawer';
import LuckysheetGrid from './components/LuckysheetGrid';
import DependencyGraphModal from './components/DependencyGraphModal';
import { GripVertical, Table, Workflow, Crosshair, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

function FlowWorkspace() {
  const {
    viewMode,
    activeLuckysheetData,
    activeSheetName,
    selectedRange,
    handleRangeSelect,
    changeSheet,
    highlights,
    programmaticRange,
    setProgrammaticRange,
    zoomRatio,
    handleZoomChange,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    errorMessage,
    setErrorMessage,
    isGraphModalOpen,
    graphModalData,
    closeGraphModal,
    pickTargetNodeId,
    setPickTargetNodeId,
  } = useFlow();

  // Resizable split width (default 50% = 50vw or 50% of container)
  const [splitRatio, setSplitRatio] = useState(50); // in percent
  const isDraggingSplit = useRef(false);
  const containerRef = useRef(null);

  const handleMouseDownSplit = useCallback((e) => {
    e.preventDefault();
    isDraggingSplit.current = true;
    document.body.style.cursor = 'col-resize';
  }, []);

  const handleMouseMoveSplit = useCallback((e) => {
    if (!isDraggingSplit.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const newRatio = ((clientX - rect.left) / rect.width) * 100;
    const clamped = Math.min(80, Math.max(20, newRatio));
    setSplitRatio(clamped);

    if (window.luckysheet && window.luckysheet.resize) {
      try {
        window.luckysheet.resize();
      } catch (err) {
        // ignore
      }
    }
  }, []);

  const handleMouseUpSplit = useCallback(() => {
    if (isDraggingSplit.current) {
      isDraggingSplit.current = false;
      document.body.style.cursor = 'default';
      if (window.luckysheet && window.luckysheet.resize) {
        try {
          window.luckysheet.resize();
        } catch (err) {
          // ignore
        }
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMoveSplit);
    document.addEventListener('mouseup', handleMouseUpSplit);
    return () => {
      document.removeEventListener('mousemove', handleMouseMoveSplit);
      document.removeEventListener('mouseup', handleMouseUpSplit);
    };
  }, [handleMouseMoveSplit, handleMouseUpSplit]);

  // Window resize observer for Luckysheet
  useEffect(() => {
    const handleResize = () => {
      if (window.luckysheet && window.luckysheet.resize) {
        try {
          window.luckysheet.resize();
        } catch (e) {
          // ignore
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSelectCoordinateFromGraph = (coord, sheet) => {
    if (sheet && sheet !== activeSheetName) {
      changeSheet(sheet);
    }
    setProgrammaticRange({ coordinate: coord, timestamp: Date.now() });
    closeGraphModal();
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Top Navbar */}
      <FlowNavbar />

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-800 px-4 py-2 flex items-center justify-between text-xs z-40 shrink-0">
          <span className="font-medium">Error: {errorMessage}</span>
          <button
            type="button"
            className="text-rose-500 hover:text-rose-700 font-bold p-1 cursor-pointer"
            onClick={() => setErrorMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Pick Mode Notification Banner */}
      {pickTargetNodeId && (
        <div className="bg-amber-500 text-white px-4 py-1.5 flex items-center justify-between text-xs z-40 shrink-0 shadow-xs font-semibold animate-fadeIn">
          <div className="flex items-center gap-2">
            <Crosshair size={14} className="animate-spin" />
            <span>Mode Pemilihan Sel Aktif: Klik sel atau drag range di spreadsheet untuk mengisi koordinat ke node target!</span>
          </div>
          <button
            type="button"
            onClick={() => setPickTargetNodeId(null)}
            className="bg-white/20 hover:bg-white/30 text-white text-[11px] px-2 py-0.5 rounded cursor-pointer"
          >
            Selesai
          </button>
        </div>
      )}

      {/* Main Multi-Mode Workspace */}
      <div ref={containerRef} className="flex flex-1 w-full overflow-hidden relative">
        {/* Left Panel: Flow Canvas */}
        <div
          style={{
            width: viewMode === 'flow' ? '100%' : viewMode === 'spreadsheet' ? '0%' : `${splitRatio}%`,
            display: viewMode === 'spreadsheet' ? 'none' : 'flex',
          }}
          className="h-full flex-col relative transition-all duration-75 border-r border-slate-200"
        >
          <FlowCanvas />
        </div>

        {/* Resizable Divider (Only in Split View) */}
        {viewMode === 'split' && (
          <div
            onMouseDown={handleMouseDownSplit}
            className="w-1.5 bg-slate-200 hover:bg-blue-500 cursor-col-resize flex items-center justify-center transition-colors z-20 group relative shrink-0"
            title="Drag untuk mengubah ukuran split view"
          >
            <GripVertical size={12} className="text-slate-400 group-hover:text-white" />
            <div className="absolute inset-y-0 -inset-x-2 cursor-col-resize" />
          </div>
        )}

        {/* Right Panel: Luckysheet Spreadsheet */}
        <div
          style={{
            width: viewMode === 'spreadsheet' ? '100%' : viewMode === 'flow' ? '0%' : `${100 - splitRatio}%`,
            display: viewMode === 'flow' ? 'none' : 'flex',
          }}
          className="h-full flex-col relative overflow-hidden bg-white"
        >
          {/* Spreadsheet Header Ribbon */}
          <div className="h-9 shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 flex items-center justify-between text-xs z-10">
            <div className="flex items-center gap-2 font-medium text-slate-700 truncate">
              <span className="font-semibold text-slate-900 flex items-center gap-1">
                <Table size={13} className="text-blue-600" />
                Sheet: {activeSheetName || 'None'}
              </span>
              {selectedRange?.coordinate && (
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-blue-700 font-bold text-[11px]">
                  {selectedRange.coordinate}
                </span>
              )}
              {selectedRange?.formula && (
                <span className="font-mono text-[11px] text-slate-500 truncate max-w-xs" title={selectedRange.formula}>
                  {selectedRange.formula}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {highlights.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {highlights.length} highlighted
                </span>
              )}

              {/* Zoom Controls */}
              <div className="flex items-center border border-slate-200 bg-white rounded p-0.5">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 transition cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut size={12} />
                </button>
                <button
                  type="button"
                  onClick={handleZoomReset}
                  className="px-1 text-[10px] font-mono font-bold text-slate-700 hover:text-blue-600"
                  title="Reset Zoom (100%)"
                >
                  {Math.round(zoomRatio * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 transition cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Luckysheet Grid */}
          <div className="flex-1 w-full h-full relative overflow-hidden">
            <LuckysheetGrid
              containerId="luckysheet-main"
              data={activeLuckysheetData}
              onRangeSelect={handleRangeSelect}
              onSheetChange={(idx, sheetName) => changeSheet(sheetName)}
              highlights={highlights}
              activeSheetName={activeSheetName}
              programmaticRange={programmaticRange}
              zoomRatio={zoomRatio}
              onZoomChange={handleZoomChange}
            />
          </div>
        </div>
      </div>

      {/* Node Catalog Drawer */}
      <AddNodeDrawer />

      {/* Dependency Graph Modal */}
      {isGraphModalOpen && (
        <DependencyGraphModal
          graphData={graphModalData}
          onClose={closeGraphModal}
          onSelectNode={handleSelectCoordinateFromGraph}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <FlowProvider>
      <FlowWorkspace />
    </FlowProvider>
  );
}
