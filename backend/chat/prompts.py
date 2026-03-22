"""System prompts and prompt builders for the chat module."""
from __future__ import annotations
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

# Phoenix timezone (no DST — always MST / UTC-7)
PHOENIX_TZ = ZoneInfo("America/Phoenix")

SYSTEM_PROMPT = """You are CityWatch Safety Assistant. You help users understand safety conditions around locations using real incident data.

RESPONSE RULES:
- ALWAYS respond with plain text narrative. Do NOT return JSON — card display is handled by the system automatically.
- NEVER show raw latitude/longitude coordinates to the user. Use location names from the data context.
- NEVER show raw UTC timestamps. Show both the date AND relative time for each incident (e.g., "March 21 at 8:15 AM MST (~3 hours ago)"). Always include the calendar date.
- When the search radius differs from what the user asked, acknowledge it (e.g., "I checked within 25 miles, our maximum radius").
- ALWAYS use the DATA CONTEXT provided in the current message for listing incidents. The incident list is sorted NEWEST FIRST — item #1 is the most recent. When user asks for "latest" incidents, list them in the order given (starting from #1). Do NOT repeat old answers from conversation history.

SAFETY COMMUNICATION RULES:
- NEVER say an area is "safe" or "unsafe." Describe what was reported.
- Always cite specific numbers: "3 vehicle break-ins in the last 7 days."
- Always mention sources: "according to Phoenix PD data and 2 community reports."
- Mention time-of-day patterns when relevant.
- If responding about a person's location, mention when their location was last updated using relative time.
- If location data is older than 5 minutes, explicitly mention it may be stale.
- End every response about an area with: "Based on reported data. Conditions can change."
- Keep responses concise: 3-5 sentences for simple questions, more for comparisons.

CURRENT TIME: {current_time}
"""

REACT_SYSTEM_PROMPT = """You are CityWatch Safety Assistant with access to tools for looking up people, locations, and incidents.

You have these tools available:
- geocode_location(place_name): Returns lat, lng for a place name
- get_nearby_incidents(lat, lng, radius_miles, days): Returns up to 20 incidents SORTED NEWEST FIRST (includes location_name, occurred_ago with Phoenix MST date+time). The first item is the most recent.
- get_incident_stats(lat, lng, radius_miles, days): Returns category/time/source stats
- get_group_members(user_id): Returns group members list
- get_live_location(member_user_id): Returns lat, lng, address, updated_ago, is_stale
- get_saved_places(user_id): Returns saved places list

PROCESS:
1. Think about what data you need
2. If the data is already in PRE-FETCHED DATA, use it directly — do NOT call tools for data you already have
3. Call tools only for data that is NOT pre-fetched (e.g., incidents near a specific location)
4. Once you have enough data, provide a final answer as PLAIN TEXT only

IMPORTANT: When asked about ALL group members (e.g., "are my members safe", "where is everyone"), report the status of EACH member using the PRE-FETCHED LIVE LOCATIONS data. List each person's name, their location, and when it was last updated.

MULTIPLE GROUPS: If the user is in multiple groups, the PRE-FETCHED data shows members organized by group name. When the user says "show me my group members" or "my group", first tell them which groups they are in and list members per group. If they ask about a specific group, only show that group's members.

RESPONSE RULES:
- NEVER return JSON in your final answer. Always respond with plain text narrative.
- NEVER show raw latitude/longitude coordinates (like 33.4139, -111.9073) to the user.
- For person locations: ALWAYS use the "address" field from PRE-FETCHED LIVE LOCATIONS data (e.g., "near E University Dr, Tempe"). The address is already reverse-geocoded for you. Do NOT say "their last known area" or "his last known area" if an address is available in the pre-fetched data.
- NEVER show raw UTC timestamps. Use the "occurred_ago" field which contains Phoenix MST date+time+relative (e.g., "March 21, 08:15 AM MST (~3 hours ago)"). When listing incidents, list them in the order returned by the tool (newest first).
- When reporting someone's location, say something like "Ronak is near E University Dr, Tempe" NOT "Ronak's location was last updated at 33.4139, -111.9073".
- If a location has "is_stale": true, explicitly mention it may be outdated.

FORMATTING RULES FOR MULTI-PERSON QUERIES:
When the user asks about multiple people (e.g., "find where each member is and show incidents near them"):
- Use a clear header for EACH person (e.g., "**Ronak**" or "### Ronak")
- Under each person, first show their location using the "address" field from PRE-FETCHED LIVE LOCATIONS (e.g., "Near E University Dr, Tempe"), then list their nearby incidents as a numbered list
- If the user asks for "top N incidents", show EXACTLY N incidents per person — no more, no less
- Do NOT repeat the same incident under the same person. Each incident should appear only once per person.
- Do NOT dump all incidents in one flat list at the end — keep them grouped under each person
- If a person has no nearby incidents, say "No recent incidents nearby."
- If multiple people are in the same area and have the same nearby incidents, still list them separately under each person (but only the requested count)

SAFETY COMMUNICATION RULES:
- NEVER say an area is "safe" or "unsafe." Describe what was reported.
- Always cite specific numbers: "3 vehicle break-ins in the last 7 days."
- Always mention sources: "according to Phoenix PD data and 2 community reports."
- Mention time-of-day patterns when relevant.
- If responding about a person's location, mention when their location was last updated using the relative time (e.g., "2 minutes ago").
- If location data is stale (is_stale: true), explicitly mention it may be outdated.
- End every response about an area with: "Based on reported data. Conditions can change."
- Keep responses concise: 3-5 sentences for simple questions, more for comparisons.

CURRENT TIME: {current_time}
"""


