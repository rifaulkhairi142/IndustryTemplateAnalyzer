import re
from typing import List, Tuple, Dict, Set, Any, Optional
import openpyxl.utils

# Regex for Excel cell references
# Matches patterns like:
# 'Sheet Name'!A1, Sheet1!A1, [File.xlsx]Sheet!A1, A1:B10, $A$1, A1
CELL_REF_REGEX = re.compile(
    r"""
    (?:
        (?:\[(?P<workbook>[^\]]+)\])?
        (?:
            '(?P<qsheet>[^']+)'
            |
            (?P<usheet>[A-Za-z0-9_]+)
        )!
    )?
    (?P<col1>\$?[A-Za-z]{1,3})
    (?P<row1>\$?\d{1,7})
    (?:
        :(?P<col2>\$?[A-Za-z]{1,3})
        (?P<row2>\$?\d{1,7})
    )?
    """,
    re.VERBOSE
)

def get_sheet_from_groups(groups: Dict[str, Any]) -> Optional[str]:
    return groups.get('qsheet') or groups.get('usheet') or groups.get('sheet')

FUNCTION_REGEX = re.compile(r'\b([A-Za-z_][A-Za-z0-9_\.]*)\s*\(')

def col_letter_to_index(col_str: str) -> int:
    """Convert column letter (e.g., 'A', '$A') to 1-based index."""
    clean = col_str.replace('$', '').upper()
    return openpyxl.utils.column_index_from_string(clean)

def index_to_col_letter(col_idx: int) -> str:
    """Convert 1-based index to column letter."""
    return openpyxl.utils.get_column_letter(col_idx)

def parse_cell_coordinate(coord: str) -> Tuple[int, int]:
    """Parse coordinate like 'C10' or '$C$10' to (row, col) (1-based)."""
    clean = coord.replace('$', '').upper()
    row, col = openpyxl.utils.coordinate_to_tuple(clean)
    return row, col

def format_cell_coordinate(row: int, col: int) -> str:
    """Convert 1-based (row, col) to coordinate string like 'C10'."""
    return f"{index_to_col_letter(col)}{row}"

def expand_range(sheet_prefix: str, col1: str, row1: str, col2: str, row2: str) -> List[str]:
    """Expands a range like A1:B3 into individual cell coordinates."""
    c1 = col_letter_to_index(col1)
    r1 = int(row1.replace('$', ''))
    c2 = col_letter_to_index(col2)
    r2 = int(row2.replace('$', ''))

    start_c, end_c = min(c1, c2), max(c1, c2)
    start_r, end_r = min(r1, r2), max(r1, r2)

    # Cap range expansion to prevent memory explosion if entire column is referenced (e.g. A:A)
    max_cells = 500
    expanded = []
    count = 0
    for r in range(start_r, end_r + 1):
        for c in range(start_c, end_c + 1):
            coord = format_cell_coordinate(r, c)
            full_ref = f"{sheet_prefix}{coord}" if sheet_prefix else coord
            expanded.append(full_ref)
            count += 1
            if count >= max_cells:
                return expanded
    return expanded

def expand_range_string(coord_or_range: str) -> List[str]:
    """Expands 'A1:B3' to ['A1', 'A2', 'A3', 'B1', ...], or 'C10' to ['C10']."""
    clean = coord_or_range.replace('$', '').strip().upper()
    if ':' in clean:
        parts = clean.split(':')
        if len(parts) == 2:
            try:
                r1, c1 = parse_cell_coordinate(parts[0])
                r2, c2 = parse_cell_coordinate(parts[1])
                start_r, end_r = min(r1, r2), max(r1, r2)
                start_c, end_c = min(c1, c2), max(c1, c2)
                res = []
                count = 0
                for r in range(start_r, end_r + 1):
                    for c in range(start_c, end_c + 1):
                        res.append(format_cell_coordinate(r, c))
                        count += 1
                        if count >= 500:
                            return res
                return res
            except Exception:
                return [clean]
    return [clean]

def parse_range_bounds(range_str: Optional[str]) -> Tuple[Optional[Tuple[int, int, int, int]], Optional[str]]:
    """
    Parses a range string (e.g. 'A1:D20', '$A$1:$D$20', 'Sheet1!A1:D20', or 'A1')
    into ((min_row, max_row, min_col, max_col), normalized_range_str).
    If range_str is None, empty, or 'null'/'none'/'all'/'*', returns (None, None).
    If format is invalid, raises ValueError.
    """
    if range_str is None:
        return None, None
    clean = str(range_str).strip()
    if not clean or clean.lower() in ("null", "none", "all", "*"):
        return None, None

    # Strip sheet prefix if present
    if '!' in clean:
        clean = clean.split('!')[-1].strip()
    clean = clean.replace('$', '').upper()

    if ':' in clean:
        parts = clean.split(':')
        if len(parts) == 2:
            try:
                r1, c1 = parse_cell_coordinate(parts[0].strip())
                r2, c2 = parse_cell_coordinate(parts[1].strip())
                min_r, max_r = min(r1, r2), max(r1, r2)
                min_c, max_c = min(c1, c2), max(c1, c2)
                norm_str = f"{format_cell_coordinate(min_r, min_c)}:{format_cell_coordinate(max_r, max_c)}"
                return (min_r, max_r, min_c, max_c), norm_str
            except Exception as e:
                raise ValueError(f"Format range cell '{range_str}' tidak valid. Gunakan format seperti 'A1:D20' atau 'B5'.") from e
        else:
            raise ValueError(f"Format range cell '{range_str}' tidak valid. Gunakan format seperti 'A1:D20' atau 'B5'.")
    else:
        try:
            r, c = parse_cell_coordinate(clean)
            norm_str = format_cell_coordinate(r, c)
            return (r, r, c, c), norm_str
        except Exception as e:
            raise ValueError(f"Format range cell '{range_str}' tidak valid. Gunakan format seperti 'A1:D20' atau 'B5'.") from e

