import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import { Split, CheckCircle2, ChevronRight } from 'lucide-react';

export default function DiffInspectorNode({ id, data }) {
  const { setHighlights, removeNode } = useFlow();

  const [filterType, setFilterType] = useState('all');

  const rawDiffs = data.inputs?.diffs_list ?? data.diffs_list;
  const diffs = Array.isArray(rawDiffs) ? rawDiffs : [];

  const filteredDiffs = diffs.filter((d) => {
    if (filterType === 'all') return true;
    return d.diff_type === filterType;
  });

  const handleSelectDiff = (d) => {
    const coord = d.baseline_coordinate || d.coordinate;
    let color = '#fef08a';
    if (d.diff_type === 'added') color = '#a7f3d0';
    if (d.diff_type === 'removed') color = '#fecdd3';
    if (d.diff_type === 'formula_changed') color = '#fed7aa';

    setHighlights([{ coordinate: coord, color }]);
  };

  return (
    <BaseNode
      id={id}
      category="compare"
      icon={Split}
      title="Diff Inspector"
      subtitle={`${diffs.length} Perbedaan Sel`}
      inputs={[
        { id: 'diffs_list', label: 'Diffs', tooltip: 'Daftar diff dari SheetComparatorNode' },
      ]}
      outputs={[
        { id: 'selected_diff_coord', label: 'Cell', tooltip: 'Koordinat sel diff yang dipilih' },
      ]}
      onDelete={() => removeNode(id)}
      minWidth="min-w-[340px]"
    >
      {diffs.length === 0 ? (
        <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 border border-dashed border-slate-200 rounded-lg">
          Hubungkan port Diffs dari SheetComparatorNode untuk memeriksa rincian perbandingan formula & nilai
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Filter Bar */}
          <div className="flex items-center gap-1 text-[11px]">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white px-2 py-1"
            >
              <option value="all">Semua Tipe ({diffs.length})</option>
              <option value="formula_changed">Formula Changed</option>
              <option value="added">Added Cells</option>
              <option value="removed">Removed Cells</option>
              <option value="value_changed">Value Changed</option>
            </select>
          </div>

          {/* Diffs List */}
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
            {filteredDiffs.slice(0, 20).map((d, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectDiff(d)}
                className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 hover:border-emerald-300 transition flex flex-col gap-1 text-[11px] cursor-pointer"
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="font-mono text-slate-800">
                    {d.baseline_coordinate || d.coordinate}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                      d.diff_type === 'added'
                        ? 'bg-emerald-100 text-emerald-800'
                        : d.diff_type === 'removed'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {d.diff_type.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1 text-[10px] bg-slate-50 p-1 rounded font-mono">
                  <div className="truncate text-slate-600">
                    Base: {d.baseline_formula || String(d.baseline_value || 'None')}
                  </div>
                  <div className="truncate text-emerald-700 font-semibold">
                    Tgt: {d.target_formula || String(d.target_value || 'None')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </BaseNode>
  );
}
