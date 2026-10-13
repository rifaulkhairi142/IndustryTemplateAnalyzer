import json
import logging
import re
from typing import List, Dict, Any, Optional
from datetime import datetime
import psycopg2
from psycopg2 import sql
from psycopg2.extras import RealDictCursor
from backend.app.config import (
    DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SCHEMA, DATABASE_URL
)

logger = logging.getLogger(__name__)

class DatabaseService:
    """
    Database Service for runtime application operations.
    DDL migrations (CREATE SCHEMA, CREATE TABLE, ALTER TABLE) are completely decoupled 
    and managed separately via 'python migrate.py'.
    """
    def __init__(self):
        self.host = DB_HOST
        self.port = DB_PORT
        self.dbname = DB_NAME
        self.user = DB_USER
        self.password = DB_PASSWORD
        self.schema = self._sanitize_identifier(DB_SCHEMA or "formula_intelligence")
        self.database_url = DATABASE_URL
        self.is_connected = False
        self.is_migrated = False
        self.last_error: Optional[str] = None

    def _sanitize_identifier(self, name: str) -> str:
        """Sanitize SQL identifiers like schema or table names to prevent injection."""
        clean = re.sub(r'[^a-zA-Z0-9_]', '_', (name or "formula_intelligence").strip())
        return clean or "formula_intelligence"

    def _get_connection(self):
        """Create a new PostgreSQL connection with proper schema search_path."""
        if self.database_url:
            conn = psycopg2.connect(
                self.database_url,
                options=f"-c search_path={self.schema},public",
                connect_timeout=5
            )
        else:
            conn = psycopg2.connect(
                host=self.host,
                port=self.port,
                dbname=self.dbname,
                user=self.user,
                password=self.password,
                options=f"-c search_path={self.schema},public",
                connect_timeout=5
            )
        return conn

    def check_connection(self) -> bool:
        """
        Verify database connection and check whether migrations have been applied.
        Does NOT execute any DDL. DDL is handled via standalone migration runner.
        """
        try:
            conn = self._get_connection()
            with conn:
                with conn.cursor() as cur:
                    # Check if the uploaded_workbooks table exists in our schema
                    cur.execute("""
                        SELECT EXISTS (
                            SELECT 1 
                            FROM information_schema.tables 
                            WHERE table_schema = %s 
                              AND table_name = 'uploaded_workbooks'
                        );
                    """, (self.schema,))
                    table_exists = cur.fetchone()[0]

            conn.close()
            self.is_connected = True
            self.is_migrated = table_exists

            if not table_exists:
                self.last_error = f"Schema atau tabel '{self.schema}.uploaded_workbooks' belum dimigrasi. Jalankan 'python migrate.py'."
                print(f"[DB Warning] {self.last_error}")
            else:
                self.last_error = None
                print(f"[DB] Terhubung ke PostgreSQL ({self.host}:{self.port}/{self.dbname}) | Schema: '{self.schema}' (Migrasi OK)")

            return self.is_connected and self.is_migrated
        except Exception as e:
            self.is_connected = False
            self.is_migrated = False
            self.last_error = str(e)
            logger.warning(f"[DB Connection Error] {e}")
            print(f"[DB Warning] Gagal terhubung ke PostgreSQL ({self.host}:{self.port}/{self.dbname}): {e}")
            return False

    def ensure_ready(self) -> bool:
        """Ensure connection is healthy and migration is present."""
        if self.is_connected and self.is_migrated:
            return True
        return self.check_connection()

    def ensure_connected(self) -> bool:
        """Alias for ensure_ready."""
        return self.ensure_ready()


    def save_workbook(
        self,
        workbook_id: str,
        filename: str,
        filepath: str,
        total_formulas: int,
        sheets_meta: List[Any]
    ) -> bool:
        """Save or update workbook record in PostgreSQL."""
        if not self.ensure_ready():
            return False

        try:
            # Serialize sheets_meta
            if sheets_meta and hasattr(sheets_meta[0], "model_dump"):
                meta_json = json.dumps([s.model_dump() for s in sheets_meta])
            elif sheets_meta and hasattr(sheets_meta[0], "dict"):
                meta_json = json.dumps([s.dict() for s in sheets_meta])
            elif isinstance(sheets_meta, list):
                meta_json = json.dumps(sheets_meta, default=str)
            else:
                meta_json = json.dumps([])

            query = sql.SQL("""
                INSERT INTO {}.uploaded_workbooks 
                    (workbook_id, filename, filepath, total_formulas, sheets_meta, uploaded_at)
                VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (workbook_id) DO UPDATE SET
                    filename = EXCLUDED.filename,
                    filepath = EXCLUDED.filepath,
                    total_formulas = EXCLUDED.total_formulas,
                    sheets_meta = EXCLUDED.sheets_meta,
                    uploaded_at = EXCLUDED.uploaded_at;
            """).format(sql.Identifier(self.schema))

            conn = self._get_connection()
            with conn:
                with conn.cursor() as cur:
                    cur.execute(query, (workbook_id, filename, filepath, total_formulas, meta_json))
            conn.close()
            logger.info(f"[DB] Saved workbook '{workbook_id}' ({filename}) to PostgreSQL schema '{self.schema}'")
            return True
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"[DB Error] Failed to save workbook {workbook_id}: {e}")
            return False

    def get_all_workbooks(self) -> List[Dict[str, Any]]:
        """Retrieve all uploaded workbooks from PostgreSQL ordered by uploaded_at DESC."""
        if not self.ensure_ready():
            return []

        try:
            query = sql.SQL("""
                SELECT workbook_id, filename, filepath, total_formulas, sheets_meta, uploaded_at
                FROM {}.uploaded_workbooks
                ORDER BY uploaded_at DESC;
            """).format(sql.Identifier(self.schema))

            conn = self._get_connection()
            with conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query)
                    rows = cur.fetchall()
            conn.close()

            results = []
            for row in rows:
                sheets_meta = row.get("sheets_meta")
                if isinstance(sheets_meta, str):
                    try:
                        sheets_meta = json.loads(sheets_meta)
                    except Exception:
                        sheets_meta = []
                elif not sheets_meta:
                    sheets_meta = []

                results.append({
                    "workbook_id": row["workbook_id"],
                    "filename": row["filename"],
                    "filepath": row["filepath"],
                    "total_formulas": row.get("total_formulas", 0),
                    "sheets_meta": sheets_meta,
                    "uploaded_at": row.get("uploaded_at").isoformat() if row.get("uploaded_at") else None
                })
            return results
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"[DB Error] Failed to fetch workbooks: {e}")
            return []

    def get_workbook(self, workbook_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve single workbook record from PostgreSQL."""
        if not self.ensure_ready():
            return None

        try:
            query = sql.SQL("""
                SELECT workbook_id, filename, filepath, total_formulas, sheets_meta, uploaded_at
                FROM {}.uploaded_workbooks
                WHERE workbook_id = %s;
            """).format(sql.Identifier(self.schema))

            conn = self._get_connection()
            with conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query, (workbook_id,))
                    row = cur.fetchone()
            conn.close()

            if not row:
                return None

            sheets_meta = row.get("sheets_meta")
            if isinstance(sheets_meta, str):
                try:
                    sheets_meta = json.loads(sheets_meta)
                except Exception:
                    sheets_meta = []
            elif not sheets_meta:
                sheets_meta = []

            return {
                "workbook_id": row["workbook_id"],
                "filename": row["filename"],
                "filepath": row["filepath"],
                "total_formulas": row.get("total_formulas", 0),
                "sheets_meta": sheets_meta,
                "uploaded_at": row.get("uploaded_at").isoformat() if row.get("uploaded_at") else None
            }
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"[DB Error] Failed to fetch workbook {workbook_id}: {e}")
            return None

    def delete_workbook(self, workbook_id: str) -> bool:
        """Delete workbook record from PostgreSQL."""
        if not self.ensure_ready():
            return False

        try:
            query = sql.SQL("""
                DELETE FROM {}.uploaded_workbooks
                WHERE workbook_id = %s;
            """).format(sql.Identifier(self.schema))

            conn = self._get_connection()
            with conn:
                with conn.cursor() as cur:
                    cur.execute(query, (workbook_id,))
            conn.close()
            return True
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"[DB Error] Failed to delete workbook {workbook_id}: {e}")
            return False

    def get_status(self) -> Dict[str, Any]:
        """Return current database connection and migration status."""
        is_ready = self.ensure_ready()
        total_records = 0
        if is_ready:
            try:
                query = sql.SQL("SELECT COUNT(*) as cnt FROM {}.uploaded_workbooks;").format(
                    sql.Identifier(self.schema)
                )
                conn = self._get_connection()
                with conn:
                    with conn.cursor() as cur:
                        cur.execute(query)
                        total_records = cur.fetchone()[0]
                conn.close()
            except Exception as e:
                self.last_error = str(e)

        return {
            "connected": self.is_connected,
            "migrated": self.is_migrated,
            "host": self.host,
            "port": self.port,
            "database": self.dbname,
            "user": self.user,
            "schema": self.schema,
            "is_public_schema": self.schema.lower() == "public",
            "total_records": total_records,
            "last_error": self.last_error
        }

db_service = DatabaseService()
