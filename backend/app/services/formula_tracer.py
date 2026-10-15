import time
from datetime import datetime
from typing import Dict, Any, List, Set, Optional, Tuple
import networkx as nx
from backend.app.services.workbook_manager import workbook_manager
from backend.app.services.formula_parser import (
    extract_references_from_formula, parse_cell_coordinate, expand_range_string
)
from backend.app.models.schemas import (
    DependencyNode, DependencyEdge, TraceFormulaResponse
)
from backend.app.utils.logger import log_tracer

class FormulaTracer:
    def __init__(self):
        pass

    def _get_cell_data(self, wb_entry, sheet_name: str, coord: str) -> Dict[str, Any]:
        """Fetch cell data from cached workbook or create blank node if non-existent."""
        clean_coord = coord.replace('$', '').upper()
        if sheet_name in wb_entry.cells and clean_coord in wb_entry.cells[sheet_name]:
            c = wb_entry.cells[sheet_name][clean_coord]
            return {
                "coordinate": clean_coord,
                "row": c["row"],
                "col": c["col"],
                "formula": c["formula"],
                "value": c["value"]
            }
        else:
            try:
                r, col = parse_cell_coordinate(clean_coord)
            except Exception:
                r, col = 0, 0
            return {
                "coordinate": clean_coord,
                "row": r,
                "col": col,
                "formula": None,
                "value": None
            }

    def trace_formula(
        self,
        workbook_id: str,
        sheet_name: str,
        cell_coord: str,
        direction: str = "precedents",
        max_depth: int = 15
    ) -> TraceFormulaResponse:
        wb_entry = workbook_manager.get_workbook(workbook_id)
        if not wb_entry:
            raise ValueError(f"Workbook {workbook_id} not found")

        clean_coord = cell_coord.replace('$', '').upper()
        expanded_coords = expand_range_string(clean_coord)

        if len(expanded_coords) <= 1:
            return self._trace_single(wb_entry, sheet_name, clean_coord, direction, max_depth)
        else:
            return self._trace_range(wb_entry, sheet_name, clean_coord, expanded_coords, direction, max_depth)

    def _trace_single(
        self,
        wb_entry,
        sheet_name: str,
        clean_coord: str,
        direction: str,
        max_depth: int
    ) -> TraceFormulaResponse:
        start_time = time.time()
        logs: List[str] = []

        def log_event(msg: str):
            t_str = datetime.now().strftime("%H:%M:%S")
            logs.append(f"[{t_str}] {msg}")
            log_tracer(msg)

        root_id = f"{sheet_name}!{clean_coord}"
        root_cell = self._get_cell_data(wb_entry, sheet_name, clean_coord)
        formula = root_cell.get("formula")

        log_event(f"Memulai tracing {direction.upper()} untuk {sheet_name}!{clean_coord} (Batas kedalaman: {max_depth})")
        if formula:
            log_event(f"Formula target: {formula} | Nilai terhitung: {root_cell.get('value')}")
        else:
            log_event(f"Sel target tidak memiliki formula (Konstanta input langsung, nilai: {root_cell.get('value')})")

        G = nx.DiGraph()
        nodes_dict: Dict[str, DependencyNode] = {}
        edges_list: List[DependencyEdge] = []
        circular_paths: List[List[str]] = []
        has_circular = False
        max_depth_reached = 0
        can_expand_further = False

        # Create root node
        root_node = DependencyNode(
            id=root_id,
            sheet=sheet_name,
            coordinate=clean_coord,
            row=root_cell["row"],
            col=root_cell["col"],
            formula=root_cell["formula"],
            value=root_cell["value"],
            node_type="target",
            depth=0
        )
        nodes_dict[root_id] = root_node
        G.add_node(root_id, **root_node.model_dump())

        terminal_sources: List[DependencyNode] = []

        if direction in ("precedents", "both"):
            visited_in_dfs: Set[str] = set()

            def dfs_precedents(current_sheet: str, current_coord: str, depth: int, path: List[str]) -> Dict[str, Any]:
                nonlocal max_depth_reached, has_circular, can_expand_further
                max_depth_reached = max(max_depth_reached, depth)
                curr_id = f"{current_sheet}!{current_coord}"
                c_data = self._get_cell_data(wb_entry, current_sheet, current_coord)
                curr_formula = c_data["formula"]
                curr_val = c_data["value"]

                if depth == 0:
                    log_event(f"[Target] Memulai tracing PRECEDENTS untuk sel: {curr_id}" + (f" (Formula: {curr_formula})" if curr_formula else f" (Nilai: {curr_val})"))
                else:
                    if curr_formula:
                        log_event(f"[Level {depth}] [Memproses Sel] {curr_id} -> Formula: {curr_formula}")
                    else:
                        log_event(f"[Level {depth}] [Memproses Sel] {curr_id} -> Input Konstan (Nilai: {curr_val})")

                tree_node = {
                    "id": curr_id,
                    "sheet": current_sheet,
                    "coordinate": current_coord,
                    "formula": curr_formula,
                    "value": curr_val,
                    "depth": depth,
                    "children": []
                }

                if depth >= max_depth:
                    if curr_formula:
                        can_expand_further = True
                    log_event(f"   -> Batas kedalaman maksimal tercapai (level {depth}) pada {curr_id}")
                    return tree_node

                if not curr_formula:
                    if curr_id != root_id and curr_id not in [t.id for t in terminal_sources]:
                        term_node = DependencyNode(
                            id=curr_id,
                            sheet=current_sheet,
                            coordinate=current_coord,
                            row=c_data["row"],
                            col=c_data["col"],
                            formula=None,
                            value=curr_val,
                            node_type="terminal",
                            depth=depth
                        )
                        terminal_sources.append(term_node)
                        nodes_dict[curr_id] = term_node
                        log_event(f"   -> [Akar Input] {curr_id} adalah konstanta input terminal (Nilai: {curr_val})")
                    return tree_node

                visited_in_dfs.add(curr_id)

                refs = extract_references_from_formula(curr_formula, current_sheet)
                all_target_cells = []
                for ref in refs:
                    for target_cell_ref in ref.get("cells", []):
                        if "!" in target_cell_ref:
                            p_sheet, p_coord = target_cell_ref.split("!", 1)
                            p_sheet = p_sheet.strip("'\"")
                        else:
                            p_sheet = current_sheet
                            p_coord = target_cell_ref
                        p_coord = p_coord.replace('$', '').upper()
                        all_target_cells.append((p_sheet, p_coord, f"{p_sheet}!{p_coord}"))

                if all_target_cells:
                    preview_list = [t[2] for t in all_target_cells]
                    preview_str = ", ".join(preview_list[:4]) + (f" dan {len(preview_list) - 4} sel lainnya" if len(preview_list) > 4 else "")
                    log_event(f"   -> {curr_id} merujuk ke {len(all_target_cells)} sel precedent: [{preview_str}]")

                for p_sheet, p_coord, p_id in all_target_cells:
                    edge_obj = DependencyEdge(source=p_id, target=curr_id, edge_type="direct" if depth == 0 else "transitive")
                    edges_list.append(edge_obj)
                    G.add_edge(p_id, curr_id)

                    if p_id in path:
                        has_circular = True
                        cycle = path[path.index(p_id):] + [p_id]
                        circular_paths.append(cycle)
                        log_event(f"   -> [Peringatan] Referensi melingkar (circular) terdeteksi: {' -> '.join(cycle)}")
                        circ_node = DependencyNode(
                            id=p_id,
                            sheet=p_sheet,
                            coordinate=p_coord,
                            row=0,
                            col=0,
                            formula=None,
                            value=None,
                            node_type="circular",
                            depth=depth + 1
                        )
                        nodes_dict[p_id] = circ_node
                        tree_node["children"].append({
                            "id": p_id,
                            "sheet": p_sheet,
                            "coordinate": p_coord,
                            "is_circular": True,
                            "children": []
                        })
                        continue

                    if p_id not in nodes_dict:
                        p_data = self._get_cell_data(wb_entry, p_sheet, p_coord)
                        p_node = DependencyNode(
                            id=p_id,
                            sheet=p_sheet,
                            coordinate=p_coord,
                            row=p_data["row"],
                            col=p_data["col"],
                            formula=p_data["formula"],
                            value=p_data["value"],
                            node_type="precedent",
                            depth=depth + 1
                        )
                        nodes_dict[p_id] = p_node

                    if p_id in visited_in_dfs:
                        # Node already explored in previous path, link without duplicating recursion
                        p_data = self._get_cell_data(wb_entry, p_sheet, p_coord)
                        tree_node["children"].append({
                            "id": p_id,
                            "sheet": p_sheet,
                            "coordinate": p_coord,
                            "formula": p_data["formula"],
                            "value": p_data["value"],
                            "depth": depth + 1,
                            "children": []
                        })
                    else:
                        child_tree = dfs_precedents(p_sheet, p_coord, depth + 1, path + [curr_id])
                        tree_node["children"].append(child_tree)

                return tree_node

            root_tree = dfs_precedents(sheet_name, clean_coord, 0, [root_id])

        else:
            # Dependents with fast inverted index
            visited_in_dfs: Set[str] = set()

            root_tree = {
                "id": root_id,
                "sheet": sheet_name,
                "coordinate": clean_coord,
                "formula": formula,
                "value": root_cell["value"],
                "depth": 0,
                "children": []
            }

            # Build or use cached inverted dependents index on wb_entry
            if not hasattr(wb_entry, '_dependents_index') or wb_entry._dependents_index is None:
                log_event("Membangun indeks relasi formula workbook untuk dependents...")
                inv_index: Dict[str, List[Tuple[str, str, Dict[str, Any]]]] = {}
                for s_name, sheet_cells in wb_entry.cells.items():
                    for co, info in sheet_cells.items():
                        f = info.get("formula")
                        if not f:
                            continue
                        f_refs = extract_references_from_formula(f, s_name)
                        for r in f_refs:
                            for c in r.get("cells", []):
                                c_clean = c.strip("'\"").upper()
                                if "!" not in c_clean:
                                    c_clean = f"{s_name}!{c_clean}"
                                inv_index.setdefault(c_clean, []).append((s_name, co, info))
                wb_entry._dependents_index = inv_index
                log_event(f"Indeks dependensi siap: {len(inv_index)} koordinat sel terpetakan.")

            def find_direct_dependents(target_sh: str, target_co: str) -> List[Tuple[str, str, Dict[str, Any]]]:
                target_full = f"{target_sh}!{target_co}".upper()
                return wb_entry._dependents_index.get(target_full, [])

            def dfs_dependents(current_sheet: str, current_coord: str, depth: int, path: List[str]) -> Dict[str, Any]:
                nonlocal max_depth_reached, has_circular, can_expand_further
                max_depth_reached = max(max_depth_reached, depth)
                curr_id = f"{current_sheet}!{current_coord}"
                c_data = self._get_cell_data(wb_entry, current_sheet, current_coord)
                curr_formula = c_data["formula"]
                curr_val = c_data["value"]

                if depth == 0:
                    log_event(f"[Target] Memulai tracing DEPENDENTS untuk sel: {curr_id}" + (f" (Formula: {curr_formula})" if curr_formula else f" (Nilai: {curr_val})"))
                else:
                    log_event(f"[Level {depth}] [Memproses Sel Dependen] {curr_id} -> Formula: {curr_formula}")

                tree_node = {
                    "id": curr_id,
                    "sheet": current_sheet,
                    "coordinate": current_coord,
                    "formula": curr_formula,
                    "value": curr_val,
                    "depth": depth,
                    "children": []
                }

                if depth >= max_depth:
                    if find_direct_dependents(current_sheet, current_coord):
                        can_expand_further = True
                    log_event(f"   -> Batas kedalaman maksimal tercapai (level {depth}) pada {curr_id}")
                    return tree_node

                visited_in_dfs.add(curr_id)

                deps = find_direct_dependents(current_sheet, current_coord)
                if deps:
                    dep_names = [f"{d_s}!{d_c}" for d_s, d_c, _ in deps]
                    preview_str = ", ".join(dep_names[:4]) + (f" dan {len(dep_names) - 4} formula lainnya" if len(dep_names) > 4 else "")
                    log_event(f"   -> Ditemukan {len(deps)} formula yang bergantung pada {curr_id}: [{preview_str}]")
                else:
                    if depth > 0:
                        log_event(f"   -> {curr_id} tidak memiliki dependen lebih lanjut (ujung rantai)")

                for dep_sheet, dep_coord, dep_info in deps:
                    dep_id = f"{dep_sheet}!{dep_coord}"
                    edge_obj = DependencyEdge(source=curr_id, target=dep_id, edge_type="direct" if depth == 0 else "transitive")
                    edges_list.append(edge_obj)
                    G.add_edge(curr_id, dep_id)

                    if dep_id in path:
                        has_circular = True
                        cycle = path[path.index(dep_id):] + [dep_id]
                        circular_paths.append(cycle)
                        log_event(f"   -> [Peringatan] Siklus melingkar terdeteksi: {' -> '.join(cycle)}")
                        continue

                    if dep_id not in nodes_dict:
                        dep_node = DependencyNode(
                            id=dep_id,
                            sheet=dep_sheet,
                            coordinate=dep_coord,
                            row=dep_info["row"],
                            col=dep_info["col"],
                            formula=dep_info["formula"],
                            value=dep_info["value"],
                            node_type="dependent",
                            depth=depth + 1
                        )
                        nodes_dict[dep_id] = dep_node

                    if dep_id in visited_in_dfs:
                        # Node already explored in previous path, link without duplicating recursion
                        tree_node["children"].append({
                            "id": dep_id,
                            "sheet": dep_sheet,
                            "coordinate": dep_coord,
                            "formula": dep_info["formula"],
                            "value": dep_info["value"],
                            "depth": depth + 1,
                            "children": []
                        })
                    else:
                        child_tree = dfs_dependents(dep_sheet, dep_coord, depth + 1, path + [curr_id])
                        tree_node["children"].append(child_tree)

                return tree_node

            root_tree = dfs_dependents(sheet_name, clean_coord, 0, [root_id])

        elapsed_sec = round(time.time() - start_time, 3)
        log_event(
            f"[SELESAI] Tracing {direction.upper()} selesai dalam {elapsed_sec}s. "
            f"Total {len(nodes_dict)} sel diproses, {len(edges_list)} relasi, "
            f"kedalaman maksimal {max_depth_reached}, {len(terminal_sources)} input konstan."
        )

        return TraceFormulaResponse(
            target_cell=clean_coord,
            target_sheet=sheet_name,
            formula=formula,
            direction=direction,
            nodes=list(nodes_dict.values()),
            edges=edges_list,
            terminal_sources=terminal_sources,
            has_circular_reference=has_circular,
            circular_paths=circular_paths,
            max_depth_reached=max_depth_reached,
            max_depth_configured=max_depth,
            can_expand_further=can_expand_further,
            tree=root_tree,
            execution_logs=logs,
            elapsed_seconds=elapsed_sec
        )

    def _trace_range(
        self,
        wb_entry,
        sheet_name: str,
        range_coord: str,
        expanded_coords: List[str],
        direction: str,
        max_depth: int
    ) -> TraceFormulaResponse:
        """Trace combined dependencies for all formula cells within a selected range."""
        start_time = time.time()
        logs: List[str] = []

        def log_event(msg: str):
            t_str = datetime.now().strftime("%H:%M:%S")
            logs.append(f"[{t_str}] {msg}")
            log_tracer(msg)

        formula_coords = []
        for c in expanded_coords:
            if sheet_name in wb_entry.cells and c in wb_entry.cells[sheet_name]:
                if wb_entry.cells[sheet_name][c]["formula"]:
                    formula_coords.append(c)

        # If no formulas found in range, trace all coordinates in range (constants)
        targets_to_trace = formula_coords if formula_coords else expanded_coords

        log_event(f"Memulai tracing range {direction.upper()} untuk {sheet_name}!{range_coord} (Total target: {len(targets_to_trace)} sel)")

        combined_nodes: Dict[str, DependencyNode] = {}
        combined_edges: List[DependencyEdge] = []
        combined_terminals: Dict[str, DependencyNode] = {}
        circular_paths: List[List[str]] = []
        has_circular = False
        max_depth_reached = 0

        range_tree_children = []

        for idx, coord in enumerate(targets_to_trace):
            sub_trace = self._trace_single(wb_entry, sheet_name, coord, direction, max_depth)
            range_tree_children.append(sub_trace.tree)
            max_depth_reached = max(max_depth_reached, sub_trace.max_depth_reached)
            if sub_trace.has_circular_reference:
                has_circular = True
                circular_paths.extend(sub_trace.circular_paths)

            # Append individual cell logs
            for sl in sub_trace.execution_logs:
                logs.append(sl)

            for n in sub_trace.nodes:
                combined_nodes[n.id] = n
            for e in sub_trace.edges:
                combined_edges.append(e)
            for t in sub_trace.terminal_sources:
                combined_terminals[t.id] = t

        # Dedup edges
        unique_edges = []
        seen_edges = set()
        for e in combined_edges:
            key = (e.source, e.target)
            if key not in seen_edges:
                seen_edges.add(key)
            unique_edges.append(e)

        range_tree = {
            "id": f"{sheet_name}!{range_coord}",
            "sheet": sheet_name,
            "coordinate": range_coord,
            "formula": f"Selected Range {range_coord} ({len(expanded_coords)} cells, {len(formula_coords)} formulas)",
            "value": None,
            "depth": 0,
            "children": range_tree_children
        }

        elapsed_sec = round(time.time() - start_time, 3)
        log_event(
            f"[SELESAI] Tracing range {range_coord} selesai dalam {elapsed_sec}s. "
            f"Total {len(combined_nodes)} sel diproses, {len(unique_edges)} relasi, "
            f"{len(combined_terminals)} input konstan."
        )

        return TraceFormulaResponse(
            target_cell=range_coord,
            target_sheet=sheet_name,
            formula=f"Range {range_coord} ({len(formula_coords)} formulas)",
            direction=direction,
            nodes=list(combined_nodes.values()),
            edges=unique_edges,
            terminal_sources=list(combined_terminals.values()),
            has_circular_reference=has_circular,
            circular_paths=circular_paths,
            max_depth_reached=max_depth_reached,
            max_depth_configured=max_depth,
            can_expand_further=False,
            tree=range_tree,
            execution_logs=logs,
            elapsed_seconds=elapsed_sec
        )

    def analyze_range(
        self,
        workbook_id: str,
        sheet_name: str,
        range_str: str
    ) -> Dict[str, Any]:
        wb_entry = workbook_manager.get_workbook(workbook_id)
        if not wb_entry:
            raise ValueError(f"Workbook {workbook_id} not found")

        clean_range = range_str.replace('$', '').strip().upper()
        expanded_coords = expand_range_string(clean_range)

        sheet_cells = wb_entry.cells.get(sheet_name, {})

        cells_result = []
        cross_sheet_count = 0
        local_formula_count = 0
        hardcoded_count = 0
        empty_count = 0

        for coord in expanded_coords:
            c_data = sheet_cells.get(coord)
            if not c_data:
                try:
                    r, c = parse_cell_coordinate(coord)
                except Exception:
                    r, c = 0, 0
                formula = None
                val = None
            else:
                r = c_data["row"]
                c = c_data["col"]
                formula = c_data.get("formula")
                val = c_data.get("value")

            cross_sheet_refs = []
            local_refs = []
            category = "empty"
            summary = "Empty cell"

            if formula:
                refs = extract_references_from_formula(formula, sheet_name)
                for ref in refs:
                    target_sh = ref.get("sheet")
                    for cell_ref in ref.get("cells", []):
                        if target_sh and target_sh != sheet_name:
                            cross_sheet_refs.append(cell_ref)
                        else:
                            local_coord = cell_ref.split('!')[-1] if '!' in cell_ref else cell_ref
                            local_refs.append(local_coord)

                cross_sheet_refs = list(dict.fromkeys(cross_sheet_refs))
                local_refs = list(dict.fromkeys(local_refs))

                if len(cross_sheet_refs) > 0:
                    category = "cross_sheet"
                    cross_sheet_count += 1
                    summary = f"Cross-sheet precedent to: {', '.join(cross_sheet_refs[:3])}"
                elif len(local_refs) > 0:
                    category = "local_formula"
                    local_formula_count += 1
                    summary = f"Precedents to local cells: {', '.join(local_refs[:3])}"
                else:
                    category = "local_formula"
                    local_formula_count += 1
                    summary = "Formula with constants"
            elif val is not None and str(val).strip() != "":
                category = "hardcoded"
                hardcoded_count += 1
                summary = f"Hardcoded constant: {val}"
            else:
                category = "empty"
                empty_count += 1
                summary = "Empty cell"

            cells_result.append({
                "coordinate": coord,
                "row": r,
                "col": c,
                "category": category,
                "formula": formula,
                "value": val,
                "cross_sheet_refs": cross_sheet_refs,
                "local_refs": local_refs,
                "summary": summary
            })

        return {
            "workbook_id": workbook_id,
            "sheet_name": sheet_name,
            "range": clean_range,
            "total_cells": len(expanded_coords),
            "summary": {
                "cross_sheet_count": cross_sheet_count,
                "local_formula_count": local_formula_count,
                "hardcoded_count": hardcoded_count,
                "empty_count": empty_count,
                "total_cells": len(expanded_coords)
            },
            "cells": cells_result
        }

formula_tracer = FormulaTracer()
