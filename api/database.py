from sqlalchemy import create_engine, Column, Integer, String, Boolean, ForeignKey, JSON, DateTime, Table, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

# MySQL connection URL
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "mysql+pymysql://latencypoison:latencypoison@localhost:3306/latencypoison"
)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,  # Enable connection health checks
    pool_recycle=3600,   # Recycle connections after 1 hour
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Association table for ApiKey <-> Collection many-to-many relationship
apikey_collections = Table(
    'apikey_collections',
    Base.metadata,
    Column('apikey_id', Integer, ForeignKey('api_keys.id', ondelete='CASCADE'), primary_key=True),
    Column('collection_id', Integer, ForeignKey('collections.id', ondelete='CASCADE'), primary_key=True)
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(255), unique=True, index=True)
    email = Column(String(255), unique=True, index=True)
    full_name = Column(String(255))
    hashed_password = Column(String(255))
    disabled = Column(Boolean, default=False)
    collections = relationship("Collection", back_populates="owner", cascade="all, delete-orphan")
    api_keys = relationship("ApiKey", back_populates="owner", cascade="all, delete-orphan")

class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), index=True)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    request_count = Column(Integer, default=0)  # Usage counter - incremented by Go API
    owner_id = Column(Integer, ForeignKey("users.id", ondelete='CASCADE'))
    owner = relationship("User", back_populates="collections")
    endpoints = relationship("Endpoint", back_populates="collection", cascade="all, delete-orphan")
    api_keys = relationship("ApiKey", secondary=apikey_collections, back_populates="collections")

class Endpoint(Base):
    __tablename__ = "endpoints"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), index=True)
    url = Column(Text)
    method = Column(String(50))
    headers = Column(JSON)
    body = Column(JSON)
    collection_id = Column(Integer, ForeignKey("collections.id", ondelete='CASCADE'))
    collection = relationship("Collection", back_populates="endpoints")
    fail_rate = Column(Integer, default=0)
    min_latency = Column(Integer, default=0)
    max_latency = Column(Integer, default=1000)
    sandbox = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    request_count = Column(Integer, default=0)  # Usage counter - incremented by Go API

class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), index=True)
    key = Column(String(255), unique=True, index=True)
    is_active = Column(Boolean, default=True)
    all_collections = Column(Boolean, default=False)  # If true, grants access to all collections
    request_count = Column(Integer, default=0)  # Usage counter - incremented by Go API
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete='CASCADE'))
    owner = relationship("User", back_populates="api_keys")
    collections = relationship("Collection", secondary=apikey_collections, back_populates="api_keys")

# Create tables
Base.metadata.create_all(bind=engine)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
