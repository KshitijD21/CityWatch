STREETSENSE — PROJECT IDEA
===========================

See what's happening around you. For real. With sources.

StreetSense is a real-time safety awareness app. You open it and
instantly see what's been reported around you — theft, disturbances,
broken streetlights, police activity — all on a live map with
sources you can verify. No account needed to browse. No fear-mongering.
Just factual, sourced information about your surroundings.

On top of that, you can create groups with family or friends to
see what's happening around them too.


THE PROBLEM
-----------

People want to know what's going on around them. The current
options are all broken:

Citizen sends real-time alerts that are often wrong, amplifies
fear, enables racial profiling, and gives you no way to verify
anything.

Crime maps like SpotCrime show static dots with no context — just
a pin that says "theft" with no detail, no time pattern, no source.

Nextdoor is unverified paranoia where one person's post about a
"suspicious person" becomes neighborhood gospel.

Police department websites have real data but are impossible to
use on a phone and have zero personalization.

None of these tools:
- Show you sourced, verified information you can trust
- Let you ask questions in plain English about any area
- Let you see what's happening around your people (not just you)
- Give you context instead of fear
- Let regular people contribute reports with built-in safeguards
  against bias and false information


WHO IS IT FOR
-------------

Primary user: Anyone who wants to know what's happening around them.
You're walking through a neighborhood, sitting at a coffee shop,
exploring a new part of the city — you open the app and see what's
been reported nearby. No signup required to browse the map.

Secondary user: Families and friend groups who want to see what's
happening around each other. A parent checking the area near their
teen's school. A group of friends at a music festival wanting to
stay aware. College students keeping an eye on each other during
a night out.

Example: You just moved to Phoenix. You don't know which areas
have had issues. You open StreetSense and see a live map with
pins showing recent incidents — sourced from Phoenix PD data,
local news, and community reports. You tap a pin and see exactly
what happened, when, and where the information came from. You type
"What's been happening near Mill Ave this week?" and get a sourced
answer in plain English.

Later, your roommate is walking home late. They share their location
with you through the app. You can see their dot on the map AND the
event pins around them. You know what's happening near them without
texting "are you home yet?" every 10 minutes.


WHAT THE APP DOES
-----------------

The app has two layers:

LAYER 1: FOR EVERYONE (no group needed)
  See what's happening around you or any area
  Ask questions about any location
  Report something you observed
  Browse the live map with sourced event pins

LAYER 2: FOR GROUPS (family / friends add-on)
  See what's happening around your people
  See their live location on the same map
  Coordinate without surveillance


=========================================================
FRONTEND — What the user sees
=========================================================

1. THE MAP (Home Screen — works without signup)

   You open the app and immediately see a live map. No signup
   wall. No onboarding. Just the map.

   You see colored pins for safety events reported in your area:
     Red = assault or harassment
     Orange = theft or disturbance
     Yellow = community report (unverified)
     Blue = infrastructure issue (streetlight out, etc.)

   You can pan, zoom, search any address. Pins load for whatever
   area you're looking at. Each pin shows a small preview:
   category, how long ago, and source.

   If you sign in, you also see:
   - Your group members' dots (if they have sharing on)
   - Your saved places highlighted on the map
   - Personalized context in briefs and chat