def extract_references_from_formula(formula: str, current_sheet: str) -> List[Dict[str, Any]]:
    """
    Extracts all cell and range references from a formula.
    Returns a list of dicts with:
    - 'raw': original matched string
    - 'sheet': sheet name (defaults to current_sheet)
    - 'is_external': bool
    - 'workbook': optional workbook name
    - 'is_range': bool
    - 'cells': list of individual cell references in format 'Sheet!Coord'
    """
    if not formula or not isinstance(formula, str):
        return []
    
    # Remove leading '=' if present
    f = formula.lstrip('=+-@ ')
    references = []

    for match in CELL_REF_REGEX.finditer(f):
        # Filter out potential function names or invalid matches
        groups = match.groupdict()
        wb = groups.get('workbook')
        sh = get_sheet_from_groups(groups)
        c1 = groups.get('col1')
        r1 = groups.get('row1')
        c2 = groups.get('col2')
        r2 = groups.get('row2')

        target_sheet = sh.strip("'\"") if sh else current_sheet
        sheet_prefix = f"'{target_sheet}'!" if " " in target_sheet else f"{target_sheet}!"

        if c2 and r2:
            # It's a range
            expanded = expand_range(sheet_prefix, c1, r1, c2, r2)
            references.append({
                'raw': match.group(0),
                'sheet': target_sheet,
                'is_external': bool(wb),
                'workbook': wb,
                'is_range': True,
                'cells': expanded
            })
        else:
            coord = f"{c1.replace('$', '')}{r1.replace('$', '')}".upper()
            full_ref = f"{target_sheet}!{coord}"
            references.append({
                'raw': match.group(0),
                'sheet': target_sheet,
                'is_external': bool(wb),
                'workbook': wb,
                'is_range': False,
                'cells': [full_ref]
            })

    return references

def extract_functions_from_formula(formula: str) -> List[str]:
    """Extract Excel function names (e.g., SUM, IF, VLOOKUP) from formula."""
    if not formula or not isinstance(formula, str):
        return []
    
    clean_f = formula.lstrip('=+-@ ')
    matches = FUNCTION_REGEX.findall(clean_f)
    # Filter common non-function words
    known_funcs = []
    for m in matches:
        upper = m.upper()
        if not re.match(r'^[A-Z]{1,3}\d+$', upper): # not a cell coordinate
            known_funcs.append(upper)
    return list(dict.fromkeys(known_funcs))

def normalize_formula(formula: str, current_row: int, current_col: int) -> str:
    """
    Converts formula to an R1C1-like relative representation:
    e.g. at B2 (=row 2, col 2), =A2*2 becomes =R[0]C[-1]*2
    Absolute references like $A$1 become R1C1.
    This enables detecting patterns across different rows and columns.
    """
    if not formula or not isinstance(formula, str):
        return ""
    
    clean_f = formula.lstrip('= ')

    def replace_ref(match: re.Match) -> str:
        groups = match.groupdict()
        wb = groups.get('workbook')
        sh = get_sheet_from_groups(groups)
        c1 = groups.get('col1')
        r1 = groups.get('row1')
        c2 = groups.get('col2')
        r2 = groups.get('row2')

        sheet_part = ""
        if wb:
            sheet_part += f"[{wb}]"
        if sh:
            sheet_part += f"'{sh}'!" if " " in sh else f"{sh}!"

        # Process first reference
        is_abs_c1 = c1.startswith('$')
        is_abs_r1 = r1.startswith('$')
        c1_idx = col_letter_to_index(c1)
        r1_idx = int(r1.replace('$', ''))

        r1_str = f"R{r1_idx}" if is_abs_r1 else f"R[{r1_idx - current_row}]"
        c1_str = f"C{c1_idx}" if is_abs_c1 else f"C[{c1_idx - current_col}]"

        first_part = f"{r1_str}{c1_str}"

        if c2 and r2:
            is_abs_c2 = c2.startswith('$')
            is_abs_r2 = r2.startswith('$')
            c2_idx = col_letter_to_index(c2)
            r2_idx = int(r2.replace('$', ''))
            r2_str = f"R{r2_idx}" if is_abs_r2 else f"R[{r2_idx - current_row}]"
            c2_str = f"C{c2_idx}" if is_abs_c2 else f"C[{c2_idx - current_col}]"
            return f"{sheet_part}{first_part}:{r2_str}{c2_str}"
        
        return f"{sheet_part}{first_part}"

    normalized = CELL_REF_REGEX.sub(replace_ref, clean_f)
    return f"={normalized}"
