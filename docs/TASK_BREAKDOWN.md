STREETSENSE — TASK BREAKDOWN
==============================


=========================================================
FRONTEND
=========================================================

F1. MAP PAGE (Home Screen — No Auth Required)
---------------------------------------------
This is the first thing anyone sees. No login wall.

Build a full-screen map that loads on the root URL.
On load, ask for browser location permission.
If granted, center map on user's location.
If denied, default to Phoenix city center.

Fetch incidents from backend based on current map bounds.
When user pans or zooms, fetch new incidents for the new bounds.
Don't fetch on every tiny move — debounce by 500ms.

Render each incident as a colored pin on the map:
  Red pin = assault, harassment
  Orange pin = theft, disturbance
  Yellow pin = community report (unverified)
  Blue pin = infrastructure (streetlight out, etc.)

Each pin shows a tiny label on hover: category + time ago.

If user is signed in AND has a group:
  Also fetch group members' live locations from backend.
  Render each member as a named dot (different from event pins).
  Fetch incidents near each member (0.25 mile radius).
  Show those pins around the member's dot.

Search bar at the top: type any address or place name.
On search, geocode the address and fly the map there.


F2. EVENT DETAIL CARD
---------------------
When user taps any pin on the map, a card slides up from bottom.

The card calls the backend to get full incident details.

Card shows:
  Category icon + name (e.g. "Vehicle Break-in")
  Time (e.g. "2 hours ago" or "March 19, 8:30pm")
  Source badge:
    Green badge = "Phoenix PD" (official)
    Blue badge = "AZCentral" (news)
    Yellow badge = "Community Report" (with verified/unverified tag)
  Distance from user (e.g. "0.3 miles from you")
  If signed in: distance from group member (e.g. "0.2 miles from Alex")
  Description snippet if available

Two buttons at the bottom of the card:
  "View area brief" → navigates to the brief page for that location
  "Ask about this area" → opens chat with pre-filled message:
    "What's been happening near [this location] recently?"

Tapping outside the card closes it.


F3. CHAT PAGE
-------------
Works without signup. Anyone can use it.

Full chat interface with:
  Message list (scrollable, newest at bottom)
  Text input at the bottom with send button
  Quick prompt buttons above the input:
    "What's happening near me?"
    "Any issues near downtown Phoenix?"
    "What happened near ASU this week?"

When user sends a message:
  Show their message in the chat immediately.
  Show a typing indicator.
  Call the backend chat endpoint with:
    - The message text
    - User's current lat/lng (from browser geolocation)
    - User's auth token (if signed in, for group context)
  Backend streams the response via SSE.
  Frontend reads the stream and renders word by word.

After response is complete:
  Show source citations if the response includes them.
  Each source is tappable — could link to "How we know this."

If user came from an event card ("Ask about this area"):
  Pre-fill the input with the location question.
  Auto-send it so the user sees the response immediately.

Chat history stays in memory during the session.
No need to persist chat history to database for hackathon.


F4. AREA SAFETY BRIEF PAGE
---------------------------
Accessible by:
  Tapping "View area brief" on an event card
  Searching an address and tapping "Get brief"
  Tapping a saved place (if signed in)

On load, calls the backend brief endpoint with lat/lng.

Shows a loading skeleton while Claude generates the brief.

Renders the brief in sections:

  Section 1: "What to know"
  Plain text summary from Claude. 2-3 sentences.

  Section 2: "Time of day matters"
  Three rows:
    Daytime (6am-6pm): description
    Evening (6pm-11pm): description
    Late night (11pm-6am): description
  Each row has an icon and a short sentence.

  Section 3: "For your group" (ONLY if signed in with a group)
  Personalized sentence about group members in this area.
  If no group member is relevant to this area, hide this section.

  Section 4: "How we know this" (expandable/collapsible)
  Click to expand. Shows:
    Source list: "Phoenix PD: 23 reports" / "Community: 5 reports"
    Category breakdown: "Theft: 12, Vehicle break-in: 8, Vandalism: 3"
    Radius note: "Reports from within 0.5 miles"
    Last updated timestamp

  Footer disclaimer (always visible, not inside the expandable):
  "Based on reported data — conditions change. Not a prediction."

