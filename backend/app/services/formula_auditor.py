import re
import time
from typing import Dict, Any, List, Optional, Tuple, Set
from collections import Counter
from backend.app.services.workbook_manager import workbook_manager
from backend.app.models.schemas import AnomalyItem, AuditAnomaliesResponse
from backend.app.utils.logger import log_audit, log_error
from backend.app.services.formula_parser import (
    extract_references_from_formula,
    parse_cell_coordinate,
    format_cell_coordinate,
    parse_range_bounds,
    normalize_formula,
    CELL_REF_REGEX,
    FUNCTION_REGEX
)

class FormulaAuditor:
    def audit_workbook(
        self,
        workbook_id: str,
        sheet_filter: Optional[str] = None,
        range_filter: Optional[str] = None
    ) -> AuditAnomaliesResponse:
        start_time = time.perf_counter()
        wb = workbook_manager.get_workbook(workbook_id)
        if not wb:
            raise ValueError(f"Workbook {workbook_id} not found")

        anomalies: List[AnomalyItem] = []
        sheets_to_audit = [sheet_filter] if sheet_filter else list(wb.cells.keys())

        # Parse range bounds if range_filter is provided (e.g. "C4:H30" or "D10")
        range_bounds, norm_range = parse_range_bounds(range_filter) if range_filter else (None, None)
        target_min_r, target_max_r, target_min_c, target_max_c = (None, None, None, None)
        if range_bounds:
            target_min_r, target_max_r, target_min_c, target_max_c = range_bounds

        scope_desc = f"Sheet: '{sheet_filter}'" if sheet_filter else f"{len(sheets_to_audit)} Sheet"
        if range_filter:
            scope_desc += f", Range: '{norm_range or range_filter}'"
        log_audit(f"Memulai Audit Anomali Formula: Workbook='{wb.filename}' (ID: {workbook_id}) | Cakupan: {scope_desc}")

        for sheet_name in sheets_to_audit:
            sheet_cells = wb.cells.get(sheet_name, {})
            if not sheet_cells:
                continue

            # 2D Grid map of all cells in this sheet: (row, col) -> cell dict
            grid: Dict[Tuple[int, int], Dict[str, Any]] = {}
            for coord, cell in sheet_cells.items():
                r = cell["row"]
                c = cell["col"]
                grid[(r, c)] = cell

            # Determine cells to inspect
            cells_to_inspect: List[Dict[str, Any]] = []
            for (r, c), cell in grid.items():
                if range_bounds:
                    if not (target_min_r <= r <= target_max_r and target_min_c <= c <= target_max_c):
                        continue
                cells_to_inspect.append(cell)

            # Sort cells to inspect by row, then col
            cells_to_inspect.sort(key=lambda x: (x["row"], x["col"]))
            log_audit(f"Sheet '{sheet_name}': Menginspeksi {len(cells_to_inspect)} sel dalam grid...")

            # Group cells by row and by column
            row_map: Dict[int, List[Dict[str, Any]]] = {}
            col_map: Dict[int, List[Dict[str, Any]]] = {}
            for cell in cells_to_inspect:
                r = cell["row"]
                c = cell["col"]
                row_map.setdefault(r, []).append(cell)
                col_map.setdefault(c, []).append(cell)

            # -------------------------------------------------------------
            # Check 1: Broken Reference, Error Tokens, External & Hidden Refs
            # -------------------------------------------------------------
            for cell in cells_to_inspect:
                formula = cell.get("formula")
                coord = cell["coordinate"]
                r = cell["row"]
                c = cell["col"]

                if formula:
                    # Broken reference errors
                    if "#REF!" in formula:
                        anomalies.append(AnomalyItem(
                            sheet=sheet_name,
                            coordinate=coord,
                            row=r,
                            col=c,
                            severity="high",
                            anomaly_type="ref_error",
                            description="Formula mengandung referensi sel yang rusak (#REF!)",
                            formula=formula
                        ))
                    elif any(err in formula for err in ["#VALUE!", "#N/A", "#NAME?", "#DIV/0!", "#NULL!", "#NUM!"]):
                        err_token = next(err for err in ["#VALUE!", "#N/A", "#NAME?", "#DIV/0!", "#NULL!", "#NUM!"] if err in formula)
                        anomalies.append(AnomalyItem(
                            sheet=sheet_name,
                            coordinate=coord,
                            row=r,
                            col=c,
                            severity="high",
                            anomaly_type="ref_error",
                            description=f"Formula mengandung token error Excel ({err_token})",
                            formula=formula
                        ))

                    # External workbook link
                    refs = extract_references_from_formula(formula, sheet_name)
                    for ref in refs:
                        if ref.get("is_external"):
                            anomalies.append(AnomalyItem(
                                sheet=sheet_name,
                                coordinate=coord,
                                row=r,
                                col=c,
                                severity="medium",
                                anomaly_type="external_reference",
                                description=f"Formula terhubung ke tautan workbook eksternal: {ref.get('workbook')}",
                                formula=formula,
                                affected_context=ref.get('raw')
                            ))
                            break

                    # Reference to hidden cell/sheet/row/column
                    for ref in refs:
                        target_sh = ref.get("sheet") or sheet_name
                        found_hidden = False
                        for target_cell_ref in ref.get("cells", []):
                            tc_clean = target_cell_ref.split('!')[-1] if '!' in target_cell_ref else target_cell_ref
                            try:
                                tr, tc = parse_cell_coordinate(tc_clean)
                                is_t_hidden, reasons = wb.is_cell_hidden(target_sh, tr, tc)
                                if is_t_hidden:
                                    anomalies.append(AnomalyItem(
                                        sheet=sheet_name,
                                        coordinate=coord,
                                        row=r,
                                        col=c,
                                        severity="medium",
                                        anomaly_type="hidden_reference",
                                        description=f"Formula merujuk ke data tersembunyi di {target_sh}!{tc_clean} ({', '.join(reasons)})",
                                        formula=formula,
                                        affected_context=f"{target_sh}!{tc_clean}"
                                    ))
                                    found_hidden = True
                                    break
                            except Exception:
                                pass
                        if found_hidden:
                            break

            # -------------------------------------------------------------
            # Check 2: Immediate Neighbor Sandwich Outlier Check (Horizontal & Vertical)
            # -------------------------------------------------------------
            for cell in cells_to_inspect:
                r = cell["row"]
                c = cell["col"]
                coord = cell["coordinate"]
                curr_fml = cell.get("formula")
                curr_norm = cell.get("normalized") or (normalize_formula(curr_fml, r, c) if curr_fml else "")
                val = cell.get("value")

                # Horizontal Sandwich: (r, c-1) and (r, c+1)
                left_cell = grid.get((r, c - 1))
                right_cell = grid.get((r, c + 1))
                if left_cell and right_cell:
                    l_fml = left_cell.get("formula")
                    r_fml = right_cell.get("formula")
                    l_norm = left_cell.get("normalized") or (normalize_formula(l_fml, r, c - 1) if l_fml else "")
                    r_norm = right_cell.get("normalized") or (normalize_formula(r_fml, r, c + 1) if r_fml else "")

                    if l_norm and r_norm and l_norm == r_norm:
                        # Left and Right have identical relative formula pattern!
                        if not curr_fml:
                            # Hardcoded number in the middle of identical formula neighbors
                            if val is not None and str(val).strip() != "":
                                anomalies.append(AnomalyItem(
                                    sheet=sheet_name,
                                    coordinate=coord,
                                    row=r,
                                    col=c,
                                    severity="high",
                                    anomaly_type="hardcoded_in_series",
                                    description=f"Nilai konstan ({val}) diapit oleh formula dengan pola identik di sel kiri ({left_cell['coordinate']}) dan kanan ({right_cell['coordinate']})",
                                    expected_pattern=l_norm,
                                    expected_formula=l_fml,
                                    neighbor_summary=f"Kiri ({left_cell['coordinate']}): {l_fml} | Kanan ({right_cell['coordinate']}): {r_fml}",
                                    affected_context=f"Baris {r} diapit sel berformula"
                                ))
                        elif curr_norm != l_norm:
                            # Current cell formula diverges from identical left & right neighbors!
                            anomalies.append(AnomalyItem(
                                sheet=sheet_name,
                                coordinate=coord,
                                row=r,
                                col=c,
                                severity="high",
                                anomaly_type="formula_inconsistency",
                                description=f"Formula berbeda dari sel sebelah kiri ({left_cell['coordinate']}) dan kanan ({right_cell['coordinate']}) yang memiliki pola identik",
                                formula=curr_fml,
                                expected_pattern=l_norm,
                                expected_formula=l_fml,
                                neighbor_summary=f"Kiri ({left_cell['coordinate']}): {l_fml} | Kanan ({right_cell['coordinate']}): {r_fml}",
                                affected_context=f"Baris {r} pola formula anomali"
                            ))

                # Vertical Sandwich: (r-1, c) and (r+1, c)
                top_cell = grid.get((r - 1, c))
                bot_cell = grid.get((r + 1, c))
                if top_cell and bot_cell:
                    t_fml = top_cell.get("formula")
                    b_fml = bot_cell.get("formula")
                    t_norm = top_cell.get("normalized") or (normalize_formula(t_fml, r - 1, c) if t_fml else "")
                    b_norm = bot_cell.get("normalized") or (normalize_formula(b_fml, r + 1, c) if b_fml else "")

                    if t_norm and b_norm and t_norm == b_norm:
                        # Top and Bottom have identical relative formula pattern!
                        if not curr_fml:
                            if val is not None and str(val).strip() != "":
                                anomalies.append(AnomalyItem(
                                    sheet=sheet_name,
                                    coordinate=coord,
                                    row=r,
                                    col=c,
                                    severity="high",
                                    anomaly_type="hardcoded_in_series",
                                    description=f"Nilai konstan ({val}) diapit oleh formula kolom di atas ({top_cell['coordinate']}) dan bawah ({bot_cell['coordinate']})",
                                    expected_pattern=t_norm,
                                    expected_formula=t_fml,
                                    neighbor_summary=f"Atas ({top_cell['coordinate']}): {t_fml} | Bawah ({bot_cell['coordinate']}): {b_fml}",
                                    affected_context=f"Kolom {index_to_col_letter(c)} diapit sel berformula"
                                ))
                        elif curr_norm != t_norm:
                            anomalies.append(AnomalyItem(
                                sheet=sheet_name,
                                coordinate=coord,
                                row=r,
                                col=c,
                                severity="high",
                                anomaly_type="formula_inconsistency",
                                description=f"Formula kolom berbeda dari sel atas ({top_cell['coordinate']}) dan bawah ({bot_cell['coordinate']}) yang memiliki pola identik",
                                formula=curr_fml,
                                expected_pattern=t_norm,
                                expected_formula=t_fml,
                                neighbor_summary=f"Atas ({top_cell['coordinate']}): {t_fml} | Bawah ({bot_cell['coordinate']}): {b_fml}",
                                affected_context=f"Kolom {index_to_col_letter(c)} pola formula anomali"
                            ))

            # -------------------------------------------------------------
            # Check 3: Row-Wise & Column-Wise Cluster Majority Outlier Check
            # -------------------------------------------------------------
            for r, cells_in_row in row_map.items():
                cells_in_row.sort(key=lambda x: x["col"])
                self._check_cluster_inconsistencies(sheet_name, cells_in_row, "row", anomalies)

            for c, cells_in_col in col_map.items():
                cells_in_col.sort(key=lambda x: x["row"])
                self._check_cluster_inconsistencies(sheet_name, cells_in_col, "column", anomalies)

            # -------------------------------------------------------------
            # Check 4: Aggregate Function (SUM/AVERAGE/COUNT) Range Omission Check
            # -------------------------------------------------------------
            for cell in cells_to_inspect:
                self._check_range_omission_with_neighbors(sheet_name, cell, grid, anomalies)

            # -------------------------------------------------------------
            # Check 5: Embedded Hardcoded Scalar Numbers in Formula
            # -------------------------------------------------------------
            for cell in cells_to_inspect:
                self._check_embedded_constants_with_neighbors(sheet_name, cell, grid, anomalies)

        # Remove duplicate anomalies for the same cell and type
        unique_anomalies: List[AnomalyItem] = []
        seen = set()
        for a in anomalies:
            key = (a.sheet, a.coordinate, a.anomaly_type)
            if key not in seen:
                seen.add(key)
                unique_anomalies.append(a)

        # Sort anomalies: high -> medium -> low, then by coordinate
        severity_weight = {"high": 0, "medium": 1, "low": 2}
        unique_anomalies.sort(key=lambda x: (severity_weight.get(x.severity, 3), x.sheet, x.row, x.col))

        high_count = sum(1 for a in unique_anomalies if a.severity == "high")
        med_count = sum(1 for a in unique_anomalies if a.severity == "medium")
        low_count = sum(1 for a in unique_anomalies if a.severity == "low")

        elapsed_ms = (time.perf_counter() - start_time) * 1000
        log_audit(
            f"Audit Selesai: Total {len(unique_anomalies)} anomali ditemukan "
            f"(High: {high_count}, Med: {med_count}, Low: {low_count}) dalam {elapsed_ms:.1f}ms"
        )
        for a in unique_anomalies[:10]:
            log_audit(f"  * [{a.severity.upper()}] {a.sheet}!{a.coordinate} ({a.anomaly_type}): {a.description}")
        if len(unique_anomalies) > 10:
            log_audit(f"  ... dan {len(unique_anomalies) - 10} anomali lainnya.")

        return AuditAnomaliesResponse(
            workbook_id=workbook_id,
            sheet_name=sheet_filter,
            range=norm_range if norm_range else range_filter,
            total_anomalies=len(unique_anomalies),
            high_severity_count=high_count,
            medium_severity_count=med_count,
            low_severity_count=low_count,
            anomalies=unique_anomalies[:500]
        )

    def _check_cluster_inconsistencies(
        self,
        sheet_name: str,
        series: List[Dict[str, Any]],
        direction: str,
        anomalies: List[AnomalyItem]
    ):
        """
        Examines sequences of adjacent cells in a row or column.
        Detects cells whose formula pattern diverges from the dominant pattern of the cluster.
        """
        if len(series) < 3:
            return

        # Segment series into contiguous blocks (where cell index difference is <= 2)
        segments: List[List[Dict[str, Any]]] = []
        curr_segment: List[Dict[str, Any]] = [series[0]]

        for i in range(1, len(series)):
            prev = series[i - 1]
            curr = series[i]
            diff = (curr["col"] - prev["col"]) if direction == "row" else (curr["row"] - prev["row"])
            if diff <= 2:
                curr_segment.append(curr)
            else:
                if len(curr_segment) >= 3:
                    segments.append(curr_segment)
                curr_segment = [curr]
        if len(curr_segment) >= 3:
            segments.append(curr_segment)

        for seg in segments:
            formula_cells = [c for c in seg if c.get("formula")]
            if len(formula_cells) < 2:
                continue

            patterns = []
            for c in formula_cells:
                norm = c.get("normalized") or normalize_formula(c.get("formula"), c["row"], c["col"])
                c["_temp_norm"] = norm
                if norm:
                    patterns.append(norm)

            if not patterns:
                continue

            counter = Counter(patterns)
            most_common_pattern, dominant_count = counter.most_common(1)[0]
            dom_ratio = dominant_count / len(formula_cells)

            # If dominant pattern accounts for >= 50% and is repeated at least 2 times:
            if dominant_count >= 2 and dom_ratio >= 0.50:
                rep_cell = next((c for c in formula_cells if c.get("_temp_norm") == most_common_pattern), None)
                rep_fml = rep_cell.get("formula") if rep_cell else most_common_pattern

                # Check formula outliers
                for c in formula_cells:
                    if c.get("_temp_norm") != most_common_pattern:
                        dir_label = "baris" if direction == "row" else "kolom"
                        anomalies.append(AnomalyItem(
                            sheet=sheet_name,
                            coordinate=c["coordinate"],
                            row=c["row"],
                            col=c["col"],
                            severity="medium",
                            anomaly_type="formula_inconsistency",
                            description=f"Formula ({c.get('formula')}) memiliki pola berbeda dari mayoritas pola {dir_label} ini ({dominant_count} dari {len(formula_cells)} sel sekitarnya memakai pola {rep_fml})",
                            formula=c.get("formula"),
                            expected_pattern=most_common_pattern,
                            expected_formula=rep_fml,
                            affected_context=f"Pola mayoritas {dir_label}: {rep_fml}"
                        ))

                # Also check hardcoded values nestled within this formula segment
                for c in seg:
                    if not c.get("formula"):
                        val = c.get("value")
                        if isinstance(val, (int, float)):
                            dir_label = "baris" if direction == "row" else "kolom"
                            anomalies.append(AnomalyItem(
                                sheet=sheet_name,
                                coordinate=c["coordinate"],
                                row=c["row"],
                                col=c["col"],
                                severity="high",
                                anomaly_type="hardcoded_in_series",
                                description=f"Nilai konstan ({val}) terdapat di dalam kelompok sel berformula pada {dir_label} ini",
                                expected_pattern=most_common_pattern,
                                expected_formula=rep_fml,
                                affected_context=f"Urutan formula {dir_label}"
                            ))

    def _check_range_omission_with_neighbors(
        self,
        sheet_name: str,
        cell: Dict[str, Any],
        grid: Dict[Tuple[int, int], Dict[str, Any]],
        anomalies: List[AnomalyItem]
    ):
        """
        Detects if an aggregate function (e.g. SUM, AVERAGE, COUNT) omits rows/cols compared to immediate neighbors.
        For example, neighbor sums D4:D15 (12 rows), but current cell sums E4:E14 (11 rows).
        """
        formula = cell.get("formula")
        if not formula:
            return

        clean_f = formula.lstrip('=+ ')
        upper_f = clean_f.upper()
        agg_funcs = ["SUM", "AVERAGE", "COUNT", "MAX", "MIN"]
        if not any(f"{fn}(" in upper_f for fn in agg_funcs):
            return

        r = cell["row"]
        c = cell["col"]

        # Extract range span for this formula
        curr_span = self._extract_range_span(formula)
        if not curr_span:
            return

        curr_rows, curr_cols, fn_name = curr_span

        # Compare with left neighbor (r, c-1) and right neighbor (r, c+1)
        neighbors = [grid.get((r, c - 1)), grid.get((r, c + 1))]
        for n_cell in neighbors:
            if not n_cell or not n_cell.get("formula"):
                continue
            n_span = self._extract_range_span(n_cell.get("formula"))
            if not n_span:
                continue
            n_rows, n_cols, n_fn = n_span
            if n_fn == fn_name:
                # If neighbor spans more rows (e.g. 12 rows vs 11 rows)
                if n_rows > curr_rows and abs(n_rows - curr_rows) <= 3:
                    anomalies.append(AnomalyItem(
                        sheet=sheet_name,
                        coordinate=cell["coordinate"],
                        row=r,
                        col=c,
                        severity="high",
                        anomaly_type="range_omission",
                        description=f"Rentang fungsi {fn_name} tidak lengkap: menjumlahkan {curr_rows} baris, sedangkan kolom sekitar ({n_cell['coordinate']}) menjumlahkan {n_rows} baris",
                        formula=formula,
                        expected_formula=n_cell.get("formula"),
                        neighbor_summary=f"Kolom pembanding ({n_cell['coordinate']}): {n_cell.get('formula')}",
                        affected_context=f"Baris referensi {fn_name} terpotong"
                    ))
                    break

    def _extract_range_span(self, formula: str) -> Optional[Tuple[int, int, str]]:
        """
        Parses the first range reference inside an aggregate function and returns (row_count, col_count, function_name).
        """
        for fn in ["SUM", "AVERAGE", "COUNT", "MAX", "MIN"]:
            pattern = re.compile(rf"{fn}\s*\(\s*([^()]+)\)", re.IGNORECASE)
            match = pattern.search(formula)
            if match:
                inner = match.group(1).strip()
                # Check for range coordinate like C4:C15
                range_match = re.search(r'([A-Za-z]{1,3}\$?\d+)\s*:\s*([A-Za-z]{1,3}\$?\d+)', inner)
                if range_match:
                    try:
                        c1_str = range_match.group(1).replace('$', '')
                        c2_str = range_match.group(2).replace('$', '')
                        r1, col1 = parse_cell_coordinate(c1_str)
                        r2, col2 = parse_cell_coordinate(c2_str)
                        row_span = abs(r2 - r1) + 1
                        col_span = abs(col2 - col1) + 1
                        return row_span, col_span, fn.upper()
                    except Exception:
                        pass
        return None

    def _check_embedded_constants_with_neighbors(
        self,
        sheet_name: str,
        cell: Dict[str, Any],
        grid: Dict[Tuple[int, int], Dict[str, Any]],
        anomalies: List[AnomalyItem]
    ):
        """
        Detects magic numbers / hardcoded scalars embedded in formulas (e.g. =C10 * 1.15)
        when surrounding formulas do not contain that constant.
        """
        formula = cell.get("formula")
        if not formula:
            return

        r = cell["row"]
        c = cell["col"]

        # Strip cell references and function names to find literal numbers
        f_no_refs = CELL_REF_REGEX.sub('', formula)
        f_no_funcs = FUNCTION_REGEX.sub('', f_no_refs)
        constants = re.findall(r'(?<![A-Za-z0-9_$\.])(?:\d+(?:\.\d+)?)(?![A-Za-z0-9_])', f_no_funcs)
        # Filter trivial numbers like 0 or 1 if commonly used, but keep fractions or multipliers
        significant_constants = [k for k in constants if k not in ["0", "1"]]
        if not significant_constants:
            return

        # Check if horizontal neighbors also have the constant
        left_cell = grid.get((r, c - 1))
        right_cell = grid.get((r, c + 1))
        neighbors = [x for x in [left_cell, right_cell] if x and x.get("formula")]
        if len(neighbors) >= 1:
            all_neighbors_lack_constant = True
            for n in neighbors:
                n_fml = n.get("formula", "")
                if any(k in n_fml for k in significant_constants):
                    all_neighbors_lack_constant = False
                    break

            if all_neighbors_lack_constant:
                const_str = ", ".join(significant_constants)
                anomalies.append(AnomalyItem(
                    sheet=sheet_name,
                    coordinate=cell["coordinate"],
                    row=r,
                    col=c,
                    severity="medium",
                    anomaly_type="embedded_constant",
                    description=f"Formula mengandung konstanta angka tetap ({const_str}) yang tidak terdapat pada formula sel sekitar",
                    formula=formula,
                    neighbor_summary=f"Sel pembanding ({neighbors[0]['coordinate']}): {neighbors[0]['formula']}",
                    affected_context=f"Konstanta scalar {const_str}"
                ))

def index_to_col_letter(col_idx: int) -> str:
    import openpyxl.utils
    return openpyxl.utils.get_column_letter(col_idx)

formula_auditor = FormulaAuditor()
