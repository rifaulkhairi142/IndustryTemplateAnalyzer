import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Columns3,
  EyeOff,
  FileSpreadsheet,
  GitFork,
  Layers3,
  RefreshCw,
  Rows3,
  Search,
  Sheet,
  X,
} from 'lucide-react';

const EMPTY_SUMMARY = {
  total_hidden_rows: 0,
  hidden_rows_in_use: 0,
  total_hidden_cols: 0,
  hidden_cols_in_use: 0,
  total_hidden_sheets: 0,
  hidden_sheets_in_use: 0,
  total_hidden_cells_in_use: 0,
  critical_visible_consumers_count: 0,
};

const cn = (...classes) => classes.filter(Boolean).join(' ');

function Metric({ label, value, detail, tone = 'default', icon: Icon }) {
  const tones = {
    default: 'border-slate-200 bg-white text-slate-900',
    warning: 'border-amber-200 bg-amber-50/60 text-amber-950',
    danger: 'border-rose-200 bg-rose-50/60 text-rose-950',
  };

  return (
    <div className={cn('min-w-0 rounded-lg border px-3 py-2.5', tones[tone])}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium text-slate-500">{label}</span>
        {Icon && <Icon size={14} className="shrink-0 text-slate-400" />}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-semibold tracking-tight">{value}</span>
        {detail && <span className="truncate text-[10px] text-slate-500">{detail}</span>}
      </div>
    </div>
  );
}

function SectionHeading({ icon: Icon, children, count }) {
  return (
    <div className="flex items-center justify-between px-0.5 pb-1">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
        <Icon size={14} className="text-slate-400" />
        <span>{children}</span>
      </div>
      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
        {count}
      </span>
    </div>
  );
}

function RiskTag({ visible }) {
  if (!visible) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
      <AlertTriangle size={10} />
      Risiko tinggi
    </span>
  );
}

function Coordinate({ children, onClick, title = 'Sorot sel di spreadsheet' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] font-medium text-blue-700 transition hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
    >
      {children}
    </button>
  );
}

function ElementCard({ children, risk = false, className = '' }) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        risk
          ? 'border-amber-200/80 bg-amber-50/30 hover:border-amber-300'
          : 'border-slate-200 bg-white hover:border-slate-300',
        className
      )}
    >
      {children}
    </div>
  );
}

