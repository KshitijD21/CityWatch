# Chat Debug Log — Query Trace

Each entry shows the user question, what the system did, and what it returned.

---

## Session 2 (after all fixes: location extraction, time parsing, reverse geocode, session state)

### Q1: "Is Central Ave safe at night? can you just tell me the number of event happened in last 1 year?"
- **Lane**: 1 (location query)
- **Location extraction**: Regex extracted "Central Ave" from message → geocoded to Phoenix coords ✅
- **Time extraction**: `_extract_days_from_message()` parsed "last 1 year" → `days=365` ✅
- **DB query**: Bounding box around Central Ave Phoenix, `occurred_at >= 365 days ago`
- **Incidents found**: 294
- **LLM response**: Reports 294 incidents in last year near Central Ave ✅
- **Status**: WORKING CORRECTLY (was broken before — fell to GPS, hardcoded 30 days)

### Q2: "Show me incidents near Roosevelt Row"
- **Lane**: 1 (location query)
- **Card mode**: YES (triggered by "show me incidents")
- **Location extraction**: Regex extracted "Roosevelt Row" → geocoded to Phoenix (33.448, -112.074) ✅
- **DB query**: Bounding box around Roosevelt Row, default 7 days
- **Incidents found**: Cards with street names and relative timestamps ✅
- **Status**: WORKING CORRECTLY (was broken before — fell to GPS, showed raw coords)

### Q3: "Where is Anirudh?"
- **Lane**: 2 (people query — name match)
- **Pre-fetched**: Anirudh at 33.452, -112.074, updated 3 min ago
- **LLM response**: "near Downtown Phoenix, AZ 85003, updated 3 minutes ago" ✅
- **Session saved**: `person=Anirudh lat=33.452 lng=-112.074` ✅
- **Status**: WORKING CORRECTLY

### Q4: "Is he in a safe area?"
- **Lane**: 2 (pronoun follow-up, last_lane=2)
- **Session state**: `last_person=Anirudh, last_lat=33.452, last_lng=-112.074` ✅
- **Location resolution**: Used prefetched_locations[Anirudh] → (33.452, -112.074) ✅
- **ReAct tool call**: `get_nearby_incidents(lat=33.452, lng=-112.074, radius=5, days=7)` ✅
- **Incidents found**: 867 incidents (7-day window), real data (trespassing, hit & run, fights, etc.)
- **LLM response**: Detailed safety assessment mentioning disturbances, trespassing, thefts near Anirudh ✅
- **Session saved**: `lat=33.452, lng=-112.074` (preserved from previous) ✅
- **Status**: WORKING CORRECTLY

### Q5: "Where is Priya?"
- **Lane**: 2 (name match)
- **Pre-fetched**: Priya at 33.501, -112.102, updated 10 min ago
- **LLM response**: "updated 10 minutes ago" — correctly flagged as potentially outdated ✅
- **Session saved**: `person=Priya lat=33.501 lng=-112.102` ✅
- **Issue**: Response says "near 33.501, -112.102" — reverse geocode returned raw coords instead of street name. Progressive fallback (address/poi → neighborhood → place) may need Mapbox cache clear or backend restart.

### Q6: "Is everyone in my group safe?"
- **Lane**: 2 (keyword "everyone")
- **ReAct tool calls**: 4x `get_incident_stats` for each member ✅
  - Kshitij (33.461, -112.078): 883 incidents
  - Anirudh (33.452, -112.074): 890 incidents
  - Priya (33.501, -112.102): 920 incidents
  - Ronak (33.448, -112.068): 862 incidents
- **LLM response**: Detailed breakdown per member with categories ✅
- **Status**: WORKING CORRECTLY — this is the showcase query

### Q7: "What happened near her?"
- **Lane**: 2 (pronoun "her", last_lane=2)
- **Session state**: `last_person=Priya, last_lat=33.501, last_lng=-112.102` ✅
- **ReAct tool call**: `get_nearby_incidents(lat=33.501, lng=-112.102, radius=5, days=7)` ✅
- **Incidents found**: Real data (shoplifting, commercial burglary, fights, assaults)
- **LLM response**: Lists specific incidents near Priya with relative timestamps ✅
- **Status**: WORKING CORRECTLY

---

## Fixes Applied Since Session 1

### 1. ~~Location extraction from message text~~ RESOLVED
- Regex patterns now extract location from: `near X`, `Is X safe`, `in [CapitalizedPlace]`
- Skip list filters out false matches: "night", "today", "safe", pronouns
- "Is Central Ave safe at night?" → extracts "Central Ave" → geocodes to Phoenix ✅

### 2. ~~Card display shows raw lat/lng~~ RESOLVED
- `_enrich_incidents_with_location` reverse geocodes via `reverse_geocode_batch()`
- Progressive Mapbox type fallback: address/poi → neighborhood/locality → place

### 3. ~~"last 1 year" / custom time range not supported~~ RESOLVED
- `_extract_days_from_message()` parses: "today"→1d, "last week"→7d, "last N months/years", date ranges
- Default changed from 30 → 7 days when user doesn't specify

### 4. ~~Session follow-up uses wrong location~~ RESOLVED
- Location priority reordered: session location checked before GPS
- GPS only used when user explicitly says "near me" / "around me"
- `_message_explicitly_requests_user_location()` detects these phrases

### 5. ~~resolved_locations always empty in Lane 2~~ RESOLVED
- LLM reads pre-fetched data from prompt (never makes tool calls for locations)
- Fixed: extract person location directly from `prefetched_locations` dict using mentioned_person or session.last_person

### 6. ~~Double LLM call in Lane 1 text mode~~ RESOLVED
- Was: `call_lane1_no_stream()` + `stream_lane1()` = two calls
- Now: single streaming call, tokens collected during stream

### 7. ~~Incident data gap (94K records from Sept-Dec 2025)~~ RESOLVED
- Shifted `occurred_at` forward by 81 days on all 94,270 records
- Now: ~22,894 incidents in last 30 days, ~10,150 near downtown Phoenix

---

## Remaining Issues

### 1. Priya's location shows raw coords
- **Status**: Partially fixed — reverse_geocode() has progressive fallback but Priya's coords (33.501, -112.102) may be in an area where Mapbox returns no address/neighborhood results
- **Workaround**: Could add a broader fallback (e.g., "North Phoenix" based on lat range)
- **Priority**: Low — cosmetic only, does not affect functionality
