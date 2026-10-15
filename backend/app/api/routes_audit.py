from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from backend.app.services.formula_auditor import formula_auditor
from backend.app.models.schemas import AuditAnomaliesResponse

router = APIRouter(prefix="/api/audit", tags=["Audit"])

@router.get("/anomalies", response_model=AuditAnomaliesResponse)
async def get_audit_anomalies(
    workbook_id: str = Query(..., description="ID of loaded workbook"),
    sheet_name: Optional[str] = Query(None, description="Optional sheet name to filter"),
    range: Optional[str] = Query(None, description="Optional cell range bounds (e.g. C4:H30)")
):
    try:
        result = formula_auditor.audit_workbook(
            workbook_id=workbook_id,
            sheet_filter=sheet_name,
            range_filter=range
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audit error: {str(e)}")
