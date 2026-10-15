from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class WorkbookUploadResponse(BaseModel):
    workbook_id: str
    filename: str
    sheets: List[str]
    sheet_count: int
    luckysheet_data: Optional[List[Dict[str, Any]]] = None
    total_formulas: int

class SheetMetadata(BaseModel):
    name: str
    index: int
    max_row: int
    max_column: int
    formula_count: int
    cell_count: int
    state: str = "visible"

class WorkbookInfoResponse(BaseModel):
    workbook_id: str
    filename: str
    sheets: List[SheetMetadata]
    total_formulas: int

class FormulaItem(BaseModel):
    coordinate: str # e.g. "C10"
    row: int
    col: int
    formula: str
    normalized_formula: str
    functions: List[str]
    precedents_count: int

class FormulaGroup(BaseModel):
    pattern: str
    count: int
    sample_formula: str
    cells: List[str]

class SheetFormulasResponse(BaseModel):
    sheet_name: str
    total_formulas: int
    formulas: List[FormulaItem]
    groups: List[FormulaGroup]

class DependencyNode(BaseModel):
    id: str # e.g. "Projection!C10"
    sheet: str
    coordinate: str
    row: int
    col: int
    formula: Optional[str] = None
    value: Any = None
    node_type: str # 'target', 'precedent', 'dependent', 'terminal', 'circular'
    depth: int = 0

class DependencyEdge(BaseModel):
    source: str
    target: str
    edge_type: str = "direct" # "direct", "transitive"

class TraceFormulaRequest(BaseModel):
    workbook_id: str
    sheet_name: str
    cell: str # e.g. "C10"
    direction: str = "precedents" # "precedents" | "dependents" | "both"
    max_depth: int = 3

class TraceFormulaResponse(BaseModel):
    target_cell: str
    target_sheet: str
    formula: Optional[str] = None
    direction: str
    nodes: List[DependencyNode]
    edges: List[DependencyEdge]
    terminal_sources: List[DependencyNode]
    has_circular_reference: bool
    circular_paths: List[List[str]] = []
    max_depth_reached: int
    max_depth_configured: Optional[int] = None
    can_expand_further: bool = False
    tree: Dict[str, Any]
    execution_logs: List[str] = []
    elapsed_seconds: float = 0.0

class CompareSheetsRequest(BaseModel):
    baseline_workbook_id: str
    baseline_sheet_name: str
    target_workbook_id: str
    target_sheet_name: str
    baseline_range: Optional[str] = None # e.g. "A1:D20" or null/empty for entire sheet
    target_range: Optional[str] = None # e.g. "A1:D20" or null/empty for entire sheet
    cell_range: Optional[str] = None # fallback alias (applies to both if set)
    range: Optional[str] = None # alias for cell_range
    mode: str = "exact_formula" # "exact_formula" | "normalized_formula" | "values_only"
    alignment: str = "coordinate" # "coordinate" | "structural"

class CellDiff(BaseModel):
    coordinate: str
    row: int
    col: int
    diff_type: str # "formula_changed", "value_changed", "added", "removed", "identical"
    baseline_coordinate: Optional[str] = None
    target_coordinate: Optional[str] = None
    baseline_formula: Optional[str] = None
    target_formula: Optional[str] = None
    baseline_value: Any = None
    target_value: Any = None
    normalized_diff: Optional[bool] = False

class CompareSheetsResponse(BaseModel):
    baseline_workbook_id: str
    baseline_sheet_name: str
    target_workbook_id: str
    target_sheet_name: str
    baseline_range: Optional[str] = None # e.g. "A1:D20" or None if entire sheet
    target_range: Optional[str] = None # e.g. "A1:D20" or None if entire sheet
    cell_range: Optional[str] = None # backward-compat summary
    mode: str
    diff_count: int
    added_count: int
    removed_count: int
    formula_changed_count: int
    value_changed_count: int
    identical_count: int
    diffs: List[CellDiff]

class AnomalyItem(BaseModel):
    sheet: str
    coordinate: str
    row: int
    col: int
    severity: str # "high", "medium", "low"
    anomaly_type: str # "formula_inconsistency", "hardcoded_in_series", "range_omission", "embedded_constant", "external_reference", "circular_reference", "ref_error", "hidden_reference"
    description: str
    formula: Optional[str] = None
    expected_pattern: Optional[str] = None
    expected_formula: Optional[str] = None
    neighbor_summary: Optional[str] = None
    affected_context: Optional[str] = None

class AuditAnomaliesResponse(BaseModel):
    workbook_id: str
    sheet_name: Optional[str] = None
    range: Optional[str] = None
    total_anomalies: int
    high_severity_count: int
    medium_severity_count: int
    low_severity_count: int
    anomalies: List[AnomalyItem]

class RangeAnalysisCellItem(BaseModel):
    coordinate: str
    row: int
    col: int
    category: str # "cross_sheet" | "local_formula" | "hardcoded" | "empty"
    formula: Optional[str] = None
    value: Any = None
    cross_sheet_refs: List[str] = []
    local_refs: List[str] = []
    summary: str = ""

class RangeAnalysisSummary(BaseModel):
    cross_sheet_count: int = 0
    local_formula_count: int = 0
    hardcoded_count: int = 0
    empty_count: int = 0
    total_cells: int = 0

