# Web Excel Formula Intelligence

Aplikasi web interaktif untuk menganalisis workbook Excel secara terstruktur, menelusuri alur dependensi formula secara visual di atas *grid* Luckysheet, membandingkan formula antar-sheet/workbook, serta mengaudit anomali dan *hardcoded values*.

Dibangun sesuai spesifikasi dokumen [PRD Web Excel Formula Intelligence](prd_web_excel_formula_intelligence.md).

---

## 🚀 Fitur Utama

1. **Rendering Grid Excel Interaktif (Luckysheet + React JS):**
   - Unggah file `.xlsx` dan `.xlsm`.
   - Konversi struktur sel, merge cell, format font, background color, dan formula ke format Luckysheet secara presisi.
   - Navigasi antar-sheet langsung di tab Luckysheet.
2. **Formula Discovery (FR-02):**
   - Menampilkan seluruh formula pada sheet aktif.
   - Filter formula berdasarkan teks, koordinat, atau fungsi (misal: `SUM`, `IF`).
   - Pengelompokan formula berdasarkan kesamaan pola logis struktur (*Normalized Formula / R1C1 relative logic*).
3. **Visual Formula Tracing (FR-03):**
   - **Trace Precedents:** Menelusuri seluruh sel sumber (langsung dan rekursif/transitif) hingga ke *terminal input sources* (konstanta).
   - **Trace Dependents:** Menelusuri sel-sel yang nilainya bergantung pada sel yang dipilih.
   - **Highlighter Grid:** Sel target, sumber konstanta (hijau), dan sel perantara (biru) disorot langsung di atas grid Luckysheet.
   - **Circular Reference Protection:** Menggunakan NetworkX untuk mendeteksi siklus dependensi dan menghentikan rekursi secara aman.
   - **Interactive Graph Visualization:** Modal visual graf SVG dependensi antar-sheet dengan garis panah berarah.
4. **Interactive Sheet & Workbook Comparison (FR-04):**
   - Membandingkan 2 sheet pada workbook yang sama atau antar-workbook berbeda (misal: v1 vs v2).
   - Mode perbandingan:
     - *Exact formula diff* (karakter per karakter).
     - *Normalized formula diff* (pola logika relatif).
     - *Values diff* (perbedaan angka kalkulasi/konstanta).
   - Indikator warna perbedaan: formula diubah (kuning/oranye), sel baru (hijau), sel dihapus (merah).
5. **Validation & Audit Engine (FR-05):**
   - Deteksi *hardcoded numeric values* yang terselip di dalam rangkaian formula berurutan.
   - Deteksi inkonsistensi pola formula dalam satu baris atau kolom.
   - Deteksi error formula `#REF!`, `#VALUE!`, `#DIV/0!`.
   - Deteksi referensi ke workbook eksternal (`[External.xlsx]`).
   - Klik pada item audit untuk langsung melompat (*jump-to-cell*) dan menyorot sel bersangkutan.

---

## 🛠️ Tech Stack

- **Backend:** Python (virtual environment `venv`), FastAPI, Uvicorn, openpyxl, NetworkX, Pydantic.
- **Frontend:** React 18, Vite, Luckysheet (Online Spreadsheet Renderer), Lucide Icons, Vanilla CSS (Modern Dark Palette).

---

## 📂 Struktur Project

