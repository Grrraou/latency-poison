from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
import secrets

from database import get_db, User as DBUser, ConfigApiKey as DBConfigApiKey, UsageLog as DBUsageLog

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
if os.getenv("ENVIRONMENT") == "production" and SECRET_KEY == "your-secret-key-here":
    raise RuntimeError("Set SECRET_KEY in production")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# Allowed HTTP methods for config
ALLOWED_METHODS = frozenset({"ANY", "GET", "POST", "PUT", "DELETE", "PATCH"})

async def security_headers_middleware(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

app = FastAPI()

app.middleware("http")(security_headers_middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(",") if os.getenv("CORS_ORIGINS") else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# Models
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class User(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    disabled: Optional[bool] = None

class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-zA-Z0-9_.-]+$")
    email: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(None, max_length=255)

    @field_validator("email")
    @classmethod
    def email_format(cls, v: str) -> str:
        if not v or "@" not in v or len(v) > 255:
            raise ValueError("Invalid email")
        return v.strip().lower()

    @field_validator("username")
    @classmethod
    def username_strip(cls, v: str) -> str:
        return v.strip() if v else v

# Config API Key (one key -> one target URL + chaos)
def _validate_http_https(url: Optional[str]) -> Optional[str]:
    if not url or not url.strip():
        return None
    u = url.strip()
    if not u.startswith("http://") and not u.startswith("https://"):
        raise ValueError("target_url must be http or https")
    if len(u) > 2048:
        raise ValueError("target_url too long")
    return u

class ConfigApiKeyBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    target_url: Optional[str] = None
    fail_rate: int = Field(0, ge=0, le=100)
    min_latency: int = Field(0, ge=0, le=60000)
    max_latency: int = Field(0, ge=0, le=60000)
    method: str = "ANY"
    error_codes: List[int] = []

    @field_validator("target_url")
    @classmethod
    def target_url_http_https(cls, v: Optional[str]) -> Optional[str]:
        return _validate_http_https(v)

    @field_validator("method")
    @classmethod
    def method_allowed(cls, v: str) -> str:
        u = (v or "ANY").upper()
        if u not in ALLOWED_METHODS:
            raise ValueError("method must be one of: ANY, GET, POST, PUT, DELETE, PATCH")
        return u

    @field_validator("error_codes")
    @classmethod
    def error_codes_range(cls, v: List[int]) -> List[int]:
        if not v:
            return []
        for c in v:
            if not isinstance(c, int) or c < 100 or c > 599:
                raise ValueError("error_codes must be HTTP status codes 100-599")
        return sorted(set(v))

    @model_validator(mode="after")
    def latency_order(self):
        if self.min_latency > self.max_latency:
            raise ValueError("min_latency cannot be greater than max_latency")
        return self

class ConfigApiKeyCreate(ConfigApiKeyBase):
    pass

class ConfigApiKeyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    is_active: Optional[bool] = None
    target_url: Optional[str] = None
    fail_rate: Optional[int] = Field(None, ge=0, le=100)
    min_latency: Optional[int] = Field(None, ge=0, le=60000)
    max_latency: Optional[int] = Field(None, ge=0, le=60000)
    method: Optional[str] = None
    error_codes: Optional[List[int]] = None

    @field_validator("target_url")
    @classmethod
    def target_url_http_https(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return _validate_http_https(v)

    @field_validator("method")
    @classmethod
    def method_allowed(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        u = v.upper()
        if u not in ALLOWED_METHODS:
            raise ValueError("method must be one of: ANY, GET, POST, PUT, DELETE, PATCH")
        return u

    @field_validator("error_codes")
    @classmethod
    def error_codes_range(cls, v: Optional[List[int]]) -> Optional[List[int]]:
        if v is None or not v:
            return v
        for c in v:
            if not isinstance(c, int) or c < 100 or c > 599:
                raise ValueError("error_codes must be 100-599")
        return sorted(set(v))

class ConfigApiKeyResponse(ConfigApiKeyBase):
    id: int
    key: str
    is_active: bool
    created_at: datetime

    class Config:
        orm_mode = True

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_user(db: Session, username: str):
    return db.query(DBUser).filter(DBUser.username == username).first()

def authenticate_user(db: Session, username: str, password: str):
    user = get_user(db, username)
    if not user or not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user(db, username=username)
    if user is None:
        raise credentials_exception
    return user

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)

# Routes
@app.post("/api/auth/login")
async def login_for_access_token(body: LoginRequest, db: Session = Depends(get_db)):
    try:
        user = authenticate_user(db, body.username.strip(), body.password)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password", headers={"WWW-Authenticate": "Bearer"})
        access_token = create_access_token(data={"sub": user.username}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password", headers={"WWW-Authenticate": "Bearer"})

@app.post("/api/auth/register")
async def register_user(body: UserCreate, db: Session = Depends(get_db)):
    try:
        username = body.username.strip().lower()
        if db.query(DBUser).filter(DBUser.username == username).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")
        if db.query(DBUser).filter(DBUser.email == body.email).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        db_user = DBUser(
            username=username, email=body.email, full_name=body.full_name or None,
            hashed_password=pwd_context.hash(body.password), disabled=False
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return User(username=db_user.username, email=db_user.email, full_name=db_user.full_name, disabled=db_user.disabled)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request")

@app.get("/api/users/me", response_model=User)
async def read_users_me(current_user: DBUser = Depends(get_current_user)):
    return User(username=current_user.username, email=current_user.email, full_name=current_user.full_name, disabled=current_user.disabled)

@app.get("/")
async def root():
    return {"message": "Welcome to Latency Poison API"}


@app.get("/api/health")
async def health(db: Session = Depends(get_db)):
    """Server status: API up and DB connectivity."""
    from sqlalchemy import text
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ok", "service": "api"}


# Config API Keys
def generate_config_api_key():
    return f"lp_{secrets.token_urlsafe(32)}"

@app.post("/api/config-keys/", response_model=ConfigApiKeyResponse)
async def create_config_key(data: ConfigApiKeyCreate, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    db_key = DBConfigApiKey(
        name=data.name, key=generate_config_api_key(), is_active=True,
        target_url=(data.target_url or "").strip() or None,
        fail_rate=min(100, max(0, data.fail_rate)), min_latency=data.min_latency or 0, max_latency=data.max_latency or 0,
        method=(data.method or "ANY").upper(), error_codes=data.error_codes or [], owner_id=current_user.id
    )
    db.add(db_key)
    db.commit()
    db.refresh(db_key)
    return db_key

@app.get("/api/config-keys/", response_model=List[ConfigApiKeyResponse])
async def list_config_keys(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    return db.query(DBConfigApiKey).filter(DBConfigApiKey.owner_id == current_user.id).all()

@app.get("/api/config-keys/{key_id}/", response_model=ConfigApiKeyResponse)
async def get_config_key(key_id: int, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    k = db.query(DBConfigApiKey).filter(DBConfigApiKey.id == key_id, DBConfigApiKey.owner_id == current_user.id).first()
    if k is None:
        raise HTTPException(status_code=404, detail="Config key not found")
    return k

@app.put("/api/config-keys/{key_id}/", response_model=ConfigApiKeyResponse)
async def update_config_key(key_id: int, data: ConfigApiKeyUpdate, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    k = db.query(DBConfigApiKey).filter(DBConfigApiKey.id == key_id, DBConfigApiKey.owner_id == current_user.id).first()
    if k is None:
        raise HTTPException(status_code=404, detail="Config key not found")
    if data.name is not None:
        k.name = data.name
    if data.is_active is not None:
        k.is_active = data.is_active
    if data.target_url is not None:
        k.target_url = data.target_url.strip() or None
    if data.fail_rate is not None:
        k.fail_rate = min(100, max(0, data.fail_rate))
    if data.min_latency is not None:
        k.min_latency = data.min_latency
    if data.max_latency is not None:
        k.max_latency = data.max_latency
    if data.method is not None:
        k.method = data.method.upper()
    if data.error_codes is not None:
        k.error_codes = data.error_codes
    if k.min_latency > k.max_latency:
        raise HTTPException(status_code=400, detail="min_latency cannot be greater than max_latency")
    db.commit()
    db.refresh(k)
    return k

@app.delete("/api/config-keys/{key_id}/")
async def delete_config_key(key_id: int, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    k = db.query(DBConfigApiKey).filter(DBConfigApiKey.id == key_id, DBConfigApiKey.owner_id == current_user.id).first()
    if k is None:
        raise HTTPException(status_code=404, detail="Config key not found")
    db.delete(k)
    db.commit()
    return {"message": "Config key deleted"}


# Usage summary (raw counts for debugging empty chart)
@app.get("/api/usage/summary")
async def usage_summary(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user),
):
    from sqlalchemy import text
    try:
        r = db.execute(
            text("""
                SELECT COUNT(*) FROM usage_log u
                INNER JOIN config_api_keys c ON c.id = u.config_api_key_id AND c.owner_id = :owner_id
            """),
            {"owner_id": current_user.id},
        ).fetchone()
        total = int(r[0]) if r and r[0] is not None else 0
    except Exception:
        return {"total_requests": 0, "by_key": [], "error": "usage_log table may be missing. Run: make init-db"}

    keys = db.query(DBConfigApiKey).filter(DBConfigApiKey.owner_id == current_user.id).order_by(DBConfigApiKey.id).all()
    by_key = []
    for k in keys:
        try:
            r = db.execute(
                text("SELECT COUNT(*) FROM usage_log WHERE config_api_key_id = :kid"),
                {"kid": k.id},
            ).fetchone()
            cnt = int(r[0]) if r and r[0] is not None else 0
        except Exception:
            cnt = 0
        by_key.append({"key_id": k.id, "key_name": k.name or f"Key {k.id}", "count": cnt})
    return {"total_requests": total, "by_key": by_key}


# Usage timeline (aggregated by hour/day/month)
@app.get("/api/usage/timeline")
async def usage_timeline(
    group_by: str = "day",
    period: str = "30d",
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user),
):
    from sqlalchemy import text
    if group_by not in ("hour", "day", "month"):
        raise HTTPException(status_code=400, detail="group_by must be hour, day, or month")
    if period not in ("7d", "30d"):
        raise HTTPException(status_code=400, detail="period must be 7d or 30d")
    days = 7 if period == "7d" else 30
    if group_by == "hour" and period == "30d":
        raise HTTPException(status_code=400, detail="hour grouping only allowed with period=7d")
    date_from = datetime.utcnow() - timedelta(days=days)

    # MySQL date format for grouping
    fmt = {"hour": "%Y-%m-%d %H:00", "day": "%Y-%m-%d", "month": "%Y-%m"}[group_by]
    bucket_col = f"DATE_FORMAT(u.requested_at, '{fmt}')"

    keys = db.query(DBConfigApiKey).filter(DBConfigApiKey.owner_id == current_user.id).order_by(DBConfigApiKey.id).all()
    key_ids = [k.id for k in keys]

    # Build ordered list of bucket labels for the range
    labels = []
    if group_by == "hour":
        cur = date_from
        while cur <= datetime.utcnow():
            labels.append(cur.strftime("%Y-%m-%d %H:00"))
            cur += timedelta(hours=1)
    elif group_by == "day":
        cur = date_from.date()
        end = datetime.utcnow().date()
        while cur <= end:
            labels.append(cur.strftime("%Y-%m-%d"))
            cur += timedelta(days=1)
    else:
        cur = date_from.replace(day=1)
        end = datetime.utcnow()
        while cur <= end:
            labels.append(cur.strftime("%Y-%m"))
            if cur.month == 12:
                cur = cur.replace(year=cur.year + 1, month=1)
            else:
                cur = cur.replace(month=cur.month + 1)

    # Raw query: count per (config_api_key_id, bucket) for user's keys
    # MySQL: GROUP BY bucket, config_api_key_id
    series = []
    for k in keys:
        counts_by_bucket = {lb: 0 for lb in labels}
        if key_ids:
            q = text(f"""
                SELECT {bucket_col} AS bucket, u.config_api_key_id, COUNT(*) AS cnt
                FROM usage_log u
                INNER JOIN config_api_keys c ON c.id = u.config_api_key_id AND c.owner_id = :owner_id
                WHERE u.config_api_key_id = :key_id AND u.requested_at >= :date_from
                GROUP BY bucket, u.config_api_key_id
            """)
            rows = db.execute(q, {"owner_id": current_user.id, "key_id": k.id, "date_from": date_from}).fetchall()
            for row in rows:
                # Normalize bucket to string so it matches label keys (MySQL may return datetime/bytes)
                bucket = (str(row[0]).strip() if row[0] is not None else None)
                if bucket and bucket in counts_by_bucket:
                    counts_by_bucket[bucket] = row[2]
        counts = [counts_by_bucket[lb] for lb in labels]
        series.append({"key_id": k.id, "key_name": k.name or f"Key {k.id}", "counts": counts})

    return {"group_by": group_by, "period": period, "labels": labels, "series": series}
