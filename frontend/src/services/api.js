const BASE_URL = '/api';

export const api = {
  async uploadWorkbook(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/workbook/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },

  async loadSampleWorkbooks() {
    const res = await fetch(`${BASE_URL}/workbook/load-samples`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to load samples' }));
      throw new Error(err.detail || 'Failed to load samples');
    }
    return res.json();
  },

  async listWorkbooks() {
    const res = await fetch(`${BASE_URL}/workbook/list`);
    if (!res.ok) throw new Error('Failed to list workbooks');
    return res.json();
  },

  async getDatabaseStatus() {
    const res = await fetch(`${BASE_URL}/workbook/database-status`);
    if (!res.ok) throw new Error('Failed to fetch database status');
    return res.json();
  },

  async deleteWorkbook(id) {
    const res = await fetch(`${BASE_URL}/workbook/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete workbook');
    return res.json();
  },


  async getWorkbookInfo(id) {
    const res = await fetch(`${BASE_URL}/workbook/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Failed to get workbook info');
    return res.json();
  },

  async getWorkbookData(id) {
    const res = await fetch(`${BASE_URL}/workbook/${encodeURIComponent(id)}/data`);
    if (!res.ok) throw new Error('Failed to get workbook data');
    return res.json();
  },

  async getSheetData(id, sheetName) {
    const res = await fetch(`${BASE_URL}/workbook/${encodeURIComponent(id)}/sheet/${encodeURIComponent(sheetName)}`);
    if (!res.ok) throw new Error('Failed to get sheet data');
    return res.json();
  },

  async getSheetFormulas(id, sheetName) {
    const res = await fetch(`${BASE_URL}/workbook/${encodeURIComponent(id)}/sheet/${encodeURIComponent(sheetName)}/formulas`);
    if (!res.ok) throw new Error('Failed to get sheet formulas');
    return res.json();
  },

  async traceFormula({ workbook_id, sheet_name, cell, direction = 'precedents', max_depth = 15 }) {
    const res = await fetch(`${BASE_URL}/trace/formula`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workbook_id,
        sheet_name,
        cell,
        direction,
        max_depth,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Tracing failed' }));
      throw new Error(err.detail || 'Tracing failed');
    }
    return res.json();
  },

  async getTraceGraph({ workbook_id, sheet_name, cell, direction = 'precedents', max_depth = 15 }) {
    const res = await fetch(`${BASE_URL}/trace/graph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workbook_id,
        sheet_name,
        cell,
        direction,
        max_depth,
      }),
    });
    if (!res.ok) throw new Error('Failed to fetch trace graph');
    return res.json();
  },

  async compareSheets({
    baseline_workbook_id,
    baseline_sheet_name,
    target_workbook_id,
    target_sheet_name,
    baseline_range = null,
    target_range = null,
    cell_range = null,
    mode = 'exact_formula',
    alignment = 'coordinate',
  }) {
    const res = await fetch(`${BASE_URL}/compare/sheets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseline_workbook_id,
        baseline_sheet_name,
        target_workbook_id,
        target_sheet_name,
        baseline_range: baseline_range ? baseline_range.trim() : null,
        target_range: target_range ? target_range.trim() : null,
        cell_range: cell_range ? cell_range.trim() : null,
        mode,
        alignment,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Comparison failed' }));
      throw new Error(err.detail || 'Comparison failed');
    }
    return res.json();
  },

  async getAuditAnomalies(workbook_id, sheet_name = null, range = null) {
    let url = `${BASE_URL}/audit/anomalies?workbook_id=${encodeURIComponent(workbook_id)}`;
    if (sheet_name) {
      url += `&sheet_name=${encodeURIComponent(sheet_name)}`;
    }
    if (range) {
      url += `&range=${encodeURIComponent(range)}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch audit anomalies');
    return res.json();
  },

  async analyzeRange({ workbook_id, sheet_name, range }) {
    const res = await fetch(`${BASE_URL}/trace/range-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workbook_id,
        sheet_name,
        range,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Range analysis failed' }));
      throw new Error(err.detail || 'Range analysis failed');
    }
    return res.json();
  },

  async getHiddenTrace({ workbook_id, sheet_name = null, only_in_use = true }) {
    let url = `${BASE_URL}/trace/hidden?workbook_id=${encodeURIComponent(workbook_id)}&only_in_use=${only_in_use}`;
    if (sheet_name) {
      url += `&sheet_name=${encodeURIComponent(sheet_name)}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to fetch hidden trace' }));
      throw new Error(err.detail || 'Failed to fetch hidden trace');
    }
    return res.json();
  },

  async evaluateCell({ workbook_id, sheet_name, cell, formula = null }) {
    const res = await fetch(`${BASE_URL}/workbook/evaluate-cell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workbook_id, sheet_name, cell, formula }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Evaluation failed' }));
      throw new Error(err.detail || 'Evaluation failed');
    }
    return res.json();
  },

  async compareHistoricalStatements({
    statement_type = 'income_statement',
    items = [],
    alignment_mode = 'account_name',
    baseline_index = 0,
  }) {
    const res = await fetch(`${BASE_URL}/compare/historical-statements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        statement_type,
        items,
        alignment_mode,
        baseline_index,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Historical statement comparison failed' }));
      throw new Error(err.detail || 'Historical statement comparison failed');
    }
    return res.json();
  },

  async getAiStatus() {
    const res = await fetch(`${BASE_URL}/ai/status`);
    if (!res.ok) throw new Error('Failed to get AI status');
    return res.json();
  },

  async getAiModels() {
    const res = await fetch(`${BASE_URL}/ai/models`);
    if (!res.ok) throw new Error('Failed to get AI models');
    return res.json();
  },

  async streamAiChat({
    model,
    messages,
    contexts = {},
    system_prompt = null,
    onToken,
    onComplete,
    onError,
    signal,
  }) {
    try {
      const res = await fetch(`${BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          contexts,
          system_prompt,
          stream: true,
        }),
        signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'AI request failed' }));
        throw new Error(err.detail || 'AI request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.error) {
                if (onError) onError(new Error(parsed.error));
                return;
              }
              if (parsed.content) {
                fullText += parsed.content;
                if (onToken) onToken(parsed.content, fullText);
              }
              if (parsed.done) {
                if (onComplete) onComplete(fullText);
                return;
              }
            } catch (e) {
              console.warn('Error parsing SSE json:', e);
            }
          }
        }
      }
      if (onComplete) onComplete(fullText);
    } catch (err) {
      if (err.name !== 'AbortError' && onError) {
        onError(err);
      }
    }
  },
};


