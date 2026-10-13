import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from './components/Navbar';
import Toolbar from './components/Toolbar';
import LuckysheetGrid from './components/LuckysheetGrid';
import FormulaSidebar from './components/FormulaSidebar';
import TracePanel from './components/TracePanel';
import CompareView from './components/CompareView';
import AuditPanel from './components/AuditPanel';
import DependencyGraphModal from './components/DependencyGraphModal';
import ResizableSidebar from './components/ResizableSidebar';
import RangeAnalysisPanel from './components/RangeAnalysisPanel';
import HiddenTracePanel from './components/HiddenTracePanel';
import { api } from './services/api';

export default function App() {
  const loadedSheetsCacheRef = useRef({});
  const [workbooks, setWorkbooks] = useState([]);
  const [activeWorkbookId, setActiveWorkbookId] = useState(null);
  const [activeWorkbookMeta, setActiveWorkbookMeta] = useState(null);
  const [activeLuckysheetData, setActiveLuckysheetData] = useState([]);
  const [activeSheetName, setActiveSheetName] = useState('');
  
  const [currentMode, setCurrentMode] = useState('explore');
  
  const [selectedRange, setSelectedRange] = useState(null);
  const [programmaticRange, setProgrammaticRange] = useState(null);
  const [rangeFilter, setRangeFilter] = useState(null);

  const [formulasData, setFormulasData] = useState(null);
  const [traceData, setTraceData] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [auditData, setAuditData] = useState(null);
  const [rangeAnalysisData, setRangeAnalysisData] = useState(null);
  const [hiddenTraceData, setHiddenTraceData] = useState(null);
  const [isLoadingHiddenTrace, setIsLoadingHiddenTrace] = useState(false);
  const [hiddenTraceScope, setHiddenTraceScope] = useState('active'); // 'active' | 'all'
  const [highlights, setHighlights] = useState([]);
  
  const [isScanningFormulas, setIsScanningFormulas] = useState(false);
  const [isTracing, setIsTracing] = useState(false);
  const [currentTraceTarget, setCurrentTraceTarget] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [zoomRatio, setZoomRatio] = useState(1);

  // Zoom handlers
  const handleZoomChange = useCallback((newRatio) => {
    const clamped = Math.min(2.0, Math.max(0.4, Math.round(newRatio * 100) / 100));
    setZoomRatio(clamped);
    if (window.luckysheet && window.luckysheet.setSheetZoom) {
      try {
        window.luckysheet.setSheetZoom(clamped);
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    const step = zoomRatio >= 1.0 ? 0.25 : 0.1;
    handleZoomChange(zoomRatio + step);
  }, [zoomRatio, handleZoomChange]);

  const handleZoomOut = useCallback(() => {
    const step = zoomRatio > 1.0 ? 0.25 : 0.1;
    handleZoomChange(zoomRatio - step);
  }, [zoomRatio, handleZoomChange]);

  const handleZoomReset = useCallback(() => {
    handleZoomChange(1.0);
  }, [handleZoomChange]);

  const [dbStatus, setDbStatus] = useState(null);

  const fetchDbStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/workbook/database-status');
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
      }
    } catch (e) {
      console.warn('Failed to fetch DB status:', e);
    }
  }, []);

  // Select and switch workbook
  const selectWorkbook = useCallback(async (wbId) => {
    setIsLoading(true);
    try {
      const info = await api.getWorkbookInfo(wbId);
      setActiveWorkbookId(wbId);
      setActiveWorkbookMeta(info);

      const firstSheet = info.sheets[0]?.name || 'Sheet1';
      setActiveSheetName(firstSheet);

      // Reset cache for new workbook
      loadedSheetsCacheRef.current = {};

      // Reset state for new workbook
      setTraceData(null);
      setRangeAnalysisData(null);
      setHiddenTraceData(null);
      setComparisonResult(null);
      setSelectedRange(null);
      setProgrammaticRange(null);
      setRangeFilter(null);
      setHighlights([]);

      const loadedWbList = await api.listWorkbooks();
      setWorkbooks(loadedWbList);

      // 1. Fetch all sheets' data for Luckysheet (fully populated with formulas & values)
      try {
        const allSheetsData = await api.getWorkbookData(wbId);
        if (allSheetsData && allSheetsData.length > 0) {
          allSheetsData.forEach((s) => {
            loadedSheetsCacheRef.current[s.name] = s;
          });
          setActiveLuckysheetData(allSheetsData);
        }
      } catch (e) {
        console.warn('Falling back to single sheet load:', e);
        const firstSheetData = await api.getSheetData(wbId, firstSheet);
        loadedSheetsCacheRef.current[firstSheet] = firstSheetData;

        const initialSheetsData = info.sheets.map((s, idx) => {
          if (s.name === firstSheet) {
            return {
              ...firstSheetData,
              index: String(idx),
              order: idx,
              status: 1,
            };
          }
          return {
            name: s.name,
            index: String(idx),
            color: '',
            status: 0,
            order: idx,
            row: Math.min(Math.max(s.max_row || 60, 60), 200),
            column: Math.min(Math.max(s.max_column || 26, 26), 50),
            celldata: [],
            config: { merge: {}, rowlen: {}, columnlen: {} },
          };
        });
        setActiveLuckysheetData(initialSheetsData);
      }

      // 2. Load anomalies in background (formulas stay in standby mode to save memory/speed)
      setFormulasData(null);
      api.getAuditAnomalies(wbId).then(setAuditData).catch(console.error);
    } catch (err) {
      console.error('Failed to load workbook:', err);
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load sample workbooks
  const handleLoadSamples = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.loadSampleWorkbooks();
      if (res.samples && res.samples.length > 0) {
        const list = await api.listWorkbooks();
        setWorkbooks(list);
        await selectWorkbook(res.samples[0].workbook_id);
      }
    } catch (err) {
      console.error('Error loading samples:', err);
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectWorkbook]);

  // 1. Initial Load
  const initApp = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      fetchDbStatus();
      const list = await api.listWorkbooks();

      if (list && list.length > 0) {
        setWorkbooks(list);
        await selectWorkbook(list[0].workbook_id);
      } else {
        await handleLoadSamples();
      }
    } catch (err) {
      console.error('Initialization error:', err);
      await handleLoadSamples();
    } finally {
      setIsLoading(false);
    }
  }, [fetchDbStatus, selectWorkbook, handleLoadSamples]);

  useEffect(() => {
    initApp();
  }, [initApp]);


  // Upload file
  const handleUploadFile = async (file) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.uploadWorkbook(file);
      fetchDbStatus();
      const list = await api.listWorkbooks();


      setWorkbooks(list);
      await selectWorkbook(res.workbook_id);
    } catch (err) {
      console.error('Upload failed:', err);
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSheetChange = useCallback(async (sheetIndex, sheetName) => {
    if (!sheetName) return;
    setActiveSheetName(sheetName);

    if (activeWorkbookId) {
      // Standby formulas on sheet change: do not auto-explore formulas to save memory/speed
      setFormulasData(null);

      // Lazy load sheet data if not already cached
      if (!loadedSheetsCacheRef.current[sheetName]) {
        try {
          const sData = await api.getSheetData(activeWorkbookId, sheetName);
          if (sData) {
            loadedSheetsCacheRef.current[sheetName] = sData;
            setActiveLuckysheetData((prev) => {
              return prev.map((s, idx) => {
                if (s.name === sheetName) {
                  return {
                    ...sData,
                    index: String(idx),
                    order: idx,
                    status: 1,
                  };
                }
                return { ...s, status: 0 };
              });
            });
          }
        } catch (e) {
          console.error('Error lazy loading sheet data:', e);
        }
      }
    }
  }, [activeWorkbookId]);

  // User Selection on Grid (Range or Single Cell)
  const handleRangeSelect = useCallback((rangeInfo) => {
    setSelectedRange(rangeInfo);
    setProgrammaticRange(null);
    if (rangeInfo.sheetName && rangeInfo.sheetName !== activeSheetName) {
      setActiveSheetName(rangeInfo.sheetName);
      setFormulasData(null);
    }
  }, [activeSheetName, activeWorkbookId]);

  // Manual Range Input submit
  const handleManualRangeSubmit = (rangeCoord) => {
    const clean = rangeCoord.trim().toUpperCase();
    const targetSheet = activeSheetName;
    setSelectedRange({
      coordinate: clean,
      isRange: clean.includes(':'),
      sheetName: targetSheet
    });
    setProgrammaticRange(clean);
  };

  // On-demand scanning and clearing of sheet formulas
  const handleLoadSheetFormulas = useCallback(async (targetSheet = activeSheetName) => {
    const sheet = targetSheet || activeSheetName;
    if (!activeWorkbookId || !sheet) return;
    setIsScanningFormulas(true);
    try {
      const res = await api.getSheetFormulas(activeWorkbookId, sheet);
      setFormulasData(res);
    } catch (err) {
      console.error('Error scanning formulas:', err);
      setErrorMessage(err.message || 'Gagal memindai formula');
    } finally {
      setIsScanningFormulas(false);
    }
  }, [activeWorkbookId, activeSheetName]);

  const handleClearSheetFormulas = useCallback(() => {
    setFormulasData(null);
  }, []);

  // Fetch hidden trace data
  const fetchHiddenTrace = useCallback(async (scope = hiddenTraceScope, sheet = activeSheetName) => {
    if (!activeWorkbookId) return null;
    setIsLoadingHiddenTrace(true);
    try {
      const sheetFilter = scope === 'active' ? (sheet || activeSheetName) : null;
      const res = await api.getHiddenTrace({
        workbook_id: activeWorkbookId,
        sheet_name: sheetFilter,
        only_in_use: true,
      });
      setHiddenTraceData(res);
      return res;
    } catch (err) {
      console.error('Error fetching hidden trace:', err);
      setErrorMessage(err.message || 'Gagal mengambil data tracing elemen tersembunyi');
      return null;
    } finally {
      setIsLoadingHiddenTrace(false);
    }
  }, [activeWorkbookId, hiddenTraceScope, activeSheetName]);

  // Perform Tracing on the selected range/cell
  const performTrace = async (cellCoord, direction = 'precedents') => {
    const targetSheet = selectedRange?.sheetName || activeSheetName;
    if (!activeWorkbookId || !targetSheet || !cellCoord) return;
    setIsTracing(true);
    setCurrentTraceTarget({ cell: cellCoord, sheet: targetSheet, direction });
    if (direction === 'precedents') {
      setCurrentMode('trace_precedents');
    } else {
      setCurrentMode('trace_dependents');
    }

    try {
      const result = await api.traceFormula({
        workbook_id: activeWorkbookId,
        sheet_name: targetSheet,
        cell: cellCoord,
        direction,
        max_depth: 15,
      });

      setTraceData(result);

      // Compute Highlights on sheet
      const hl = [];
      result.nodes.forEach((n) => {
        if (n.node_type === 'target') {
          hl.push({ sheet: n.sheet, coordinate: n.coordinate, color: '#38bdf8' });
        } else if (n.node_type === 'terminal') {
          hl.push({ sheet: n.sheet, coordinate: n.coordinate, color: '#a7f3d0' });
        } else if (n.node_type === 'circular') {
          hl.push({ sheet: n.sheet, coordinate: n.coordinate, color: '#fecdd3' });
        } else {
          hl.push({ sheet: n.sheet, coordinate: n.coordinate, color: '#bfdbfe' });
        }
      });
      setHighlights(hl);
      setProgrammaticRange({ coordinate: cellCoord, timestamp: Date.now() });
    } catch (err) {
      console.error('Trace error:', err);
      setErrorMessage(err.message);
    } finally {
      setIsTracing(false);
    }
  };

  // Analyze range for cross-sheet precedents, local formulas, and hardcoded values
  const handleAnalyzeRange = async (rangeCoord) => {
    const targetSheet = selectedRange?.sheetName || activeSheetName;
    if (!activeWorkbookId || !targetSheet || !rangeCoord) return;
    setIsLoading(true);
    try {
      const result = await api.analyzeRange({
        workbook_id: activeWorkbookId,
        sheet_name: targetSheet,
        range: rangeCoord,
      });

      setRangeAnalysisData(result);
      setCurrentMode('range_analysis');

      // Heatmap Highlights on spreadsheet:
      // - Cross-sheet: Sky Blue '#7dd3fc'
      // - Local formula: Soft Indigo '#c7d2fe'
      // - Hardcoded: Soft Amber '#fde68a'
      const hl = [];
      result.cells.forEach((c) => {
        let color = null;
        if (c.category === 'cross_sheet') {
          color = '#7dd3fc';
        } else if (c.category === 'local_formula') {
          color = '#c7d2fe';
        } else if (c.category === 'hardcoded') {
          color = '#fde68a';
        }
        if (color) {
          hl.push({ sheet: targetSheet, coordinate: c.coordinate, color });
        }
      });
      setHighlights(hl);
      setProgrammaticRange({ coordinate: rangeCoord, timestamp: Date.now() });
    } catch (err) {
      console.error('Range analysis error:', err);
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Open Dependency Graph
  const handleOpenGraph = async () => {
    const targetSheet = traceData?.target_sheet || selectedRange?.sheetName || activeSheetName;
    const targetCell = traceData?.target_cell || selectedRange?.coordinate;
    if (!activeWorkbookId || !targetSheet || !targetCell) return;
    try {
      const g = await api.getTraceGraph({
        workbook_id: activeWorkbookId,
        sheet_name: targetSheet,
        cell: targetCell,
        direction: traceData?.direction || 'precedents',
        max_depth: 15,
      });
      setGraphData(g);
      setIsGraphOpen(true);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message);
    }
  };

  // Run Comparison
  const handleRunComparison = async (params) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await api.compareSheets(params);
      setComparisonResult(result);

      const hl = result.diffs.map((d) => {
        let color = '#fef08a';
        if (d.diff_type === 'added') color = '#a7f3d0';
        if (d.diff_type === 'removed') color = '#fecdd3';
        if (d.diff_type === 'formula_changed') color = '#fed7aa';
        return {
          sheet: params.baseline_sheet_name,
          coordinate: d.baseline_coordinate || d.coordinate,
          color,
        };
      });
      setHighlights(hl);
      if (result.diffs.length > 0) {
        const firstCoord = result.diffs[0].baseline_coordinate || result.diffs[0].coordinate;
        setProgrammaticRange({ coordinate: firstCoord, timestamp: Date.now() });
      } else if (params.baseline_range) {
        setProgrammaticRange({ coordinate: params.baseline_range, timestamp: Date.now() });
      }
    } catch (err) {
      console.error('Comparison error:', err);
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Select Cell from Sidebar / Tree / Anomaly / Trace Header
  const handleSelectCoordinate = (coordinate, sheetName = null) => {
    const targetSheet = sheetName || activeSheetName;
    if (sheetName && sheetName !== activeSheetName) {
      handleSheetChange(null, sheetName);
    }
    setSelectedRange({
      coordinate,
      isRange: coordinate.includes(':'),
      sheetName: targetSheet,
    });
    setProgrammaticRange({ coordinate, timestamp: Date.now() });
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedRange(null);
    setTraceData(null);
    setRangeAnalysisData(null);
    setHighlights([]);
    setRangeFilter(null);
    setProgrammaticRange(null);
    if (currentMode === 'range_analysis') {
      setCurrentMode('explore');
    }
  };

  // Filter formulas in sidebar to selected range
  const handleFilterRangeFormulas = (rangeCoord) => {
    setRangeFilter(rangeCoord);
    setCurrentMode('explore');
  };

  // Mode changes
  const handleModeChange = (mode) => {
    setCurrentMode(mode);
    if (mode === 'audit' && auditData) {
      const hl = auditData.anomalies.map((a) => ({
        sheet: a.sheet,
        coordinate: a.coordinate,
        color: a.severity === 'high' ? '#fecdd3' : a.severity === 'medium' ? '#fed7aa' : '#bfdbfe',
      }));
      setHighlights(hl);
      if (auditData.anomalies.length > 0) {
        const first = auditData.anomalies.find(a => a.sheet === activeSheetName) || auditData.anomalies[0];
        if (first) {
          handleSelectCoordinate(first.coordinate, first.sheet);
        }
      }
    } else if (mode === 'range_analysis' && rangeAnalysisData) {
      const hl = [];
      rangeAnalysisData.cells.forEach((c) => {
        let color = null;
        if (c.category === 'cross_sheet') color = '#7dd3fc';
        else if (c.category === 'local_formula') color = '#c7d2fe';
        else if (c.category === 'hardcoded') color = '#fde68a';
        if (color) hl.push({ sheet: rangeAnalysisData.sheet_name, coordinate: c.coordinate, color });
      });
      setHighlights(hl);
      if (rangeAnalysisData.range) {
        setProgrammaticRange({ coordinate: rangeAnalysisData.range, timestamp: Date.now() });
      }
    } else if (mode === 'hidden_trace') {
      fetchHiddenTrace(hiddenTraceScope).then((data) => {
        if (data && data.hidden_cells) {
          const hl = data.hidden_cells.map((c) => ({
            sheet: c.sheet,
            coordinate: c.coordinate,
            color: c.has_visible_consumer ? '#fecdd3' : '#fed7aa',
          }));
          setHighlights(hl);
          if (data.hidden_cells.length > 0) {
            const first = data.hidden_cells.find(c => c.sheet === activeSheetName) || data.hidden_cells[0];
            if (first) {
              handleSelectCoordinate(first.coordinate, first.sheet);
            }
          }
        }
      });
    } else if (mode === 'explore') {
      setHighlights([]);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Top Navigation */}
      <Navbar
        workbooks={workbooks}
        activeWorkbookId={activeWorkbookId}
        onSelectWorkbook={selectWorkbook}
        onUploadFile={handleUploadFile}
        onLoadSamples={handleLoadSamples}
        isLoading={isLoading}
        activeWorkbookMeta={activeWorkbookMeta}
        totalAnomaliesCount={auditData?.total_anomalies || 0}
        dbStatus={dbStatus}
      />


      {/* Control Toolbar */}
      <Toolbar
        currentMode={currentMode}
        setMode={handleModeChange}
        selectedRange={selectedRange}
        activeSheetName={activeSheetName}
        onTrace={(dir) => selectedRange?.coordinate && performTrace(selectedRange.coordinate, dir)}
        onOpenGraph={handleOpenGraph}
        hasTraceData={Boolean(traceData)}
        onManualRangeSubmit={handleManualRangeSubmit}
        onClearSelection={handleClearSelection}
        onFilterRangeFormulas={handleFilterRangeFormulas}
        onAnalyzeRange={(coord) => handleAnalyzeRange(coord)}
        hasRangeAnalysis={Boolean(rangeAnalysisData)}
        zoomRatio={zoomRatio}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />

      {/* Error banner if present */}
      {errorMessage && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-800 px-4 py-2 flex items-center justify-between text-xs z-20 shrink-0">
          <span className="font-medium">Error: {errorMessage}</span>
          <button
            className="text-rose-500 hover:text-rose-700 font-bold p-1 cursor-pointer"
            onClick={() => setErrorMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex flex-1 w-full overflow-hidden relative">
        <div className="flex flex-col flex-1 h-full overflow-hidden relative">
          {/* Interactive Trace Header Ribbon when traceData exists */}
          {traceData && (
            <div className="bg-blue-50/90 border-b border-blue-200 px-4 py-2 flex items-center justify-between flex-wrap gap-2 text-xs z-10 shrink-0 shadow-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-600 font-semibold">Target:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
                  {traceData.target_sheet}!{traceData.target_cell}
                </span>
                {traceData.formula && (
                  <code className="font-mono text-xs bg-white text-blue-700 border border-blue-200 px-2 py-0.5 rounded shadow-xs font-semibold">
                    {traceData.formula}
                  </code>
                )}

                <span className="text-slate-600 font-semibold ml-2">Direct Precedents:</span>
                {traceData.nodes.filter(n => n.node_type !== 'target').slice(0, 5).map((n) => (
                  <button
                    key={n.id}
                    className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border transition cursor-pointer shadow-xs ${
                      n.node_type === 'terminal'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                        : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                    }`}
                    onClick={() => handleSelectCoordinate(n.coordinate, n.sheet)}
                    title={`Jump to ${n.sheet}!${n.coordinate} (Value: ${n.value})`}
                  >
                    {n.sheet !== activeSheetName ? `${n.sheet}!` : ''}{n.coordinate}
                    {n.node_type === 'terminal' ? ' (Input)' : ''}
                  </button>
                ))}
                {traceData.nodes.length > 6 && (
                  <span className="text-slate-400 text-xs">
                    +{traceData.nodes.length - 6} more
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition cursor-pointer"
                  onClick={handleOpenGraph}
                >
                  Diagram Graph
                </button>
                <button
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/80 transition cursor-pointer"
                  onClick={handleClearSelection}
                  title="Close trace view"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Luckysheet Grid */}
          <LuckysheetGrid
            containerId="luckysheet-main"
            data={activeLuckysheetData}
            onRangeSelect={handleRangeSelect}
            onSheetChange={handleSheetChange}
            highlights={highlights}
            activeSheetName={activeSheetName}
            programmaticRange={programmaticRange}
            zoomRatio={zoomRatio}
            onZoomChange={handleZoomChange}
          />
        </div>

        {/* Dynamic Sidebars according to currentMode */}
        <ResizableSidebar>
          {currentMode === 'explore' && (
            <FormulaSidebar
              formulasData={formulasData}
              activeSheetName={activeSheetName}
              onSelectCell={(coord) => handleSelectCoordinate(coord)}
              onTraceCell={(coord, dir) => {
                handleSelectCoordinate(coord);
                performTrace(coord, dir);
              }}
              rangeFilter={rangeFilter}
              onClearRangeFilter={() => setRangeFilter(null)}
              onLoadFormulas={handleLoadSheetFormulas}
              onClearFormulas={handleClearSheetFormulas}
              isScanningFormulas={isScanningFormulas}
            />
          )}

          {(currentMode === 'trace_precedents' || currentMode === 'trace_dependents') && (
            <TracePanel
              traceData={traceData}
              traceTarget={currentTraceTarget}
              onDirectionChange={(dir) => {
                const targetCoord = selectedRange?.coordinate || currentTraceTarget?.cell;
                if (targetCoord) performTrace(targetCoord, dir);
              }}
              onOpenGraph={handleOpenGraph}
              onSelectCell={(coord, sheet) => handleSelectCoordinate(coord, sheet)}
              isLoading={isTracing}
            />
          )}

          {currentMode === 'compare' && (
            <CompareView
              workbooks={workbooks}
              activeWorkbookId={activeWorkbookId}
              onRunComparison={handleRunComparison}
              comparisonResult={comparisonResult}
              isLoading={isLoading}
              onSelectDiffCell={(coord) => handleSelectCoordinate(coord, comparisonResult?.baseline_sheet_name)}
              selectedRange={selectedRange}
            />
          )}

          {currentMode === 'audit' && (
            <AuditPanel
              auditData={auditData}
              onSelectAnomalyCell={(coord, sheet) => handleSelectCoordinate(coord, sheet)}
              isLoading={isLoading}
            />
          )}

          {currentMode === 'hidden_trace' && (
            <HiddenTracePanel
              hiddenData={hiddenTraceData}
              isLoading={isLoadingHiddenTrace}
              onRefresh={() => fetchHiddenTrace(hiddenTraceScope)}
              activeSheetName={activeSheetName}
              onSelectCell={(coord, sheet, deps) => {
                handleSelectCoordinate(coord, sheet);
                if (deps && deps.length > 0) {
                  const hl = [
                    { sheet: sheet || activeSheetName, coordinate: coord, color: '#f59e0b' },
                    ...deps.map((d) => ({
                      sheet: d.sheet,
                      coordinate: d.coordinate,
                      color: d.is_consumer_visible ? '#fecdd3' : '#bfdbfe',
                    }))
                  ];
                  setHighlights(hl);
                } else {
                  setHighlights([
                    { sheet: sheet || activeSheetName, coordinate: coord, color: '#f59e0b' }
                  ]);
                }
              }}
              onTraceCell={(coord, sheet, dir) => {
                handleSelectCoordinate(coord, sheet);
                performTrace(coord, dir || 'dependents');
              }}
              scope={hiddenTraceScope}
              onScopeChange={(newScope) => {
                setHiddenTraceScope(newScope);
                fetchHiddenTrace(newScope);
              }}
            />
          )}

          {currentMode === 'range_analysis' && (
            <RangeAnalysisPanel
              rangeData={rangeAnalysisData}
              activeSheetName={activeSheetName}
              onSelectCell={(coord, sheet) => handleSelectCoordinate(coord, sheet)}
              onTraceCell={(coord, dir) => {
                handleSelectCoordinate(coord);
                performTrace(coord, dir);
              }}
              isLoading={isLoading}
              onClose={() => {
                setRangeAnalysisData(null);
                setCurrentMode('explore');
                setHighlights([]);
              }}
            />
          )}
        </ResizableSidebar>
      </div>

      {/* Dependency Graph Modal */}
      {isGraphOpen && (
        <DependencyGraphModal
          graphData={graphData}
          onClose={() => setIsGraphOpen(false)}
          onSelectNode={(coord, sheet) => handleSelectCoordinate(coord, sheet)}
        />
      )}
    </div>
  );
}
