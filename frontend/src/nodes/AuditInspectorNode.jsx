import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import { ShieldAlert, AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';

export default function AuditInspectorNode({ id, data }) {
  const { setHighlights, removeNode } = useFlow();

  const [severity, setSeverity] = useState('all');

  const rawAnomalies = data.inputs?.anomalies_list ?? data.anomalies_list;
  const anomalies = Array.isArray(rawAnomalies) ? rawAnomalies : [];

  const filtered = anomalies.filter((a) => {
    if (severity !== 'all' && a.severity !== severity) return false;
    return true;
  });

  const handleSelectAnomaly = (a) => {
    setHighlights([
      {
        sheet: a.sheet,
        coordinate: a.coordinate,
        color: a.severity === 'high' ? '#fecdd3' : a.severity === 'medium' ? '#fed7aa' : '#bfdbfe',
      },
    ]);
  };

  return (
    <BaseNode
      id={id}
      category="audit"
      icon={ShieldAlert}
      title="Audit Inspector Cards"
      subtitle={`${anomalies.length} Isu Anomali`}
      inputs={[
        { id: 'anomalies_list', label: 'Anomalies', tooltip: 'Daftar anomali dari AuditEngineNode' },
      ]}
      outputs={[
        { id: 'selected_anomaly_coord', label: 'Cell', tooltip: 'Koordinat sel anomali yang dipilih' },
      ]}
      onDelete={() => removeNode(id)}
      minWidth="min-w-[340px]"
    >
      {anomalies.length === 0 ? (
        <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 border border-dashed border-slate-200 rounded-lg">
          Hubungkan port Anomalies dari AuditEngineNode untuk memeriksa rincian kartu peringatan
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Severity Filter Tabs */}
          <div className="grid grid-cols-4 gap-1 text-[10px]">
            <button
              type="button"
              onClick={() => setSeverity('all')}
              className={`py-1 rounded font-bold cursor-pointer transition ${
                severity === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              All ({anomalies.length})
            </button>
            <button
              type="button"
              onClick={() => setSeverity('high')}
              className={`py-1 rounded font-bold cursor-pointer transition ${
                severity === 'high' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800'
              }`}
            >
              High
            </button>
            <button
              type="button"
              onClick={() => setSeverity('medium')}
              className={`py-1 rounded font-bold cursor-pointer transition ${
                severity === 'medium' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-800'
              }`}
            >
              Med
            </button>
            <button
              type="button"
              onClick={() => setSeverity('low')}
              className={`py-1 rounded font-bold cursor-pointer transition ${
                severity === 'low' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-800'
              }`}
            >
              Low
            </button>
          </div>

          {/* Cards List */}
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
            {filtered.slice(0, 20).map((a, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectAnomaly(a)}
                className="p-2 rounded border border-slate-200 bg-white hover:bg-rose-50/30 hover:border-rose-300 transition flex flex-col gap-1 text-[11px] cursor-pointer"
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="font-mono text-slate-800">{a.sheet}!{a.coordinate}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                      a.severity === 'high'
                        ? 'bg-rose-100 text-rose-800'
                        : a.severity === 'medium'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {a.severity}
                  </span>
                </div>

                <p className="text-[10px] text-slate-600">{a.description}</p>

                {a.formula && (
                  <div className="font-mono text-[9px] bg-slate-50 border border-slate-100 p-1 rounded text-slate-700 truncate">
                    Formula: {a.formula}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </BaseNode>
  );
}
