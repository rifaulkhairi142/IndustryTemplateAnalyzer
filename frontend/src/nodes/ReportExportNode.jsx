import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import { FileDown, Copy, Check, FileText } from 'lucide-react';

export default function ReportExportNode({ id, data }) {
  const { removeNode } = useFlow();

  const [format, setFormat] = useState('markdown'); // 'markdown' | 'json'
  const [copied, setCopied] = useState(false);

  // Collect data passed from input port or node data
  const rawData = data.inputs?.data || data.data || {};

  const generateReportContent = () => {
    const timestamp = new Date().toLocaleString();

    if (format === 'json') {
      return JSON.stringify(
        {
          generated_at: timestamp,
          source_data: rawData,
        },
        null,
        2
      );
    }

    // Markdown format
    let md = `# Excel Formula Intelligence Report\n`;
    md += `**Waktu Analisis:** ${timestamp}\n\n`;
    md += `## Ringkasan Data Analisis\n`;

    if (rawData.target_cell || rawData.direction) {
      md += `### Formula Tracing\n`;
      md += `- **Target:** ${rawData.target_sheet || ''}!${rawData.target_cell || ''}\n`;
      md += `- **Arah:** ${rawData.direction || ''}\n`;
      md += `- **Total Node:** ${rawData.nodes?.length || 0}\n`;
      md += `- **Circular Reference:** ${rawData.has_circular_reference ? 'YA (Terdeteksi)' : 'Tidak'}\n\n`;
    }

    if (rawData.diff_count !== undefined) {
      md += `### Perbandingan Sheet (Diff)\n`;
      md += `- **Total Perbedaan:** ${rawData.diff_count}\n`;
      md += `- **Formula Changed:** ${rawData.formula_changed_count || 0}\n`;
      md += `- **Added:** ${rawData.added_count || 0} | **Removed:** ${rawData.removed_count || 0}\n\n`;
    }

    if (rawData.total_anomalies !== undefined) {
      md += `### Audit Anomali & Risiko\n`;
      md += `- **Total Anomali:** ${rawData.total_anomalies}\n`;
      md += `- **High:** ${rawData.high_severity_count || 0} | **Medium:** ${rawData.medium_severity_count || 0} | **Low:** ${rawData.low_severity_count || 0}\n\n`;
    }

    if (rawData.summary?.cross_sheet_count !== undefined) {
      md += `### Range Composition Heatmap\n`;
      md += `- **Cross-Sheet:** ${rawData.summary.cross_sheet_count}\n`;
      md += `- **Local Formula:** ${rawData.summary.local_formula_count}\n`;
      md += `- **Hardcoded:** ${rawData.summary.hardcoded_count}\n\n`;
    }

    md += `---\n*Dihasilkan secara otomatis oleh Web Excel Formula Intelligence Node Flow Pipeline.*`;
    return md;
  };

  const handleCopy = () => {
    const content = generateReportContent();
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const content = generateReportContent();
    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' : 'text/markdown',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `excel_intelligence_report.${format === 'json' ? 'json' : 'md'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <BaseNode
      id={id}
      category="report"
      icon={FileText}
      title="Report & Export"
      subtitle="Ekspor ringkasan hasil pipeline"
      inputs={[
        { id: 'data', label: 'Data', tooltip: 'Hubungkan output dari node analisis mana pun' },
      ]}
      onDelete={() => removeNode(id)}
      allowFullscreen={true}
      minWidth="min-w-[300px]"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          <label className="text-slate-600 font-semibold">Format:</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs"
          >
            <option value="markdown">Markdown (.md)</option>
            <option value="json">JSON (.json)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer shadow-2xs"
          >
            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            {copied ? 'Tersalin' : 'Copy'}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-md bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition cursor-pointer shadow-2xs"
          >
            <FileDown size={12} />
            Download
          </button>
        </div>
      </div>
    </BaseNode>
  );
}
