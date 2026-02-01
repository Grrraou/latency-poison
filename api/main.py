from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List
from datetime import datetime, timedelta
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
from passlib.context import CryptContext
import os
import re
import secrets

import stripe
from database import get_db, User as DBUser, ConfigApiKey as DBConfigApiKey, UsageLog as DBUsageLog
from billing import (
    PLAN_LIMITS,
    get_effective_plan,
    get_requests_this_month,
    get_keys_limit,
    get_requests_limit,
)

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

class UserMe(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    disabled: Optional[bool] = None
    plan: str = "free"
    trial_ends_at: Optional[datetime] = None
    has_active_subscription: bool = False


class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(None, max_length=255)

    @field_validator("username")
    @classmethod
    def username_format(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Username is required")
        if not re.match(r"^[a-zA-Z0-9_.-]+$", v):
            raise ValueError("Username can only contain letters, numbers, and _ . - (no spaces or @)")
        return v.lower()

    @field_validator("email")
    @classmethod
    def email_format(cls, v: str) -> str:
        if not v or "@" not in v or len(v) > 255:
            raise ValueError("Invalid email")
        return v.strip().lower()

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
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
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

@app.get("/api/users/me", response_model=UserMe)
async def read_users_me(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    plan = get_effective_plan(current_user)
    has_sub = bool(getattr(current_user, "stripe_subscription_id", None))
    return UserMe(
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        disabled=current_user.disabled,
        plan=plan,
        trial_ends_at=getattr(current_user, "trial_ends_at", None),
        has_active_subscription=has_sub,
    )

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
    plan = get_effective_plan(current_user)
    key_count = db.query(DBConfigApiKey).filter(DBConfigApiKey.owner_id == current_user.id).count()
    if key_count >= get_keys_limit(plan):
        raise HTTPException(
            status_code=403,
            detail=f"Plan limit reached: {get_keys_limit(plan)} config keys. Upgrade to add more.",
        )
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


def _format_stripe_price(price_obj) -> str:
    """Format Stripe Price for display (e.g. '12.00 €/month')."""
    unit_amount = getattr(price_obj, "unit_amount", None) or 0
    amount = unit_amount / 100
    currency = (getattr(price_obj, "currency", None) or "eur").upper()
    symbol = "€" if currency == "EUR" else " " + currency
    interval = "month"
    recurring = getattr(price_obj, "recurring", None)
    if recurring:
        interval = getattr(recurring, "interval", None) or interval
    return f"{amount:.2f}{symbol}/{interval}"


# Public plans (prices fetched from Stripe by price_id)
@app.get("/api/billing/plans")
async def billing_plans():
    if STRIPE_SECRET_KEY == "localhost" or not STRIPE_SECRET_KEY:
        return {"plans": []}
    plan_defs = [
        ("starter", "Starter", 10, 50000, STRIPE_STARTER_PRICE_ID),
        ("pro", "Pro", 50, 500000, STRIPE_PRO_PRICE_ID),
    ]
    plans = []
    client = stripe.StripeClient(STRIPE_SECRET_KEY)
    for plan_id, name, keys, requests_per_month, price_id in plan_defs:
        if not price_id or not price_id.startswith("price_"):
            continue
        try:
            price_obj = client.prices.retrieve(price_id)
            price_display = _format_stripe_price(price_obj)
            plans.append({
                "id": plan_id,
                "name": name,
                "keys": keys,
                "requests_per_month": requests_per_month,
                "price_display": price_display,
                "price_id": price_id,
            })
        except Exception:
            continue
    return {"plans": plans}


# Sync plan from Stripe (call after checkout success; updates DB from Stripe subscriptions)
@app.post("/api/billing/sync")
async def billing_sync(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    if STRIPE_SECRET_KEY == "localhost" or not STRIPE_SECRET_KEY:
        return {"plan": get_effective_plan(current_user), "synced": False}
    cid = getattr(current_user, "stripe_customer_id", None)
    if not cid:
        return {"plan": "free", "synced": True}
    client = stripe.StripeClient(STRIPE_SECRET_KEY)
    try:
        for status in ("active", "trialing"):
            subs = client.subscriptions.list(params={"customer": cid, "status": status, "limit": 1})
            if not subs.data:
                continue
            sub = subs.data[0]
            price_id = ""
            items_resp = client.subscription_items.list(params={"subscription": sub.id})
            if items_resp.data:
                price_obj = getattr(items_resp.data[0], "price", None)
                price_id = getattr(price_obj, "id", None) or ""
            plan = "pro" if price_id == STRIPE_PRO_PRICE_ID else "starter"
            current_user.stripe_subscription_id = sub.id
            current_user.plan = plan
            db.commit()
            db.refresh(current_user)
            return {"plan": plan, "synced": True}
        current_user.stripe_subscription_id = None
        current_user.plan = "free"
        db.commit()
        db.refresh(current_user)
    except stripe.StripeError:
        return {"plan": get_effective_plan(current_user), "synced": False}
    except Exception:
        return {"plan": get_effective_plan(current_user), "synced": False}
    return {"plan": get_effective_plan(current_user), "synced": True}


# Billing usage (keys + requests this month)
@app.get("/api/billing/usage")
async def billing_usage(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    plan = get_effective_plan(current_user)
    keys_used = db.query(DBConfigApiKey).filter(DBConfigApiKey.owner_id == current_user.id).count()
    keys_limit = get_keys_limit(plan)
    requests_this_month = get_requests_this_month(db, current_user.id)
    requests_limit = get_requests_limit(plan)
    return {
        "plan": plan,
        "keys_used": keys_used,
        "keys_limit": keys_limit,
        "requests_this_month": requests_this_month,
        "requests_limit": requests_limit,
        "trial_ends_at": getattr(current_user, "trial_ends_at", None),
        "has_active_subscription": bool(getattr(current_user, "stripe_subscription_id", None)),
    }


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


# Stripe billing: trial (1 day), checkout, portal, webhook
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "localhost")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_STARTER_PRICE_ID = os.getenv("STRIPE_STARTER_PRICE_ID", "")
STRIPE_PRO_PRICE_ID = os.getenv("STRIPE_PRO_PRICE_ID", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


@app.post("/api/billing/trial")
async def start_trial(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    plan = get_effective_plan(current_user)
    if plan != "free":
        raise HTTPException(status_code=400, detail="Trial only for free plan")
    current_user.plan = "trial"
    current_user.trial_ends_at = datetime.utcnow() + timedelta(days=1)
    db.commit()
    db.refresh(current_user)
    return {"plan": "trial", "trial_ends_at": current_user.trial_ends_at}


class CheckoutRequest(BaseModel):
    price_id: str = Field(..., min_length=1, max_length=255)

    @field_validator("price_id")
    @classmethod
    def price_id_format(cls, v: str) -> str:
        if not v or not v.startswith("price_"):
            raise ValueError("Use a Stripe Price ID (starts with price_)")
        if not re.match(r"^price_[a-zA-Z0-9_]+$", v):
            raise ValueError("Invalid price ID format")
        return v.strip()


# Allowed Stripe price IDs for checkout (prevents arbitrary product checkout)
def _allowed_checkout_price_ids() -> tuple:
    return tuple(
        x for x in (STRIPE_STARTER_PRICE_ID, STRIPE_PRO_PRICE_ID)
        if x and x.startswith("price_")
    )


@app.post("/api/billing/checkout")
async def create_checkout(
    body: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user),
):
    if STRIPE_SECRET_KEY == "localhost" or not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured; use donation in localhost mode")
    allowed = _allowed_checkout_price_ids()
    if not allowed or body.price_id not in allowed:
        raise HTTPException(
            status_code=400,
            detail="Invalid or unsupported plan. Use one of the subscription options shown.",
        )
    client = stripe.StripeClient(STRIPE_SECRET_KEY)
    if getattr(current_user, "stripe_customer_id", None):
        customer_id = current_user.stripe_customer_id
    else:
        customer = client.customers.create(
            params={"email": current_user.email or "", "metadata": {"user_id": str(current_user.id)}}
        )
        customer_id = customer.id
        current_user.stripe_customer_id = customer_id
        db.commit()
    session = client.checkout.sessions.create(
        params={
            "customer": customer_id,
            "mode": "subscription",
            "line_items": [{"price": body.price_id, "quantity": 1}],
            "success_url": f"{FRONTEND_URL}/billing?success=1",
            "cancel_url": f"{FRONTEND_URL}/billing?cancel=1",
            "metadata": {"user_id": str(current_user.id)},
        }
    )
    return {"url": session.url}


class UpgradeRequest(BaseModel):
    to_plan: str = "pro"  # only "pro" supported for now


@app.post("/api/billing/upgrade")
async def upgrade_subscription(
    body: UpgradeRequest,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user),
):
    """Upgrade from Starter to Pro: update Stripe subscription to Pro price, then update DB."""
    if STRIPE_SECRET_KEY == "localhost" or not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")
    if (body.to_plan or "").lower() != "pro":
        raise HTTPException(status_code=400, detail="Only upgrade to Pro is supported")
    if not STRIPE_PRO_PRICE_ID:
        raise HTTPException(status_code=503, detail="Pro price not configured")
    sub_id = getattr(current_user, "stripe_subscription_id", None)
    if not sub_id:
        raise HTTPException(status_code=400, detail="No active subscription")
        return {"plan": "pro", "message": "Already on Pro"}
    if plan != "starter":
        raise HTTPException(status_code=400, detail="Upgrade only from Starter to Pro")
    client = stripe.StripeClient(STRIPE_SECRET_KEY)
    try:
        items_resp = client.subscription_items.list(params={"subscription": sub_id})
        if not items_resp.data:
            raise HTTPException(status_code=400, detail="Subscription has no items")
        item_id = items_resp.data[0].id
        # Update subscription item to Pro price; always_invoice so Stripe creates and charges immediately
        client.subscription_items.update(
            item_id,
            params={
                "price": STRIPE_PRO_PRICE_ID,
                "proration_behavior": "always_invoice",
            },
        )
        current_user.plan = "pro"
        db.commit()
        db.refresh(current_user)
    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"plan": "pro"}


@app.post("/api/billing/portal")
async def create_portal(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    if STRIPE_SECRET_KEY == "localhost" or not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")
    cid = getattr(current_user, "stripe_customer_id", None)
    if not cid:
        raise HTTPException(status_code=400, detail="No subscription; subscribe first")
    client = stripe.StripeClient(STRIPE_SECRET_KEY)
    session = client.billing_portal.sessions.create(
        params={"customer": cid, "return_url": f"{FRONTEND_URL}/billing"}
    )
    return {"url": session.url}


@app.post("/api/billing/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook secret not set")
    client = stripe.StripeClient(STRIPE_SECRET_KEY)
    try:
        event = client.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    if event["type"] == "customer.subscription.created" or event["type"] == "customer.subscription.updated":
        sub = event["data"]["object"]
        sub_id = sub["id"]
        customer_id = sub.get("customer")
        status = sub.get("status", "")
        if status in ("active", "trialing"):
            items = sub.get("items") or {}
            data = items.get("data") or []
            price_id = ""
            if data:
                price_obj = data[0].get("price")
                price_id = (price_obj.get("id") if isinstance(price_obj, dict) else price_obj) or ""
            plan = "pro" if price_id == STRIPE_PRO_PRICE_ID else "starter"
            user = db.query(DBUser).filter(DBUser.stripe_customer_id == customer_id).first()
            if user:
                user.stripe_subscription_id = sub_id
                user.plan = plan
                db.commit()
    elif event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        user = db.query(DBUser).filter(DBUser.stripe_subscription_id == sub["id"]).first()
        if user:
            user.stripe_subscription_id = None
            user.plan = "free"
            db.commit()
    return {"received": True}
