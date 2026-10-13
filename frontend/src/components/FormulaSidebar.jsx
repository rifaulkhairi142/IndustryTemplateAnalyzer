import React, { useState, useMemo, useEffect } from 'react';
import { Search, Group, FunctionSquare, ArrowUpLeft, Zap, Play, RefreshCw, XCircle, ChevronDown, CheckCircle2 } from 'lucide-react';
import { coordToRowCol } from './LuckysheetGrid';

const PAGE_SIZE = 50;

export default function FormulaSidebar({
  formulasData,
  activeSheetName,
  onSelectCell,
  onTraceCell,
  rangeFilter,
  onClearRangeFilter,
  onLoadFormulas,
  onClearFormulas,
  isScanningFormulas
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'groups'
  const [selectedGroupPattern, setSelectedGroupPattern] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [visibleGroupsCount, setVisibleGroupsCount] = useState(30);

  const formulas = formulasData?.formulas || [];
  const groups = formulasData?.groups || [];

  // Reset pagination when filter, search, group, or sheet changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setVisibleGroupsCount(30);
  }, [searchTerm, rangeFilter, selectedGroupPattern, viewMode, activeSheetName]);

  const isCellInRange = (coord, rangeStr) => {
    if (!rangeStr) return true;
    if (!rangeStr.includes(':')) return coord.toUpperCase() === rangeStr.toUpperCase();
    const [start, end] = rangeStr.toUpperCase().split(':');
    const p1 = coordToRowCol(start);
    const p2 = coordToRowCol(end);
    const cur = coordToRowCol(coord);
    if (!p1 || !p2 || !cur) return true;
    const minR = Math.min(p1.row, p2.row);
    const maxR = Math.max(p1.row, p2.row);
    const minC = Math.min(p1.col, p2.col);
    const maxC = Math.max(p1.col, p2.col);
    return cur.row >= minR && cur.row <= maxR && cur.col >= minC && cur.col <= maxC;
  };

  const filteredFormulas = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return formulas.filter((f) => {
      if (rangeFilter && !isCellInRange(f.coordinate, rangeFilter)) {
        return false;
      }

      if (selectedGroupPattern && f.normalized_formula !== selectedGroupPattern) {
        return false;
      }

      if (term) {
        return (
          f.coordinate.toLowerCase().includes(term) ||
          f.formula.toLowerCase().includes(term) ||
          f.functions.some((fn) => fn.toLowerCase().includes(term))
        );
      }

      return true;
    });
  }, [formulas, searchTerm, selectedGroupPattern, rangeFilter]);

  // Sliced items for instant virtual rendering
  const displayedFormulas = useMemo(() => {
    return filteredFormulas.slice(0, visibleCount);
  }, [filteredFormulas, visibleCount]);

  const displayedGroups = useMemo(() => {
    return groups.slice(0, visibleGroupsCount);
  }, [groups, visibleGroupsCount]);

  // Standby View when formulasData is not yet loaded / explored
  if (!formulasData) {
    return (
      <aside className="w-full bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="text-sm font-semibold flex items-center gap-2 text-slate-800">
            <FunctionSquare size={16} className="text-slate-500" />
            <span>Formula Discovery</span>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Standby
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3 shadow-2xs">
            <Zap size={22} />
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">
            Explore Formula Standby
          </h3>
          <p className="text-xs text-slate-500 max-w-xs mb-4 leading-relaxed">
            Formula tidak dipindai otomatis saat membuka sheet untuk menghemat memori dan menjaga aplikasi tetap cepat.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-5 text-xs text-slate-600 w-full max-w-xs">
            Sheet Aktif: <strong className="text-blue-700">{activeSheetName || 'Belum dipilih'}</strong>
          </div>

          <button
            onClick={() => onLoadFormulas && onLoadFormulas()}
            disabled={isScanningFormulas}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {isScanningFormulas ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Memindai Formula Sheet...
              </>
            ) : (
              <>
                <Play size={14} />
                Pindai & Jelajahi Formula
              </>
            )}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-full bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shadow-sm">
      {/* Sidebar Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
        <div className="text-sm font-semibold flex items-center gap-2 text-slate-800">
          <FunctionSquare size={16} className="text-blue-600" />
          <span>Formula Discovery</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            {formulas.length} formulas
          </span>
          <button
            onClick={() => onClearFormulas && onClearFormulas()}
            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-200 px-1.5 py-0.5 rounded transition cursor-pointer"
            title="Tutup / Nonaktifkan formula untuk sheet ini guna membebaskan memori"
          >
            <XCircle size={12} />
            Tutup
          </button>
          <button
            onClick={() => onLoadFormulas && onLoadFormulas()}
            disabled={isScanningFormulas}
            className="text-[11px] text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition cursor-pointer disabled:opacity-50"
            title="Pindai ulang formula sheet ini"
          >
            <RefreshCw size={13} className={isScanningFormulas ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Search & Toggle Controls */}
      <div className="p-3 border-b border-slate-200 flex flex-col gap-2.5 bg-slate-50/40 shrink-0">
        {/* Search Input */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-xs placeholder-slate-400"
            placeholder="Search by cell, formula, or SUM/IF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            className={`flex-1 py-1 px-2.5 text-xs font-medium rounded-md transition cursor-pointer ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => { setViewMode('list'); setSelectedGroupPattern(null); }}
          >
            All Formulas ({formulas.length})
          </button>
          <button
            className={`flex-1 py-1 px-2.5 text-xs font-medium rounded-md flex items-center justify-center gap-1 transition cursor-pointer ${
              viewMode === 'groups'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => setViewMode('groups')}
          >
            <Group size={13} />
            Patterns ({groups.length})
          </button>
        </div>

        {selectedGroupPattern && (
          <div className="flex items-center justify-between text-xs bg-blue-50 border border-blue-200 text-blue-800 px-2.5 py-1 rounded-md">
            <span>Filtered by pattern</span>
            <button
              className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer text-xs"
              onClick={() => setSelectedGroupPattern(null)}
            >
              Clear
            </button>
          </div>
        )}

        {rangeFilter && (
          <div className="flex items-center justify-between text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-md">
            <span>Range: <strong>{rangeFilter}</strong> ({filteredFormulas.length} formulas)</span>
            <button
              className="text-emerald-700 hover:text-emerald-900 font-semibold cursor-pointer text-xs"
              onClick={onClearRangeFilter}
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Sidebar Content List with Virtual Slicing */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        {viewMode === 'groups' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
              <span>Grouped by normalized structure (R1C1 relative logic):</span>
              <span>{groups.length} pola</span>
            </div>
            {displayedGroups.map((g, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200 hover:border-blue-400 hover:shadow-xs rounded-lg p-3 flex flex-col gap-2 transition cursor-pointer"
                style={{
                  borderLeftWidth: selectedGroupPattern === g.pattern ? '4px' : '1px',
                  borderLeftColor: selectedGroupPattern === g.pattern ? '#2563eb' : undefined
                }}
                onClick={() => {
                  setSelectedGroupPattern(g.pattern);
                  setViewMode('list');
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {g.count} cells sharing pattern
                  </span>
                  <span className="text-xs text-slate-400">
                    Sample: {g.cells[0]}
                  </span>
                </div>
                <div className="font-mono text-xs bg-slate-50 border border-slate-200 text-sky-800 p-1.5 rounded break-all">
                  {g.sample_formula}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {g.cells.slice(0, 8).map((c) => (
                    <span
                      key={c}
                      className="text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200"
                    >
                      {c}
                    </span>
                  ))}
                  {g.cells.length > 8 && (
                    <span className="text-[11px] text-slate-400">
                      +{g.cells.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Load More Patterns Control */}
            {groups.length > visibleGroupsCount && (
              <div className="mt-2 text-center p-2 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-1.5">
                <span className="text-[11px] text-slate-500">
                  Menampilkan {displayedGroups.length} dari {groups.length} pola pola
                </span>
                <button
                  onClick={() => setVisibleGroupsCount((prev) => prev + 30)}
                  className="w-full py-1.5 px-3 bg-white border border-slate-300 hover:border-blue-400 hover:text-blue-700 text-slate-700 text-xs font-medium rounded-md shadow-2xs transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <ChevronDown size={14} />
                  Muat 30 Pola Lebih Banyak
                </button>
              </div>
            )}
          </div>
        )}

        {viewMode === 'list' && (
          <div className="flex flex-col gap-2">
            {filteredFormulas.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No formulas match the current criteria
              </div>
            ) : (
              <>
                {/* Performance Header info if dataset is large */}
                {filteredFormulas.length > PAGE_SIZE && (
                  <div className="text-[11px] text-slate-500 px-1 py-0.5 flex items-center justify-between">
                    <span>
                      Menampilkan <strong>{displayedFormulas.length}</strong> dari <strong>{filteredFormulas.length.toLocaleString()}</strong> formula
                    </span>
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-medium">
                      Performa Dioptimalkan
                    </span>
                  </div>
                )}

                {displayedFormulas.map((item) => (
                  <div
                    key={item.coordinate}
                    className="bg-white border border-slate-200 hover:border-blue-400 hover:shadow-xs rounded-lg p-2.5 flex flex-col gap-1.5 transition cursor-pointer"
                    onClick={() => onSelectCell(item.coordinate, item.formula)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-blue-700 text-xs">
                          {item.coordinate}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          (R{item.row}, C{item.col})
                        </span>
                      </div>

                      <button
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTraceCell(item.coordinate, 'precedents');
                        }}
                        title="Trace Precedents for this cell"
                      >
                        <ArrowUpLeft size={11} />
                        Trace
                      </button>
                    </div>

                    <div className="font-mono text-xs bg-slate-50 border border-slate-200 text-sky-800 p-1.5 rounded break-all">
                      {item.formula}
                    </div>

                    {item.functions.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-400">Functions:</span>
                        {item.functions.map((fn) => (
                          <span key={fn} className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            {fn}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Progressive Load More Controls */}
                {filteredFormulas.length > visibleCount && (
                  <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>Sisa Formula: <strong>{(filteredFormulas.length - visibleCount).toLocaleString()}</strong> belum ditampilkan</span>
                      <span className="text-[11px] text-slate-400">({Math.round((visibleCount / filteredFormulas.length) * 100)}%)</span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                        className="flex-1 py-1.5 px-3 bg-white border border-slate-300 hover:border-blue-400 hover:text-blue-700 text-slate-700 text-xs font-medium rounded-md shadow-2xs transition cursor-pointer flex items-center justify-center gap-1"
                      >
                        <ChevronDown size={14} />
                        +50 Formula
                      </button>

                      {filteredFormulas.length > visibleCount + PAGE_SIZE && (
                        <button
                          onClick={() => setVisibleCount((prev) => prev + 250)}
                          className="flex-1 py-1.5 px-3 bg-white border border-slate-300 hover:border-blue-400 hover:text-blue-700 text-slate-700 text-xs font-medium rounded-md shadow-2xs transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          <ChevronDown size={14} />
                          +250 Formula
                        </button>
                      )}
                    </div>

                    {filteredFormulas.length <= 2000 && (
                      <button
                        onClick={() => setVisibleCount(filteredFormulas.length)}
                        className="w-full py-1 text-[11px] text-slate-500 hover:text-slate-800 underline transition cursor-pointer text-center"
                      >
                        Tampilkan Semua ({filteredFormulas.length.toLocaleString()})
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