def build_lane1_prompt(
    user_message: str,
    incidents: list[dict],
    stats: dict,
    location_name: str | None,
    lat: float,
    lng: float,
    conversation_history: list[dict] | None = None,
    group_members: list[dict] | None = None,
    saved_places: list[dict] | None = None,
    user_profile: dict | None = None,
    is_authenticated: bool = False,
    radius_miles: float = 5.0,
    days: int = 7,
) -> list[dict]:
    """Build the messages list for a Lane 1 (simple) chat call."""
    now = datetime.now(PHOENIX_TZ).strftime("%B %d, %Y %I:%M %p MST")
    system = SYSTEM_PROMPT.format(current_time=now)

    if not is_authenticated:
        system += "\n\nIMPORTANT: The user is NOT logged in. You do NOT know who they are. Do NOT say \"your location\", \"near you\", or reference any personal data. If the user says \"my name\" or \"where do I stay\", tell them to log in first. Use the default/searched location but be transparent about it (e.g., \"showing incidents near Downtown Phoenix\")."

    context_parts = []
    if user_profile:
        name = user_profile.get("display_name") or user_profile.get("email", "Unknown")
        context_parts.append(f"CURRENT USER: {name}")
    loc_label = location_name or f"({lat:.4f}, {lng:.4f})"
    context_parts.append(f"LOCATION: {loc_label} (lat={lat}, lng={lng})")
    context_parts.append(f"INCIDENTS NEARBY ({radius_miles}mi radius, last {days} days): {len(incidents)} total")

    if incidents:
        # Show the 20 MOST RECENT incidents (list is already sorted newest-first)
        context_parts.append("MOST RECENT INCIDENTS (newest first):")
        for i, inc in enumerate(incidents[:20], 1):
            cat = inc.get("category", "unknown")
            desc = inc.get("description", "")[:80]
            src = inc.get("source", "unknown")
            loc = inc.get("location_name", "")
            loc_str = f", location: {loc}" if loc else ""
            # Compute both calendar date (Phoenix time) and relative time
            when = inc.get("occurred_at", "")
            if when:
                try:
                    from datetime import datetime as _dt, timezone as _tz
                    _occurred_utc = _dt.fromisoformat(when.replace("Z", "+00:00"))
                    _occurred_phx = _occurred_utc.astimezone(PHOENIX_TZ)
                    _date_str = _occurred_phx.strftime("%B %d, %I:%M %p MST")
                    _delta = _dt.now(_tz.utc) - _occurred_utc
                    _mins = int(_delta.total_seconds() / 60)
                    if _mins < 60:
                        _rel = f"{_mins} minutes ago"
                    elif _mins < 1440:
                        _rel = f"{_mins // 60} hours ago"
                    else:
                        _rel = f"{_mins // 1440} days ago"
                    when_str = f"{_date_str} (~{_rel})"
                except Exception:
                    when_str = when
            else:
                when_str = "unknown time"
            context_parts.append(f"  {i}. [{cat}] {desc} (source: {src}, {when_str}{loc_str})")
        if len(incidents) > 20:
            context_parts.append(f"  ... and {len(incidents) - 20} more")

    if stats:
        context_parts.append(f"STATS BY CATEGORY: {stats.get('by_category', {})}")
        context_parts.append(f"STATS BY SOURCE: {stats.get('by_source', {})}")
        context_parts.append(f"STATS BY TIME OF DAY: {stats.get('by_time', {})}")

    if group_members:
        context_parts.append(f"USER'S GROUP MEMBERS: {group_members}")
    if saved_places:
        context_parts.append(f"USER'S SAVED PLACES: {saved_places}")

    context_block = "\n".join(context_parts)

    messages: list[dict] = [{"role": "system", "content": system}]

    # Add conversation history (last 3 turns)
    if conversation_history:
        for msg in conversation_history[-6:]:  # 3 turns = 6 messages
            messages.append(msg)

    messages.append({
        "role": "user",
        "content": f"DATA CONTEXT:\n{context_block}\n\nUSER QUESTION: {user_message}",
    })

    return messages


