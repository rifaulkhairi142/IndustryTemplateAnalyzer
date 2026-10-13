import os
import re
import sys
from pathlib import Path
from datetime import datetime
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

# Ensure root directory .env is loaded
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

# Database Configuration from environment variables
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "myapp")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_SCHEMA = os.getenv("DB_SCHEMA", "formula_intelligence")
DATABASE_URL = os.getenv("DATABASE_URL", None)

VERSIONS_DIR = Path(__file__).resolve().parent / "versions"

def sanitize_identifier(name: str) -> str:
    """Sanitize SQL identifiers like schema or table names to prevent injection."""
    clean = re.sub(r'[^a-zA-Z0-9_]', '_', (name or "formula_intelligence").strip())
    return clean or "formula_intelligence"

SCHEMA_NAME = sanitize_identifier(DB_SCHEMA)

def get_connection():
    """Create a connection to PostgreSQL."""
    if DATABASE_URL:
        return psycopg2.connect(DATABASE_URL)
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        connect_timeout=10
    )

def ensure_migration_table(conn):
    """Ensure the target schema and migration tracking table exist."""
    with conn.cursor() as cur:
        # Create schema if not exists
        cur.execute(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA_NAME}";')
        # Create migration tracking table in the custom schema
        cur.execute(f'''
            CREATE TABLE IF NOT EXISTS "{SCHEMA_NAME}"."_schema_migrations" (
                version VARCHAR(100) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        ''')
    conn.commit()

def get_applied_migrations(conn) -> set:
    """Get list of already applied migration version strings."""
    with conn.cursor() as cur:
        cur.execute(f'SELECT version FROM "{SCHEMA_NAME}"."_schema_migrations" ORDER BY version ASC;')
        rows = cur.fetchall()
        return {r[0] for r in rows}

def get_migration_files() -> list:
    """Get sorted list of migration .sql files."""
    if not VERSIONS_DIR.exists():
        return []
    files = list(VERSIONS_DIR.glob("*.sql"))
    files.sort(key=lambda f: f.name)
    return files

def show_status():
    """Display migration status."""
    print("=" * 60)
    print(" [DATABASE MIGRATION STATUS]")
    print("=" * 60)
    print(f" Host           : {DB_HOST}:{DB_PORT}")
    print(f" Database       : {DB_NAME}")
    print(f" User           : {DB_USER}")
    print(f" Target Schema  : \"{SCHEMA_NAME}\" (Non-public)")
    print("-" * 60)

    try:
        conn = get_connection()
        ensure_migration_table(conn)
        applied = get_applied_migrations(conn)
        files = get_migration_files()

        if not files:
            print(" No migration files found in backend/migrations/versions/")
            conn.close()
            return

        print(f" Total files: {len(files)} | Applied: {len(applied)} | Pending: {len(files) - len(applied)}\n")
        print(f" {'STATUS':<10} {'VERSION':<12} {'FILENAME'}")
        print(f" {'-'*8:<10} {'-'*10:<12} {'-'*35}")

        for f in files:
            version = f.name.split("_")[0]
            if version in applied:
                print(f" [APPLIED]   {version:<12} {f.name}")
            else:
                print(f" [PENDING]   {version:<12} {f.name}")

        conn.close()
        print("=" * 60)
    except Exception as e:
        print(f"[ERROR] Error connecting to database: {e}")
        sys.exit(1)

def run_migrations():
    """Apply all pending migrations."""
    print("=" * 60)
    print(" [RUNNING DATABASE MIGRATIONS]")
    print("=" * 60)
    print(f" Host           : {DB_HOST}:{DB_PORT}")
    print(f" Database       : {DB_NAME}")
    print(f" Target Schema  : \"{SCHEMA_NAME}\" (Non-public)")
    print("-" * 60)

    try:
        conn = get_connection()
        ensure_migration_table(conn)
        applied = get_applied_migrations(conn)
        files = get_migration_files()

        pending = [f for f in files if f.name.split("_")[0] not in applied]

        if not pending:
            print(" Database is already up to date! No pending migrations.")
            conn.close()
            return

        print(f" Found {len(pending)} pending migration(s) to apply:\n")

        for f in pending:
            version = f.name.split("_")[0]
            print(f" Applying migration: {f.name} ... ", end="", flush=True)

            with open(f, "r", encoding="utf-8") as sql_file:
                sql_content = sql_file.read()

            # Substitute {schema} with actual target schema
            sql_content = sql_content.replace("{schema}", SCHEMA_NAME)

            try:
                with conn.cursor() as cur:
                    cur.execute(sql_content)
                    cur.execute(f'''
                        INSERT INTO "{SCHEMA_NAME}"."_schema_migrations" (version, name, applied_at)
                        VALUES (%s, %s, CURRENT_TIMESTAMP);
                    ''', (version, f.name))
                conn.commit()
                print("OK")
            except Exception as err:
                conn.rollback()
                print("FAILED")
                print(f"\nMigration error in {f.name}:\n{err}")
                conn.close()
                sys.exit(1)

        conn.close()
        print("-" * 60)
        print(" All migrations applied successfully!")
        print("=" * 60)
    except Exception as e:
        print(f"[ERROR] Connection or Execution error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    action = sys.argv[1].lower() if len(sys.argv) > 1 else "up"
    if action in ("status", "--status", "-s"):
        show_status()
    elif action in ("up", "migrate", "--migrate"):
        run_migrations()
    else:
        print(f"Usage: python runner.py [up|status]")
        sys.exit(1)
