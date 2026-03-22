"""Main chat handler — orchestrates routing, data fetching, and LLM calls."""
from __future__ import annotations
import json
import logging
from typing import AsyncGenerator
from chat import data_access, geocoding, llm

logger = logging.getLogger("chat.handler")
from chat.geocoding import reverse_geocode_batch
from chat.prompts import build_lane1_prompt, build_react_prompt
from chat.routing import classify_lane
from chat.state import get_session, update_session
from chat.react_loop import run_react_loop


def _message_explicitly_requests_user_location(message: str) -> bool:
    """Check if the message explicitly asks for the user's own location context."""
    msg = message.lower()
    return any(phrase in msg for phrase in [
        "near me", "around me", "my area", "my location",
        "where i am", "my neighborhood", "close to me",
    ])


async def _extract_location(
    message: str,
    user_lat: float | None,
    user_lng: float | None,
    session_lat: float | None,
    session_lng: float | None,
    session_location_name: str | None = None,
    user_id: str | None = None,
) -> tuple[float | None, float | None, str | None]:
    """Try to extract a location from the message.

    Priority for follow-ups (session exists, no explicit location in message):
      session's last location → GPS → DB live location → saved home → default
    Priority for explicit location requests:
      geocode message → GPS (if "near me") → session → DB → saved → default
    """
    # Try geocoding the message text — first try the raw message,
    # then extract location phrases if the raw message fails
    geo = await geocoding.geocode_location(message)
    if geo:
        return geo["lat"], geo["lng"], geo["place_name"]

    # Try extracting location from common patterns
    import re
    loc_patterns = [
        # "near Roosevelt Row", "around Downtown Phoenix"
        r'(?:near|around)\s+(.+?)(?:\?|$|\.|\!)',
        # "incidents near X", "crimes in X", "happened in X"
        r'(?:happening|incidents|events|crimes|thefts|assaults|happened)\s+(?:near|in|at|around)\s+(.+?)(?:\?|$|\.|\!)',
        # "Is Central Ave safe", "Is downtown safe"
        r'^is\s+(.+?)\s+safe',
        # "in the tempe", "in the downtown" — strip "the"
        r'\bin\s+the\s+([A-Za-z][a-zA-Z\s]+?)(?:\?|$|\.|\!)',
        # "in Phoenix", "in Downtown" (but not "in last", "in the")
        r'\bin\s+([A-Z][a-zA-Z\s]+?)(?:\?|$|\.|\!)',
    ]
    for pattern in loc_patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            extracted = match.group(1).strip().rstrip('.,!?')
            # Skip non-location phrases
            skip_phrases = ["me", "my home", "my area", "last", "the", "a", "5 miles", "10 miles", "20 miles", "night",
                           "he", "she", "her", "him", "them", "they", "his", "he in a", "she in a", "everyone",
                           "last 24", "last 48", "last 7", "last 30", "today", "yesterday", "now"]
            if len(extracted) > 2 and extracted.lower() not in skip_phrases and not re.match(r'^\d+\s*mi', extracted.lower()):
                geo = await geocoding.geocode_location(extracted)
                if geo:
                    logger.info(f"[LOCATION] extracted '{extracted}' from message, geocoded to {geo['place_name']}")
                    return geo["lat"], geo["lng"], geo["place_name"]

    # If user explicitly says "near me", use their GPS
    if _message_explicitly_requests_user_location(message):
        if user_lat is not None and user_lng is not None:
            return user_lat, user_lng, "your current location"

    # For follow-ups ("check around 5 miles", "any events today?"), use session
    # location which may be a person's location from a previous Lane 2 query
    if session_lat is not None and session_lng is not None:
        return session_lat, session_lng, session_location_name or "previous location"

    # Fall back to user GPS (browser geolocation)
    if user_lat is not None and user_lng is not None:
        return user_lat, user_lng, "your current location"

    # Fall back to user's live location from DB
    if user_id:
        try:
            live_loc = await data_access.get_live_location(user_id)
            if live_loc and live_loc.get("lat") and live_loc.get("lng"):
                return live_loc["lat"], live_loc["lng"], "your live location"
        except Exception:
            pass

    # Fall back to user's home/saved place
    if user_id:
        try:
            places = await data_access.get_saved_places(user_id)
            if places:
                home = next((p for p in places if p.get("label", "").lower() == "home"), places[0])
                if home.get("lat") and home.get("lng"):
                    return home["lat"], home["lng"], home.get("label", "your saved location")
        except Exception:
            pass

    # Default: Downtown Phoenix (where most incident data exists)
    return 33.4610, -112.0780, "Downtown Phoenix, AZ (default)"


