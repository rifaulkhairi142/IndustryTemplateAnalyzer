import os
import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from backend.app.config import UPLOAD_DIR
from backend.app.services.workbook_manager import workbook_manager
from backend.app.services.db_service import db_service
from backend.app.models.schemas import (
    WorkbookUploadResponse, WorkbookInfoResponse, SheetFormulasResponse
)

router = APIRouter(prefix="/api/workbook", tags=["Workbook"])

@router.get("/database-status")
async def get_database_status():
    """Check PostgreSQL database connection and custom schema status."""
    return db_service.get_status()

@router.delete("/{id}")
async def delete_workbook(id: str):
    """Delete a workbook from memory and PostgreSQL."""
    db_service.delete_workbook(id)
    if id in workbook_manager._workbooks:
        del workbook_manager._workbooks[id]
    return {"message": f"Workbook {id} deleted successfully"}

@router.post("/upload", response_model=WorkbookUploadResponse)
async def upload_workbook(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('.xlsx', '.xlsm', '.xltx')):
        raise HTTPException(status_code=400, detail="Only .xlsx and .xlsm files are supported")

    dest_path = UPLOAD_DIR / file.filename
    # Handle filename collision
    counter = 1
    stem = Path(file.filename).stem
    suffix = Path(file.filename).suffix
    while dest_path.exists():
        dest_path = UPLOAD_DIR / f"{stem}_{counter}{suffix}"
        counter += 1

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        entry = workbook_manager.add_workbook(str(dest_path), file.filename)
        return WorkbookUploadResponse(
            workbook_id=entry.workbook_id,
            filename=entry.filename,
            sheets=[s.name for s in entry.sheets_meta],
            sheet_count=len(entry.sheets_meta),
            luckysheet_data=None,
            total_formulas=entry.total_formulas
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process workbook: {str(e)}")

@router.get("/list")
async def list_workbooks():

    return workbook_manager.list_workbooks()


@router.get("/{id}", response_model=WorkbookInfoResponse)
async def get_workbook_info(id: str):
    entry = workbook_manager.get_workbook(id)
    if not entry:
        raise HTTPException(status_code=404, detail="Workbook not found")
    return WorkbookInfoResponse(
        workbook_id=entry.workbook_id,
        filename=entry.filename,
        sheets=entry.sheets_meta,
        total_formulas=entry.total_formulas
    )

@router.get("/{id}/sheet/{name}")
async def get_sheet_data(id: str, name: str):
    sheet_data = workbook_manager.get_sheet_data(id, name)
    if not sheet_data:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return sheet_data

@router.get("/{id}/data")
async def get_workbook_data(id: str):
    entry = workbook_manager.get_workbook(id)
    if not entry:
        raise HTTPException(status_code=404, detail="Workbook not found")
    return entry.luckysheet_data

@router.post("/load-samples")
async def load_samples():
    from backend.app.services.sample_generator import create_sample_workbooks
    f1, f2 = create_sample_workbooks()
    entry1 = workbook_manager.add_workbook(f1, "financial_model.xlsx", custom_id="sample_v1")
    entry2 = workbook_manager.add_workbook(f2, "financial_model_v2.xlsx", custom_id="sample_v2")
    return {
        "message": "Sample workbooks loaded successfully",
        "samples": [
            {
                "workbook_id": entry1.workbook_id,
                "filename": entry1.filename,
                "sheets": [s.name for s in entry1.sheets_meta],
                "luckysheet_data": entry1.luckysheet_data,
                "total_formulas": entry1.total_formulas
            },
            {
                "workbook_id": entry2.workbook_id,
                "filename": entry2.filename,
                "sheets": [s.name for s in entry2.sheets_meta],
                "luckysheet_data": entry2.luckysheet_data,
                "total_formulas": entry2.total_formulas
            }
        ]
    }

@router.get("/{id}/sheet/{name}/formulas", response_model=SheetFormulasResponse)
async def get_sheet_formulas(id: str, name: str):
    entry = workbook_manager.get_workbook(id)
    if not entry:
        raise HTTPException(status_code=404, detail="Workbook not found")
    result = workbook_manager.get_sheet_formulas(id, name)
    return SheetFormulasResponse(**result)

@router.post("/evaluate-cell")
async def evaluate_cell(payload: dict):
    from backend.app.services.formula_evaluator import formula_evaluator
    wb_id = payload.get("workbook_id")
    sheet_name = payload.get("sheet_name")
    coord = payload.get("cell", "").replace('$', '').upper()
    override_formula = payload.get("formula")
    entry = workbook_manager.get_workbook(wb_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Workbook not found")
    
    evaluated_dict = formula_evaluator.evaluate_workbook_cells(entry.cells)
    computed_val = evaluated_dict.get(sheet_name, {}).get(coord)
    raw_info = entry.cells.get(sheet_name, {}).get(coord, {})
    return {
        "workbook_id": wb_id,
        "sheet_name": sheet_name,
        "cell": coord,
        "formula": override_formula or raw_info.get("formula"),
        "computed_value": computed_val,
        "cached_value": raw_info.get("value")
    }

