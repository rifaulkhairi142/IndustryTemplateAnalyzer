from typing import Dict, Any, List, Set, Optional, Tuple
from collections import defaultdict
from backend.app.services.workbook_manager import workbook_manager, WorkbookEntry
from backend.app.services.formula_parser import (
    parse_cell_coordinate, format_cell_coordinate, index_to_col_letter,
    extract_references_from_formula
)
import time
from backend.app.models.schemas import (
    HiddenConsumerItem, HiddenCellItem, HiddenRowItem,
    HiddenColumnItem, HiddenSheetItem, HiddenSummary,
    TraceHiddenResponse
)
from backend.app.utils.logger import log_tracer

class HiddenDependencyTracer:
    def _ensure_dependents_index(self, wb_entry: WorkbookEntry):
        """Ensures that the inverted dependents index is built on wb_entry."""
        if not hasattr(wb_entry, '_dependents_index') or wb_entry._dependents_index is None:
            sheet_name_map = {s.upper(): s for s in wb_entry.cells.keys()}
            inv_index: Dict[str, List[Tuple[str, str, Dict[str, Any]]]] = {}
            for s_name, sheet_cells in wb_entry.cells.items():
                for co, info in sheet_cells.items():
                    f = info.get("formula")
                    if not f:
                        continue
                    f_refs = extract_references_from_formula(f, s_name)
                    for r in f_refs:
                        for c in r.get("cells", []):
                            c_strip = c.strip("'\"")
                            if "!" in c_strip:
                                ref_sh_raw, ref_co = c_strip.split("!", 1)
                                ref_sh = sheet_name_map.get(ref_sh_raw.upper(), ref_sh_raw)
                                c_key = f"{ref_sh}!{ref_co.upper()}"
                            else:
                                c_key = f"{s_name}!{c_strip.upper()}"
                            inv_index.setdefault(c_key, []).append((s_name, co, info))
            wb_entry._dependents_index = inv_index

    def trace_hidden_elements(
        self,
        workbook_id: str,
        sheet_filter: Optional[str] = None,
        only_in_use: bool = True
    ) -> TraceHiddenResponse:
        wb_entry = workbook_manager.get_workbook(workbook_id)
        if not wb_entry:
            raise ValueError(f"Workbook {workbook_id} not found")

        t0 = time.perf_counter()
        log_tracer(f"Tracing hidden elements: Workbook='{wb_entry.filename}' ({workbook_id}), SheetFilter={sheet_filter or 'All'}, OnlyInUse={only_in_use}")

        self._ensure_dependents_index(wb_entry)
        inv_index = wb_entry._dependents_index

        sheet_name_map = {s.upper(): s for s in wb_entry.cells.keys()}

        # Data stores
        hidden_cells_dict: Dict[str, HiddenCellItem] = {}
        hidden_rows_map: Dict[Tuple[str, int], Dict[str, Any]] = {}
        hidden_cols_map: Dict[Tuple[str, int], Dict[str, Any]] = {}
        hidden_sheets_map: Dict[str, Dict[str, Any]] = {}

        if sheet_filter:
            target_sheet_canonical = sheet_name_map.get(sheet_filter.upper(), sheet_filter)
            target_sheets = [target_sheet_canonical]
        else:
            target_sheets = list(wb_entry.cells.keys())

        total_hidden_rows_count = 0
        total_hidden_cols_count = 0
        total_hidden_sheets_count = 0

        for s_name in target_sheets:
            is_sh_hidden = s_name in wb_entry.hidden_sheets
            if is_sh_hidden:
                total_hidden_sheets_count += 1
                hidden_sheets_map[s_name] = {
                    "sheet": s_name,
                    "state": wb_entry.sheet_states.get(s_name, "hidden"),
                    "referenced_cells": set(),
                    "total_dependents": 0
                }

            h_rows = wb_entry.hidden_rows.get(s_name, set())
            total_hidden_rows_count += len(h_rows)
            for r in h_rows:
                hidden_rows_map[(s_name, r)] = {
                    "sheet": s_name,
                    "row": r,
                    "referenced_cells": set(),
                    "total_dependents": 0,
                    "has_visible_consumer": False
                }

            h_cols = wb_entry.hidden_cols.get(s_name, set())
            total_hidden_cols_count += len(h_cols)
            for c in h_cols:
                col_letter = index_to_col_letter(c)
                hidden_cols_map[(s_name, c)] = {
                    "sheet": s_name,
                    "col": c,
                    "col_letter": col_letter,
                    "referenced_cells": set(),
                    "total_dependents": 0,
                    "has_visible_consumer": False
                }

        # Scan inverted index for any target that is in target_sheets and is hidden
        for target_full, dependents_list in inv_index.items():
            if "!" not in target_full:
                continue
            t_sheet_raw, t_coord = target_full.split("!", 1)
            t_sheet_clean = t_sheet_raw.strip("'\"")
            t_sheet = sheet_name_map.get(t_sheet_clean.upper(), t_sheet_clean)

            if target_sheets and t_sheet not in target_sheets:
                continue

            try:
                r, c = parse_cell_coordinate(t_coord)
            except Exception:
                continue

            is_hidden, reasons = wb_entry.is_cell_hidden(t_sheet, r, c)
            if not is_hidden:
                continue

            cell_data = wb_entry.cells.get(t_sheet, {}).get(t_coord, {})
            val = cell_data.get("value")
            formula = cell_data.get("formula")

            consumer_items: List[HiddenConsumerItem] = []
            has_visible_consumer = False

            for dep_sheet, dep_coord, dep_info in dependents_list:
                try:
                    dep_r, dep_c = parse_cell_coordinate(dep_coord)
                    dep_is_hidden, _ = wb_entry.is_cell_hidden(dep_sheet, dep_r, dep_c)
                    is_consumer_vis = not dep_is_hidden
                except Exception:
                    is_consumer_vis = True

                if is_consumer_vis:
                    has_visible_consumer = True

                consumer_items.append(HiddenConsumerItem(
                    sheet=dep_sheet,
                    coordinate=dep_coord,
                    row=dep_info.get("row", 0),
                    col=dep_info.get("col", 0),
                    formula=dep_info.get("formula"),
                    value=dep_info.get("value"),
                    is_consumer_visible=is_consumer_vis
                ))

            col_letter = index_to_col_letter(c)
            cell_item = HiddenCellItem(
                sheet=t_sheet,
                coordinate=t_coord,
                row=r,
                col=c,
                col_letter=col_letter,
                hidden_reasons=reasons,
                formula=formula,
                value=val,
                dependents_count=len(consumer_items),
                has_visible_consumer=has_visible_consumer,
                dependents=consumer_items
            )
            hidden_cells_dict[target_full] = cell_item

            # Aggregate into Row map
            if (t_sheet, r) in hidden_rows_map:
                row_agg = hidden_rows_map[(t_sheet, r)]
                row_agg["referenced_cells"].add(t_coord)
                row_agg["total_dependents"] += len(consumer_items)
                if has_visible_consumer:
                    row_agg["has_visible_consumer"] = True

            # Aggregate into Col map
            if (t_sheet, c) in hidden_cols_map:
                col_agg = hidden_cols_map[(t_sheet, c)]
                col_agg["referenced_cells"].add(t_coord)
                col_agg["total_dependents"] += len(consumer_items)
                if has_visible_consumer:
                    col_agg["has_visible_consumer"] = True

            # Aggregate into Sheet map
            if t_sheet in hidden_sheets_map:
                sh_agg = hidden_sheets_map[t_sheet]
                sh_agg["referenced_cells"].add(t_coord)
                sh_agg["total_dependents"] += len(consumer_items)

        # Build list of rows
        hidden_rows_res: List[HiddenRowItem] = []
        for (sh, r), data in hidden_rows_map.items():
            ref_cells = sorted(list(data["referenced_cells"]))
            if only_in_use and not ref_cells:
                continue
            hidden_rows_res.append(HiddenRowItem(
                sheet=sh,
                row=r,
                referenced_cells_count=len(ref_cells),
                total_dependents_count=data["total_dependents"],
                cells_in_use=ref_cells,
                has_visible_consumer=data["has_visible_consumer"]
            ))
        hidden_rows_res.sort(key=lambda x: (not x.has_visible_consumer, -x.total_dependents_count, x.sheet, x.row))

        # Build list of columns
        hidden_cols_res: List[HiddenColumnItem] = []
        for (sh, c), data in hidden_cols_map.items():
            ref_cells = sorted(list(data["referenced_cells"]))
            if only_in_use and not ref_cells:
                continue
            hidden_cols_res.append(HiddenColumnItem(
                sheet=sh,
                col=c,
                col_letter=data["col_letter"],
                referenced_cells_count=len(ref_cells),
                total_dependents_count=data["total_dependents"],
                cells_in_use=ref_cells,
                has_visible_consumer=data["has_visible_consumer"]
            ))
        hidden_cols_res.sort(key=lambda x: (not x.has_visible_consumer, -x.total_dependents_count, x.sheet, x.col))

        # Build list of sheets
        hidden_sheets_res: List[HiddenSheetItem] = []
        for sh, data in hidden_sheets_map.items():
            ref_cells = sorted(list(data["referenced_cells"]))
            if only_in_use and not ref_cells:
                continue
            hidden_sheets_res.append(HiddenSheetItem(
                sheet=sh,
                state=data["state"],
                referenced_cells_count=len(ref_cells),
                total_dependents_count=data["total_dependents"],
                cells_in_use=ref_cells
            ))
        hidden_sheets_res.sort(key=lambda x: (-x.total_dependents_count, x.sheet))

        # Cells list
        hidden_cells_res = list(hidden_cells_dict.values())
        hidden_cells_res.sort(key=lambda x: (not x.has_visible_consumer, -x.dependents_count, x.sheet, x.row, x.col))

        # Calculate summary statistics
        hidden_rows_in_use = sum(1 for r in hidden_rows_res if r.referenced_cells_count > 0)
        hidden_cols_in_use = sum(1 for c in hidden_cols_res if c.referenced_cells_count > 0)
        hidden_sheets_in_use = sum(1 for s in hidden_sheets_res if s.referenced_cells_count > 0)
        critical_visible_consumers_count = sum(1 for cell in hidden_cells_res if cell.has_visible_consumer)

        summary = HiddenSummary(
            total_hidden_rows=total_hidden_rows_count,
            hidden_rows_in_use=hidden_rows_in_use,
            total_hidden_cols=total_hidden_cols_count,
            hidden_cols_in_use=hidden_cols_in_use,
            total_hidden_sheets=total_hidden_sheets_count,
            hidden_sheets_in_use=hidden_sheets_in_use,
            total_hidden_cells_in_use=len(hidden_cells_res),
            critical_visible_consumers_count=critical_visible_consumers_count
        )

        elapsed = (time.perf_counter() - t0) * 1000
        log_tracer(
            f"Hidden trace completed: {len(hidden_rows_res)} rows ({hidden_rows_in_use} in-use), "
            f"{len(hidden_cols_res)} cols ({hidden_cols_in_use} in-use), "
            f"{len(hidden_sheets_res)} sheets ({hidden_sheets_in_use} in-use), "
            f"{len(hidden_cells_res)} hidden cells with consumers in {elapsed:.1f}ms"
        )

        return TraceHiddenResponse(
            workbook_id=workbook_id,
            filter_sheet=sheet_filter,
            summary=summary,
            hidden_rows=hidden_rows_res,
            hidden_columns=hidden_cols_res,
            hidden_cells=hidden_cells_res,
            hidden_sheets=hidden_sheets_res
        )

hidden_dependency_tracer = HiddenDependencyTracer()
