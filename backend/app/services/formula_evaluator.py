import re
import math
from typing import Dict, Any, Tuple, List, Optional
from backend.app.services.formula_parser import (
    extract_references_from_formula, expand_range_string, CELL_REF_REGEX
)

def _format_number(val: Any, num_format: Optional[str] = None) -> str:
    """Format numeric value into standard readable string."""
    if val is None:
        return ""
    if isinstance(val, float):
        if val.is_integer():
            return f"{int(val):,}"
        return f"{val:,.2f}"
    if isinstance(val, int):
        return f"{val:,}"
    return str(val)

class FormulaEvaluator:
    def __init__(self):
        pass

    def evaluate_workbook_cells(self, raw_cells: Dict[str, Dict[str, Dict[str, Any]]]) -> Dict[str, Dict[str, Any]]:
        """
        Evaluates formulas across all sheets in the workbook.
        Returns a dict of (sheet_name, coord) -> computed_value.
        """
        # value_cache: (sheet, coord) -> computed value (float, int, str, None)
        value_cache: Dict[Tuple[str, str], Any] = {}
        formulas_to_eval: List[Tuple[str, str, str]] = [] # (sheet, coord, formula)

        # 1. Initialize constants / non-formula values
        for sheet_name, sheet_data in raw_cells.items():
            for coord, cell_info in sheet_data.items():
                formula = cell_info.get("formula")
                val = cell_info.get("value")
                clean_coord = coord.replace('$', '').upper()

                if formula and isinstance(formula, str) and formula.startswith("="):
                    formulas_to_eval.append((sheet_name, clean_coord, formula))
                    # If there was a cached value from Excel, store it
                    if val is not None and not (isinstance(val, str) and val.startswith("=")):
                        value_cache[(sheet_name, clean_coord)] = val
                else:
                    if val is not None:
                        value_cache[(sheet_name, clean_coord)] = val

        # 2. Iterative evaluation with dependency resolution (up to 25 passes)
        for _ in range(25):
            any_updated = False
            for sheet_name, coord, formula in formulas_to_eval:
                curr_val = value_cache.get((sheet_name, coord))
                # Evaluate formula
                computed = self._eval_single_formula(formula, sheet_name, value_cache)
                if computed is not None and computed != curr_val:
                    value_cache[(sheet_name, coord)] = computed
                    any_updated = True

            if not any_updated:
                break

        # Convert to nested dict {sheet_name: {coord: computed_value}}
        results: Dict[str, Dict[str, Any]] = {}
        for (sh, co), v in value_cache.items():
            results.setdefault(sh, {})[co] = v

        return results

    def _eval_single_formula(
        self,
        formula: str,
        current_sheet: str,
        value_cache: Dict[Tuple[str, str], Any]
    ) -> Optional[Any]:
        if not formula or not isinstance(formula, str):
            return None

        clean = formula.lstrip('=+@ ')

        # Handle range functions: SUM(A1:B3), AVERAGE(A1:B3), MIN(A1:B3), MAX(A1:B3)
        def replace_range_func(match: re.Match) -> str:
            func_name = match.group(1).upper()
            inner = match.group(2)
            
            # Extract arguments
            args = [a.strip() for a in inner.split(',') if a.strip()]
            nums = []
            for arg in args:
                if ':' in arg:
                    # It's a range like D4:G4 or Sheet!D4:G4
                    sh_prefix = current_sheet
                    range_part = arg
                    if '!' in arg:
                        sh_prefix, range_part = arg.split('!', 1)
                        sh_prefix = sh_prefix.strip("'\"")

                    coords = expand_range_string(range_part)
                    for c in coords:
                        v = value_cache.get((sh_prefix, c.replace('$', '').upper()), 0)
                        if isinstance(v, (int, float)):
                            nums.append(v)
                else:
                    # Single ref or number
                    if re.match(r'^-?\d+(?:\.\d+)?$', arg):
                        nums.append(float(arg))
                    else:
                        sh_prefix = current_sheet
                        co = arg
                        if '!' in arg:
                            sh_prefix, co = arg.split('!', 1)
                            sh_prefix = sh_prefix.strip("'\"")
                        v = value_cache.get((sh_prefix, co.replace('$', '').upper()), 0)
                        if isinstance(v, (int, float)):
                            nums.append(v)

            if func_name == "SUM":
                return str(sum(nums))
            elif func_name == "AVERAGE":
                return str(sum(nums) / len(nums)) if nums else "0"
            elif func_name == "MIN":
                return str(min(nums)) if nums else "0"
            elif func_name == "MAX":
                return str(max(nums)) if nums else "0"
            return match.group(0)

        # Replace SUM/AVERAGE/MIN/MAX with computed numbers
        func_pattern = re.compile(r'\b(SUM|AVERAGE|MIN|MAX)\s*\(([^()]+)\)', re.IGNORECASE)
        # Apply nested function replacement
        for _ in range(3):
            clean = func_pattern.sub(replace_range_func, clean)

        # Replace cell references: Sheet!A1 or A1 with numeric values
        def replace_cell_ref(match: re.Match) -> str:
            groups = match.groupdict()
            sh = groups.get('qsheet') or groups.get('usheet') or groups.get('sheet')
            c1 = groups.get('col1')
            r1 = groups.get('row1')
            c2 = groups.get('col2')
            r2 = groups.get('row2')

            if c2 and r2:
                # Unhandled raw range outside function
                return "0"

            target_sh = sh.strip("'\"") if sh else current_sheet
            target_coord = f"{c1.replace('$', '')}{r1.replace('$', '')}".upper()

            val = value_cache.get((target_sh, target_coord), 0)
            if val is None:
                return "0"
            if isinstance(val, (int, float)):
                return str(val)
            if isinstance(val, str) and re.match(r'^-?\d+(?:\.\d+)?$', val):
                return val
            # String or boolean
            return "0"

        # Substitute cell coordinates
        expr = CELL_REF_REGEX.sub(replace_cell_ref, clean)

        # Replace Excel operators with Python operators
        expr = expr.replace('^', '**')

        # Evaluate safely
        try:
            # Safe math evaluation namespace
            allowed_names = {
                "math": math,
                "abs": abs,
                "round": round,
                "min": min,
                "max": max,
            }
            res = eval(expr, {"__builtins__": {}}, allowed_names)
            if isinstance(res, (int, float)):
                # If very close to integer, return int or round to 2 decimals
                if isinstance(res, float) and abs(res - round(res)) < 1e-9:
                    return int(round(res))
                elif isinstance(res, float):
                    return round(res, 2)
                return res
            return res
        except Exception:
            return None

formula_evaluator = FormulaEvaluator()
