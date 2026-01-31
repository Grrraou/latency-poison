from database import SessionLocal, User, Base, engine, ConfigApiKey, UsageLog
from passlib.context import CryptContext
from sqlalchemy import text
import os
import secrets

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
ADMIN_FULL_NAME = os.getenv("ADMIN_FULL_NAME", "Administrator")
DEFAULT_API_KEY = os.getenv("DEFAULT_API_KEY", "lp_default_admin_key_change_in_production")

def run_migrations(db):
    """Add config_api_keys columns if missing; ensure usage_log exists for proxy usage tracking."""
    for col, spec in [
        ("target_url", "TEXT"),
        ("fail_rate", "INT DEFAULT 0"),
        ("min_latency", "INT DEFAULT 0"),
        ("max_latency", "INT DEFAULT 0"),
        ("method", "VARCHAR(20) DEFAULT 'ANY'"),
        ("error_codes", "JSON"),
    ]:
        try:
            db.execute(text(f"ALTER TABLE config_api_keys ADD COLUMN {col} {spec}"))
            db.commit()
            print(f"Added column {col} to config_api_keys")
        except Exception:
            db.rollback()
    # Ensure usage_log exists (proxy writes here for dashboard timeline)
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS usage_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                config_api_key_id INT NOT NULL,
                requested_at DATETIME NOT NULL,
                INDEX (config_api_key_id),
                INDEX (requested_at),
                FOREIGN KEY (config_api_key_id) REFERENCES config_api_keys(id) ON DELETE CASCADE
            )
        """))
        db.commit()
        print("Ensured usage_log table exists")
    except Exception as e:
        db.rollback()
        print("Note: usage_log creation:", e)
    Base.metadata.create_all(bind=engine)
    print("Migrations completed")

def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    run_migrations(db)
    try:
        admin_user = db.query(User).filter(User.username == ADMIN_USERNAME).first()
        if not admin_user:
            admin_user = User(
                username=ADMIN_USERNAME,
                email=ADMIN_EMAIL,
                full_name=ADMIN_FULL_NAME,
                hashed_password=pwd_context.hash(ADMIN_PASSWORD),
                disabled=False,
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            print("Admin user created:", ADMIN_USERNAME, "/", ADMIN_PASSWORD)
        # Ensure default config key for admin
        if not db.query(ConfigApiKey).filter(ConfigApiKey.owner_id == admin_user.id).first():
            ck = ConfigApiKey(
                name="Default Config Key",
                key=DEFAULT_API_KEY,
                is_active=True,
                target_url="https://api.github.com",
                fail_rate=10,
                min_latency=100,
                max_latency=500,
                method="ANY",
                error_codes=[500, 503],
                owner_id=admin_user.id,
            )
            db.add(ck)
            db.commit()
            print("Default config key created:", ck.key, "->", ck.target_url)
    except Exception as e:
        print("Error:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
