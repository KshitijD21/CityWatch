"""ReAct loop for Lane 2 (people queries)."""
from __future__ import annotations
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from chat import data_access, geocoding, llm
from chat.geocoding import reverse_geocode, reverse_geocode_batch

logger = logging.getLogger("chat.react_loop")

MAX_ITERATIONS = 5
PHOENIX_TZ = ZoneInfo("America/Phoenix")


def _relative_time(iso_str: str) -> tuple[str, bool]:
    """Convert ISO timestamp to 'March 21, 3:15 PM MST (~2 hours ago)' + is_stale flag."""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        dt_phx = dt.astimezone(PHOENIX_TZ)
        date_str = dt_phx.strftime("%B %d, %I:%M %p MST")
        delta = datetime.now(timezone.utc) - dt
        minutes = int(delta.total_seconds() / 60)
        is_stale = minutes > 5
        if minutes < 1:
            rel = "just now"
        elif minutes < 60:
            rel = f"{minutes} minute{'s' if minutes != 1 else ''} ago"
        elif minutes < 1440:
            hours = minutes // 60
            rel = f"{hours} hour{'s' if hours != 1 else ''} ago"
        else:
            days = minutes // 1440
            rel = f"{days} day{'s' if days != 1 else ''} ago"
        return f"{date_str} (~{rel})", is_stale
    except Exception:
        return "unknown", True


@dataclass
class ReActResult:
    """Result from the ReAct loop including resolved locations."""
    answer: str = ""
    resolved_locations: list[dict] = field(default_factory=list)  # [{lat, lng, name, person}]


async def execute_tool(name: str, args: dict) -> str:
    """Execute a tool call and return the result as a JSON string."""
    try:
        if name == "geocode_location":
            result = await geocoding.geocode_location(args["place_name"])
            return json.dumps(result or {"error": "Location not found"})

        elif name == "get_nearby_incidents":
            # Enforce minimum 5mi radius (LLM sometimes passes 0.5 from old defaults)
            radius = max(args.get("radius_miles", 5.0), 5.0)
            radius = min(radius, 25.0)  # cap at 25mi
            result = await data_access.get_nearby_incidents(
                lat=args["lat"],
                lng=args["lng"],
                radius_miles=radius,
                days=args.get("days", 7),
            )
            # Reverse geocode incident locations before returning to LLM
            if result:
                coords = [(inc["lat"], inc["lng"]) for inc in result if "lat" in inc and "lng" in inc]
                if coords:
                    geo_map = await reverse_geocode_batch(coords)
                    for inc in result:
                        key = f"{inc['lat']:.4f},{inc['lng']:.4f}"
                        inc["location_name"] = geo_map.get(key, f"{inc['lat']:.4f}, {inc['lng']:.4f}")
                # Convert timestamps to Phoenix local time + relative
                for inc in result:
                    occurred = inc.get("occurred_at", "")
                    if occurred:
                        rel, _ = _relative_time(occurred)
                        inc["occurred_ago"] = rel
                        # Remove raw UTC timestamp — LLM should use occurred_ago
                        del inc["occurred_at"]
            # Truncate to avoid token explosion — list is sorted newest first
            return json.dumps(result[:20])

        elif name == "get_incident_stats":
            radius = max(args.get("radius_miles", 5.0), 5.0)
            radius = min(radius, 25.0)
            result = await data_access.get_incident_stats(
                lat=args["lat"],
                lng=args["lng"],
                radius_miles=radius,
                days=args.get("days", 7),
            )
            return json.dumps(result)

        elif name == "get_group_members":
            result = await data_access.get_group_members(args["user_id"])
            return json.dumps(result)

        elif name == "get_live_location":
            result = await data_access.get_live_location(args["member_user_id"])
            if not result:
                return json.dumps({"error": "Location not available"})
            # Reverse geocode the location
            lat = result.get("lat")
            lng = result.get("lng")
            if lat and lng:
                address = await reverse_geocode(lat, lng)
                result["address"] = address
            # Add relative staleness info
            updated = result.get("updated_at", "")
            if updated:
                rel, is_stale = _relative_time(updated)
                result["updated_ago"] = rel
                result["is_stale"] = is_stale
                # Remove raw UTC timestamp — LLM should use updated_ago instead
                del result["updated_at"]
            return json.dumps(result)

        elif name == "get_saved_places":
            result = await data_access.get_saved_places(args["user_id"])
            return json.dumps(result)

        else:
            return json.dumps({"error": f"Unknown tool: {name}"})

    except Exception as e:
        return json.dumps({"error": str(e)})


async def run_react_loop(messages: list[dict]) -> ReActResult:
    """Run the ReAct loop. Returns ReActResult with answer and resolved locations."""
    resolved_locations: list[dict] = []

    for _ in range(MAX_ITERATIONS):
        assistant_msg = await llm.call_react_step(messages)

        # If no tool calls, we have the final answer
        if "tool_calls" not in assistant_msg:
            return ReActResult(
                answer=assistant_msg.get("content", "I couldn't find the information needed."),
                resolved_locations=resolved_locations,
            )

        # Add assistant message with tool calls to conversation
        messages.append(assistant_msg)

        # Execute each tool call
        for tool_call in assistant_msg["tool_calls"]:
            fn_name = tool_call["function"]["name"]
            fn_args = json.loads(tool_call["function"]["arguments"])
            logger.info(f"[REACT] tool_call: {fn_name}({fn_args})")
            result_str = await execute_tool(fn_name, fn_args)
            logger.info(f"[REACT] tool_result ({fn_name}): {result_str[:200]}...")

            # Track resolved locations for session state
            try:
                result_data = json.loads(result_str)
                if fn_name == "get_live_location" and isinstance(result_data, dict) and "lat" in result_data:
                    resolved_locations.append({
                        "lat": result_data["lat"],
                        "lng": result_data["lng"],
                        "address": result_data.get("address"),
                    })
                elif fn_name == "geocode_location" and isinstance(result_data, dict) and "lat" in result_data:
                    resolved_locations.append({
                        "lat": result_data["lat"],
                        "lng": result_data["lng"],
                        "address": result_data.get("place_name"),
                    })
            except (json.JSONDecodeError, TypeError):
                pass

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call["id"],
                "content": result_str,
            })

    # Max iterations reached — force a final answer
    messages.append({
        "role": "user",
        "content": "You've used all available tool calls. Please provide your best answer now based on the data collected so far.",
    })
    final = await llm.call_react_step(messages)
    return ReActResult(
        answer=final.get("content", "I gathered some data but couldn't form a complete answer. Please try a more specific question."),
        resolved_locations=resolved_locations,
    )
