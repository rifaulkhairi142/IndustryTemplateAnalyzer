import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import { api } from '../services/api';
import { ShieldAlert, Play, RefreshCw, AlertTriangle, AlertOctagon, Info } from 'lucide-react';

export default function AuditEngineNode({ id, data }) {
  const { activeWorkbookId, activeSheetName, setHighlights, updateNodeData, removeNode } = useFlow();

  const [isLoading, setIsLoading] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const effectiveWbId = data.inputs?.workbook_id || data.workbook_id || activeWorkbookId;
  const effectiveSheet = data.inputs?.sheet_name || data.sheet_name || null;

  const auditData = data.audit_data || null;
  const anomalies = auditData?.anomalies || [];

  const handleRunAudit = async () => {
    if (!effectiveWbId) return;
    setIsLoading(true);
    try {
      const res = await api.getAuditAnomalies(effectiveWbId, effectiveSheet);

      // Highlight anomalies on sheet
      const hl = res.anomalies.map((a) => ({
        sheet: a.sheet,
        coordinate: a.coordinate,
        color: a.severity === 'high' ? '#fecdd3' : a.severity === 'medium' ? '#fed7aa' : '#bfdbfe',
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
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAnomalies = anomalies.filter((a) => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (typeFilter !== 'all' && a.anomaly_type !== typeFilter) return false;
    return true;
  });

  return (
    <BaseNode
      id={id}
      category="audit"
      icon={ShieldAlert}
      title="Audit & Anomaly Engine"
      subtitle={effectiveSheet ? `Sheet: ${effectiveSheet}` : 'Seluruh Workbook'}
      inputs={[
        { id: 'workbook_id', label: 'WB ID', tooltip: 'ID Workbook' },
        { id: 'sheet_name', label: 'Sheet', tooltip: 'Sheet filter (opsional)' },
      ]}
      outputs={[
        { id: 'anomalies_list', label: 'Anomalies', tooltip: 'Daftar seluruh isu anomali' },
        { id: 'anomaly_summary', label: 'Summary', tooltip: 'Statistik tingkat keparahan' },
      ]}
      status={isLoading ? 'running' : auditData ? 'success' : 'idle'}
      onDelete={() => removeNode(id)}
      minWidth="min-w-[340px]"
    >
      <div className="flex flex-col gap-2">
        {/* Anomaly Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
        >
          <option value="all">Semua Tipe Anomali</option>
          <option value="hardcoded_in_series">Hardcoded in Formula Series</option>
          <option value="formula_inconsistency">Formula Pattern Outliers</option>
          <option value="hidden_reference">Hidden Data References (Baru)</option>
          <option value="ref_error">Broken Reference (#REF!, #VALUE!)</option>
          <option value="external_reference">External Workbook Links</option>
        </select>

        <button
          type="button"
          onClick={handleRunAudit}
          disabled={isLoading || !effectiveWbId}
          className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition cursor-pointer shadow-2xs disabled:opacity-50"
        >
          {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
          Jalankan Audit Workbook
        </button>
      </div>

      {auditData && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Severity Counters */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setSeverityFilter(severityFilter === 'high' ? 'all' : 'high')}
              className={`p-1.5 rounded border text-center transition cursor-pointer ${
                severityFilter === 'high' ? 'bg-rose-600 text-white font-bold' : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <span className="text-[10px] block">High</span>
              <strong>{auditData.high_severity_count || 0}</strong>
            </button>

            <button
              type="button"
              onClick={() => setSeverityFilter(severityFilter === 'medium' ? 'all' : 'medium')}
              className={`p-1.5 rounded border text-center transition cursor-pointer ${
                severityFilter === 'medium' ? 'bg-amber-500 text-white font-bold' : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <span className="text-[10px] block">Medium</span>
              <strong>{auditData.medium_severity_count || 0}</strong>
            </button>

            <button
              type="button"
              onClick={() => setSeverityFilter(severityFilter === 'low' ? 'all' : 'low')}
              className={`p-1.5 rounded border text-center transition cursor-pointer ${
                severityFilter === 'low' ? 'bg-blue-600 text-white font-bold' : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              <span className="text-[10px] block">Low</span>
              <strong>{auditData.low_severity_count || 0}</strong>
            </button>
          </div>

          {/* Mini Anomalies List */}
          <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Anomali Terdeteksi ({filteredAnomalies.length}):
            </div>
            {filteredAnomalies.slice(0, 10).map((a, idx) => (
              <div
                key={idx}
                className="p-1.5 rounded border border-slate-200 bg-white hover:bg-rose-50/40 flex flex-col gap-0.5 text-[11px]"
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-800 font-mono">{a.sheet}!{a.coordinate}</span>
                  <span
                    className={`px-1 py-0.2 rounded text-[9px] uppercase font-bold ${
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
                <p className="text-[10px] text-slate-500 truncate">{a.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </BaseNode>
  );
}
