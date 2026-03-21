from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class IncidentResponse(BaseModel):
    id: str
    category: str
    description: Optional[str]
    lat: float
    lng: float
    occurred_at: datetime
    source: str
    verified: bool
    report_count: int
    distance_miles: Optional[float]

class ChatRequest(BaseModel):
    message: str
    user_lat: Optional[float]
    user_lng: Optional[float]

class BriefResponse(BaseModel):
    summary: str
    time_breakdown: dict
    household_context: Optional[str]
    sources: list
    incident_count: int
    disclaimer: str

class ReportCreate(BaseModel):
    category: str
    description: Optional[str]
    lat: float
    lng: float

class LocationUpdate(BaseModel):
    lat: float
    lng: float

class GroupCreate(BaseModel):
    name: str
    type: str  # "family" or "trip"

class PlaceCreate(BaseModel):
    name: str
    address: str
    type: str  # "home", "school", "work", "favorite"

class SignupRequest(BaseModel):
    email: str
    password: str
    name: str
    age_band: str
