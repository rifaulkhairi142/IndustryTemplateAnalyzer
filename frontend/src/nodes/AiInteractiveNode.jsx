import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import BaseNode from './BaseNode';
import { useFlow } from '../flow/FlowContext';
import { api } from '../services/api';
import {
  Bot,
  Send,
  Sparkles,
  RefreshCw,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Square,
  Trash2,
  Cpu,
  MessageSquare,
} from 'lucide-react';

const QUICK_PROMPTS = [
  {
    id: 'reconciliation',
    title: 'Rekonsiliasi Akun',
    prompt:
      'Tolong lakukan analisis komparasi dan rekonsiliasi akun dari data laporan keuangan yang terhubung. Jelaskan akun apa saja yang tidak cocok atau hilang di salah satu workbook, dan berikan evaluasi signifikansinya.',
  },
  {
    id: 'formula_audit',
    title: 'Audit Alur Formula',
    prompt:
      'Analisis alur dependensi formula dari sel target yang terhubung. Apakah ada risiko integritas, referensi sirkular, atau konstanta yang di-hardcode yang berbahaya bagi model keuangan?',
  },
  {
    id: 'executive_summary',
    title: 'Ringkasan Eksekutif',
    prompt:
      'Buatkan ringkasan eksekutif berbasis poin-poin penting dari seluruh konteks pipeline yang terhubung (perbandingan akun, anomali formula, dan temuan audit).',
  },
  {
    id: 'optimization',
    title: 'Saran Perbaikan',
    prompt:
      'Berikan rekomendasi praktis untuk standardisasi dan perbaikan template laporan keuangan ini agar lebih konsisten, aman, dan mudah diaudit.',
  },
];

