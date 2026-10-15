import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Plus, Minus, ZoomIn, ZoomOut } from 'lucide-react';

// Helper to convert 0-indexed column to letter
export function indexToColLetter(c) {
  let letter = '';
  let temp = c + 1;
  while (temp > 0) {
    let rem = (temp - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
}

// Helper to parse coordinate string to indices
export function coordToRowCol(coordStr) {
  if (!coordStr) return null;
  const match = coordStr.replace('$', '').toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const colStr = match[1];
  const rowStr = match[2];
  let colIdx = 0;
  for (let i = 0; i < colStr.length; i++) {
    colIdx = colIdx * 26 + (colStr.charCodeAt(i) - 64);
  }
  return { row: parseInt(rowStr, 10) - 1, col: colIdx - 1 };
}

export default function LuckysheetGrid({
  containerId = 'luckysheet-main',
  data,
  onRangeSelect,
  onSheetChange,
  highlights = [],
  activeSheetName,
  programmaticRange,
  zoomRatio: externalZoom,
  onZoomChange
}) {
  const isInitializedRef = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  const activeSheetNameRef = useRef(activeSheetName);
  activeSheetNameRef.current = activeSheetName;

  const prevActiveSheetRef = useRef(activeSheetName);

  const onRangeSelectRef = useRef(onRangeSelect);
  onRangeSelectRef.current = onRangeSelect;

  const onSheetChangeRef = useRef(onSheetChange);
  onSheetChangeRef.current = onSheetChange;

  const prevDataRef = useRef(null);

  // Local Zoom State
  const [internalZoom, setInternalZoom] = useState(1);
  const zoomRatio = externalZoom !== undefined ? externalZoom : internalZoom;

  const applyZoom = useCallback((newRatio) => {
    const clamped = Math.min(2.0, Math.max(0.4, Math.round(newRatio * 100) / 100));
    setInternalZoom(clamped);
    if (onZoomChange) {
      onZoomChange(clamped);
    }
    if (window.luckysheet && window.luckysheet.setSheetZoom) {
      try {
        window.luckysheet.setSheetZoom(clamped);
      } catch (e) {
        console.warn('setSheetZoom error:', e);
      }
    }
  }, [onZoomChange]);

  const handleZoomIn = () => {
    const step = zoomRatio >= 1.0 ? 0.25 : 0.1;
    applyZoom(zoomRatio + step);
  };

  const handleZoomOut = () => {
    const step = zoomRatio > 1.0 ? 0.25 : 0.1;
    applyZoom(zoomRatio - step);
  };

  const handleZoomReset = () => {
    applyZoom(1.0);
  };

  // Helper to accurately scroll Luckysheet viewport to a given coordinate
  const scrollToTarget = useCallback((coordStr) => {
    if (!coordStr || !window.luckysheet) return;

    try {
      const clean = coordStr.replace('$', '').toUpperCase();
      let r = 0;
      let c = 0;

      if (clean.includes(':')) {
        const [start, end] = clean.split(':');
        const p1 = coordToRowCol(start);
        const p2 = coordToRowCol(end);
        if (p1 && p2) {
          const rMin = Math.min(p1.row, p2.row);
          const rMax = Math.max(p1.row, p2.row);
          const cMin = Math.min(p1.col, p2.col);
          const cMax = Math.max(p1.col, p2.col);

          if (window.luckysheet.setRangeShow) {
            window.luckysheet.setRangeShow([
              { row: [rMin, rMax], column: [cMin, cMax] }
            ]);
          }

          r = rMin;
          c = cMin;
        }
      } else {
        const p = coordToRowCol(clean);
        if (p) {
          if (window.luckysheet.setRangeShow) {
            window.luckysheet.setRangeShow([
              { row: [p.row, p.row], column: [p.col, p.col] }
            ]);
          }
          r = p.row;
          c = p.col;
        }
      }

      // Scroll so target cell is in view with a 2-row/col comfortable padding
      const targetRow = Math.max(0, r - 2);
      const targetColumn = Math.max(0, c - 2);

      // 1. Official Luckysheet scroll API
      if (window.luckysheet.scroll) {
        window.luckysheet.scroll({
          targetRow,
          targetColumn,
          toRow: targetRow,
          toColumn: targetColumn
        });
      }

      // 2. Direct DOM scrollbar fallback for Luckysheet canvas
      const scrollY = document.querySelector('#luckysheet-scrollbar-y');
      const scrollX = document.querySelector('#luckysheet-scrollbar-x');
      if (scrollY && typeof r === 'number') {
        const yPos = Math.max(0, targetRow * 20);
        scrollY.scrollTop = yPos;
        scrollY.dispatchEvent(new Event('scroll'));
      }
      if (scrollX && typeof c === 'number') {
        const xPos = Math.max(0, targetColumn * 73);
        scrollX.scrollLeft = xPos;
        scrollX.dispatchEvent(new Event('scroll'));
      }
    } catch (e) {
      console.warn('scrollToTarget error:', e);
    }
  }, []);

  // Initialize Luckysheet only on initial mount or when workbook data changes
  const initLuckysheet = useCallback(() => {
    if (!window.luckysheet || !data || data.length === 0) return;

    try {
      if (window.luckysheet.destroy) {
        window.luckysheet.destroy();
      }
    } catch (e) {
      // ignore
    }

    const clonedData = JSON.parse(JSON.stringify(data));

    const options = {
      container: containerId,
      showinfobar: false,
      showtoolbar: true,
      showsheetbar: true,
      showstatisticBar: true,
      sheetBottomConfig: true,
      allowEdit: false,
      enableAddRow: false,
      enableAddBackTop: false,
      data: clonedData,
      title: 'Web Excel Formula Intelligence',
      hook: {
        cellMousedown: (cell, postion, sheetFile, ctx) => {
          if (!postion) return;
          const r = postion.r;
          const c = postion.c;
          const coord = `${indexToColLetter(c)}${r + 1}`;
          const currentCellData = cell || (sheetFile.data && sheetFile.data[r] ? sheetFile.data[r][c] : null);
          const formula = currentCellData ? currentCellData.f : null;
          const value = currentCellData ? (currentCellData.v !== undefined ? currentCellData.v : currentCellData.m) : null;
          const targetSheet = sheetFile?.name || activeSheetNameRef.current;

          if (onRangeSelectRef.current) {
            onRangeSelectRef.current({
              coordinate: coord,
              isRange: false,
              startCell: coord,
              endCell: coord,
              cellCount: 1,
              formula: formula || null,
              value: value !== undefined ? value : null,
              sheetName: targetSheet
            });
          }
        },
        rangeSelect: (sheetFile, range) => {
          if (!range || range.length === 0) return;
          const sel = range[0];
          if (!sel || !sel.row || !sel.column) return;
          const r1 = Math.min(sel.row[0], sel.row[1]);
          const r2 = Math.max(sel.row[0], sel.row[1]);
          const c1 = Math.min(sel.column[0], sel.column[1]);
          const c2 = Math.max(sel.column[0], sel.column[1]);

          const startCell = `${indexToColLetter(c1)}${r1 + 1}`;
          const endCell = `${indexToColLetter(c2)}${r2 + 1}`;
          const isRange = (r1 !== r2 || c1 !== c2);
          const coord = isRange ? `${startCell}:${endCell}` : startCell;
          const cellCount = (r2 - r1 + 1) * (c2 - c1 + 1);
          const targetSheet = sheetFile?.name || activeSheetNameRef.current;

          let formula = null;
          let value = null;
          if (!isRange) {
            const cData = sheetFile.data && sheetFile.data[r1] ? sheetFile.data[r1][c1] : null;
            formula = cData ? cData.f : null;
            value = cData ? (cData.v !== undefined ? cData.v : cData.m) : null;
          }

          if (onRangeSelectRef.current) {
            onRangeSelectRef.current({
              coordinate: coord,
              isRange,
              startCell,
              endCell,
              cellCount,
              formula,
              value,
              sheetName: targetSheet
            });
          }
        },
        sheetActivate: (index, isPivotInitial, isNewSheet) => {
          let sheetName = null;
          if (window.luckysheet && window.luckysheet.getluckysheetfile) {
            try {
              const files = window.luckysheet.getluckysheetfile();
              if (files && files.length > 0) {
                const active = files.find(f => f.status === 1) || files.find(f => f.index == index || f.order == index) || files[index];
                if (active) sheetName = active.name;
              }
            } catch (e) {
              // ignore
            }
          }
          if (!sheetName && dataRef.current && dataRef.current[index]) {
            sheetName = dataRef.current[index].name;
          }

          if (sheetName && sheetName !== activeSheetNameRef.current) {
            activeSheetNameRef.current = sheetName;
            prevActiveSheetRef.current = sheetName;
            if (onSheetChangeRef.current) {
              onSheetChangeRef.current(index, sheetName);
            }
          }
        }
      }
    };

    window.luckysheet.create(options);
    isInitializedRef.current = true;
  }, [containerId, data]);

  // Only recreate Luckysheet when workbook data actually changes
  useEffect(() => {
    const dataChanged = prevDataRef.current !== data;
    if (!isInitializedRef.current || dataChanged) {
      prevDataRef.current = data;
      initLuckysheet();
    }
  }, [data, initLuckysheet]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      try {
        if (window.luckysheet && window.luckysheet.destroy) {
          window.luckysheet.destroy();
        }
      } catch (e) {
        // ignore
      }
      isInitializedRef.current = false;
    };
  }, []);

  // Smooth programmatic sheet switching without re-creating Luckysheet
  useEffect(() => {
    if (!activeSheetName || !window.luckysheet || !window.luckysheet.setSheetActive || !data) return;
    if (prevActiveSheetRef.current === activeSheetName) return;

    prevActiveSheetRef.current = activeSheetName;
    activeSheetNameRef.current = activeSheetName;

    const targetIdx = data.findIndex(s => s.name === activeSheetName);
    if (targetIdx !== -1) {
      try {
        const files = window.luckysheet.getluckysheetfile ? window.luckysheet.getluckysheetfile() : null;
        const curActive = files ? files.find(f => f.status === 1) : null;
        if (curActive && curActive.name === activeSheetName) {
          return; // Already active, no need to touch
        }
        window.luckysheet.setSheetActive(targetIdx);
      } catch (e) {
        // ignore
      }
    }
  }, [activeSheetName, data]);

  // Live apply highlights on active sheet and AUTO-SCROLL viewport to target highlight
  useEffect(() => {
    if (!window.luckysheet || !highlights || highlights.length === 0) return;

    const sheetHighlights = highlights.filter(h => !h.sheet || h.sheet === activeSheetName);
    if (sheetHighlights.length > 0) {
      if (window.luckysheet.setCellFormat) {
        // Limit highlight operations to max 150 cells to avoid canvas redraw lag
        const capped = sheetHighlights.slice(0, 150);
        capped.forEach(h => {
          const parsed = coordToRowCol(h.coordinate);
          if (parsed) {
            try {
              window.luckysheet.setCellFormat(parsed.row, parsed.col, "bg", h.color || "#38bdf8");
            } catch (e) {
              // ignore
            }
          }
        });
      }

      // Auto-scroll to the primary highlighted cell (e.g., target cell '#38bdf8' or first highlight)
      const primary = sheetHighlights.find(h => h.color === '#38bdf8') || sheetHighlights[0];
      if (primary && primary.coordinate) {
        const timer = setTimeout(() => {
          scrollToTarget(primary.coordinate);
        }, 80);
        return () => clearTimeout(timer);
      }
    }
  }, [highlights, activeSheetName, scrollToTarget]);

  // Handle programmatic selection and scrolling smoothly
  useEffect(() => {
    if (!programmaticRange || !window.luckysheet) return;

    const timer = setTimeout(() => {
      const coordStr = typeof programmaticRange === 'object' && programmaticRange
        ? programmaticRange.coordinate
        : programmaticRange;
      scrollToTarget(coordStr);
    }, 60);

    return () => clearTimeout(timer);
  }, [programmaticRange, activeSheetName, scrollToTarget]);

  // Support Ctrl + MouseWheel for smooth spreadsheet zooming
  useEffect(() => {
    const el = document.getElementById(containerId);
    if (!el) return;

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        applyZoom(zoomRatio + delta);
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [containerId, zoomRatio, applyZoom]);

  return (
    <div className="relative z-0 flex-1 w-full h-full overflow-hidden bg-white">
      <div id={containerId} />
    </div>
  );
}
