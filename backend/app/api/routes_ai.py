import json
import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from backend.app.services.ollama_service import ollama_service
from backend.app.utils.logger import log_ai, log_error

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI & Ollama Intelligence"])

class ChatMessage(BaseModel):
    role: str # 'user' | 'assistant' | 'system'
    content: str

class AiChatRequest(BaseModel):
    model: str = Field(default="qwen2.5:latest", description="Nama model Ollama (e.g. qwen2.5:latest, gemma4:e2b)")
    messages: List[ChatMessage] = Field(..., description="Daftar percakapan chat")
    contexts: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Kumpulan konteks data dari output node pipeline")
    system_prompt: Optional[str] = Field(default=None, description="Custom system instruction")
    stream: bool = Field(default=True, description="Gunakan SSE streaming response")
    options: Optional[Dict[str, Any]] = Field(default=None, description="Ollama parameter options (temperature, num_ctx, etc.)")


def format_pipeline_contexts_to_markdown(contexts: Dict[str, Any]) -> str:
    """
    Format incoming node output contexts into clean, structured Markdown
    optimized for LLM reasoning and financial analysis.
    """
    if not contexts:
        return ""

    sections = []

    for key, data in contexts.items():
        if data is None:
            continue

        # If data is string/primitive
        if isinstance(data, (str, int, float, bool)):
            sections.append(f"### [Port Konteks: {key}]\n`{data}`\n")
            continue

        # 1. Historical Statement Comparison Result
        if isinstance(data, dict) and "matched_accounts" in data:
            st_type = data.get("statement_type", "Financial Statement")
            accounts = data.get("matched_accounts", [])
            sec = [f"### [Konteks: Perbandingan Laporan Keuangan Historis ({st_type})]\n"]
            sec.append(f"- **Total Akun Terpetakan:** {len(accounts)}")
            
            # Format top accounts as a markdown table
            headers = ["Nama Akun"]
            # get labels
            sample_acc = accounts[0] if accounts else None
            if sample_acc and "workbooks" in sample_acc:
                for wb in sample_acc["workbooks"]:
                    headers.append(f"{wb.get('workbook_id', 'WB')} ({wb.get('sheet_name', 'Sheet')})")
            
            sec.append("| " + " | ".join(headers) + " |")
            sec.append("| " + " | ".join(["---"] * len(headers)) + " |")

            for acc in accounts[:40]: # limit to top 40 accounts to keep token usage optimal
                row = [acc.get("account_name", "-")]
                for wb in acc.get("workbooks", []):
                    found = wb.get("found", False)
                    if found:
                        val = wb.get("value", "-")
                        coord = wb.get("coordinate", "")
                        row.append(f"{val} `{coord}`" if coord else f"{val}")
                    else:
                        row.append("❌ *(Tidak ada)*")
                sec.append("| " + " | ".join(row) + " |")

            if len(accounts) > 40:
                sec.append(f"\n*(... dan {len(accounts) - 40} akun lainnya)*\n")

            sections.append("\n".join(sec))
            continue

        # 2. Formula Tracing Graph Data
        if isinstance(data, dict) and ("nodes" in data and "edges" in data):
            target = data.get("target", "Target Cell")
            nodes = data.get("nodes", [])
            edges = data.get("edges", [])
            has_circ = data.get("has_circular", False)
            sec = [f"### [Konteks: Formula Dependency Graph ({target})]\n"]
            sec.append(f"- **Target Sel:** `{target}`")
            sec.append(f"- **Total Node:** {len(nodes)} sel")
            sec.append(f"- **Total Hubungan (Edges):** {len(edges)}")
            sec.append(f"- **Circular Reference:** {'⚠️ YA TERDETEKSI' if has_circ else 'Tidak ada'}\n")

            sec.append("**Daftar Sel Precedent Utama:**")
            for n in nodes[:25]:
                coord = n.get("coordinate", "")
                sheet = n.get("sheet", "")
                formula = n.get("formula")
                val = n.get("value")
                node_type = n.get("node_type", "precedent")
                if formula:
                    sec.append(f"- `{sheet}!{coord}` ({node_type}): formula `{formula}` -> nilai: `{val}`")
                else:
                    sec.append(f"- `{sheet}!{coord}` (Terminal Input): konstanta `{val}`")

            if len(nodes) > 25:
                sec.append(f"- *(... dan {len(nodes) - 25} sel lainnya)*")

            sections.append("\n".join(sec))
            continue

        # 3. Audit Engine Anomalies
        if isinstance(data, dict) and "anomalies" in data:
            anomalies = data.get("anomalies", [])
            sec = [f"### [Konteks: Audit Anomali & Risiko Formula]\n"]
            sec.append(f"- **Total Anomali Ditemukan:** {len(anomalies)}\n")
            for a in anomalies[:20]:
                cell = a.get("cell", "-")
                typ = a.get("type", "Anomaly")
                sev = a.get("severity", "medium").upper()
                msg = a.get("message", "")
                sec.append(f"- `[{sev}]` **Sel {cell}** ({typ}): {msg}")
            sections.append("\n".join(sec))
            continue

        # 4. Sheet Diff Comparison
        if isinstance(data, dict) and "diff_count" in data:
            sec = [f"### [Konteks: Perbandingan Sheet (Diff)]\n"]
            sec.append(f"- **Total Perbedaan:** {data.get('diff_count')}")
            sec.append(f"- **Formula Berubah:** {data.get('formula_changed_count', 0)}")
            sec.append(f"- **Sel Baru:** {data.get('added_count', 0)}")
            sec.append(f"- **Sel Dihapus:** {data.get('removed_count', 0)}\n")
            sections.append("\n".join(sec))
            continue

        # 5. Generic Dict or List fallback
        try:
            json_preview = json.dumps(data, indent=2, ensure_ascii=False)
            if len(json_preview) > 3000:
                json_preview = json_preview[:3000] + "\n... (dipotong untuk efisiensi token)"
            sections.append(f"### [Konteks: {key}]\n```json\n{json_preview}\n```\n")
        except Exception:
            sections.append(f"### [Konteks: {key}]\n{str(data)[:2000]}\n")

    return "\n\n".join(sections)


