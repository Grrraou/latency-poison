from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
import json
import requests
import random
import time
import secrets

from database import get_db, User as DBUser, Collection as DBCollection, Endpoint as DBEndpoint, ApiKey as DBApiKey

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    username: str
    email: str
    password: str
    full_name: Optional[str] = None

# New Pydantic models
class CollectionBase(BaseModel):
    name: str
    description: Optional[str] = None

class CollectionCreate(CollectionBase):
    pass

class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class Collection(CollectionBase):
    id: int
    owner_id: int
    is_active: bool = True
    request_count: int = 0

    class Config:
        orm_mode = True

# API Key models
class ApiKeyBase(BaseModel):
    name: str

class ApiKeyCreate(ApiKeyBase):
    all_collections: bool = False
    collection_ids: List[int] = []

class ApiKeyUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    all_collections: Optional[bool] = None
    collection_ids: Optional[List[int]] = None

class ApiKeyResponse(ApiKeyBase):
    id: int
    key: str
    is_active: bool
    all_collections: bool
    request_count: int = 0
    created_at: datetime
    last_used_at: Optional[datetime]
    collection_ids: List[int]

    class Config:
        orm_mode = True

class EndpointBase(BaseModel):
    name: str
    url: str
    method: str
    headers: Optional[Dict[str, Any]] = None
    body: Optional[Dict[str, Any]] = None
    fail_rate: int = 0
    min_latency: int = 0
    max_latency: int = 1000
    sandbox: bool = False
    is_active: bool = True
    request_count: int = 0

class EndpointCreate(EndpointBase):
    collection_id: int

class EndpointUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    method: Optional[str] = None
    headers: Optional[Dict[str, Any]] = None
    body: Optional[Dict[str, Any]] = None
    fail_rate: Optional[int] = None
    min_latency: Optional[int] = None
    max_latency: Optional[int] = None
    sandbox: Optional[bool] = None
    is_active: Optional[bool] = None

class Endpoint(EndpointBase):
    id: int
    collection_id: int

    class Config:
        orm_mode = True

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_user(db: Session, username: str):
    return db.query(DBUser).filter(DBUser.username == username).first()

def authenticate_user(db: Session, username: str, password: str):
    user = get_user(db, username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

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
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = get_user(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

# Routes
@app.post("/api/auth/login")
async def login_for_access_token(request: Request, db: Session = Depends(get_db)):
    try:
        body = await request.json()
        username = body.get("username")
        password = body.get("password")
        
        if not username or not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username and password are required"
            )
        
        user = authenticate_user(db, username, password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON in request body"
        )

@app.post("/api/auth/register")
async def register_user(request: Request, db: Session = Depends(get_db)):
    try:
        body = await request.json()
        username = body.get("username")
        email = body.get("email")
        password = body.get("password")
        full_name = body.get("full_name")
        
        if not username or not email or not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username, email, and password are required"
            )
        
        # Check if username or email already exists
        if db.query(DBUser).filter(DBUser.username == username).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already registered"
            )
        if db.query(DBUser).filter(DBUser.email == email).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        hashed_password = pwd_context.hash(password)
        db_user = DBUser(
            username=username,
            email=email,
            full_name=full_name,
            hashed_password=hashed_password,
            disabled=False
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
        return User(
            username=db_user.username,
            email=db_user.email,
            full_name=db_user.full_name,
            disabled=db_user.disabled
        )
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON in request body"
        )

@app.get("/api/users/me", response_model=User)
async def read_users_me(current_user: DBUser = Depends(get_current_user)):
    return User(
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        disabled=current_user.disabled
    )

@app.get("/")
async def root():
    return {"message": "Welcome to Latency Poison API"}

