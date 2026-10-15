import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import {
  BarChart3,
  Search,
  Download,
  Copy,
  Check,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Filter,
  Maximize2,
  Minimize2,
  CheckSquare,
  Square,
  Code2,
  Eye,
  SlidersHorizontal,
  Table,
  Columns,
  X,
  FileSpreadsheet,
} from 'lucide-react';

export default function HistoricalInspectorNode({ id, data }) {
  const { setHighlights, removeNode, updateNodeData } = useFlow();

  // Navigation & View States
  const [activeTab, setActiveTab] = useState('table'); // 'table' | 'waterfall' | 'common_size' | 'formula_audit'
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Formula & Column Comparison Display Modes
  // 'values' | 'both' (Values & Formulas side-by-side) | 'formulas' (Formulas only)
  const [displayMode, setDisplayMode] = useState('both');

  // Match filter: 'all' | 'matched' | 'only_wb1' | 'only_wb2'
  const [matchFilter, setMatchFilter] = useState('all');

  // Formula filter: 'all' | 'with_formula' | 'anomalies_only' | 'selected_only'
  const [formulaFilter, setFormulaFilter] = useState('all');

  // Selected period column: 'primary' or column header name e.g. 'Q1', 'Full Year'
  const [selectedPeriodCol, setSelectedPeriodCol] = useState('primary');

  // Selected row for deep formula comparison drawer
  const [selectedAccountRow, setSelectedAccountRow] = useState(null);

  // Checkbox selection set for specific formulas
  const [selectedRowNames, setSelectedRowNames] = useState(new Set());

  // Read data from upstream node connection or node's own state
  const rawData = data.inputs?.statement_data ?? data.statement_data;
  const statement = rawData || null;
  const accounts = statement?.accounts || [];
  const columns = statement?.columns || [];
  const baselineLabel = statement?.baseline_label || columns[0] || 'Baseline';
  const statementType = statement?.statement_type || 'income_statement';
  const targetColumns = columns.filter((c) => c !== baselineLabel);

  // Discover available period columns (e.g. Q1, Q2, Q3, Q4, Full Year) from first account's col_values
  const availablePeriods = useMemo(() => {
    if (!accounts.length) return [];
    const firstAcc = accounts[0];
    const firstWbEntry = Object.values(firstAcc.values_by_wb || {})[0];
    if (firstWbEntry?.col_values?.length) {
      return firstWbEntry.col_values.map((c) => c.col_name);
    }
    return [];
  }, [accounts]);

  // Initialize all accounts as selected by default
  useEffect(() => {
    if (accounts.length && selectedRowNames.size === 0) {
      setSelectedRowNames(new Set(accounts.map((a) => a.account_name)));
    }
  }, [accounts]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Toggle single row selection
  const handleToggleRowSelection = (accName, e) => {
    if (e) e.stopPropagation();
    setSelectedRowNames((prev) => {
      const next = new Set(prev);
      if (next.has(accName)) next.delete(accName);
      else next.add(accName);
      return next;
    });
  };

  // Select all or deselect all
  const handleSelectAll = () => {
    if (selectedRowNames.size === accounts.length) {
      setSelectedRowNames(new Set());
    } else {
      setSelectedRowNames(new Set(accounts.map((a) => a.account_name)));
    }
  };

  // Helper to format values with thousand separators without currency symbol ($)
  const formatNumberValue = (val, formatted) => {
    if (formatted !== undefined && formatted !== null && formatted !== '-') {
      const cleaned = String(formatted).replace(/^\$\s*|\s*\$$/, '').trim();
      if (cleaned) return cleaned;
    }
    if (val !== null && val !== undefined && val !== '-') {
      const num = Number(val);
      return !isNaN(num) ? num.toLocaleString() : String(val);
    }
    return '-';
  };

  // Helper to extract value & formula based on selected period
  const getColData = (acc, wbLabel) => {
    const wbEntry = acc.values_by_wb?.[wbLabel];
    if (!wbEntry) return { value: '-', formula: null, coord: null, is_formula: false };

    if (selectedPeriodCol === 'primary' || !wbEntry.col_values?.length) {
      return {
        value: wbEntry.value !== null && wbEntry.value !== undefined ? wbEntry.value : '-',
        formatted: formatNumberValue(wbEntry.value, wbEntry.formatted_value),
        formula: wbEntry.formula,
        coord: wbEntry.coordinate,
        is_formula: wbEntry.is_formula,
      };
    }

    const matchedPeriod = wbEntry.col_values.find((c) => c.col_name === selectedPeriodCol);
    if (matchedPeriod) {
      return {
        value: matchedPeriod.value !== null && matchedPeriod.value !== undefined ? matchedPeriod.value : '-',
        formatted:
          typeof matchedPeriod.value === 'number'
            ? matchedPeriod.value.toLocaleString()
            : formatNumberValue(matchedPeriod.value, matchedPeriod.value),
        formula: matchedPeriod.formula,
        coord: matchedPeriod.coordinate,
        is_formula: matchedPeriod.is_formula,
      };
    }

    return {
      value: wbEntry.value !== null ? wbEntry.value : '-',
      formatted: formatNumberValue(wbEntry.value, wbEntry.formatted_value),
      formula: wbEntry.formula,
      coord: wbEntry.coordinate,
      is_formula: wbEntry.is_formula,
    };
  };

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      // Search text filter
      if (searchTerm) {
        const matchesSearch =
          a.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.normalized_name.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
      }

      // Match status filter
      if (matchFilter === 'matched') {
        if (a.match_status !== 'matched') return false;
      } else if (matchFilter === 'only_wb1') {
        if (a.match_status !== 'only_in_wb1') return false;
      } else if (matchFilter === 'only_wb2') {
        if (a.match_status !== 'only_in_wb2') return false;
      }

      // Formula filter category
      if (formulaFilter === 'selected_only') {
        if (!selectedRowNames.has(a.account_name)) return false;
      } else if (formulaFilter === 'with_formula') {
        const hasAnyFormula = Object.values(a.values_by_wb || {}).some((v) => v.is_formula || v.formula);
        if (!hasAnyFormula) return false;
      } else if (formulaFilter === 'anomalies_only') {
        const hasAnomaly = Object.values(a.formula_statuses || {}).some(
          (s) => s === 'hardcoded_in_target' || s === 'formula_modified'
        );
        if (!hasAnomaly) return false;
      }

      return true;
    });
  }, [accounts, searchTerm, matchFilter, formulaFilter, selectedRowNames]);

  // Handle clicking on an account row to highlight corresponding cells in Luckysheet
  const handleSelectAccount = (acc) => {
    setSelectedAccountRow(acc);
    const hl = [];

    Object.entries(acc.values_by_wb || {}).forEach(([wbLabel, valItem]) => {
      if (valItem && valItem.coordinate) {
        let color = '#dbeafe'; // soft blue
        const growth = acc.growth_pcts?.[wbLabel];
        const fStat = acc.formula_statuses?.[wbLabel];

        if (fStat === 'hardcoded_in_target') color = '#fed7aa';
        else if (fStat === 'formula_modified') color = '#fef08a';
        else if (growth !== undefined && wbLabel !== baselineLabel) {
          color = growth >= 0 ? '#bbf7d0' : '#fecdd3';
        }

        hl.push({
          coordinate: valItem.coordinate,
          color,
          tooltip: `${acc.account_name} (${wbLabel}): ${valItem.formatted_value}`,
        });
      }
    });

    if (hl.length > 0) {
      setHighlights(hl);
    }
    updateNodeData(id, { selected_account: acc.account_name });
  };

  const handleExportCSV = () => {
    if (!accounts.length) return;
    const headers = [
      'Account Name',
      `${baselineLabel} Value`,
      `${baselineLabel} Formula`,
      ...targetColumns.flatMap((c) => [`${c} Value`, `${c} Formula`, `Variance vs ${baselineLabel}`, `Growth %`]),
      'Formula Audit Status',
    ];

    const rows = filteredAccounts.map((a) => {
      const baseData = getColData(a, baselineLabel);
      const tgtColsData = targetColumns.flatMap((c) => {
        const tData = getColData(a, c);
        const vDiff = a.variances?.[c] ?? '';
        const vGrw = a.growth_pcts?.[c] !== undefined ? `${a.growth_pcts[c]}%` : '';
        return [
          tData.value !== '-' ? tData.value : '',
          tData.formula ? `"${tData.formula}"` : '',
          vDiff,
          vGrw,
        ];
      });

      const fStatus = Object.entries(a.formula_statuses || {})
        .map(([k, v]) => `${k}:${v}`)
        .join('; ');

      return [
        `"${a.account_name}"`,
        baseData.value !== '-' ? baseData.value : '',
        baseData.formula ? `"${baseData.formula}"` : '',
        ...tgtColsData,
        `"${fStatus}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `historical_${statementType}_comparison_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyClipboard = () => {
    if (!accounts.length) return;
    const summaryText = filteredAccounts
      .map((a) => {
        const baseData = getColData(a, baselineLabel);
        const targetsInfo = targetColumns
          .map((c) => {
            const tData = getColData(a, c);
            return `${c}: Val=${tData.value}, Fml=${tData.formula || 'None'}, Growth=${a.growth_pcts?.[c]}%`;
          })
          .join(' | ');
        return `[${a.account_name}] -> ${baselineLabel}: Val=${baseData.value}, Fml=${baseData.formula || 'None'} || ${targetsInfo}`;
      })
      .join('\n');

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Reusable Comparative Table Component (Rendered in both Node and Fullscreen)
  const renderComparativeTable = (isModal = false) => {
    const workbooksInfo = statement?.workbooks_info || [];
    const wb1Info = workbooksInfo[0] || {};

    return (
      <div className={`overflow-x-auto border border-slate-200 rounded-md bg-white ${isModal ? 'max-h-[64vh]' : 'max-h-72'}`}>
        <table className="w-full text-left text-xs border-collapse min-w-[720px]">
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700 border-b border-slate-200 select-none">
            {/* Top Multi-Header Row: Workbook Groups */}
            <tr className="border-b border-slate-200 bg-slate-100/80 text-[11px] text-slate-600">
              <th className="py-1.5 px-2.5 w-8 text-center">
                <input
                  type="checkbox"
                  checked={selectedRowNames.size === accounts.length && accounts.length > 0}
                  onChange={handleSelectAll}
                  className="rounded-xs border-slate-300 text-slate-800 focus:ring-slate-500 cursor-pointer"
                  title="Pilih / Batal Pilih Semua"
                />
              </th>

              {/* Baseline / WB 1 Header */}
              <th
                colSpan={displayMode === 'both' ? 4 : 3}
                className="py-1.5 px-3 text-left border-l border-slate-200 bg-slate-100/50"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-slate-900">
                    Workbook 1 <span className="font-normal text-slate-500">({wb1Info.filename || baselineLabel})</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {wb1Info.sheet_name || '-'} · {wb1Info.range || 'Auto'}
                    {wb1Info.formula_range ? ` · ${wb1Info.formula_range}` : ''}
                  </span>
                </div>
              </th>

              {/* Targets Headers */}
              {targetColumns.map((col, cIdx) => {
                const wbTargetInfo = workbooksInfo[cIdx + 1] || {};
                return (
                  <th
                    key={col}
                    colSpan={displayMode === 'both' ? 4 : 3}
                    className="py-1.5 px-3 text-left border-l border-slate-200 bg-slate-50/60"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-slate-900">
                        Workbook {cIdx + 2} <span className="font-normal text-slate-500">({wbTargetInfo.filename || col})</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {wbTargetInfo.sheet_name || '-'} · {wbTargetInfo.range || 'Auto'}
                        {wbTargetInfo.formula_range ? ` · ${wbTargetInfo.formula_range}` : ''}
                      </span>
                    </div>
                  </th>
                );
              })}

              {/* Match Status Header */}
              <th className="py-1.5 px-2.5 border-l border-slate-200 text-center font-semibold text-slate-700 min-w-[130px]">
                Pencocokan Akun
              </th>



              {displayMode !== 'values' && (
                <th className="py-1.5 px-2.5 text-center border-l border-slate-200 font-semibold text-slate-700">
                  Status Formula
                </th>
              )}
            </tr>

            {/* Sub-Header Row */}
            <tr className="bg-slate-50 text-[11px] font-medium text-slate-500">
              <th className="py-1.5 px-2"></th>

              {/* WB 1 Subcols */}
              <th className="py-1.5 px-2.5 border-l border-slate-200">Nama Akun (WB 1)</th>
              <th className="py-1.5 px-2 text-center font-mono">Sel</th>
              {displayMode !== 'values' && (
                <th className="py-1.5 px-2 text-left font-mono min-w-[130px]">Formula (WB 1)</th>
              )}
              {displayMode !== 'formulas' && (
                <th className="py-1.5 px-2.5 text-right font-mono">Nilai</th>
              )}

              {/* Targets Subcols */}
              {targetColumns.map((col, cIdx) => (
                <React.Fragment key={`sub-${col}`}>
                  <th className="py-1.5 px-2.5 border-l border-slate-200">Nama Akun (WB {cIdx + 2})</th>
                  <th className="py-1.5 px-2 text-center font-mono">Sel</th>
                  {displayMode !== 'values' && (
                    <th className="py-1.5 px-2 text-left font-mono min-w-[130px]">Formula (WB {cIdx + 2})</th>
                  )}
                  {displayMode !== 'formulas' && (
                    <th className="py-1.5 px-2.5 text-right font-mono">Nilai</th>
                  )}
                </React.Fragment>
              ))}

              <th className="py-1.5 px-2 text-center border-l border-slate-200">Status</th>



              {displayMode !== 'values' && (
                <th className="py-1.5 px-2 text-center border-l border-slate-200">Audit</th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredAccounts.map((acc, idx) => {
              const isSummary = acc.is_summary;
              const isSelected = selectedRowNames.has(acc.account_name);
              const isRowActive = selectedAccountRow?.account_name === acc.account_name;
              const wb1Label = acc.values_by_wb?.[baselineLabel] ? baselineLabel : (wb1Info.label || 'Workbook 1');
              const wb1Item = acc.values_by_wb?.[wb1Label];
              const wb1ColData = getColData(acc, wb1Label);
              const latestTargetCol = targetColumns[targetColumns.length - 1];
              const fStat = acc.formula_statuses?.[latestTargetCol] || 'identical';

              return (
                <tr
                  key={idx}
                  onClick={() => handleSelectAccount(acc)}
                  className={`transition-colors cursor-pointer ${isRowActive
                    ? 'bg-slate-100/90'
                    : isSummary
                      ? 'bg-slate-50/70 font-semibold text-slate-900'
                      : 'hover:bg-slate-50 text-slate-700'
                    }`}
                >
                  {/* Checkbox */}
                  <td className="py-1.5 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleToggleRowSelection(acc.account_name, e)}
                      className="rounded-xs border-slate-300 text-slate-800 focus:ring-slate-500 cursor-pointer"
                    />
                  </td>

                  {/* WB 1: Nama Akun, Sel, Formula, Nilai */}
                  <td className="py-1.5 px-2.5 border-l border-slate-100">
                    {wb1Item?.is_present ? (
                      <span className={isSummary ? 'font-semibold text-slate-900' : 'text-slate-800'}>
                        {wb1Item.account_name || acc.account_name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50/80 px-1.5 py-0.5 rounded-xs text-[11px] border border-rose-200/60">
                        Tidak ada di WB 1
                      </span>
                    )}
                  </td>

                  <td className="py-1.5 px-2 text-center font-mono text-[11px] text-slate-500 tabular-nums">
                    {wb1Item?.is_present && (wb1Item.account_coord || wb1Item.coordinate) ? (
                      <div className="inline-flex items-center justify-center gap-1">
                        {wb1Item.account_coord && (
                          <span className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded-xs border border-slate-200" title="Sel Akun">
                            {wb1Item.account_coord}
                          </span>
                        )}
                        {wb1Item.coordinate && (
                          <span className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded-xs border border-slate-200 font-medium" title="Sel Rumus & Nilai">
                            {wb1Item.coordinate}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>

                  {/* Formula (WB 1) */}
                  {displayMode !== 'values' && (
                    <td className="py-1.5 px-2 text-left font-mono text-[11px]">
                      {wb1Item?.is_present ? (
                        wb1ColData.formula ? (
                          <span
                            className="bg-slate-50 text-slate-700 px-1.5 py-0.5 rounded-xs border border-slate-200 select-all inline-block max-w-[190px] truncate"
                            title={wb1ColData.formula}
                          >
                            {wb1ColData.formula}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">
                            Hardcoded
                          </span>
                        )
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  )}

                  {/* Nilai (WB 1) */}
                  {displayMode !== 'formulas' && (
                    <td className="py-1.5 px-2.5 text-right font-mono tabular-nums font-medium text-slate-900">
                      {wb1Item?.is_present ? (
                        formatNumberValue(wb1ColData.value, wb1ColData.formatted)
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  )}

                  {/* Target Workbooks: Nama Akun, Sel, Formula, Nilai */}
                  {targetColumns.map((col, cIdx) => {
                    const tItem = acc.values_by_wb?.[col];
                    const tColData = getColData(acc, col);
                    const isPresentInTgt = tItem?.is_present;
                    const colFStat = acc.formula_statuses?.[col];

                    return (
                      <React.Fragment key={`td-${col}`}>
                        <td className="py-1.5 px-2.5 border-l border-slate-100">
                          {isPresentInTgt ? (
                            <span className={isSummary ? 'font-semibold text-slate-900' : 'text-slate-800'}>
                              {tItem.account_name || acc.account_name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50/80 px-1.5 py-0.5 rounded-xs text-[11px] border border-rose-200/60">
                              Tidak ada di WB {cIdx + 2}
                            </span>
                          )}
                        </td>

                        <td className="py-1.5 px-2 text-center font-mono text-[11px] text-slate-500 tabular-nums">
                          {isPresentInTgt && (tItem.account_coord || tItem.coordinate) ? (
                            <div className="inline-flex items-center justify-center gap-1">
                              {tItem.account_coord && (
                                <span className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded-xs border border-slate-200" title="Sel Akun">
                                  {tItem.account_coord}
                                </span>
                              )}
                              {tItem.coordinate && (
                                <span className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded-xs border border-slate-200 font-medium" title="Sel Rumus & Nilai">
                                  {tItem.coordinate}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Formula (Target WB) */}
                        {displayMode !== 'values' && (
                          <td className="py-1.5 px-2 text-left font-mono text-[11px]">
                            {isPresentInTgt ? (
                              tColData.formula ? (
                                <span
                                  className={`px-1.5 py-0.5 rounded-xs border select-all inline-block max-w-[190px] truncate ${colFStat === 'formula_modified'
                                    ? 'bg-amber-50/80 text-amber-800 border-amber-200'
                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                                    }`}
                                  title={tColData.formula}
                                >
                                  {tColData.formula}
                                </span>
                              ) : (
                                <span
                                  className={`text-[11px] ${colFStat === 'hardcoded_in_target'
                                    ? 'text-rose-600 font-medium bg-rose-50 px-1.5 py-0.5 rounded-xs border border-rose-200'
                                    : 'text-slate-400'
                                    }`}
                                >
                                  Hardcoded
                                </span>
                              )
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        )}

                        {/* Nilai (Target WB) */}
                        {displayMode !== 'formulas' && (
                          <td className="py-1.5 px-2.5 text-right font-mono tabular-nums font-medium text-slate-900">
                            {isPresentInTgt ? (
                              formatNumberValue(tColData.value, tColData.formatted)
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Match Status Badge */}
                  <td className="py-1.5 px-2.5 text-center whitespace-nowrap border-l border-slate-100">
                    {acc.match_status === 'matched' && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Cocok
                      </span>
                    )}
                    {acc.match_status === 'only_in_wb1' && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-rose-700 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Hanya WB 1
                      </span>
                    )}
                    {acc.match_status === 'only_in_wb2' && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Hanya WB 2
                      </span>
                    )}
                    {acc.match_status === 'partial' && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        Parsial
                      </span>
                    )}
                  </td>


                  {/* Formula Status Badge */}
                  {displayMode !== 'values' && (
                    <td className="py-1.5 px-2 text-center border-l border-slate-100 whitespace-nowrap">
                      {fStat === 'hardcoded_in_target' && (
                        <span className="px-1.5 py-0.5 rounded-xs text-[11px] bg-rose-50 text-rose-700 font-medium border border-rose-200">
                          Hardcoded
                        </span>
                      )}
                      {fStat === 'formula_modified' && (
                        <span className="px-1.5 py-0.5 rounded-xs text-[11px] bg-amber-50 text-amber-700 font-medium border border-amber-200">
                          Modified
                        </span>
                      )}
                      {fStat === 'identical' && (
                        <span className="text-[11px] text-slate-500">
                          Identik
                        </span>
                      )}
                      {fStat === 'both_hardcoded' && (
                        <span className="text-[11px] text-slate-400">
                          Input Nilai
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Reusable Deep Formula Diff Inspection Box
  const renderFormulaDiffInspector = () => {
    if (!selectedAccountRow) return null;
    const baseColData = getColData(selectedAccountRow, baselineLabel);

    return (
      <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 flex flex-col gap-2.5 text-xs">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
          <div className="flex items-center gap-2">
            <Code2 size={14} className="text-slate-600" />
            <span className="font-medium text-slate-600">
              Inspeksi Formula: <strong className="text-slate-900">{selectedAccountRow.account_name}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedAccountRow(null)}
            className="text-slate-400 hover:text-slate-700 p-0.5 rounded-xs transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 font-mono text-xs">
          {/* Baseline Card */}
          <div className="bg-white p-2.5 rounded-md border border-slate-200 flex flex-col gap-1.5">
            <div className="font-sans text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>Baseline ({baselineLabel})</span>
              <span className="font-mono text-slate-400">{baseColData.coord || '-'}</span>
            </div>
            <div className="bg-slate-50 p-1.5 rounded-xs border border-slate-200/80 text-slate-800 text-[11px] break-all">
              {baseColData.formula || '(Tidak ada formula / Hardcoded)'}
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-500 font-sans pt-0.5">
              <span>Nilai: <strong className="text-slate-800 font-mono tabular-nums">{formatNumberValue(baseColData.value, baseColData.formatted)}</strong></span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Acuan</span>
            </div>
          </div>

          {/* Comparison Cards */}
          {targetColumns.map((col) => {
            const tData = getColData(selectedAccountRow, col);
            const status = selectedAccountRow.formula_statuses?.[col];
            const isDiff = status === 'formula_modified' || status === 'hardcoded_in_target';

            return (
              <div
                key={col}
                className={`p-2.5 rounded-md border flex flex-col gap-1.5 bg-white ${isDiff ? 'border-amber-300' : 'border-slate-200'
                  }`}
              >
                <div className="font-sans text-[11px] font-medium text-slate-500 flex items-center justify-between">
                  <span>Pembanding ({col})</span>
                  <span className="font-mono text-slate-400">{tData.coord || '-'}</span>
                </div>
                <div
                  className={`p-1.5 rounded-xs border break-all text-[11px] ${status === 'hardcoded_in_target'
                    ? 'bg-rose-50/70 text-rose-800 border-rose-200'
                    : isDiff
                      ? 'bg-amber-50/70 text-amber-900 border-amber-200'
                      : 'bg-slate-50 text-slate-800 border-slate-200/80'
                    }`}
                >
                  {tData.formula || (status === 'hardcoded_in_target' ? 'Rumus Dihapus (Hardcoded Constant)' : '(Tidak ada formula)')}
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-500 font-sans pt-0.5">
                  <span>Nilai: <strong className="text-slate-800 font-mono tabular-nums">{formatNumberValue(tData.value, tData.formatted)}</strong></span>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-medium ${status === 'hardcoded_in_target'
                      ? 'text-rose-600'
                      : isDiff
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                      }`}
                  >
                    {status?.replace(/_/g, ' ') || 'Identik'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <BaseNode
      id={id}
      category="visual"
      icon={BarChart3}
      title="Historical Statement Inspector"
      subtitle={`${accounts.length} Akun • ${statementType.replace('_', ' ').toUpperCase()}`}
      inputs={[
        { id: 'statement_data', label: 'Data', tooltip: 'Data komparasi dari HistoricalStatementNode' },
      ]}
      outputs={[
        { id: 'selected_account', label: 'Account', tooltip: 'Nama akun yang sedang disorot' },
      ]}
      onDelete={() => removeNode(id)}
      onFullscreen={() => setIsFullscreen(true)}
      minWidth="min-w-[560px]"
    >
      {!statement || accounts.length === 0 ? (
        <div className="p-6 text-center text-slate-500 text-xs bg-slate-50/60 border border-dashed border-slate-200 rounded-md flex flex-col items-center gap-2">
          <BarChart3 size={20} className="text-slate-400" />
          <span className="max-w-xs leading-relaxed">
            Hubungkan port <strong className="text-slate-700">Statements</strong> dari <strong className="text-slate-700">Historical Statement Comparator</strong> untuk memeriksa komparasi akun dan formula.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* Top Control Bar: Tabs & Action Buttons */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-200/60 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('table')}
                className={`px-2.5 py-1 rounded-xs transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'table'
                  ? 'bg-white text-slate-900 font-medium shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Table size={12} /> Tabel Komparasi
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('waterfall')}
                className={`px-2.5 py-1 rounded-xs transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'waterfall'
                  ? 'bg-white text-slate-900 font-medium shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <ArrowUpRight size={12} /> Pertumbuhan %
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('common_size')}
                className={`px-2.5 py-1 rounded-xs transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'common_size'
                  ? 'bg-white text-slate-900 font-medium shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Columns size={12} /> Common-Size %
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('formula_audit')}
                className={`px-2.5 py-1 rounded-xs transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'formula_audit'
                  ? 'bg-white text-slate-900 font-medium shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Code2 size={12} /> Audit Formula
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCopyClipboard}
                className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                title="Salin ringkasan ke clipboard"
              >
                {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                title="Unduh format CSV"
              >
                <Download size={12} />
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-colors cursor-pointer"
                title="Buka tabel dalam tampilan Full Screen"
              >
                <Maximize2 size={11} /> Layar Penuh
              </button>
            </div>
          </div>

          {/* Secondary Filter & Configuration Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs">
            {/* Search Input */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari akun..."
                className="w-full pl-7 pr-2.5 py-1 text-xs rounded-md border border-slate-200 bg-white placeholder:text-slate-400 focus:border-slate-400 outline-none transition-colors"
              />
            </div>

            {/* Display Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200/60">
              <button
                type="button"
                onClick={() => setDisplayMode('values')}
                className={`flex-1 py-0.5 rounded-xs text-[11px] transition-all cursor-pointer ${displayMode === 'values' ? 'bg-white text-slate-900 font-medium shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                Nilai
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('both')}
                className={`flex-1 py-0.5 rounded-xs text-[11px] transition-all cursor-pointer ${displayMode === 'both' ? 'bg-white text-slate-900 font-medium shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                Nilai & Formula
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('formulas')}
                className={`flex-1 py-0.5 rounded-xs text-[11px] transition-all cursor-pointer ${displayMode === 'formulas' ? 'bg-white text-slate-900 font-medium shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                Formula
              </button>
            </div>

            {/* Formula Category Filter */}
            <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-slate-200">
              <Filter size={11} className="text-slate-400 shrink-0" />
              <select
                value={formulaFilter}
                onChange={(e) => setFormulaFilter(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-700 font-medium outline-none cursor-pointer"
              >
                <option value="all">Semua Akun ({accounts.length})</option>
                <option value="with_formula">Hanya Berformula</option>
                <option value="anomalies_only">Formula Berbeda / Anomali</option>
                <option value="selected_only">Hanya Terpilih ({selectedRowNames.size})</option>
              </select>
            </div>
          </div>

          {/* Quick Match Status Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-50/80 px-2 py-1 rounded-md border border-slate-200/80">
            <span className="text-slate-500 text-[11px] mr-1">Kecocokan:</span>
            <button
              type="button"
              onClick={() => setMatchFilter('all')}
              className={`px-2 py-0.5 rounded-xs text-[11px] transition-colors cursor-pointer ${matchFilter === 'all'
                ? 'bg-slate-800 text-white font-medium'
                : 'text-slate-600 hover:bg-slate-200/60'
                }`}
            >
              Semua ({accounts.length})
            </button>
            <button
              type="button"
              onClick={() => setMatchFilter('matched')}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[11px] transition-colors cursor-pointer ${matchFilter === 'matched'
                ? 'bg-slate-800 text-white font-medium'
                : 'text-slate-600 hover:bg-slate-200/60'
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Cocok ({statement?.summary?.matched_accounts || 0})
            </button>
            <button
              type="button"
              onClick={() => setMatchFilter('only_wb1')}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[11px] transition-colors cursor-pointer ${matchFilter === 'only_wb1'
                ? 'bg-slate-800 text-white font-medium'
                : 'text-slate-600 hover:bg-slate-200/60'
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Hanya WB 1 ({statement?.summary?.only_in_wb1_count || 0})
            </button>
            <button
              type="button"
              onClick={() => setMatchFilter('only_wb2')}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[11px] transition-colors cursor-pointer ${matchFilter === 'only_wb2'
                ? 'bg-slate-800 text-white font-medium'
                : 'text-slate-600 hover:bg-slate-200/60'
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Hanya WB 2 ({statement?.summary?.only_in_wb2_count || 0})
            </button>
          </div>

          {/* TAB 1: Comparative Table */}
          {activeTab === 'table' && renderComparativeTable(false)}

          {/* TAB 2: Waterfall / Growth % Bars */}
          {activeTab === 'waterfall' && (
            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
              {filteredAccounts.map((acc, idx) => {
                const latestTarget = targetColumns[targetColumns.length - 1];
                const grw = acc.growth_pcts?.[latestTarget];
                if (grw === undefined || grw === null) return null;
                const isPos = grw >= 0;
                const barWidth = Math.min(100, Math.abs(grw));

                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectAccount(acc)}
                    className="p-2 rounded-md border border-slate-200/80 bg-white hover:border-slate-300 transition-colors cursor-pointer flex flex-col gap-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`truncate max-w-[260px] ${acc.is_summary ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                        {acc.account_name}
                      </span>
                      <span
                        className={`font-mono tabular-nums font-medium text-[11px] ${isPos ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                      >
                        {isPos ? '+' : ''}{grw}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${barWidth}%` }}
                        className={`h-full rounded-full transition-all ${isPos ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: Common-Size Analysis */}
          {activeTab === 'common_size' && (
            <div className="overflow-x-auto max-h-72 border border-slate-200 rounded-md bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 sticky top-0 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-1.5 px-2.5">Akun Laporan</th>
                    <th className="py-1.5 px-2.5 text-right font-mono">% of Base ({baselineLabel})</th>
                    {targetColumns.map((col) => (
                      <th key={col} className="py-1.5 px-2.5 text-right font-mono">
                        % of Base ({col})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredAccounts.map((acc, idx) => {
                    const baseItem = acc.values_by_wb?.[baselineLabel];
                    return (
                      <tr
                        key={idx}
                        onClick={() => handleSelectAccount(acc)}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${acc.is_summary ? 'font-semibold bg-slate-50/70 text-slate-900' : 'text-slate-700'
                          }`}
                      >
                        <td className="py-1.5 px-2.5">{acc.account_name}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono tabular-nums text-slate-600">
                          {baseItem?.common_size_pct !== null && baseItem?.common_size_pct !== undefined
                            ? `${baseItem.common_size_pct}%`
                            : '-'}
                        </td>
                        {targetColumns.map((col) => {
                          const tgtItem = acc.values_by_wb?.[col];
                          return (
                            <td key={col} className="py-1.5 px-2.5 text-right font-mono tabular-nums font-medium text-slate-900">
                              {tgtItem?.common_size_pct !== null && tgtItem?.common_size_pct !== undefined
                                ? `${tgtItem.common_size_pct}%`
                                : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: Formula & Integrity Audit */}
          {activeTab === 'formula_audit' && (
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {filteredAccounts
                .filter((a) =>
                  Object.values(a.formula_statuses || {}).some((s) => s === 'hardcoded_in_target' || s === 'formula_modified')
                )
                .map((acc, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectAccount(acc)}
                    className="p-2.5 rounded-md border border-amber-200/90 bg-amber-50/30 flex flex-col gap-1.5 text-xs cursor-pointer hover:border-amber-300 transition-colors"
                  >
                    <div className="flex items-center justify-between font-medium text-slate-900">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle size={13} className="text-amber-600" />
                        {acc.account_name}
                      </span>
                      <span className="text-[11px] text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded-xs font-medium">
                        Anomali Formula
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mt-0.5">
                      <div className="bg-white p-1.5 rounded-xs border border-slate-200">
                        <span className="text-slate-400 block text-[10px] font-sans mb-0.5">Baseline:</span>
                        <span className="text-slate-800 truncate block">
                          {acc.values_by_wb?.[baselineLabel]?.formula || '(Hardcoded / Nilai Mentah)'}
                        </span>
                      </div>
                      <div className="bg-white p-1.5 rounded-xs border border-amber-200">
                        <span className="text-slate-400 block text-[10px] font-sans mb-0.5">Pembanding:</span>
                        <span className="text-amber-800 truncate block">
                          {acc.values_by_wb?.[targetColumns[0]]?.formula || '(Hardcoded Constant)'}
                        </span>
                      </div>
                    </div>
                    {acc.anomalies?.length > 0 && (
                      <p className="text-[11px] text-slate-600">{acc.anomalies[0]}</p>
                    )}
                  </div>
                ))}

              {filteredAccounts.filter((a) =>
                Object.values(a.formula_statuses || {}).some((s) => s === 'hardcoded_in_target' || s === 'formula_modified')
              ).length === 0 && (
                  <div className="p-5 text-center text-slate-500 text-xs bg-slate-50/60 rounded-md border border-dashed border-slate-200 flex items-center justify-center gap-2">
                    <Check size={14} className="text-emerald-600" />
                    <span>Seluruh formula pada akun laporan identik dan konsisten antar workbook.</span>
                  </div>
                )}
            </div>
          )}

          {/* Deep Formula Diff Inspector Drawer (when an account is selected) */}
          {selectedAccountRow && renderFormulaDiffInspector()}
        </div>
      )}

      {/* FULL SCREEN MODAL PORTAL */}
      {isFullscreen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
            onClick={() => setIsFullscreen(false)}
          >
            <div
              className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden font-sans"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-900 rounded-md flex items-center justify-center text-white">
                    <Table size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      Komparasi Historis Laporan Keuangan

                    </h2>
                    <p className="text-xs text-slate-500">
                      Perbandingan berdampingan untuk akun, nilai, dan struktur formula lintas {columns.length} workbook
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyClipboard}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                  >
                    {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    {copied ? 'Tersalin' : 'Salin Teks'}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Download size={13} /> Ekspor CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(false)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer ml-1"
                    title="Tutup (ESC)"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Toolbar Ribbon */}
              <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Search & Period Selector */}
                <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
                  <div className="relative flex-1 max-w-md">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Cari akun laporan keuangan..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs focus:border-slate-400 outline-none transition-colors"
                    />
                  </div>


                </div>

                {/* Display Mode & Filters */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-200/70 p-0.5 rounded-md border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setDisplayMode('values')}
                      className={`px-2.5 py-1 rounded-xs text-xs transition-all cursor-pointer ${displayMode === 'values'
                        ? 'bg-white text-slate-900 font-medium shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      Nilai Saja
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplayMode('both')}
                      className={`px-2.5 py-1 rounded-xs text-xs transition-all cursor-pointer ${displayMode === 'both'
                        ? 'bg-white text-slate-900 font-medium shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      Nilai & Formula
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplayMode('formulas')}
                      className={`px-2.5 py-1 rounded-xs text-xs transition-all cursor-pointer ${displayMode === 'formulas'
                        ? 'bg-white text-slate-900 font-medium shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      Formula Saja
                    </button>
                  </div>

                  <select
                    value={formulaFilter}
                    onChange={(e) => setFormulaFilter(e.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 font-medium outline-none cursor-pointer"
                  >
                    <option value="all">Semua Akun ({accounts.length})</option>
                    <option value="with_formula">Hanya Akun Berformula</option>
                    <option value="anomalies_only">Formula Berbeda / Anomali</option>
                    <option value="selected_only">Hanya Terpilih ({selectedRowNames.size})</option>
                  </select>
                </div>
              </div>

              {/* Modal Body: Table and Detailed Formula Diff Box */}
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 bg-slate-50/30">
                {renderComparativeTable(true)}
                {selectedAccountRow && renderFormulaDiffInspector()}
              </div>

              {/* Modal Footer Info */}
              <div className="px-5 py-2.5 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  <span>
                    Menampilkan <strong className="text-slate-800">{filteredAccounts.length}</strong> dari {accounts.length} akun
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    Terpilih: <strong className="text-slate-800">{selectedRowNames.size}</strong> akun
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400">Tekan ESC untuk menutup</span>
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(false)}
                    className="px-3 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </BaseNode>
  );
}