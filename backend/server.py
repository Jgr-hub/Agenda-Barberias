from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, date
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class AppointmentStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"

# Models
class TimeSlot(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str  # YYYY-MM-DD format
    time: str  # HH:MM format
    is_available: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TimeSlotCreate(BaseModel):
    date: str
    time: str

class Appointment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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
    appointment_id: str
    client_name: str
    client_phone: str
    status: str
    message: str
    sent_at: datetime = Field(default_factory=datetime.utcnow)

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "Barbershop Booking API", "version": "1.0"}

# ============ TIME SLOTS ENDPOINTS ============

@api_router.get("/slots", response_model=List[TimeSlot])
async def get_available_slots(date: Optional[str] = None):
    """Get available time slots, optionally filtered by date"""
    query = {"is_available": True}
    if date:
        query["date"] = date
    
    slots = await db.time_slots.find(query).sort([("date", 1), ("time", 1)]).to_list(1000)
    return [TimeSlot(**slot) for slot in slots]

@api_router.get("/slots/all", response_model=List[TimeSlot])
async def get_all_slots():
    """Get all time slots (admin view)"""
    slots = await db.time_slots.find().sort([("date", 1), ("time", 1)]).to_list(1000)
    return [TimeSlot(**slot) for slot in slots]

@api_router.post("/slots", response_model=TimeSlot)
async def create_time_slot(slot_input: TimeSlotCreate):
    """Create a new time slot (admin)"""
    # Check if slot already exists
    existing = await db.time_slots.find_one({
        "date": slot_input.date,
        "time": slot_input.time
    })
    if existing:
        raise HTTPException(status_code=400, detail="Este horario ya existe")
    
    slot = TimeSlot(**slot_input.dict())
    await db.time_slots.insert_one(slot.dict())
    return slot

@api_router.post("/slots/bulk", response_model=List[TimeSlot])
async def create_bulk_time_slots(slots: List[TimeSlotCreate]):
    """Create multiple time slots at once (admin)"""
    created_slots = []
    for slot_input in slots:
        existing = await db.time_slots.find_one({
            "date": slot_input.date,
            "time": slot_input.time
        })
        if not existing:
            slot = TimeSlot(**slot_input.dict())
            await db.time_slots.insert_one(slot.dict())
            created_slots.append(slot)
    return created_slots

@api_router.delete("/slots/{slot_id}")
async def delete_time_slot(slot_id: str):
    """Delete a time slot (admin)"""
    result = await db.time_slots.delete_one({"id": slot_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Horario no encontrado")
    return {"message": "Horario eliminado"}

# ============ APPOINTMENTS ENDPOINTS ============

@api_router.get("/appointments", response_model=List[Appointment])
async def get_appointments(status: Optional[str] = None):
    """Get all appointments (admin), optionally filtered by status"""
    query = {}
    if status:
        query["status"] = status
    
    appointments = await db.appointments.find(query).sort([("date", 1), ("time", 1)]).to_list(1000)
    return [Appointment(**apt) for apt in appointments]

@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(apt_input: AppointmentCreate):
    """Create a new appointment request (client)"""
    # Check if slot exists and is available
    slot = await db.time_slots.find_one({
        "date": apt_input.date,
        "time": apt_input.time,
        "is_available": True
    })
    if not slot:
        raise HTTPException(status_code=400, detail="Este horario no está disponible")
    
    # Check if there's already a pending/confirmed appointment for this slot
    existing = await db.appointments.find_one({
        "date": apt_input.date,
        "time": apt_input.time,
        "status": {"$in": ["pending", "confirmed"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Este horario ya está reservado")
    
    # Create appointment
    appointment = Appointment(**apt_input.dict())
    await db.appointments.insert_one(appointment.dict())
    
    # Mark slot as unavailable
    await db.time_slots.update_one(
        {"id": slot["id"]},
        {"$set": {"is_available": False}}
    )
    
    return appointment

@api_router.patch("/appointments/{appointment_id}", response_model=Appointment)
async def update_appointment_status(appointment_id: str, update: AppointmentUpdate):
    """Update appointment status (admin) - confirm or reject"""
    appointment = await db.appointments.find_one({"id": appointment_id})
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    
    # Update status
    await db.appointments.update_one(
        {"id": appointment_id},
        {"$set": {
            "status": update.status,
            "updated_at": datetime.utcnow()
        }}
    )
    
    # If rejected, make slot available again
    if update.status == AppointmentStatus.REJECTED:
        await db.time_slots.update_one(
            {"date": appointment["date"], "time": appointment["time"]},
            {"$set": {"is_available": True}}
        )
    
    # Create notification log (simulated)
    updated_apt = await db.appointments.find_one({"id": appointment_id})
    notification = NotificationLog(
        appointment_id=appointment_id,
        client_name=updated_apt["client_name"],
        client_phone=updated_apt["client_phone"],
        status=update.status,
        message=f"Tu cita del {updated_apt['date']} a las {updated_apt['time']} ha sido {'confirmada' if update.status == 'confirmed' else 'rechazada'}."
    )
    await db.notifications.insert_one(notification.dict())
    
    return Appointment(**updated_apt)

@api_router.delete("/appointments/{appointment_id}")
async def delete_appointment(appointment_id: str):
    """Delete an appointment (admin)"""
    appointment = await db.appointments.find_one({"id": appointment_id})
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    
    # Make slot available again if it wasn't rejected
    if appointment["status"] != "rejected":
        await db.time_slots.update_one(
            {"date": appointment["date"], "time": appointment["time"]},
            {"$set": {"is_available": True}}
        )
    
    await db.appointments.delete_one({"id": appointment_id})
    return {"message": "Cita eliminada"}

# ============ NOTIFICATIONS ENDPOINTS ============

@api_router.get("/notifications", response_model=List[NotificationLog])
async def get_notifications():
    """Get notification history (admin)"""
    notifications = await db.notifications.find().sort("sent_at", -1).to_list(100)
    return [NotificationLog(**n) for n in notifications]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
