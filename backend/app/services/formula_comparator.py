from typing import Dict, Any, List, Set, Optional, Tuple
from backend.app.services.workbook_manager import workbook_manager
from backend.app.services.formula_parser import parse_cell_coordinate, format_cell_coordinate, parse_range_bounds
from backend.app.models.schemas import (
    CompareSheetsResponse, CellDiff
)

class FormulaComparator:
    def compare_sheets(
        self,
        baseline_wb_id: str,
        baseline_sheet: str,
        target_wb_id: str,
        target_sheet: str,
        baseline_range: Optional[str] = None,
        target_range: Optional[str] = None,
        cell_range: Optional[str] = None,
        mode: str = "exact_formula", # exact_formula | normalized_formula | values_only
        alignment: str = "coordinate"
    ) -> CompareSheetsResponse:
        base_wb = workbook_manager.get_workbook(baseline_wb_id)
        target_wb = workbook_manager.get_workbook(target_wb_id)

        if not base_wb:
            raise ValueError(f"Baseline workbook {baseline_wb_id} not found")
        if not target_wb:
            raise ValueError(f"Target workbook {target_wb_id} not found")

        base_cells = base_wb.cells.get(baseline_sheet, {})
        target_cells = target_wb.cells.get(target_sheet, {})

        # Resolve effective ranges (cell_range acts as fallback)
        eff_base_range = baseline_range if baseline_range is not None else cell_range
        eff_target_range = target_range if target_range is not None else cell_range

        base_bounds, norm_base_range = parse_range_bounds(eff_base_range)
        target_bounds, norm_target_range = parse_range_bounds(eff_target_range)

        # Build list of cell pairs to compare:
        # (display_coord, coord_b, coord_t, cell_b, cell_t, sort_row, sort_col)
        pairs_to_compare: List[Tuple[str, Optional[str], Optional[str], Optional[Dict[str, Any]], Optional[Dict[str, Any]], int, int]] = []

        if base_bounds and target_bounds:
            # Both ranges specified: compare cell-by-cell (supports shifted/offset ranges)
            min_rb, max_rb, min_cb, max_cb = base_bounds
            min_rt, max_rt, min_ct, max_ct = target_bounds

            all_offsets: Set[Tuple[int, int]] = set()
            for b in base_cells.values():
                if min_rb <= b["row"] <= max_rb and min_cb <= b["col"] <= max_cb:
                    all_offsets.add((b["row"] - min_rb, b["col"] - min_cb))
            for t in target_cells.values():
                if min_rt <= t["row"] <= max_rt and min_ct <= t["col"] <= max_ct:
                    all_offsets.add((t["row"] - min_rt, t["col"] - min_ct))

            for dr, dc in sorted(all_offsets):
                rb, cb = min_rb + dr, min_cb + dc
                rt, ct = min_rt + dr, min_ct + dc
                in_base_range = (rb <= max_rb and cb <= max_cb)
                in_target_range = (rt <= max_rt and ct <= max_ct)

                coord_b = format_cell_coordinate(rb, cb) if in_base_range else None
                coord_t = format_cell_coordinate(rt, ct) if in_target_range else None

                b = base_cells.get(coord_b) if coord_b else None
                t = target_cells.get(coord_t) if coord_t else None

                if coord_b and coord_t and coord_b == coord_t:
                    disp_coord = coord_b
                elif coord_b and coord_t:
                    disp_coord = f"{coord_b} ↔ {coord_t}"
                else:
                    disp_coord = coord_b or coord_t or ""

                pairs_to_compare.append((disp_coord, coord_b, coord_t, b, t, rb if in_base_range else rt, cb if in_base_range else ct))

        elif base_bounds and not target_bounds:
            # Baseline restricted to range, target whole sheet
            min_rb, max_rb, min_cb, max_cb = base_bounds
            base_coords = {
                coord for coord, b in base_cells.items()
                if min_rb <= b["row"] <= max_rb and min_cb <= b["col"] <= max_cb
            }
            target_coords = set(target_cells.keys())
            all_coords = base_coords.union(target_coords)
            for coord in all_coords:
                b = base_cells.get(coord) if coord in base_coords else None
                t = target_cells.get(coord)
                r = b["row"] if b else t["row"]
                c = b["col"] if b else t["col"]
                pairs_to_compare.append((coord, coord if b else None, coord if t else None, b, t, r, c))

        elif not base_bounds and target_bounds:
            # Target restricted to range, baseline whole sheet
            min_rt, max_rt, min_ct, max_ct = target_bounds
            target_coords = {
                coord for coord, t in target_cells.items()
                if min_rt <= t["row"] <= max_rt and min_ct <= t["col"] <= max_ct
            }
            base_coords = set(base_cells.keys())
            all_coords = base_coords.union(target_coords)
            for coord in all_coords:
                b = base_cells.get(coord)
                t = target_cells.get(coord) if coord in target_coords else None
                r = b["row"] if b else t["row"]
                c = b["col"] if b else t["col"]
                pairs_to_compare.append((coord, coord if b else None, coord if t else None, b, t, r, c))

        else:
            # Both null / entire sheet
            all_coords = set(base_cells.keys()).union(set(target_cells.keys()))
            for coord in all_coords:
                b = base_cells.get(coord)
                t = target_cells.get(coord)
                r = b["row"] if b else t["row"]
                c = b["col"] if b else t["col"]
                pairs_to_compare.append((coord, coord if b else None, coord if t else None, b, t, r, c))

        diffs: List[CellDiff] = []
        added_count = 0
        removed_count = 0
        formula_changed_count = 0
        value_changed_count = 0
        identical_count = 0

        for disp_coord, coord_b, coord_t, b, t, r, c in pairs_to_compare:
            if b is not None and t is None:
                removed_count += 1
                diffs.append(CellDiff(
                    coordinate=disp_coord,
                    row=r,
                    col=c,
                    baseline_coordinate=coord_b,
                    target_coordinate=coord_t,
                    diff_type="removed",
                    baseline_formula=b["formula"],
                    target_formula=None,
                    baseline_value=b["value"],
                    target_value=None
                ))
            elif b is None and t is not None:
                added_count += 1
                diffs.append(CellDiff(
                    coordinate=disp_coord,
                    row=r,
                    col=c,
                    baseline_coordinate=coord_b,
                    target_coordinate=coord_t,
                    diff_type="added",
                    baseline_formula=None,
                    target_formula=t["formula"],
                    baseline_value=None,
                    target_value=t["value"]
                ))
            elif b is not None and t is not None:
                b_f = b.get("formula")
                t_f = t.get("formula")
                b_v = b.get("value")
                t_v = t.get("value")
                b_norm = b.get("normalized")
                t_norm = t.get("normalized")

                formula_differs = False
                normalized_differ = (b_norm != t_norm) if (b_norm or t_norm) else False

                if mode == "normalized_formula":
                    formula_differs = normalized_differ
                elif mode == "exact_formula":
                    formula_differs = (b_f != t_f)
                else: # values_only
                    formula_differs = False

                value_differs = (str(b_v) != str(t_v))

                if formula_differs:
                    formula_changed_count += 1
                    diffs.append(CellDiff(
                        coordinate=disp_coord,
                        row=r,
                        col=c,
                        baseline_coordinate=coord_b,
                        target_coordinate=coord_t,
                        diff_type="formula_changed",
                        baseline_formula=b_f,
                        target_formula=t_f,
                        baseline_value=b_v,
                        target_value=t_v,
                        normalized_diff=normalized_differ
                    ))
                elif value_differs and mode == "values_only":
                    value_changed_count += 1
                    diffs.append(CellDiff(
                        coordinate=disp_coord,
                        row=r,
                        col=c,
                        baseline_coordinate=coord_b,
                        target_coordinate=coord_t,
                        diff_type="value_changed",
                        baseline_formula=b_f,
                        target_formula=t_f,
                        baseline_value=b_v,
                        target_value=t_v
                    ))
                elif value_differs and not b_f and not t_f:
                    # Constants differ
                    value_changed_count += 1
                    diffs.append(CellDiff(
                        coordinate=disp_coord,
                        row=r,
                        col=c,
                        baseline_coordinate=coord_b,
                        target_coordinate=coord_t,
                        diff_type="value_changed",
                        baseline_formula=b_f,
                        target_formula=t_f,
                        baseline_value=b_v,
                        target_value=t_v
                    ))
                else:
                    identical_count += 1

        # Sort diffs by row, col
        diffs.sort(key=lambda x: (x.row, x.col))

        # Backward compatibility summary
        if norm_base_range == norm_target_range:
            summary_range = norm_base_range
        elif norm_base_range and norm_target_range:
            summary_range = f"{norm_base_range} ↔ {norm_target_range}"
        else:
            summary_range = f"Base: {norm_base_range or 'All'} | Tgt: {norm_target_range or 'All'}"

        return CompareSheetsResponse(
            baseline_workbook_id=baseline_wb_id,
            baseline_sheet_name=baseline_sheet,
            target_workbook_id=target_wb_id,
            target_sheet_name=target_sheet,
            baseline_range=norm_base_range,
            target_range=norm_target_range,
            cell_range=summary_range,
            mode=mode,
            diff_count=len(diffs),
            added_count=added_count,
            removed_count=removed_count,
            formula_changed_count=formula_changed_count,
            value_changed_count=value_changed_count,
            identical_count=identical_count,
            diffs=diffs
        )

formula_comparator = FormulaComparator()
