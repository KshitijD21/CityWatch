# Current Database Snapshot

## incidents (94,270 total — showing 1 sample)

| Column | Value |
|---|---|
| id | `8cc5aa4f-39b6-412d-903f-18db51437976` |
| category | theft |
| description | Bicycle stolen from bike rack outside library |
| lat | 33.419 |
| lng | -111.934 |
| occurred_at | 2026-03-21T02:59:28.726Z |
| source | community |
| verified | false |
| verification_note | null |
| report_count | 2 |
| created_at | 2026-03-22T02:59:28.726Z |

---

## users (5 rows)

| name | email | age_band | onboarded | id (short) |
|---|---|---|---|---|
| Test User 2 | test2@example.com | adult | false | `4451e6ea...` |
| Ronak | ronak2@test.com | adult | false | `aa59c6e1...` |
| Kshitij | kshitij@citywatch.dev | young_adult | true | `b1a2c3d4...` |
| Anirudh | anirudh@citywatch.dev | young_adult | true | `a1b2c3d4-1111...` |
| Priya | priya@citywatch.dev | adult | true | `a1b2c3d4-2222...` |

---

## groups (3 rows)

| name | type | invite_code | created_by |
|---|---|---|---|
| The Parkers | family | `_CPOGQ` | Test User 2 |
| The Parkers | family | `Q7UJYW` | Ronak |
| CityWatch Crew | friends | `CWTEST` | Kshitij |

---

## group_members (6 rows)

| display_name | group | role | sharing_location | age_band |
|---|---|---|---|---|
| Test User 2 | The Parkers (_CPOGQ) | admin | false | null |
| Ronak | The Parkers (Q7UJYW) | admin | true | null |
| Kshitij | CityWatch Crew | admin | true | young_adult |
| Anirudh | CityWatch Crew | member | true | young_adult |
| Priya | CityWatch Crew | member | true | adult |
| Ronak | CityWatch Crew | member | true | adult |

---

## saved_places (3 rows — all Kshitij's)

| name | type | address | lat | lng |
|---|---|---|---|---|
| Home | home | University Dr, Tempe, AZ 85281 | 33.4217 | -111.9346 |
| ASU Campus | school | 1151 S Forest Ave, Tempe, AZ 85281 | 33.4184 | -111.9325 |
| Mill Ave | favorite | Mill Avenue, Tempe, AZ 85281 | 33.4255 | -111.9400 |

---

## locations_live (4 rows)

| user | lat | lng | updated_at | staleness |
|---|---|---|---|---|
| Priya | 33.509 | -112.101 | 2026-03-22T02:51:01Z | ~8 min (stale) |
| Anirudh | 33.452 | -112.074 | 2026-03-22T02:57:01Z | ~2 min |
| Ronak | 33.427 | -111.938 | 2026-03-22T02:57:50Z | ~1 min |
| Kshitij | 33.4235 | -111.940 | 2026-03-22T02:59:01Z | fresh |

---

## community_reports (2 rows — both Kshitij's)

| category | description | lat | lng | status | reported_at |
|---|---|---|---|---|---|
| felt_unsafe | Dark alley near University Dr, no lighting | 33.422 | -111.9355 | verified | 2026-03-21T02:59Z |
| streetlight_out | Streetlight flickering on Apache Blvd | 33.4145 | -111.932 | unverified | 2026-03-19T02:59Z |

---

## incident_sources (94K+ rows — showing 5 samples)

| source_name | source_type | external_id | url |
|---|---|---|---|
| phoenix_pd_calls | police | 25001289447 | phoenixopendata.com/dataset/calls-for-service |
| phoenix_pd_calls | police | 25001289454 | phoenixopendata.com/dataset/calls-for-service |
| phoenix_pd_calls | police | 25001289467 | phoenixopendata.com/dataset/calls-for-service |
| phoenix_pd_calls | police | 25001289484 | phoenixopendata.com/dataset/calls-for-service |
| phoenix_pd_calls | police | 25001289486 | phoenixopendata.com/dataset/calls-for-service |

---

## brief_cache (0 rows — empty)

| Columns | lat_rounded, lng_rounded, brief_json, generated_at, expires_at |
|---|---|
| Data | (none) |
