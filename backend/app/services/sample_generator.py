import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from pathlib import Path
from backend.app.config import SAMPLES_DIR

def create_sample_workbooks():
    """Generates sample financial model workbooks for testing and demonstration."""
    sample_1_path = SAMPLES_DIR / "financial_model.xlsx"
    sample_2_path = SAMPLES_DIR / "financial_model_v2.xlsx"

    if sample_1_path.exists() and sample_2_path.exists():
        return str(sample_1_path), str(sample_2_path)

    # 1. Create financial_model.xlsx
    wb1 = openpyxl.Workbook()
    
    # Styles
    header_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    sub_fill = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")
    sub_font = Font(name="Calibri", size=11, bold=True)
    bold_font = Font(name="Calibri", size=11, bold=True)
    num_fmt = "#,##0"
    pct_fmt = "0.0%"

    # Sheet 1: Assumptions
    ws_assump = wb1.active
    ws_assump.title = "Assumptions"
    ws_assump.views.sheetView[0].showGridLines = True

    ws_assump["A1"] = "Key Financial Assumptions"
    ws_assump["A1"].font = Font(name="Calibri", size=14, bold=True, color="1F4E79")
    ws_assump["A3"] = "Assumption"
    ws_assump["B3"] = "Value"
    ws_assump["A3"].fill = header_fill
    ws_assump["A3"].font = header_font
    ws_assump["B3"].fill = header_fill
    ws_assump["B3"].font = header_font

    assumptions = [
        ("Base Growth Rate", 0.08, pct_fmt),
        ("Tax Rate", 0.22, pct_fmt),
        ("Discount Rate", 0.10, pct_fmt),
        ("Inflation Rate", 0.03, pct_fmt),
        ("Sales Target Units", 5000, num_fmt),
    ]

    for idx, (k, v, fmt) in enumerate(assumptions, start=4):
        ws_assump[f"A{idx}"] = k
        ws_assump[f"B{idx}"] = v
        ws_assump[f"B{idx}"].number_format = fmt

    # Sheet 2: Revenue
    ws_rev = wb1.create_sheet(title="Revenue")
    ws_rev.views.sheetView[0].showGridLines = True
    ws_rev["A1"] = "Revenue Projections by Product"
    ws_rev["A1"].font = Font(name="Calibri", size=14, bold=True, color="1F4E79")

    rev_headers = ["Product Line", "Base Units", "Unit Price", "Q1 Revenue", "Q2 Revenue", "Q3 Revenue", "Q4 Revenue", "Total Year"]
    for c_idx, h in enumerate(rev_headers, start=1):
        cell = ws_rev.cell(row=3, column=c_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font

    products = [
        ("Enterprise Software", 1200, 450),
        ("Cloud Subscription", 3500, 120),
        ("Consulting Services", 800, 200),
        ("Hardware Appliances", 400, 850),
    ]

    for r_idx, (prod, units, price) in enumerate(products, start=4):
        ws_rev[f"A{r_idx}"] = prod
        ws_rev[f"B{r_idx}"] = units
        ws_rev[f"C{r_idx}"] = price
        ws_rev[f"B{r_idx}"].number_format = num_fmt
        ws_rev[f"C{r_idx}"].number_format = "$#,##0"

        # Formulas: Q1 = Units * Price / 4
        ws_rev[f"D{r_idx}"] = f"=B{r_idx}*C{r_idx}/4"
        # Q2 = Q1 * (1 + Assumptions!B4)
        ws_rev[f"E{r_idx}"] = f"=D{r_idx}*(1+Assumptions!B4)"
        
        # Intentional anomaly for row 6 (Consulting Services): Q3 has hardcoded value!
        if r_idx == 6:
            ws_rev[f"F{r_idx}"] = 43500 # Hardcoded anomaly in series!
        else:
            ws_rev[f"F{r_idx}"] = f"=E{r_idx}*(1+Assumptions!B4)"

        ws_rev[f"G{r_idx}"] = f"=F{r_idx}*(1+Assumptions!B4)"
        ws_rev[f"H{r_idx}"] = f"=SUM(D{r_idx}:G{r_idx})"

        for c_letter in ["D", "E", "F", "G", "H"]:
            ws_rev[f"{c_letter}{r_idx}"].number_format = "$#,##0"

    # Total Row
    tot_row = 8
    ws_rev[f"A{tot_row}"] = "Total Revenue"
    ws_rev[f"A{tot_row}"].font = bold_font
    for c_letter in ["D", "E", "F", "G", "H"]:
        cell = ws_rev[f"{c_letter}{tot_row}"]
        cell.value = f"=SUM({c_letter}4:{c_letter}7)"
        cell.font = bold_font
        cell.fill = sub_fill
        cell.number_format = "$#,##0"

    # Sheet 3: Costs
    ws_costs = wb1.create_sheet(title="Costs")
    ws_costs.views.sheetView[0].showGridLines = True
    ws_costs["A1"] = "Operating & Cost Breakdown"
    ws_costs["A1"].font = Font(name="Calibri", size=14, bold=True, color="1F4E79")

    cost_headers = ["Cost Category", "Type", "Q1 Costs", "Q2 Costs", "Q3 Costs", "Q4 Costs", "Annual Total"]
    for c_idx, h in enumerate(cost_headers, start=1):
        cell = ws_costs.cell(row=3, column=c_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font

    cost_items = [
        ("Direct Labor / COGS", "COGS", "=Revenue!D8*0.35", "=Revenue!E8*0.35", "=Revenue!F8*0.35", "=Revenue!G8*0.35"),
        ("Research & Development", "OPEX", 120000, "=C5*(1+Assumptions!B7)", "=D5*(1+Assumptions!B7)", "=E5*(1+Assumptions!B7)"),
        ("Sales & Marketing", "OPEX", "=Revenue!D8*0.15", "=Revenue!E8*0.15", "=Revenue!F8*0.15", "=Revenue!G8*0.15"),
        ("General & Administrative", "OPEX", 85000, 85000, 85000, 85000),
    ]

    for r_idx, item in enumerate(cost_items, start=4):
        ws_costs[f"A{r_idx}"] = item[0]
        ws_costs[f"B{r_idx}"] = item[1]
        for col_idx, col_letter in enumerate(["C", "D", "E", "F"], start=2):
            val = item[col_idx]
            ws_costs[f"{col_letter}{r_idx}"] = val
            ws_costs[f"{col_letter}{r_idx}"].number_format = "$#,##0"
        
        ws_costs[f"G{r_idx}"] = f"=SUM(C{r_idx}:F{r_idx})"
        ws_costs[f"G{r_idx}"].number_format = "$#,##0"

    # Costs Total
    ws_costs["A8"] = "Total Expenses"
    ws_costs["A8"].font = bold_font
    for c_letter in ["C", "D", "E", "F", "G"]:
        cell = ws_costs[f"{c_letter}8"]
        cell.value = f"=SUM({c_letter}4:{c_letter}7)"
        cell.font = bold_font
        cell.fill = sub_fill
        cell.number_format = "$#,##0"

    # Sheet 4: Income Statement
    ws_is = wb1.create_sheet(title="Income Statement")
    ws_is.views.sheetView[0].showGridLines = True
    ws_is["A1"] = "Executive Income Statement"
    ws_is["A1"].font = Font(name="Calibri", size=14, bold=True, color="1F4E79")

    is_headers = ["Metric", "Q1", "Q2", "Q3", "Q4", "Full Year"]
    for c_idx, h in enumerate(is_headers, start=1):
        cell = ws_is.cell(row=3, column=c_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font

    # Rows:
    # 4: Gross Revenue = Revenue!D8..G8, H8
    ws_is["A4"] = "Gross Revenue"
    ws_is["B4"] = "=Revenue!D8"
    ws_is["C4"] = "=Revenue!E8"
    ws_is["D4"] = "=Revenue!F8"
    ws_is["E4"] = "=Revenue!G8"
    ws_is["F4"] = "=Revenue!H8"

    # 5: Total Expenses = Costs!C8..F8, G8
    ws_is["A5"] = "Total Expenses"
    ws_is["B5"] = "=Costs!C8"
    ws_is["C5"] = "=Costs!D8"
    ws_is["D5"] = "=Costs!F8" # Wait, intentional column anomaly here: skipped Costs!E8!
    ws_is["E5"] = "=Costs!F8"
    ws_is["F5"] = "=Costs!G8"

    # 6: Operating Income (EBIT) = B4 - B5
    ws_is["A6"] = "Operating Income (EBIT)"
    ws_is["A6"].font = bold_font
    for c_idx, col_letter in enumerate(["B", "C", "D", "E"], start=1):
        ws_is[f"{col_letter}6"] = f"={col_letter}4-{col_letter}5"
        ws_is[f"{col_letter}6"].font = bold_font
    ws_is["F6"] = "=SUM(B6:E6)"
    ws_is["F6"].font = bold_font

    # 7: Income Tax = EBIT * Assumptions!B5
    ws_is["A7"] = "Income Tax (22%)"
    for c_idx, col_letter in enumerate(["B", "C", "D", "E"], start=1):
        ws_is[f"{col_letter}7"] = f"={col_letter}6*Assumptions!B5"
    ws_is["F7"] = "=SUM(B7:E7)"

    # 8: Net Income = EBIT - Tax
    ws_is["A8"] = "Net Income"
    ws_is["A8"].font = Font(name="Calibri", size=12, bold=True, color="1F4E79")
    for c_idx, col_letter in enumerate(["B", "C", "D", "E", "F"], start=1):
        cell = ws_is[f"{col_letter}8"]
        cell.value = f"={col_letter}6-{col_letter}7"
        cell.font = Font(name="Calibri", size=12, bold=True, color="1F4E79")
        cell.fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")

    for r in range(4, 9):
        for col_letter in ["B", "C", "D", "E", "F"]:
            ws_is[f"{col_letter}{r}"].number_format = "$#,##0"

    wb1.save(str(sample_1_path))
    wb1.close()

    # 2. Create financial_model_v2.xlsx (Modified version for comparison testing)
    wb2 = openpyxl.load_workbook(str(sample_1_path))
    ws2_assump = wb2["Assumptions"]
    ws2_assump["B4"] = 0.12 # Base growth increased from 8% to 12%
    ws2_assump["B5"] = 0.25 # Tax rate increased to 25%

    ws2_rev = wb2["Revenue"]
    # Change formula in Enterprise Software Q2 to include a bonus factor
    ws2_rev["E4"] = "=D4*(1+Assumptions!B4)*1.05" # modified formula!
    # Fix the hardcoded value in row 6 to be proper formula
    ws2_rev["F6"] = "=E6*(1+Assumptions!B4)"

    wb2.save(str(sample_2_path))
    wb2.close()

    return str(sample_1_path), str(sample_2_path)
