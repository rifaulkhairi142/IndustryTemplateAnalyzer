import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

# Load environment variables from project root (.env) and backend (.env)
load_dotenv(ROOT_DIR / ".env")
load_dotenv(BASE_DIR / ".env")

UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
SAMPLES_DIR = BASE_DIR / "samples"
SAMPLES_DIR.mkdir(parents=True, exist_ok=True)

# PostgreSQL Configuration
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "excel_analyst")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
# Schema is customizable and defaults to a non-public schema
DB_SCHEMA = os.getenv("DB_SCHEMA", "excel_schema")
DATABASE_URL = os.getenv("DATABASE_URL", None)

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*"
]

