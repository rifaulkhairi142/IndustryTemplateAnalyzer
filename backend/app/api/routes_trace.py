from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from backend.app.services.formula_tracer import formula_tracer
from backend.app.services.hidden_tracer import hidden_dependency_tracer
from backend.app.models.schemas import (
    TraceFormulaRequest, TraceFormulaResponse,
    RangeAnalysisRequest, RangeAnalysisResponse,
    TraceHiddenResponse
)

router = APIRouter(prefix="/api/trace", tags=["Trace"])

@router.get("/hidden", response_model=TraceHiddenResponse)
async def trace_hidden_elements(
    workbook_id: str = Query(..., description="ID of loaded workbook"),
    sheet_name: Optional[str] = Query(None, description="Optional sheet name to filter"),
    only_in_use: bool = Query(True, description="Filter only hidden elements with active dependents")
):
    try:
        result = hidden_dependency_tracer.trace_hidden_elements(
            workbook_id=workbook_id,
            sheet_filter=sheet_name,
            only_in_use=only_in_use
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hidden trace error: {str(e)}")

@router.post("/formula", response_model=TraceFormulaResponse)
async def trace_cell_formula(req: TraceFormulaRequest):
    try:
        result = formula_tracer.trace_formula(
            workbook_id=req.workbook_id,
            sheet_name=req.sheet_name,
            cell_coord=req.cell,
            direction=req.direction,
            max_depth=req.max_depth
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tracing error: {str(e)}")

@router.post("/graph")
async def get_trace_graph(req: TraceFormulaRequest):
    try:
        result = formula_tracer.trace_formula(
            workbook_id=req.workbook_id,
            sheet_name=req.sheet_name,
            cell_coord=req.cell,
            direction=req.direction,
            max_depth=req.max_depth
        )
        return {
            "target": f"{req.sheet_name}!{req.cell}",
            "workbook_id": req.workbook_id,
            "sheet_name": req.sheet_name,
            "cell": req.cell,
            "direction": req.direction,
            "max_depth_configured": req.max_depth,
            "max_depth_reached": result.max_depth_reached,
            "can_expand_further": result.can_expand_further,
            "nodes": [n.model_dump() for n in result.nodes],
            "edges": [e.model_dump() for e in result.edges],
            "has_circular": result.has_circular_reference,
            "circular_paths": result.circular_paths
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/range-analysis", response_model=RangeAnalysisResponse)
async def analyze_range_dependencies(req: RangeAnalysisRequest):
    try:
        result = formula_tracer.analyze_range(
            workbook_id=req.workbook_id,
            sheet_name=req.sheet_name,
            range_str=req.range
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Range analysis error: {str(e)}")
