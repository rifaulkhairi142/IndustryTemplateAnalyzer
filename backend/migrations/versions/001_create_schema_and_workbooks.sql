-- Migration: 001_create_schema_and_workbooks.sql
-- Description: Inisialisasi custom schema non-public dan tabel penyimpanan workbook yang diupload

-- 1. Buat custom schema non-public jika belum ada
CREATE SCHEMA IF NOT EXISTS "{schema}";

-- 2. Buat tabel uploaded_workbooks di dalam custom schema
CREATE TABLE IF NOT EXISTS "{schema}".uploaded_workbooks (
    workbook_id VARCHAR(64) PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    filepath TEXT NOT NULL,
    total_formulas INT DEFAULT 0,
    sheets_meta JSONB,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Buat index pada kolom uploaded_at untuk query sorting cepat
CREATE INDEX IF NOT EXISTS idx_uploaded_workbooks_uploaded_at 
    ON "{schema}".uploaded_workbooks (uploaded_at DESC);
