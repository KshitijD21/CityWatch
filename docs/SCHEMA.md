CITYWATCH DATABASE SCHEMA (FINAL)
=====================================


users {
  id                  uuid, primary key
  email               text, unique
  name                text
  age_band            text (child / teen / young_adult / adult)
  avatar_url          text, optional
  onboarded           boolean, default false
  notification_prefs  jsonb, default {}
  created_at          timestamp
}

WHY: Every person who signs up gets a row here. The age_band controls
how Claude personalizes safety briefs. The onboarded flag decides if
user goes to onboarding or dashboard after login. notification_prefs
stores their alert choices as JSON so we don't need a separate table.

---

groups {
  id            uuid, primary key
  name          text (e.g. "The Parkers")
  type          text (family / trip)
  invite_code   text, unique (e.g. "ABC123")
  created_by    uuid → users.id
  created_at    timestamp
}

WHY: Holds both family groups and trip groups. The invite_code is a
6-character string used in shareable links like app.com/join/ABC123.
Family groups are permanent. Trip groups are temporary for a weekend
outing or vacation.

---

group_members {
  id                 uuid, primary key
  group_id           uuid → groups.id
  user_id            uuid → users.id (CAN BE NULL)
  display_name       text (e.g. "Alex")
  age_band           text, optional
  role               text (admin / member)
  sharing_location   boolean, default false
  joined_at          timestamp
}

WHY: Connects users to groups. user_id can be null because during
onboarding Maya adds "Alex" before Alex has signed up. Alex exists
as a placeholder with just a name. When Alex joins via invite link,
user_id gets filled in. sharing_location is the consent toggle —
when true, that person's dot shows on the map. When false, they
are invisible. This replaces the need for a separate trips table.

---

saved_places {
  id          uuid, primary key
  user_id     uuid → users.id
  name        text (e.g. "Home", "School", "Work")
  address     text (e.g. "123 Main St, Phoenix, AZ")
  lat         float
  lng         float
  type        text (home / school / work / favorite)
  created_at  timestamp
}

WHY: Stores the locations each user cares about. These drive safety
briefs, the "for your household" personalization in Claude responses,
and the quick-access buttons on the dashboard. lat/lng come from
Mapbox geocoding when the user types an address.

---

