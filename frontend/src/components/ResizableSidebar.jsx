import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function ResizableSidebar({
  children,
  defaultWidth = 384,
  minWidth = 280,
  maxWidth = 720
}) {
  const [width, setWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('excel_formula_sidebar_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          return parsed;
        }
      }
    } catch (e) {
      // ignore
    }
    return defaultWidth;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef(0);
  const startWidthRef = useRef(width);

  // Resize Luckysheet when sidebar width changes
  const triggerLuckysheetResize = useCallback(() => {
    if (window.luckysheet && window.luckysheet.resize) {
      try {
        window.luckysheet.resize();
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      // Since the sidebar is docked to the right edge, moving cursor left expands sidebar width
      const delta = dragStartXRef.current - e.clientX;
      const newWidth = Math.min(Math.max(startWidthRef.current + delta, minWidth), maxWidth);
      setWidth(newWidth);
      triggerLuckysheetResize();
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      triggerLuckysheetResize();
      try {
        localStorage.setItem('excel_formula_sidebar_width', String(width));
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, width, minWidth, maxWidth, triggerLuckysheetResize]);

  // Double click drag handle to reset width to default
  const handleDoubleClick = () => {
    setWidth(defaultWidth);
    triggerLuckysheetResize();
    try {
      localStorage.setItem('excel_formula_sidebar_width', String(defaultWidth));
    } catch (e) {
      // ignore
    }
  };

  return (
    <div
      style={{ width: `${width}px` }}
      className="relative h-full flex shrink-0 group transition-none"
    >
      {/* Visual & Interactive Drag Handle */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        title="Tarik ke kiri/kanan untuk resize sidebar • Double-click untuk reset ukuran"
        className={`absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize z-40 flex items-center justify-center transition-colors ${
          isDragging ? 'bg-blue-500/20' : 'hover:bg-blue-400/20'
        }`}
      >
        <div
          className={`w-[3px] h-10 rounded-full transition-all ${
            isDragging ? 'bg-blue-600 scale-y-125' : 'bg-slate-300 group-hover:bg-blue-500'
          }`}
        />
      </div>

      {/* Content wrapper */}
      <div className="w-full h-full flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
