import uuid
from typing import Dict, Any, List, Optional, Tuple, Set
import openpyxl
from backend.app.services.luckysheet_converter import workbook_to_luckysheet
from backend.app.services.formula_parser import (
    parse_cell_coordinate, format_cell_coordinate, normalize_formula, extract_functions_from_formula, extract_references_from_formula
)
from backend.app.models.schemas import SheetMetadata, FormulaItem, FormulaGroup

class WorkbookEntry:
    def __init__(self, workbook_id: str, filename: str, filepath: str, luckysheet_data: List[Dict[str, Any]], total_formulas: int):
        self.workbook_id = workbook_id
        self.filename = filename
        self.filepath = filepath
        self.luckysheet_data = luckysheet_data
        self.total_formulas = total_formulas
        # Caches: sheet_name -> dict(coord -> {'formula': ..., 'normalized': ..., 'value': ...})
        self.cells: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self.sheets_meta: List[SheetMetadata] = []
        self.hidden_rows: Dict[str, Set[int]] = {}   # sheet_name -> set of 1-based row numbers
        self.hidden_cols: Dict[str, Set[int]] = {}   # sheet_name -> set of 1-based col numbers
        self.hidden_sheets: Set[str] = set()         # set of sheet names that are hidden
        self.sheet_states: Dict[str, str] = {}       # sheet_name -> "visible" | "hidden" | "veryHidden"
        self._build_index()

    def is_cell_hidden(self, sheet_name: str, row: int, col: int) -> Tuple[bool, List[str]]:
        sh_key = next((s for s in self.cells.keys() if s.upper() == sheet_name.upper()), sheet_name)
        reasons = []
        if sh_key in self.hidden_sheets:
            reasons.append("hidden_sheet")
        if row in self.hidden_rows.get(sh_key, set()):
            reasons.append("hidden_row")
        if col in self.hidden_cols.get(sh_key, set()):
            reasons.append("hidden_col")
        return len(reasons) > 0, reasons

    def _build_index(self):
        for idx, sheet in enumerate(self.luckysheet_data):
            sheet_name = sheet["name"]
            self.cells[sheet_name] = {}
            formula_count = 0
            cell_count = 0
            max_r = 0
            max_c = 0

            cfg = sheet.get("config", {}) or {}
            row_hidden = cfg.get("rowhidden", {}) or {}
            col_hidden = cfg.get("colhidden", {}) or {}

            # Convert 0-based string keys to 1-based integer indices
            h_rows = {int(k) + 1 for k in row_hidden.keys() if str(k).isdigit()}
            h_cols = {int(k) + 1 for k in col_hidden.keys() if str(k).isdigit()}
            self.hidden_rows[sheet_name] = h_rows
            self.hidden_cols[sheet_name] = h_cols

            state = sheet.get("state", "visible")
            self.sheet_states[sheet_name] = state
            if state in ("hidden", "veryHidden") or sheet.get("hide") == 1:
                self.hidden_sheets.add(sheet_name)

            for cell in sheet.get("celldata", []):
                r = cell["r"] + 1
                c = cell["c"] + 1
                coord = format_cell_coordinate(r, c)
                val_data = cell.get("v", {})

                formula = val_data.get("f")
                val = val_data.get("v")

                norm = normalize_formula(formula, r, c) if formula else ""
                funcs = extract_functions_from_formula(formula) if formula else []
                precedents_count = len(extract_references_from_formula(formula, sheet_name)) if formula else 0

                if formula:
                    formula_count += 1
                cell_count += 1
                max_r = max(max_r, r)
                max_c = max(max_c, c)

                self.cells[sheet_name][coord] = {
                    "coordinate": coord,
                    "row": r,
                    "col": c,
                    "formula": formula,
                    "normalized": norm,
                    "value": val,
                    "functions": funcs,
                    "precedents_count": precedents_count
                }

            self.sheets_meta.append(SheetMetadata(
                name=sheet_name,
                index=idx,
                max_row=max_r,
                max_column=max_c,
                formula_count=formula_count,
                cell_count=cell_count,
                state=state
            ))

import os
from pathlib import Path
from backend.app.config import UPLOAD_DIR
from backend.app.services.db_service import db_service

