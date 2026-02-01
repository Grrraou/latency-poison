#!/usr/bin/env python3
"""
Add billing/invoicing address columns to users table (required for French law).
Run once against your existing database: python migrate_billing_address.py
Or with Docker: docker compose run --rm api python migrate_billing_address.py
"""

from database import SessionLocal
from sqlalchemy import text

BILLING_COLUMNS = [
    ("billing_company", "VARCHAR(255) NULL"),
    ("billing_address_line1", "VARCHAR(255) NULL"),
    ("billing_address_line2", "VARCHAR(255) NULL"),
    ("billing_postal_code", "VARCHAR(32) NULL"),
    ("billing_city", "VARCHAR(255) NULL"),
    ("billing_country", "VARCHAR(2) NULL"),
]

def migrate():
    db = SessionLocal()
    try:
        for col, spec in BILLING_COLUMNS:
            try:
                db.execute(text(f"ALTER TABLE users ADD COLUMN {col} {spec}"))
                db.commit()
                print(f"Added column: {col}")
            except Exception as e:
                db.rollback()
                if "Duplicate column" in str(e) or "1060" in str(e):
                    print(f"Column {col} already exists, skipping")
                else:
                    raise
        print("Migration complete.")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
