"""LLM calls via OpenAI API. Swap to Claude later by changing client/model."""
from __future__ import annotations
import json
from typing import AsyncGenerator
from openai import AsyncOpenAI
from config import OPENAI_API_KEY

# Models — Lane 1 uses cheaper, Lane 2 uses smarter
LANE1_MODEL = "gpt-4o-mini"   # cheap, good at summarization
LANE2_MODEL = "gpt-4o"        # smarter, good at tool use

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    return _client


# Tool definitions for Lane 2 (ReAct)
REACT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "geocode_location",
            "description": "Geocode a place name to lat/lng coordinates",
            "parameters": {
                "type": "object",
                "properties": {
                    "place_name": {"type": "string", "description": "Name of the place to geocode"},
                },
                "required": ["place_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_nearby_incidents",
            "description": "Get incidents near a lat/lng within a radius over recent days. Returns incidents with location_name (street address) and occurred_ago (relative time).",
            "parameters": {
                "type": "object",
                "properties": {
                    "lat": {"type": "number"},
                    "lng": {"type": "number"},
                    "radius_miles": {"type": "number", "default": 5.0, "description": "Search radius in miles (max 25)"},
                    "days": {"type": "integer", "default": 7, "description": "Number of days to look back (default 7)"},
                },
                "required": ["lat", "lng"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_incident_stats",
            "description": "Get aggregated incident stats (by category, time, source) near a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "lat": {"type": "number"},
                    "lng": {"type": "number"},
                    "radius_miles": {"type": "number", "default": 5.0, "description": "Search radius in miles (max 25)"},
                    "days": {"type": "integer", "default": 7, "description": "Number of days to look back (default 7)"},
                },
                "required": ["lat", "lng"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_group_members",
            "description": "Get all group members for the current user",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string"},
                },
                "required": ["user_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_live_location",
            "description": "Get the live location of a group member. Returns address (street name), updated_ago (relative time), and is_stale flag.",
            "parameters": {
                "type": "object",
                "properties": {
                    "member_user_id": {"type": "string"},
                },
                "required": ["member_user_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_saved_places",
            "description": "Get saved places (home, work, school) for a user",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string"},
                },
                "required": ["user_id"],
            },
        },
    },
]


async def stream_lane1(messages: list[dict]) -> AsyncGenerator[str, None]:
    """Stream a Lane 1 response (simple, no tools)."""
    client = _get_client()
    stream = await client.chat.completions.create(
        model=LANE1_MODEL,
        messages=messages,
        stream=True,
        temperature=0.3,
        max_tokens=1024,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content


async def call_lane1_no_stream(messages: list[dict]) -> str:
    """Non-streaming Lane 1 call (for card mode detection)."""
    client = _get_client()
    resp = await client.chat.completions.create(
        model=LANE1_MODEL,
        messages=messages,
        temperature=0.3,
        max_tokens=1024,
    )
    return resp.choices[0].message.content or ""


async def call_react_step(messages: list[dict]) -> dict:
    """Single ReAct step — returns the assistant message (may include tool_calls)."""
    client = _get_client()
    resp = await client.chat.completions.create(
        model=LANE2_MODEL,
        messages=messages,
        tools=REACT_TOOLS,
        temperature=0.2,
        max_tokens=1024,
    )
    msg = resp.choices[0].message
    result: dict = {"role": "assistant", "content": msg.content or ""}

    if msg.tool_calls:
        result["tool_calls"] = [
            {
                "id": tc.id,
                "type": "function",
                "function": {
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                },
            }
            for tc in msg.tool_calls
        ]
    return result
