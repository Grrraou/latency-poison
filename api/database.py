from sqlalchemy import create_engine, Column, Integer, String, Boolean, ForeignKey, JSON, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from typing import Optional
import os

# MySQL connection URL
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://latencypoison:latencypoison@localhost:3306/latencypoison"
)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(255), unique=True, index=True)
    email = Column(String(255), unique=True, index=True)
    full_name = Column(String(255))
    hashed_password = Column(String(255))
    disabled = Column(Boolean, default=False)
    # Billing: free | trial | starter | pro
    plan = Column(String(32), default="free", nullable=False)
    trial_ends_at = Column(DateTime, nullable=True)
    stripe_customer_id = Column(String(255), nullable=True, index=True)
    stripe_subscription_id = Column(String(255), nullable=True, index=True)
    # Invoicing address (required for invoices under French law)
    billing_first_name = Column(String(255), nullable=True)
    billing_last_name = Column(String(255), nullable=True)
    billing_company = Column(String(255), nullable=True)
    billing_address_line1 = Column(String(255), nullable=True)
    billing_address_line2 = Column(String(255), nullable=True)
    billing_postal_code = Column(String(32), nullable=True)
    billing_city = Column(String(255), nullable=True)
    billing_country = Column(String(2), nullable=True)  # ISO 3166-1 alpha-2 (e.g. FR)
    # Email verification (registration + change email)
    email_verified = Column(Boolean, default=False, nullable=False)
    pending_email = Column(String(255), nullable=True)  # new email until verified
    verification_token = Column(String(255), nullable=True, index=True)
    verification_token_expires = Column(DateTime, nullable=True)
    config_api_keys = relationship("ConfigApiKey", back_populates="owner", cascade="all, delete-orphan")


class ConfigApiKey(Base):
    """One API key -> one target URL + chaos options. Call https://proxy:port/{key} to forward to target_url."""
    __tablename__ = "config_api_keys"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), index=True)
    key = Column(String(255), unique=True, index=True)
    is_active = Column(Boolean, default=True)
    target_url = Column(Text)
    fail_rate = Column(Integer, default=0)
    min_latency = Column(Integer, default=0)
    max_latency = Column(Integer, default=0)
    method = Column(String(20), default="ANY")
    error_codes = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete='CASCADE'))
    owner = relationship("User", back_populates="config_api_keys")


class UsageLog(Base):
    __tablename__ = "usage_log"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    config_api_key_id = Column(Integer, ForeignKey("config_api_keys.id", ondelete="CASCADE"), index=True)
    requested_at = Column(DateTime, nullable=False, index=True)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
