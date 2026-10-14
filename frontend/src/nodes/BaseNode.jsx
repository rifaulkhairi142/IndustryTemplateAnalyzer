import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ChevronDown, ChevronRight, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export const CATEGORY_COLORS = {
  source: {
    header: 'bg-blue-600 text-white',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    border: 'border-blue-300',
    glow: 'hover:border-blue-500 shadow-blue-500/10',
    port: '!bg-blue-500 !border-white',
  },
  scope: {
    header: 'bg-purple-600 text-white',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    border: 'border-purple-300',
    glow: 'hover:border-purple-500 shadow-purple-500/10',
    port: '!bg-purple-500 !border-white',
  },
  engine: {
    header: 'bg-amber-600 text-white',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    border: 'border-amber-300',
    glow: 'hover:border-amber-500 shadow-amber-500/10',
    port: '!bg-amber-500 !border-white',
  },
  compare: {
    header: 'bg-emerald-600 text-white',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    border: 'border-emerald-300',
    glow: 'hover:border-emerald-500 shadow-emerald-500/10',
    port: '!bg-emerald-500 !border-white',
  },
  audit: {
    header: 'bg-rose-600 text-white',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    border: 'border-rose-300',
    glow: 'hover:border-rose-500 shadow-rose-500/10',
    port: '!bg-rose-500 !border-white',
  },
  visual: {
    header: 'bg-cyan-700 text-white',
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    border: 'border-cyan-300',
    glow: 'hover:border-cyan-500 shadow-cyan-500/10',
    port: '!bg-cyan-500 !border-white',
  },
  report: {
    header: 'bg-slate-700 text-white',
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
    border: 'border-slate-300',
    glow: 'hover:border-slate-500 shadow-slate-500/10',
    port: '!bg-slate-500 !border-white',
  },
};

export default function BaseNode({
  id,
  data,
  category = 'source',
  icon: Icon,
  title,
  subtitle,
  inputs = [], // [{ id, label, type, tooltip }]
  outputs = [], // [{ id, label, type, tooltip }]
  status = 'idle', // 'idle' | 'running' | 'success' | 'error'
  statusMessage,
  onDelete,
  children,
  className = '',
  minWidth = 'min-w-[280px]',
  defaultCollapsed = false,
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const theme = CATEGORY_COLORS[category] || CATEGORY_COLORS.source;

  return (
    <div
      className={`relative rounded-xl border bg-white shadow-md transition-all ${theme.border} ${theme.glow} ${minWidth} ${className} font-sans text-slate-800 select-none`}
    >
      {/* Input Ports (Left Side) */}
      {inputs.map((inp, idx) => {
        const topPercent = inputs.length === 1 ? 50 : ((idx + 1) / (inputs.length + 1)) * 100;
        return (
          <div key={inp.id} className="relative">
            <Handle
              type="target"
              position={Position.Left}
              id={inp.id}
              style={{ top: `${topPercent}%` }}
              className={`!w-3 !h-3 !border-2 ${theme.port} transition hover:scale-125 z-10`}
              title={inp.tooltip || inp.label}
            />
            <span
              style={{ top: `${topPercent}%` }}
              className="absolute left-3.5 -translate-y-1/2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider pointer-events-none"
            >
              {inp.label}
            </span>
          </div>
        );
      })}

      {/* Output Ports (Right Side) */}
      {outputs.map((out, idx) => {
        const topPercent = outputs.length === 1 ? 50 : ((idx + 1) / (outputs.length + 1)) * 100;
        return (
          <div key={out.id} className="relative">
            <Handle
              type="source"
              position={Position.Right}
              id={out.id}
              style={{ top: `${topPercent}%` }}
              className={`!w-3 !h-3 !border-2 ${theme.port} transition hover:scale-125 z-10`}
              title={out.tooltip || out.label}
            />
            <span
              style={{ top: `${topPercent}%` }}
              className="absolute right-3.5 -translate-y-1/2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider pointer-events-none text-right"
            >
              {out.label}
            </span>
          </div>
        );
      })}

      {/* Node Header */}
      <div
        className={`px-3 py-2 rounded-t-xl flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing ${theme.header}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon size={16} className="shrink-0" />}
          <div className="min-w-0">
            <h4 className="text-xs font-bold leading-tight truncate">{title}</h4>
            {subtitle && (
              <p className="text-[10px] opacity-80 leading-none truncate">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Status Indicator */}
          {status === 'running' && (
            <span className="flex items-center gap-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-white animate-pulse">
              <Loader2 size={11} className="animate-spin" />
            </span>
          )}
          {status === 'success' && (
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-white" title="Eksekusi berhasil">
              <CheckCircle2 size={12} />
            </span>
          )}
          {status === 'error' && (
            <span className="text-[10px] bg-rose-500 px-1.5 py-0.5 rounded text-white font-bold" title={statusMessage || 'Error'}>
              <AlertCircle size={12} />
            </span>
          )}

          {/* Collapse/Expand */}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-0.5 hover:bg-white/20 rounded transition cursor-pointer text-white/90 hover:text-white"
            title={collapsed ? 'Buka detail' : 'Ciutkan'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>

          {/* Delete Node */}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-0.5 hover:bg-white/20 rounded transition cursor-pointer text-white/90 hover:text-white"
              title="Hapus node"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Node Body (Collapsible) */}
      {!collapsed && (
        <div className="p-3 text-xs flex flex-col gap-2.5 max-h-[480px] overflow-y-auto">
          {children}

          {statusMessage && (
            <div
              className={`text-[11px] p-2 rounded-md ${
                status === 'error'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-slate-50 text-slate-600 border border-slate-200'
              }`}
            >
              {statusMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
