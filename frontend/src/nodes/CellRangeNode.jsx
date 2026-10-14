import React, { useState, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import { Target, Crosshair, Pin, Check } from 'lucide-react';

export default function CellRangeNode({ id, data }) {
  const {
    selectedRange,
    activeSheetName,
    pickTargetNodeId,
    setPickTargetNodeId,
    updateNodeData,
    removeNode,
  } = useFlow();

  const [coordInput, setCoordInput] = useState(data.coordinate || 'B8');
  const isPickActive = pickTargetNodeId === id;

  // React to grid selection when pick mode is active for this node
  useEffect(() => {
    if (isPickActive && selectedRange?.coordinate) {
      setCoordInput(selectedRange.coordinate);
      updateNodeData(id, {
        coordinate: selectedRange.coordinate,
        is_range: selectedRange.isRange,
        cell: selectedRange.isRange ? selectedRange.startCell : selectedRange.coordinate,
        range: selectedRange.isRange ? selectedRange.coordinate : null,
      });
    }
  }, [selectedRange, isPickActive, id]);

  const handleCommitCoord = (val) => {
    const clean = val.replace('$', '').trim().toUpperCase();
    setCoordInput(clean);
    const isRange = clean.includes(':');
    updateNodeData(id, {
      coordinate: clean,
      is_range: isRange,
      cell: isRange ? clean.split(':')[0] : clean,
      range: isRange ? clean : null,
    });
  };

  const isRange = coordInput.includes(':');

  return (
    <BaseNode
      id={id}
      category="scope"
      icon={Target}
      title="Cell / Range Selector"
      subtitle={coordInput ? `Target: ${coordInput}` : 'Tentukan koordinat'}
      inputs={[
        { id: 'sheet_name', label: 'Sheet', tooltip: 'Sheet target dari SheetScopeNode' },
      ]}
      outputs={[
        { id: 'coordinate', label: 'Coord', tooltip: 'Koordinat sel atau range' },
        { id: 'cell', label: 'Cell', tooltip: 'Single cell target (e.g. B8)' },
        { id: 'range', label: 'Range', tooltip: 'Range string (e.g. B2:D10)' },
      ]}
      onDelete={() => removeNode(id)}
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
          <span>Target Koordinat:</span>
          <span className="font-mono text-[10px] text-purple-700 font-bold">
            {isRange ? 'Range' : 'Single Cell'}
          </span>
        </label>

        <div className="flex gap-1.5">
          <input
            type="text"
            value={coordInput}
            onChange={(e) => setCoordInput(e.target.value)}
            onBlur={() => handleCommitCoord(coordInput)}
            onKeyDown={(e) => e.key === 'Enter' && handleCommitCoord(coordInput)}
            placeholder="e.g. B8 or B2:D10"
            className="flex-1 font-mono font-bold uppercase rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-purple-500 shadow-2xs"
          />

          <button
            type="button"
            onClick={() => handleCommitCoord(coordInput)}
            className="px-2 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs transition cursor-pointer shadow-2xs"
            title="Terapkan koordinat"
          >
            <Check size={13} />
          </button>
        </div>
      </div>

      {/* Two-Way Pick from Grid Button */}
      <button
        type="button"
        onClick={() => setPickTargetNodeId(isPickActive ? null : id)}
        className={`w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition cursor-pointer shadow-2xs ${
          isPickActive
            ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse ring-2 ring-amber-300'
            : 'border border-slate-200 bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-700'
        }`}
        title="Klik sel di Luckysheet spreadsheet untuk otomatis mengisi koordinat ke node ini"
      >
        <Crosshair size={13} />
        {isPickActive ? 'Sedang Memilih di Spreadsheet...' : 'Pick from Spreadsheet'}
      </button>

      {/* Current selection quick use */}
      {selectedRange?.coordinate && selectedRange.coordinate !== coordInput && (
        <button
          type="button"
          onClick={() => handleCommitCoord(selectedRange.coordinate)}
          className="text-[10px] text-purple-600 hover:text-purple-800 underline text-left cursor-pointer"
        >
          Gunakan seleksi grid saat ini ({selectedRange.coordinate})
        </button>
      )}
    </BaseNode>
  );
}
