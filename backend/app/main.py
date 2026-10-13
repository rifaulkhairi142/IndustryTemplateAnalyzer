from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import CORS_ORIGINS
from backend.app.api import routes_workbook, routes_trace, routes_compare, routes_audit
from backend.app.services.sample_generator import create_sample_workbooks
from backend.app.services.workbook_manager import workbook_manager
from backend.app.services.db_service import db_service

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

app.include_router(routes_workbook.router)
app.include_router(routes_trace.router)
app.include_router(routes_compare.router)
app.include_router(routes_audit.router)

@app.on_event("startup")
async def startup_event():
    # 1. Check PostgreSQL database readiness (no DDL migrations inside main app)
    try:
        is_ready = db_service.check_connection()
        if is_ready:
            restored = workbook_manager.restore_from_db()
            print(f"[Startup] Restored {restored} uploaded workbook(s) from PostgreSQL schema '{db_service.schema}'")
        elif db_service.is_connected and not db_service.is_migrated:
            print(f"[Startup Notice] PostgreSQL connected, but schema/table not migrated yet.")
            print(f"[Startup Notice] Jalankan 'python migrate.py' untuk migrasi database.")
    except Exception as e:
        print(f"[Startup Warning] Database check: {e}")


    # 3. Pre-generate sample files and load them
    try:
        f1, f2 = create_sample_workbooks()
        workbook_manager.add_workbook(f1, "financial_model.xlsx", custom_id="sample_v1", save_to_db=False)
        workbook_manager.add_workbook(f2, "financial_model_v2.xlsx", custom_id="sample_v2", save_to_db=False)
        print("Successfully generated and loaded sample workbooks: sample_v1, sample_v2")
    except Exception as e:
        print(f"Warning: Could not pre-generate sample workbooks: {e}")


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
