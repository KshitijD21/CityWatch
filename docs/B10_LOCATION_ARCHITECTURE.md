# B10 — Location Sharing Architecture

## Overview

Location sharing lets group members see each other's live positions on the map. Each member controls their own visibility per group.

---

## Database Tables

```
locations_live (one row per user, constantly overwritten)
┌──────────┬─────────┬──────┬──────┬────────────┐
│ id       │ user_id │ lat  │ lng  │ updated_at │
└──────────┴─────────┴──────┴──────┴────────────┘
UNIQUE constraint on user_id — only one row per person.

group_members (sharing_location flag controls visibility)
┌──────────┬──────────┬─────────┬──────────────────┐
│ group_id │ user_id  │ role    │ sharing_location │
└──────────┴──────────┴─────────┴──────────────────┘
```

---

## REST API Endpoints

### 1. `PUT /api/location/sharing` — Toggle sharing (per group)

Each member toggles sharing independently, per group.

```json
{ "group_id": "abc-123", "sharing_location": true }
```

If Ronak is in two groups, he can share with family but not friends:

```
group_members
┌────────────────┬─────────┬──────────────────┐
│ group (name)   │ user_id │ sharing_location │
├────────────────┼─────────┼──────────────────┤
│ The Parkers    │ ronak   │ true             │
│ ASU Friends    │ ronak   │ false            │
└────────────────┴─────────┴──────────────────┘
```

When turning OFF: deletes the user's row from `locations_live` so their dot disappears immediately.

### 2. `POST /api/location/update` — Send GPS coordinates

Called every 3-5 seconds by the frontend while sharing is on.

```json
{ "lat": 33.4255, "lng": -111.9400 }
```

Upserts into `locations_live` — always one row per user, overwritten each time.

### 3. `GET /api/location/group/{group_id}` — Get group members' locations

Returns locations only for members with `sharing_location = true`.

```json
[
  {
    "user_id": "ronak-id",
    "display_name": "Ronak",
    "lat": 33.4255,
    "lng": -111.9400,
    "updated_at": "2026-03-22T01:30:05Z",
    "is_stale": false
  },
  {
    "user_id": "dad-id",
    "display_name": "Dad",
    "lat": 33.4300,
    "lng": -111.9350,
    "updated_at": "2026-03-22T01:25:00Z",
    "is_stale": true
  }
]
```

`is_stale = true` when `updated_at` is older than 5 minutes (user may have lost connection).

---

## Receiving Updates: Polling vs WebSocket

### Option A: Polling (simple)

Frontend calls `GET /group/{id}` every 5 seconds.

```
Kshitij's phone → GET /group/{id} every 5 sec → Server → Query DB → Response
Kshitij's phone → GET /group/{id} every 5 sec → Server → Query DB → Response (same data, wasted)
Kshitij's phone → GET /group/{id} every 5 sec → Server → Query DB → Response (same data, wasted)
```

- Simple to implement
- Wasteful — most calls return the same data
- Up to 5 second delay before seeing movement
- Good enough for a hackathon demo

### Option B: WebSocket (real-time)

Server pushes updates to connected clients instantly.

```
Kshitij's phone → Subscribe to "group:{id}:locations" (once)
                    ← Server pushes: { Ronak, lat, lng }  (only when Ronak moves)
                    ← Server pushes: { Dad, lat, lng }    (only when Dad moves)
```

- Instant updates (< 100ms)
- No wasted requests
- More complex to set up

### Comparison

| | Polling | WebSocket |
|---|---|---|
| Sending your location | POST every 3-5 sec | POST every 3-5 sec OR via WebSocket |
| Receiving others' locations | GET every 5 sec (even if nothing changed) | Server pushes only when someone moves |
| Latency | Up to 5 sec delay | Instant |
| Complexity | Simple | More setup |

---

## Sending Updates: REST vs WebSocket

### REST for sending

```
Ronak's phone → POST /api/location/update { lat, lng } → Server
```

- Simple fire-and-forget
- Each request is independent — if one fails, next one sends latest position
- Works reliably on flaky mobile connections

### WebSocket for sending

```
Ronak's phone → WebSocket connection → send { lat, lng } → Server
```

- Needs connection management (reconnection, heartbeats)
- More efficient (no HTTP overhead per request)
- Can use the same connection for both sending and receiving