function ExpandButton({ expanded, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={label || (expanded ? 'Tutup detail' : 'Buka detail')}
      className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
    >
      {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
    </button>
  );
}

export default function HiddenTracePanel({
  hiddenData,
  isLoading,
  onRefresh,
  activeSheetName,
  onSelectCell,
  onTraceCell,
  scope,
  onScopeChange,
}) {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyVisibleConsumers, setOnlyVisibleConsumers] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});

  const summary = hiddenData?.summary || EMPTY_SUMMARY;
  const rawRows = hiddenData?.hidden_rows || [];
  const rawCols = hiddenData?.hidden_columns || [];
  const rawCells = hiddenData?.hidden_cells || [];
  const rawSheets = hiddenData?.hidden_sheets || [];
  const query = searchQuery.trim().toLowerCase();

  const filteredRows = useMemo(
    () =>
      rawRows.filter((row) => {
        if (onlyVisibleConsumers && !row.has_visible_consumer) return false;
        if (!query) return true;
        return `${row.sheet} row ${row.row} ${(row.cells_in_use || []).join(' ')}`
          .toLowerCase()
          .includes(query);
      }),
    [rawRows, query, onlyVisibleConsumers]
  );

  const filteredCols = useMemo(
    () =>
      rawCols.filter((col) => {
        if (onlyVisibleConsumers && !col.has_visible_consumer) return false;
        if (!query) return true;
        return `${col.sheet} col ${col.col_letter} ${(col.cells_in_use || []).join(' ')}`
          .toLowerCase()
          .includes(query);
      }),
    [rawCols, query, onlyVisibleConsumers]
  );

  const filteredCells = useMemo(
    () =>
      rawCells.filter((cell) => {
        if (onlyVisibleConsumers && !cell.has_visible_consumer) return false;
        if (!query) return true;
        return [
          `${cell.sheet}!${cell.coordinate}`,
          cell.formula || '',
          cell.value == null ? '' : String(cell.value),
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);
      }),
    [rawCells, query, onlyVisibleConsumers]
  );

  const filteredSheets = useMemo(
    () =>
      rawSheets.filter((sheet) => {
        if (!query) return true;
        return `${sheet.sheet} ${(sheet.cells_in_use || []).join(' ')}`
          .toLowerCase()
          .includes(query);
      }),
    [rawSheets, query]
  );

  const toggleExpand = (id) =>
    setExpandedItems((current) => ({ ...current, [id]: !current[id] }));

  const tabs = [
    { id: 'all', label: 'Semua', count: filteredRows.length + filteredCols.length + filteredCells.length + filteredSheets.length },
    { id: 'rows', label: 'Baris', count: filteredRows.length },
    { id: 'cols', label: 'Kolom', count: filteredCols.length },
    { id: 'cells', label: 'Sel', count: filteredCells.length },
    ...(rawSheets.length ? [{ id: 'sheets', label: 'Sheet', count: filteredSheets.length }] : []),
  ];

  const hasResults =
    filteredRows.length + filteredCols.length + filteredCells.length + filteredSheets.length > 0;

  if (isLoading) {
    return (
      <aside className="flex h-full min-h-64 w-full items-center justify-center border-l border-slate-200 bg-white p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <RefreshCw size={22} className="animate-spin text-slate-400" />
          <p className="text-xs text-slate-500">
            Menganalisis elemen tersembunyi dan dependensinya...
          </p>
        </div>
      </aside>
    );
  }

  const showSection = (tab) => activeTab === 'all' || activeTab === tab;

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-slate-200 bg-slate-50/50 text-slate-800">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100">
            <EyeOff size={16} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900">Hidden Trace</h2>
            <p className="truncate text-[11px] text-slate-500">
              Elemen tersembunyi dan dependensi formula
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          title="Muat ulang analisis"
          aria-label="Muat ulang analisis"
          className="shrink-0 rounded-md border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <RefreshCw size={14} />
        </button>
      </header>

      {/* Scope and filter */}
      <div className="shrink-0 space-y-3 border-b border-slate-200 bg-white px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-slate-500">Cakupan analisis</span>
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => onScopeChange('active')}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[11px] font-medium transition',
                scope === 'active'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70'
                  : 'text-slate-500 hover:text-slate-800'
              )}
            >
              Sheet aktif
            </button>
            <button
              type="button"
              onClick={() => onScopeChange('all')}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[11px] font-medium transition',
                scope === 'all'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70'
                  : 'text-slate-500 hover:text-slate-800'
              )}
            >
              Semua sheet
            </button>
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-4 text-slate-600">
          <input
            type="checkbox"
            checked={onlyVisibleConsumers}
            onChange={(event) => setOnlyVisibleConsumers(event.target.checked)}
            className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
          />
          <span>
            <span className="font-medium text-slate-700">Hanya risiko tinggi</span>
            <span className="ml-1 text-slate-500">— digunakan oleh sel yang terlihat</span>
          </span>
        </label>
      </div>

      {/* Summary */}
      <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-slate-200 bg-slate-50/70 p-3">
        <Metric
          label="Konsumen terlihat"
          value={summary.critical_visible_consumers_count}
          detail="sel terdampak"
          tone={summary.critical_visible_consumers_count > 0 ? 'danger' : 'default'}
          icon={AlertTriangle}
        />
        <Metric
          label="Sel tersembunyi aktif"
          value={summary.total_hidden_cells_in_use}
          detail="digunakan formula"
          tone="warning"
          icon={Layers3}
        />
        <Metric
          label="Baris tersembunyi"
          value={summary.hidden_rows_in_use}
          detail={`/ ${summary.total_hidden_rows} digunakan`}
          icon={Rows3}
        />
        <Metric
          label="Kolom tersembunyi"
          value={summary.hidden_cols_in_use}
          detail={`/ ${summary.total_hidden_cols} digunakan`}
          icon={Columns3}
        />
      </div>

      {/* Search and tabs */}
      <div className="shrink-0 space-y-2 border-b border-slate-200 bg-white px-3 pb-2.5 pt-3">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Cari sheet, koordinat, atau formula..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-8 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Hapus pencarian"
              className="absolute right-2 top-2 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition',
                activeTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'rounded px-1 text-[10px]',
                  activeTab === tab.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {!hasResults ? (
          <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={22} />
            </div>
            <p className="text-sm font-semibold text-slate-800">Tidak ada hasil</p>
            <p className="mt-1 max-w-56 text-xs leading-5 text-slate-500">
              Tidak ditemukan elemen tersembunyi yang sesuai dengan filter saat ini.
            </p>
            {(searchQuery || onlyVisibleConsumers) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setOnlyVisibleConsumers(false);
                }}
                className="mt-3 text-xs font-medium text-blue-700 hover:text-blue-800"
              >
                Hapus filter
              </button>
            )}
          </div>
        ) : (
          <>
            {showSection('rows') && filteredRows.length > 0 && (
              <section className="space-y-2">
                {activeTab === 'all' && (
                  <SectionHeading icon={Rows3} count={filteredRows.length}>Baris tersembunyi</SectionHeading>
                )}
                {filteredRows.map((row) => {
                  const key = `row-${row.sheet}-${row.row}`;
                  const expanded = !!expandedItems[key];
                  return (
                    <ElementCard key={key} risk={row.has_visible_consumer}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="rounded-md bg-slate-900 px-2 py-1 font-mono text-[11px] font-semibold text-white">
                            Row {row.row}
                          </span>
                          <span className="max-w-full truncate text-xs font-medium text-slate-700">{row.sheet}</span>
                          <RiskTag visible={row.has_visible_consumer} />
                        </div>
                        <ExpandButton expanded={expanded} onClick={() => toggleExpand(key)} label="Lihat sel yang merujuk baris" />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {(row.cells_in_use || []).slice(0, expanded ? undefined : 6).map((coord) => (
                          <Coordinate key={coord} onClick={() => onSelectCell(coord, row.sheet)}>{coord}</Coordinate>
                        ))}
                        {!expanded && (row.cells_in_use || []).length > 6 && (
                          <button type="button" onClick={() => toggleExpand(key)} className="px-1 text-[11px] font-medium text-slate-500 hover:text-blue-700">
                            +{row.cells_in_use.length - 6} lainnya
                          </button>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                        <span>{row.total_dependents_count ?? (row.cells_in_use || []).length} dependensi</span>
                        {row.has_visible_consumer && <span className="font-medium text-rose-700">Dipakai sel terlihat</span>}
                      </div>
                    </ElementCard>
                  );
                })}
              </section>
            )}

            {showSection('cols') && filteredCols.length > 0 && (
              <section className="space-y-2">
                {activeTab === 'all' && (
                  <SectionHeading icon={Columns3} count={filteredCols.length}>Kolom tersembunyi</SectionHeading>
                )}
                {filteredCols.map((col) => {
                  const key = `col-${col.sheet}-${col.col_letter}`;
                  const expanded = !!expandedItems[key];
                  return (
                    <ElementCard key={key} risk={col.has_visible_consumer}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="rounded-md bg-slate-900 px-2 py-1 font-mono text-[11px] font-semibold text-white">
                            Col {col.col_letter}
                          </span>
                          <span className="truncate text-xs font-medium text-slate-700">{col.sheet}</span>
                          <RiskTag visible={col.has_visible_consumer} />
                        </div>
                        <ExpandButton expanded={expanded} onClick={() => toggleExpand(key)} label="Lihat sel yang merujuk kolom" />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {(col.cells_in_use || []).slice(0, expanded ? undefined : 6).map((coord) => (
                          <Coordinate key={coord} onClick={() => onSelectCell(coord, col.sheet)}>{coord}</Coordinate>
                        ))}
                        {!expanded && (col.cells_in_use || []).length > 6 && (
                          <button type="button" onClick={() => toggleExpand(key)} className="px-1 text-[11px] font-medium text-slate-500 hover:text-blue-700">
                            +{col.cells_in_use.length - 6} lainnya
                          </button>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                        <span>{col.total_dependents_count ?? (col.cells_in_use || []).length} dependensi</span>
                        {col.has_visible_consumer && <span className="font-medium text-rose-700">Dipakai sel terlihat</span>}
                      </div>
                    </ElementCard>
                  );
                })}
              </section>
            )}

            {showSection('cells') && filteredCells.length > 0 && (
              <section className="space-y-2">
                {activeTab === 'all' && (
                  <SectionHeading icon={Layers3} count={filteredCells.length}>Sel tersembunyi</SectionHeading>
                )}
                {filteredCells.map((cell) => {
                  const key = `cell-${cell.sheet}-${cell.coordinate}`;
                  const expanded = !!expandedItems[key];
                  const dependents = cell.dependents || [];
                  return (
                    <ElementCard key={key} risk={cell.has_visible_consumer}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSelectCell(cell.coordinate, cell.sheet, cell.dependents)}
                              title="Navigasi dan sorot sel"
                              className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                            >
                              {cell.sheet}!{cell.coordinate}
                              <ArrowUpRight size={12} />
                            </button>
                            {cell.hidden_reasons?.map((reason, index) => (
                              <span key={`${reason}-${index}`} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                                {reason === 'hidden_row'
                                  ? `Row ${cell.row}`
                                  : reason === 'hidden_col'
                                    ? `Col ${cell.col_letter}`
                                    : 'Sheet hidden'}
                              </span>
                            ))}
                          </div>
                          {cell.has_visible_consumer && <div className="mt-1.5"><RiskTag visible /></div>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onTraceCell(cell.coordinate, cell.sheet, 'dependents')}
                            className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] font-medium text-blue-700 transition hover:bg-blue-100"
                            title="Telusuri dependensi sel"
                          >
                            <GitFork size={12} />
                            Trace
                          </button>
                          <ExpandButton expanded={expanded} onClick={() => toggleExpand(key)} label="Lihat detail dependensi" />
                        </div>
                      </div>

                      <div className="mt-3 rounded-md border border-slate-200/80 bg-slate-50 px-2.5 py-2">
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          {cell.formula ? 'Formula' : 'Nilai sel'}
                        </p>
                        <p className="break-all font-mono text-[11px] leading-5 text-slate-700">
                          {cell.formula || (cell.value !== null && cell.value !== undefined ? String(cell.value) : 'Kosong')}
                        </p>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span>Digunakan oleh <strong className="font-semibold text-slate-700">{cell.dependents_count ?? dependents.length}</strong> formula</span>
                        <button type="button" onClick={() => toggleExpand(key)} className="font-medium text-blue-700 hover:text-blue-900">
                          {expanded ? 'Tutup detail' : 'Lihat pemakai'}
                        </button>
                      </div>

                      {expanded && (
                        <div className="mt-3 space-y-1.5 border-l-2 border-slate-200 pl-2.5">
                          {dependents.length ? dependents.map((dependent, index) => (
                            <button
                              type="button"
                              key={`${dependent.sheet}-${dependent.coordinate}-${index}`}
                              onClick={() => onSelectCell(dependent.coordinate, dependent.sheet)}
                              className={cn(
                                'block w-full rounded-md border p-2 text-left transition',
                                dependent.is_consumer_visible
                                  ? 'border-rose-200 bg-rose-50/50 hover:bg-rose-50'
                                  : 'border-slate-200 bg-white hover:bg-slate-50'
                              )}
                            >
                              <span className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-mono text-[11px] font-semibold text-blue-700">
                                  {dependent.sheet}!{dependent.coordinate}
                                </span>
                                <span className={cn(
                                  'rounded px-1.5 py-0.5 text-[10px]',
                                  dependent.is_consumer_visible
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-slate-100 text-slate-500'
                                )}>
                                  {dependent.is_consumer_visible ? 'Sel terlihat' : 'Ikut tersembunyi'}
                                </span>
                              </span>
                              {dependent.formula && (
                                <span className="mt-1 block break-all font-mono text-[10px] leading-4 text-slate-500">
                                  {dependent.formula}
                                </span>
                              )}
                            </button>
                          )) : (
                            <p className="py-2 text-xs text-slate-500">Detail dependensi tidak tersedia.</p>
                          )}
                        </div>
                      )}
                    </ElementCard>
                  );
                })}
              </section>
            )}

            {showSection('sheets') && filteredSheets.length > 0 && (
              <section className="space-y-2">
                {activeTab === 'all' && (
                  <SectionHeading icon={FileSpreadsheet} count={filteredSheets.length}>Sheet tersembunyi</SectionHeading>
                )}
                {filteredSheets.map((sheet) => (
                  <ElementCard key={sheet.sheet}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Sheet size={14} className="shrink-0 text-slate-400" />
                        <span className="truncate text-xs font-semibold text-slate-800">{sheet.sheet}</span>
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                          {sheet.state}
                        </span>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-500">
                        {sheet.total_dependents_count} dependensi
                      </span>
                    </div>
                    {(sheet.cells_in_use || []).length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {(sheet.cells_in_use || []).map((coord) => (
                          <Coordinate key={coord} onClick={() => onSelectCell(coord, sheet.sheet)}>{coord}</Coordinate>
                        ))}
                      </div>
                    )}
                  </ElementCard>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