def build_react_prompt(
    user_message: str,
    conversation_history: list[dict] | None = None,
    prefetched_members: list[dict] | None = None,
    prefetched_locations: dict | None = None,
    saved_places: list[dict] | None = None,
    user_profile: dict | None = None,
    last_person: str | None = None,
    is_authenticated: bool = False,
) -> list[dict]:
    """Build the messages list for a Lane 2 (ReAct) chat call."""
    now = datetime.now(PHOENIX_TZ).strftime("%B %d, %Y %I:%M %p MST")
    system = REACT_SYSTEM_PROMPT.format(current_time=now)

    if not is_authenticated:
        system += "\n\nIMPORTANT: The user is NOT logged in. You have no access to their identity, groups, saved places, or friends' locations. If they ask about personal data (\"my name\", \"where is Anirudh\", \"my group\"), tell them they need to log in first to use those features."

    # Inject pre-fetched data so Claude doesn't waste iterations
    prefetch_parts = []
    if last_person:
        prefetch_parts.append(f"CONVERSATION CONTEXT: The user was previously asking about \"{last_person}\". If they say \"he\", \"she\", \"they\", or \"them\", they likely mean {last_person}.")
    if user_profile:
        name = user_profile.get("display_name") or user_profile.get("email", "Unknown")
        prefetch_parts.append(f"CURRENT USER: name={name}, id={user_profile.get('id', '')}")
    if prefetched_members:
        # Organize members by group
        groups: dict[str, list[str]] = {}
        for m in prefetched_members:
            name = m.get("display_name", "Unknown")
            uid = m.get("user_id", "")
            role = m.get("role", "member")
            group_name = m.get("group_name", "Unknown Group")
            if group_name not in groups:
                groups[group_name] = []
            groups[group_name].append(f"  - {name} (user_id={uid}, role={role})")
        member_lines = []
        for gname, members_list in groups.items():
            member_lines.append(f"  Group: {gname}")
            member_lines.extend(members_list)
        prefetch_parts.append("PRE-FETCHED GROUP MEMBERS (organized by group):\n" + "\n".join(member_lines))
    if prefetched_locations:
        loc_summaries = []
        for name, loc in prefetched_locations.items():
            addr = loc.get("address", "unknown location")
            lat = loc.get("lat")
            lng = loc.get("lng")
            updated_ago = loc.get("updated_ago", "unknown")
            is_stale = loc.get("is_stale", False)
            stale_note = " (STALE — may be outdated)" if is_stale else ""
            coords_note = f", coords=({lat}, {lng})" if lat and lng else ""
            loc_summaries.append(f"  - {name}: near {addr}{coords_note}, last updated {updated_ago}{stale_note}")
        prefetch_parts.append("PRE-FETCHED LIVE LOCATIONS (use these directly, no tool call needed — use the coords for get_nearby_incidents):\n" + "\n".join(loc_summaries))
    if saved_places:
        prefetch_parts.append(f"USER'S SAVED PLACES: {saved_places}")

    if prefetch_parts:
        system += "\n\nPRE-FETCHED DATA (already available, no tool call needed):\n"
        system += "\n".join(prefetch_parts)

    messages: list[dict] = [{"role": "system", "content": system}]

    if conversation_history:
        for msg in conversation_history[-6:]:
            messages.append(msg)

    messages.append({"role": "user", "content": user_message})

    return messages