"Ask about this area" button at the bottom → opens chat pre-filled.


F5. COMMUNITY REPORT FORM
--------------------------
Requires signup to submit (but the form itself can be visible).

Floating action button on the map (bottom right corner).
Tapping it opens a modal / bottom sheet.

If user is not signed in:
  Show message: "Sign in to submit a report" with login button.

If signed in, show the form:

  Title: "What did you observe?"
  Subtitle: "Reports are about conditions, not people"

  Category selection (pick one):
    Streetlight out / broken
    Unusual police activity
    I felt unsafe here
    Heard disturbance
    Vehicle break-in
    Other safety concern

  Description textarea (optional)
  Placeholder: "Describe what you observed (optional)"

  Warning box (always visible, not dismissable):
  "Please do NOT include descriptions of specific people,
  license plates, or addresses of private residences."

  Location: auto-detected from GPS, shown on a mini map.
  Draggable pin to adjust if location is wrong.

  Time: auto-detected, shown as editable field.

  Submit button.

On submit:
  Call backend POST /api/reports
  Close the modal
  Show the new pin on the map immediately with yellow "Unverified" tag
  Show toast: "Report submitted. It will be verified shortly."

If backend returns an error, show error toast and keep modal open.


F6. AUTH PAGES (Only needed for group features + reporting)
-----------------------------------------------------------
Login page:
  Google OAuth button
  Email + password form
  "Don't have an account? Sign up" link
  "Continue without account" link → goes back to map

Signup page:
  Google OAuth button
  Email + password + name form
  Age band dropdown (child / teen / young adult / adult)
  "Already have an account? Log in" link

On successful login/signup:
  If user.onboarded is false → go to onboarding
  If user.onboarded is true → go back to map with group features active


F7. ONBOARDING (Only after first signup)
-----------------------------------------
Step 1 — Ethical modal
  "Before we start"
  "StreetSense shows you reported safety data. We show what was
  reported, not what will happen. We don't predict. We don't assign
  safety scores. You decide what this information means for you."
  Button: "I understand"

Step 2 — Create a group
  Input: Group name (e.g. "The Parkers")
  Select: Group type (Family / Friends)
  Button: "Create group"

Step 3 — Add members
  For each member:
    Name input
    Age band dropdown
  "Add another member" button
  Must add at least 1 member.
  Note shown: "They'll join later via invite link"

Step 4 — Add saved places
  For each place:
    Name input (Home / School / Work / Custom)
    Address input with autocomplete (geocoded via backend)
  Must add at least 1 place.
  "Add another place" button

On complete:
  Call backend to set user.onboarded = true
  Redirect to map with group features now active


F8. GROUP MANAGEMENT PAGE (Signed-in only)
-------------------------------------------
Accessible from a menu or profile icon.

Shows list of user's groups. Each group card shows:
  Group name
  Type badge (Family / Friends)
  Member count
  "Active now" count (members currently sharing location)