export default function AiInteractiveNode({ id, data }) {
  const { updateNodeData, removeNode } = useFlow();

  // Ollama local status & model selection
  const [ollamaStatus, setOllamaStatus] = useState({ online: false, host: 'http://localhost:11434' });
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(data.model || 'qwen2.5:latest');
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Chat conversation state
  const [messages, setMessages] = useState(
    data.messages || [
      {
        role: 'assistant',
        content:
          'Halo! Saya asisten AI lokal (Ollama). Hubungkan output dari node mana pun (Laporan Keuangan, Formula Tracer, Audit Anomaly) ke port input saya, lalu pilih prompt cepat atau ketik pertanyaan untuk memulai analisis interaktif.',
      },
    ]
  );
  const [inputPrompt, setInputPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Abort controller ref for stopping generation
  const abortControllerRef = useRef(null);
  const chatBottomRef = useRef(null);
  const modalChatBottomRef = useRef(null);

  // Gather all connected inputs from FlowContext
  const rawInputs = data.inputs || {};

  // Listen for Escape key to close fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollTop = chatBottomRef.current.scrollHeight;
    }
    if (modalChatBottomRef.current) {
      modalChatBottomRef.current.scrollTop = modalChatBottomRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, isFullscreen]);

  // Load Ollama status and models on mount
  const checkOllama = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const statusRes = await api.getAiStatus();
      setOllamaStatus(statusRes);

      const modelsRes = await api.getAiModels();
      const list = modelsRes.models || [];
      setModels(list);

      if (list.length > 0) {
        if (!list.some((m) => m.name === selectedModel)) {
          setSelectedModel(list[0].name);
        }
      }
    } catch (err) {
      console.warn('Ollama check failed:', err);
      setOllamaStatus({ online: false, error: err.message });
    } finally {
      setIsLoadingModels(false);
    }
  }, [selectedModel]);

  useEffect(() => {
    checkOllama();
  }, []);

  // Parse and identify distinct context sources internally for prompt augmentation
  const detectedContexts = useMemo(() => {
    const list = [];

    Object.entries(rawInputs).forEach(([key, val]) => {
      if (!val) return;

      if (val.matched_accounts || key === 'statement_data') {
        const accCount = val.matched_accounts?.length || 0;
        list.push({
          key,
          type: 'historical',
          title: 'Rekonsiliasi Akun',
          summary: `${accCount} akun dianalisis`,
          data: val,
        });
      } else if (val.nodes && val.edges) {
        list.push({
          key,
          type: 'graph',
          title: `Formula Tree (${val.target || 'Cell'})`,
          summary: `${val.nodes.length} nodes, ${val.edges.length} edges`,
          data: val,
        });
      } else if (val.anomalies || key === 'anomalies') {
        const count = Array.isArray(val) ? val.length : val.anomalies?.length || 0;
        list.push({
          key,
          type: 'audit',
          title: 'Audit Anomali & Risiko',
          summary: `${count} anomali formula`,
          data: val,
        });
      } else if (val.coordinate || val.cell_range || key === 'range_data') {
        list.push({
          key,
          type: 'range',
          title: `Cell Scope (${val.coordinate || val.cell_range || 'Grid'})`,
          summary: `Sheet: ${val.sheet_name || 'Active'}`,
          data: val,
        });
      } else {
        list.push({
          key,
          type: 'generic',
          title: `Input: ${key}`,
          summary: typeof val === 'object' ? `${Object.keys(val).length} atribut` : String(val).slice(0, 25),
          data: val,
        });
      }
    });

    return list;
  }, [rawInputs]);

  // Payload for AI stream
  const activeContextsPayload = useMemo(() => {
    const payload = {};
    detectedContexts.forEach((ctx) => {
      payload[ctx.key] = ctx.data;
    });
    return payload;
  }, [detectedContexts]);

  // Send Chat message to local Ollama with streaming
  const handleSendMessage = async (textToSend = null) => {
    const query = (textToSend || inputPrompt).trim();
    if (!query || isGenerating) return;

    if (!ollamaStatus.online) {
      alert('Layanan Ollama lokal tidak terdeteksi aktif pada http://localhost:11434. Pastikan Ollama sudah dijalankan.');
      return;
    }

    const newUserMessage = { role: 'user', content: query };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setInputPrompt('');
    setIsGenerating(true);
    setStreamingText('');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await api.streamAiChat({
        model: selectedModel,
        messages: updatedMessages.filter((m) => m.role === 'user' || m.role === 'assistant'),
        contexts: activeContextsPayload,
        signal: controller.signal,
        onToken: (_token, fullText) => {
          setStreamingText(fullText);
        },
        onComplete: (finalText) => {
          setMessages((prev) => {
            const nextList = [...prev, { role: 'assistant', content: finalText }];
            updateNodeData(id, {
              messages: nextList,
              ai_response: finalText,
            });
            return nextList;
          });
          setStreamingText('');
          setIsGenerating(false);
          abortControllerRef.current = null;
        },
        onError: (err) => {
          console.error('AI Stream Error:', err);
          const errorMsg = `Maaf, terjadi kesalahan saat berkomunikasi dengan Ollama: ${err.message || 'Error'}`;
          setMessages((prev) => [...prev, { role: 'assistant', content: errorMsg }]);
          setStreamingText('');
          setIsGenerating(false);
          abortControllerRef.current = null;
        },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Chat error:', err);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Gagal mengirim pesan: ${err.message}` },
        ]);
      }
      setIsGenerating(false);
      setStreamingText('');
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (streamingText) {
      setMessages((prev) => [...prev, { role: 'assistant', content: streamingText + ' *(Dihentikan)*' }]);
      setStreamingText('');
    }
    setIsGenerating(false);
  };

  const handleClearChat = () => {
    if (window.confirm('Bersihkan riwayat percakapan?')) {
      const resetList = [
        {
          role: 'assistant',
          content: 'Percakapan telah dibersihkan. Anda dapat mengajukan pertanyaan baru.',
        },
      ];
      setMessages(resetList);
      setStreamingText('');
      updateNodeData(id, { messages: resetList, ai_response: '' });
    }
  };

  const handleCopyMessage = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <>
      <BaseNode
        id={id}
        category="ai"
        icon={Bot}
        title="AI Interactive Analyst"
        subtitle={`Ollama (${selectedModel}) • ${detectedContexts.length} Konteks`}
        inputs={[
          { id: 'context_1', label: 'Konteks 1', tooltip: 'Output Node 1 (misal: Statement Data)' },
          { id: 'context_2', label: 'Konteks 2', tooltip: 'Output Node 2 (misal: Graph Data)' },
          { id: 'context_3', label: 'Konteks 3', tooltip: 'Output Node 3 (misal: Anomalies)' },
          { id: 'context_4', label: 'Konteks 4', tooltip: 'Output Node 4 (Konteks Bebas)' },
          { id: 'statement_data', label: 'Statement', tooltip: 'Koneksi langsung dari HistoricalStatement' },
          { id: 'graph_data', label: 'Graph', tooltip: 'Koneksi langsung dari FormulaTracer' },
        ]}
        outputs={[
          { id: 'ai_response', label: 'Response', tooltip: 'Teks jawaban lengkap dari AI' },
          { id: 'markdown_output', label: 'Markdown', tooltip: 'Format Markdown untuk ekspor' },
        ]}
        onDelete={() => removeNode(id)}
        onFullscreen={() => setIsFullscreen(true)}
        minWidth="min-w-[420px]"
        className="max-w-[480px]"
      >
        <div className="flex flex-col gap-2.5 text-xs text-slate-700">
          {/* Top Control Bar: Ollama Status, Model Picker & Fullscreen Trigger */}
          <div className="flex items-center justify-between gap-1.5 bg-slate-50/80 px-2.5 py-1.5 rounded-md border border-slate-200">
            {/* Status indicator */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${ollamaStatus.online ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                title={ollamaStatus.online ? `Ollama Aktif (${ollamaStatus.host})` : 'Ollama Tidak Terhubung'}
              />
              <span className="font-medium text-[11px] text-slate-700 truncate">
                {ollamaStatus.online ? 'Ollama Online' : 'Ollama Offline'}
              </span>
            </div>

            {/* Model Selector & Actions */}
            <div className="flex items-center gap-1">
              <select
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  updateNodeData(id, { model: e.target.value });
                }}
                disabled={isGenerating || !models.length}
                className="bg-white border border-slate-200 rounded-xs px-2 py-0.5 text-[11px] font-mono text-slate-700 focus:outline-none focus:border-slate-400 max-w-[145px] cursor-pointer"
              >
                {models.length === 0 ? (
                  <option value={selectedModel}>{selectedModel}</option>
                ) : (
                  models.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name} {m.parameter_size ? `(${m.parameter_size})` : ''}
                    </option>
                  ))
                )}
              </select>

              <button
                type="button"
                onClick={checkOllama}
                disabled={isLoadingModels}
                className="p-1 rounded-xs bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                title="Muat ulang status & daftar model Ollama"
              >
                <RefreshCw size={11} className={isLoadingModels ? 'animate-spin' : ''} />
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="px-2 py-0.5 rounded-xs bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                title="Buka Mode Layar Penuh"
              >
                <Maximize2 size={10} />
                <span>Layar Penuh</span>
              </button>
            </div>
          </div>

          {/* Connected Context Badge */}
          {detectedContexts.length > 0 && (
            <div className="flex items-center justify-between px-2 py-1 rounded-xs bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 font-medium">
              <span className="flex items-center gap-1.5">
                <Cpu size={12} className="text-slate-500" />
                <span>{detectedContexts.length} sumber konteks terhubung</span>
              </span>
            </div>
          )}

          {/* Quick Prompts Carousel */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp.id}
                type="button"
                onClick={() => handleSendMessage(qp.prompt)}
                disabled={isGenerating || !ollamaStatus.online}
                className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-xs bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                <span>{qp.title}</span>
              </button>
            ))}
          </div>

          {/* Chat Messages Stream Area */}
          <div
            ref={chatBottomRef}
            className="flex flex-col gap-2 p-2.5 bg-slate-50/70 rounded-md h-[240px] overflow-y-auto font-sans text-xs leading-relaxed border border-slate-200"
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col gap-1 rounded-md p-2.5 max-w-[92%] ${msg.role === 'user'
                  ? 'self-end bg-slate-900 text-white rounded-br-xs'
                  : 'self-start bg-white text-slate-800 rounded-bl-xs border border-slate-200/90 shadow-2xs'
                  }`}
              >
                <div
                  className={`flex items-center justify-between gap-2 text-[10px] font-medium ${msg.role === 'user' ? 'text-slate-300' : 'text-slate-400'
                    }`}
                >
                  <span>{msg.role === 'user' ? 'Anda' : `Asisten (${selectedModel})`}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyMessage(msg.content, idx)}
                    className="hover:opacity-100 opacity-75 transition-opacity cursor-pointer"
                    title="Salin teks"
                  >
                    {copiedIndex === idx ? (
                      <Check size={10} className="text-emerald-500" />
                    ) : (
                      <Copy size={10} />
                    )}
                  </button>
                </div>
                <div className="whitespace-pre-wrap break-words leading-normal select-text font-sans text-[11px]">
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Live Streaming Bubble */}
            {isGenerating && streamingText && (
              <div className="self-start bg-white text-slate-800 rounded-md rounded-bl-xs p-2.5 max-w-[92%] border border-slate-300 shadow-2xs flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-700 animate-pulse" />
                    <span>Memproses respons...</span>
                  </span>
                </div>
                <div className="whitespace-pre-wrap break-words leading-normal font-sans text-[11px] text-slate-800">
                  {streamingText}
                  <span className="inline-block w-1 h-3 bg-slate-700 ml-0.5 animate-pulse align-middle" />
                </div>
              </div>
            )}
          </div>

          {/* Chat Input & Action Bar */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-stretch gap-1.5">
              <textarea
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isGenerating}
                placeholder={
                  ollamaStatus.online
                    ? 'Tanyakan sesuatu tentang data yang terhubung (Enter untuk kirim)...'
                    : 'Ollama offline. Jalankan `ollama serve` di terminal terlebih dahulu.'
                }
                rows={2}
                className="flex-1 bg-white border border-slate-200 rounded-md p-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 resize-none leading-tight transition-colors"
              />

              <div className="flex flex-col justify-between gap-1">
                {isGenerating ? (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="px-2.5 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs flex items-center justify-center transition-colors cursor-pointer flex-1"
                    title="Hentikan respons AI"
                  >
                    <Square size={13} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!inputPrompt.trim() || !ollamaStatus.online}
                    className="px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium text-xs flex items-center justify-center transition-colors cursor-pointer flex-1"
                    title="Kirim pertanyaan ke Ollama"
                  >
                    <Send size={13} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleClearChat}
                  disabled={isGenerating}
                  className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer flex items-center justify-center"
                  title="Bersihkan riwayat percakapan"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
              <span>Shift+Enter untuk baris baru</span>
              <span>{messages.length - 1} pertukaran pesan</span>
            </div>
          </div>
        </div>
      </BaseNode>

      {/* Fullscreen Dedicated AI Chat Modal */}
      {isFullscreen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 select-auto"
            onClick={() => setIsFullscreen(false)}
          >
            <div
              className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden font-sans text-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-slate-900 flex items-center justify-center text-white shrink-0">
                    <Bot size={16} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                      <span>AI Interactive Analyst</span>
                      <span className="text-[11px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-xs font-mono font-normal">
                        {selectedModel}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{detectedContexts.length} sumber data pipeline aktif</span>
                      <span className="text-slate-300">•</span>
                      <span className="font-mono text-[11px]">{ollamaStatus.host}</span>
                    </p>
                  </div>
                </div>

                {/* Model Selector & Close Button */}
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 font-medium">Model:</span>
                    <select
                      value={selectedModel}
                      onChange={(e) => {
                        setSelectedModel(e.target.value);
                        updateNodeData(id, { model: e.target.value });
                      }}
                      disabled={isGenerating || !models.length}
                      className="bg-white text-slate-700 border border-slate-200 rounded-md px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-slate-400 cursor-pointer"
                    >
                      {models.length === 0 ? (
                        <option value={selectedModel}>{selectedModel}</option>
                      ) : (
                        models.map((m) => (
                          <option key={m.name} value={m.name}>
                            {m.name} {m.parameter_size ? `(${m.parameter_size})` : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsFullscreen(false)}
                    className="px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
                    title="Tutup Mode Layar Penuh (ESC)"
                  >
                    <Minimize2 size={13} />
                    <span>Tutup (ESC)</span>
                  </button>
                </div>
              </div>

              {/* Quick Prompts Bar */}
              <div className="px-5 py-2 bg-slate-50/70 border-b border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
                <span className="text-xs font-medium text-slate-500 shrink-0">Prompt Cepat:</span>
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.id}
                    type="button"
                    onClick={() => handleSendMessage(qp.prompt)}
                    disabled={isGenerating || !ollamaStatus.online}
                    className="shrink-0 px-2.5 py-1 rounded-xs bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {qp.title}
                  </button>
                ))}
              </div>

              {/* Spacious Fullscreen Chat Viewport */}
              <div
                ref={modalChatBottomRef}
                className="flex-1 p-6 overflow-y-auto flex flex-col gap-3.5 font-sans text-xs leading-relaxed bg-slate-50/30"
              >
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col gap-1.5 rounded-lg p-4 max-w-[82%] ${msg.role === 'user'
                      ? 'self-end bg-slate-900 text-white rounded-br-xs'
                      : 'self-start bg-white text-slate-800 rounded-bl-xs border border-slate-200 shadow-2xs'
                      }`}
                  >
                    <div
                      className={`flex items-center justify-between gap-3 text-[11px] font-medium ${msg.role === 'user' ? 'text-slate-300' : 'text-slate-400'
                        }`}
                    >
                      <span>
                        {msg.role === 'user' ? 'Anda' : `Asisten AI (${selectedModel})`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.content, idx)}
                        className="hover:opacity-100 opacity-75 transition-opacity cursor-pointer p-0.5 rounded-xs"
                        title="Salin pesan"
                      >
                        {copiedIndex === idx ? (
                          <span className="text-emerald-500 flex items-center gap-1 font-medium">
                            <Check size={11} /> Tersalin
                          </span>
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>

                    <div className="whitespace-pre-wrap break-words leading-relaxed select-text font-sans text-[13px]">
                      {msg.content}
                    </div>
                  </div>
                ))}

                {/* Fullscreen Live Streaming Bubble */}
                {isGenerating && streamingText && (
                  <div className="self-start bg-white text-slate-800 rounded-lg rounded-bl-xs p-4 max-w-[82%] border border-slate-300 shadow-2xs flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-700 animate-pulse" />
                        <span>Menyusun analisis...</span>
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap break-words leading-relaxed font-sans text-[13px] text-slate-800">
                      {streamingText}
                      <span className="inline-block w-1.5 h-4 bg-slate-700 ml-1 animate-pulse align-middle" />
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Chat Input Bar */}
              <div className="p-4 bg-white border-t border-slate-200 flex flex-col gap-2 shrink-0">
                <div className="flex items-stretch gap-2.5 max-w-4xl mx-auto w-full">
                  <textarea
                    value={inputPrompt}
                    onChange={(e) => setInputPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={isGenerating}
                    placeholder="Ketik instruksi analisis, tanyakan akun, formula, atau minta rekomendasi..."
                    rows={2}
                    className="flex-1 bg-white border border-slate-200 rounded-md p-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 resize-none font-sans leading-normal transition-colors"
                  />

                  <div className="flex items-center gap-2">
                    {isGenerating ? (
                      <button
                        type="button"
                        onClick={handleStopGeneration}
                        className="h-full px-4 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Hentikan respons"
                      >
                        <Square size={14} />
                        <span>Hentikan</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendMessage()}
                        disabled={!inputPrompt.trim() || !ollamaStatus.online}
                        className="h-full px-4 rounded-md bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Kirim ke Ollama"
                      >
                        <Send size={14} />
                        <span>Kirim</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleClearChat}
                      disabled={isGenerating}
                      className="h-full px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer flex items-center justify-center"
                      title="Bersihkan percakapan"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 max-w-4xl mx-auto w-full px-0.5">
                  <span>Enter untuk mengirim • Shift+Enter untuk baris baru • ESC untuk keluar</span>
                  <span>{messages.length - 1} pertukaran pesan aktif</span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}