2. EVENT DETAIL CARD

   Tap any pin on the map and a card slides up showing:

   - What happened (e.g. "Vehicle break-in")
   - When (e.g. "2 hours ago" or "March 19, 8:30pm")
   - Source (e.g. "Phoenix PD" or "Community report — verified
     by 3 independent reports")
   - Verified or unverified badge
   - How far from you
   - If you're signed in and have a group: how far from your
     group member (e.g. "0.2 miles from Alex")
   - Buttons: "View area brief" and "Ask about this area"


3. CHAT ASSISTANT (works without signup)

   A chat screen where anyone can type questions in plain English.

   You can ask things like:
   - "What's happening near me right now?"
   - "Is Tempe Town Lake area okay tonight?"
   - "What happened near ASU campus this week?"
   - "Any vehicle break-ins near downtown?"

   The assistant checks the database, finds all relevant incidents
   near the location you mentioned, considers the time of day,
   and responds with a sourced summary. Example:

   "In the last 7 days near Tempe Town Lake, there were 3 vehicle
   break-ins in the east parking lot (all evenings) and 1 noise
   complaint. No violent incidents reported. The area is typically
   busy with foot traffic on Friday evenings. Sources: Tempe PD
   open data, 2 community reports."

   Quick prompt buttons above the input for common questions.

   The assistant never says an area is "safe" or "unsafe." It
   describes what was reported and you decide what it means.

   If you're signed in, the assistant also knows your group
   context: "Your teen's school is near this area. During the
   3:30pm window, foot traffic is high and no recent incidents
   were reported at that time."


4. AREA SAFETY BRIEF

   A full breakdown of any location. You get here by tapping
   "View area brief" on an event card, searching an address,
   or tapping a saved place.

   The brief has these sections:

   "What to know"
   A plain-language summary. Example: "Mostly commercial area.
   Persistent pickpocketing near the transit center in evenings.
   Walking during daytime is generally fine — lots of foot traffic."

   "Time of day matters"
   Breakdown by time window:
     Daytime (6am-6pm): what typically gets reported
     Evening (6pm-11pm): what changes
     Late night (11pm-6am): what to be aware of

   "For your group" (only if signed in with a group)
   Personalized context. Example: "Your teen's bus route passes
   through here at 3:30pm. During that time, the area is busy
   with students."

   "How we know this" (expandable)
   Exact sources:
     Phoenix PD Open Data: 23 reports, last 60 days
     Community reports: 5 reports (clustered)
     AZCentral: 1 news article
     Category breakdown: Theft 12, Vehicle break-in 8, Vandalism 3

   Disclaimer on every brief:
   "Based on reported data — conditions change. Not a prediction."


5. COMMUNITY REPORTING

   Anyone with an account can report something they observed.

   Tap the report button on the map. Pick a category:
     - Streetlight out / broken
     - Unusual police activity
     - I felt unsafe here
     - Heard disturbance
     - Vehicle break-in
     - Other safety concern

   Add an optional description. Location and time are auto-detected.

   Warning on the form: "Please do NOT include descriptions of
   specific people, license plates, or private addresses."

   When you submit:
   - The pin appears on the map immediately with a yellow
     "Unverified" tag so everyone can see it
   - AI verification runs in the background
   - The report only becomes trusted when verified by AI or
     when 3+ independent people report the same area

   This is the key difference from Citizen: one person's report
   doesn't become gospel. It takes multiple independent reports
   or AI verification against official data before it's trusted.


6. SIGNUP AND ONBOARDING (optional — for group features)

   You only need to sign up if you want group features. Signup
   uses Google or email.

   Onboarding has three steps:

   Step 1 — Ethical modal
   "We show reported data. We don't predict. We don't assign
   safety scores. You decide."

   Step 2 — Create a group
   Name it (e.g. "The Parkers" or "Friday Night Crew") and
   pick if it's family or friends.

   Step 3 — Add members and saved places
   Add people by name and age band. Add places like home, school,
   work. Members join later via invite link.


7. GROUP FEATURES (signed-in users only)

   Group management:
   - See your groups and members
   - Toggle your location sharing on or off
   - Generate invite links
   - Create new groups

   Live location:
   - When a member turns sharing on, their dot appears on your map
   - You see event pins around their dot — you instantly know
     what's been reported near them
   - This is consent-based. No background tracking. No 24/7
     surveillance. They turn it on, they turn it off.
   - If no update in 5 minutes, their dot turns gray

   This is the add-on layer. The core app works without it.


=========================================================
BACKEND — What processes requests
=========================================================

1. SPATIAL QUERY ENGINE (the core of everything)

   Given any point on the map and a radius, return all incidents
   within that distance from the last N days.

   This one query powers the entire app:
   - Map pins: what's near the user's current view
   - Event cards: details for a specific incident
   - Safety briefs: everything within 0.5 miles of an address
   - Chat answers: incidents near the location the user asked about

   Four radius modes:
     0.25 miles → tight area around a person
     0.50 miles → neighborhood level for briefs and chat
     0.10 miles → narrow strip along a route
     1.00 miles → broad area for general questions


2. CHAT ENDPOINT

   Takes the user's plain English message. Extracts the location
   (turns "Tempe Town Lake" into coordinates). Pulls nearby
   incidents from the database. Sends everything to the AI with
   context. Streams the response back word by word.

   If the user is signed in, also includes their group context
   (saved places, member patterns) in the AI prompt.


3. SAFETY BRIEF GENERATION

   Takes a location. Pulls incidents within 0.5 miles for the
   last 30 days. Groups by category and time of day. Sends to
   AI for summarization. Returns a structured brief.

   Cached for 1 hour — same area asked twice gets cached response.


4. COMMUNITY REPORT HANDLING

   Accepts reports. Stores as unverified. Shows the pin on the
   map for everyone immediately. Triggers AI verification in the
   background. Handles flagging by other users.


5. USER AUTH AND GROUPS

   Only needed for group features. Login, signup, group creation,
   invite links, member management, sharing toggles.


6. LOCATION BROADCASTING

   For signed-in group members only. Receives GPS updates from
   users who have sharing on. Stores latest position. Broadcasts
   to group members in real time.


=========================================================
JOB SERVICE — What collects and verifies data
=========================================================

1. POLICE DATA SCRAPER

   Automated agent that goes to Phoenix PD's open data portal
   and extracts all crime incident reports from the last 30 days.
   Normalizes the data into standardized categories and inserts
   into the database. Runs every 6 hours to keep data fresh.


2. NEWS SCRAPER

   Same approach but pointed at local news sites (AZCentral,
   ABC15). Extracts safety-related headlines from the last 7 days.
   Adds richness to briefs and chat responses. Runs daily.


3. SEED DATA LOADER

   For initial launch: loads real Phoenix PD crime data into the
   database. 200-300 real incidents covering downtown Phoenix,
   Tempe, ASU campus, Tempe Town Lake. Without this, the map
   starts empty.


4. DATA NORMALIZATION

   All incoming data gets standardized:
   - Different category names mapped to a fixed set
   - Text addresses geocoded into coordinates
   - Duplicates merged (same incident from police + news = 1 record)
   - Tagged with source and confidence level


5. AI VERIFICATION OF COMMUNITY REPORTS

   When someone submits a report, AI reviews it:

   - Pulls official police data from the same area
   - Pulls other community reports from the same area
   - Assesses: Is this plausible? Does it match official data?
     Are there corroborating reports? Does it target people
     instead of conditions?

   Result is one of three:
     VERIFIED — matches official data or 3+ corroborating reports
     UNVERIFIED — plausible but no corroboration yet
     FLAGGED — targets individuals, contains racial descriptions,
     or is otherwise problematic


6. CLUSTERING LOGIC

   Checks if 3+ independent community reports fall within 0.25
   miles of each other in the last 7 days. If yes, they become a
   "community signal" — verified, trusted, and shown with a count
   badge: "5 reports of vehicle break-ins this week."

   This is what makes us different from Citizen. One person's
   paranoia doesn't become everyone's reality. Only patterns from
   multiple independent people become trusted data.


=========================================================
ETHICAL GUARDRAILS — Built into everything
=========================================================

1. No safety scores. We describe patterns, never assign numbers.

2. Every piece of information shows its source. "How we know this"
   is on every brief, every card, every chat response.

3. We never say "we recommend." We present context. You decide.

4. Community reports focus on conditions, not people. The form
   warns against describing individuals. AI flags reports that
   target people.

5. Location sharing is always opt-in. Never forced. Never passive.

6. First-launch ethical modal: "We show reported data. We don't
   predict. You decide."

7. Disclaimer on every brief: "Based on reported data — conditions
   change. Not a prediction."

8. Single unverified reports are visible but clearly marked. They
   only become trusted after AI verification or 3+ independent
   reports in the same area.


=========================================================
HOW WE ARE DIFFERENT FROM CITIZEN
=========================================================

Citizen:
- Sends scary push alerts that are often wrong
- Shows unverified single reports as fact
- No source transparency — you can't check where info came from
- Enables racial profiling through vague "suspicious person" reports
- Designed to keep you scared so you keep opening the app

StreetSense:
- No push alerts. You check when you want to check.
- Unverified reports are clearly marked. Only patterns from
  multiple people or AI-verified data become trusted.
- Every piece of data shows its source. You can trace it back.
- Reports focus on conditions, not people. AI flags bias.
- Designed to inform you, not frighten you.


=========================================================
ONE-LINE SUMMARY
=========================================================

StreetSense shows you what's happening around you with real
sources — and if you want, around your people too.
