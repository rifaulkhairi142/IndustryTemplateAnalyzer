import React, { useState, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import { api } from '../services/api';
import {
  ShieldAlert,
  Play,
  RefreshCw,
  Crosshair,
  Layers,
  Table,
  Target,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';

export default function AuditEngineNode({ id, data }) {
  const {
    activeWorkbookId,
    activeSheetName,
    workbooks,
    selectedRange,
    pickTargetNodeId,
    setPickTargetNodeId,
    setHighlights,
    updateNodeData,
    removeNode,
  } = useFlow();

  const [isLoading, setIsLoading] = useState(false);
  const [scopeType, setScopeType] = useState(data.scope_type || (data.range ? 'range' : data.sheet_name ? 'sheet' : 'sheet'));
  const [sheetInput, setSheetInput] = useState(data.inputs?.sheet_name || data.sheet_name || activeSheetName || '');
  const [rangeInput, setRangeInput] = useState(data.inputs?.range || data.range || '');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const effectiveWbId = data.inputs?.workbook_id || data.workbook_id || activeWorkbookId;

  // Find workbook sheets metadata
  const currentWb = workbooks.find((w) => w.workbook_id === effectiveWbId) || workbooks[0];
  const availableSheets = currentWb?.sheets || (activeSheetName ? [activeSheetName] : []);

  // Sync upstream inputs
  useEffect(() => {
    if (data.inputs?.sheet_name && data.inputs.sheet_name !== sheetInput) {
      setSheetInput(data.inputs.sheet_name);
    }
    if (data.inputs?.range && data.inputs.range !== rangeInput) {
      setRangeInput(data.inputs.range);
      setScopeType('range');
    }
  }, [data.inputs?.sheet_name, data.inputs?.range]);

  // Two-way picker from Luckysheet grid
  const isPickActive = pickTargetNodeId === id;
  useEffect(() => {
    if (isPickActive && selectedRange?.coordinate) {
      const cleanRange = selectedRange.coordinate.replace('$', '').trim().toUpperCase();
      setRangeInput(cleanRange);
      setScopeType('range');
      if (selectedRange.sheetName) {
        setSheetInput(selectedRange.sheetName);
      }
      setPickTargetNodeId(null);
    }
  }, [selectedRange, isPickActive, id, setPickTargetNodeId]);

  const auditData = data.audit_data || null;
  const anomalies = auditData?.anomalies || [];

  const handleRunAudit = async () => {
    if (!effectiveWbId) return;
    setIsLoading(true);
    try {
      const targetSheet = scopeType === 'all' ? null : (sheetInput || activeSheetName || null);
      const targetRange = scopeType === 'range' ? (rangeInput ? rangeInput.trim().toUpperCase() : null) : null;

      const res = await api.getAuditAnomalies(effectiveWbId, targetSheet, targetRange);

      // Highlight anomalies on sheet
      const hl = (res.anomalies || []).map((a) => ({
        sheet: a.sheet,
        coordinate: a.coordinate,
        color: a.severity === 'high' ? '#fecdd3' : a.severity === 'medium' ? '#fed7aa' : '#bfdbfe',
        tooltip: `[${a.anomaly_type}] ${a.description}`,
      }));
      setHighlights(hl);

      updateNodeData(id, {
        audit_data: res,
        anomalies_list: res.anomalies || [],
        anomaly_summary: {
          total: res.total_anomalies,
          high: res.high_severity_count,
          medium: res.medium_severity_count,
          low: res.low_severity_count,
        },
        scope_type: scopeType,
        sheet_name: targetSheet,
        range: targetRange,
      });
    } catch (err) {
      console.error('Audit failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAnomaly = (a) => {
    setHighlights([
      {
        sheet: a.sheet,
        coordinate: a.coordinate,
        color: a.severity === 'high' ? '#fecdd3' : a.severity === 'medium' ? '#fed7aa' : '#bfdbfe',
        tooltip: `${a.sheet}!${a.coordinate}: ${a.description}`,
      },
    ]);
  };

  const filteredAnomalies = anomalies.filter((a) => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (typeFilter !== 'all' && a.anomaly_type !== typeFilter) return false;
    return true;
  });

  const getSubtitle = () => {
    if (scopeType === 'all') return 'Seluruh Workbook';
    if (scopeType === 'range' && rangeInput) {
      return `${sheetInput || 'Sheet'}: ${rangeInput}`;
    }
    return sheetInput ? `Sheet: ${sheetInput}` : 'Sheet Aktif';
  };

  return (
    <BaseNode
      id={id}
      category="audit"
      icon={ShieldAlert}
      title="Audit & Anomaly Engine"
      subtitle={getSubtitle()}
      inputs={[
        { id: 'workbook_id', label: 'WB ID', tooltip: 'ID Workbook' },
        { id: 'sheet_name', label: 'Sheet', tooltip: 'Sheet target dari SheetScopeNode' },
        { id: 'range', label: 'Range', tooltip: 'Range target dari CellRangeNode (misal C4:H30)' },
      ]}
      outputs={[
        { id: 'anomalies_list', label: 'Anomalies', tooltip: 'Daftar anomali dan outlier formula' },
        { id: 'anomaly_summary', label: 'Summary', tooltip: 'Ringkasan statistik tingkat keparahan' },
      ]}
      status={isLoading ? 'running' : auditData ? 'success' : 'idle'}
      onDelete={() => removeNode(id)}
      allowFullscreen={true}
      minWidth="min-w-[360px]"
    >
      <div className="flex flex-col gap-2.5 text-xs">
        {/* Scope Mode Selector: Sheet vs Range vs All */}
        <div className="flex flex-col gap-1.5 p-2 rounded-md bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
            <span>Cakupan Audit:</span>
            <div className="flex items-center bg-white rounded border border-slate-200 p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => setScopeType('sheet')}
                className={`px-2 py-0.5 rounded cursor-pointer transition ${
                  scopeType === 'sheet' ? 'bg-slate-800 text-white font-medium' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sheet
              </button>
              <button
                type="button"
                onClick={() => setScopeType('range')}
                className={`px-2 py-0.5 rounded cursor-pointer transition ${
                  scopeType === 'range' ? 'bg-slate-800 text-white font-medium' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Range
              </button>
              <button
                type="button"
                onClick={() => setScopeType('all')}
                className={`px-2 py-0.5 rounded cursor-pointer transition ${
                  scopeType === 'all' ? 'bg-slate-800 text-white font-medium' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
            </div>
          </div>

          {/* Sheet Selector (visible when sheet or range mode) */}
          {scopeType !== 'all' && (
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-500 font-medium w-12 shrink-0">Sheet:</span>
              <select
                value={sheetInput}
                onChange={(e) => setSheetInput(e.target.value)}
                className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 outline-none focus:border-slate-400"
              >
                {availableSheets.map((sh) => (
                  <option key={sh} value={sh}>
                    {sh}
                  </option>
                ))}
                {!availableSheets.includes(sheetInput) && sheetInput && (
                  <option value={sheetInput}>{sheetInput}</option>
                )}
              </select>
            </div>
          )}

          {/* Range Selector & Picker (visible when range mode) */}
          {scopeType === 'range' && (
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-500 font-medium w-12 shrink-0">Range:</span>
              <div className="flex-1 flex items-center gap-1">
                <input
                  type="text"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value.toUpperCase())}
                  placeholder="Misal: C4:H30"
                  className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-mono text-slate-800 outline-none focus:border-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setPickTargetNodeId(isPickActive ? null : id)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold border transition cursor-pointer ${
                    isPickActive
                      ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                  title="Pilih langsung dari tabel spreadsheet (klik atau drag range)"
                >
                  <Crosshair size={11} />
                  <span>{isPickActive ? 'Memilih...' : 'Pilih'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleRunAudit}
          disabled={isLoading || !effectiveWbId}
          className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition cursor-pointer shadow-2xs disabled:opacity-50"
        >
          {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
          <span>Jalankan Audit Formula Sekitar</span>
        </button>

        {/* Audit Results & Breakdown */}
        {auditData && (
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
            {/* Severity Counters Bar */}
            <div className="grid grid-cols-4 gap-1 text-center">
              <div
                onClick={() => setSeverityFilter('all')}
                className={`p-1 rounded border cursor-pointer transition ${
                  severityFilter === 'all' ? 'bg-slate-800 text-white font-bold' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <span className="text-[9px] block">Semua</span>
                <strong className="text-xs">{auditData.total_anomalies || 0}</strong>
              </div>
              <div
                onClick={() => setSeverityFilter(severityFilter === 'high' ? 'all' : 'high')}
                className={`p-1 rounded border cursor-pointer transition ${
                  severityFilter === 'high' ? 'bg-rose-600 text-white font-bold' : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <span className="text-[9px] block">High</span>
                <strong className="text-xs">{auditData.high_severity_count || 0}</strong>
              </div>
              <div
                onClick={() => setSeverityFilter(severityFilter === 'medium' ? 'all' : 'medium')}
                className={`p-1 rounded border cursor-pointer transition ${
                  severityFilter === 'medium' ? 'bg-amber-500 text-white font-bold' : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                <span className="text-[9px] block">Med</span>
                <strong className="text-xs">{auditData.medium_severity_count || 0}</strong>
              </div>
              <div
                onClick={() => setSeverityFilter(severityFilter === 'low' ? 'all' : 'low')}
                className={`p-1 rounded border cursor-pointer transition ${
                  severityFilter === 'low' ? 'bg-blue-600 text-white font-bold' : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}
              >
                <span className="text-[9px] block">Low</span>
                <strong className="text-xs">{auditData.low_severity_count || 0}</strong>
              </div>
            </div>

            {/* Type Filter Dropdown */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none"
            >
              <option value="all">Semua Tipe Isu ({anomalies.length})</option>
              <option value="formula_inconsistency">Pola Formula Berbeda (Outlier Sekitar)</option>
              <option value="hardcoded_in_series">Nilai Hardcoded di Baris/Kolom Formula</option>
              <option value="range_omission">Rentang Penjumlahan Terpotong (Range Omission)</option>
              <option value="embedded_constant">Angka Tetap / Scalar di Formula</option>
              <option value="ref_error">Error Referensi (#REF!, #VALUE!)</option>
              <option value="hidden_reference">Merujuk Sel/Data Tersembunyi</option>
              <option value="external_reference">Tautan Workbook Eksternal</option>
            </select>

            {/* Mini Anomalies List */}
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-0.5">
              {filteredAnomalies.length === 0 ? (
                <div className="p-3 text-center text-slate-400 text-[11px] bg-slate-50 rounded border border-dashed border-slate-200">
                  Tidak ada anomali untuk filter ini.
                </div>
              ) : (
                filteredAnomalies.slice(0, 50).map((a, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectAnomaly(a)}
                    className="p-2 rounded border border-slate-200 bg-white hover:bg-rose-50/20 hover:border-rose-300 transition-colors cursor-pointer flex flex-col gap-1 text-[11px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-800">
                        {a.sheet}!{a.coordinate}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                          a.severity === 'high'
                            ? 'bg-rose-100 text-rose-800'
                            : a.severity === 'medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {a.anomaly_type.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-600 line-clamp-2 leading-tight">
                      {a.description}
                    </p>

                    {/* Formula comparison */}
                    {(a.formula || a.expected_formula) && (
                      <div className="flex flex-col gap-0.5 text-[9px] font-mono bg-slate-50 p-1 rounded border border-slate-100">
                        {a.formula && (
                          <div className="text-rose-700 truncate">
                            <span className="font-bold text-rose-500">Aktual: </span>{a.formula}
                          </div>
                        )}
                        {a.expected_formula && (
                          <div className="text-emerald-700 truncate">
                            <span className="font-bold text-emerald-600">Sekitar: </span>{a.expected_formula}
                          </div>
                        )}
                      </div>
                    )}

                    {a.neighbor_summary && (
                      <div className="text-[9px] text-slate-500 font-mono truncate">
                        {a.neighbor_summary}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {filteredAnomalies.length > 50 && (
              <div className="text-[10px] text-slate-400 text-center py-1">
                Menampilkan 50 dari {filteredAnomalies.length} anomali. Hubungkan ke AuditInspectorNode untuk daftar lengkap.
              </div>
            )}
          </div>
        )}
      </div>
    </BaseNode>
  );
}