@app.get("/proxy")
async def proxy_request(
    endpoint_id: int,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    try:
        # Get endpoint from database
        endpoint = db.query(DBEndpoint).join(DBCollection).filter(
            DBEndpoint.id == endpoint_id,
            DBCollection.owner_id == current_user.id
        ).first()
        
        if endpoint is None:
            raise HTTPException(status_code=404, detail="Endpoint not found")

        # Simulate latency if specified
        if endpoint.min_latency > 0 or endpoint.max_latency > 0:
            latency = random.uniform(endpoint.min_latency, endpoint.max_latency) / 1000  # Convert to seconds
            time.sleep(latency)

        # Simulate failure if specified
        if random.random() < (endpoint.fail_rate / 100):  # Convert percentage to decimal
            raise HTTPException(status_code=500, detail="Simulated failure")

        # Make the actual request with timeout
        headers = endpoint.headers or {}
        data = endpoint.body if endpoint.method.upper() in ['POST', 'PUT', 'PATCH'] else None
        
        response = requests.request(
            method=endpoint.method,
            url=endpoint.url,
            headers=headers,
            json=data,
            timeout=10  # 10 second timeout
        )
        response.raise_for_status()  # Raise an exception for bad status codes
        return response.json()
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="Request timed out")
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# New routes for collections
@app.post("/api/collections/", response_model=Collection)
async def create_collection(
    collection: CollectionCreate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    db_collection = DBCollection(**collection.dict(), owner_id=current_user.id)
    db.add(db_collection)
    db.commit()
    db.refresh(db_collection)
    return db_collection

@app.get("/api/collections/", response_model=List[Collection])
async def read_collections(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    return db.query(DBCollection).filter(DBCollection.owner_id == current_user.id).all()

@app.get("/api/collections/{collection_id}/", response_model=Collection)
async def read_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    collection = db.query(DBCollection).filter(
        DBCollection.id == collection_id,
        DBCollection.owner_id == current_user.id
    ).first()
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    return collection

@app.delete("/api/collections/{collection_id}/")
async def delete_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    collection = db.query(DBCollection).filter(
        DBCollection.id == collection_id,
        DBCollection.owner_id == current_user.id
    ).first()
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    db.delete(collection)
    db.commit()
    return {"message": "Collection deleted"}

# New routes for endpoints
@app.post("/api/endpoints/", response_model=Endpoint)
async def create_endpoint(
    endpoint: EndpointCreate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    # Verify collection belongs to user
    collection = db.query(DBCollection).filter(
        DBCollection.id == endpoint.collection_id,
        DBCollection.owner_id == current_user.id
    ).first()
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Validate latency: min_latency must be <= max_latency
    if endpoint.min_latency > endpoint.max_latency:
        raise HTTPException(
            status_code=400, 
            detail="min_latency cannot be greater than max_latency"
        )
    
    db_endpoint = DBEndpoint(**endpoint.dict())
    db.add(db_endpoint)
    db.commit()
    db.refresh(db_endpoint)
    return db_endpoint

@app.get("/api/collections/{collection_id}/endpoints/", response_model=List[Endpoint])
async def read_endpoints(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    # Verify collection belongs to user
    collection = db.query(DBCollection).filter(
        DBCollection.id == collection_id,
        DBCollection.owner_id == current_user.id
    ).first()
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    return db.query(DBEndpoint).filter(DBEndpoint.collection_id == collection_id).all()

@app.get("/api/endpoints/{endpoint_id}/", response_model=Endpoint)
async def read_endpoint(
    endpoint_id: int,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    endpoint = db.query(DBEndpoint).join(DBCollection).filter(
        DBEndpoint.id == endpoint_id,
        DBCollection.owner_id == current_user.id
    ).first()
    if endpoint is None:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    return endpoint

@app.put("/api/endpoints/{endpoint_id}/", response_model=Endpoint)
async def update_endpoint(
    endpoint_id: int,
    endpoint_update: EndpointUpdate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    endpoint = db.query(DBEndpoint).join(DBCollection).filter(
        DBEndpoint.id == endpoint_id,
        DBCollection.owner_id == current_user.id
    ).first()
    if endpoint is None:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    
    # Update only provided fields
    update_data = endpoint_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(endpoint, field, value)
    
    # Validate latency after update: min_latency must be <= max_latency
    if endpoint.min_latency > endpoint.max_latency:
        raise HTTPException(
            status_code=400, 
            detail="min_latency cannot be greater than max_latency"
        )
    
    db.commit()
    db.refresh(endpoint)
    return endpoint

@app.delete("/api/endpoints/{endpoint_id}/")
async def delete_endpoint(
    endpoint_id: int,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    endpoint = db.query(DBEndpoint).join(DBCollection).filter(
        DBEndpoint.id == endpoint_id,
        DBCollection.owner_id == current_user.id
    ).first()
    if endpoint is None:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    db.delete(endpoint)
    db.commit()
    return {"message": "Endpoint deleted"}

# Collection update endpoint (for toggling is_active)
@app.put("/api/collections/{collection_id}/", response_model=Collection)
async def update_collection(
    collection_id: int,
    collection_update: CollectionUpdate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    collection = db.query(DBCollection).filter(
        DBCollection.id == collection_id,
        DBCollection.owner_id == current_user.id
    ).first()
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    update_data = collection_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(collection, field, value)
    
    db.commit()
    db.refresh(collection)
    return collection

# API Key endpoints
def generate_api_key():
    """Generate a secure random API key"""
    return f"lp_{secrets.token_urlsafe(32)}"

def api_key_to_response(api_key: DBApiKey) -> dict:
    """Convert DBApiKey to response dict with collection_ids"""
    return {
        "id": api_key.id,
        "name": api_key.name,
        "key": api_key.key,
        "is_active": api_key.is_active,
        "all_collections": api_key.all_collections,
        "request_count": api_key.request_count or 0,
        "created_at": api_key.created_at,
        "last_used_at": api_key.last_used_at,
        "collection_ids": [c.id for c in api_key.collections]
    }

@app.post("/api/keys/", response_model=ApiKeyResponse)
async def create_api_key(
    api_key_data: ApiKeyCreate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    # Generate unique API key
    key = generate_api_key()
    
    # Create the API key
    db_api_key = DBApiKey(
        name=api_key_data.name,
        key=key,
        all_collections=api_key_data.all_collections,
        owner_id=current_user.id
    )
    
    # Add selected collections if not all_collections
    if not api_key_data.all_collections and api_key_data.collection_ids:
        collections = db.query(DBCollection).filter(
            DBCollection.id.in_(api_key_data.collection_ids),
            DBCollection.owner_id == current_user.id
        ).all()
        db_api_key.collections = collections
    
    db.add(db_api_key)
    db.commit()
    db.refresh(db_api_key)
    
    return api_key_to_response(db_api_key)

@app.get("/api/keys/", response_model=List[ApiKeyResponse])
async def list_api_keys(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    api_keys = db.query(DBApiKey).filter(DBApiKey.owner_id == current_user.id).all()
    return [api_key_to_response(k) for k in api_keys]

@app.get("/api/keys/{key_id}/", response_model=ApiKeyResponse)
async def get_api_key(
    key_id: int,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    api_key = db.query(DBApiKey).filter(
        DBApiKey.id == key_id,
        DBApiKey.owner_id == current_user.id
    ).first()
    if api_key is None:
        raise HTTPException(status_code=404, detail="API key not found")
    return api_key_to_response(api_key)

@app.put("/api/keys/{key_id}/", response_model=ApiKeyResponse)
async def update_api_key(
    key_id: int,
    api_key_update: ApiKeyUpdate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    api_key = db.query(DBApiKey).filter(
        DBApiKey.id == key_id,
        DBApiKey.owner_id == current_user.id
    ).first()
    if api_key is None:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Update simple fields
    if api_key_update.name is not None:
        api_key.name = api_key_update.name
    if api_key_update.is_active is not None:
        api_key.is_active = api_key_update.is_active
    if api_key_update.all_collections is not None:
        api_key.all_collections = api_key_update.all_collections
    
    # Update collection associations
    if api_key_update.collection_ids is not None:
        collections = db.query(DBCollection).filter(
            DBCollection.id.in_(api_key_update.collection_ids),
            DBCollection.owner_id == current_user.id
        ).all()
        api_key.collections = collections
    
    db.commit()
    db.refresh(api_key)
    return api_key_to_response(api_key)

@app.delete("/api/keys/{key_id}/")
async def delete_api_key(
    key_id: int,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    api_key = db.query(DBApiKey).filter(
        DBApiKey.id == key_id,
        DBApiKey.owner_id == current_user.id
    ).first()
    if api_key is None:
        raise HTTPException(status_code=404, detail="API key not found")
    db.delete(api_key)
    db.commit()
    return {"message": "API key deleted"} 