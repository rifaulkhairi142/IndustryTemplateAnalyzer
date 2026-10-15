import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import { api } from '../services/api';
import {
  TrendingUp,
  Plus,
  Trash2,
  Play,
  Crosshair,
  Layers,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Maximize2,
  Table,
  X,
  Search,
  Download,
  Filter,
} from 'lucide-react';

export default function HistoricalStatementNode({ id, data }) {
  const {
    workbooks,
    selectedRange,
    pickTargetNodeId,
    setPickTargetNodeId,
    setHighlights,
    updateNodeData,
    removeNode,
  } = useFlow();

  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [statementType, setStatementType] = useState(data.statement_type || 'income_statement');
  const [alignmentMode, setAlignmentMode] = useState(data.alignment_mode || 'account_name');
  const [baselineIndex, setBaselineIndex] = useState(data.baseline_index || 0);

  // Filter & Search state for account comparison
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'matched' | 'only_wb1' | 'only_wb2'
  const [searchTerm, setSearchTerm] = useState('');

  // Helper to format values with thousand separators without currency symbol ($)
  const formatCleanNumber = (val, formatted) => {
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

  // Helper to determine best matching sheet name for statement type
  const getPreferredSheet = (sheets, type) => {
    if (!sheets || !sheets.length) return 'Income Statement';
    let target = 'Income Statement';
    if (type === 'balance_sheet') target = 'Balance Sheet';
    if (type === 'cashflow') target = 'Cash Flow';

    if (sheets.includes(target)) return target;
    const lower = target.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = sheets.find((s) => s.toLowerCase().replace(/[^a-z0-9]/g, '').includes(lower));
    if (found) return found;
    return sheets[0];
  };

  // Initialize comparison items (minimum 2 workbooks)
  const defaultItems = [
    {
      workbook_id: data.inputs?.wb_1_id || data.inputs?.workbook_id || data.items?.[0]?.workbook_id || workbooks[0]?.workbook_id || 'sample_v1',
      sheet_name: data.items?.[0]?.sheet_name || 'Income Statement',
      range: data.inputs?.range || data.inputs?.coordinate || data.items?.[0]?.range || '',
      formula_range: data.items?.[0]?.formula_range || '',
      label: data.items?.[0]?.label && !data.items[0].label.startsWith('FY ') ? data.items[0].label : 'Workbook 1',
    },
    {
      workbook_id: data.inputs?.wb_2_id || data.items?.[1]?.workbook_id || (workbooks.length > 1 ? workbooks[1]?.workbook_id : 'sample_v2'),
      sheet_name: data.items?.[1]?.sheet_name || 'Income Statement',
      range: data.items?.[1]?.range || '',
      formula_range: data.items?.[1]?.formula_range || '',
      label: data.items?.[1]?.label && !data.items[1].label.startsWith('FY ') ? data.items[1].label : 'Workbook 2',
    },
  ];

  const [items, setItems] = useState(data.items && data.items.length >= 2 ? data.items : defaultItems);
  const [activePickTarget, setActivePickTarget] = useState({ rowIndex: null, field: null });

  // Synchronize upstream inputs from connected nodes (WorkbookSourceNode, SheetScopeNode, CellRangeNode)
  useEffect(() => {
    const upstreamWb1 = data.inputs?.wb_1_id || data.inputs?.workbook_id;
    const upstreamWb2 = data.inputs?.wb_2_id;
    const upstreamRange = data.inputs?.range || data.inputs?.coordinate;
    const upstreamSheet = data.inputs?.sheet_name;

    setItems((prev) => {
      let hasChanged = false;
      const next = [...prev];

      // Sync Workbook 1 if connected via edge
      if (upstreamWb1 && next[0]?.workbook_id !== upstreamWb1) {
        const wbObj1 = workbooks.find((w) => w.workbook_id === upstreamWb1);
        const autoSheet1 = getPreferredSheet(wbObj1?.sheets, statementType);
        next[0] = {
          ...next[0],
          workbook_id: upstreamWb1,
          sheet_name: wbObj1?.sheets?.includes(next[0].sheet_name) ? next[0].sheet_name : autoSheet1,
          label: wbObj1?.filename ? wbObj1.filename.replace(/\.xlsx$/i, '') : next[0].label,
        };
        hasChanged = true;
      }

      // Sync Workbook 2 if connected via edge
      if (upstreamWb2 && next[1]?.workbook_id !== upstreamWb2) {
        const wbObj2 = workbooks.find((w) => w.workbook_id === upstreamWb2);
        const autoSheet2 = getPreferredSheet(wbObj2?.sheets, statementType);
        next[1] = {
          ...next[1],
          workbook_id: upstreamWb2,
          sheet_name: wbObj2?.sheets?.includes(next[1].sheet_name) ? next[1].sheet_name : autoSheet2,
          label: wbObj2?.filename ? wbObj2.filename.replace(/\.xlsx$/i, '') : next[1].label,
        };
        hasChanged = true;
      }

      // Sync Range from CellRangeNode
      if (upstreamRange) {
        const cleanRange = upstreamRange.replace('$', '').trim().toUpperCase();
        if (next[0] && next[0].range !== cleanRange) {
          next[0] = { ...next[0], range: cleanRange };
          hasChanged = true;
        }
        if (next[1] && !next[1].range) {
          next[1] = { ...next[1], range: cleanRange };
          hasChanged = true;
        }
      }

      // Sync Sheet Name from SheetScopeNode
      if (upstreamSheet) {
        if (next[0] && next[0].sheet_name !== upstreamSheet) {
          next[0] = { ...next[0], sheet_name: upstreamSheet };
          hasChanged = true;
        }
      }

      if (hasChanged) {
        updateNodeData(id, { items: next });
        return next;
      }
      return prev;
    });
  }, [
    data.inputs?.wb_1_id,
    data.inputs?.wb_2_id,
    data.inputs?.workbook_id,
    data.inputs?.range,
    data.inputs?.coordinate,
    data.inputs?.sheet_name,
    workbooks,
    statementType,
    id,
    updateNodeData,
  ]);

  // Handle two-way pick from spreadsheet grid
  const isPickActive = pickTargetNodeId === id;
  useEffect(() => {
    if (isPickActive && selectedRange?.coordinate && activePickTarget.rowIndex !== null) {
      setItems((prev) => {
        const next = [...prev];
        const targetRow = next[activePickTarget.rowIndex];
        if (targetRow) {
          const field = activePickTarget.field || 'range';
          targetRow[field] = selectedRange.coordinate;
          if (selectedRange.sheetName) {
            targetRow.sheet_name = selectedRange.sheetName;
          }
        }
        return next;
      });
      setPickTargetNodeId(null);
      setActivePickTarget({ rowIndex: null, field: null });
    }
  }, [selectedRange, isPickActive, activePickTarget, setPickTargetNodeId, id]);

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

  // Synchronize statement type across item sheets
  const handleStatementTypeChange = (type) => {
    setStatementType(type);
    let targetSheetName = 'Income Statement';
    if (type === 'balance_sheet') targetSheetName = 'Balance Sheet';
    if (type === 'cashflow') targetSheetName = 'Cash Flow';

    setItems((prev) =>
      prev.map((it) => {
        const wb = workbooks.find((w) => w.workbook_id === it.workbook_id);
        const hasMatchingSheet = wb?.sheets?.includes(targetSheetName);
        return {
          ...it,
          sheet_name: hasMatchingSheet ? targetSheetName : (wb?.sheets?.[0] || it.sheet_name),
        };
      })
    );
  };

  const handleAddItem = () => {
    const nextIdx = items.length + 1;
    const defaultWb = workbooks[Math.min(items.length, workbooks.length - 1)] || workbooks[0];
    let sheetName = 'Income Statement';
    if (statementType === 'balance_sheet') sheetName = 'Balance Sheet';
    if (statementType === 'cashflow') sheetName = 'Cash Flow';

    const newItem = {
      workbook_id: defaultWb?.workbook_id || '',
      sheet_name: defaultWb?.sheets?.includes(sheetName) ? sheetName : (defaultWb?.sheets?.[0] || ''),
      range: '',
      formula_range: '',
      label: `Workbook ${nextIdx}`,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 2) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (baselineIndex >= index && baselineIndex > 0) {
      setBaselineIndex(baselineIndex - 1);
    }
  };

  const handleUpdateItem = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleStartPick = (rowIdx, field = 'range') => {
    setActivePickTarget({ rowIndex: rowIdx, field });
    setPickTargetNodeId(id);
  };

  const handleRunComparison = async () => {
    if (items.length < 2) return;
    setIsLoading(true);
    try {
      const payload = {
        statement_type: statementType,
        items: items.map((it, idx) => ({
          workbook_id: it.workbook_id,
          sheet_name: it.sheet_name,
          range: it.range?.trim() || null,
          formula_range: it.formula_range?.trim() || null,
          label: it.label?.trim() || `Workbook ${idx + 1}`,
        })),
        alignment_mode: alignmentMode,
        baseline_index: baselineIndex,
      };

      const res = await api.compareHistoricalStatements(payload);

      // Push highlights to Luckysheet
      if (res.highlights && res.highlights.length > 0) {
        setHighlights(res.highlights);
      }

      updateNodeData(id, {
        comparison_result: res,
        statement_data: res,
        variance_summary: res.summary,
        highlights: res.highlights || [],
        statement_type: statementType,
        alignment_mode: alignmentMode,
        baseline_index: baselineIndex,
        items,
      });
    } catch (err) {
      console.error('Failed to compare accounts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const comparisonResult = data.comparison_result || null;
  const summary = comparisonResult?.summary || null;
  const workbooksInfo = comparisonResult?.workbooks_info || [];
  const accounts = comparisonResult?.accounts || [];

  // Filtered accounts list for rendering
  const filteredAccounts = useMemo(() => {
    if (!accounts.length) return [];
    return accounts.filter((acc) => {
      // Text search filter
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches =
          acc.account_name?.toLowerCase().includes(q) ||
          acc.normalized_name?.toLowerCase().includes(q) ||
          Object.values(acc.values_by_wb || {}).some((v) => v.account_name?.toLowerCase().includes(q));
        if (!matches) return false;
      }
      // Status filter
      if (filterMode === 'matched') return acc.match_status === 'matched';
      if (filterMode === 'only_wb1') return acc.match_status === 'only_in_wb1';
      if (filterMode === 'only_wb2') return acc.match_status === 'only_in_wb2';
      return true;
    });
  }, [accounts, searchTerm, filterMode]);

  // Export CSV of reconciliation
  const handleExportCSV = () => {
    if (!accounts.length) return;
    const wb1 = workbooksInfo[0] || {};
    const wb2 = workbooksInfo[1] || {};
    const headers = [
      'Status Rekonsiliasi',
      'Nama Akun Master',
      `WB 1 (${wb1.filename || 'WB 1'}) Akun`,
      `WB 1 Sheet`,
      `WB 1 Range Akun`,
      `WB 1 Range Formula`,
      `WB 1 Sel Akun`,
      `WB 1 Sel Formula`,
      `WB 1 Formula/Rumus`,
      `WB 1 Nilai`,
      `WB 2 (${wb2.filename || 'WB 2'}) Akun`,
      `WB 2 Sheet`,
      `WB 2 Range Akun`,
      `WB 2 Range Formula`,
      `WB 2 Sel Akun`,
      `WB 2 Sel Formula`,
      `WB 2 Formula/Rumus`,
      `WB 2 Nilai`,
      `Selisih Nilai (Δ)`,
      `Persentase Selisih (%)`,
    ];

    const rows = filteredAccounts.map((a) => {
      const v1 = a.values_by_wb?.[wb1.label] || {};
      const v2 = a.values_by_wb?.[wb2.label] || {};
      const diff = v1.value !== null && v2.value !== null && v1.value !== undefined && v2.value !== undefined
        ? Number(v2.value) - Number(v1.value)
        : '';
      const pct = diff !== '' && v1.value
        ? ((diff / Math.abs(v1.value)) * 100).toFixed(2) + '%'
        : '';

      return [
        `"${a.match_status === 'matched' ? 'Cocok di Semua WB' : a.match_status === 'only_in_wb1' ? 'Hanya di WB 1' : 'Hanya di WB 2'}"`,
        `"${a.account_name}"`,
        `"${v1.is_present ? v1.account_name || a.account_name : 'Tidak Ada'}"`,
        `"${v1.sheet_name || wb1.sheet_name || ''}"`,
        `"${v1.range || wb1.range || 'Auto'}"`,
        `"${v1.formula_range || wb1.formula_range || 'Auto'}"`,
        `"${v1.account_coord || '-'}"`,
        `"${v1.coordinate || '-'}"`,
        `"${v1.formula || (v1.is_present ? 'Hardcoded' : '-')}"`,
        v1.value !== null && v1.value !== undefined ? v1.value : '',
        `"${v2.is_present ? v2.account_name || a.account_name : 'Tidak Ada'}"`,
        `"${v2.sheet_name || wb2.sheet_name || ''}"`,
        `"${v2.range || wb2.range || 'Auto'}"`,
        `"${v2.formula_range || wb2.formula_range || 'Auto'}"`,
        `"${v2.account_coord || '-'}"`,
        `"${v2.coordinate || '-'}"`,
        `"${v2.formula || (v2.is_present ? 'Hardcoded' : '-')}"`,
        v2.value !== null && v2.value !== undefined ? v2.value : '',
        diff,
        `"${pct}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rekonsiliasi_akun_${statementType}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <BaseNode
      id={id}
      category="compare"
      icon={TrendingUp}
      title="Rekonsiliasi & Komparasi Akun"
      subtitle={`${statementType.replace('_', ' ').toUpperCase()} • ${items.length} Workbooks`}
      inputs={[
        { id: 'wb_1_id', label: 'WB 1', tooltip: 'Workbook 1 ID (Workbook Utama / Baseline)' },
        { id: 'wb_2_id', label: 'WB 2', tooltip: 'Workbook 2 ID (Workbook Pembanding)' },
        { id: 'workbook_id', label: 'WB ID', tooltip: 'Workbook ID alternatif untuk WB 1' },
        { id: 'sheet_name', label: 'Sheet', tooltip: 'Sheet target untuk laporan' },
        { id: 'range', label: 'Range', tooltip: 'Target range statement' },
      ]}
      outputs={[
        { id: 'statement_data', label: 'Statements', tooltip: 'Data rekonsiliasi akun & nilai' },
        { id: 'variance_summary', label: 'KPIs', tooltip: 'Rangkuman kecocokan & akun gap' },
        { id: 'highlights', label: 'Grid HL', tooltip: 'Highlights untuk spreadsheet viewer' },
      ]}
      status={isLoading ? 'running' : comparisonResult ? 'success' : 'idle'}
      onDelete={() => removeNode(id)}
      onFullscreen={comparisonResult ? () => setIsFullscreen(true) : undefined}
      minWidth="min-w-[440px]"
    >
      <div className="flex flex-col gap-2.5">


        {/* Multi-Workbook Statement Items List */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Workbooks & Sheets Pembanding ({items.length}):
            </label>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition cursor-pointer"
            >
              <Plus size={12} /> Tambah Workbook
            </button>
          </div>

          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-0.5">
            {items.map((it, idx) => {
              const wbEntry = workbooks.find((w) => w.workbook_id === it.workbook_id);
              const isThisRowPickingAccount = isPickActive && activePickTarget.rowIndex === idx && activePickTarget.field === 'range';
              const isThisRowPickingFormula = isPickActive && activePickTarget.rowIndex === idx && activePickTarget.field === 'formula_range';

              return (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/80 hover:border-slate-300 transition text-[11px] flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[11px] text-emerald-800 bg-emerald-100/70 px-1.5 py-0.2 rounded border border-emerald-200">
                        Workbook #{idx + 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={it.label}
                        onChange={(e) => handleUpdateItem(idx, 'label', e.target.value)}
                        placeholder={`Label (e.g. Workbook ${idx + 1})`}
                        className="font-semibold text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] w-32 truncate"
                      />
                      {items.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 transition cursor-pointer"
                          title="Hapus pembanding"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {/* Workbook selector */}
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-slate-500 font-medium">Workbook File:</span>
                      </div>
                      <select
                        value={it.workbook_id}
                        disabled
                        onChange={(e) => {
                          const newWbId = e.target.value;
                          const newWb = workbooks.find((w) => w.workbook_id === newWbId);
                          handleUpdateItem(idx, 'workbook_id', newWbId);
                          if (newWb?.sheets?.length) {
                            handleUpdateItem(idx, 'sheet_name', getPreferredSheet(newWb.sheets, statementType));
                          }
                        }}
                        className={`rounded border px-1.5 py-1 text-[11px] truncate transition ${((idx === 0 && (data.inputs?.wb_1_id || data.inputs?.workbook_id)) || (idx === 1 && data.inputs?.wb_2_id))
                          ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950 font-semibold shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-800'
                          }`}
                      >
                        {workbooks.map((w) => (
                          <option key={w.workbook_id} value={w.workbook_id}>
                            {w.filename}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Sheet selector */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] text-slate-500 font-medium">Sheet Laporan:</span>
                      <select
                        value={it.sheet_name}
                        onChange={(e) => handleUpdateItem(idx, 'sheet_name', e.target.value)}
                        className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-800 truncate"
                      >
                        {(wbEntry?.sheets || [it.sheet_name]).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Range Akun selector & pick */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-600 font-semibold shrink-0 w-20">Range Akun:</span>
                    <input
                      type="text"
                      value={it.range || ''}
                      onChange={(e) => handleUpdateItem(idx, 'range', e.target.value)}
                      placeholder="e.g. C16:C99 (Kolom nama akun)"
                      className="flex-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] uppercase text-slate-800 placeholder:text-slate-400 focus:outline-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleStartPick(idx, 'range')}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer shadow-2xs ${isThisRowPickingAccount
                        ? 'bg-amber-500 text-white animate-pulse'
                        : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-50'
                        }`}
                      title="Pilih range akun langsung dari spreadsheet viewer"
                    >
                      <Crosshair size={10} /> Pick Akun
                    </button>
                  </div>

                  {/* Range Formula & Nilai selector & pick */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-600 font-semibold shrink-0 w-20">Range Rumus:</span>
                    <input
                      type="text"
                      value={it.formula_range || ''}
                      onChange={(e) => handleUpdateItem(idx, 'formula_range', e.target.value)}
                      placeholder="e.g. E16:E99 (Rumus & Nilai periode)"
                      className="flex-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] uppercase text-slate-800 placeholder:text-slate-400 focus:outline-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleStartPick(idx, 'formula_range')}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer shadow-2xs ${isThisRowPickingFormula
                        ? 'bg-amber-500 text-white animate-pulse'
                        : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      title="Pilih range formula/rumus langsung dari spreadsheet viewer"
                    >
                      <Crosshair size={10} /> Pick Rumus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alignment Mode & Execution */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 font-medium text-[10px]">Pencocokan:</span>
            <select
              value={alignmentMode}
              onChange={(e) => setAlignmentMode(e.target.value)}
              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-700"
            >
              <option value="account_name">Cocokkan Berdasarkan Nama Akun (Smart Matching)</option>
              <option value="coordinate">Koordinat Sel Persis</option>
              <option value="row_order">Urutan Baris Laporan</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleRunComparison}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 transition cursor-pointer shadow-sm disabled:opacity-50"
          >
            <Play size={13} />
            {isLoading ? 'Mencocokkan...' : 'Bandingkan & Rekonsiliasi'}
          </button>
        </div>


      </div>

      {/* FULL SCREEN MODAL PORTAL */}
      {isFullscreen && comparisonResult &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
            onClick={() => setIsFullscreen(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden font-sans"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-sm">
                    <Table size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      Rekonsiliasi & Pencocokan Akun Laporan Keuangan
                      <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        {statementType.replace('_', ' ')}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Membandingkan keberadaan akun, posisi sel (koordinat), dan nilai antar template workbook Excel
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer"
                  >
                    <Download size={13} /> Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    title="Tutup (ESC)"
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>

              {/* Toolbar: Filter Tabs & Search Bar */}
              <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1 rounded-md transition cursor-pointer ${filterMode === 'all'
                      ? 'bg-slate-800 text-white shadow-2xs font-bold'
                      : 'text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    Semua Akun ({accounts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('matched')}
                    className={`px-3 py-1 rounded-md transition cursor-pointer ${filterMode === 'matched'
                      ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                      : 'text-emerald-700 hover:bg-emerald-100'
                      }`}
                  >
                    🟢 Cocok di Semua Workbook ({summary?.matched_accounts || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('only_wb1')}
                    className={`px-3 py-1 rounded-md transition cursor-pointer ${filterMode === 'only_wb1'
                      ? 'bg-rose-600 text-white shadow-2xs font-bold'
                      : 'text-rose-700 hover:bg-rose-100'
                      }`}
                  >
                    🔴 Hanya di WB 1 ({summary?.only_in_wb1_count || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('only_wb2')}
                    className={`px-3 py-1 rounded-md transition cursor-pointer ${filterMode === 'only_wb2'
                      ? 'bg-amber-600 text-white shadow-2xs font-bold'
                      : 'text-amber-700 hover:bg-amber-100'
                      }`}
                  >
                    🟠 Hanya di WB 2 ({summary?.only_in_wb2_count || 0})
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative min-w-[260px]">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari nama akun..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Modal Body: Interactive Side-by-Side Account Reconciliation Table */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[66vh] shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                    <thead className="bg-slate-100 text-slate-800 sticky top-0 z-10 font-bold border-b border-slate-200 shadow-2xs">
                      {/* Top Master Header: Workbook identities */}
                      <tr className="border-b border-slate-200 text-[11px]  bg-slate-200/90">
                        {/* WB Header */}
                        {workbooksInfo.map((wb, wIdx) => (
                          <th
                            key={wb.label}
                            colSpan={4}
                            className={`py-2 px-3 text-center border-l ${wIdx === 0
                              ? 'bg-blue-100/90 text-blue-950 border-blue-200'
                              : 'bg-emerald-100/90 text-emerald-950 border-emerald-200'
                              }`}
                          >
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-extrabold text-xs">
                                KOLOM {wIdx + 1}: Workbook {wIdx + 1} ({wb.filename})
                              </span>
                              <span className="text-[10px] font-normal opacity-85">
                                Sheet: <strong>{wb.sheet_name}</strong> • Range Akun:{' '}
                                <strong>{wb.range || 'Auto'}</strong> • Range Rumus:{' '}
                                <strong>{wb.formula_range || 'Auto'}</strong>
                              </span>
                            </div>
                          </th>
                        ))}

                        {/* Match Status Header */}
                        <th className="py-2.5 px-3 min-w-[170px] bg-slate-200 text-slate-800 border-l border-slate-300 text-center">
                          Sistem Pencocokan Akun
                        </th>

                        {/* Variance Header */}
                        <th colSpan={2} className="py-2 px-3 text-center bg-slate-100 border-l border-slate-300 text-slate-800">
                          Selisih Nilai (Variance)
                        </th>
                      </tr>

                      {/* Sub-Header Row: Account details */}
                      <tr className="bg-slate-100 text-[11px] text-slate-600 border-b border-slate-200">
                        {workbooksInfo.map((wb, wIdx) => (
                          <React.Fragment key={`subhdr-${wb.label}`}>
                            <th className={`py-1.5 px-2.5 font-medium border-l ${wIdx === 0 ? 'bg-blue-50/70 border-blue-100' : 'bg-emerald-50/70 border-emerald-100'}`}>
                              Nama Akun (WB {wIdx + 1})
                            </th>
                            <th className={`py-1.5 px-2 text-center font-mono ${wIdx === 0 ? 'bg-blue-50/70' : 'bg-emerald-50/70'}`}>
                              Sel Akun
                            </th>
                            <th className={`py-1.5 px-2 text-left font-mono ${wIdx === 0 ? 'bg-blue-50/70' : 'bg-emerald-50/70'}`}>
                              Sel & Rumus
                            </th>
                            <th className={`py-1.5 px-2.5 text-right font-mono ${wIdx === 0 ? 'bg-blue-50/70' : 'bg-emerald-50/70'}`}>
                              Nilai
                            </th>
                          </React.Fragment>
                        ))}

                        <th className="py-1.5 px-2.5 text-center font-medium border-l border-slate-200">
                          Status Pencocokan
                        </th>
                        <th className="py-1.5 px-2.5 text-right font-mono border-l border-slate-200">Δ Nominal</th>
                        <th className="py-1.5 px-2.5 text-right font-mono">Selisih %</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredAccounts.map((acc, idx) => {
                        const isSummary = acc.is_summary;
                        const wb1Info = workbooksInfo[0] || {};
                        const wb2Info = workbooksInfo[1] || {};
                        const v1 = acc.values_by_wb?.[wb1Info.label];
                        const v2 = acc.values_by_wb?.[wb2Info.label];
                        const hasBoth = v1?.is_present && v2?.is_present && v1.value !== null && v2.value !== null;
                        const diff = hasBoth ? Number(v2.value) - Number(v1.value) : null;
                        const pct = hasBoth && v1.value !== 0 ? ((diff / Math.abs(v1.value)) * 100).toFixed(1) : null;

                        return (
                          <tr
                            key={idx}
                            className={`transition ${isSummary
                              ? 'bg-slate-50/80 font-bold text-slate-900'
                              : acc.match_status === 'only_in_wb1'
                                ? 'bg-rose-50/30 hover:bg-rose-50/60'
                                : acc.match_status === 'only_in_wb2'
                                  ? 'bg-amber-50/30 hover:bg-amber-50/60'
                                  : 'hover:bg-slate-50/80 text-slate-700'
                              }`}
                          >
                            {/* WB Columns */}
                            {workbooksInfo.map((wb, wIdx) => {
                              const valItem = acc.values_by_wb?.[wb.label];
                              const isPresent = valItem?.is_present;

                              return (
                                <React.Fragment key={`td-${wb.label}`}>
                                  {/* Account Name in WB */}
                                  <td className={`py-2 px-2.5 border-l ${wIdx === 0 ? 'border-blue-100' : 'border-emerald-100'}`}>
                                    {isPresent ? (
                                      <span className="font-semibold text-slate-800">
                                        {valItem.account_name || acc.account_name}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                        ❌ Tidak Ada di Workbook {wIdx + 1}
                                      </span>
                                    )}
                                  </td>

                                  {/* Account Coordinate in WB */}
                                  <td className="py-2 px-2 text-center font-mono text-[10px]">
                                    {isPresent && valItem?.account_coord ? (
                                      <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 font-bold">
                                        {valItem.account_coord}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">-</span>
                                    )}
                                  </td>

                                  {/* Formula Coordinate & Formula in WB */}
                                  <td className="py-2 px-2 font-mono text-[10px]">
                                    {isPresent && (valItem?.coordinate || valItem?.formula) ? (
                                      <div className="flex flex-col gap-0.5 max-w-[170px]">
                                        <div className="flex items-center gap-1">
                                          <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200 font-bold text-[9px]">
                                            {valItem.coordinate || '-'}
                                          </span>
                                          {!valItem.formula && (
                                            <span className="text-[9px] text-slate-400 italic">
                                              Hardcoded
                                            </span>
                                          )}
                                        </div>
                                        {valItem.formula && (
                                          <span className="text-[9px] text-slate-600 truncate font-mono bg-slate-50 px-1 py-0.5 rounded border border-slate-200" title={valItem.formula}>
                                            {valItem.formula}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-300">-</span>
                                    )}
                                  </td>

                                  {/* Value in WB */}
                                  <td className="py-2 px-2.5 text-right font-mono text-xs">
                                    {isPresent && valItem.value !== null && valItem.value !== undefined ? (
                                      <span className="font-bold text-slate-900">
                                        {formatCleanNumber(valItem.value, valItem.formatted_value)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">-</span>
                                    )}
                                  </td>
                                </React.Fragment>
                              );
                            })}

                            {/* Match Status Badge */}
                            <td className="py-2.5 px-3 border-l border-slate-200 text-center whitespace-nowrap">
                              {acc.match_status === 'matched' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  🟢 Cocok di Kedua Workbook
                                </span>
                              )}
                              {acc.match_status === 'only_in_wb1' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                  🔴 Hanya di Workbook 1
                                </span>
                              )}
                              {acc.match_status === 'only_in_wb2' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  🟠 Hanya di Workbook 2
                                </span>
                              )}
                              {acc.match_status === 'partial' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                                  🟣 Parsial ({acc.present_in_wbs?.length}/{workbooksInfo.length} WB)
                                </span>
                              )}
                            </td>

                            {/* Variance Δ */}
                            <td className="py-2 px-2.5 text-right font-mono border-l border-slate-200">
                              {diff !== null ? (
                                <span className={`font-semibold ${diff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {diff >= 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-slate-300 italic text-[10px]">-</span>
                              )}
                            </td>

                            {/* Variance % */}
                            <td className="py-2 px-2.5 text-right font-mono">
                              {pct !== null ? (
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.2 rounded font-bold text-[10px] ${Number(pct) >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                    }`}
                                >
                                  {Number(pct) >= 0 ? '+' : ''}{pct}%
                                </span>
                              ) : (
                                <span className="text-slate-300 italic text-[10px]">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Menampilkan <strong>{filteredAccounts.length}</strong> dari <strong>{accounts.length}</strong> akun terdaftar
                </span>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Tutup Layar Penuh
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </BaseNode>
  );
}
