"""Two-lane routing logic — pure Python, no LLM call."""
from __future__ import annotations
import re
from chat.state import SessionState


# Keywords that trigger Lane 2 (people/group queries)
LANE2_KEYWORDS = [
    "my group", "my family", "everyone", "who is near",
    "compare", "all members", "my friends", "my people",
    "where is everyone", "is everyone safe",
    "my name", "who am i", "where do i stay", "where do i live",
    "my profile", "my location", "my home",
]


def classify_lane(
    message: str,
    session: SessionState,
    group_member_names: list[str] | None = None,
) -> int:
    """Determine which lane to route a message to.
    Returns 1 (simple location) or 2 (people/ReAct).
    """
    msg_lower = message.lower().strip()

    # Check if any group member name appears in the message
    if group_member_names:
        for name in group_member_names:
            if name.lower() in msg_lower:
                return 2

    # Check for Lane 2 keywords
    for keyword in LANE2_KEYWORDS:
        if keyword in msg_lower:
            return 2

    # Check conversation state: if previous turn was Lane 2, follow-ups stay in Lane 2
    if session.last_lane == 2:
        # Pronoun references to previously discussed person
        pronoun_patterns = [
            r"\b(he|she|they|them|his|her|their)\b",
            r"\b(which group|what group|same group)\b",
        ]
        for pattern in pronoun_patterns:
            if re.search(pattern, msg_lower):
                return 2

        # Short follow-up like "what about at night?" or "and Ronak?"
        if len(msg_lower.split()) <= 8:
            followup_patterns = [
                r"^(what about|and |how about|what\'s|is \w+ safe)",
                r"^(compare|near them|near \w+$)",
            ]
            for pattern in followup_patterns:
                if re.match(pattern, msg_lower):
                    return 2

    # Default: Lane 1
    return 1
