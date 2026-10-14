import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import { api } from '../services/api';
import { WORKFLOW_PRESETS } from './WorkflowPresets';

const FlowContext = createContext(null);

export function FlowProvider({ children }) {
  // === View Modes ===
  // 'flow' (Kanvas Penuh) | 'split' (Kanvas Kiri + Spreadsheet Kanan) | 'spreadsheet' (Spreadsheet Penuh)
  const [viewMode, setViewMode] = useState('split');
  const [isAddNodeDrawerOpen, setIsAddNodeDrawerOpen] = useState(false);

  // === Dependency Graph Modal ===
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false);
  const [graphModalData, setGraphModalData] = useState(null);

  const openGraphModal = useCallback((data) => {
    setGraphModalData(data);
    setIsGraphModalOpen(true);
  }, []);

  const closeGraphModal = useCallback(() => {
    setIsGraphModalOpen(false);
    setGraphModalData(null);
  }, []);

  // === Two-Way Coordinate Pick State ===
  const [pickTargetNodeId, setPickTargetNodeId] = useState(null);

  // === Workbook & Spreadsheet State ===
  const loadedSheetsCacheRef = useRef({});
  const [workbooks, setWorkbooks] = useState([]);
  const [activeWorkbookId, setActiveWorkbookId] = useState(null);
  const [activeWorkbookMeta, setActiveWorkbookMeta] = useState(null);
  const [activeLuckysheetData, setActiveLuckysheetData] = useState([]);
  const [activeSheetName, setActiveSheetName] = useState('');
  const [selectedRange, setSelectedRange] = useState(null);
  const [programmaticRange, setProgrammaticRange] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [dbStatus, setDbStatus] = useState(null);
  const [zoomRatio, setZoomRatio] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // === Zoom Handlers ===
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

  // === Database Status ===
  const fetchDbStatus = useCallback(async () => {
    try {
      const res = await api.getDatabaseStatus();
      setDbStatus(res);
    } catch (e) {
      console.warn('DB status error:', e);
    }
  }, []);

  // === Workbook Selection & Data Loading ===
  const selectWorkbook = useCallback(async (wbId) => {
    if (!wbId) return;
    setIsLoading(true);
    try {
      const info = await api.getWorkbookInfo(wbId);
      setActiveWorkbookId(wbId);
      setActiveWorkbookMeta(info);

      const firstSheet = info.sheets[0]?.name || 'Sheet1';
      setActiveSheetName(firstSheet);
      loadedSheetsCacheRef.current = {};

      const allSheets = await api.getWorkbookData(wbId);
      if (allSheets && allSheets.length > 0) {
        allSheets.forEach((s) => {
          loadedSheetsCacheRef.current[s.name] = s;
        });
        setActiveLuckysheetData(allSheets);
      }
    } catch (err) {
      console.error('Failed to load workbook:', err);
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const changeSheet = useCallback(async (sheetName) => {
    if (!sheetName) return;
    setActiveSheetName(sheetName);
    if (activeWorkbookId && !loadedSheetsCacheRef.current[sheetName]) {
      try {
        const sData = await api.getSheetData(activeWorkbookId, sheetName);
        if (sData) {
          loadedSheetsCacheRef.current[sheetName] = sData;
          setActiveLuckysheetData((prev) =>
            prev.map((s, idx) => {
              if (s.name === sheetName) {
                return { ...sData, index: String(idx), order: idx, status: 1 };
              }
              return { ...s, status: 0 };
            })
          );
        }
      } catch (e) {
        console.error('Error loading sheet:', e);
      }
    }
  }, [activeWorkbookId]);

  const uploadWorkbook = useCallback(async (file) => {
    setIsLoading(true);
    try {
      const res = await api.uploadWorkbook(file);
      fetchDbStatus();
      const list = await api.listWorkbooks();
      setWorkbooks(list);
      await selectWorkbook(res.workbook_id);
      return res;
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchDbStatus, selectWorkbook]);

  const loadSamples = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.loadSampleWorkbooks();
      const list = await api.listWorkbooks();
      setWorkbooks(list);
      if (res.samples && res.samples.length > 0) {
        await selectWorkbook(res.samples[0].workbook_id);
      }
      return res;
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [selectWorkbook]);

  const deleteWorkbook = useCallback(async (wbId) => {
    setIsLoading(true);
    try {
      await api.deleteWorkbook(wbId);
      const list = await api.listWorkbooks();
      setWorkbooks(list);
      if (activeWorkbookId === wbId) {
        if (list.length > 0) {
          await selectWorkbook(list[0].workbook_id);
        } else {
          setActiveWorkbookId(null);
          setActiveWorkbookMeta(null);
          setActiveLuckysheetData([]);
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkbookId, selectWorkbook]);

  // === Two-Way Spreadsheet Selection Bridge ===
  const handleRangeSelect = useCallback((rangeInfo) => {
    setSelectedRange(rangeInfo);
    if (rangeInfo.sheetName && rangeInfo.sheetName !== activeSheetName) {
      setActiveSheetName(rangeInfo.sheetName);
    }
  }, [activeSheetName]);

  // === Initial Startup Load ===
  useEffect(() => {
    const init = async () => {
      fetchDbStatus();
      try {
        const list = await api.listWorkbooks();
        if (list && list.length > 0) {
          setWorkbooks(list);
          await selectWorkbook(list[0].workbook_id);
        } else {
          await loadSamples();
        }
      } catch (e) {
        console.warn('Init error:', e);
        await loadSamples();
      }
    };
    init();
  }, []);

  // === Flow Graph State (@xyflow/react) ===
  const [nodes, setNodes] = useState(WORKFLOW_PRESETS[0].nodes);
  const [edges, setEdges] = useState(WORKFLOW_PRESETS[0].edges);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback((connection) => {
    setEdges((eds) =>
      addEdge(
        {
          ...connection,
          animated: true,
          style: { stroke: '#3b82f6', strokeWidth: 2 },
        },
        eds
      )
    );
  }, []);

  const updateNodeData = useCallback((nodeId, partialData) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: { ...n.data, ...partialData },
          };
        }
        return n;
      })
    );
  }, []);

  const removeNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, []);

  const addNode = useCallback((type, position = null, initialData = {}) => {
    const newId = `node-${Date.now()}`;
    const pos = position || {
      x: 200 + Math.random() * 250,
      y: 150 + Math.random() * 200,
    };
    const newNode = {
      id: newId,
      type,
      position: pos,
      data: {
        workbook_id: activeWorkbookId,
        sheet_name: activeSheetName,
        coordinate: selectedRange?.coordinate || 'B8',
        ...initialData,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    return newId;
  }, [activeWorkbookId, activeSheetName, selectedRange]);

  const loadPreset = useCallback((presetId) => {
    const preset = WORKFLOW_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setNodes(preset.nodes);
    setEdges(preset.edges);
  }, []);

  const clearCanvas = useCallback(() => {
    if (window.confirm('Kosongkan kanvas alur kerja?')) {
      setNodes([]);
      setEdges([]);
      setHighlights([]);
    }
  }, []);

  const exportFlow = useCallback(() => {
    const flowData = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      nodes,
      edges,
    };
    const jsonStr = JSON.stringify(flowData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `excel_flow_pipeline_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  const importFlow = useCallback((jsonString) => {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
        setNodes(data.nodes);
        setEdges(data.edges);
      } else {
        alert('Format file alur kerja JSON tidak valid.');
      }
    } catch (e) {
      alert('Gagal membaca file JSON: ' + e.message);
    }
  }, []);

  // === Dynamic Data Propagation Along Edges ===
  useEffect(() => {
    if (!edges.length) return;

    edges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (!sourceNode || !targetNode) return;

      const sourceHandle = edge.sourceHandle;
      const targetHandle = edge.targetHandle;

      // Extract value from source
      let value = undefined;
      if (sourceHandle) {
        value = sourceNode.data[sourceHandle];
      } else {
        value = sourceNode.data;
      }

      // Only propagate when a defined value is available from source
      if (value !== undefined) {
        const currentInputs = targetNode.data.inputs || {};
        if (currentInputs[targetHandle] !== value) {
          updateNodeData(targetNode.id, {
            inputs: {
              ...currentInputs,
              [targetHandle]: value,
            },
          });
        }
      }
    });
  }, [nodes, edges, updateNodeData]);

  const value = {
    // View modes
    viewMode,
    setViewMode,
    isAddNodeDrawerOpen,
    setIsAddNodeDrawerOpen,

    // Modal
    isGraphModalOpen,
    graphModalData,
    openGraphModal,
    closeGraphModal,

    // Two-way pick
    pickTargetNodeId,
    setPickTargetNodeId,

    // Flow graph state
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    removeNode,
    updateNodeData,
    loadPreset,
    clearCanvas,
    exportFlow,
    importFlow,

    // Workbook state
    workbooks,
    activeWorkbookId,
    activeWorkbookMeta,
    activeLuckysheetData,
    activeSheetName,
    selectWorkbook,
    changeSheet,
    uploadWorkbook,
    loadSamples,
    deleteWorkbook,

    // Spreadsheet grid state
    selectedRange,
    handleRangeSelect,
    programmaticRange,
    setProgrammaticRange,
    highlights,
    setHighlights,
    zoomRatio,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleZoomChange,
    dbStatus,
    isLoading,
    errorMessage,
    setErrorMessage,
  };

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  const context = useContext(FlowContext);
  if (!context) {
    throw new Error('useFlow must be used within a FlowProvider');
  }
  return context;
}
