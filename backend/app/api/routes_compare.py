from fastapi import APIRouter, HTTPException
from backend.app.services.formula_comparator import formula_comparator
from backend.app.services.historical_comparator import historical_comparator
from backend.app.models.schemas import (
    CompareSheetsRequest,
    CompareSheetsResponse,
    HistoricalStatementCompareRequest,
    HistoricalStatementCompareResponse,
)

router = APIRouter(prefix="/api/compare", tags=["Compare"])

@router.post("/sheets", response_model=CompareSheetsResponse)
async def compare_sheets(req: CompareSheetsRequest):
    try:
        baseline_range = req.baseline_range if req.baseline_range is not None else (req.cell_range or req.range)
        target_range = req.target_range if req.target_range is not None else (req.cell_range or req.range)
        result = formula_comparator.compare_sheets(
            baseline_wb_id=req.baseline_workbook_id,
            baseline_sheet=req.baseline_sheet_name,
            target_wb_id=req.target_workbook_id,
            target_sheet=req.target_sheet_name,
            baseline_range=baseline_range,
            target_range=target_range,
            mode=req.mode,
            alignment=req.alignment
        )
        return result
    except ValueError as e:
        detail_msg = str(e)
        status_code = 404 if "not found" in detail_msg.lower() else 400
        raise HTTPException(status_code=status_code, detail=detail_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison error: {str(e)}")

@router.post("/historical-statements", response_model=HistoricalStatementCompareResponse)
async def compare_historical_statements(req: HistoricalStatementCompareRequest):
    """Compare Historical Financial Statements (Income Statement, Balance Sheet, Cash Flow) across multiple workbooks."""
    try:
        result = historical_comparator.compare_statements(req)
        return result
    except ValueError as e:
        detail_msg = str(e)
        status_code = 404 if "not found" in detail_msg.lower() else 400
        raise HTTPException(status_code=status_code, detail=detail_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Historical statement comparison error: {str(e)}")

