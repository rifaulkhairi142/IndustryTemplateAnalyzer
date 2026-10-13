import React, { useState, useMemo, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, AlertOctagon, Info, ArrowUpRight, CheckCircle2, ChevronDown } from 'lucide-react';

const PAGE_SIZE = 35;

export default function AuditPanel({
  auditData,
  onSelectAnomalyCell,
  isLoading
}) {
  const [severityFilter, setSeverityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const anomalies = auditData?.anomalies || [];

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [severityFilter, typeFilter]);

  const filtered = useMemo(() => {
    return anomalies.filter((a) => {
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
      if (typeFilter !== 'all' && a.anomaly_type !== typeFilter) return false;
      return true;
    });
  }, [anomalies, severityFilter, typeFilter]);

  const displayedAnomalies = useMemo(() => {
    return filtered.slice(0, visibleCount);
  }, [filtered, visibleCount]);

  if (isLoading) {
    return (
      <aside className="w-full bg-white border-l border-slate-200 flex flex-col h-full p-8 text-center text-slate-400 text-xs">
        Auditing workbook formulas & series...
      </aside>
    );
  }

  return (
    <aside className="w-full bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
        <div className="text-sm font-semibold flex items-center gap-2 text-slate-800">
          <ShieldAlert size={16} className="text-rose-600" />
          <span>Formula Audit & Anomalies</span>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          {anomalies.length} Issues
        </span>
      </div>

      {/* Filters and Metric Counters */}
      <div className="p-3 border-b border-slate-200 flex flex-col gap-2.5 bg-slate-50/40 text-xs shrink-0">
        {/* Severity Metrics Toggle */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            className={`py-1.5 px-2 text-xs font-medium rounded-md border flex items-center justify-center gap-1 transition cursor-pointer ${
              severityFilter === 'high'
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => setSeverityFilter(severityFilter === 'high' ? 'all' : 'high')}
          >
            <span className={severityFilter === 'high' ? 'text-white font-bold' : 'text-rose-600 font-bold'}>
              {auditData?.high_severity_count || 0}
            </span>
            <span>High</span>
          </button>

          <button
            className={`py-1.5 px-2 text-xs font-medium rounded-md border flex items-center justify-center gap-1 transition cursor-pointer ${
              severityFilter === 'medium'
                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => setSeverityFilter(severityFilter === 'medium' ? 'all' : 'medium')}
          >
            <span className={severityFilter === 'medium' ? 'text-white font-bold' : 'text-amber-600 font-bold'}>
              {auditData?.medium_severity_count || 0}
            </span>
            <span>Med</span>
          </button>

          <button
            className={`py-1.5 px-2 text-xs font-medium rounded-md border flex items-center justify-center gap-1 transition cursor-pointer ${
              severityFilter === 'low'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => setSeverityFilter(severityFilter === 'low' ? 'all' : 'low')}
          >
            <span className={severityFilter === 'low' ? 'text-white font-bold' : 'text-blue-600 font-bold'}>
              {auditData?.low_severity_count || 0}
            </span>
            <span>Low</span>
          </button>
        </div>

        {/* Type Filter Select */}
        <select
          className="w-full bg-white border border-slate-300 text-slate-800 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs cursor-pointer"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All Anomaly Types</option>
          <option value="hardcoded_in_series">Hardcoded Values in Series</option>
          <option value="formula_inconsistency">Formula Pattern Inconsistencies</option>
          <option value="ref_error">Broken Reference (#REF! / Errors)</option>
          <option value="external_reference">External Workbook Links</option>
        </select>
      </div>

      {/* Content List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        {filtered.length === 0 ? (
          <div className="text-center py-8 px-4 text-slate-400 text-xs">
            <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
            No anomalies found for selected filters
          </div>
        ) : (
          <>
            {filtered.length > PAGE_SIZE && (
              <div className="text-[11px] text-slate-500 px-1 py-0.5 flex items-center justify-between">
                <span>
                  Menampilkan <strong>{displayedAnomalies.length}</strong> dari <strong>{filtered.length}</strong> isu
                </span>
                <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-medium">
                  Optimized
                </span>
              </div>
            )}

            {displayedAnomalies.map((item, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200 hover:border-blue-400 hover:shadow-xs rounded-lg p-2.5 flex flex-col gap-1.5 transition cursor-pointer text-xs"
                onClick={() => onSelectAnomalyCell(item.coordinate, item.sheet)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-700">
                    {item.sheet}!{item.coordinate}
                  </span>

                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      item.severity === 'high'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : item.severity === 'medium'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {item.severity.toUpperCase()}
                  </span>
                </div>

                <div className="text-slate-700 font-medium leading-relaxed">
                  {item.description}
                </div>

                {item.formula && (
                  <div className="font-mono text-xs bg-slate-50 border border-slate-200 text-sky-800 p-1.5 rounded break-all shadow-2xs">
                    {item.formula}
                  </div>
                )}

                {item.affected_context && (
                  <div className="text-[11px] text-slate-400">
                    Context: {item.affected_context}
                  </div>
                )}
              </div>
            ))}

            {filtered.length > visibleCount && (
              <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-1.5">
                <span className="text-center text-[11px] text-slate-500">
                  Sisa {filtered.length - visibleCount} isu belum ditampilkan
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                    className="flex-1 py-1.5 px-3 bg-white border border-slate-300 hover:border-blue-400 hover:text-blue-700 text-slate-700 text-xs font-medium rounded-md shadow-2xs transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <ChevronDown size={14} />
                    +35 Isu Lainnya
                  </button>
                  <button
                    onClick={() => setVisibleCount(filtered.length)}
                    className="py-1.5 px-3 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                  >
                    Tampilkan Semua ({filtered.length})
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
