import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Split, ChevronDown, GripHorizontal } from 'lucide-react';

const PAGE_SIZE = 40;
const MIN_CONFIG_HEIGHT = 200; // Tinggi minimum untuk area konfigurasi
const MIN_RESULTS_HEIGHT = 150; // Tinggi minimum untuk area hasil

const inputClass =
  'w-full min-w-0 rounded-md border border-slate-200 bg-white ' +
  'px-2.5 py-2 text-xs text-slate-700 outline-none ' +
  'focus:border-slate-400';

const buttonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-md ' +
  'border border-slate-200 bg-white px-3 py-2 text-xs font-medium ' +
  'text-slate-600 transition hover:bg-slate-50 disabled:opacity-50';

export default function CompareView({
  workbooks,
  activeWorkbookId,
  onRunComparison,
  comparisonResult,
  isLoading,
  onSelectDiffCell,
  selectedRange,
}) {
  const [baselineWb, setBaselineWb] = useState(
    activeWorkbookId || workbooks[0]?.workbook_id || ''
  );
  const [baselineSheet, setBaselineSheet] = useState('');
  const [targetWb, setTargetWb] = useState(
    workbooks.length > 1
      ? workbooks[1].workbook_id
      : activeWorkbookId || workbooks[0]?.workbook_id || ''
  );
  const [targetSheet, setTargetSheet] = useState('');
  const [baselineRange, setBaselineRange] = useState('');
  const [targetRange, setTargetRange] = useState('');
  const [syncTargetWithBaseline, setSyncTargetWithBaseline] = useState(false);
  const [mode, setMode] = useState('exact_formula');
  const [visibleDiffsCount, setVisibleDiffsCount] = useState(PAGE_SIZE);

  // === Resizable Panel State & Logic ===
  const [configHeight, setConfigHeight] = useState(450); // Tinggi default awal
  const isDragging = useRef(false);
  const containerRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'row-resize';
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    // Menghitung tinggi baru berdasarkan posisi mouse dikurangi offset atas container
    let newHeight = e.clientY - containerRect.top;

    // Batasi tinggi maksimum agar menyisakan ruang untuk hasil
    const maxHeight = containerRect.height - MIN_RESULTS_HEIGHT;

    if (newHeight < MIN_CONFIG_HEIGHT) newHeight = MIN_CONFIG_HEIGHT;
    if (newHeight > maxHeight) newHeight = maxHeight;

    setConfigHeight(newHeight);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = 'default';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default'; // Cleanup
    };
  }, [handleMouseMove, handleMouseUp]);
  // ===================================

  useEffect(() => {
    setVisibleDiffsCount(PAGE_SIZE);
  }, [comparisonResult]);

  const currentBaselineEntry = workbooks.find((w) => w.workbook_id === baselineWb);
  const currentTargetEntry = workbooks.find((w) => w.workbook_id === targetWb);

  const baselineSheets = currentBaselineEntry?.sheets || [];
  const targetSheets = currentTargetEntry?.sheets || [];

  const activeBaseSheet = baselineSheets.includes(baselineSheet)
    ? baselineSheet
    : baselineSheets[0] || '';

  const activeTgtSheet = targetSheets.includes(targetSheet)
    ? targetSheet
    : targetSheets[0] || '';

  const diffs = comparisonResult?.diffs || [];

  const displayedDiffs = useMemo(
    () => diffs.slice(0, visibleDiffsCount),
    [diffs, visibleDiffsCount]
  );

  const updateBaselineRange = (value) => {
    setBaselineRange(value);
    if (syncTargetWithBaseline) {
      setTargetRange(value);
    }
  };

  const handleCompare = () => {
    if (!baselineWb || !activeBaseSheet || !targetWb || !activeTgtSheet) {
      return;
    }

    onRunComparison({
      baseline_workbook_id: baselineWb,
      baseline_sheet_name: activeBaseSheet,
      target_workbook_id: targetWb,
      target_sheet_name: activeTgtSheet,
      baseline_range: baselineRange.trim() || null,
      target_range: targetRange.trim() || null,
      mode,
    });
  };

  const renderRangeInput = (value, onChange, onUseSelection) => (
    <div className="flex gap-1.5">
      <input
        className={`${inputClass} font-mono uppercase`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="All cells"
        aria-label="Cell range"
      />

      {selectedRange?.coordinate && (
        <button
          type="button"
          className="shrink-0 rounded-md border border-slate-200 px-2 text-xs text-slate-500 hover:bg-slate-50"
          onClick={onUseSelection}
          title={`Use ${selectedRange.coordinate}`}
        >
          Use selection
        </button>
      )}

      {value && (
        <button
          type="button"
          className="rounded-md px-2 text-slate-400 hover:bg-slate-100"
          onClick={() => onChange('')}
          title="Clear range"
          aria-label="Clear range"
        >
          ×
        </button>
      )}
    </div>
  );

  const renderSource = ({
    label,
    workbook,
    setWorkbook,
    sheets,
    sheet,
    setSheet,
    range,
    setRange,
    useSelection,
  }) => (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-slate-700">{label}</h3>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select
          className={inputClass}
          value={workbook}
          onChange={(e) => {
            setWorkbook(e.target.value);
            setSheet('');
          }}
          aria-label={`${label} workbook`}
        >
          {workbooks.map((w) => (
            <option key={w.workbook_id} value={w.workbook_id}>
              {w.filename}
            </option>
          ))}
        </select>

        <select
          className={inputClass}
          value={sheet}
          onChange={(e) => setSheet(e.target.value)}
          aria-label={`${label} sheet`}
          disabled={!sheets.length}
        >
          {sheets.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-xs text-slate-500">
          Range <span className="text-slate-400">(optional)</span>
        </label>

        {renderRangeInput(range, setRange, useSelection)}

        <p className="mt-1 text-[11px] text-slate-400">
          {range.trim()
            ? `Comparing range ${range.trim().toUpperCase()}`
            : 'Leave empty to compare the entire sheet.'}
        </p>
      </div>
    </section>
  );

  const getDiffLabel = (type) => (type || 'unknown').replace(/_/g, ' ');

  const getDiffColor = (type) => {
    switch (type) {
      case 'formula_changed':
        return 'text-amber-700';
      case 'added':
        return 'text-emerald-700';
      case 'removed':
        return 'text-rose-700';
      default:
        return 'text-slate-600';
    }
  };

  return (
    <aside className="flex h-full w-full min-w-0 flex-col overflow-hidden border-l border-slate-200 bg-white">
      {/* Header (Fixed height) */}
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-3">
        <Split size={16} className="text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-800">Compare Sheets</h2>
      </header>

      {/* Resizable Container untuk Config dan Results */}
      <div ref={containerRef} className="flex min-h-0 flex-1 flex-col">
        {/* Configuration Area */}
        <div
          className="shrink-0 space-y-4 overflow-y-auto p-4"
          style={{ height: `${configHeight}px` }}
        >
          {renderSource({
            label: 'Baseline · Reference',
            workbook: baselineWb,
            setWorkbook: setBaselineWb,
            sheets: baselineSheets,
            sheet: activeBaseSheet,
            setSheet: setBaselineSheet,
            range: baselineRange,
            setRange: updateBaselineRange,
            useSelection: () => {
              updateBaselineRange(selectedRange.coordinate);
            },
          })}

          <div className="border-t border-slate-100" />

          {renderSource({
            label: 'Target · Comparison',
            workbook: targetWb,
            setWorkbook: setTargetWb,
            sheets: targetSheets,
            sheet: activeTgtSheet,
            setSheet: setTargetSheet,
            range: targetRange,
            setRange: setTargetRange,
            useSelection: () => {
              setTargetRange(selectedRange.coordinate);
            },
          })}

          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={syncTargetWithBaseline}
              onChange={(e) => {
                const checked = e.target.checked;
                setSyncTargetWithBaseline(checked);

                if (checked) {
                  setTargetRange(baselineRange);
                }
              }}
            />
            Keep target range synchronized with baseline
          </label>

          <div>
            <label className="mb-1.5 block text-xs text-slate-500">
              Comparison method
            </label>

            <select
              className={inputClass}
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="exact_formula">Exact formula comparison</option>
              <option value="normalized_formula">
                Normalized formula comparison
              </option>
              <option value="values_only">Values only</option>
            </select>
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2.5 text-xs font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleCompare}
            disabled={
              isLoading ||
              !baselineWb ||
              !activeBaseSheet ||
              !targetWb ||
              !activeTgtSheet
            }
          >
            <Split size={14} />
            {isLoading ? 'Comparing...' : 'Run comparison'}
          </button>
        </div>

        {/* Resizer / Drag Handle */}
        <div
          className="group relative flex shrink-0 cursor-row-resize items-center justify-center border-y border-slate-200 bg-slate-50 py-1 transition hover:bg-slate-100"
          onMouseDown={handleMouseDown}
        >
          <GripHorizontal size={16} className="text-slate-400 group-hover:text-slate-600" />
          {/* Invisible overlay yang lebih besar agar lebih mudah diklik/di-drag */}
          <div className="absolute inset-x-0 -inset-y-1" />
        </div>

        {/* Results Area (Mengisi sisa ruang) */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 bg-slate-50/30">
          {!comparisonResult ? (
            <div className="py-10 text-center">
              <Split size={24} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">
                No comparison yet
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Select your sheets and run a comparison.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700">
                    Comparison results
                  </h3>
                  <span className="text-xs text-slate-400">
                    {comparisonResult.diff_count} differences
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md border border-slate-200 bg-white p-2 shadow-sm">
                    <p className="text-[10px] text-slate-500">Changed</p>
                    <p className="mt-1 text-lg font-semibold text-slate-800">
                      {comparisonResult.formula_changed_count ?? 0}
                    </p>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-white p-2 shadow-sm">
                    <p className="text-[10px] text-slate-500">Added / Removed</p>
                    <p className="mt-1 text-lg font-semibold text-slate-800">
                      {comparisonResult.added_count ?? 0}/
                      {comparisonResult.removed_count ?? 0}
                    </p>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-white p-2 shadow-sm">
                    <p className="text-[10px] text-slate-500">Identical</p>
                    <p className="mt-1 text-lg font-semibold text-slate-800">
                      {comparisonResult.identical_count ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Compared ranges */}
              <div className="space-y-1 text-xs text-slate-500">
                <p>
                  Baseline:{' '}
                  <span className="font-medium text-slate-700">
                    {comparisonResult.baseline_range || 'Entire sheet'}
                  </span>
                </p>
                <p>
                  Target:{' '}
                  <span className="font-medium text-slate-700">
                    {comparisonResult.target_range || 'Entire sheet'}
                  </span>
                </p>
              </div>

              {comparisonResult.diff_count === 0 ? (
                <div className="rounded-md border border-slate-200 bg-white p-4 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    No differences found
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {comparisonResult.identical_count} identical cells.
                  </p>
                </div>
              ) : (
                <>
                  <div className="border-t border-slate-200 pt-3">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-slate-700">
                        Differences
                      </h3>
                      <span className="text-xs text-slate-400">
                        {displayedDiffs.length} of {diffs.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {displayedDiffs.map((d, idx) => (
                        <button
                          type="button"
                          key={`${d.coordinate}-${d.diff_type}-${idx}`}
                          className="block w-full rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-slate-400 hover:bg-slate-50 hover:shadow-sm"
                          onClick={() =>
                            onSelectDiffCell(
                              d.baseline_coordinate || d.coordinate
                            )
                          }
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-semibold text-slate-800">
                              {d.coordinate}
                            </span>
                            <span
                              className={`text-[11px] font-medium capitalize ${getDiffColor(
                                d.diff_type
                              )}`}
                            >
                              {getDiffLabel(d.diff_type)}
                            </span>
                          </div>

                          {d.diff_type === 'formula_changed' && (
                            <div className="mt-2 space-y-2">
                              <div>
                                <p className="mb-1 text-[10px] text-slate-400">
                                  Baseline
                                </p>
                                <code className="block break-all rounded bg-slate-50 p-2 text-[11px] text-slate-600 border border-slate-100">
                                  {d.baseline_formula || 'None'}
                                </code>
                              </div>

                              <div>
                                <p className="mb-1 text-[10px] text-slate-400">
                                  Target
                                </p>
                                <code className="block break-all rounded bg-slate-50 p-2 text-[11px] text-slate-600 border border-slate-100">
                                  {d.target_formula || 'None'}
                                </code>
                              </div>
                            </div>
                          )}

                          {d.diff_type === 'value_changed' && (
                            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                              <div className="min-w-0">
                                <p className="text-slate-400">Baseline</p>
                                <p className="break-all text-slate-600">
                                  {String(d.baseline_value)}
                                </p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-slate-400">Target</p>
                                <p className="break-all font-medium text-slate-800">
                                  {String(d.target_value)}
                                </p>
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {diffs.length > visibleDiffsCount && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        className={`${buttonClass} flex-1`}
                        onClick={() =>
                          setVisibleDiffsCount((prev) =>
                            Math.min(prev + PAGE_SIZE, diffs.length)
                          )
                        }
                      >
                        <ChevronDown size={14} />
                        Load more
                      </button>

                      <button
                        type="button"
                        className={buttonClass}
                        onClick={() => setVisibleDiffsCount(diffs.length)}
                      >
                        Show all ({diffs.length})
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}