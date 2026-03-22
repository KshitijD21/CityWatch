"""In-memory conversation state per session."""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
import uuid


@dataclass
class SessionState:
    session_id: str = ""
    last_location_name: str | None = None
    last_lat: float | None = None
    last_lng: float | None = None
    last_person: str | None = None
    last_incidents: list[dict] = field(default_factory=list)
    last_lane: int = 1
    last_days: int | None = None
    last_radius: float | None = None
    messages: list[dict] = field(default_factory=list)  # last N user+assistant msgs
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# Simple in-memory store keyed by session_id
_sessions: dict[str, SessionState] = {}
MAX_SESSIONS = 500


def get_session(session_id: str | None) -> tuple[str, SessionState]:
    """Get or create a session. Returns (session_id, state)."""
    if session_id and session_id in _sessions:
        return session_id, _sessions[session_id]

    sid = session_id or str(uuid.uuid4())
    state = SessionState(session_id=sid)
    # Evict oldest if too many
    if len(_sessions) >= MAX_SESSIONS:
        oldest_key = min(_sessions, key=lambda k: _sessions[k].updated_at)
        del _sessions[oldest_key]
    _sessions[sid] = state
    return sid, state


def update_session(
    session_id: str,
    *,
    location_name: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    person: str | None = None,
    incidents: list[dict] | None = None,
    lane: int | None = None,
    days: int | None = None,
    radius: float | None = None,
    user_message: str | None = None,
    assistant_message: str | None = None,
) -> None:
    """Update session state after a turn."""
    if session_id not in _sessions:
        return
    s = _sessions[session_id]
    if location_name is not None:
        s.last_location_name = location_name
    if lat is not None:
        s.last_lat = lat
    if lng is not None:
        s.last_lng = lng
    if person is not None:
        s.last_person = person
    if incidents is not None:
        s.last_incidents = incidents[:50]  # cap stored incidents
    if lane is not None:
        s.last_lane = lane
    if days is not None:
        s.last_days = days
    if radius is not None:
        s.last_radius = radius
    if user_message:
        s.messages.append({"role": "user", "content": user_message})
    if assistant_message:
        s.messages.append({"role": "assistant", "content": assistant_message})
    # Keep last 6 messages (3 turns)
    s.messages = s.messages[-6:]
    s.updated_at = datetime.now(timezone.utc)
