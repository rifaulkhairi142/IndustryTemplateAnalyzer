import os
import json
import logging
import time
from typing import AsyncGenerator, Dict, Any, List, Optional
try:
    import httpx
except ImportError:
    httpx = None

from backend.app.utils.logger import log_ai, log_error

logger = logging.getLogger(__name__)

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434").rstrip("/")

class OllamaService:
    def __init__(self, host: str = OLLAMA_HOST):
        self.host = host

    async def get_status(self) -> Dict[str, Any]:
        """Check if local Ollama server is reachable and active."""
        if httpx is None:
            return {
                "online": False,
                "host": self.host,
                "version": None,
                "error": "Package 'httpx' belum terinstal. Jalankan 'pip install httpx'."
            }
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.host}/api/version")
                if res.status_code == 200:
                    data = res.json()
                    return {
                        "online": True,
                        "host": self.host,
                        "version": data.get("version", "unknown"),
                    }
        except Exception as e:
            logger.debug(f"Ollama status check error: {e}")

        # Fallback check /api/tags
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.host}/api/tags")
                if res.status_code == 200:
                    return {
                        "online": True,
                        "host": self.host,
                        "version": "active",
                    }
        except Exception as e:
            logger.debug(f"Ollama tags fallback error: {e}")

        return {
            "online": False,
            "host": self.host,
            "version": None,
            "error": "Ollama service is not reachable at " + self.host
        }

    async def list_models(self) -> List[Dict[str, Any]]:
        """Fetch list of available models from Ollama."""
        if httpx is None:
            return []
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(f"{self.host}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    models = []
                    for m in data.get("models", []):
                        details = m.get("details", {})
                        models.append({
                            "name": m.get("name"),
                            "model": m.get("model"),
                            "size_bytes": m.get("size"),
                            "size_gb": round(m.get("size", 0) / (1024**3), 2) if m.get("size") else None,
                            "parameter_size": details.get("parameter_size"),
                            "family": details.get("family"),
                            "quantization": details.get("quantization_level"),
                            "modified_at": m.get("modified_at")
                        })
                    return models
        except Exception as e:
            logger.error(f"Failed to list Ollama models: {e}")
        return []

    async def chat_stream(
        self,
        model: str,
        messages: List[Dict[str, str]],
        options: Optional[Dict[str, Any]] = None
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat completions from Ollama via SSE format (data: {...}\n\n).
        """
        if httpx is None:
            yield f"data: {json.dumps({'error': 'Package httpx is missing. Please run pip install httpx.', 'done': True})}\n\n"
            return

        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
        }
        if options:
            payload["options"] = options

        t0 = time.perf_counter()
        log_ai(f"Initiating SSE chat stream with Ollama: model='{model}', host='{self.host}', messages_count={len(messages)}")

        timeout = httpx.Timeout(120.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                async with client.stream(
                    "POST",
                    f"{self.host}/api/chat",
                    json=payload
                ) as response:
                    if response.status_code != 200:
                        error_body = await response.aread()
                        err_text = error_body.decode(errors='ignore')
                        log_error(f"Ollama chat error HTTP {response.status_code}: {err_text}")
                        yield f"data: {json.dumps({'error': f'Ollama error {response.status_code}: {err_text}', 'done': True})}\n\n"
                        return

                    chunk_count = 0
                    char_count = 0
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                            message = chunk.get("message", {})
                            content = message.get("content", "")
                            is_done = chunk.get("done", False)

                            chunk_count += 1
                            char_count += len(content)

                            yield f"data: {json.dumps({'content': content, 'done': is_done})}\n\n"

                            if is_done:
                                elapsed = (time.perf_counter() - t0) * 1000
                                log_ai(f"SSE stream completed for model='{model}': chunks={chunk_count}, chars={char_count}, elapsed={elapsed:.1f}ms")
                                break
                        except json.JSONDecodeError:
                            continue
            except Exception as e:
                log_error(f"Chat stream exception: {e}")
                yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

    async def generate_sync(
        self,
        model: str,
        prompt: str,
        system: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate response synchronously without streaming."""
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
        }
        if system:
            payload["system"] = system
        if options:
            payload["options"] = options

        t0 = time.perf_counter()
        log_ai(f"Generating sync response: model='{model}', prompt_len={len(prompt)}")

        timeout = httpx.Timeout(120.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(f"{self.host}/api/generate", json=payload)
            if res.status_code != 200:
                log_error(f"Ollama generate error HTTP {res.status_code}: {res.text}")
                raise RuntimeError(f"Ollama error {res.status_code}: {res.text}")
            elapsed = (time.perf_counter() - t0) * 1000
            data = res.json()
            log_ai(f"Sync response completed: model='{model}', response_chars={len(data.get('response', ''))}, elapsed={elapsed:.1f}ms")
            return data


ollama_service = OllamaService()