class WorkbookManager:
    def __init__(self):
        self._workbooks: Dict[str, WorkbookEntry] = {}

    def add_workbook(
        self,
        filepath: str,
        filename: str,
        custom_id: Optional[str] = None,
        save_to_db: bool = True
    ) -> WorkbookEntry:
        wb_id = custom_id or str(uuid.uuid4())[:8]
        luckysheet_data, total_formulas = workbook_to_luckysheet(filepath)
        entry = WorkbookEntry(wb_id, filename, filepath, luckysheet_data, total_formulas)
        self._workbooks[wb_id] = entry

        # Save uploaded file metadata to PostgreSQL
        if save_to_db and not wb_id.startswith("sample_"):
            try:
                db_service.save_workbook(
                    workbook_id=wb_id,
                    filename=filename,
                    filepath=str(filepath),
                    total_formulas=total_formulas,
                    sheets_meta=entry.sheets_meta
                )
            except Exception as e:
                print(f"[WorkbookManager] Warning: Failed to persist workbook {wb_id} to DB: {e}")

        return entry

    def restore_from_db(self) -> int:
        """Restore all workbooks recorded in PostgreSQL on startup."""
        if not db_service.ensure_connected():
            return 0

        records = db_service.get_all_workbooks()
        restored_count = 0
        for rec in records:
            wb_id = rec["workbook_id"]
            if wb_id in self._workbooks:
                continue

            raw_path = Path(rec["filepath"])
            resolved_path = None
            if raw_path.exists():
                resolved_path = raw_path
            elif (UPLOAD_DIR / raw_path.name).exists():
                resolved_path = UPLOAD_DIR / raw_path.name
            elif (UPLOAD_DIR / rec["filename"]).exists():
                resolved_path = UPLOAD_DIR / rec["filename"]

            if resolved_path:
                try:
                    self.add_workbook(
                        str(resolved_path),
                        rec["filename"],
                        custom_id=wb_id,
                        save_to_db=False
                    )
                    restored_count += 1
                except Exception as e:
                    print(f"[WorkbookManager] Failed to reload workbook {wb_id} from {resolved_path}: {e}")
            else:
                print(f"[WorkbookManager] Warning: File for workbook {wb_id} not found at {raw_path}")

        print(f"[WorkbookManager] Restored {restored_count} workbooks from PostgreSQL (Schema: '{db_service.schema}')")
        return restored_count

    def get_workbook(self, workbook_id: str) -> Optional[WorkbookEntry]:
        # In-memory check
        if workbook_id in self._workbooks:
            return self._workbooks[workbook_id]

        # Lazy check from PostgreSQL
        rec = db_service.get_workbook(workbook_id)
        if rec:
            raw_path = Path(rec["filepath"])
            resolved_path = None
            if raw_path.exists():
                resolved_path = raw_path
            elif (UPLOAD_DIR / raw_path.name).exists():
                resolved_path = UPLOAD_DIR / raw_path.name
            elif (UPLOAD_DIR / rec["filename"]).exists():
                resolved_path = UPLOAD_DIR / rec["filename"]


            if resolved_path:
                try:
                    return self.add_workbook(
                        str(resolved_path),
                        rec["filename"],
                        custom_id=workbook_id,
                        save_to_db=False
                    )
                except Exception as e:
                    print(f"[WorkbookManager] Error lazy-loading workbook {workbook_id}: {e}")

        return None

    def list_workbooks(self) -> List[Dict[str, Any]]:
        # If DB is active, combine DB records with samples in memory
        result_map: Dict[str, Dict[str, Any]] = {}

        # 1. First add all in-memory workbooks (e.g. sample workbooks)
        for wb in self._workbooks.values():
            result_map[wb.workbook_id] = {
                "workbook_id": wb.workbook_id,
                "filename": wb.filename,
                "sheets": [s.name for s in wb.sheets_meta],
                "total_formulas": wb.total_formulas
            }

        # 2. Add or update from database if available
        if db_service.ensure_connected():
            db_records = db_service.get_all_workbooks()
            for rec in db_records:
                wb_id = rec["workbook_id"]
                sheets = []
                if rec.get("sheets_meta"):
                    sheets = [
                        s.get("name") if isinstance(s, dict) else getattr(s, "name", str(s))
                        for s in rec["sheets_meta"]
                    ]
                result_map[wb_id] = {
                    "workbook_id": wb_id,
                    "filename": rec["filename"],
                    "sheets": sheets,
                    "total_formulas": rec.get("total_formulas", 0),
                    "uploaded_at": rec.get("uploaded_at")
                }

        return list(result_map.values())


    def get_sheet_data(self, workbook_id: str, sheet_name: str) -> Optional[Dict[str, Any]]:
        wb = self.get_workbook(workbook_id)
        if not wb:
            return None
        for s in wb.luckysheet_data:
            if s["name"] == sheet_name:
                return s
        return None

    def get_sheet_formulas(self, workbook_id: str, sheet_name: str) -> Dict[str, Any]:
        wb = self.get_workbook(workbook_id)
        if not wb or sheet_name not in wb.cells:
            return {"sheet_name": sheet_name, "total_formulas": 0, "formulas": [], "groups": []}

        formulas_list = []
        groups_map: Dict[str, List[str]] = {}
        sample_formula_map: Dict[str, str] = {}

        for coord, cell_info in wb.cells[sheet_name].items():
            if cell_info["formula"]:
                item = FormulaItem(
                    coordinate=coord,
                    row=cell_info["row"],
                    col=cell_info["col"],
                    formula=cell_info["formula"],
                    normalized_formula=cell_info["normalized"],
                    functions=cell_info["functions"],
                    precedents_count=cell_info["precedents_count"]
                )
                formulas_list.append(item)

                pattern = cell_info["normalized"]
                if pattern not in groups_map:
                    groups_map[pattern] = []
                    sample_formula_map[pattern] = cell_info["formula"]
                groups_map[pattern].append(coord)

        # Sort formulas by row, then col
        formulas_list.sort(key=lambda x: (x.row, x.col))

        groups = [
            FormulaGroup(
                pattern=pattern,
                count=len(cells),
                sample_formula=sample_formula_map[pattern],
                cells=cells
            )
            for pattern, cells in groups_map.items()
        ]
        groups.sort(key=lambda x: x.count, reverse=True)

        return {
            "sheet_name": sheet_name,
            "total_formulas": len(formulas_list),
            "formulas": formulas_list,
            "groups": groups
        }

workbook_manager = WorkbookManager()
