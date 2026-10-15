import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from pathlib import Path
from backend.app.config import SAMPLES_DIR

def create_sample_workbooks():
    """Generates sample financial model workbooks with Income Statement, Balance Sheet, and Cash Flow."""
    sample_1_path = SAMPLES_DIR / "financial_model.xlsx"
    sample_2_path = SAMPLES_DIR / "financial_model_v2.xlsx"
    sample_3_path = SAMPLES_DIR / "financial_model_v3.xlsx"

    # Check if sample 2 already has AI Cloud Infrastructure Fee
    if sample_1_path.exists() and sample_2_path.exists() and sample_3_path.exists():
        try:
            wb_test = openpyxl.load_workbook(str(sample_2_path), data_only=True)
            if "Income Statement" in wb_test.sheetnames and wb_test["Income Statement"]["A9"].value == "AI Cloud Infrastructure Fee":
                wb_test.close()
                return str(sample_1_path), str(sample_2_path), str(sample_3_path)
            wb_test.close()
        except Exception:
            pass

    # Styles
    header_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    sub_fill = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")
    bold_font = Font(name="Calibri", size=11, bold=True)
    highlight_fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
    num_fmt = "#,##0"
    pct_fmt = "0.0%"

    # 1. Create financial_model.xlsx (FY 2023 / Baseline)
    wb1 = openpyxl.Workbook()

    # Sheet 1: Assumptions
    ws_assump = wb1.active
    ws_assump.title = "Assumptions"
    ws_assump.views.sheetView[0].showGridLines = True
    ws_assump["A1"] = "Key Financial Assumptions (FY 2023 Baseline)"
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
        ws_rev[f"D{r_idx}"] = f"=B{r_idx}*C{r_idx}/4"
        ws_rev[f"E{r_idx}"] = f"=D{r_idx}*(1+Assumptions!B4)"
        if r_idx == 6:
            ws_rev[f"F{r_idx}"] = 43500  # Hardcoded anomaly in Consulting Services
        else:
            ws_rev[f"F{r_idx}"] = f"=E{r_idx}*(1+Assumptions!B4)"
        ws_rev[f"G{r_idx}"] = f"=F{r_idx}*(1+Assumptions!B4)"
        ws_rev[f"H{r_idx}"] = f"=SUM(D{r_idx}:G{r_idx})"
        for c_letter in ["D", "E", "F", "G", "H"]:
            ws_rev[f"{c_letter}{r_idx}"].number_format = "$#,##0"

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
            ws_costs[f"{col_letter}{r_idx}"] = item[col_idx]
            ws_costs[f"{col_letter}{r_idx}"].number_format = "$#,##0"
        ws_costs[f"G{r_idx}"] = f"=SUM(C{r_idx}:F{r_idx})"
        ws_costs[f"G{r_idx}"].number_format = "$#,##0"

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
    ws_is["A1"] = "Executive Income Statement (Laporan Laba Rugi)"
    ws_is["A1"].font = Font(name="Calibri", size=14, bold=True, color="1F4E79")
    is_headers = ["Metric / Account", "Q1", "Q2", "Q3", "Q4", "Full Year"]
    for c_idx, h in enumerate(is_headers, start=1):
        cell = ws_is.cell(row=3, column=c_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font

    ws_is["A4"] = "Gross Revenue"
    ws_is["B4"] = "=Revenue!D8"
    ws_is["C4"] = "=Revenue!E8"
    ws_is["D4"] = "=Revenue!F8"
    ws_is["E4"] = "=Revenue!G8"
    ws_is["F4"] = "=Revenue!H8"

    ws_is["A5"] = "Total Expenses"
    ws_is["B5"] = "=Costs!C8"
    ws_is["C5"] = "=Costs!D8"
    ws_is["D5"] = "=Costs!F8"
    ws_is["E5"] = "=Costs!F8"
    ws_is["F5"] = "=Costs!G8"

    ws_is["A6"] = "Operating Income (EBIT)"
    ws_is["A6"].font = bold_font
    for col_letter in ["B", "C", "D", "E"]:
        ws_is[f"{col_letter}6"] = f"={col_letter}4-{col_letter}5"
        ws_is[f"{col_letter}6"].font = bold_font
    ws_is["F6"] = "=SUM(B6:E6)"
    ws_is["F6"].font = bold_font

    ws_is["A7"] = "Income Tax"
    for col_letter in ["B", "C", "D", "E"]:
        ws_is[f"{col_letter}7"] = f"={col_letter}6*Assumptions!B5"
    ws_is["F7"] = "=SUM(B7:E7)"

    ws_is["A8"] = "Net Income"
    ws_is["A8"].font = Font(name="Calibri", size=12, bold=True, color="1F4E79")
    for col_letter in ["B", "C", "D", "E", "F"]:
        cell = ws_is[f"{col_letter}8"]
        cell.value = f"={col_letter}6-{col_letter}7"
        cell.font = Font(name="Calibri", size=12, bold=True, color="1F4E79")
        cell.fill = highlight_fill

    for r in range(4, 9):
        for col_letter in ["B", "C", "D", "E", "F"]:
            ws_is[f"{col_letter}{r}"].number_format = "$#,##0"

    # Distinct account only in WB 1:
    ws_is["A9"] = "Legacy Maintenance Expense"
    ws_is["B9"] = 25000
    ws_is["C9"] = 25000
    ws_is["D9"] = 25000
    ws_is["E9"] = 25000
    ws_is["F9"] = 100000
    for col_letter in ["B", "C", "D", "E", "F"]:
        ws_is[f"{col_letter}9"].number_format = "$#,##0"

    # Sheet 5: Balance Sheet (Neraca)
    ws_bs = wb1.create_sheet(title="Balance Sheet")
    ws_bs.views.sheetView[0].showGridLines = True
    ws_bs["A1"] = "Executive Balance Sheet (Neraca)"
    ws_bs["A1"].font = Font(name="Calibri", size=14, bold=True, color="1F4E79")
    bs_headers = ["Balance Sheet Account", "Q1", "Q2", "Q3", "Q4", "Year End"]
    for c_idx, h in enumerate(bs_headers, start=1):
        cell = ws_bs.cell(row=3, column=c_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font

    bs_items = [
        # (Row, Account, Q1, Q2, Q3, Q4, YearEnd, is_bold, is_highlight)
        (4, "Cash & Cash Equivalents", 125000, 142000, 168000, 195000, "=E4", False, False),
        (5, "Accounts Receivable", "=Revenue!D8*0.14", "=Revenue!E8*0.14", "=Revenue!F8*0.14", "=Revenue!G8*0.14", "=E5", False, False),
        (6, "Inventories", 85000, 88000, 92000, 95000, "=E6", False, False),
        (7, "Total Current Assets", "=SUM(B4:B6)", "=SUM(C4:C6)", "=SUM(D4:D6)", "=SUM(E4:E6)", "=E7", True, False),
        (8, "Property, Plant & Equipment (Net)", 450000, 440000, 430000, 420000, "=E8", False, False),
        (9, "Intangible Assets", 60000, 60000, 58000, 58000, "=E9", False, False),
        (10, "Total Assets", "=B7+B8+B9", "=C7+C8+C9", "=D7+D8+D9", "=E7+E8+E9", "=E10", True, True),
        (11, "Accounts Payable", "=Costs!C8*0.12", "=Costs!D8*0.12", "=Costs!E8*0.12", "=Costs!F8*0.12", "=E11", False, False),
        (12, "Short-Term Debt", 45000, 40000, 35000, 30000, "=E12", False, False),
        (13, "Total Current Liabilities", "=SUM(B11:B12)", "=SUM(C11:C12)", "=SUM(D11:D12)", "=SUM(E11:E12)", "=E13", True, False),
        (14, "Long-Term Debt", 220000, 210000, 200000, 190000, "=E14", False, False),
        (15, "Total Liabilities", "=B13+B14", "=C13+C14", "=D13+D14", "=E13+E14", "=E15", True, False),
        (16, "Common Stock", 200000, 200000, 200000, 200000, "=E16", False, False),
        (17, "Retained Earnings", "=B10-B15-B16", "=C10-C15-C16", "=D10-D15-D16", "=E10-E15-E16", "=E17", False, False),
        (18, "Total Shareholders' Equity", "=B16+B17", "=C16+C17", "=D16+D17", "=E16+E17", "=E18", True, False),
        (19, "Total Liabilities & Equity", "=B15+B18", "=C15+C18", "=D15+D18", "=E15+E18", "=E19", True, True),
    ]
    for r, name, q1, q2, q3, q4, ye, is_b, is_h in bs_items:
        ws_bs[f"A{r}"] = name
        ws_bs[f"B{r}"] = q1
        ws_bs[f"C{r}"] = q2
        ws_bs[f"D{r}"] = q3
        ws_bs[f"E{r}"] = q4
        ws_bs[f"F{r}"] = ye
        if is_b:
            ws_bs[f"A{r}"].font = bold_font
            for col_l in ["B", "C", "D", "E", "F"]:
                ws_bs[f"{col_l}{r}"].font = bold_font
        if is_h:
            ws_bs[f"A{r}"].fill = highlight_fill
            for col_l in ["B", "C", "D", "E", "F"]:
                ws_bs[f"{col_l}{r}"].fill = highlight_fill
        for col_l in ["B", "C", "D", "E", "F"]:
            ws_bs[f"{col_l}{r}"].number_format = "$#,##0"

    # Sheet 6: Cash Flow (Arus Kas)
    ws_cf = wb1.create_sheet(title="Cash Flow")
    ws_cf.views.sheetView[0].showGridLines = True
    ws_cf["A1"] = "Executive Cash Flow Statement (Laporan Arus Kas)"
    ws_cf["A1"].font = Font(name="Calibri", size=14, bold=True, color="1F4E79")
    cf_headers = ["Cash Flow Account", "Q1", "Q2", "Q3", "Q4", "Full Year"]
    for c_idx, h in enumerate(cf_headers, start=1):
        cell = ws_cf.cell(row=3, column=c_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font

    cf_items = [
        (4, "Net Income", "='Income Statement'!B8", "='Income Statement'!C8", "='Income Statement'!D8", "='Income Statement'!E8", "='Income Statement'!F8", False, False),
        (5, "Depreciation & Amortization", 10000, 10000, 10000, 10000, "=SUM(B5:E5)", False, False),
        (6, "Change in Working Capital", -6000, -5000, -4000, 3000, "=SUM(B6:E6)", False, False),
        (7, "Net Cash from Operating Activities", "=SUM(B4:B6)", "=SUM(C4:C6)", "=SUM(D4:D6)", "=SUM(E4:E6)", "=SUM(F4:F6)", True, True),
        (8, "Capital Expenditures (CapEx)", -25000, -18000, -15000, -12000, "=SUM(B8:E8)", False, False),
        (9, "Net Cash from Investing Activities", "=B8", "=C8", "=D8", "=E8", "=SUM(B9:E9)", True, False),
        (10, "Repayment of Debt", -5000, -5000, -5000, -5000, "=SUM(B10:E10)", False, False),
        (11, "Dividends Paid", -8000, -8000, -8000, -12000, "=SUM(B11:E11)", False, False),
        (12, "Net Cash from Financing Activities", "=SUM(B10:B11)", "=SUM(C10:C11)", "=SUM(D10:D11)", "=SUM(E10:E11)", "=SUM(F10:F11)", True, False),
        (13, "Net Increase / Decrease in Cash", "=B7+B9+B12", "=C7+C9+C12", "=D7+D9+D12", "=E7+E9+E12", "=SUM(B13:E13)", True, True),
        (14, "Beginning Cash Balance", 100000, "=B15", "=C15", "=D15", 100000, False, False),
        (15, "Ending Cash Balance", "=B13+B14", "=C13+C14", "=D13+D14", "=E13+E14", "=E15", True, True),
    ]
    for r, name, q1, q2, q3, q4, fy, is_b, is_h in cf_items:
        ws_cf[f"A{r}"] = name
        ws_cf[f"B{r}"] = q1
        ws_cf[f"C{r}"] = q2
        ws_cf[f"D{r}"] = q3
        ws_cf[f"E{r}"] = q4
        ws_cf[f"F{r}"] = fy
        if is_b:
            ws_cf[f"A{r}"].font = bold_font
            for col_l in ["B", "C", "D", "E", "F"]:
                ws_cf[f"{col_l}{r}"].font = bold_font
        if is_h:
            ws_cf[f"A{r}"].fill = highlight_fill
            for col_l in ["B", "C", "D", "E", "F"]:
                ws_cf[f"{col_l}{r}"].fill = highlight_fill
        for col_l in ["B", "C", "D", "E", "F"]:
            ws_cf[f"{col_l}{r}"].number_format = "$#,##0"

    wb1.save(str(sample_1_path))
    wb1.close()

    # 2. Create financial_model_v2.xlsx (FY 2024 / Revised Model)
    wb2 = openpyxl.load_workbook(str(sample_1_path))
    ws2_assump = wb2["Assumptions"]
    ws2_assump["A1"] = "Key Financial Assumptions (FY 2024 Actual)"
    ws2_assump["B4"] = 0.12  # Base growth 8% -> 12%
    ws2_assump["B5"] = 0.25  # Tax rate 22% -> 25%

    ws2_rev = wb2["Revenue"]
    # Enterprise Software bonus factor formula change
    ws2_rev["E4"] = "=D4*(1+Assumptions!B4)*1.05"
    ws2_rev["F6"] = "=E6*(1+Assumptions!B4)"

    # Income Statement tweak for wb2: Replace row 9 with AI Cloud Infrastructure Fee
    ws2_is = wb2["Income Statement"]
    ws2_is["A9"] = "AI Cloud Infrastructure Fee"
    ws2_is["B9"] = 15000
    ws2_is["C9"] = 18000
    ws2_is["D9"] = 22000
    ws2_is["E9"] = 28000
    ws2_is["F9"] = 83000
    for col_l in ["B", "C", "D", "E", "F"]:
        ws2_is[f"{col_l}9"].number_format = "$#,##0"

    ws2_bs = wb2["Balance Sheet"]
    # Change starting Cash and PPE in Year 2
    ws2_bs["B4"] = 145000
    ws2_bs["B8"] = 490000
    # Distinct Balance Sheet account in wb2
    ws2_bs["A20"] = "Digital & Crypto Assets"
    ws2_bs["B20"] = 12000
    ws2_bs["C20"] = 15000
    ws2_bs["D20"] = 18000
    ws2_bs["E20"] = 22000
    ws2_bs["F20"] = 22000
    for col_l in ["B", "C", "D", "E", "F"]:
        ws2_bs[f"{col_l}20"].number_format = "$#,##0"

    ws2_cf = wb2["Cash Flow"]
    # CapEx increased in v2
    ws2_cf["B8"] = -32000
    ws2_cf["C8"] = -25000
    # Intentional formula tweak: In Q3 CapEx, hardcoded constant instead of formula!
    ws2_cf["D8"] = -18000
    # Distinct Cash Flow account in wb2
    ws2_cf["A16"] = "Share Buyback Program"
    ws2_cf["B16"] = -10000
    ws2_cf["C16"] = -10000
    ws2_cf["D16"] = -10000
    ws2_cf["E16"] = -15000
    ws2_cf["F16"] = -45000
    for col_l in ["B", "C", "D", "E", "F"]:
        ws2_cf[f"{col_l}16"].number_format = "$#,##0"

    wb2.save(str(sample_2_path))
    wb2.close()

    # 3. Create financial_model_v3.xlsx (Revised Target Model)
    wb3 = openpyxl.load_workbook(str(sample_1_path))
    ws3_assump = wb3["Assumptions"]
    ws3_assump["A1"] = "Key Financial Assumptions (Forecast)"
    ws3_assump["B4"] = 0.16  # Aggressive growth 16%
    ws3_assump["B5"] = 0.22  # Normalized Tax 22%
    ws3_assump["B8"] = 6200  # Sales unit target increased

    ws3_rev = wb3["Revenue"]
    # Base units higher across lines
    ws3_rev["B4"] = 1500
    ws3_rev["B5"] = 4200
    ws3_rev["F6"] = "=E6*(1+Assumptions!B4)"

    ws3_is = wb3["Income Statement"]
    ws3_is["A9"] = "AI Cloud Infrastructure Fee"
    ws3_is["B9"] = 20000
    ws3_is["C9"] = 25000
    ws3_is["D9"] = 30000
    ws3_is["E9"] = 35000
    ws3_is["F9"] = 110000
    ws3_is["A10"] = "R&D Innovation Grant"
    ws3_is["B10"] = 50000
    ws3_is["C10"] = 50000
    ws3_is["D10"] = 50000
    ws3_is["E10"] = 50000
    ws3_is["F10"] = 200000
    for r_i in [9, 10]:
        for col_l in ["B", "C", "D", "E", "F"]:
            ws3_is[f"{col_l}{r_i}"].number_format = "$#,##0"

    ws3_bs = wb3["Balance Sheet"]
    ws3_bs["B4"] = 180000
    ws3_bs["B8"] = 540000

    ws3_cf = wb3["Cash Flow"]
    ws3_cf["B8"] = -40000
    ws3_cf["C8"] = -35000
    ws3_cf["B11"] = -15000  # Increased dividends

    wb3.save(str(sample_3_path))
    wb3.close()

    return str(sample_1_path), str(sample_2_path), str(sample_3_path)
