import React, { useState, useEffect, useMemo } from 'react';
import { Split, ChevronDown } from 'lucide-react';

const PAGE_SIZE = 40;

export default function CompareView({
  workbooks,
  activeWorkbookId,
  onRunComparison,
  comparisonResult,
  isLoading,
  onSelectDiffCell,
  selectedRange,
}) {
  const [baselineWb, setBaselineWb] = useState(activeWorkbookId || workbooks[0]?.workbook_id || '');
  const [baselineSheet, setBaselineSheet] = useState('');
  const [targetWb, setTargetWb] = useState(workbooks.length > 1 ? workbooks[1]?.workbook_id : activeWorkbookId || '');
  const [targetSheet, setTargetSheet] = useState('');
  const [baselineRange, setBaselineRange] = useState('');
  const [targetRange, setTargetRange] = useState('');
  const [syncTargetWithBaseline, setSyncTargetWithBaseline] = useState(false);
  const [mode, setMode] = useState('exact_formula');
  const [visibleDiffsCount, setVisibleDiffsCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleDiffsCount(PAGE_SIZE);
  }, [comparisonResult]);

  const currentBaselineEntry = workbooks.find((w) => w.workbook_id === baselineWb);
  const currentTargetEntry = workbooks.find((w) => w.workbook_id === targetWb);

  const baselineSheets = currentBaselineEntry?.sheets || [];
  const targetSheets = currentTargetEntry?.sheets || [];

  const activeBaseSheet = baselineSheet || baselineSheets[0] || '';
  const activeTgtSheet = targetSheet || (targetSheets.length > 1 ? targetSheets[1] : targetSheets[0]) || '';

  const handleCompare = () => {
    if (!baselineWb || !activeBaseSheet || !targetWb || !activeTgtSheet) return;
    onRunComparison({
      baseline_workbook_id: baselineWb,
      baseline_sheet_name: activeBaseSheet,
      target_workbook_id: targetWb,
      target_sheet_name: activeTgtSheet,
      baseline_range: baselineRange.trim() ? baselineRange.trim() : null,
      target_range: targetRange.trim() ? targetRange.trim() : null,
      mode: mode,
    });
  };

  const diffs = comparisonResult?.diffs || [];
  const displayedDiffs = useMemo(() => {
    return diffs.slice(0, visibleDiffsCount);
  }, [diffs, visibleDiffsCount]);

  return (
    <aside className="w-full bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
        <div className="text-sm font-semibold flex items-center gap-2 text-slate-800">
          <Split size={16} className="text-blue-600" />
          <span>Workbook & Sheet Comparison</span>
        </div>
      </div>

      {/* Selectors */}
      <div className="p-3 border-b border-slate-200 flex flex-col gap-2.5 bg-slate-50/40 text-xs shrink-0 max-h-[50vh] overflow-y-auto">
        {/* Baseline Selection Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex flex-col gap-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              Baseline (Reference Sheet)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <select
              className="bg-white border border-slate-300 text-slate-800 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs cursor-pointer text-xs"
              value={baselineWb}
              onChange={(e) => setBaselineWb(e.target.value)}
            >
              {workbooks.map((w) => (
                <option key={w.workbook_id} value={w.workbook_id}>
                  {w.filename}
                </option>
              ))}
            </select>

            <select
              className="bg-white border border-slate-300 text-slate-800 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs cursor-pointer text-xs"
              value={activeBaseSheet}
              onChange={(e) => setBaselineSheet(e.target.value)}
            >
              {baselineSheets.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Baseline Range Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-medium text-slate-500">
                Range Cell Baseline (Opsional):
              </label>
              {selectedRange?.coordinate && (
                <button
                  type="button"
                  onClick={() => {
                    const coord = selectedRange.coordinate;
                    setBaselineRange(coord);
                    if (syncTargetWithBaseline) setTargetRange(coord);
                  }}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-medium hover:underline cursor-pointer"
                  title={`Gunakan range seleksi saat ini: ${selectedRange.coordinate}`}
                >
                  Pakai seleksi ({selectedRange.coordinate})
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Contoh: A1:D20 (Kosongkan = seluruh sheet)"
                className="w-full bg-white border border-slate-300 text-slate-800 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs font-mono uppercase"
                value={baselineRange}
                onChange={(e) => {
                  const val = e.target.value;
                  setBaselineRange(val);
                  if (syncTargetWithBaseline) setTargetRange(val);
                }}
              />
              {baselineRange && (
                <button
                  type="button"
                  onClick={() => {
                    setBaselineRange('');
                    if (syncTargetWithBaseline) setTargetRange('');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm px-1 font-bold cursor-pointer"
                  title="Kosongkan (seluruh sheet)"
                >
                  ×
                </button>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {baselineRange.trim() ? (
                <span className="text-blue-600 font-medium">Scope: Range <strong>{baselineRange.trim().toUpperCase()}</strong></span>
              ) : (
                <span>Null: Mengkomparasi <strong>seluruh cell</strong> pada sheet</span>
              )}
            </div>
          </div>
        </div>

        {/* Target Selection Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex flex-col gap-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              Target (Comparison Version)
            </span>
            {baselineRange.trim() && (
              <button
                type="button"
                onClick={() => setTargetRange(baselineRange.trim())}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium hover:underline cursor-pointer"
                title="Salin range dari Baseline ke Target"
              >
                Samakan dgn Baseline
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <select
              className="bg-white border border-slate-300 text-slate-800 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs cursor-pointer text-xs"
              value={targetWb}
              onChange={(e) => setTargetWb(e.target.value)}
            >
              {workbooks.map((w) => (
                <option key={w.workbook_id} value={w.workbook_id}>
                  {w.filename}
                </option>
              ))}
            </select>

            <select
              className="bg-white border border-slate-300 text-slate-800 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs cursor-pointer text-xs"
              value={activeTgtSheet}
              onChange={(e) => setTargetSheet(e.target.value)}
            >
              {targetSheets.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Target Range Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-medium text-slate-500">
                Range Cell Target (Opsional):
              </label>
              {selectedRange?.coordinate && (
                <button
                  type="button"
                  onClick={() => setTargetRange(selectedRange.coordinate)}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium hover:underline cursor-pointer"
                  title={`Gunakan range seleksi saat ini: ${selectedRange.coordinate}`}
                >
                  Pakai seleksi ({selectedRange.coordinate})
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Contoh: A1:D20 (Kosongkan = seluruh sheet)"
                className="w-full bg-white border border-slate-300 text-slate-800 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs font-mono uppercase"
                value={targetRange}
                onChange={(e) => setTargetRange(e.target.value)}
              />
              {targetRange && (
                <button
                  type="button"
                  onClick={() => setTargetRange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm px-1 font-bold cursor-pointer"
                  title="Kosongkan (seluruh sheet)"
                >
                  ×
                </button>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {targetRange.trim() ? (
                <span className="text-indigo-600 font-medium">Scope: Range <strong>{targetRange.trim().toUpperCase()}</strong></span>
              ) : (
                <span>Null: Mengkomparasi <strong>seluruh cell</strong> pada sheet</span>
              )}
            </div>
          </div>
        </div>

        {/* Sync checkbox */}
        <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-600 select-none px-0.5">
          <input
            type="checkbox"
            checked={syncTargetWithBaseline}
            onChange={(e) => {
              const checked = e.target.checked;
              setSyncTargetWithBaseline(checked);
              if (checked && baselineRange) {
                setTargetRange(baselineRange);
              }
            }}
            className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
          />
          <span>Kunci otomatis range Target sama dengan Baseline</span>
        </label>

        {/* Mode Selector */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Comparison Algorithm:
          </label>
          <select
            className="w-full bg-white border border-slate-300 text-slate-800 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs cursor-pointer text-xs"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="exact_formula">Exact Formula Diff (character-by-character)</option>
            <option value="normalized_formula">Normalized Diff (checks logical structure)</option>
            <option value="values_only">Calculated / Constant Values Diff</option>
          </select>
        </div>

        <button
          className="w-full py-1.5 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          onClick={handleCompare}
          disabled={isLoading}
        >
          <Split size={14} />
          Run Sheet Comparison
        </button>
      </div>

      {/* Diffs List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {comparisonResult ? (
          <div className="flex flex-col gap-2.5">
            {/* Scope Information */}
            <div className="bg-slate-50 border border-slate-200 rounded-md p-2 flex flex-col gap-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium text-[11px]">Scope Baseline:</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                    comparisonResult.baseline_range
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {comparisonResult.baseline_range
                    ? `Range: ${comparisonResult.baseline_range}`
                    : 'Seluruh Sheet'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium text-[11px]">Scope Target:</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                    comparisonResult.target_range
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {comparisonResult.target_range
                    ? `Range: ${comparisonResult.target_range}`
                    : 'Seluruh Sheet'}
                </span>
              </div>
            </div>

            {/* Stats Summary Cards */}
            <div className="grid grid-cols-3 gap-1.5">
              <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2 text-center">
                <span className="text-[10px] text-amber-700 font-medium block">Formula Changed</span>
                <span className="text-lg font-bold text-amber-800">
                  {comparisonResult.formula_changed_count}
                </span>
              </div>
              <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2 text-center">
                <span className="text-[10px] text-blue-700 font-medium block">Added / Removed</span>
                <span className="text-lg font-bold text-blue-800">
                  +{comparisonResult.added_count} / -{comparisonResult.removed_count}
                </span>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2 text-center">
                <span className="text-[10px] text-emerald-700 font-medium block">Identik</span>
                <span className="text-lg font-bold text-emerald-800">
                  {comparisonResult.identical_count}
                </span>
              </div>
            </div>

            {comparisonResult.diff_count === 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center text-xs text-emerald-800">
                <span className="font-semibold block mb-0.5">Tidak Ada Perbedaan</span>
                <span>
                  Semua cell pada{' '}
                  <strong>
                    {comparisonResult.cell_range ? `range ${comparisonResult.cell_range}` : 'seluruh sheet'}
                  </strong>{' '}
                  memiliki formula dan nilai yang identik ({comparisonResult.identical_count} cell identik).
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                  <span>Total perbedaan: <strong>{comparisonResult.diff_count}</strong></span>
                  {diffs.length > PAGE_SIZE && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      {displayedDiffs.length} dari {diffs.length} ditampilkan
                    </span>
                  )}
                </div>

                {/* Diffs List */}
                {displayedDiffs.map((d, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-slate-200 hover:border-blue-400 hover:shadow-xs rounded-lg p-2.5 flex flex-col gap-1.5 transition cursor-pointer text-xs"
                    onClick={() => onSelectDiffCell(d.baseline_coordinate || d.coordinate)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-700">
                        Cell {d.coordinate}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          d.diff_type === 'formula_changed'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : d.diff_type === 'added'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : d.diff_type === 'removed'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {d.diff_type.replace('_', ' ')}
                      </span>
                    </div>

                    {d.diff_type === 'formula_changed' && (
                      <div className="flex flex-col gap-1 text-[11px] bg-slate-50 p-1.5 rounded border border-slate-200">
                        <div className="text-rose-700">
                          <span className="text-slate-400">Base: </span>
                          <code className="font-mono">{d.baseline_formula || 'None'}</code>
                        </div>
                        <div className="text-emerald-700">
                          <span className="text-slate-400">Target: </span>
                          <code className="font-mono">{d.target_formula || 'None'}</code>
                        </div>
                      </div>
                    )}

                    {d.diff_type === 'value_changed' && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200">
                        <span>Base: {String(d.baseline_value)}</span>
                        <span>→</span>
                        <span className="font-bold text-blue-700">Target: {String(d.target_value)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {diffs.length > visibleDiffsCount && (
              <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-1.5">
                <span className="text-center text-[11px] text-slate-500">
                  Sisa {diffs.length - visibleDiffsCount} perbedaan belum ditampilkan
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setVisibleDiffsCount((prev) => prev + PAGE_SIZE)}
                    className="flex-1 py-1.5 px-3 bg-white border border-slate-300 hover:border-blue-400 hover:text-blue-700 text-slate-700 text-xs font-medium rounded-md shadow-2xs transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <ChevronDown size={14} />
                    +{PAGE_SIZE} Perbedaan Lagi
                  </button>
                  <button
                    onClick={() => setVisibleDiffsCount(diffs.length)}
                    className="py-1.5 px-3 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                  >
                    Tampilkan Semua ({diffs.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs">
            Select baseline & target sheets above and click <strong>Run Sheet Comparison</strong>.
          </div>
        )}
      </div>
    </aside>
  );
}