@router.get("/status")
async def get_ollama_status():
    """Periksa status koneksi lokal Ollama."""
    return await ollama_service.get_status()


@router.get("/models")
async def get_ollama_models():
    """Ambil daftar model yang terpasang di Ollama lokal."""
    models = await ollama_service.list_models()
    return {
        "status": "success",
        "count": len(models),
        "models": models,
    }


@router.post("/chat")
async def chat_with_ai(req: AiChatRequest):
    """
    Endpoint interaktif chat AI menggunakan model lokal Ollama.
    Mendukung SSE streaming response dan injeksi otomatis konteks pipeline.
    """
    # 1. Cek ketersediaan model
    if not req.model:
        raise HTTPException(status_code=400, detail="Parameter model wajib diisi.")

    ctx_keys = list((req.contexts or {}).keys())
    log_ai(
        f"Chat request received: Model='{req.model}', Stream={req.stream}, "
        f"Messages={len(req.messages)}, Pipeline Contexts={ctx_keys if ctx_keys else 'None'}"
    )

    # 2. Bangun System Prompt yang kuat & konteks pipeline
    context_markdown = format_pipeline_contexts_to_markdown(req.contexts or {})

    default_system = (
        "Anda adalah AI Asisten Analis Keuangan & Auditor Formula Excel Senior.\n"
        "Tugas Anda adalah membantu pengguna memahami alur kerja laporan keuangan, mengidentifikasi perbedaan akun/template, "
        "menganalisis dependensi formula, mendeteksi risiko anomali, serta memberikan insight profesional, ringkas, dan jelas.\n"
        "Gunakan Bahasa Indonesia yang ramah, profesional, dan berbasis data dari konteks yang diberikan di bawah ini."
    )

    final_system_prompt = req.system_prompt.strip() if req.system_prompt else default_system

    if context_markdown:
        final_system_prompt += (
            "\n\n========================================\n"
            "DATA KONTEKS PIPELINE EXCEL (DITERIMA DARI NODE TERHUBUNG):\n"
            "========================================\n"
            f"{context_markdown}\n"
            "========================================\n"
            "Gunakan data konteks di atas untuk menjawab pertanyaan atau menganalisis temuan secara spesifik dan akurat.\n"
        )

    # 3. Susun daftar messages untuk Ollama
    full_messages = [{"role": "system", "content": final_system_prompt}]
    for m in req.messages:
        full_messages.append({"role": m.role, "content": m.content})

    # 4. Return SSE Streaming atau Non-streaming JSON
    if req.stream:
        return StreamingResponse(
            ollama_service.chat_stream(
                model=req.model,
                messages=full_messages,
                options=req.options
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )
    else:
        # Non-streaming
        last_user_message = req.messages[-1].content if req.messages else ""
        res = await ollama_service.generate_sync(
            model=req.model,
            prompt=last_user_message,
            system=final_system_prompt,
            options=req.options
        )
        return {
            "status": "success",
            "model": req.model,
            "response": res.get("response", ""),
        }
