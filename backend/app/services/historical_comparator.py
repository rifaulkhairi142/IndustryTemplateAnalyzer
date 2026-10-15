import re
import time
from typing import Dict, Any, List, Optional, Tuple, Set
from backend.app.services.workbook_manager import workbook_manager
from backend.app.services.formula_parser import parse_range_bounds, format_cell_coordinate, parse_cell_coordinate
from backend.app.services.formula_evaluator import formula_evaluator
from backend.app.models.schemas import (
    HistoricalStatementCompareRequest,
    HistoricalStatementCompareResponse,
    AccountComparisonRow,
    AccountValueItem,
    StatementSummaryKPIs,
)
from backend.app.utils.logger import log_reconciliation

def normalize_account_title(name: str) -> str:
    """Normalize account title for fuzzy matching across models."""
    if not name:
        return ""
    # Remove leading/trailing non-alphanumeric, strip currencies, parens
    s = str(name).strip().lower()
    s = re.sub(r'[\(\)\[\]\{\}\$€£¥\:\-\–\—\.]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def is_summary_account(name: str) -> bool:
    """Check if account label indicates a subtotal or total metric."""
    norm = normalize_account_title(name)
    keywords = [
        "total", "net income", "operating income", "ebit", "ebitda",
        "gross profit", "ending cash", "net change", "retained earnings",
        "shareholders equity", "total assets", "total liabilities"
    ]
    return any(k in norm for k in keywords)

HEADER_LABELS = {
    "account", "account name", "accounts", "account description", "account title",
    "description", "particulars", "line item", "item", "items", "line items",
    "nama akun", "keterangan", "pos", "uraian", "rincian", "komponen",
    "financial statement", "statement", "statement of financial position",
    "balance sheet", "income statement", "cash flow", "cash flows",
    "historical", "projection", "projections", "forecast", "actual",
}

def is_generic_header_label(val: Any) -> bool:
    if val is None:
        return False
    norm = re.sub(r'[\(\)\[\]\{\}\$€£¥\:\-\–\—\.\#\*\+]', ' ', str(val)).strip().lower()
    norm = re.sub(r'\s+', ' ', norm)
    return norm in HEADER_LABELS

class HistoricalStatementComparator:
    def compare_statements(self, req: HistoricalStatementCompareRequest) -> HistoricalStatementCompareResponse:
        if not req.items or len(req.items) < 1:
            raise ValueError("At least one workbook item must be specified for statement comparison.")

        # Resolve workbooks and sheets
        loaded_items = []
        for idx, it in enumerate(req.items):
            wb = workbook_manager.get_workbook(it.workbook_id)
            if not wb:
                raise ValueError(f"Workbook '{it.workbook_id}' not found.")
            sheet_name = it.sheet_name
            if not sheet_name:
                # Auto-detect sheet based on statement type
                sheet_name = self._find_best_sheet_for_type(wb, req.statement_type)
            if sheet_name not in wb.cells:
                # Try case-insensitive lookup
                found = next((s for s in wb.cells.keys() if s.upper() == sheet_name.upper()), None)
                if found:
                    sheet_name = found
                else:
                    raise ValueError(f"Sheet '{sheet_name}' not found in workbook '{it.workbook_id}'.")
            
            default_label = f"Workbook {idx + 1}: {wb.filename}"
            label = it.label if (it.label and not it.label.strip().startswith("FY ")) else default_label
            loaded_items.append({
                "index": idx,
                "workbook_id": it.workbook_id,
                "filename": wb.filename,
                "sheet_name": sheet_name,
                "range": it.range,
                "formula_range": it.formula_range,
                "label": label,
                "wb": wb
            })

        start_time = time.perf_counter()
        log_reconciliation(
            f"Memulai Rekonsiliasi & Komparasi Akun: {req.statement_type.upper()} "
            f"({len(loaded_items)} Workbook pembanding) | Alignment: {req.alignment_mode}"
        )
        for idx, it in enumerate(loaded_items):
            rng_acc = it['range'] or 'Auto (Semua Baris)'
            rng_fml = it.get('formula_range') or 'Auto (Adjacent)'
            log_reconciliation(f"  * WB #{idx + 1}: '{it['filename']}' | Sheet: '{it['sheet_name']}' | Range Akun: {rng_acc} | Range Formula: {rng_fml}")

        baseline_idx = req.baseline_index if 0 <= req.baseline_index < len(loaded_items) else 0
        baseline_item = loaded_items[baseline_idx]
        baseline_label = baseline_item["label"]

        # Parse each item into structured rows
        parsed_wb_statements: List[Dict[str, Any]] = []
        for it in loaded_items:
            wb = it["wb"]
            sh = it["sheet_name"]
            cells_map = wb.cells.get(sh, {})
            # Evaluate formulas to resolve cross-sheet values
            evaluated_wb = formula_evaluator.evaluate_workbook_cells(wb.cells)
            parsed = self._extract_statement_rows(
                cells_map,
                it["range"],
                evaluated_wb.get(sh, {}),
                it.get("formula_range")
            )
            parsed_wb_statements.append({
                "meta": it,
                "headers": parsed["headers"],
                "rows": parsed["rows"],
                "base_metric_value": parsed.get("base_metric_value"),
                "col_names": parsed.get("col_names", [])
            })

        # Align accounts across workbooks
        aligned_rows = self._align_accounts(
            parsed_wb_statements,
            req.alignment_mode,
            baseline_label,
            req.statement_type
        )

        # Build highlights for spreadsheet viewer
        highlights = self._build_highlights(aligned_rows, loaded_items, baseline_label)

        # Executive KPIs and summary
        summary = self._compute_summary(aligned_rows, loaded_items, baseline_label, req.statement_type)

        # Print detailed account reconciliation process to backend console (ASCII safe for Windows console)
        print("\n" + "=" * 80)
        print(f"[ACCOUNT MATCHER] MEMULAI PROSES PENCOCOKAN AKUN ({req.statement_type.upper()})")
        print("=" * 80)
        for idx, it in enumerate(loaded_items):
            parsed = parsed_wb_statements[idx]
            rng_acc = it['range'] or 'Auto'
            rng_fml = it.get('formula_range') or 'Auto (Adjacent)'
            print(f"[KOLOM {idx + 1} -> WORKBOOK {idx + 1}] File: {it['filename']} | Sheet: {it['sheet_name']} | Range Akun: {rng_acc} | Range Formula: {rng_fml}")
            print(f"   Ditemukan {len(parsed['rows'])} baris akun:")
            for r in parsed["rows"]:
                val_str = self._format_currency(r["primary_value"])
                fml_str = f" [Rumus: {r['primary_formula']}]" if r.get('primary_formula') else " [Hardcoded / Nilai Tetap]"
                print(f"   * Sel Akun {r['account_coord']:<4} : '{r['raw_account_name']}' <---> Sel Formula {r['primary_coord']} : {val_str}{fml_str}")
            print("-" * 80)

        print("[PROSES PENCOCOKAN / REKONSILIASI AKUN WORKBOOK 1 vs WORKBOOK 2]")
        for r in aligned_rows:
            wb1_lbl = loaded_items[0]["label"]
            wb2_lbl = loaded_items[1]["label"] if len(loaded_items) > 1 else None
            wb1_item = r.values_by_wb.get(wb1_lbl)
            wb2_item = r.values_by_wb.get(wb2_lbl) if wb2_lbl else None

            if r.match_status == "matched":
                coord1 = wb1_item.account_coord if wb1_item else "-"
                coord1_fml = wb1_item.coordinate if wb1_item else "-"
                fml1 = f" (Rumus: {wb1_item.formula})" if wb1_item and wb1_item.formula else ""
                coord2 = wb2_item.account_coord if wb2_item else "-"
                coord2_fml = wb2_item.coordinate if wb2_item else "-"
                fml2 = f" (Rumus: {wb2_item.formula})" if wb2_item and wb2_item.formula else ""
                val1 = wb1_item.formatted_value if wb1_item else "-"
                val2 = wb2_item.formatted_value if wb2_item else "-"
                diff = r.variances.get(wb2_lbl) if wb2_lbl else None
                diff_str = f"| Diff: {self._format_currency(diff)}" if diff is not None else ""
                print(f"  [COCOK]      '{r.account_name}'")
                print(f"               WB 1 [Akun {coord1} | Rumus {coord1_fml}{fml1}]: {val1} <===> WB 2 [Akun {coord2} | Rumus {coord2_fml}{fml2}]: {val2} {diff_str}")
            elif r.match_status == "only_in_wb1":
                coord1 = wb1_item.account_coord if wb1_item else "-"
                coord1_fml = wb1_item.coordinate if wb1_item else "-"
                val1 = wb1_item.formatted_value if wb1_item else "-"
                print(f"  [HANYA WB 1] '{r.account_name}' [Akun {coord1} | Rumus {coord1_fml}, Nilai {val1}] -> [X] TIDAK DITEMUKAN di Workbook 2")
            elif r.match_status == "only_in_wb2":
                coord2 = wb2_item.account_coord if wb2_item else "-"
                coord2_fml = wb2_item.coordinate if wb2_item else "-"
                val2 = wb2_item.formatted_value if wb2_item else "-"
                print(f"  [HANYA WB 2] '{r.account_name}' [Akun {coord2} | Rumus {coord2_fml}, Nilai {val2}] -> [X] TIDAK DITEMUKAN di Workbook 1")
            else:
                print(f"  [PARSIAL]    '{r.account_name}' -> Ditemukan di: {r.present_in_wbs}, Hilang di: {r.missing_in_wbs}")

        print("\n=== RINGKASAN HASIL REKONSILIASI AKUN ===")
        print(f"Total Akun Unik           : {summary.total_accounts}")
        print(f"Cocok di Semua Workbook   : {summary.matched_accounts}")
        print(f"Hanya di Workbook 1       : {summary.only_in_wb1_count}")
        print(f"Hanya di Workbook 2       : {summary.only_in_wb2_count}")
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        log_reconciliation(
            f"Rekonsiliasi Selesai: Total {summary.total_accounts} Akun Unik | "
            f"Cocok: {summary.matched_accounts} | Hanya WB 1: {summary.only_in_wb1_count} | "
            f"Hanya WB 2: {summary.only_in_wb2_count} dalam {elapsed_ms:.1f}ms"
        )

        # Build columns list
        columns = [it["label"] for it in loaded_items]

        return HistoricalStatementCompareResponse(
            statement_type=req.statement_type,
            alignment_mode=req.alignment_mode,
            baseline_label=baseline_label,
            workbooks_info=[
                {
                    "workbook_id": it["workbook_id"],
                    "filename": it["filename"],
                    "sheet_name": it["sheet_name"],
                    "range": it["range"],
                    "formula_range": it.get("formula_range"),
                    "label": it["label"],
                    "is_baseline": (it["index"] == baseline_idx)
                }
                for it in loaded_items
            ],
            columns=columns,
            accounts=aligned_rows,
            summary=summary,
            highlights=highlights
        )

    def _find_best_sheet_for_type(self, wb, statement_type: str) -> str:
        """Heuristic to auto-select relevant sheet by statement type."""
        sheets = list(wb.cells.keys())
        patterns = {
            "income_statement": ["income", "laba", "rugi", "p&l", "profit", "is"],
            "balance_sheet": ["balance", "neraca", "bs", "posisi keuangan", "position"],
            "cashflow": ["cash", "arus kas", "cf", "cash flow"],
        }
        cand = patterns.get(statement_type, [])
        for p in cand:
            for s in sheets:
                if p in s.lower():
                    return s
        return sheets[0] if sheets else "Sheet1"

    def _extract_statement_rows(
        self,
        cells_map: Dict[str, Dict[str, Any]],
        range_str: Optional[str],
        eval_cells: Optional[Dict[str, Any]] = None,
        formula_range_str: Optional[str] = None
    ) -> Dict[str, Any]:
        """Extract structured financial statement rows from sheet cells within bounds."""
        bounds, norm_range = parse_range_bounds(range_str)
        if bounds:
            min_r, max_r, min_c, max_c = bounds
        else:
            # Auto-detect bounds from populated cells
            if not cells_map:
                return {"headers": [], "rows": [], "base_metric_value": None, "col_names": []}
            all_r = [c["row"] for c in cells_map.values()]
            all_c = [c["col"] for c in cells_map.values()]
            min_r, max_r = min(all_r), max(all_r)
            min_c, max_c = min(all_c), max(all_c)

        # Parse formula_range_str if supplied by user
        f_bounds, _ = parse_range_bounds(formula_range_str) if formula_range_str else (None, None)
        formula_col_names: Dict[int, str] = {}
        if f_bounds:
            f_min_r, f_max_r, f_min_c, f_max_c = f_bounds
            f_above_r = f_min_r - 1
            f_above_cells = {c["col"]: c for coord, c in cells_map.items() if c["row"] == f_above_r}
            for c_idx in range(f_min_c, f_max_c + 1):
                cell = f_above_cells.get(c_idx)
                val = cell.get("value") if cell else None
                formula_col_names[c_idx] = str(val).strip() if val is not None else f"Col {c_idx}"

        # Group cells by row
        rows_by_idx: Dict[int, Dict[int, Dict[str, Any]]] = {}
        for coord, cell in cells_map.items():
            r, c = cell["row"], cell["col"]
            if min_r <= r <= max_r and min_c <= c <= max_c:
                if r not in rows_by_idx:
                    rows_by_idx[r] = {}
                rows_by_idx[r][c] = cell

        sorted_rows = sorted(rows_by_idx.keys())
        if not sorted_rows:
            return {"headers": [], "rows": [], "base_metric_value": None, "col_names": []}

        # Header identification:
        # Check if the initial rows are table headers (generic labels like "Account Name", "Historical") or real account rows
        header_rows_to_skip = set()
        col_names: Dict[int, str] = {}

        first_r = sorted_rows[0]
        first_row_cells = rows_by_idx[first_r]

        # Extract text in the first row account column
        first_txt = None
        for c_cand in [min_c, min_c + 1]:
            c_cell = first_row_cells.get(c_cand)
            if c_cell and c_cell.get("value") is not None:
                txt = str(c_cell["value"]).strip()
                if txt and not self._is_pure_number(txt):
                    first_txt = txt
                    break

        # Only treat first row as header if it matches generic header labels (e.g. "Account", "Description")
        # or if it has NO text in account col while having multiple cells
        if is_generic_header_label(first_txt) or (first_txt is None and len(first_row_cells) > 1):
            header_rows_to_skip.add(first_r)
            for c_idx in range(min_c, max_c + 1):
                cell = first_row_cells.get(c_idx)
                val = cell.get("value") if cell else None
                col_names[c_idx] = str(val).strip() if val is not None else f"Col {c_idx}"

            # Check if second row is also a sub-header (e.g. Amount / %)
            if len(sorted_rows) > 1:
                second_r = sorted_rows[1]
                second_cells = rows_by_idx[second_r]
                second_txt = None
                for c_cand in [min_c, min_c + 1]:
                    c_cell = second_cells.get(c_cand)
                    if c_cell and c_cell.get("value") is not None:
                        txt = str(c_cell["value"]).strip()
                        if txt and not self._is_pure_number(txt):
                            second_txt = txt
                            break
                if is_generic_header_label(second_txt) or (second_txt is None and len(second_cells) > 1):
                    header_rows_to_skip.add(second_r)
        else:
            # First row is already actual account data! (e.g. C16: "Cash and Cash Equivalents")
            # Try to read column names from the row above (min_r - 1) in cells_map if available
            above_r = min_r - 1
            above_cells = {c["col"]: c for coord, c in cells_map.items() if c["row"] == above_r}
            for c_idx in range(min_c, max_c + 1):
                cell = above_cells.get(c_idx)
                val = cell.get("value") if cell else None
                col_names[c_idx] = str(val).strip() if val is not None else f"Col {c_idx}"

        # Account descriptions are typically in min_c or min_c+1
        account_col_idx = min_c
        data_rows = []
        base_metric_value = None

        for r_idx in sorted_rows:
            if r_idx in header_rows_to_skip:
                continue
            r_cells = rows_by_idx[r_idx]

            # Find account title
            raw_title = None
            for c_cand in [min_c, min_c + 1]:
                cand_cell = r_cells.get(c_cand)
                if cand_cell and cand_cell.get("value") is not None:
                    txt = str(cand_cell["value"]).strip()
                    # If it's a string and not purely numeric
                    if txt and not self._is_pure_number(txt):
                        raw_title = txt
                        account_col_idx = c_cand
                        break

            if not raw_title:
                continue

            norm_title = normalize_account_title(raw_title)
            is_summary = is_summary_account(raw_title)

            # Extract numeric/formula columns
            col_values = []
            primary_numeric_val = None
            primary_coord = None
            primary_formula = None

            if f_bounds:
                # Dedicated formula/value range specified by user (e.g. E16:E99)
                f_min_r, f_max_r, f_min_c, f_max_c = f_bounds
                target_f_r = r_idx if (f_min_r <= r_idx <= f_max_r) else (f_min_r + (r_idx - min_r))

                for c_idx in range(f_min_c, f_max_c + 1):
                    coord = format_cell_coordinate(target_f_r, c_idx)
                    c_data = cells_map.get(coord)
                    header_name = formula_col_names.get(c_idx, f"Col {c_idx}")
                    if c_data:
                        raw_val = c_data.get("value")
                        fml = c_data.get("formula")
                        eval_val = eval_cells.get(coord) if eval_cells else None
                        effective_val = eval_val if eval_val is not None else raw_val
                        num_val = self._to_numeric(effective_val)
                        col_values.append({
                            "col_index": c_idx,
                            "col_name": header_name,
                            "coordinate": coord,
                            "value": num_val if num_val is not None else effective_val,
                            "raw_value": raw_val,
                            "formula": fml,
                            "is_formula": bool(fml)
                        })
                        if primary_coord is None or (f_max_c > f_min_c and any(k in header_name.lower() for k in ["total", "full year", "year end", "fy", "annual"])):
                            primary_numeric_val = num_val if num_val is not None else effective_val
                            primary_coord = coord
                            primary_formula = fml
                    else:
                        col_values.append({
                            "col_index": c_idx,
                            "col_name": header_name,
                            "coordinate": coord,
                            "value": None,
                            "raw_value": None,
                            "formula": None,
                            "is_formula": False
                        })
                        if primary_coord is None:
                            primary_coord = coord

                if primary_coord is None:
                    primary_coord = format_cell_coordinate(target_f_r, f_min_c)

            elif min_c == max_c:
                # Single column of accounts selected (e.g. C16:C99)
                # Search adjacent columns in cells_map for amounts and formulas
                row_cells_all = [c for coord, c in cells_map.items() if c["row"] == r_idx and c["col"] > min_c]
                row_cells_all.sort(key=lambda c: c["col"])
                for c_data in row_cells_all:
                    c_idx = c_data["col"]
                    coord = format_cell_coordinate(r_idx, c_idx)
                    raw_val = c_data.get("value")
                    fml = c_data.get("formula")
                    eval_val = eval_cells.get(coord) if eval_cells else None
                    effective_val = eval_val if eval_val is not None else raw_val
                    num_val = self._to_numeric(effective_val)
                    if num_val is not None:
                        col_values.append({
                            "col_index": c_idx,
                            "col_name": f"Col {c_idx}",
                            "coordinate": coord,
                            "value": num_val,
                            "raw_value": raw_val,
                            "formula": fml,
                            "is_formula": bool(fml)
                        })
                        if primary_numeric_val is None:
                            primary_numeric_val = num_val
                            primary_coord = coord
                            primary_formula = fml
            else:
                # Look through data columns
                for c_idx in range(account_col_idx + 1, max_c + 1):
                    c_data = r_cells.get(c_idx)
                    header_name = col_names.get(c_idx, f"Col {c_idx}")
                    coord = format_cell_coordinate(r_idx, c_idx)
                    if c_data:
                        raw_val = c_data.get("value")
                        fml = c_data.get("formula")
                        eval_val = eval_cells.get(coord) if eval_cells else None
                        effective_val = eval_val if eval_val is not None else raw_val
                        num_val = self._to_numeric(effective_val)
                        col_values.append({
                            "col_index": c_idx,
                            "col_name": header_name,
                            "coordinate": coord,
                            "value": num_val if num_val is not None else effective_val,
                            "raw_value": raw_val,
                            "formula": fml,
                            "is_formula": bool(fml)
                        })
                        # Prioritize "Full Year", "Total", "Year End", or latest column for primary value
                        if num_val is not None:
                            is_total_col = any(k in header_name.lower() for k in ["total", "full year", "year end", "fy", "annual"])
                            if primary_numeric_val is None or is_total_col:
                                primary_numeric_val = num_val
                                primary_coord = coord
                                primary_formula = fml
                    else:
                        col_values.append({
                            "col_index": c_idx,
                            "col_name": header_name,
                            "coordinate": coord,
                            "value": None,
                            "raw_value": None,
                            "formula": None,
                            "is_formula": False
                        })

            # Check if this row is a base metric (Total Revenue or Total Assets)
            if any(k in norm_title for k in ["gross revenue", "total revenue", "revenue", "total assets"]) and base_metric_value is None:
                if primary_numeric_val and primary_numeric_val != 0:
                    base_metric_value = abs(primary_numeric_val)

            data_rows.append({
                "row_index": r_idx,
                "raw_account_name": raw_title,
                "normalized_name": norm_title,
                "is_summary": is_summary,
                "account_coord": format_cell_coordinate(r_idx, account_col_idx),
                "primary_value": primary_numeric_val,
                "primary_coord": primary_coord or format_cell_coordinate(r_idx, account_col_idx + 1),
                "primary_formula": primary_formula,
                "col_values": col_values
            })

        return {
            "headers": list(formula_col_names.values()) if formula_col_names else list(col_names.values()),
            "rows": data_rows,
            "base_metric_value": base_metric_value,
            "col_names": formula_col_names if formula_col_names else col_names
        }

    def _align_accounts(
        self,
        parsed_wb_statements: List[Dict[str, Any]],
        alignment_mode: str,
        baseline_label: str,
        statement_type: str
    ) -> List[AccountComparisonRow]:
        """Align accounts across all workbooks based on selected alignment mode."""
        aligned_rows: List[AccountComparisonRow] = []

        if alignment_mode == "account_name":
            # Collect unique accounts across workbooks in canonical order
            account_keys: List[Tuple[str, str, bool]] = [] # (normalized_name, raw_name, is_summary)
            seen_keys: Set[str] = set()

            for parsed in parsed_wb_statements:
                for r in parsed["rows"]:
                    norm = r["normalized_name"]
                    if norm and norm not in seen_keys:
                        seen_keys.add(norm)
                        account_keys.append((norm, r["raw_account_name"], r["is_summary"]))

            # For each account, collect data from each workbook
            for norm_key, sample_raw_title, is_summary in account_keys:
                values_by_wb: Dict[str, AccountValueItem] = {}
                best_raw_title = sample_raw_title

                for parsed in parsed_wb_statements:
                    wb_label = parsed["meta"]["label"]
                    # Find matching row in this workbook
                    match = next((r for r in parsed["rows"] if r["normalized_name"] == norm_key), None)
                    if not match:
                        # Try fuzzy token overlap match
                        match = self._fuzzy_match_account(norm_key, parsed["rows"])

                    if match:
                        best_raw_title = match["raw_account_name"]
                        base_val = parsed.get("base_metric_value")
                        comm_size = None
                        if base_val and match["primary_value"] is not None and base_val > 0:
                            comm_size = round((match["primary_value"] / base_val) * 100, 2)

                        r_idx, c_idx = parse_cell_coordinate(match["primary_coord"])
                        values_by_wb[wb_label] = AccountValueItem(
                            workbook_id=parsed["meta"]["workbook_id"],
                            label=wb_label,
                            filename=parsed["meta"]["filename"],
                            sheet_name=parsed["meta"]["sheet_name"],
                            range=parsed["meta"]["range"],
                            formula_range=parsed["meta"].get("formula_range"),
                            account_name=match["raw_account_name"],
                            account_coord=match.get("account_coord"),
                            coordinate=match["primary_coord"],
                            row=r_idx,
                            col=c_idx,
                            value=match["primary_value"],
                            formatted_value=self._format_currency(match["primary_value"]),
                            formula=match["primary_formula"],
                            is_formula=bool(match["primary_formula"]),
                            is_present=True,
                            col_values=match["col_values"],
                            common_size_pct=comm_size
                        )
                    else:
                        values_by_wb[wb_label] = AccountValueItem(
                            workbook_id=parsed["meta"]["workbook_id"],
                            label=wb_label,
                            filename=parsed["meta"]["filename"],
                            sheet_name=parsed["meta"]["sheet_name"],
                            range=parsed["meta"]["range"],
                            formula_range=parsed["meta"].get("formula_range"),
                            account_name=None,
                            account_coord=None,
                            coordinate=None,
                            value=None,
                            formatted_value="-",
                            formula=None,
                            is_formula=False,
                            is_present=False,
                            col_values=[],
                            common_size_pct=None
                        )

                # Compute variances & growth rates against baseline
                baseline_entry = values_by_wb.get(baseline_label)
                baseline_val = baseline_entry.value if baseline_entry else None

                target_values: Dict[str, Any] = {}
                variances: Dict[str, Optional[float]] = {}
                growth_pcts: Dict[str, Optional[float]] = {}
                formula_statuses: Dict[str, str] = {}
                anomalies: List[str] = []

                for parsed in parsed_wb_statements:
                    w_label = parsed["meta"]["label"]
                    w_entry = values_by_wb.get(w_label)
                    w_val = w_entry.value if w_entry else None
                    target_values[w_label] = w_val

                    # Variance & Growth
                    if baseline_val is not None and w_val is not None:
                        diff = round(float(w_val) - float(baseline_val), 2)
                        variances[w_label] = diff
                        if baseline_val != 0:
                            growth = round((diff / abs(float(baseline_val))) * 100, 2)
                            growth_pcts[w_label] = growth
                        else:
                            growth_pcts[w_label] = 100.0 if diff > 0 else 0.0
                    else:
                        variances[w_label] = None
                        growth_pcts[w_label] = None

                    # Formula Status Audit
                    b_fml = baseline_entry.formula if baseline_entry else None
                    w_fml = w_entry.formula if w_entry else None
                    if not b_fml and not w_fml:
                        f_stat = "both_hardcoded"
                    elif b_fml and not w_fml:
                        f_stat = "hardcoded_in_target"
                        anomalies.append(f"In '{w_label}', formula was replaced by a hardcoded number.")
                    elif not b_fml and w_fml:
                        f_stat = "formula_added"
                    elif b_fml == w_fml:
                        f_stat = "identical"
                    else:
                        f_stat = "formula_modified"
                        anomalies.append(f"In '{w_label}', formula changed from '{b_fml}' to '{w_fml}'.")

                    formula_statuses[w_label] = f_stat

                # Match status determination across workbooks
                present_in_wbs = [k for k, v in values_by_wb.items() if v.is_present]
                missing_in_wbs = [k for k, v in values_by_wb.items() if not v.is_present]
                first_label = parsed_wb_statements[0]["meta"]["label"]
                second_label = parsed_wb_statements[1]["meta"]["label"] if len(parsed_wb_statements) > 1 else None

                if len(present_in_wbs) == len(parsed_wb_statements):
                    match_status = "matched"
                elif second_label and first_label in present_in_wbs and second_label not in present_in_wbs:
                    match_status = "only_in_wb1"
                elif second_label and second_label in present_in_wbs and first_label not in present_in_wbs:
                    match_status = "only_in_wb2"
                else:
                    match_status = "partial"

                aligned_rows.append(AccountComparisonRow(
                    account_name=best_raw_title,
                    normalized_name=norm_key,
                    is_summary=is_summary,
                    match_status=match_status,
                    present_in_wbs=present_in_wbs,
                    missing_in_wbs=missing_in_wbs,
                    values_by_wb=values_by_wb,
                    baseline_value=baseline_val,
                    target_values=target_values,
                    variances=variances,
                    growth_pcts=growth_pcts,
                    formula_statuses=formula_statuses,
                    anomalies=anomalies
                ))

        else:
            # Row order or coordinate based alignment
            max_rows = max(len(p["rows"]) for p in parsed_wb_statements)
            for idx in range(max_rows):
                values_by_wb = {}
                sample_name = f"Account Row {idx+1}"
                is_summary = False

                for parsed in parsed_wb_statements:
                    wb_label = parsed["meta"]["label"]
                    if idx < len(parsed["rows"]):
                        match = parsed["rows"][idx]
                        sample_name = match["raw_account_name"]
                        is_summary = match["is_summary"]
                        r_idx, c_idx = parse_cell_coordinate(match["primary_coord"])
                        values_by_wb[wb_label] = AccountValueItem(
                            workbook_id=parsed["meta"]["workbook_id"],
                            label=wb_label,
                            filename=parsed["meta"]["filename"],
                            sheet_name=parsed["meta"]["sheet_name"],
                            range=parsed["meta"]["range"],
                            formula_range=parsed["meta"].get("formula_range"),
                            account_name=match["raw_account_name"],
                            account_coord=match.get("account_coord"),
                            coordinate=match["primary_coord"],
                            row=r_idx,
                            col=c_idx,
                            value=match["primary_value"],
                            formatted_value=self._format_currency(match["primary_value"]),
                            formula=match["primary_formula"],
                            is_formula=bool(match["primary_formula"]),
                            is_present=True,
                            col_values=match["col_values"]
                        )
                    else:
                        values_by_wb[wb_label] = AccountValueItem(
                            workbook_id=parsed["meta"]["workbook_id"],
                            label=wb_label,
                            filename=parsed["meta"]["filename"],
                            sheet_name=parsed["meta"]["sheet_name"],
                            range=parsed["meta"]["range"],
                            formula_range=parsed["meta"].get("formula_range"),
                            account_name=None,
                            account_coord=None,
                            coordinate=None,
                            value=None,
                            formatted_value="-",
                            formula=None,
                            is_formula=False,
                            is_present=False,
                            col_values=[]
                        )

                baseline_entry = values_by_wb.get(baseline_label)
                baseline_val = baseline_entry.value if baseline_entry else None
                target_values = {}
                variances = {}
                growth_pcts = {}
                formula_statuses = {}

                for parsed in parsed_wb_statements:
                    w_label = parsed["meta"]["label"]
                    w_entry = values_by_wb.get(w_label)
                    w_val = w_entry.value if w_entry else None
                    target_values[w_label] = w_val
                    if baseline_val is not None and w_val is not None:
                        diff = round(float(w_val) - float(baseline_val), 2)
                        variances[w_label] = diff
                        growth_pcts[w_label] = round((diff / abs(float(baseline_val))) * 100, 2) if baseline_val != 0 else 0.0
                    else:
                        variances[w_label] = None
                        growth_pcts[w_label] = None
                    formula_statuses[w_label] = "identical" if (w_entry and baseline_entry and w_entry.formula == baseline_entry.formula) else "formula_modified"

                present_in_wbs = [k for k, v in values_by_wb.items() if v.is_present]
                missing_in_wbs = [k for k, v in values_by_wb.items() if not v.is_present]
                first_label = parsed_wb_statements[0]["meta"]["label"]
                second_label = parsed_wb_statements[1]["meta"]["label"] if len(parsed_wb_statements) > 1 else None

                if len(present_in_wbs) == len(parsed_wb_statements):
                    match_status = "matched"
                elif second_label and first_label in present_in_wbs and second_label not in present_in_wbs:
                    match_status = "only_in_wb1"
                elif second_label and second_label in present_in_wbs and first_label not in present_in_wbs:
                    match_status = "only_in_wb2"
                else:
                    match_status = "partial"

                aligned_rows.append(AccountComparisonRow(
                    account_name=sample_name,
                    normalized_name=normalize_account_title(sample_name),
                    is_summary=is_summary,
                    match_status=match_status,
                    present_in_wbs=present_in_wbs,
                    missing_in_wbs=missing_in_wbs,
                    values_by_wb=values_by_wb,
                    baseline_value=baseline_val,
                    target_values=target_values,
                    variances=variances,
                    growth_pcts=growth_pcts,
                    formula_statuses=formula_statuses,
                    anomalies=[]
                ))

        return aligned_rows

    def _fuzzy_match_account(self, target_norm: str, rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Match by token subset if words are rearranged or slightly extended."""
        target_tokens = set(target_norm.split())
        best_match = None
        best_score = 0.0
        for r in rows:
            cand_tokens = set(r["normalized_name"].split())
            if not cand_tokens:
                continue
            intersection = target_tokens.intersection(cand_tokens)
            score = len(intersection) / max(len(target_tokens), len(cand_tokens))
            if score >= 0.7 and score > best_score:
                best_score = score
                best_match = r
        return best_match

    def _build_highlights(
        self,
        aligned_rows: List[AccountComparisonRow],
        loaded_items: List[Dict[str, Any]],
        baseline_label: str
    ) -> List[Dict[str, Any]]:
        """Generate cell highlights for Luckysheet."""
        highlights = []
        for r in aligned_rows:
            for it in loaded_items:
                wb_label = it["label"]
                val_item = r.values_by_wb.get(wb_label)
                if not val_item or not val_item.coordinate:
                    continue

                # Determine highlight color
                f_stat = r.formula_statuses.get(wb_label, "")
                growth = r.growth_pcts.get(wb_label)
                color = None

                if f_stat == "hardcoded_in_target":
                    color = "#fed7aa"  # Amber: formula replaced by constant
                elif f_stat == "formula_modified":
                    color = "#fef08a"  # Yellow: formula modified
                elif growth is not None and wb_label != baseline_label:
                    if growth > 15:
                        color = "#bbf7d0"  # Soft green: high growth
                    elif growth < -10:
                        color = "#fecdd3"  # Soft red: significant drop
                elif r.is_summary:
                    color = "#e0e7ff"  # Soft indigo: summary line

                if color:
                    highlights.append({
                        "sheet": it["sheet_name"],
                        "coordinate": val_item.coordinate,
                        "color": color,
                        "tooltip": f"{r.account_name} ({wb_label}): {val_item.formatted_value}"
                    })
        return highlights

    def _compute_summary(
        self,
        aligned_rows: List[AccountComparisonRow],
        loaded_items: List[Dict[str, Any]],
        baseline_label: str,
        statement_type: str
    ) -> StatementSummaryKPIs:
        """Compute executive KPIs, divergence count, and alerts."""
        total_accounts = len(aligned_rows)
        matched_accounts = 0
        unmatched_accounts = 0
        formula_divergence_count = 0
        alerts: List[str] = []
        key_metrics: Dict[str, Any] = {}

        wb_count = len(loaded_items)
        for r in aligned_rows:
            present_count = sum(1 for v in r.values_by_wb.values() if v.is_present)
            if present_count == wb_count:
                matched_accounts += 1
            else:
                unmatched_accounts += 1

            # Count formula modifications/hardcoded
            for w_label, f_stat in r.formula_statuses.items():
                if f_stat in ("hardcoded_in_target", "formula_modified"):
                    formula_divergence_count += 1
                    if f_stat == "hardcoded_in_target":
                        alerts.append(f"Hardcoded override in '{r.account_name}' ({w_label})")

            # Check for key financial metrics
            norm = r.normalized_name
            if any(k in norm for k in ["gross revenue", "total revenue", "revenue"]):
                key_metrics["Revenue"] = {
                    "baseline": r.baseline_value,
                    "targets": {k: v for k, v in r.target_values.items() if k != baseline_label},
                    "growth_pcts": {k: v for k, v in r.growth_pcts.items() if k != baseline_label}
                }
            elif any(k in norm for k in ["net income", "laba bersih"]):
                key_metrics["Net Income"] = {
                    "baseline": r.baseline_value,
                    "targets": {k: v for k, v in r.target_values.items() if k != baseline_label},
                    "growth_pcts": {k: v for k, v in r.growth_pcts.items() if k != baseline_label}
                }
            elif any(k in norm for k in ["total assets", "total aktiva"]):
                key_metrics["Total Assets"] = {
                    "baseline": r.baseline_value,
                    "targets": {k: v for k, v in r.target_values.items() if k != baseline_label},
                    "growth_pcts": {k: v for k, v in r.growth_pcts.items() if k != baseline_label}
                }
            elif any(k in norm for k in ["operating cash flow", "net cash from operating activities"]):
                key_metrics["Operating Cash Flow"] = {
                    "baseline": r.baseline_value,
                    "targets": {k: v for k, v in r.target_values.items() if k != baseline_label},
                    "growth_pcts": {k: v for k, v in r.growth_pcts.items() if k != baseline_label}
                }

        only_in_wb1_count = sum(1 for r in aligned_rows if r.match_status == "only_in_wb1")
        only_in_wb2_count = sum(1 for r in aligned_rows if r.match_status == "only_in_wb2")

        return StatementSummaryKPIs(
            statement_type=statement_type,
            total_accounts=total_accounts,
            matched_accounts=matched_accounts,
            unmatched_accounts=unmatched_accounts,
            only_in_wb1_count=only_in_wb1_count,
            only_in_wb2_count=only_in_wb2_count,
            formula_divergence_count=formula_divergence_count,
            key_metrics=key_metrics,
            alerts=alerts[:10]  # Cap top 10 alerts
        )

    def _is_pure_number(self, val: str) -> bool:
        try:
            float(val.replace(',', '').replace('$', '').replace('%', '').strip())
            return True
        except ValueError:
            return False

    def _to_numeric(self, val: Any) -> Optional[float]:
        if val is None:
            return None
        if isinstance(val, (int, float)):
            return float(val)
        try:
            clean = str(val).replace(',', '').replace('$', '').replace('%', '').strip()
            return float(clean)
        except ValueError:
            return None

    def _format_currency(self, val: Any) -> str:
        """Format numbers with thousand separators without currency symbol ($)."""
        if val is None:
            return "-"
        if isinstance(val, (int, float)):
            if abs(val) >= 1:
                return f"{val:,.0f}" if float(val).is_integer() else f"{val:,.2f}"
            return f"{val:,.2f}"
        return str(val)

historical_comparator = HistoricalStatementComparator()