```text
excelAnalyst/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes_workbook.py     # Endpoint upload, list, metadata, formulas
│   │   │   ├── routes_trace.py        # Endpoint precedent, dependent, graph
│   │   │   ├── routes_compare.py      # Endpoint sheet diff (exact & normalized)
│   │   │   └── routes_audit.py        # Endpoint anomaly & hardcoded detection
│   │   ├── models/
│   │   │   └── schemas.py             # Pydantic schema models
│   │   ├── services/
│   │   │   ├── formula_parser.py      # Regex/AST parser, relative normalizer
│   │   │   ├── formula_tracer.py      # NetworkX recursive graph tracer
│   │   │   ├── formula_comparator.py  # Diff engine
│   │   │   ├── formula_auditor.py     # Anomaly & hardcoded detector
│   │   │   ├── luckysheet_converter.py# Konverter openpyxl ke Luckysheet JSON
│   │   │   ├── sample_generator.py    # Pembuat model finansial demo (v1 & v2)
│   │   │   └── workbook_manager.py    # Manajer in-memory session workbook
│   │   ├── config.py                  # Konfigurasi path & CORS
│   │   └── main.py                    # Entry point FastAPI & Uvicorn
│   ├── samples/                       # File demo Excel otomatis
│   └── requirements.txt               # Dependensi python
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx             # Top bar, switcher workbook, upload, demo loader
│   │   │   ├── Toolbar.jsx            # Mode navigator & cell indicator
│   │   │   ├── LuckysheetGrid.jsx     # Integrasi Luckysheet + cell highlights
│   │   │   ├── FormulaSidebar.jsx     # Formula catalog, search & pattern groups
│   │   │   ├── TracePanel.jsx         # Tree precedents/dependents & terminal inputs
│   │   │   ├── CompareView.jsx        # Selector baseline/target sheet & diff table
│   │   │   ├── AuditPanel.jsx         # Panel anomali & peringatan
│   │   │   └── DependencyGraphModal.jsx# Visual graf dependensi interaktif (SVG)
│   │   ├── services/
│   │   │   └── api.js                 # HTTP client API
│   │   ├── App.jsx                    # State orchestrator
│   │   ├── index.css                  # Modern dark theme styles
│   │   └── main.jsx                   # Entry point React
│   ├── index.html                     # HTML template + Luckysheet CDN
│   ├── vite.config.js                 # Konfigurasi Vite & proxy backend
│   └── package.json
├── run_backend.bat                    # Script cepat menjalankan backend
├── run_frontend.bat                   # Script cepat menjalankan frontend
├── start.bat                          # Menjalankan backend dan frontend sekaligus
└── prd_web_excel_formula_intelligence.md
```

---

## 💻 Cara Menjalankan

### Cara 1: Sekali Klik (Windows)
Jalankan file batch:
```cmd
start.bat
```
Ini akan membuka 2 window:
- Backend di `http://localhost:8000` (Dokumentasi Swagger API di `http://localhost:8000/docs`)
- Frontend di `http://localhost:5173`

---

### Cara 2: Manual Terminal

#### 1. Jalankan Backend (FastAPI + Uvicorn)
```powershell
# Di folder root excelAnalyst:
.\venv\Scripts\activate
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Jalankan Frontend (Vite + React)
```powershell
# Buka terminal baru di folder frontend:
cd frontend
npm run dev
```

Buka browser Anda di `http://localhost:5173`.

---

## 🎯 Uji Coba Langsung dengan Demo Data
1. Buka `http://localhost:5173`.
2. Secara otomatis aplikasi akan memuat **Financial Model Demo** (atau klik tombol **"Load Demo Models"** di Navbar).
3. **Trace Precedents:**
   - Masuk ke tab sheet `Income Statement`.
   - Klik sel `B8` (Net Income).
   - Klik tombol **"Precedents"** di toolbar atas.
   - Anda akan melihat:
     - Sel sumber di sheet `Assumptions`, `Revenue`, dan `Costs` disorot.
     - Di sidebar kanan muncul pohon dependensi dan 11 *Terminal Input Sources* (konstanta input).
     - Klik tombol **"Graph Visual"** untuk melihat diagram graf alur data.
4. **Compare Sheets:**
   - Klik menu **"Compare Sheets"** di toolbar.
   - Pilih Baseline `financial_model.xlsx` (Sheet: `Revenue`) dan Target `financial_model_v2.xlsx` (Sheet: `Revenue`).
   - Klik **"Run Sheet Comparison"**. Perubahan formula dan sel langsung terdeteksi dan diwarnai.
5. **Audit Anomalies:**
   - Klik menu **"Audit & Anomalies"** di toolbar.
   - Anda akan langsung melihat daftar anomali yang terdeteksi, seperti *hardcoded numbers* di baris formula dan variasi pola formula tidak terduga.
