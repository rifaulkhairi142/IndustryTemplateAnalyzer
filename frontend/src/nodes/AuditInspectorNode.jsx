import React, { useState, useMemo } from 'react';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import {
  ShieldAlert,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Search,
  Filter,
  Table as TableIcon,
  LayoutGrid,
  Copy,
  Check,
  Eye,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';

export default function AuditInspectorNode({ id, data }) {
  const { setHighlights, updateNodeData, removeNode } = useFlow();

  const [severity, setSeverity] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [copiedIndex, setCopiedIndex] = useState(null);

  const rawAnomalies = data.inputs?.anomalies_list ?? data.anomalies_list;
  const anomalies = Array.isArray(rawAnomalies) ? rawAnomalies : [];

  const filtered = useMemo(() => {
    return anomalies.filter((a) => {
      if (severity !== 'all' && a.severity !== severity) return false;
      if (typeFilter !== 'all' && a.anomaly_type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const coord = (a.coordinate || '').toLowerCase();
        const sheet = (a.sheet || '').toLowerCase();
        const desc = (a.description || '').toLowerCase();
        const formula = (a.formula || '').toLowerCase();
        const exp = (a.expected_formula || '').toLowerCase();
        if (!coord.includes(q) && !sheet.includes(q) && !desc.includes(q) && !formula.includes(q) && !exp.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [anomalies, severity, typeFilter, searchQuery]);

  const handleSelectAnomaly = (a) => {
    setHighlights([
      {
        sheet: a.sheet,
        coordinate: a.coordinate,
        color: a.severity === 'high' ? '#fecdd3' : a.severity === 'medium' ? '#fed7aa' : '#bfdbfe',
        tooltip: `[${a.anomaly_type}] ${a.description}`,
      },
    ]);

    updateNodeData(id, {
      selected_anomaly_coord: a.coordinate,
      selected_anomaly: a,
    });
  };

  const handleCopyFormula = (text, idx) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getTypeLabel = (t) => {
    switch (t) {
      case 'formula_inconsistency':
        return 'Pola Berbeda (Outlier)';
      case 'hardcoded_in_series':
        return 'Nilai Hardcoded';
      case 'range_omission':
        return 'Range Terpotong (SUM)';
      case 'embedded_constant':
        return 'Konstanta Scalar';
      case 'ref_error':
        return 'Error Referensi';
      case 'hidden_reference':
        return 'Data Tersembunyi';
      case 'external_reference':
        return 'Tautan Eksternal';
      default:
        return (t || 'Anomali').replace(/_/g, ' ');
    }
  };

  const highCount = anomalies.filter((a) => a.severity === 'high').length;
  const medCount = anomalies.filter((a) => a.severity === 'medium').length;
  const lowCount = anomalies.filter((a) => a.severity === 'low').length;

  return (
    <BaseNode
      id={id}
      category="audit"
      icon={ShieldAlert}
      title="Audit Inspector Cards"
      subtitle={`${anomalies.length} Isu Terdeteksi`}
      inputs={[
        { id: 'anomalies_list', label: 'Anomalies', tooltip: 'Daftar anomali dari AuditEngineNode' },
      ]}
      outputs={[
        { id: 'selected_anomaly_coord', label: 'Cell', tooltip: 'Koordinat sel anomali yang dipilih' },
      ]}
      onDelete={() => removeNode(id)}
      allowFullscreen={true}
      minWidth="min-w-[380px]"
    >
      {anomalies.length === 0 ? (
        <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 border border-dashed border-slate-200 rounded-lg flex flex-col items-center gap-2">
          <ShieldAlert className="text-slate-300" size={28} />
          <span>Hubungkan port <strong>Anomalies</strong> dari <em>AuditEngineNode</em> untuk memeriksa rincian kartu isu formula</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* Header Controls & Filters */}
          <div className="flex flex-col gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
            {/* Search and View Mode Switcher */}
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari sel (misal E16), formula, deskripsi..."
                  className="w-full pl-6 pr-2 py-1 text-[11px] rounded border border-slate-200 bg-white text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400"
                />
              </div>
              <div className="flex items-center bg-white rounded border border-slate-200 p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`p-1 rounded cursor-pointer transition ${
                    viewMode === 'cards' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Tampilan Kartu Rinci"
                >
                  <LayoutGrid size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1 rounded cursor-pointer transition ${
                    viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Tampilan Tabel Audit"
                >
                  <TableIcon size={13} />
                </button>
              </div>
            </div>

            {/* Severity Tabs */}
            <div className="grid grid-cols-4 gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => setSeverity('all')}
                className={`py-1 rounded font-bold cursor-pointer transition ${
                  severity === 'all' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                Semua ({anomalies.length})
              </button>
              <button
                type="button"
                onClick={() => setSeverity('high')}
                className={`py-1 rounded font-bold cursor-pointer transition ${
                  severity === 'high' ? 'bg-rose-600 text-white' : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                High ({highCount})
              </button>
              <button
                type="button"
                onClick={() => setSeverity('medium')}
                className={`py-1 rounded font-bold cursor-pointer transition ${
                  severity === 'medium' ? 'bg-amber-500 text-white' : 'bg-amber-50 border border-amber-200 text-amber-800'
                }`}
              >
                Med ({medCount})
              </button>
              <button
                type="button"
                onClick={() => setSeverity('low')}
                className={`py-1 rounded font-bold cursor-pointer transition ${
                  severity === 'low' ? 'bg-blue-600 text-white' : 'bg-blue-50 border border-blue-200 text-blue-800'
                }`}
              >
                Low ({lowCount})
              </button>
            </div>

            {/* Anomaly Type Filter Dropdown */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none"
            >
              <option value="all">Semua Jenis Anomali ({anomalies.length})</option>
              <option value="formula_inconsistency">Pola Berbeda (Outlier Sekitar)</option>
              <option value="hardcoded_in_series">Nilai Hardcoded di Seri Formula</option>
              <option value="range_omission">Rentang Terpotong (SUM/AVERAGE Omission)</option>
              <option value="embedded_constant">Konstanta Scalar / Magic Number</option>
              <option value="ref_error">Error Referensi (#REF!, #VALUE!)</option>
              <option value="hidden_reference">Merujuk Sel Tersembunyi</option>
              <option value="external_reference">Tautan Workbook Eksternal</option>
            </select>
          </div>

          {/* Results Counter and Empty State */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 px-0.5">
            <span>Menampilkan <strong>{filtered.length}</strong> dari {anomalies.length} anomali</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-rose-600 hover:underline cursor-pointer"
              >
                Reset pencarian
              </button>
            )}
          </div>

          {/* View Mode: CARDS */}
          {viewMode === 'cards' && (
            <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-0.5">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                  Tidak ditemukan anomali yang sesuai filter.
                </div>
              ) : (
                filtered.map((a, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectAnomaly(a)}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-rose-300 hover:shadow-xs transition-all flex flex-col gap-1.5 text-[11px] cursor-pointer group"
                  >
                    {/* Top Row: Coordinate, Severity, Type */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 group-hover:bg-rose-50 group-hover:text-rose-900 group-hover:border-rose-200 transition-colors">
                          {a.sheet}!{a.coordinate}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium truncate max-w-[140px]">
                          {getTypeLabel(a.anomaly_type)}
                        </span>
                      </div>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold tracking-wider shrink-0 ${
                          a.severity === 'high'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : a.severity === 'medium'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {a.severity}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-[11px] text-slate-700 leading-snug">
                      {a.description}
                    </p>

                    {/* Formula Comparison Box (Current vs Expected) */}
                    {(a.formula || a.expected_formula || a.expected_pattern) && (
                      <div className="flex flex-col gap-1 p-1.5 rounded bg-slate-50 border border-slate-200/80 font-mono text-[10px]">
                        {a.formula && (
                          <div className="flex items-center justify-between gap-1 text-rose-700">
                            <span className="font-bold text-[9px] uppercase tracking-wider text-rose-500 shrink-0">Aktual:</span>
                            <span className="truncate flex-1 text-right font-medium">{a.formula}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyFormula(a.formula, `act-${idx}`);
                              }}
                              className="text-slate-400 hover:text-slate-700 p-0.5"
                              title="Salin formula aktual"
                            >
                              {copiedIndex === `act-${idx}` ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                            </button>
                          </div>
                        )}

                        {a.expected_formula && (
                          <div className="flex items-center justify-between gap-1 text-emerald-700 pt-0.5 border-t border-slate-200/60">
                            <span className="font-bold text-[9px] uppercase tracking-wider text-emerald-600 shrink-0">Pola Sekitar:</span>
                            <span className="truncate flex-1 text-right font-medium">{a.expected_formula}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyFormula(a.expected_formula, `exp-${idx}`);
                              }}
                              className="text-slate-400 hover:text-slate-700 p-0.5"
                              title="Salin formula yang diharapkan"
                            >
                              {copiedIndex === `exp-${idx}` ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Neighbor Context Summary */}
                    {a.neighbor_summary && (
                      <div className="flex items-center gap-1 text-[9px] text-slate-500 bg-amber-50/60 border border-amber-200/50 px-1.5 py-0.5 rounded truncate">
                        <Info size={11} className="text-amber-600 shrink-0" />
                        <span className="truncate">{a.neighbor_summary}</span>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex items-center justify-end gap-1.5 pt-0.5 text-[10px] text-slate-400 group-hover:text-slate-700">
                      <span className="text-[9px]">Klik untuk sorot di spreadsheet</span>
                      <ArrowRight size={11} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* View Mode: TABLE */}
          {viewMode === 'table' && (
            <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-[360px] bg-white">
              <table className="w-full text-[10px] text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200 font-semibold uppercase tracking-wider text-[9px]">
                  <tr>
                    <th className="p-1.5 w-12 text-center">Sev</th>
                    <th className="p-1.5">Sel</th>
                    <th className="p-1.5">Tipe Anomali</th>
                    <th className="p-1.5 font-mono">Formula Aktual</th>
                    <th className="p-1.5 font-mono">Pola Sekitar (Expected)</th>
                    <th className="p-1.5">Rincian Tetangga</th>
                    <th className="p-1.5 w-10 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-slate-400 text-xs">
                        Tidak ada anomali yang sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((a, idx) => (
                      <tr
                        key={idx}
                        onClick={() => handleSelectAnomaly(a)}
                        className="hover:bg-rose-50/40 transition-colors cursor-pointer"
                      >
                        <td className="p-1.5 text-center">
                          <span
                            className={`px-1 py-0.2 rounded text-[8px] uppercase font-bold ${
                              a.severity === 'high'
                                ? 'bg-rose-100 text-rose-800'
                                : a.severity === 'medium'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {a.severity}
                          </span>
                        </td>
                        <td className="p-1.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {a.sheet}!{a.coordinate}
                        </td>
                        <td className="p-1.5 text-slate-600 whitespace-nowrap">
                          {getTypeLabel(a.anomaly_type)}
                        </td>
                        <td className="p-1.5 font-mono text-rose-700 max-w-[150px] truncate" title={a.formula}>
                          {a.formula || '-'}
                        </td>
                        <td className="p-1.5 font-mono text-emerald-700 max-w-[150px] truncate" title={a.expected_formula || a.expected_pattern}>
                          {a.expected_formula || a.expected_pattern || '-'}
                        </td>
                        <td className="p-1.5 text-slate-500 max-w-[200px] truncate" title={a.neighbor_summary || a.description}>
                          {a.neighbor_summary || a.description}
                        </td>
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectAnomaly(a);
                            }}
                            className="p-1 rounded bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-800 transition"
                            title="Sorot sel di tabel spreadsheet"
                          >
                            <Eye size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </BaseNode>
  );
}
