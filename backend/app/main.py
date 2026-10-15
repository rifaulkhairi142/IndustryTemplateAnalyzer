import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import CORS_ORIGINS
from backend.app.api import routes_workbook, routes_trace, routes_compare, routes_audit, routes_ai
from backend.app.services.sample_generator import create_sample_workbooks
from backend.app.services.workbook_manager import workbook_manager
from backend.app.services.db_service import db_service
from backend.app.utils.logger import log_api, log_error, log_workbook

app = FastAPI(
    title="Web Excel Formula Intelligence API",
    description="Backend API for Excel workbook rendering, formula tracing, comparison, and auditing",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for development flexibility
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    path = request.url.path
    is_api = path.startswith("/api")
    start_time = time.perf_counter()
    
    if is_api:
        query_str = f"?{request.url.query}" if request.url.query else ""
        log_api(f"--> {request.method} {path}{query_str}")
        
    try:
        response = await call_next(request)
        if is_api:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            log_api(f"<-- {request.method} {path} [Status: {response.status_code}] ({elapsed_ms:.1f}ms)")
        return response
    except Exception as exc:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        log_error(f"<-- {request.method} {path} FAILED after {elapsed_ms:.1f}ms", exc)
        raise exc

app.include_router(routes_workbook.router)
app.include_router(routes_trace.router)
app.include_router(routes_compare.router)
app.include_router(routes_audit.router)
app.include_router(routes_ai.router)

@app.on_event("startup")
async def startup_event():
    # 1. Check PostgreSQL database readiness (no DDL migrations inside main app)
    try:
        is_ready = db_service.check_connection()
        if is_ready:
            restored = workbook_manager.restore_from_db()
            log_workbook(f"Restored {restored} uploaded workbook(s) from PostgreSQL schema '{db_service.schema}'")
        elif db_service.is_connected and not db_service.is_migrated:
            log_workbook(f"PostgreSQL connected, but schema/table not migrated yet. Run 'python migrate.py'.")
    except Exception as e:
        log_error(f"Database check failed during startup: {e}")

    # 2. Pre-generate sample files and load them
    try:
        samples = create_sample_workbooks()
        f1, f2 = samples[0], samples[1]
        workbook_manager.add_workbook(f1, "financial_model.xlsx", custom_id="sample_v1", save_to_db=False)
        workbook_manager.add_workbook(f2, "financial_model_v2.xlsx", custom_id="sample_v2", save_to_db=False)
        if len(samples) > 2:
            f3 = samples[2]
            workbook_manager.add_workbook(f3, "financial_model_v3.xlsx", custom_id="sample_v3", save_to_db=False)
            log_workbook("Successfully loaded sample workbooks: sample_v1, sample_v2, sample_v3")
        else:
            log_workbook("Successfully loaded sample workbooks: sample_v1, sample_v2")
    except Exception as e:
        log_error(f"Could not pre-generate sample workbooks: {e}")


@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Web Excel Formula Intelligence API",
        "version": "1.0.0",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
