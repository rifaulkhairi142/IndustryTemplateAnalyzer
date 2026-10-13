from typing import Dict, Any, List, Optional
from collections import Counter
from backend.app.services.workbook_manager import workbook_manager
from backend.app.models.schemas import AnomalyItem, AuditAnomaliesResponse
from backend.app.services.formula_parser import extract_references_from_formula, parse_cell_coordinate

class FormulaAuditor:
    def audit_workbook(self, workbook_id: str, sheet_filter: Optional[str] = None) -> AuditAnomaliesResponse:
        wb = workbook_manager.get_workbook(workbook_id)
        if not wb:
            raise ValueError(f"Workbook {workbook_id} not found")

        anomalies: List[AnomalyItem] = []
        sheets_to_audit = [sheet_filter] if sheet_filter else list(wb.cells.keys())

        for sheet_name in sheets_to_audit:
            sheet_cells = wb.cells.get(sheet_name, {})
            if not sheet_cells:
                continue

            # Group cells by row and by column
            row_map: Dict[int, List[Dict[str, Any]]] = {}
            col_map: Dict[int, List[Dict[str, Any]]] = {}

            for coord, cell in sheet_cells.items():
                r = cell["row"]
                c = cell["col"]
                row_map.setdefault(r, []).append(cell)
                col_map.setdefault(c, []).append(cell)

                # Check 1: Broken reference / error formulas (#REF!)
                formula = cell.get("formula")
                if formula:
                    if "#REF!" in formula:
                        anomalies.append(AnomalyItem(
                            sheet=sheet_name,
                            coordinate=coord,
                            row=r,
                            col=c,
                            severity="high",
                            anomaly_type="ref_error",
                            description="Formula contains broken reference (#REF!)",
                            formula=formula
                        ))
                    elif any(err in formula for err in ["#VALUE!", "#N/A", "#NAME?", "#DIV/0!"]):
                        anomalies.append(AnomalyItem(
                            sheet=sheet_name,
                            coordinate=coord,
                            row=r,
                            col=c,
                            severity="high",
                            anomaly_type="ref_error",
                            description="Formula contains error token",
                            formula=formula
                        ))

                    # Check 2: External references
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
                                description=f"External workbook link detected: {ref.get('workbook')}",
                                formula=formula,
                                affected_context=ref.get('raw')
                            ))
                            break

                    # Check 2b: Reference to hidden data
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

            # Check 3: Row-wise formula consistency & hardcoded values in series
            for r, cells_in_row in row_map.items():
                cells_in_row.sort(key=lambda x: x["col"])
                self._check_series_consistency(sheet_name, cells_in_row, "row", anomalies)

            # Check 4: Column-wise formula consistency & hardcoded values in series
            for c, cells_in_col in col_map.items():
                cells_in_col.sort(key=lambda x: x["row"])
                self._check_series_consistency(sheet_name, cells_in_col, "column", anomalies)

        # Remove duplicate anomalies for the same cell and type
        unique_anomalies: List[AnomalyItem] = []
        seen = set()
        for a in anomalies:
            key = (a.sheet, a.coordinate, a.anomaly_type)
            if key not in seen:
                seen.add(key)
                unique_anomalies.append(a)

        # Sort anomalies: high -> medium -> low
        severity_weight = {"high": 0, "medium": 1, "low": 2}
        unique_anomalies.sort(key=lambda x: (severity_weight.get(x.severity, 3), x.sheet, x.row, x.col))

        high_count = sum(1 for a in unique_anomalies if a.severity == "high")
        med_count = sum(1 for a in unique_anomalies if a.severity == "medium")
        low_count = sum(1 for a in unique_anomalies if a.severity == "low")

        return AuditAnomaliesResponse(
            workbook_id=workbook_id,
            sheet_name=sheet_filter,
            total_anomalies=len(unique_anomalies),
            high_severity_count=high_count,
            medium_severity_count=med_count,
            low_severity_count=low_count,
            anomalies=unique_anomalies[:250]
        )

    def _check_series_consistency(
        self,
        sheet_name: str,
        series: List[Dict[str, Any]],
        direction: str,
        anomalies: List[AnomalyItem]
    ):
        if len(series) < 3:
            return

        # Check Hardcoded values in formula series:
        # If cells before and after have formulas, but current has a numeric value without formula
        for i in range(1, len(series) - 1):
            prev_cell = series[i - 1]
            curr_cell = series[i]
            next_cell = series[i + 1]

            # Check consecutive column or row index
            idx_diff_1 = (curr_cell["col"] - prev_cell["col"]) if direction == "row" else (curr_cell["row"] - prev_cell["row"])
            idx_diff_2 = (next_cell["col"] - curr_cell["col"]) if direction == "row" else (next_cell["row"] - curr_cell["row"])

            if idx_diff_1 == 1 and idx_diff_2 == 1:
                if prev_cell.get("formula") and next_cell.get("formula") and not curr_cell.get("formula"):
                    val = curr_cell.get("value")
                    if isinstance(val, (int, float)):
                        anomalies.append(AnomalyItem(
                            sheet=sheet_name,
                            coordinate=curr_cell["coordinate"],
                            row=curr_cell["row"],
                            col=curr_cell["col"],
                            severity="high",
                            anomaly_type="hardcoded_in_series",
                            description=f"Hardcoded number ({val}) found within a continuous {direction} formula series",
                            affected_context=f"{direction.capitalize()} sequence around {curr_cell['coordinate']}"
                        ))

        # Check Formula Inconsistency:
        # Where >= 3 cells have formulas, but 1 cell has a different normalized pattern
        formula_cells = [c for c in series if c.get("formula") and c.get("normalized")]
        if len(formula_cells) >= 3:
            patterns = [c["normalized"] for c in formula_cells]
            counter = Counter(patterns)
            most_common_pattern, count = counter.most_common(1)[0]
            # If dominant pattern accounts for >= 75% of formula cells
            if count >= 2 and (count / len(formula_cells)) >= 0.70:
                for c in formula_cells:
                    if c["normalized"] != most_common_pattern:
                        anomalies.append(AnomalyItem(
                            sheet=sheet_name,
                            coordinate=c["coordinate"],
                            row=c["row"],
                            col=c["col"],
                            severity="medium",
                            anomaly_type="formula_inconsistency",
                            description=f"Formula pattern differs from surrounding {direction} formula pattern",
                            formula=c["formula"],
                            expected_pattern=most_common_pattern,
                            affected_context=f"{direction.capitalize()} pattern anomaly"
                        ))

formula_auditor = FormulaAuditor()