Tap a group → see member list:
  Each member shows:
    Name
    Age band
    Sharing status (green dot = sharing, gray = not sharing)
  If the member is a placeholder (hasn't joined yet):
    Show "Invite pending" tag

Your own sharing toggle:
  Switch to turn your location sharing on/off for this group.
  When you turn it on: browser starts sending GPS to backend.
  When you turn it off: GPS stops, your dot disappears for others.

"Invite" button:
  Generates invite link (e.g. app.com/join/ABC123)
  Copy to clipboard

"Create new group" button:
  Opens a small form: name + type
  Creates group and shows it in the list


F9. JOIN GROUP PAGE
-------------------
URL: /join/[invite_code]

If not signed in:
  Show: "Join [group name]" with login/signup buttons.
  After auth, auto-join the group.

If signed in:
  Show: "Join [group name]?" with confirm button.
  On confirm, add user to group and redirect to map.


=========================================================
BACKEND
=========================================================

B1. INCIDENT ENDPOINTS (No Auth — Public)
------------------------------------------
GET /api/incidents/nearby
  Query params: lat, lng, radius (miles), days
  Logic:
    Run Haversine distance query on incidents table
    Filter by occurred_at > NOW() - days
    Filter by distance < radius
    Return list of incidents with distance from query point
  Returns: [{ id, category, description, lat, lng, occurred_at,
              source, verified, report_count, distance_miles }]

  This is THE query. Everything uses it.

GET /api/incidents/:id
  Returns full incident detail including linked sources from
  incident_sources table.

GET /api/incidents/bounds
  Query params: north, south, east, west, days
  Logic: simple lat/lng bounding box query (faster than Haversine
  for map viewport loading — use Haversine for precision queries)
  Returns: incidents within the map viewport
  This is what the map calls when user pans/zooms.

GET /api/incidents/stats
  Query params: lat, lng, radius, days
  Logic: same spatial query but returns aggregated stats:
    Group by category → count per category
    Group by source → count per source
    Group by time_of_day bucket (daytime/evening/late_night)
  Returns: { by_category: {...}, by_source: {...}, by_time: {...},
             total_count, sources: [...] }
  This powers the "How we know this" section.


B2. CHAT ENDPOINT (No Auth Required — Auth Optional)
-----------------------------------------------------
POST /api/chat
  Body: { message, user_lat, user_lng }
  Headers: Authorization (optional — if signed in)

  Logic:
    Step 1: Extract location from the message.
      Try to find a place name in the message.
      Call Mapbox Geocoding API to turn it into coordinates.
      If no place name found, use user_lat/user_lng as fallback.

    Step 2: Fetch incidents.
      Call the spatial query: 0.5 mile radius, last 7 days.
      Also fetch stats (by_category, by_time, by_source).

    Step 3: Build prompt for Claude.
      System prompt: rules about calm language, citing sources,
      never saying safe/unsafe, keeping responses concise.
      User context: the incident data as JSON, current time,
      the user's original question.
      If user is signed in: include their saved places and
      group member patterns for personalization.

    Step 4: Call Claude API with streaming.
      Use Anthropic SDK streaming mode.
      As each text chunk arrives, yield it as an SSE event.

    Step 5: Return as SSE stream.
      Frontend reads the stream and shows word by word.

  Returns: Server-Sent Events stream of text chunks.


B3. BRIEF ENDPOINT (No Auth Required — Auth Optional)
------------------------------------------------------
GET /api/briefs/generate
  Query params: lat, lng, address (optional for display)
  Headers: Authorization (optional)

  Logic:
    Step 1: Check brief_cache table.
      Round lat/lng to 3 decimal places.
      Look for a cached brief that hasn't expired (1 hour TTL).
      If found, return cached version immediately.

    Step 2: If no cache hit, fetch data.
      Spatial query: 0.5 mile radius, last 30 days.
      Get stats: by_category, by_source, by_time_of_day.

    Step 3: Build prompt for Claude.
      System prompt: rules for brief generation.
      Include: raw incident data, category breakdown, time
      breakdown, current time of day.
      If user is signed in: include group context (which members
      have saved places near this location, their patterns).

    Step 4: Call Claude API (non-streaming is fine for briefs).
      Parse response into structured sections:
        summary, time_breakdown, household_context, disclaimer.

    Step 5: Cache the result.
      Store in brief_cache with lat_rounded, lng_rounded,
      the full response JSON, and expires_at = now + 1 hour.

    Step 6: Return structured brief.

  Returns: {
    summary: "...",
    time_breakdown: {
      daytime: "...",
      evening: "...",
      late_night: "..."
    },
    household_context: "..." or null,
    sources: [{ name, type, count }],
    incident_count: 28,
    disclaimer: "Based on reported data — conditions change."
  }


B4. COMMUNITY REPORT ENDPOINTS (Auth Required)
------------------------------------------------
POST /api/reports
  Body: { category, description, lat, lng, reported_at }
  Headers: Authorization (required)

  Logic:
    Step 1: Validate input.
      Category must be in allowed list.
      Description must not be empty if provided.
      Lat/lng must be valid coordinates.

    Step 2: Save to community_reports table.
      Status = "unverified"
      linked_incident_id = null

    Step 3: Also create a record in incidents table.
      Source = "community"
      Verified = false
      This makes the pin show on the map immediately.
      Save the incident_id back to community_reports.linked_incident_id.

    Step 4: Broadcast via realtime.                    ← WEBHOOK/REALTIME
      Push a "new_event" message to the realtime channel
      for this geographic area so other users' maps update
      immediately without refreshing.

    Step 5: Trigger AI verification as background task.
      Don't block the response — return success to user immediately.
      Run verification asynchronously (see B6).

  Returns: { report_id, incident_id, status: "unverified" }

GET /api/reports/nearby
  Query params: lat, lng, radius, days
  Returns community reports near a location with their status.

PUT /api/reports/:id/flag
  Headers: Authorization (required)
  Logic: increment flagged_by_users count on the report.
  If flagged_by_users >= 3, auto-change status to "flagged."


B5. AUTH AND USER ENDPOINTS (Auth Required)
--------------------------------------------
POST /api/auth/signup
  Body: { email, password, name, age_band }
  Logic: create user via InsForge auth SDK.
  Returns: { user_id, token }

POST /api/auth/login
  Body: { email, password } or { google_token }
  Logic: verify via InsForge auth.
  Returns: { user_id, token, onboarded }

GET /api/auth/me
  Headers: Authorization
  Returns: user profile + groups + saved places

PUT /api/auth/me
  Body: { name, age_band, notification_prefs }
  Updates user profile.

PUT /api/auth/me/onboarded
  Sets onboarded = true after completing onboarding.


B6. AI VERIFICATION (Background Task — Not An Endpoint)
--------------------------------------------------------
This is NOT called by the frontend. It runs automatically
after a community report is submitted (triggered by B4).

  Step 1: Get the new report details.

  Step 2: Fetch official incidents within 0.5 miles, last 7 days.

  Step 3: Fetch other community reports within 0.25 miles, last 7 days.

  Step 4: Send to Claude with verification prompt:
    "Here is a user-submitted report. Here are official police
    reports from the same area. Here are other community reports.
    Assess:
    1. Is this plausible for this area and time?
    2. Does it match or correlate with official data?
    3. Are there corroborating community reports?
    4. Does the description target specific people or contain
       racial/ethnic descriptions?
    Respond with JSON:
    { status: verified/unverified/flagged, reason: '...' }"

  Step 5: Parse Claude's response.

  Step 6: Update community_reports table:
    Set status to Claude's verdict.
    Set verification_note to Claude's reason.

  Step 7: If status = "verified":
    Update the linked incident in incidents table:
      Set verified = true
      Set verification_note

  Step 8: If status = "flagged":
    Update the linked incident:
      Set verified = false
    Optionally hide the pin from the map or mark it specially.

  Step 9: Run clustering check (see B7).

  Step 10: Broadcast update via realtime.              ← WEBHOOK/REALTIME
    Push "event_updated" to the area channel so the pin
    on other users' maps changes from yellow to verified
    or disappears if flagged.


B7. CLUSTERING LOGIC (Background Task — Runs After B6)
-------------------------------------------------------
Also NOT an endpoint. Runs automatically after verification.

  Step 1: Take the report's lat/lng.

  Step 2: Query community_reports:
    Within 0.25 miles
    Last 7 days
    Status != "flagged"
    Group by rounded lat/lng (3 decimal places)

  Step 3: If count >= 3 for this cluster:
    Find or create a single incident record for this cluster.
    Set report_count = count of reports in cluster.
    Set verified = true.
    Set category = most common category in the cluster.
    Set description = "Community signal: [count] reports of
      [category] in this area this week."
    Link all community_reports in this cluster to this incident.

  Step 4: Broadcast via realtime.                      ← WEBHOOK/REALTIME
    Push "community_signal" event so the map shows the
    clustered pin with count badge.


B8. GROUP ENDPOINTS (Auth Required)
------------------------------------
POST /api/groups
  Body: { name, type }
  Logic:
    Generate random 6-character invite_code.
    Create group record.
    Add current user as admin in group_members.
  Returns: { group_id, invite_code }

GET /api/groups
  Returns all groups the current user belongs to.

GET /api/groups/:id
  Returns group details + all members + sharing status.

GET /api/groups/join/:invite_code
  Logic:
    Find group by invite_code.
    Add current user as member.
    If there's a placeholder with matching name, link them.
  Returns: { group_id, group_name }

POST /api/groups/:id/members
  Body: { display_name, age_band }
  Adds a placeholder member (no user_id yet).

DELETE /api/groups/:id/members/:member_id
  Removes a member from the group.


B9. SAVED PLACES ENDPOINTS (Auth Required)
-------------------------------------------
POST /api/places
  Body: { name, address, type }
  Logic:
    Geocode address → lat/lng via Mapbox Geocoding API.
    Store in saved_places table.
  Returns: { place_id, lat, lng }

GET /api/places
  Returns all saved places for current user.

DELETE /api/places/:id
  Removes a saved place.


B10. LOCATION ENDPOINTS (Auth Required)
-----------------------------------------
POST /api/location/update                              ← WEBHOOK/REALTIME
  Body: { lat, lng }
  Headers: Authorization

  Logic:
    Step 1: Upsert into locations_live table.
      INSERT ... ON CONFLICT (user_id) UPDATE SET lat, lng, updated_at.

    Step 2: Find all groups this user belongs to where
      sharing_location = true.

    Step 3: For each group, broadcast to realtime channel:
      Channel: "group:{group_id}:locations"
      Payload: { user_id, name, lat, lng, updated_at }

  The frontend calls this every 3-5 seconds when sharing is on.

GET /api/location/group/:group_id
  Returns latest location for all members of this group
  who have sharing_location = true.
  Pulls from locations_live table.
  Includes: user_id, name, lat, lng, updated_at, is_stale
  (is_stale = true if updated_at > 5 minutes ago)

PUT /api/groups/:id/sharing
  Body: { sharing_location: true/false }
  Toggles the current user's sharing status in group_members.
  If turning OFF: remove their row from locations_live.
  Broadcast to group that this member stopped/started sharing.


B11. GEOCODING ENDPOINT (No Auth — Utility)
---------------------------------------------
GET /api/geocode
  Query params: query (address or place name)
  Logic: call Mapbox Geocoding API.
  Returns: { lat, lng, formatted_address }

  Used by:
    Frontend search bar
    Chat endpoint (extract location from message)
    Saved places (geocode address on save)
    Data normalization (geocode text addresses from scrapers)


=========================================================
REALTIME CHANNELS (WebSocket / InsForge Realtime)
=========================================================

These are NOT REST endpoints. They are persistent connections
that push data to connected frontends in real time.

CHANNEL 1: "group:{group_id}:locations"
  Purpose: Live location dots on the map.
  Triggered by: B10 (location update endpoint)
  Payload: { user_id, name, lat, lng, updated_at }
  Who subscribes: All signed-in members of this group.
  Frontend action: Move the member's dot on the map.

CHANNEL 2: "area:{lat_rounded}:{lng_rounded}:events"
  Purpose: New event pins appearing on the map.
  Triggered by: B4 (new community report), B6 (verification
  status change), B7 (new community signal)
  Payload: { incident_id, category, lat, lng, source, verified,
             action: "created" / "updated" / "removed" }
  Who subscribes: Anyone viewing that area on the map.
  Frontend action: Add, update, or remove a pin.

CHANNEL 3: "user:{user_id}:notifications"
  Purpose: Personal notifications.
  Triggered by: B6 (your report was verified/flagged),
  B7 (community signal near your saved places)
  Payload: { type, message, incident_id }
  Who subscribes: That specific user.
  Frontend action: Show notification badge, toast message.


=========================================================
JOB SERVICE
=========================================================

J1. SEED DATA LOADER (Run Once)
--------------------------------
A script that runs before the first demo.

  Step 1: Download Phoenix PD crime data CSV from
    data.phoenix.gov or phoenixopendata.com.

  Step 2: Read CSV and normalize each row:
    Map their offense column → our category:
      "THEFT" → theft
      "ASSAULT" → assault
      "BURGLARY" → vehicle_breakin
      "CRIMINAL DAMAGE" → vandalism
      "DISORDERLY CONDUCT" → disturbance
      etc.
    Map their date column → our occurred_at
    Map their lat/lng → our lat/lng
    Set source = "police"
    Set verified = true
    Set report_count = 1

  Step 3: Filter by location bounds:
    Only keep incidents within Phoenix/Tempe area:
      lat between 33.35 and 33.55
      lng between -112.15 and -111.85

  Step 4: Bulk insert into incidents table.

  Step 5: For each incident, also insert into incident_sources:
    source_name = "Phoenix PD Open Data"
    source_type = "police"
    external_id = their original record ID (for dedup)

  Target: 200-300 incidents minimum.
  Must cover: downtown Phoenix, Tempe, ASU campus, Tempe Town Lake.


J2. TINYFISH POLICE SCRAPER (Scheduled)
-----------------------------------------
Runs every 6 hours. Can also be triggered manually.

  Step 1: Call TinyFish API.
    URL: phoenixopendata.com crime data page
    Goal: "Extract all crime incident reports from the last
    30 days. For each incident get: offense type, date/time,
    location or address, latitude, longitude, description.
    Return as JSON array."

  Step 2: Parse TinyFish response.
    TinyFish returns structured JSON.
    Each item has the fields we asked for.

  Step 3: Normalize each item.
    Map offense types → our categories.
    If only address (no lat/lng): geocode via B11.
    Generate a stable external_id from their data.

  Step 4: Dedup check.
    For each item, check incident_sources table:
      Does source_name + external_id already exist?
      If yes → skip (already imported).
      If no → insert new incident + source.

  Step 5: Insert new incidents into incidents table.
    Source = "police", verified = true.
    Also insert into incident_sources with source details.

  Step 6: Broadcast new incidents via realtime.         ← WEBHOOK/REALTIME
    For each new incident, push to the area channel
    so connected users see new pins without refreshing.


J3. TINYFISH NEWS SCRAPER (Scheduled)
--------------------------------------
Runs once daily.

  Step 1: Call TinyFish API.
    URL: azcentral.com or abc15.com
    Goal: "Find safety-related news articles from the last
    7 days mentioning Phoenix, Tempe, Scottsdale, or Mesa.
    For each article get: headline, summary (2 sentences),
    location mentioned, date published, URL."

  Step 2: Parse response.

  Step 3: Geocode locations mentioned.
    "shooting near 7th Ave and McDowell" → geocode "7th Ave
    and McDowell, Phoenix AZ" → lat/lng.

  Step 4: Normalize and categorize.
    Map headline keywords → categories:
      "shooting" → assault
      "break-in" / "burglary" → vehicle_breakin
      "vandalism" → vandalism
      etc.

  Step 5: Dedup check against incident_sources.

  Step 6: Insert into incidents (source = "news", verified = true)
    and incident_sources (with article URL).

  Step 7: Check if this news article matches an existing police
    incident (same area, same time, same category).
    If yes → don't create new incident, just add a new
    incident_sources row linking to the existing incident.
    Now that incident has two sources: police + news.


J4. DATA NORMALIZATION (Shared Logic — Used by J1, J2, J3)
-----------------------------------------------------------
Not a separate job. This is shared code used by all scrapers.

  normalize_category(raw_text):
    Input: raw offense text from any source
    Output: one of our 8 categories
    Logic: keyword matching or a small Claude call
      "LARCENY-THEFT" → theft
      "AGGRAVATED ASSAULT" → assault
      "CRIMINAL DAMAGE" → vandalism
      "INDECENT EXPOSURE" → harassment
      "VEHICLE BREAK-IN" → vehicle_breakin
      "NOISE COMPLAINT" → disturbance
      "STREETLIGHT" → infrastructure
      everything else → other

  geocode_address(address_text):
    Input: text address like "7th Ave and McDowell, Phoenix"
    Output: { lat, lng }
    Uses: B11 geocoding endpoint or direct Mapbox API call

  dedup_check(source_name, external_id):
    Input: source name + their record ID
    Output: true if already exists, false if new
    Uses: incident_sources table unique index

  find_matching_incident(lat, lng, category, occurred_at):
    Input: location + category + time
    Output: existing incident_id if match found, null if no match
    Logic: query incidents within 0.1 miles, same category,
      within 24 hours of occurred_at
    Used by: news scraper to link articles to existing police reports


J5. AI VERIFICATION WORKER (Triggered by B4)
----------------------------------------------
This is the same logic described in B6 but listed here because
it's part of the job service responsibility.

Not scheduled. Triggered every time a community report is submitted.

  Input: report_id from newly created community report
  Process:
    1. Fetch report details
    2. Fetch nearby official incidents (0.5mi, 7 days)
    3. Fetch nearby community reports (0.25mi, 7 days)
    4. Call Claude with verification prompt
    5. Update report status
    6. If verified → update linked incident
    7. Run clustering check (J6)
    8. Broadcast status change via realtime

  Claude prompt for verification:
    System: "You are verifying a community safety report.
    Compare it against official data and other community reports.
    Assess plausibility, corroboration, and whether the report
    targets individuals rather than conditions.
    Respond ONLY with this JSON:
    { status: 'verified'|'unverified'|'flagged',
      confidence: 'high'|'medium'|'low',
      reason: 'brief explanation' }
    Mark as flagged if description contains: people descriptions,
    racial references, specific individual targeting."


J6. CLUSTERING WORKER (Triggered by J5)
-----------------------------------------
Runs after every verification. Not scheduled separately.

  Input: lat/lng of the just-verified report
  Process:
    1. Query community_reports within 0.25 miles, last 7 days,
       status != flagged
    2. Group by rounded coordinates (3 decimal places)
    3. If any cluster has 3+ reports:
       a. Create or update an incident record:
          category = most common in cluster
          source = "community"
          verified = true
          report_count = cluster size
          description = "[count] independent reports of [category]
            in this area this week"
       b. Link all reports in the cluster to this incident
       c. Broadcast "community_signal" via realtime


=========================================================
WHERE REALTIME / WEBHOOKS ARE NEEDED (SUMMARY)
=========================================================

1. B4 (New community report submitted)
   → Push new pin to area channel so other users see it

2. B6 / J5 (Report verification complete)
   → Push status update to area channel (pin changes color)
   → Push notification to the reporter (your report was verified)

3. B7 / J6 (Community signal created)
   → Push community signal to area channel (pin gets count badge)
   → Push notification to users with saved places nearby

4. B10 (Location update from group member)
   → Push new position to group channel (dot moves on map)

5. J2 (New police data scraped)
   → Push new incidents to area channels (new pins appear)

6. J3 (New news article scraped)
   → Push new incident to area channel

Everything else is normal request-response (REST API).
Realtime is only for things that need to appear on other
people's screens without them refreshing.