### Both approaches work. REST is simpler for sending; WebSocket is more efficient.

---

## Full WebSocket Flow (Recommended for Production)

### Setup

All 4 members have `sharing_location = true`. Each phone opens one WebSocket connection to channel `group:{group_id}:locations`.

```
Ronak's phone ──── WebSocket ────┐
Kshitij's phone ── WebSocket ────┤── Server (channel: group:123:locations)
Mom's phone ────── WebSocket ────┤
Dad's phone ────── WebSocket ────┘
```

Every member is both a sender and a receiver on the same connection.

### Second by second

```
Time 0s:  Ronak moves → sends { ronak, lat: 33.42, lng: -111.94 }
          Server receives → upserts DB → broadcasts to channel
          Kshitij gets it → moves Ronak's dot on map
          Mom gets it     → moves Ronak's dot on map
          Dad gets it     → moves Ronak's dot on map

Time 2s:  Dad moves → sends { dad, lat: 33.45, lng: -111.91 }
          Server receives → upserts DB → broadcasts to channel
          Ronak gets it   → moves Dad's dot on map
          Kshitij gets it → moves Dad's dot on map
          Mom gets it     → moves Dad's dot on map

Time 3s:  Kshitij moves → sends { kshitij, lat: 33.43, lng: -111.93 }
          Server receives → upserts DB → broadcasts to channel
          Ronak gets it   → moves Kshitij's dot on map
          Mom gets it     → moves Kshitij's dot on map
          Dad gets it     → moves Kshitij's dot on map

Time 5s:  Mom is stationary → sends nothing (or sends same coords)
```

### What each phone sees on the map

Every phone shows 3 dots (other members) + own location from local GPS:

```
Ronak's screen:    [Own GPS] + Kshitij dot + Mom dot + Dad dot
Kshitij's screen:  Ronak dot + [Own GPS] + Mom dot + Dad dot
Mom's screen:      Ronak dot + Kshitij dot + [Own GPS] + Dad dot
Dad's screen:      Ronak dot + Kshitij dot + Mom dot + [Own GPS]
```

You don't see your own dot from WebSocket — you use local GPS for your own position.

---

## Disconnect Handling

When someone disconnects (closes app, loses internet, phone dies):

### What happens

```
Before:  Ronak ── WS ──┐
         Kshitij ─ WS ──┤── Channel
         Mom ──── WS ──┤
         Dad ──── WS ──┘

Dad closes app:

After:   Ronak ── WS ──┐
         Kshitij ─ WS ──┤── Channel
         Mom ──── WS ──┘
         Dad ──── (disconnected)
```

- Dad stops sending and receiving
- His last position stays in `locations_live` table

### What others see

```
Time 0min: Dad's dot shows normally (last known position)
Time 2min: Dad's dot still shows, same position
Time 5min: is_stale = true → Frontend grays out Dad's dot, shows "Last seen 5 min ago"
```

### When Dad reconnects

- WebSocket reconnects
- Phone starts sending GPS again
- updated_at refreshes → is_stale goes back to false
- Dad's dot becomes active again

### Disconnect vs Intentionally stopping

| Action | What happens | Dad's dot on map |
|---|---|---|
| **Disconnect** (app closed, lost signal) | `locations_live` row stays, becomes stale | Grayed out after 5 min |
| **Toggle sharing off** (deliberate) | `locations_live` row deleted | Disappears immediately |

---

## Chosen Approach: WebSocket Publish + Webhook Persistence

### How it works

```
Ronak's phone → WS publish to "group:{id}:locations"
                  ↓
            InsForge does both simultaneously:
            1. Broadcasts to all subscribers → Kshitij/Mom/Dad get it instantly
            2. POSTs to webhook URL → our backend → upserts to locations_live
```

- **Sending**: WebSocket `REALTIME_PUBLISH` (no REST call from frontend)
- **Receiving**: WebSocket subscription (no polling)
- **Persistence**: InsForge webhook automatically calls our backend to save to DB

### Why this approach

We evaluated three approaches:

**Option 1 — DB Trigger**
- Sending: REST POST every 3-5 sec
- Receiving: WS subscription
- DB persistence: Automatic (trigger)
- Frontend calls: REST every 3-5 sec
- Latency: REST round-trip + trigger delay

