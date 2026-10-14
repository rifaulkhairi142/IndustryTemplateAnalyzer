import React, { useState, useMemo } from 'react';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import { api } from '../services/api';
import { FunctionSquare, Play, Search, Filter, RefreshCw, Layers } from 'lucide-react';

export default function FormulaDiscoveryNode({ id, data }) {
  const {
    activeWorkbookId,
    activeSheetName,
    setHighlights,
    updateNodeData,
    removeNode,
  } = useFlow();

  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFunc, setSelectedFunc] = useState('ALL');

  const effectiveWbId = data.inputs?.workbook_id || data.workbook_id || activeWorkbookId;
  const effectiveSheetName = data.inputs?.sheet_name || data.sheet_name || activeSheetName;

  const formulasData = data.formulasData || null;
  const formulas = formulasData?.formulas || [];
  const groups = formulasData?.groups || [];

  const handleScanFormulas = async () => {
    if (!effectiveWbId || !effectiveSheetName) return;
    setIsLoading(true);
    try {
      const res = await api.getSheetFormulas(effectiveWbId, effectiveSheetName);
      updateNodeData(id, {
        formulasData: res,
        formulas_list: res.formulas || [],
        formula_groups: res.groups || [],
        total_formulas: res.total_formulas || 0,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Distinct function list
  const availableFuncs = useMemo(() => {
    const set = new Set();
    formulas.forEach((f) => {
      f.functions?.forEach((fn) => set.add(fn.toUpperCase()));
    });
    return Array.from(set).sort();
  }, [formulas]);

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (searchTerm && !g.sample_formula.toLowerCase().includes(searchTerm.toLowerCase()) && !g.cells.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()))) {
        return false;
      }
      if (selectedFunc !== 'ALL') {
        if (!g.sample_formula.toUpperCase().includes(selectedFunc)) return false;
      }
      return true;
    });
  }, [groups, searchTerm, selectedFunc]);

  const handleHighlightGroup = (cells) => {
    const hl = cells.map((coord) => ({
      sheet: effectiveSheetName,
      coordinate: coord,
      color: '#bfdbfe',
    }));
    setHighlights(hl);
  };

  return (
    <BaseNode
      id={id}
      category="engine"
      icon={FunctionSquare}
      title="Formula Discovery"
      subtitle={formulasData ? `${formulas.length} Formula • ${groups.length} Pola` : 'Standby'}
      inputs={[
        { id: 'workbook_id', label: 'WB ID', tooltip: 'ID Workbook' },
        { id: 'sheet_name', label: 'Sheet', tooltip: 'Sheet yang ingin dipindai' },
        { id: 'range', label: 'Range', tooltip: 'Filter range (opsional)' },
      ]}
      outputs={[
        { id: 'formulas_list', label: 'Formulas', tooltip: 'Daftar formula lengkap' },
        { id: 'formula_groups', label: 'Groups', tooltip: 'Grup pola Normalized R1C1' },
      ]}
      status={isLoading ? 'running' : 'idle'}
      onDelete={() => removeNode(id)}
      minWidth="min-w-[320px]"
    >
      {!formulasData ? (
        <div className="flex flex-col items-center justify-center p-3 text-center bg-slate-50 border border-dashed border-slate-200 rounded-lg">
          <p className="text-[11px] text-slate-500 mb-2">
            Sheet: <strong>{effectiveSheetName || 'Belum dipilih'}</strong>
          </p>
          <button
            type="button"
            onClick={handleScanFormulas}
            disabled={isLoading || !effectiveSheetName}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
            Pindai Formula Sheet
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Controls Bar */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search size={12} className="absolute left-2 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari formula / sel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-6 pr-2 py-1 text-[11px] rounded border border-slate-200 bg-white outline-none focus:border-amber-500"
              />
            </div>

            <select
              value={selectedFunc}
              onChange={(e) => setSelectedFunc(e.target.value)}
              className="py-1 px-1.5 text-[11px] rounded border border-slate-200 bg-white outline-none text-slate-700 max-w-[90px]"
            >
              <option value="ALL">All Func</option>
              {availableFuncs.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleScanFormulas}
              className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 transition cursor-pointer"
              title="Pindai ulang"
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {/* Groups Mini List */}
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
            {filteredGroups.slice(0, 15).map((grp, idx) => (
              <div
                key={idx}
                className="p-1.5 rounded border border-slate-200 bg-slate-50/60 hover:bg-amber-50/50 hover:border-amber-300 transition flex flex-col gap-0.5 text-[11px]"
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="font-mono text-amber-900 truncate max-w-[200px]" title={grp.sample_formula}>
                    {grp.sample_formula}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleHighlightGroup(grp.cells)}
                    className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold hover:bg-amber-200 transition cursor-pointer"
                    title="Sorot seluruh sel dengan pola ini di spreadsheet"
                  >
                    {grp.count} sel
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate" title={grp.pattern}>
                  Pola: {grp.pattern}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </BaseNode>
  );
}