class RangeAnalysisRequest(BaseModel):
    workbook_id: str
    sheet_name: str
    range: str

class RangeAnalysisResponse(BaseModel):
    workbook_id: str
    sheet_name: str
    range: str
    total_cells: int
    summary: RangeAnalysisSummary
    cells: List[RangeAnalysisCellItem]

class HiddenConsumerItem(BaseModel):
    sheet: str
    coordinate: str
    row: int
    col: int
    formula: Optional[str] = None
    value: Any = None
    is_consumer_visible: bool = True

class HiddenCellItem(BaseModel):
    sheet: str
    coordinate: str
    row: int
    col: int
    col_letter: str
    hidden_reasons: List[str]  # e.g. ["hidden_row"], ["hidden_col"], ["hidden_sheet"]
    formula: Optional[str] = None
    value: Any = None
    dependents_count: int = 0
    has_visible_consumer: bool = False
    dependents: List[HiddenConsumerItem] = []

class HiddenRowItem(BaseModel):
    sheet: str
    row: int  # 1-based index (e.g. Row 14)
    referenced_cells_count: int = 0
    total_dependents_count: int = 0
    cells_in_use: List[str] = []  # e.g. ["B14", "C14"]
    has_visible_consumer: bool = False

class HiddenColumnItem(BaseModel):
    sheet: str
    col: int  # 1-based index
    col_letter: str  # e.g. "Q"
    referenced_cells_count: int = 0
    total_dependents_count: int = 0
    cells_in_use: List[str] = []
    has_visible_consumer: bool = False

class HiddenSheetItem(BaseModel):
    sheet: str
    state: str = "hidden"  # "hidden" | "veryHidden"
    referenced_cells_count: int = 0
    total_dependents_count: int = 0
    cells_in_use: List[str] = []

class HiddenSummary(BaseModel):
    total_hidden_rows: int = 0
    hidden_rows_in_use: int = 0
    total_hidden_cols: int = 0
    hidden_cols_in_use: int = 0
    total_hidden_sheets: int = 0
    hidden_sheets_in_use: int = 0
    total_hidden_cells_in_use: int = 0
    critical_visible_consumers_count: int = 0

class TraceHiddenResponse(BaseModel):
    workbook_id: str
    filter_sheet: Optional[str] = None
    summary: HiddenSummary
    hidden_rows: List[HiddenRowItem] = []
    hidden_columns: List[HiddenColumnItem] = []
    hidden_cells: List[HiddenCellItem] = []
    hidden_sheets: List[HiddenSheetItem] = []

# ==========================================
# Historical Financial Statement Comparison Schemas
# ==========================================

class HistoricalStatementItem(BaseModel):
    workbook_id: str
    sheet_name: Optional[str] = None
    range: Optional[str] = None
    formula_range: Optional[str] = None
    label: Optional[str] = None

class HistoricalStatementCompareRequest(BaseModel):
    statement_type: str = "income_statement" # "income_statement" | "balance_sheet" | "cashflow" | "custom"
    items: List[HistoricalStatementItem]
    alignment_mode: str = "account_name" # "account_name" | "coordinate" | "row_order"
    baseline_index: int = 0

class AccountValueItem(BaseModel):
    workbook_id: str
    label: str
    filename: Optional[str] = None
    sheet_name: Optional[str] = None
    range: Optional[str] = None
    formula_range: Optional[str] = None
    account_name: Optional[str] = None
    account_coord: Optional[str] = None
    coordinate: Optional[str] = None
    row: Optional[int] = None
    col: Optional[int] = None
    value: Any = None
    formatted_value: Optional[str] = None
    formula: Optional[str] = None
    is_formula: bool = False
    is_present: bool = True
    col_values: Optional[List[Dict[str, Any]]] = None
    common_size_pct: Optional[float] = None

class AccountComparisonRow(BaseModel):
    account_name: str
    normalized_name: str
    is_summary: bool = False
    match_status: str = "matched" # "matched" | "only_in_wb1" | "only_in_wb2" | "partial"
    present_in_wbs: List[str] = []
    missing_in_wbs: List[str] = []
    values_by_wb: Dict[str, AccountValueItem]
    baseline_value: Any = None
    target_values: Dict[str, Any] = {}
    variances: Dict[str, Optional[float]] = {}
    growth_pcts: Dict[str, Optional[float]] = {}
    formula_statuses: Dict[str, str] = {}
    anomalies: List[str] = []

class StatementSummaryKPIs(BaseModel):
    statement_type: str
    total_accounts: int = 0
    matched_accounts: int = 0
    unmatched_accounts: int = 0
    only_in_wb1_count: int = 0
    only_in_wb2_count: int = 0
    formula_divergence_count: int = 0
    key_metrics: Dict[str, Any] = {}
    alerts: List[str] = []

class HistoricalStatementCompareResponse(BaseModel):
    statement_type: str
    alignment_mode: str
    baseline_label: str
    workbooks_info: List[Dict[str, Any]]
    columns: List[str]
    accounts: List[AccountComparisonRow]
    summary: StatementSummaryKPIs
    highlights: List[Dict[str, Any]] = []

