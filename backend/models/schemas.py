from pydantic import BaseModel, model_validator
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

class SharingToggle(BaseModel):
    group_id: str
    sharing_location: bool

class GroupCreate(BaseModel):
    name: str
    type: str  # "family" or "friends"

class MemberCreate(BaseModel):
    display_name: str
    age_band: Optional[str] = None

class PlaceCreate(BaseModel):
    name: str
    address: str
    type: str  # "home", "school", "work", "favorite"

class SignupRequest(BaseModel):
    email: str
    password: str
    name: str
    age_band: str


class LoginRequest(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    google_token: Optional[str] = None

    @model_validator(mode="after")
    def check_credentials(self):
        has_email_pw = self.email is not None and self.password is not None
        has_google = self.google_token is not None
        if not has_email_pw and not has_google:
            raise ValueError("Provide email+password or google_token")
        if has_email_pw and has_google:
            raise ValueError("Provide email+password or google_token, not both")
        return self


class AuthResponse(BaseModel):
    user_id: str
    token: str
    onboarded: bool


class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    age_band: str
    avatar_url: Optional[str] = None
    onboarded: bool
    notification_prefs: dict
    groups: list
    saved_places: list


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    age_band: Optional[str] = None
    notification_prefs: Optional[dict] = None