**Option 2 — Client Pub/Sub + REST**
- Sending: REST POST + WS publish (two calls)
- Receiving: WS subscription
- DB persistence: REST POST handles it
- Frontend calls: REST + WS (two paths)
- Latency: Instant (WS) + REST overhead

**Option 3 — WebSocket + Webhook (chosen) ✅**
- Sending: WS publish only (one call)
- Receiving: WS subscription
- DB persistence: Webhook handles it async
- Frontend calls: WS only (one path)
- Latency: Instant (WS) + async webhook

**Why Option 3 wins:**
- Frontend uses a single connection (WebSocket) for both sending and receiving
- No duplicate calls — one publish does both broadcast + persistence
- Lowest latency — broadcast is instant, DB write is async and doesn't block

### How InsForge triggers the webhook

When you create a realtime channel, you give InsForge a **rule**:

```json
{
  "pattern": "group:%:locations",
  "webhookUrls": ["https://xxxx.ngrok-free.app/api/location/webhook"]
}
```

This tells InsForge: "Whenever any message is published to a channel matching `group:%:locations`, POST the payload to these URLs."

Here's what happens step by step:

```
1. Ronak's phone connects to InsForge via WebSocket

2. Ronak's phone publishes:
   insforge.realtime.publish('group:abc123:locations', 'location_update', {
     user_id: 'ronak-id', lat: 33.42, lng: -111.94
   })

3. InsForge receives the message and checks:
   "Does 'group:abc123:locations' match any channel pattern?"
   → Yes! It matches 'group:%:locations' (% is wildcard)

4. InsForge finds the channel config:
   - pattern: group:%:locations
   - webhookUrls: ["https://xxxx.ngrok-free.app/api/location/webhook"]
   - enabled: true

5. InsForge does TWO things simultaneously:
   a. Broadcasts to all WebSocket subscribers → Kshitij/Mom/Dad get it instantly
   b. HTTP POSTs the payload to each webhookUrl → our backend receives it
```

What InsForge sends to the webhook:

```
POST https://xxxx.ngrok-free.app/api/location/webhook
Content-Type: application/json
X-Insforge-Channel: group:abc123:locations
X-Insforge-Event: location_update
X-Insforge-Message-Id: aece17e4-5fed-4978-b0eb-ef1f64415765

{
  "user_id": "ronak-id",
  "display_name": "Ronak",
  "lat": 33.42,
  "lng": -111.94
}
```

Note: The payload is sent **directly as the JSON body** (not wrapped in a `{"payload": {...}}` object). InsForge also sends metadata in headers (`X-Insforge-Channel`, `X-Insforge-Event`, `X-Insforge-Message-Id`).

InsForge doesn't need to understand our backend code — it just fires an HTTP request to the URL we gave it, with the message payload. Our backend parses it and saves to DB.

Think of it like a Slack webhook: "When X happens, POST to this URL."

---

### Backend setup required

**1. Create realtime channel with webhook (REST API call):**
```bash
POST https://s8ya9py8.us-east.insforge.app/api/realtime/channels
Authorization: Bearer ik_232ab7a0d9323df1984a9518ce6e055d

{
  "pattern": "group:%:locations",
  "description": "Live location updates for group members",
  "webhookUrls": ["https://<backend-url>/api/location/webhook"],
  "enabled": true
}
```

When any client publishes to a `group:%:locations` channel, InsForge:
1. Delivers the message to all WebSocket subscribers
2. POSTs the message payload to our webhook URL

**2. Webhook endpoint on our backend:**
```
POST /api/location/webhook  ← called by InsForge, NOT by frontend
```
Receives the realtime message, extracts `user_id`, `lat`, `lng`, and upserts into `locations_live`.

### Frontend integration

```typescript
// 1. Initial load — GET all current positions (one-time)
const locations = await api.get(`/location/group/${groupId}`);
renderDots(locations);

// 2. Connect to WebSocket
await insforge.realtime.connect();
await insforge.realtime.subscribe(`group:${groupId}:locations`);

// 3. Receive others' locations (real-time)
insforge.realtime.on('location_update', (payload) => {
  moveDot(payload.user_id, payload.lat, payload.lng);
});

// 4. Send own GPS via WebSocket every 3-5 sec
setInterval(() => {
  navigator.geolocation.getCurrentPosition((pos) => {
    insforge.realtime.publish(`group:${groupId}:locations`, 'location_update', {
      user_id: currentUserId,
      display_name: userName,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude
    });
  });
}, 3000);
```