incidents {
  id                  uuid, primary key
  category            text (theft / assault / vandalism / harassment /
                            vehicle_breakin / disturbance / infrastructure / other)
  description         text, optional
  lat                 float
  lng                 float
  occurred_at         timestamp (when it actually happened)
  source              text (police / news / community)
  verified            boolean, default false
  verification_note   text, optional (Claude's reasoning)
  report_count        integer, default 1
  created_at          timestamp
}

WHY: THE MOST IMPORTANT TABLE. All safety data lives here — police
reports, news articles, and promoted community reports all in one
place. Why one table? Because every feature runs the same query:
"give me everything within 0.5 miles from the last 7 days." One
table = one query. The source field tells you where it came from.
verified is always true for police/news, starts false for community.
report_count tracks clustering — when 3 community reports merge into
one signal, this becomes 3.

NO EMBEDDINGS NEEDED: Chat queries are location-based, not semantic.
Mapbox geocoding turns "Tempe Town Lake" into lat/lng, then a simple
SQL spatial query with Haversine formula finds nearby incidents in
~50ms. Claude summarizes the results. Fast and simple.

---

incident_sources {
  id             uuid, primary key
  incident_id    uuid → incidents.id
  source_name    text (e.g. "Phoenix PD Open Data", "AZCentral")
  source_type    text (police / news / community)
  external_id    text, optional (original ID from source system)
  url            text, optional (link to original report/article)
  fetched_at     timestamp
}

WHY: One incident can come from multiple sources. A car break-in
might be in both Phoenix PD data AND an AZCentral news article.
This table tracks each source separately. Powers the "How we know
this" section: "Phoenix PD: 23 reports, AZCentral: 1 article."
The external_id prevents importing the same police report twice
when the TinyFish scraper runs again.

---

community_reports {
  id                    uuid, primary key
  user_id               uuid → users.id
  category              text (streetlight_out / police_activity / felt_unsafe /
                              disturbance / vehicle_breakin / suspicious_activity / other)
  description           text, optional
  lat                   float
  lng                   float
  reported_at           timestamp
  status                text (unverified / verified / flagged)
  verification_note     text, optional (Claude's assessment)
  linked_incident_id    uuid → incidents.id, optional
  flagged_by_users      integer, default 0
  created_at            timestamp
}

WHY: Raw user-submitted reports live here SEPARATELY from incidents.
When someone submits "streetlight out at 5th and Mill" it goes here
as unverified. Then Claude reviews it and either verifies it (links
to a new incident), flags it (description targeted a person), or
leaves it unverified. If 3+ people independently report the same
area within 7 days, clustering logic promotes them all automatically.
flagged_by_users counts how many people marked it as biased.

---

locations_live {
  id          uuid, primary key
  user_id     uuid → users.id, unique
  lat         float
  lng         float
  updated_at  timestamp
}

WHY: Simplest table. One row per user, constantly overwritten. Phone
sends GPS every 3-5 seconds, this row gets upserted. Other group
members read this to place dots on the map. If updated_at is older
than 5 minutes, the frontend grays out that dot — means the person
probably closed the app.

---

brief_cache {
  id             uuid, primary key
  lat_rounded    float (rounded to 3 decimal places)
  lng_rounded    float
  brief_json     jsonb (Claude's full response)
  generated_at   timestamp
  expires_at     timestamp (1 hour TTL)
}

WHY: Saves money on Claude API calls. If Maya asks about "downtown
Phoenix" and Claude generates a brief, it gets cached here. If her
husband asks about the same area 20 minutes later, we return the
cached version instead of calling Claude again. Coordinates are
rounded to 3 decimals (~100 meter precision) so nearby queries hit
the same cache. Expired entries get cleaned up periodically.


=====================================
TABLE COUNT: 9 (trips table removed — sharing_location toggle on
group_members handles it)
=====================================


RELATIONSHIPS:
  users        → groups            (one user creates many groups)
  users        → group_members     (one user joins many groups)
  groups       → group_members     (one group has many members)
  users        → saved_places      (one user saves many places)
  users        → community_reports (one user submits many reports)
  users        → locations_live    (one user has one live location)
  incidents    → incident_sources  (one incident has many sources)
  community_reports → incidents    (verified report links to one incident)


KEY QUERIES:

1. Get nearby incidents (used by map, briefs, chat, everything):
   SELECT *, (3959 * acos(
     cos(radians($lat)) * cos(radians(lat)) *
     cos(radians(lng) - radians($lng)) +
     sin(radians($lat)) * sin(radians(lat))
   )) AS distance_miles
   FROM incidents
   WHERE occurred_at > NOW() - INTERVAL '$days days'
   HAVING distance_miles < $radius
   ORDER BY occurred_at DESC

   Radius modes:
     0.25 miles → pins around family members
     0.50 miles → safety briefs
     0.10 miles → route corridor
     1.00 miles → broad chat search

2. Get brief stats (for "How we know this"):
   SELECT category, source, COUNT(*) as count
   FROM incidents
   WHERE occurred_at > NOW() - INTERVAL '30 days'
     AND (haversine distance) < 0.5
   GROUP BY category, source

3. Check clustering (promote community reports):
   SELECT ROUND(lat,3), ROUND(lng,3), COUNT(*) as report_count
   FROM community_reports
   WHERE status != 'flagged'
     AND reported_at > NOW() - INTERVAL '7 days'
     AND (haversine distance) < 0.25
   GROUP BY ROUND(lat,3), ROUND(lng,3)
   HAVING COUNT(*) >= 3
