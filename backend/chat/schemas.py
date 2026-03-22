"""Pydantic schemas for the chat module."""
from __future__ import annotations
from pydantic import BaseModel
from typing import Optional


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    user_lat: Optional[float] = None
    user_lng: Optional[float] = None
    session_id: Optional[str] = None  # for conversation state


class IncidentCard(BaseModel):
    id: str
    category: str
    description: Optional[str]
    occurred_at: str
    source: str
    verified: bool
    lat: float
    lng: float
    distance_miles: Optional[float]


class CardResponse(BaseModel):
    mode: str = "cards"
    summary: str
    incidents: list[IncidentCard]


class TextResponse(BaseModel):
    mode: str = "text"
    content: str
    lane: int  # 1 or 2, for debugging