### REST endpoints still needed

| Endpoint | Purpose |
|---|---|
| `POST /api/location/webhook` | Receives InsForge webhook → persists to DB (not called by frontend) |
| `POST /api/location/update` | Fallback REST endpoint if WebSocket unavailable |
| `GET /api/location/group/{id}` | Initial load when opening map (one-time call) |
| `PUT /api/location/sharing` | Toggle sharing on/off per group |

---

## Why the Webhook Needs a Public URL (and Why We Use ngrok Locally)

### The problem

The webhook flow requires InsForge (a cloud server) to call **our** backend:

```
InsForge Cloud (Virginia) ──POST──→ our backend's /api/location/webhook
```

InsForge needs a URL it can reach over the internet. In production, this is your deployed backend URL (e.g. `https://citywatch-api.railway.app`). But during local development, your backend runs at `localhost:8000` — which is only accessible on your machine. InsForge can't reach it:

```
InsForge Cloud → http://localhost:8000  ← ❌ "localhost" means InsForge's own machine, not yours
```

### How ngrok solves this

ngrok creates a **tunnel** — a public URL that forwards traffic to your local machine:

```
InsForge Cloud → https://abc123.ngrok-free.app → ngrok tunnel → localhost:8000
                 (public internet)                (your machine)
```

Step by step:
1. You run `ngrok http 8000` — ngrok gives you a public URL
2. You register that URL as the webhook in InsForge's realtime channel
3. When a client publishes a location via WebSocket, InsForge POSTs to the ngrok URL
4. ngrok receives it on their cloud server
5. ngrok forwards it through the tunnel to your `localhost:8000/api/location/webhook`
6. Your backend processes it and saves to DB

### Local development setup

```bash
# 1. Install ngrok (one-time)
brew install ngrok

# 2. Authenticate (one-time, free account at ngrok.com)
ngrok config add-authtoken <your-token>

# 3. Start tunnel (every dev session)
ngrok http 8000
# Output: https://xxxx-xxxx.ngrok-free.app

# 4. Create or update the InsForge channel with the ngrok URL
curl -X POST "https://s8ya9py8.us-east.insforge.app/api/realtime/channels" \
  -H "Authorization: Bearer ik_232ab7a0d9323df1984a9518ce6e055d" \
  -H "Content-Type: application/json" \
  -d '{
    "pattern": "group:%:locations",
    "webhookUrls": ["https://xxxx-xxxx.ngrok-free.app/api/location/webhook"],
    "enabled": true
  }'
```

Note: The ngrok URL changes every time you restart ngrok (on the free plan). You'll need to update the InsForge channel's webhook URL each time.

### In production (no ngrok needed)

Once deployed, your backend has a permanent public URL. Just update the channel:

```bash
curl -X PUT "https://s8ya9py8.us-east.insforge.app/api/realtime/channels/<channel-id>" \
  -H "Authorization: Bearer ik_232ab7a0d9323df1984a9518ce6e055d" \
  -H "Content-Type: application/json" \
  -d '{
    "webhookUrls": ["https://citywatch-api.railway.app/api/location/webhook"]
  }'
```

No ngrok, no tunnels — InsForge can reach your backend directly.

### Webhook vs direct DB write — why bother?

You might wonder: why not just have the frontend call `POST /api/location/update` directly instead of this webhook dance?

