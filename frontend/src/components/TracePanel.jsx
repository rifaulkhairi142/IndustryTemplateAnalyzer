import React, { useState, useEffect } from 'react';
import {
  GitCommit,
  ArrowUpLeft,
  ArrowDownRight,
  AlertOctagon,
  Terminal,
  ChevronDown,
  ChevronRight,
  GitFork,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Loader2,
  Cpu
} from 'lucide-react';

function TreeNodeView({ node, onSelectCell }) {
  // Only expand root and immediate level (depth <= 1) by default to prevent DOM freezes
  const [expanded, setExpanded] = useState(node.depth === undefined || node.depth <= 1);
  const [childrenLimit, setChildrenLimit] = useState(20);
  const hasChildren = node.children && node.children.length > 0;

  const displayedChildren = hasChildren ? node.children.slice(0, childrenLimit) : [];

  return (
    <div className="my-1">
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-pointer transition ${
          node.is_circular
            ? 'bg-rose-50 text-rose-800 border border-rose-200'
            : 'hover:bg-slate-100/80 bg-slate-50/70 border border-slate-200/60 text-slate-800'
        }`}
        onClick={() => {
          if (node.coordinate) onSelectCell(node.coordinate, node.sheet);
        }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="inline-flex items-center text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
            title={expanded ? 'Ciutkan cabang' : 'Buka cabang'}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        ) : (
          <span className="w-3 inline-block" />
        )}

        <span className={`font-semibold ${node.is_circular ? 'text-rose-600' : 'text-blue-700'}`}>
          {node.sheet ? `${node.sheet}!` : ''}
          {node.coordinate || node.id}
        </span>

        {node.formula ? (
          <span className="font-mono text-[11px] bg-white border border-slate-200 text-sky-800 px-1.5 py-0.5 rounded truncate max-w-[150px]">
            {node.formula}
          </span>
        ) : (
          <span className="text-[11px] text-emerald-700 font-medium italic">
            ({node.value !== null && node.value !== undefined ? String(node.value) : 'constant'})
          </span>
        )}

        {node.is_circular && (
          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-600 text-white">
            CIRCULAR
          </span>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="flex flex-col gap-1 ml-3.5 pl-2 border-l border-dashed border-slate-300">
          {displayedChildren.map((child, idx) => (
            <TreeNodeView key={idx} node={child} onSelectCell={onSelectCell} />
          ))}

          {node.children.length > childrenLimit && (
            <button
              onClick={() => setChildrenLimit((prev) => prev + 25)}
              className="text-left text-[11px] text-blue-600 hover:text-blue-800 font-medium pl-1 py-0.5 cursor-pointer"
            >
              +{node.children.length - childrenLimit} cabang lainnya...
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TraceLoadingView({ traceTarget }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(((Date.now() - start) / 1000).toFixed(1));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const cell = traceTarget?.cell || '...';
  const sheet = traceTarget?.sheet || '';
  const dir = traceTarget?.direction || 'precedents';
  const isPrecedent = dir === 'precedents';

  return (
    <aside className="w-full bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <div className="text-sm font-semibold flex items-center gap-2 text-slate-800">
          <Loader2 size={16} className="animate-spin text-blue-600" />
          <span>Eksekusi Tracing Sedang Berjalan</span>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock size={11} />
          {elapsed}s
        </span>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1 overflow-y-auto">
        {/* Info card */}
        <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3">
          <div className="text-xs text-blue-700 font-semibold uppercase tracking-wider mb-1">
            Mengevaluasi Dependensi Sel
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-slate-800">
              {sheet ? `${sheet}!` : ''}{cell}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              {isPrecedent ? 'Precedents (Sumber Formula)' : 'Dependents (Formula Terdampak)'}
            </span>
          </div>
        </div>

        {/* Step progress */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
          <div className="font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
            <Cpu size={14} className="text-blue-600" />
            <span>Status Proses Engine:</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 size={13} className="shrink-0" />
            <span>Target: <strong>{sheet}!{cell}</strong> diinisialisasi</span>
          </div>
          <div className="flex items-center gap-2 text-amber-700 font-medium">
            <Loader2 size={13} className="animate-spin shrink-0 text-amber-600" />
            <span>Sedang memproses & menelusuri sel: <strong>{sheet}!{cell}</strong>...</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-3 h-3 rounded-full border border-slate-300 inline-block shrink-0" />
            <span>Menghubungkan cabang pohon relasi & input konstan</span>
          </div>
        </div>

        {/* Live Terminal Log Preview */}
        <div className="flex flex-col gap-1.5 flex-1 min-h-[160px]">
          <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Terminal size={13} className="text-slate-500" />
            <span>Console Log Real-time</span>
          </div>
          <div className="flex-1 bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-[11px] leading-relaxed border border-slate-800 shadow-inner flex flex-col justify-start space-y-1.5">
            <div className="text-sky-300">&gt; [TARGET] Menyiapkan evaluasi sel: {sheet}!{cell}</div>
            <div className="text-amber-300 animate-pulse">&gt; [SEDANG MEMPROSES] Menganalisis formula dan referensi pada {sheet}!{cell}...</div>
            <div className="text-slate-400">&gt; [GRAPH ENGINE] Menelusuri seluruh rantai sel {dir.toUpperCase()}...</div>
            <div className="text-emerald-400">&gt; [STATUS] Berjalan di engine ({elapsed}s)... Mohon tunggu</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function TracePanel({
  traceData,
  traceTarget,
  onDirectionChange,
  onOpenGraph,
  onSelectCell,
  isLoading
}) {
  const [isLogExpanded, setIsLogExpanded] = useState(true);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [copied, setCopied] = useState(false);
  const [visibleTerminals, setVisibleTerminals] = useState(24);

  // Reset pagination when trace target changes
  useEffect(() => {
    setVisibleTerminals(24);
    setShowAllLogs(false);
  }, [traceData?.target_cell, traceData?.target_sheet, traceData?.direction]);

  if (isLoading) {
    return <TraceLoadingView traceTarget={traceTarget} />;
  }

  if (!traceData) {
    return (
      <aside className="w-full bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="text-sm font-semibold flex items-center gap-2 text-slate-800">
            <GitCommit size={16} className="text-blue-600" />
            <span>Formula Tracing</span>
          </div>
        </div>
        <div className="p-8 text-center text-slate-400 text-xs">
          Pilih sel di sheet lalu klik <strong>Precedents</strong> atau <strong>Dependents</strong> di toolbar untuk memulai penelusuran.
        </div>
      </aside>
    );
  }

  const logs = traceData.execution_logs || [];
  const elapsed = traceData.elapsed_seconds !== undefined ? traceData.elapsed_seconds : 0;
  const nodeCount = traceData.nodes?.length || 0;
  const terminalCount = traceData.terminal_sources?.length || 0;
  const isPrecedents = traceData.direction === 'precedents';

  const displayedTerminals = (traceData.terminal_sources || []).slice(0, visibleTerminals);
  const displayedLogs = showAllLogs ? logs : logs.slice(Math.max(0, logs.length - 80));

  const handleCopyLogs = () => {
    if (!logs.length) return;
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderLogLine = (line, idx) => {
    const isSuccess = line.includes('[SELESAI]');
    const isTarget = line.includes('[Target]');
    const isProcessing = line.includes('[Memproses Sel]') || line.includes('[Memproses Sel Dependen]');
    const isTerminal = line.includes('[Akar Input]');
    const isLevel = line.includes('[Level');
    const isArrow = line.includes('↳') || line.includes('->');
    const isCircular = line.toLowerCase().includes('circular') || line.toLowerCase().includes('melingkar');

    let textClass = 'text-slate-300';
    if (isSuccess) textClass = 'text-emerald-400 font-bold';
    else if (isTarget) textClass = 'text-sky-300 font-bold';
    else if (isProcessing) textClass = 'text-amber-300 font-semibold';
    else if (isTerminal) textClass = 'text-teal-300';
    else if (isArrow) textClass = 'text-indigo-300 pl-2';
    else if (isLevel) textClass = 'text-sky-400';
    else if (isCircular) textClass = 'text-rose-400 font-bold';

    return (
      <div key={idx} className={`leading-relaxed break-all ${textClass}`}>
        {line}
      </div>
    );
  };

  return (
    <aside className="w-full bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
        <div className="text-sm font-semibold flex items-center gap-2 text-slate-800">
          <GitCommit size={16} className="text-blue-600" />
          <span>Dependency Tracing</span>
        </div>
        <button
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition cursor-pointer"
          onClick={onOpenGraph}
          title="Buka diagram grafik dependensi interaktif"
        >
          <GitFork size={13} />
          Graph
        </button>
      </div>

      {/* Control Summary Box */}
      <div className="p-3 border-b border-slate-200 flex flex-col gap-2.5 bg-slate-50/40 shrink-0">
        {/* Direction Switch */}
        <div className="flex gap-2">
          <button
            className={`flex-1 py-1 px-2 text-xs font-medium rounded-md flex items-center justify-center gap-1 transition cursor-pointer ${
              isPrecedents
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => onDirectionChange('precedents')}
          >
            <ArrowUpLeft size={13} />
            Precedents ({nodeCount})
          </button>
          <button
            className={`flex-1 py-1 px-2 text-xs font-medium rounded-md flex items-center justify-center gap-1 transition cursor-pointer ${
              !isPrecedents
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => onDirectionChange('dependents')}
          >
            <ArrowDownRight size={13} />
            Dependents ({nodeCount})
          </button>
        </div>

        {/* Execution Summary Badge */}
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>Eksekusi Selesai</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-emerald-700 font-medium">
            <span><strong>{nodeCount}</strong> node diproses</span>
            <span>•</span>
            <span><strong>{elapsed}s</strong></span>
          </div>
        </div>

        {/* Target Cell Summary Card */}
        <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-2.5 flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Target Sel:</span>
            <span className="font-bold text-blue-700">
              {traceData.target_sheet}!{traceData.target_cell}
            </span>
          </div>
          {traceData.formula && (
            <div className="font-mono text-xs bg-white border border-blue-200 text-sky-800 p-1.5 rounded break-all shadow-xs">
              {traceData.formula}
            </div>
          )}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
            <span>Maks Kedalaman: <strong>{traceData.max_depth_reached}</strong></span>
            <span>•</span>
            <span>Input Terminal: <strong>{terminalCount}</strong></span>
          </div>
        </div>

        {/* Circular Warning */}
        {traceData.has_circular_reference && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <AlertOctagon size={16} className="text-rose-600 shrink-0" />
            <div>
              <strong className="block">Circular Reference Terdeteksi!</strong>
              <span className="text-[11px] text-rose-700">Rekursi dibatasi secara aman untuk menghindari infinite loop.</span>
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {/* Execution Logs Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
          <div className="px-3 py-2 bg-slate-950 flex items-center justify-between border-b border-slate-800">
            <div
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 cursor-pointer select-none"
              onClick={() => setIsLogExpanded(!isLogExpanded)}
            >
              <Terminal size={13} className="text-emerald-400" />
              <span>Log Eksekusi Engine</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                {logs.length} baris
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLogs}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-100 hover:bg-slate-800 px-1.5 py-0.5 rounded transition cursor-pointer"
                title="Salin seluruh log eksekusi ke clipboard"
              >
                {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                <span>{copied ? 'Tersalin' : 'Salin'}</span>
              </button>
              <button
                onClick={() => setIsLogExpanded(!isLogExpanded)}
                className="text-slate-400 hover:text-slate-100 p-0.5 rounded cursor-pointer"
              >
                {isLogExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
          </div>

          {isLogExpanded && (
            <div className="p-2.5 font-mono text-[11px] max-h-48 overflow-y-auto space-y-1 bg-slate-900/90 text-slate-300">
              {logs.length > 80 && !showAllLogs && (
                <div className="text-center py-1 border-b border-slate-800">
                  <button
                    onClick={() => setShowAllLogs(true)}
                    className="text-[10px] text-sky-400 hover:text-sky-300 underline cursor-pointer"
                  >
                    Tampilkan seluruh {logs.length} baris log (saat ini {displayedLogs.length} terakhir)
                  </button>
                </div>
              )}
              {displayedLogs.length > 0 ? (
                displayedLogs.map((line, idx) => renderLogLine(line, idx))
              ) : (
                <div className="text-slate-500 italic">
                  [Log] Penelusuran selesai: {nodeCount} node diproses dalam {elapsed}s.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Terminal Sources (Constants) */}
        {traceData.terminal_sources && traceData.terminal_sources.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <div className="flex items-center gap-1.5">
                <Terminal size={14} className="text-emerald-600" />
                <span>Sumber Input Terminal (Konstanta)</span>
              </div>
              <span className="text-[11px] text-slate-400 font-normal">
                {displayedTerminals.length} dari {terminalCount} sel
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {displayedTerminals.map((t) => (
                <div
                  key={t.id}
                  className="bg-emerald-50/60 border border-emerald-200 hover:border-emerald-300 hover:shadow-xs rounded-md p-2 flex flex-col gap-0.5 cursor-pointer transition"
                  onClick={() => onSelectCell(t.coordinate, t.sheet)}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-800">
                      {t.sheet}!{t.coordinate}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-medium">
                      d:{t.depth}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 truncate">
                    Nilai: <strong>{t.value !== null && t.value !== undefined ? String(t.value) : 'empty'}</strong>
                  </div>
                </div>
              ))}
            </div>

            {terminalCount > visibleTerminals && (
              <div className="mt-1 flex gap-2">
                <button
                  onClick={() => setVisibleTerminals((prev) => prev + 24)}
                  className="flex-1 py-1 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs rounded transition cursor-pointer flex items-center justify-center gap-1 font-medium"
                >
                  <ChevronDown size={13} />
                  +24 Terminal Lagi
                </button>
                <button
                  onClick={() => setVisibleTerminals(terminalCount)}
                  className="py-1 px-2.5 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                >
                  Tampilkan Semua ({terminalCount})
                </button>
              </div>
            )}
          </div>
        )}

        {/* Recursive Tree */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Pohon Dependensi Rekursif</span>
            <span className="text-[10px] text-slate-400 font-normal">Klik tanda panah untuk membuka cabang</span>
          </div>
          {traceData.tree && (
            <TreeNodeView node={traceData.tree} onSelectCell={onSelectCell} />
          )}
        </div>
      </div>
    </aside>
  );
}