def _should_show_cards(message: str, member_names: list[str] | None = None) -> bool:
    """Detect if the user wants to see incident cards vs a narrative answer.
    Only triggers for explicit list/show requests. If a person's name is in
    the message, default to text mode (e.g. "what happened to Anirudh?").
    """
    msg = message.lower()
    # If a person's name is mentioned, default to text mode
    if member_names:
        for name in member_names:
            if name.lower() in msg:
                return False
    card_phrases = [
        "show me incidents", "show incidents", "list incidents",
        "list crimes", "list reports", "show me crimes",
        "recent incidents", "any incidents", "crimes near",
        "reports near", "show me what happened",
        "what happened", "what's happening", "whats happening",
        "any crime", "any reports", "is it safe",
        "safe to walk", "safe near", "safety near",
        "how safe", "incidents near", "incidents around",
        "happened near", "happened around", "happened today",
        "happened recently", "crime near", "crime around",
    ]
    return any(phrase in msg for phrase in card_phrases)


def _extract_radius_from_message(message: str) -> float | None:
    """Extract a user-requested radius in miles from the message. Returns None if not found."""
    import re
    # Match patterns like "20 miles", "within 10 mi", "around 5 miles"
    match = re.search(r'(\d+(?:\.\d+)?)\s*(?:miles?|mi)\b', message.lower())
    if match:
        return float(match.group(1))
    return None


