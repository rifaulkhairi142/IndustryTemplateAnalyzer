#!/usr/bin/env python
"""
Database Migration CLI for Excel Analyst.
Usage:
    python migrate.py           # Apply all pending migrations (up)
    python migrate.py status    # Check migration status
"""
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from backend.migrations.runner import run_migrations, show_status

if __name__ == "__main__":
    action = sys.argv[1].lower() if len(sys.argv) > 1 else "up"
    if action in ("status", "--status", "-s"):
        show_status()
    elif action in ("up", "migrate", "--migrate"):
        run_migrations()
    else:
        print("Usage: python migrate.py [up|status]")
        print("  up      : Menjalankan semua migrasi yang belum diterapkan (default)")
        print("  status  : Memeriksa status migrasi dan schema saat ini")
        sys.exit(1)
