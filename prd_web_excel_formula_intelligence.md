# Product Requirements Document (PRD)
# Web Excel Formula Intelligence 

**Versi:** 1.0  
**Status:** Draft  
**Teknologi utama:** React JS (Frontend), Luckysheet (Excel Renderer), Python (Backend), openpyxl, formula parser berbasis AST, NetworkX.

---

## 1. Ringkasan Produk

Web Excel Formula Intelligence adalah aplikasi berbasis web interaktif yang memungkinkan analis untuk menganalisis workbook Excel secara terstruktur. Pengguna dapat mengunggah file Excel, memvisualisasikannya di browser menggunakan Luckysheet, dan memanfaatkan backend Python untuk menelusuri formula, mengidentifikasi sumber data, membandingkan formula antar-sheet maupun antar-workbook, dan mendeteksi potensi masalah. 

Tujuan utamanya adalah mengubah workbook Excel yang kompleks menjadi struktur dependensi yang bisa ditelusuri, dibandingkan, divalidasi, dan dijelaskan melalui antarmuka grafis (GUI) yang ramah pengguna.

## 2. Permasalahan yang Ingin Diselesaikan

| Permasalahan | Solusi dalam Web App |
|---|---|
| Formula panjang dan sulit dipahami | Penjelasan fungsi dan *formula breakdown* di panel *sidebar* React. |
| Tidak diketahui sumber nilai formula | Fitur *Trace precedents* yang menyorot (highlight) sel sumber secara visual di atas grid Luckysheet. |
| Dependensi melewati banyak sheet | *Recursive dependency tracing* yang menampilkan alur antar-sheet menggunakan modal atau graf visual. |
| Formula antar-sheet terlihat serupa tetapi mungkin berbeda | *Normalized diff* dan perbandingan visual (*split-screen* atau sorotan warna). |
| Workbook versi baru berbeda dari versi sebelumnya | Analisis dampak (*impact analysis*) dan *workbook diff* yang ditampilkan secara *overlay* di UI. |
| Kesalahan formula tersembunyi | Pengecekan konsistensi dan deteksi anomali (*anomaly detection*) dengan indikator *warning* di UI. |

## 3. Target Pengguna

*   **Business Analyst:** Memahami *business rules* dan hubungan perhitungan dalam spreadsheet.
*   **Financial Analyst:** Memeriksa proyeksi keuangan, asumsi, dan formula perhitungan.
*   **Developer:** Melakukan *reverse engineering* terhadap workbook Excel.
*   **Model Validator / QA:** Membandingkan versi model dan mendeteksi inkonsistensi.

## 4. Ruang Lingkup Produk

### 4.1 Rendering UI & Workbook Management
Mengunggah file Excel ke backend Python untuk di-parsing, kemudian mengirimkan data strukturnya (termasuk sel, format, dan formula) ke frontend untuk di-render menggunakan Luckysheet di dalam komponen React JS.

### 4.2 Visual Formula Tracing
Memilih sheet, menemukan formula, dan menelusuri referensi langsung maupun tidak langsung dengan menampilkan garis atau warna (highlight) secara langsung pada sel-sel di Luckysheet.

### 4.3 Interactive Workbook Comparison
Membandingkan formula antar-sheet dan antar-workbook menggunakan tampilan *split-view* di React, serta mendeteksi perubahan struktur dan formula.

### 4.4 Dependency Intelligence & Validation
Membangun graf dependensi, menganalisis dampak perubahan, serta mendeteksi formula yang berbeda dari pola sekitarnya. Hasilnya ditampilkan dalam bentuk panel *dashboard* atau tabel peringatan.

## 5. Alur Penggunaan Utama

### 5.1 Membuka Workbook dan Eksplorasi
1. **Upload:** Pengguna mengunggah file `.xlsx`. Backend Python membacanya menggunakan `openpyxl` dan mengonversinya ke format JSON yang dikenali oleh Luckysheet.
2. **Render:** React JS memuat komponen Luckysheet dan menampilkan sheet beserta data/formulanya.
3. **List & Select Sheets:** Pengguna dapat berpindah tab sheet langsung di Luckysheet, sambil melihat panel *metadata* (dimensi, jumlah formula) di panel samping.
4. **Analyze:** Pengguna memilih sebuah area, dan UI menampilkan daftar referensi eksternal serta potensi anomali.