| | Frontend calls REST | WebSocket + Webhook |
|---|---|---|
| **Sending** | Frontend makes HTTP POST every 3-5 sec | Frontend sends via WebSocket (already open) |
| **Receiving** | Still need separate WebSocket for real-time | Same WebSocket connection handles both |
| **Connections** | HTTP POST + WebSocket = 2 paths | WebSocket only = 1 path |
| **Latency** | Others see update after REST round-trip + DB query | Others see update instantly via WebSocket broadcast |
| **DB persistence** | Synchronous (blocks response) | Async via webhook (doesn't block broadcast) |

The webhook approach means the frontend only uses **one connection** (WebSocket) for everything, and other users see location updates **instantly** — the DB save happens asynchronously via the webhook without slowing down the broadcast.

---

## Full End-to-End Flow

Let's say Ronak opens the app and has sharing ON for "The Parkers" group (4 members: Ronak, Kshitij, Mom, Dad).

### Step 1: Initial Load (one-time REST call)

```
Ronak's phone → GET /api/location/group/{groupId}
                        ↓
                  Backend queries DB
                        ↓
                  Returns: [
                    { Dad, lat, lng, is_stale: false },
                    { Mom, lat, lng, is_stale: true },
                    { Kshitij, lat, lng, is_stale: false }
                  ]
                        ↓
                  Frontend renders 3 dots on map
```

### Step 2: Connect WebSocket (one-time)

```
Ronak's phone → InsForge SDK connects via WebSocket
              → Subscribes to "group:{groupId}:locations"
              → Now listening for real-time updates
```

### Step 3: Sending GPS (every 3-5 seconds)

```
Ronak's phone gets GPS from browser
        ↓
insforge.realtime.publish('group:{groupId}:locations', 'location_update', {
    user_id: 'ronak-id',
    display_name: 'Ronak',
    lat: 33.4270,
    lng: -111.9380
})
        ↓
WebSocket message goes to InsForge Cloud
        ↓
InsForge does TWO things simultaneously:
        ↓                                    ↓
  1. Broadcasts to all                 2. POSTs webhook to backend
     WebSocket subscribers
        ↓                                    ↓
  Kshitij's phone receives it         POST /api/location/webhook
  Mom's phone receives it              { user_id, lat, lng }
  Dad's phone receives it                    ↓
        ↓                              Backend upserts to
  They each move Ronak's                locations_live table
  dot on their map                     (for future initial loads)
```

### Step 4: Receiving Others' GPS

```
Dad moves → his phone publishes via WebSocket
                    ↓
            InsForge broadcasts
                    ↓
            Ronak's phone receives:
            insforge.realtime.on('location_update', (payload) => {
                moveDot(payload.user_id, payload.lat, payload.lng)
            })
                    ↓
            Ronak sees Dad's dot move on map
```

### Step 5: Toggle Sharing OFF

```
Ronak toggles sharing OFF for this group
        ↓
PUT /api/location/sharing
{ group_id: "...", sharing_location: false }
        ↓
Backend does TWO things:
  1. Sets sharing_location = false in group_members
  2. Deletes Ronak's row from locations_live
        ↓
Ronak's phone stops publishing GPS
Ronak's dot disappears immediately for others
```

### Step 6: Disconnect (app closed / lost signal)

```
Dad closes the app
        ↓
WebSocket disconnects
Dad stops sending GPS
        ↓
His last position stays in locations_live
        ↓
After 5 minutes: is_stale = true
        ↓
Others see Dad's dot grayed out: "Last seen 5 min ago"
```

---

## Who Handles What

The backend has **zero WebSocket code**. InsForge handles all WebSocket infrastructure.

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                               │
│                  (Next.js + InsForge SDK)                    │
│                                                             │
│  Initial load ───REST────→ GET /api/location/group/{id}     │
│  Toggle sharing ─REST────→ PUT /api/location/sharing        │
│  Send GPS ───WebSocket───→ InsForge realtime.publish()      │
│  Receive GPS ←WebSocket─── InsForge realtime.on()           │
├─────────────────────────────────────────────────────────────┤
│                    INSFORGE CLOUD                           │
│              (manages all WebSocket infra)                   │
│                                                             │
│  ← Receives WebSocket publish from frontend                 │
│  → Broadcasts to all subscribers (instant, real-time)       │
│  → POSTs to webhook URL (async, for DB persistence)         │
│                                                             │
│  Handles: connections, reconnections, channel subscriptions, │
│  message routing, webhook delivery                          │
├─────────────────────────────────────────────────────────────┤
│                      BACKEND                                │
│                (FastAPI — REST only, no WebSocket)           │
│                                                             │
│  POST /webhook ← receives InsForge webhook, saves to DB     │
│  GET /group/{id} ← serves initial load from DB              │
│  PUT /sharing ← toggles sharing, cleans up on OFF           │
│  POST /update ← fallback if WebSocket unavailable           │
└─────────────────────────────────────────────────────────────┘
```

The frontend uses **two connection types**: REST (for initial load + toggle) and WebSocket (for real-time send/receive). The backend is a pure REST API — it never touches WebSocket. InsForge sits in the middle and handles all the real-time complexity.