def _extract_days_from_message(message: str) -> int | None:
    """Extract a time range from the user's message and return it as number of days.
    Returns None if no time range is specified (caller should use default of 7 days).
    """
    import re
    msg = message.lower()

    # "last N hours/hr/h"
    match = re.search(r'last\s+(\d+)\s*(?:hours?|hrs?|h)\b', msg)
    if match:
        n = int(match.group(1))
        # Return fractional days — but since DB queries use integer days,
        # we need to return at least 1 and pass hours separately
        # For now, convert to days rounding up
        return max(1, -(-n // 24))  # ceiling division

    # "last N days/weeks/months/year(s)"
    match = re.search(r'last\s+(\d+)\s*(days?|weeks?|months?|years?)', msg)
    if match:
        n = int(match.group(1))
        unit = match.group(2)
        if 'day' in unit:
            return n
        elif 'week' in unit:
            return n * 7
        elif 'month' in unit:
            return n * 30
        elif 'year' in unit:
            return n * 365

    # "last year", "last month", "last week" (no number)
    if 'last year' in msg or 'past year' in msg or 'in last 1 year' in msg:
        return 365
    if 'last month' in msg or 'past month' in msg:
        return 30
    if 'last week' in msg or 'past week' in msg:
        return 7

    # "today", "this week", "this month"
    if 'today' in msg:
        return 1
    if 'yesterday' in msg:
        return 2
    if 'this week' in msg:
        return 7
    if 'this month' in msg:
        return 30
    if 'this year' in msg:
        return 365

    # "N hours ago", "48 hr", "24 hours"
    match = re.search(r'(\d+)\s*(?:hours?|hrs?|h)\b', msg)
    if match:
        n = int(match.group(1))
        return max(1, -(-n // 24))

    # Date range: "from march 10 to march 20", "from 20 march to now"
    month_map = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
        'january': 1, 'february': 2, 'march': 3, 'april': 4, 'june': 6,
        'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
    }
    from datetime import datetime, timezone

    # "from month day to ..." or "from day month to ..."
    range_match = re.search(r'from\s+(\w+)\s+(\d+)\s+to\s+(\w+)\s*(\d*)', msg)
    if not range_match:
        range_match = re.search(r'from\s+(\d+)\s+(\w+)\s+to\s+(\w+)\s*(\d*)', msg)
        if range_match:
            # Swap day/month for "20 march" format
            d1_str, m1_str = range_match.group(1), range_match.group(2)
            end_word, d2_str = range_match.group(3), range_match.group(4)
            try:
                m1 = month_map.get(m1_str.lower())
                d1 = int(d1_str)
                now = datetime.now(timezone.utc)
                start = datetime(now.year, m1, d1, tzinfo=timezone.utc)
                if end_word.lower() in ('now', 'today', 'present'):
                    days_back = (now - start).days + 1
                else:
                    m2 = month_map.get(end_word.lower())
                    d2 = int(d2_str) if d2_str else now.day
                    end = datetime(now.year, m2, d2, tzinfo=timezone.utc)
                    days_back = (now - start).days + 1
                return max(days_back, 1)
            except Exception:
                pass
    if range_match and not range_match.group(1).isdigit():
        try:
            m1 = month_map.get(range_match.group(1).lower())
            d1 = int(range_match.group(2))
            end_word = range_match.group(3)
            d2_str = range_match.group(4)
            now = datetime.now(timezone.utc)
            start = datetime(now.year, m1, d1, tzinfo=timezone.utc)
            if end_word.lower() in ('now', 'today', 'present'):
                days_back = (now - start).days + 1
            else:
                m2 = month_map.get(end_word.lower())
                d2 = int(d2_str) if d2_str else now.day
                days_back = (now - start).days + 1
            return max(days_back, 1)
        except Exception:
            pass

    # "since march 10", "since 20 march"
    since_match = re.search(r'since\s+(\w+)\s+(\d+)', msg) or re.search(r'since\s+(\d+)\s+(\w+)', msg)
    if since_match:
        try:
            g1, g2 = since_match.group(1), since_match.group(2)
            if g1.isdigit():
                d1, m1_str = int(g1), g2
            else:
                m1_str, d1 = g1, int(g2)
            m1 = month_map.get(m1_str.lower())
            if m1:
                now = datetime.now(timezone.utc)
                start = datetime(now.year, m1, d1, tzinfo=timezone.utc)
                return max((now - start).days + 1, 1)
        except Exception:
            pass

    return None


async def _enrich_incidents_with_location(incidents: list[dict]) -> list[dict]:
    """Add location_name to each incident via reverse geocoding."""
    if not incidents:
        return incidents
    coords = [(inc["lat"], inc["lng"]) for inc in incidents if "lat" in inc and "lng" in inc]
    if not coords:
        return incidents
    geo_map = await reverse_geocode_batch(coords)
    for inc in incidents:
        key = f"{inc['lat']:.4f},{inc['lng']:.4f}"
        inc["location_name"] = geo_map.get(key, f"{inc['lat']:.4f}, {inc['lng']:.4f}")
    return incidents


async def handle_lane1(
    message: str,
    lat: float,
    lng: float,
    location_name: str | None,
    session_id: str,
    user_id: str | None,
    member_names: list[str] | None = None,
) -> AsyncGenerator[str, None]:
    """Handle a Lane 1 (simple location) query with streaming."""
    # Check if user requested a specific radius (cap at 25 miles)
    requested_radius = _extract_radius_from_message(message)
    _, session_state = get_session(session_id)
    if requested_radius:
        radius = min(requested_radius, 25.0)
    elif session_state.last_radius:
        radius = session_state.last_radius
    else:
        radius = 5.0

    # Check if user requested a specific time range (default 7 days)
    requested_days = _extract_days_from_message(message)
    if requested_days:
        days = requested_days
    elif session_state.last_days:
        days = session_state.last_days
    else:
        days = 7
    logger.info(f"[LANE1] lat={lat} lng={lng} loc={location_name} radius={radius}mi days={days} (requested_radius={requested_radius} requested_days={requested_days})")

    # Fetch data
    incidents = await data_access.get_nearby_incidents(lat, lng, radius_miles=radius, days=days)
    stats = await data_access.get_incident_stats(lat, lng, radius_miles=radius, days=days)
    logger.info(f"[LANE1] got {len(incidents)} incidents from DB")

    # Reverse geocode incident locations for display
    incidents = await _enrich_incidents_with_location(incidents)

    # Optional: user context
    group_members = None
    saved_places = None
    user_profile = None
    if user_id:
        try:
            user_profile = await data_access.get_user_profile(user_id)
        except Exception:
            pass
        try:
            saved_places = await data_access.get_saved_places(user_id)
        except Exception:
            pass

    _, session = get_session(session_id)

    messages = build_lane1_prompt(
        user_message=message,
        incidents=incidents,
        stats=stats,
        location_name=location_name,
        lat=lat,
        lng=lng,
        conversation_history=session.messages,
        group_members=group_members,
        saved_places=saved_places,
        user_profile=user_profile,
        is_authenticated=user_id is not None,
        radius_miles=radius,
        days=days,
    )

    # Detect if user wants cards (explicit show/list) vs narrative
    is_card_request = _should_show_cards(message, member_names)

    if is_card_request and incidents:
        # Card mode: build cards server-side from REAL data, ask LLM only for summary
        summary_prompt = messages.copy()
        summary_prompt[-1] = {
            "role": "user",
            "content": (
                f"The user asked: \"{message}\"\n"
                f"There are {len(incidents)} incidents near {location_name or 'this location'} "
                f"in the last 30 days. Write a ONE-SENTENCE summary for a card header. "
                f"Do NOT return JSON. Just the summary sentence."
            ),
        }
        summary = await llm.call_lane1_no_stream(summary_prompt)
        # Strip any JSON the LLM might still return
        summary = summary.strip().strip('"')

        # Build card data from real DB incidents
        card_incidents = []
        for inc in incidents[:15]:
            card_incidents.append({
                "id": str(inc.get("id", "")),
                "category": inc.get("category", "other"),
                "description": inc.get("description", ""),
                "occurred_at": inc.get("occurred_at", ""),
                "source": inc.get("source", "unknown"),
                "verified": inc.get("verified", False),
                "lat": inc.get("lat", 0),
                "lng": inc.get("lng", 0),
                "location_name": inc.get("location_name", ""),
                "distance_miles": inc.get("distance_miles", 0),
            })

        card_data = {
            "mode": "cards",
            "summary": summary,
            "incidents": card_incidents,
        }
        yield json.dumps({"type": "cards", "data": card_data})
        full_response = json.dumps(card_data)
    else:
        # Text mode: stream and collect tokens in one pass (avoids double LLM call)
        yield json.dumps({"type": "stream_start", "lane": 1})
        collected_tokens = []
        async for token in llm.stream_lane1(messages):
            collected_tokens.append(token)
            yield json.dumps({"type": "token", "content": token})
        yield json.dumps({"type": "stream_end"})
        full_response = "".join(collected_tokens)

    # Update session state
    update_session(
        session_id,
        location_name=location_name,
        lat=lat,
        lng=lng,
        incidents=incidents[:10],
        lane=1,
        days=days,
        radius=radius,
        user_message=message,
        assistant_message=full_response,
    )


async def handle_lane2(
    message: str,
    session_id: str,
    user_id: str | None,
    user_lat: float | None = None,
    user_lng: float | None = None,
    cached_members: list[dict] | None = None,
) -> AsyncGenerator[str, None]:
    """Handle a Lane 2 (people/ReAct) query."""
    _, session = get_session(session_id)

    # Pre-fetch group data before entering ReAct loop
    prefetched_members = []
    prefetched_locations = {}
    saved_places = []
    user_profile = None

    if user_id:
        try:
            user_profile = await data_access.get_user_profile(user_id)
        except Exception:
            pass
        # Reuse cached members from handle_chat routing if available
        if cached_members is not None:
            prefetched_members = cached_members
        else:
            try:
                prefetched_members = await data_access.get_group_members(user_id)
            except Exception:
                pass
        try:
            saved_places = await data_access.get_saved_places(user_id)
        except Exception:
            pass

        # Pre-fetch live locations for all members
        for member in prefetched_members:
            member_uid = member.get("user_id")
            if member_uid:
                try:
                    loc = await data_access.get_live_location(member_uid)
                    if loc:
                        name = member.get("display_name", member_uid)
                        prefetched_locations[name] = loc
                except Exception:
                    pass

    messages = build_react_prompt(
        user_message=message,
        conversation_history=session.messages,
        prefetched_members=prefetched_members,
        prefetched_locations=prefetched_locations,
        saved_places=saved_places,
        user_profile=user_profile,
        last_person=session.last_person,
        is_authenticated=user_id is not None,
    )

    yield json.dumps({"type": "stream_start", "lane": 2})

    # Run ReAct loop (non-streaming, returns final answer + resolved locations)
    react_result = await run_react_loop(messages)
    answer = react_result.answer
    logger.info(f"[LANE2] resolved_locations={react_result.resolved_locations}")

    # Strip any card-mode JSON the LLM might return — cards are ALWAYS server-side
    # If the LLM tried to return cards, extract any location it resolved and build
    # real cards from the database instead
    try:
        parsed = json.loads(answer)
        if isinstance(parsed, dict) and parsed.get("mode") == "cards":
            # LLM tried to return cards — rebuild from real DB data
            answer = parsed.get("summary", "Here are the incidents I found.")
    except (json.JSONDecodeError, TypeError):
        pass

    # Emit as single text chunk (ReAct isn't streamed token-by-token)
    yield json.dumps({"type": "token", "content": answer})

    # Extract person name mentioned for follow-up context
    mentioned_person = None
    if prefetched_members:
        msg_lower = message.lower()
        for member in prefetched_members:
            name = member.get("display_name", "")
            if name and name.lower() in msg_lower:
                mentioned_person = name
                break

    # Resolve location for session: try ReAct-resolved, then prefetched person location
    resolved_lat = None
    resolved_lng = None
    resolved_loc_name = None

    # 1. From ReAct tool calls (if any happened)
    if react_result.resolved_locations:
        last_loc = react_result.resolved_locations[-1]
        resolved_lat = last_loc.get("lat")
        resolved_lng = last_loc.get("lng")
        resolved_loc_name = last_loc.get("address")

    # 2. From pre-fetched locations (covers the common case where LLM reads
    #    the person's location from the system prompt without making tool calls)
    if resolved_lat is None and mentioned_person and mentioned_person in prefetched_locations:
        person_loc = prefetched_locations[mentioned_person]
        resolved_lat = person_loc.get("lat")
        resolved_lng = person_loc.get("lng")
        # Reverse geocode for a human-readable name
        if resolved_lat and resolved_lng:
            try:
                resolved_loc_name = await geocoding.reverse_geocode(resolved_lat, resolved_lng)
            except Exception:
                resolved_loc_name = f"near {mentioned_person}"

    # 3. For pronoun follow-ups ("is he safe?"), use last_person from session
    if resolved_lat is None and not mentioned_person and session.last_person and session.last_person in prefetched_locations:
        person_loc = prefetched_locations[session.last_person]
        resolved_lat = person_loc.get("lat")
        resolved_lng = person_loc.get("lng")
        if resolved_lat and resolved_lng:
            try:
                resolved_loc_name = await geocoding.reverse_geocode(resolved_lat, resolved_lng)
            except Exception:
                resolved_loc_name = f"near {session.last_person}"

    # Emit person location card if we have location data for a mentioned person
    person_name = mentioned_person or session.last_person
    if person_name and resolved_lat and resolved_lng:
        # Always reverse geocode for a clean address (don't trust cached/stale values)
        card_address = resolved_loc_name
        if not card_address or card_address.replace("-", "").replace(".", "").replace(",", "").replace(" ", "").isdigit():
            try:
                card_address = await geocoding.reverse_geocode(resolved_lat, resolved_lng)
            except Exception:
                card_address = "Unknown location"
        yield json.dumps({
            "type": "person_location",
            "data": {
                "name": person_name,
                "lat": resolved_lat,
                "lng": resolved_lng,
                "address": card_address,
                "updated_ago": prefetched_locations.get(person_name, {}).get("updated_ago", ""),
                "is_stale": prefetched_locations.get(person_name, {}).get("is_stale", False),
            }
        })

    yield json.dumps({"type": "stream_end"})

    logger.info(f"[LANE2] saving to session: person={mentioned_person} lat={resolved_lat} lng={resolved_lng} loc={resolved_loc_name}")

    # Update session
    update_session(
        session_id,
        person=mentioned_person,
        location_name=resolved_loc_name,
        lat=resolved_lat,
        lng=resolved_lng,
        lane=2,
        user_message=message,
        assistant_message=answer,
    )


async def handle_chat(
    message: str,
    user_lat: float | None = None,
    user_lng: float | None = None,
    session_id: str | None = None,
    user_id: str | None = None,
) -> AsyncGenerator[str, None]:
    """Main entry point — routes to Lane 1 or Lane 2."""
    sid, session = get_session(session_id)
    logger.info(f"[CHAT] message={message!r} session_id={session_id} user_id={user_id}")
    logger.info(f"[CHAT] session state: last_lat={session.last_lat} last_lng={session.last_lng} last_loc={session.last_location_name} last_person={session.last_person} last_lane={session.last_lane}")

    # Always emit session_id first so frontend can persist it
    yield json.dumps({"type": "session", "session_id": sid})

    # Get group members once — reuse for routing and Lane 2 pre-fetch
    cached_members: list[dict] = []
    member_names: list[str] = []
    if user_id:
        try:
            cached_members = await data_access.get_group_members(user_id)
            member_names = [m.get("display_name", "") for m in cached_members if m.get("display_name")]
        except Exception:
            pass

    lane = classify_lane(message, session, member_names)
    logger.info(f"[CHAT] routed to Lane {lane} | member_names={member_names}")

    if lane == 2:
        async for event in handle_lane2(message, sid, user_id, user_lat, user_lng, cached_members):
            yield event
    else:
        # Extract location for Lane 1
        lat, lng, loc_name = await _extract_location(
            message, user_lat, user_lng, session.last_lat, session.last_lng,
            session.last_location_name, user_id,
        )
        logger.info(f"[CHAT] extracted location: lat={lat} lng={lng} name={loc_name}")
        if lat is None or lng is None:
            yield json.dumps({"type": "error", "content": "Could not determine location. Please include a location or enable GPS."})
            return
        async for event in handle_lane1(message, lat, lng, loc_name, sid, user_id, member_names):
            yield event