### 5.2 Menelusuri Formula Secara Visual
Ketika pengguna mengklik kanan sel di Luckysheet (misalnya sel target dengan formula `=Revenue!F10-Costs!F10`) dan memilih "Trace Formula":
*   Backend memproses referensi untuk menemukan *Direct precedents* dan *Transitive precedents* hingga ke *Terminal sources* (sel input/konstanta).
*   Frontend (React) merespons dengan mewarnai sel dependensi di Luckysheet dan menampilkan panel yang merinci jalur dependensi, kedalaman penelusuran, dan peringatan *circular reference*.

### 5.3 Membandingkan Sheet
Pengguna memilih opsi "Compare" di navigasi web:
*   Mengunggah workbook kedua atau memilih sheet pembanding (misal: Baseline `Projection`, Pembanding `Projection Previous`).
*   Sistem mendukung mode perbandingan: *Cell-by-cell* (koordinat sel yang sama) atau *Structural alignment* (berdasarkan label baris/header).
*   Perbedaan disorot di Luckysheet (misal: warna merah untuk formula berbeda, kuning untuk rentang yang berubah).

## 6. Functional Requirements (FR)

### FR-01 — UI & Workbook Management
*   **FR-01.1:** UI web untuk mengunggah dan membuka file `.xlsx` dan `.xlsm`.
*   **FR-01.2:** Backend Python (REST API) untuk mengonversi data `.xlsx` ke format struktur Luckysheet JSON.
*   **FR-01.3:** Menampilkan *grid* Excel interaktif di browser menggunakan komponen Luckysheet.
*   **FR-01.4:** Menampilkan panel navigasi untuk berpindah antar workbook yang terbuka dalam satu sesi.

### FR-02 — Formula Discovery (UI Integration)
*   **FR-02.1:** Menampilkan *sidebar* berisi semua formula dalam sheet terpilih.
*   **FR-02.2:** Memfilter formula di UI berdasarkan range, kolom, atau pola.
*   **FR-02.3:** Mengelompokkan formula berdasarkan pola yang sama di panel visual.

### FR-03 — Formula Tracing
*   **FR-03.1:** Endpoint API untuk menelusuri referensi langsung dan lintas-sheet.
*   **FR-03.2:** Menelusuri dependensi secara rekursif menggunakan *dependency graph* (NetworkX) di backend.
*   **FR-03.3:** Fitur UI untuk menemukan sel yang bergantung pada sel tertentu (*Trace Dependents*).
*   **FR-03.4:** Membatasi kedalaman penelusuran agar web browser tidak *freeze*, serta mendeteksi *circular references*.

### FR-04 — Formula Comparison
*   **FR-04.1:** Membandingkan formula antar-sheet dalam workbook yang sama atau antar-workbook melalui antarmuka web.
*   **FR-04.2:** Mendeteksi formula berbeda, formula hilang, dan sel baru.
*   **FR-04.3:** Menormalisasi formula berdasarkan pola referensi relatif di sisi backend.

### FR-05 — Validation & Audit
*   **FR-05.1:** Panel notifikasi UI untuk mendeteksi anomali formula dalam baris atau kolom.
*   **FR-05.2:** Deteksi referensi ke sheet atau workbook eksternal.
*   **FR-05.3:** Menandai (highlight) area di Luckysheet yang berisi *hardcoded values* di antara formula yang seragam.

## 7. Desain Sistem dan API Endpoints Utama

### 7.1 Workbook & Renderer API
*   `POST /api/workbook/upload`: Mengunggah file `.xlsx`. Mengembalikan `workbook_id` dan JSON struktur Luckysheet.
*   `GET /api/workbook/{id}/sheet/{name}`: Mengambil data dan struktur dimensi, baris, kolom secara spesifik untuk di-render.

### 7.2 Tracing API
*   `POST /api/trace/formula`: Endpoint untuk mengambil pohon *precedents* atau *dependents* dari sebuah sel. Input menerima `workbook_id`, `sheet_name`, koordinat `cell`, dan `direction`.
*   `POST /api/trace/graph`: Menghasilkan graf dependensi formula untuk digambar dengan pustaka diagram di React (misal React Flow) atau sebagai *overlay* panah di Luckysheet.

### 7.3 Comparison API
*   `POST /api/compare/sheets`: Mengirim ID *baseline* dan *target* beserta parameternya (mode perbandingan `normalized_formula` atau `exact_formula`, serta algoritma `alignment`). 
*   Output-nya dipetakan oleh React untuk mewarnai perbedaan di atas *grid* Luckysheet.

