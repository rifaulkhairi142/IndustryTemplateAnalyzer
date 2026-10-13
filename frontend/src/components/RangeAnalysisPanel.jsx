import React, { useState, useMemo, useEffect } from 'react';
import { Layers, Globe, Zap, Pin, Search, ArrowUpLeft, ArrowRight, CheckCircle2, X, Eye, ChevronDown } from 'lucide-react';

const PAGE_SIZE = 40;

export default function RangeAnalysisPanel({
  rangeData,
  activeSheetName,
  onSelectCell,
  onTraceCell,
  isLoading,
  onClose
}) {
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all', 'cross_sheet', 'local_formula', 'hardcoded'
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedCategory, searchQuery, rangeData?.range]);

  const summary = rangeData?.summary || {
    cross_sheet_count: 0,
    local_formula_count: 0,
    hardcoded_count: 0,
    empty_count: 0,
    total_cells: 0
  };

  const cells = rangeData?.cells || [];

  const filteredCells = useMemo(() => {
    return cells.filter((c) => {
      // Category filter
      if (selectedCategory !== 'all' && c.category !== selectedCategory) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchCoord = c.coordinate.toLowerCase().includes(query);
        const matchFormula = c.formula && c.formula.toLowerCase().includes(query);
        const matchVal = c.value !== null && c.value !== undefined && String(c.value).toLowerCase().includes(query);
        const matchCross = c.cross_sheet_refs.some(r => r.toLowerCase().includes(query));
        const matchLocal = c.local_refs.some(r => r.toLowerCase().includes(query));
        if (!matchCoord && !matchFormula && !matchVal && !matchCross && !matchLocal) {
          return false;
        }
      }

      return true;
    });
  }, [cells, selectedCategory, searchQuery]);

  const displayedCells = useMemo(() => {
    return filteredCells.slice(0, visibleCount);
  }, [filteredCells, visibleCount]);

  if (isLoading) {
    return (
      <aside className="w-full bg-white border-l border-slate-200 flex flex-col h-full p-8 text-center text-slate-400 text-xs">
        Analyzing range precedents and constants...
      </aside>
    );
  }

  if (!rangeData) {
    return (
      <aside className="w-full bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="text-sm font-semibold flex items-center gap-2 text-slate-800">
            <Layers size={16} className="text-purple-600" />
            <span>Range Inspector</span>
          </div>
        </div>
        <div className="p-8 text-center text-slate-400 text-xs">
          Select a range on the sheet and click <strong>Inspect Range</strong> to see cross-sheet precedents, local formulas, and hardcoded values.
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-full bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-purple-100 flex items-center justify-center text-purple-700">
            <Layers size={14} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <span>Range Inspector</span>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                {rangeData.sheet_name}!{rangeData.range}
              </span>
            </div>
          </div>
        </div>

        <button
          className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/80 transition cursor-pointer"
          onClick={onClose}
          title="Close Range Inspector"
        >
          <X size={15} />
        </button>
      </div>

      {/* Metric Breakdown Cards */}
      <div className="p-3 border-b border-slate-200 flex flex-col gap-2.5 bg-slate-50/40 shrink-0 text-xs">
        <div className="grid grid-cols-3 gap-2">
          {/* Cross-Sheet Card */}
          <button
            className={`p-2 rounded-lg border text-left transition cursor-pointer flex flex-col gap-1 ${
              selectedCategory === 'cross_sheet'
                ? 'bg-sky-50 border-sky-400 shadow-xs ring-1 ring-sky-300'
                : 'bg-white border-slate-200 hover:border-sky-300 hover:bg-sky-50/40'
            }`}
            onClick={() => setSelectedCategory(selectedCategory === 'cross_sheet' ? 'all' : 'cross_sheet')}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-sky-800 flex items-center gap-1">
                <Globe size={11} className="text-sky-600" />
                Cross-Sheet
              </span>
              <span className="w-2 h-2 rounded-full bg-sky-400" />
            </div>
            <div className="text-lg font-bold text-sky-900 leading-none">
              {summary.cross_sheet_count}
            </div>
            <span className="text-[10px] text-slate-500">To other sheets</span>
          </button>

          {/* Local Formula Card */}
          <button
            className={`p-2 rounded-lg border text-left transition cursor-pointer flex flex-col gap-1 ${
              selectedCategory === 'local_formula'
                ? 'bg-indigo-50 border-indigo-400 shadow-xs ring-1 ring-indigo-300'
                : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40'
            }`}
            onClick={() => setSelectedCategory(selectedCategory === 'local_formula' ? 'all' : 'local_formula')}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-indigo-800 flex items-center gap-1">
                <Zap size={11} className="text-indigo-600" />
                Local
              </span>
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
            </div>
            <div className="text-lg font-bold text-indigo-900 leading-none">
              {summary.local_formula_count}
            </div>
            <span className="text-[10px] text-slate-500">Same sheet refs</span>
          </button>

          {/* Hardcoded Card */}
          <button
            className={`p-2 rounded-lg border text-left transition cursor-pointer flex flex-col gap-1 ${
              selectedCategory === 'hardcoded'
                ? 'bg-amber-50 border-amber-400 shadow-xs ring-1 ring-amber-300'
                : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/40'
            }`}
            onClick={() => setSelectedCategory(selectedCategory === 'hardcoded' ? 'all' : 'hardcoded')}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                <Pin size={11} className="text-amber-600" />
                Hardcoded
              </span>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            </div>
            <div className="text-lg font-bold text-amber-900 leading-none">
              {summary.hardcoded_count}
            </div>
            <span className="text-[10px] text-slate-500">Static values</span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
          <input
            type="text"
            className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-md pl-8 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-xs placeholder-slate-400"
            placeholder="Search cell (e.g. F4), formula, or precedent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Active Filter Pills */}
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>Showing: <strong>{filteredCells.length}</strong> of {rangeData.total_cells} cells</span>
          {selectedCategory !== 'all' && (
            <button
              className="text-purple-600 hover:text-purple-800 font-semibold cursor-pointer"
              onClick={() => setSelectedCategory('all')}
            >
              Show All
            </button>
          )}
        </div>
      </div>

      {/* Cell List Content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        {filteredCells.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            <CheckCircle2 size={28} className="text-slate-300 mx-auto mb-2" />
            No cells match the current filter criteria
          </div>
        ) : (
          <>
            {filteredCells.length > PAGE_SIZE && (
              <div className="text-[11px] text-slate-500 px-1 py-0.5 flex items-center justify-between">
                <span>
                  Menampilkan <strong>{displayedCells.length}</strong> dari <strong>{filteredCells.length}</strong> sel
                </span>
                <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 font-medium">
                  Optimized
                </span>
              </div>
            )}

            {displayedCells.map((item) => {
              const isCross = item.category === 'cross_sheet';
              const isLocal = item.category === 'local_formula';
              const isHardcoded = item.category === 'hardcoded';

              return (
                <div
                  key={item.coordinate}
                  className="bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs rounded-lg p-2.5 flex flex-col gap-2 transition cursor-pointer text-xs"
                  onClick={() => onSelectCell(item.coordinate, activeSheetName)}
                >
                  {/* Card Top: Coordinate + Category Badge + Trace Action */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800 font-mono text-xs">
                        {item.coordinate}
                      </span>

                      {/* Category Pill */}
                      {isCross && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                          <Globe size={10} />
                          Cross-Sheet
                        </span>
                      )}

                      {isLocal && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Zap size={10} />
                          Local Formula
                        </span>
                      )}

                      {isHardcoded && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <Pin size={10} />
                          Hardcoded
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {item.value !== null && item.value !== undefined && (
                        <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {String(item.value)}
                        </span>
                      )}

                      {item.formula && (
                        <button
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTraceCell(item.coordinate, 'precedents');
                          }}
                          title="Trace precedents for this cell"
                        >
                          <ArrowUpLeft size={10} />
                          Trace
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Formula Display */}
                  {item.formula && (
                    <div className="font-mono text-xs bg-slate-50 border border-slate-200 text-sky-800 p-1.5 rounded break-all shadow-2xs">
                      {item.formula}
                    </div>
                  )}

                  {/* Cross-Sheet Precedents Target Tags */}
                  {item.cross_sheet_refs && item.cross_sheet_refs.length > 0 && (
                    <div className="flex flex-col gap-1 bg-sky-50/60 p-2 rounded-md border border-sky-200">
                      <span className="text-[10px] font-semibold text-sky-800 flex items-center gap-1">
                        <Globe size={10} />
                        Precedents from other sheets:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {item.cross_sheet_refs.map((ref) => {
                          const [refSheet, refCoord] = ref.includes('!') ? ref.split('!') : [null, ref];
                          return (
                            <button
                              key={ref}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded bg-white text-sky-700 border border-sky-300 hover:bg-sky-100 transition cursor-pointer shadow-2xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectCell(refCoord, refSheet);
                              }}
                              title={`Jump to ${ref}`}
                            >
                              <span>{ref}</span>
                              <ArrowRight size={10} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Local Precedents Tags */}
                  {item.local_refs && item.local_refs.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap text-[11px] text-slate-600">
                      <span className="text-[10px] text-slate-400">Local Refs:</span>
                      {item.local_refs.slice(0, 6).map((r) => (
                        <span
                          key={r}
                          className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1 py-0.2 rounded border border-slate-200"
                        >
                          {r}
                        </span>
                      ))}
                      {item.local_refs.length > 6 && (
                        <span className="text-[10px] text-slate-400">
                          +{item.local_refs.length - 6} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Hardcoded Note */}
                  {isHardcoded && (
                    <div className="text-[11px] text-amber-700 italic">
                      Static input value without formula calculation.
                    </div>
                  )}
                </div>
              );
            })}

            {filteredCells.length > visibleCount && (
              <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-1.5">
                <span className="text-center text-[11px] text-slate-500">
                  Sisa {filteredCells.length - visibleCount} sel belum ditampilkan
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                    className="flex-1 py-1.5 px-3 bg-white border border-slate-300 hover:border-purple-400 hover:text-purple-700 text-slate-700 text-xs font-medium rounded-md shadow-2xs transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <ChevronDown size={14} />
                    +{PAGE_SIZE} Sel Lagi
                  </button>
                  <button
                    onClick={() => setVisibleCount(filteredCells.length)}
                    className="py-1.5 px-3 text-xs text-purple-700 hover:text-purple-900 font-medium cursor-pointer"
                  >
                    Tampilkan Semua ({filteredCells.length})
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
