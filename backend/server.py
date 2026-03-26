from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from enum import Enum
import jwt
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
db_name = os.environ.get('DB_NAME', 'barberia_db')

if not mongo_url:
    raise ValueError("MONGO_URL environment variable is required")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'barbershop-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create the main app
app = FastAPI(title="Barbershop Booking API", version="2.0")

# ============ CORS MIDDLEWARE (ANTES del router) ============
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://agenda-barberias.vercel.app",
        os.getenv("FRONTEND_URL", "*")
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# ============ ENUMS ============
class AppointmentStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"

# ============ MODELS ============
class Barbershop(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    password_hash: str
    name: str = "Mi Barbería"
    photo: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class BarbershopPublic(BaseModel):
    id: str
    name: str
    photo: Optional[str] = None

class BarbershopRegister(BaseModel):
    email: EmailStr
    password: str
    name: str = "Mi Barbería"

class BarbershopLogin(BaseModel):
    email: EmailStr
    password: str

class BarbershopProfileUpdate(BaseModel):
    name: Optional[str] = None
    photo: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    barbershop: BarbershopPublic

class TimeSlot(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    barberia_id: str
    date: str
    time: str
    is_available: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TimeSlotCreate(BaseModel):
    date: str
    time: str

class Appointment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    barberia_id: str
    client_name: str
    client_phone: str
    date: str
    time: str
    status: AppointmentStatus = AppointmentStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class AppointmentCreate(BaseModel):
    client_name: str
    client_phone: str
    date: str
    time: str

class AppointmentUpdate(BaseModel):
    status: AppointmentStatus

class NotificationLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    barberia_id: str
    appointment_id: str
    client_name: str
    client_phone: str
    status: str
    message: str
    sent_at: datetime = Field(default_factory=datetime.utcnow)

# ============ HELPER FUNCTIONS ============
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(barbershop_id: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "sub": barbershop_id,
        "exp": expire
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_barbershop(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        barbershop_id = payload.get("sub")
        if barbershop_id is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        
        barbershop = await db.barbershops.find_one({"id": barbershop_id})
        if barbershop is None:
            raise HTTPException(status_code=401, detail="Barbería no encontrada")
        
        return barbershop
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

# ============ HEALTH & ROOT ENDPOINTS ============
@app.get("/")
async def root():
    return {"message": "Barbershop Booking API", "version": "2.0", "status": "running"}

@app.get("/health")
async def health_check():
    """Health check endpoint for Railway"""
    try:
        await client.admin.command('ping')
        mongo_status = "connected"
    except:
        mongo_status = "disconnected"
    
    return {
        "status": "healthy",
        "mongodb": mongo_status,
        "timestamp": datetime.utcnow().isoformat()
    }

# ============ AUTH ENDPOINTS ============
@api_router.post("/auth/register", response_model=TokenResponse)
async def register_barbershop(input: BarbershopRegister):
    existing = await db.barbershops.find_one({"email": input.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Este email ya está registrado")
    
    barbershop = Barbershop(
        email=input.email.lower(),
        password_hash=hash_password(input.password),
        name=input.name
    )
    await db.barbershops.insert_one(barbershop.dict())
    
    token = create_access_token(barbershop.id)
    
    return TokenResponse(
        access_token=token,
        barbershop=BarbershopPublic(
            id=barbershop.id,
            name=barbershop.name,
            photo=barbershop.photo
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login_barbershop(input: BarbershopLogin):
    barbershop = await db.barbershops.find_one({"email": input.email.lower()})
    if not barbershop:
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    
    if not verify_password(input.password, barbershop["password_hash"]):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    
    token = create_access_token(barbershop["id"])
    
    return TokenResponse(
        access_token=token,
        barbershop=BarbershopPublic(
            id=barbershop["id"],
            name=barbershop["name"],
            photo=barbershop.get("photo")
        )
    )

@api_router.get("/auth/me", response_model=BarbershopPublic)
async def get_current_barbershop_info(barbershop: dict = Depends(get_current_barbershop)):
    return BarbershopPublic(
        id=barbershop["id"],
        name=barbershop["name"],
        photo=barbershop.get("photo")
    )

# ============ BARBERSHOP PROFILE ENDPOINTS ============
@api_router.patch("/barbershop/profile", response_model=BarbershopPublic)
async def update_barbershop_profile(
    update: BarbershopProfileUpdate,
    barbershop: dict = Depends(get_current_barbershop)
):
    update_data = {}
    if update.name is not None:
        update_data["name"] = update.name
    if update.photo is not None:
        update_data["photo"] = update.photo
    
    if update_data:
        await db.barbershops.update_one(
            {"id": barbershop["id"]},
            {"$set": update_data}
        )
    
    updated = await db.barbershops.find_one({"id": barbershop["id"]})
    return BarbershopPublic(
        id=updated["id"],
        name=updated["name"],
        photo=updated.get("photo")
    )

@api_router.get("/barbershop/{barbershop_id}/public", response_model=BarbershopPublic)
async def get_barbershop_public(barbershop_id: str):
    barbershop = await db.barbershops.find_one({"id": barbershop_id})
    if not barbershop:
        raise HTTPException(status_code=404, detail="Barbería no encontrada")
    
    return BarbershopPublic(
        id=barbershop["id"],
        name=barbershop["name"],
        photo=barbershop.get("photo")
    )

# ============ TIME SLOTS ENDPOINTS ============
@api_router.get("/slots", response_model=List[TimeSlot])
async def get_available_slots(
    date: Optional[str] = None,
    barbershop: dict = Depends(get_current_barbershop)
):
    query = {"barberia_id": barbershop["id"], "is_available": True}
    if date:
        query["date"] = date
    
    slots = await db.time_slots.find(query).sort([("date", 1), ("time", 1)]).to_list(1000)
    return [TimeSlot(**slot) for slot in slots]

@api_router.get("/slots/all", response_model=List[TimeSlot])
async def get_all_slots(barbershop: dict = Depends(get_current_barbershop)):
    slots = await db.time_slots.find({"barberia_id": barbershop["id"]}).sort([("date", 1), ("time", 1)]).to_list(1000)
    return [TimeSlot(**slot) for slot in slots]

@api_router.post("/slots", response_model=TimeSlot)
async def create_time_slot(
    slot_input: TimeSlotCreate,
    barbershop: dict = Depends(get_current_barbershop)
):
    existing = await db.time_slots.find_one({
        "barberia_id": barbershop["id"],
        "date": slot_input.date,
        "time": slot_input.time
    })
    if existing:
        raise HTTPException(status_code=400, detail="Este horario ya existe")
    
    slot = TimeSlot(barberia_id=barbershop["id"], **slot_input.dict())
    await db.time_slots.insert_one(slot.dict())
    return slot

@api_router.post("/slots/bulk", response_model=List[TimeSlot])
async def create_bulk_time_slots(
    slots: List[TimeSlotCreate],
    barbershop: dict = Depends(get_current_barbershop)
):
    created_slots = []
    for slot_input in slots:
        existing = await db.time_slots.find_one({
            "barberia_id": barbershop["id"],
            "date": slot_input.date,
            "time": slot_input.time
        })
        if not existing:
            slot = TimeSlot(barberia_id=barbershop["id"], **slot_input.dict())
            await db.time_slots.insert_one(slot.dict())
            created_slots.append(slot)
    return created_slots

@api_router.delete("/slots/{slot_id}")
async def delete_time_slot(
    slot_id: str,
    barbershop: dict = Depends(get_current_barbershop)
):
    result = await db.time_slots.delete_one({
        "id": slot_id,
        "barberia_id": barbershop["id"]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Horario no encontrado")
    return {"message": "Horario eliminado"}

@api_router.get("/barbershop/{barbershop_id}/slots", response_model=List[TimeSlot])
async def get_barbershop_public_slots(barbershop_id: str, date: Optional[str] = None):
    barbershop = await db.barbershops.find_one({"id": barbershop_id})
    if not barbershop:
        raise HTTPException(status_code=404, detail="Barbería no encontrada")
    
    query = {"barberia_id": barbershop_id, "is_available": True}
    if date:
        query["date"] = date
    
    slots = await db.time_slots.find(query).sort([("date", 1), ("time", 1)]).to_list(1000)
    return [TimeSlot(**slot) for slot in slots]

# ============ APPOINTMENTS ENDPOINTS ============
@api_router.get("/appointments", response_model=List[Appointment])
async def get_appointments(
    status: Optional[str] = None,
    barbershop: dict = Depends(get_current_barbershop)
):
    query = {"barberia_id": barbershop["id"]}
    if status:
        query["status"] = status
    
    appointments = await db.appointments.find(query).sort([("date", 1), ("time", 1)]).to_list(1000)
    return [Appointment(**apt) for apt in appointments]

@api_router.patch("/appointments/{appointment_id}", response_model=Appointment)
async def update_appointment_status(
    appointment_id: str,
    update: AppointmentUpdate,
    barbershop: dict = Depends(get_current_barbershop)
):
    appointment = await db.appointments.find_one({
        "id": appointment_id,
        "barberia_id": barbershop["id"]
    })
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    
    await db.appointments.update_one(
        {"id": appointment_id},
        {"$set": {
            "status": update.status,
            "updated_at": datetime.utcnow()
        }}
    )
    
    if update.status == AppointmentStatus.REJECTED:
        await db.time_slots.update_one(
            {
                "barberia_id": barbershop["id"],
                "date": appointment["date"],
                "time": appointment["time"]
            },
            {"$set": {"is_available": True}}
        )
    
    updated_apt = await db.appointments.find_one({"id": appointment_id})
    notification = NotificationLog(
        barberia_id=barbershop["id"],
        appointment_id=appointment_id,
        client_name=updated_apt["client_name"],
        client_phone=updated_apt["client_phone"],
        status=update.status,
        message=f"Tu cita del {updated_apt['date']} a las {updated_apt['time']} ha sido {'confirmada' if update.status == 'confirmed' else 'rechazada'}."
    )
    await db.notifications.insert_one(notification.dict())
    
    return Appointment(**updated_apt)

@api_router.delete("/appointments/{appointment_id}")
async def delete_appointment(
    appointment_id: str,
    barbershop: dict = Depends(get_current_barbershop)
):
    appointment = await db.appointments.find_one({
        "id": appointment_id,
        "barberia_id": barbershop["id"]
    })
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    
    if appointment["status"] != "rejected":
        await db.time_slots.update_one(
            {
                "barberia_id": barbershop["id"],
                "date": appointment["date"],
                "time": appointment["time"]
            },
            {"$set": {"is_available": True}}
        )
    
    await db.appointments.delete_one({"id": appointment_id})
    return {"message": "Cita eliminada"}

@api_router.post("/barbershop/{barbershop_id}/appointments", response_model=Appointment)
async def create_public_appointment(barbershop_id: str, apt_input: AppointmentCreate):
    barbershop = await db.barbershops.find_one({"id": barbershop_id})
    if not barbershop:
        raise HTTPException(status_code=404, detail="Barbería no encontrada")
    
    slot = await db.time_slots.find_one({
        "barberia_id": barbershop_id,
        "date": apt_input.date,
        "time": apt_input.time,
        "is_available": True
    })
    if not slot:
        raise HTTPException(status_code=400, detail="Este horario no está disponible")
    
    existing = await db.appointments.find_one({
        "barberia_id": barbershop_id,
        "date": apt_input.date,
        "time": apt_input.time,
        "status": {"$in": ["pending", "confirmed"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Este horario ya está reservado")
    
    appointment = Appointment(barberia_id=barbershop_id, **apt_input.dict())
    await db.appointments.insert_one(appointment.dict())
    
    await db.time_slots.update_one(
        {"id": slot["id"]},
        {"$set": {"is_available": False}}
    )
    
    return appointment

@api_router.get("/notifications", response_model=List[NotificationLog])
async def get_notifications(barbershop: dict = Depends(get_current_barbershop)):
    notifications = await db.notifications.find(
        {"barberia_id": barbershop["id"]}
    ).sort("sent_at", -1).to_list(100)
    return [NotificationLog(**n) for n in notifications]

# Include the router in the main app
app.include_router(api_router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