### 7.4 Audit API
*   `GET /api/audit/anomalies`: Mengembalikan *array of objects* dari anomali formula atau *hardcoded values* untuk ditampilkan sebagai lencana/ikon error di samping sel Luckysheet.

## 8. Arsitektur Teknis Web

```text
+-------------------------------------------------------+
|  FRONTEND (React JS)                                  |
|  - UI Layout, Sidebar, Modals                         |
|  - Excel Grid Renderer: Luckysheet                    |
|  - State Management: Redux / Zustand                  |
+-------------------------------------------------------+
                           ^
                           | HTTP / REST API (JSON)
                           v
+-------------------------------------------------------+
|  BACKEND (Python - misal: FastAPI)                    |
|  - Controller & API Routes                            |
|  - Luckysheet JSON Converter                          |
|  +-------------------------------------------------+  |
|  | Engine Analisis Excel                           |  |
|  | - Workbook Manager (openpyxl)                   |  |
|  | - Formula Parser (berbasis AST)                 |  |
|  | - Formula Tracer (NetworkX)                     |  |
|  | - Formula Comparator & Auditor                  |  |
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
```

### Rekomendasi Pustaka (Tech Stack)
*   **Frontend:** React JS, Luckysheet (untuk grid interaktif).
*   **Backend Framework:** FastAPI (direkomendasikan karena kecepatan dan dukungan asinkron).
*   **Excel Reader:** `openpyxl` untuk membaca file aslinya.
*   **Formula Parsing:** `formulas` atau `pycel` (dievaluasi berdasarkan cakupan sintaks).
*   **Dependency Graph:** `networkx` untuk fitur directed graph dan cycle detection.

## 9. Non-Functional Requirements

*   **Performance:** Python backend harus efisien memindai formula dengan menghindari pembacaan berulang. Transmisi data JSON besar ke Luckysheet disiasati dengan *pagination* atau *lazy-loading*.
*   **Reliability:** Backend harus sanggup mencegah *recursive traversal* tanpa batas pada saat tracing berjalan.
*   **Maintainability:** Logika *parser, tracer,* dan *comparator* dipisahkan dari layer API/Controller web.

## 10. Acceptance Criteria

Fitur web dinyatakan siap (MVP) apabila:
*   [ ] Pengguna dapat mengunggah file Excel, dan merendernya secara akurat pada antarmuka web Luckysheet tanpa error struktur.
*   [ ] Pengguna dapat memilih sel pada grid Luckysheet, dan menekan tombol *Trace Precedents/Dependents* yang kemudian menyorot sel sumbernya.
*   [ ] Tracing rekursif menghasilkan jalur dependensi secara visual dan berhenti dengan aman jika mendeteksi *circular reference*.
*   [ ] Pengguna dapat melihat visualisasi perbandingan antar-sheet; UI membedakan warna untuk formula yang berubah, sel yang hilang, dan sel baru.
*   [ ] Anomali formula dapat terdeteksi dan memunculkan *alert* atau highlight khusus di web.
*   [ ] Hasil analisis dan *tracing* tidak mengklaim sebagai nilai kalkulasi terbaru jika menggunakan *cached value*.

## 11. Roadmap Pengembangan Web

### Phase 1 — MVP: Web Upload, Render & Visual Tracing
*   Membangun API Backend (Python) untuk Parsing.
*   Mengonversi data struktur Excel (`openpyxl`) ke format Luckysheet.
*   Render UI interaktif menggunakan React + Luckysheet.
*   Fitur UI untuk membaca formula dan me-render *Trace precedents/dependents* dasar.

### Phase 2 — Interactive Comparison Dashboard
*   Dukungan membuka dua sheet berdampingan (*split-screen* UI).
*   *Exact formula diff* dan *Normalized formula diff* dengan indikator warna di grid Luckysheet.
*   *Structural alignment* perbandingan.

### Phase 3 — Audit & Validation Tooling
*   Panel *sidebar* untuk *Anomaly detection* dan deteksi *hardcoded values*.
*   Pembuatan *Formula catalog* dan fitur ekspor laporan audit.

### Phase 4 — Advanced Analytics & Editor (Opsional)
*   Memungkinkan perubahan asumsi langsung dari UI Luckysheet, lalu mengirim perintah ke *Recalculation engine* Python untuk analisis sensitivitas numerik.