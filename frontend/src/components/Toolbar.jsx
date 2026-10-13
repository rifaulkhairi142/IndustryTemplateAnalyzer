
import React, { useState, useEffect } from 'react';
import {
  ArrowUpLeft,
  ArrowDownRight,
  GitFork,
  Layers,
  X,
  Filter,
  Plus,
  Minus,
} from 'lucide-react';

export default function Toolbar({
  currentMode,
  setMode,
  selectedRange,
  activeSheetName,
  onTrace,
  onOpenGraph,
  hasTraceData,
  onManualRangeSubmit,
  onClearSelection,
  onFilterRangeFormulas,
  onAnalyzeRange,
  hasRangeAnalysis,
  zoomRatio = 1,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}) {
  const [rangeInput, setRangeInput] = useState('');

  useEffect(() => {
    setRangeInput(selectedRange?.coordinate || '');
  }, [selectedRange?.coordinate]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && rangeInput.trim()) {
      onManualRangeSubmit(rangeInput.trim());
    }
  };

  const isRange = selectedRange?.isRange;
  const cellCount = selectedRange?.cellCount || 1;

  const modes = [
    { id: 'explore', label: 'Explore' },
    { id: 'compare', label: 'Compare Sheets' },
    { id: 'audit', label: 'Audit' },
    { id: 'hidden_trace', label: 'Trace Hidden' },
    ...(hasRangeAnalysis
      ? [{ id: 'range_analysis', label: 'Range Inspector' }]
      : []),
  ];

  const buttonClass =
    'inline-flex shrink-0 items-center justify-center gap-1.5 ' +
    'rounded-md border border-slate-200 bg-white px-2.5 py-1.5 ' +
    'text-xs font-medium text-slate-600 transition ' +
    'hover:bg-slate-50 hover:text-slate-900 ' +
    'disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="relative z-10 shrink-0 border-b border-slate-200 bg-white px-4 py-2">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">

        {/* Mode Navigation */}
        <div className="flex shrink-0 items-center gap-1">
          {modes.map((mode) => {
            const isActive = currentMode === mode.id;

            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setMode(mode.id)}
                aria-pressed={isActive}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition ${isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>

        {/* Range Input & Actions */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">

          <input
            type="text"
            aria-label="Selected cell or range"
            className="w-24 shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold uppercase text-slate-700 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
            placeholder="B4:F8"
            value={rangeInput}
            onChange={(e) => setRangeInput(e.target.value)}
            onKeyDown={handleKeyDown}
            title="Enter a cell or range and press Enter"
          />

          {selectedRange && (
            <span className="shrink-0 text-xs text-slate-500">
              {isRange ? `${cellCount} cells` : '1 cell'}
            </span>
          )}

          {selectedRange?.formula && !isRange && (
            <span
              className="max-w-40 truncate font-mono text-xs text-slate-500"
              title={selectedRange.formula}
            >
              {selectedRange.formula}
            </span>
          )}

          {selectedRange?.coordinate ? (
            <>
              <button
                type="button"
                className={buttonClass}
                onClick={() =>
                  onAnalyzeRange(selectedRange.coordinate)
                }
                title="Inspect formulas and values in this range"
              >
                <Layers size={13} />
                Inspect
              </button>

              <button
                type="button"
                className={buttonClass}
                onClick={() => onTrace('precedents')}
                title="Trace cells referenced by this formula"
              >
                <ArrowUpLeft size={13} />
                Precedents
              </button>

              <button
                type="button"
                className={buttonClass}
                onClick={() => onTrace('dependents')}
                title="Trace formulas that depend on this cell"
              >
                <ArrowDownRight size={13} />
                Dependents
              </button>

              {isRange && (
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() =>
                    onFilterRangeFormulas(selectedRange.coordinate)
                  }
                  title="Filter formulas to this range"
                  aria-label="Filter formulas"
                >
                  <Filter size={13} />
                </button>
              )}

              {hasTraceData && (
                <button
                  type="button"
                  className={buttonClass}
                  onClick={onOpenGraph}
                  title="Open dependency graph"
                >
                  <GitFork size={13} />
                  Graph
                </button>
              )}

              <button
                type="button"
                className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                onClick={() => {
                  onClearSelection();
                  setRangeInput('');
                }}
                title="Clear selection"
                aria-label="Clear selection"
              >
                <X size={15} />
              </button>
            </>
          ) : (
            <span className="text-xs text-slate-400">
              Select a cell to trace dependencies
            </span>
          )}

          {/* Zoom Controls */}
          {onZoomIn && onZoomOut && (
            <div className="flex items-center gap-1 border border-slate-200 bg-slate-50/80 rounded-md px-1.5 py-1 text-xs shrink-0 ml-1">
              <button
                type="button"
                onClick={onZoomOut}
                disabled={zoomRatio <= 0.4}
                title="Zoom Out (Ctrl -)"
                className="p-0.5 text-slate-500 hover:text-slate-900 rounded transition cursor-pointer disabled:opacity-40"
              >
                <Minus size={12} />
              </button>
              <button
                type="button"
                onClick={onZoomReset}
                title="Reset Zoom to 100%"
                className="px-1 text-[11px] font-mono font-bold text-slate-700 hover:text-blue-600 rounded transition cursor-pointer min-w-[36px] text-center"
              >
                {Math.round(zoomRatio * 100)}%
              </button>
              <button
                type="button"
                onClick={onZoomIn}
                disabled={zoomRatio >= 2.0}
                title="Zoom In (Ctrl +)"
                className="p-0.5 text-slate-500 hover:text-slate-900 rounded transition cursor-pointer disabled:opacity-40"
              >
                <Plus size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
