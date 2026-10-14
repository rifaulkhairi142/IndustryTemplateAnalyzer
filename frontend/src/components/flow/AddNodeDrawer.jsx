import React, { useState } from 'react';
import { useFlow } from '../../flow/FlowContext';
import {
  X,
  Search,
  FileSpreadsheet,
  Layers,
  Target,
  FunctionSquare,
  GitCommit,
  Calculator,
  EyeOff,
  Split,
  ShieldAlert,
  Table,
  GitFork,
  FileText,
  Plus,
} from 'lucide-react';

const NODE_CATALOG = [
  {
    category: 'Sources & Scopes',
    nodes: [
      {
        type: 'workbookSource',
        title: 'Workbook Source',
        desc: 'Unggah file Excel, pilih workbook aktif, muat demo & status DB',
        icon: FileSpreadsheet,
        badge: 'Source',
        color: 'text-blue-600 bg-blue-50 border-blue-200',
      },
      {
        type: 'sheetScope',
        title: 'Sheet Scope',
        desc: 'Pilih sheet aktif, lihat dimensi baris/kolom dan jumlah formula',
        icon: Layers,
        badge: 'Scope',
        color: 'text-purple-600 bg-purple-50 border-purple-200',
      },
      {
        type: 'cellRange',
        title: 'Cell / Range Selector',
        desc: 'Tentukan target koordinat sel (B8) atau range (B2:F10) & Pick from Grid',
        icon: Target,
        badge: 'Scope',
        color: 'text-purple-600 bg-purple-50 border-purple-200',
      },
    ],
  },
  {
    category: 'Intelligence & Analysis Engines',
    nodes: [
      {
        type: 'formulaDiscovery',
        title: 'Formula Discovery',
        desc: 'Pindai formula sheet on-demand, filter fungsi & kelompokkan pola R1C1',
        icon: FunctionSquare,
        badge: 'Engine',
        color: 'text-amber-600 bg-amber-50 border-amber-200',
      },
      {
        type: 'formulaTracer',
        title: 'Formula Tracer',
        desc: 'Lacak precedents & dependents, siklus circular, logs engine & akar input',
        icon: GitCommit,
        badge: 'Engine',
        color: 'text-amber-600 bg-amber-50 border-amber-200',
      },
      {
        type: 'formulaEvaluator',
        title: 'Formula Evaluator',
        desc: 'Kalkulasi nilai formula mandiri via Python engine & simulasi what-if',
        icon: Calculator,
        badge: 'Engine',
        color: 'text-amber-600 bg-amber-50 border-amber-200',
      },
      {
        type: 'rangeAnalysis',
        title: 'Range Heatmap Inspector',
        desc: 'Komposisi range: cross-sheet, formula lokal, angka hardcoded & heatmap',
        icon: Layers,
        badge: 'Engine',
        color: 'text-purple-600 bg-purple-50 border-purple-200',
      },
      {
        type: 'hiddenTrace',
        title: 'Hidden Elements Tracer',
        desc: 'Deteksi baris/kolom/sheet tersembunyi & Critical Visible Consumers',
        icon: EyeOff,
        badge: 'Engine',
        color: 'text-amber-600 bg-amber-50 border-amber-200',
      },
      {
        type: 'sheetComparator',
        title: 'Sheet Comparator',
        desc: 'Bandingkan sheet antar versi/file dengan dukungan shifted ranges',
        icon: Split,
        badge: 'Compare',
        color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      },
      {
        type: 'auditEngine',
        title: 'Audit & Anomaly Engine',
        desc: 'Pindai referensi data tersembunyi, inkonsistensi pola, hardcoded & error',
        icon: ShieldAlert,
        badge: 'Audit',
        color: 'text-rose-600 bg-rose-50 border-rose-200',
      },
    ],
  },
  {
    category: 'Displays, Inspectors & Outputs',
    nodes: [
      {
        type: 'spreadsheetViewer',
        title: 'Spreadsheet Anchor (Grid)',
        desc: 'Jangkar grid Luckysheet interaktif dengan sinkronisasi dua arah',
        icon: Table,
        badge: 'Visualizer',
        color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      },
      {
        type: 'dependencyGraph',
        title: 'Dependency Graph Visualizer',
        desc: 'Pratinjau graf SVG dependensi formula dengan stratified layered DAG',
        icon: GitFork,
        badge: 'Visualizer',
        color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      },
      {
        type: 'diffInspector',
        title: 'Diff Inspector Table',
        desc: 'Tabel perbandingan sel berdampingan dengan sorotan perubahan',
        icon: Split,
        badge: 'Inspector',
        color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      },
      {
        type: 'auditInspector',
        title: 'Audit Inspector Cards',
        desc: 'Kartu anomali dan peringatan dengan tingkat keparahan & jump to cell',
        icon: ShieldAlert,
        badge: 'Inspector',
        color: 'text-rose-600 bg-rose-50 border-rose-200',
      },
      {
        type: 'reportExport',
        title: 'Report & Export',
        desc: 'Ekspor rangkuman temuan pipeline ke format Markdown (.md) atau JSON',
        icon: FileText,
        badge: 'Report',
        color: 'text-slate-600 bg-slate-50 border-slate-200',
      },
    ],
  },
];

export default function AddNodeDrawer() {
  const { isAddNodeDrawerOpen, setIsAddNodeDrawerOpen, addNode } = useFlow();
  const [searchTerm, setSearchTerm] = useState('');

  if (!isAddNodeDrawerOpen) return null;

  const handleAdd = (type) => {
    addNode(type);
    setIsAddNodeDrawerOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-slideLeft">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Katalog Node Alur Kerja</h3>
            <p className="text-[11px] text-slate-500">Pilih node untuk ditambahkan ke kanvas pipeline</p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddNodeDrawerOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari tipe node atau fitur analisis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-blue-500 bg-slate-50/50"
            />
          </div>
        </div>

        {/* Catalog List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {NODE_CATALOG.map((section, sIdx) => {
            const matchingNodes = section.nodes.filter(
              (n) =>
                !searchTerm ||
                n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                n.desc.toLowerCase().includes(searchTerm.toLowerCase())
            );

            if (!matchingNodes.length) return null;

            return (
              <div key={sIdx} className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  {section.category}
                </h4>

                <div className="grid grid-cols-1 gap-2">
                  {matchingNodes.map((n) => {
                    const Icon = n.icon;
                    return (
                      <button
                        key={n.type}
                        type="button"
                        onClick={() => handleAdd(n.type)}
                        className="group w-full p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition text-left flex items-start gap-3 shadow-2xs hover:shadow-xs cursor-pointer"
                      >
                        <div className={`p-2 rounded-lg border shrink-0 ${n.color}`}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition">
                              {n.title}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-600">
                              {n.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                            {n.desc}
                          </p>
                        </div>
                        <div className="shrink-0 text-slate-300 group-hover:text-blue-600 p-1">
                          <Plus size={16} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
