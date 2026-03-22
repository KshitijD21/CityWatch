# StreetSense: Complete UI Flow Specification

Here's a complete, production-ready UI flow specification. It's structured so you and your backend team can work in parallel with clear contracts.

---

## Table of Contents

1. [Flow Overview](#flow-overview)
2. [Flow 1: Landing & Auth](#flow-1-landing--auth)
3. [Flow 2: Onboarding](#flow-2-onboarding)
4. [Flow 3: Main App (Live Map)](#flow-3-main-app-live-map)
5. [Flow 4: Safety Brief](#flow-4-safety-brief)
6. [Flow 5: Route Planning](#flow-5-route-planning)
7. [Flow 6: Community Report](#flow-6-community-report)
8. [Flow 7: Chat Assistant](#flow-7-chat-assistant)
9. [Flow 8: Groups & Sharing](#flow-8-groups--sharing)
10. [Component Library](#component-library)
11. [API Contract Summary](#api-contract-summary)

---

## Flow Overview

```
Landing → Auth → Onboarding → Main Map (Home)
                                    ↓
        ┌───────────────────────────┴───────────────────────────┐
        ↓                           ↓                           ↓
   Safety Brief              Route Planner              Community Report
        ↓                           ↓                           ↓
   [How We Know]            [Compare Routes]            [Submit Report]
        ↓                           ↓                           ↓
   Chat Assistant ←─────────────────┴───────────────────────────→ Groups
```

---

## Flow 1: Landing & Auth

### Screen 1.1: Landing Page

**Purpose:** First impression + value prop before login.

**Layout:**

```
┌─────────────────────────────────────────────┐
│                                   [Sign In] │
│                                             │
│                    ┌─────────┐              │
│                    │  Logo   │              │
│                    └─────────┘              │
│                                             │
│                   StreetSense               │
│           Know before you go.               │
│        Coordinate with people you trust.    │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  • Personalized safety briefs          │  │
│  │  • Live map with your people           │  │
│  │  • Ask anything via chat               │  │
│  │  • Community-sourced + verified        │  │
│  └───────────────────────────────────────┘  │
│                                             │
│         [Get Started — It's Free]           │
│                                             │
│         Already have an account? Sign In    │
└─────────────────────────────────────────────┘
```

**UI Elements:**

- Hero section with tagline
- Feature bullets (3-4 max)
- CTA button: "Get Started — It's Free"
- Secondary link: "Sign In"
- "Sign In" button in top-right corner

**State:**

- No authentication required to view
- Clicking any CTA redirects to Auth

---

### Screen 1.2: Sign In / Sign Up Modal

**Purpose:** Simple email/password or Google OAuth.

**Layout:**

```
┌─────────────────────────────────────────────┐
│                                   [✕]       │
│                                             │
│              Welcome back                   │
│         Sign in to continue                 │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ Email                                 │  │
│  │ _______________________________       │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ Password                              │  │
│  │ _______________________________       │  │
│  └───────────────────────────────────────┘  │
│                                             │
│         [Sign In]                           │
│                                             │
│  ─────────── or ───────────                 │
│                                             │
│         [Continue with Google]              │
│                                             │
│         No account? Create one              │
└─────────────────────────────────────────────┘
```

**State:**

- Email validation
- Password visibility toggle
- Loading state on submit
- Error states: invalid credentials, network error

**API Endpoint:**

```
POST /api/auth/login
Request: { email, password }
Response: { token, user: { id, name, email } }
```

**Sign Up Flow:**

- Same modal, but with "Create Account" button
- After signup → redirect to Onboarding Flow

---

## Flow 2: Onboarding

### Screen 2.1: "What This Is / Isn't" Modal

**Purpose:** Ethical guardrail — sets expectations before user sees any data.

**Layout:**

```
┌─────────────────────────────────────────────┐
│                                   [✕]       │
│                                             │
│           ⚠️ Before you start               │
│                                             │
│  StreetSense is not a crime predictor.     │
│  We show you what's been reported —        │
│  you make your own choices.                │
│                                             │
│  ✓ What we do:                             │
│    • Summarize public incident reports     │
│    • Highlight community safety signals    │
│    • Explain the data behind every alert   │
│                                             │
│  ✗ What we don't do:                       │
│    • Predict where crime "will" happen     │
│    • Label neighborhoods "safe/dangerous"  │
│    • Replace your judgment                 │
│    • Share location without consent        │
│                                             │
│              [I Understand]                 │
└─────────────────────────────────────────────┘
```

**Behavior:**

- Shown once after first signup
- Must be dismissed to continue
- User cannot skip without acknowledging

---

### Screen 2.2: Create Your First Group

**Purpose:** Establish the social unit (family, trip group, roommates).

**Layout:**

```
┌─────────────────────────────────────────────┐
│  Step 1 of 3                                │
│                                             │
│  Who are you staying safe with?             │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ Group name                            │  │
│  │ [My Family_________________]          │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Group type:                                │
│  ○ Family (default)                        │
│  ○ Trip / Travel                           │
│  ○ Roommates / Housemates                  │
│  ○ Friends                                 │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ Add members (optional for now)        │  │
│  │                                       │  │
│  │ [Invite via link] [Invite by email]  │  │
│  │                                       │  │
│  │ + Add yourself as member              │  │
│  └───────────────────────────────────────┘  │
│                                             │
│         [Continue]                          │
└─────────────────────────────────────────────┘
```

**API Endpoint:**

```
POST /api/groups
Request: { name, type, members: [{ name, email? }] }
Response: { groupId, inviteLink }
```

---

### Screen 2.3: Add Members to Group

**Purpose:** Add people you coordinate with.

**Layout:**

```
┌─────────────────────────────────────────────┐
│  Step 2 of 3                                │
│                                             │
│  Add people to "My Family"                  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ Name               Role               │  │
│  ├───────────────────────────────────────┤  │
│  │ You (Maya)         Primary     [✓]   │  │
│  ├───────────────────────────────────────┤  │
│  │ [Name________]     [Role▼]     [Add] │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Roles:                                     │
│  • Primary — manages group settings         │
│  • Adult — can share location, view others  │
│  • Teen — limited sharing, can be monitored │
│  • Child — monitored by adults              │
│                                             │
│  [Invite by email]  [Share invite link]    │
│                                             │
│         [Continue]                          │
└─────────────────────────────────────────────┘
```

**API Endpoint:**

```
POST /api/groups/{groupId}/members
Request: { name, role, email? }
Response: { memberId, inviteSent }
```

---

### Screen 2.4: Set Up Locations

**Purpose:** Save important places for personalized briefings.

**Layout:**

```
┌─────────────────────────────────────────────┐
│  Step 3 of 3                                │
│                                             │
│  Add places you care about                  │
│                                             │
│  Saved places help us give you relevant     │
│  safety info without searching every time.  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 🏠 Home                               │  │
│  │ [123 Main St, Phoenix___________]     │  │
│  │                           [Use GPS]  │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 🏫 School / Work                      │  │
│  │ [_______________________________]     │  │
│  │                           [Use GPS]  │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 📍 Other saved places                 │  │
│  │ + Add place                           │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ ⏰ Typical commute times (optional)   │  │
│  │ School → Home: [3:30pm ▼]            │  │
│  │ Work → Home:   [5:30pm ▼]            │  │
│  └───────────────────────────────────────┘  │
│                                             │
│         [Go to Map]                         │
└─────────────────────────────────────────────┘
```

**API Endpoint:**

```
POST /api/users/places
Request: { name, address, lat, lng, type, typicalTimes? }
Response: { placeId }
```

---

## Flow 3: Main App (Live Map)

### Screen 3.1: Home — Live Map View

**Purpose:** Central hub — see your people + nearby events.

**Layout:**

```
┌─────────────────────────────────────────────┐
│  [☰]  StreetSense       [🔔] [💬] [👤]    │
├─────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐  │
│  │                                       │  │
│  │            [MAP VIEW]                 │  │
│  │                                       │  │
│  │   • Maya (home) — green dot          │  │
│  │   • Alex (school) — moving           │  │
│  │   • 🔴 Event pin — "Police activity" │  │
│  │   • 🟡 Community report — 0.2mi away │  │
│  │                                       │  │
│  └───────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│  Active sharing: Maya (you) ● Alex ● Sarah │
│  [Manage sharing]                          │
├─────────────────────────────────────────────┤
│  [📍 Plan trip]  [📝 Report]  [💬 Ask AI]  │
└─────────────────────────────────────────────┘
```

**Map Elements:**

- **User dots:** Green = active sharing, Gray = offline/not sharing
- **Event pins:**
  - Red = verified incident (police data)
  - Yellow = unverified community report
  - Blue = clustered signal (3+ reports)
- **Tap on dot:** Shows member profile + last known location + time
- **Tap on pin:** Shows mini-card with details + "How we know this"

**Top Bar:**

- Menu (☰) — group settings, account
- Notification bell (🔔) — recent alerts
- Chat icon (💬) — opens AI assistant
- Profile (👤) — user settings

**Bottom Bar:**

- Active sharing indicator (who's currently sharing location)
- Three action buttons: Plan trip, Report, Ask AI

**API Endpoints:**

```
GET /api/groups/{groupId}/members/live
Response: [{ memberId, name, lat, lng, lastUpdated, sharing }]

GET /api/events/nearby?lat={lat}&lng={lng}&radius={radius}
Response: [{ id, type, lat, lng, description, verified, source }]
```

---

### Screen 3.2: Location Sharing Toggle

**Purpose:** User controls when they're visible on the map.

**Trigger:** Tap "Manage sharing" or user's own dot.

**Layout:**

```
┌─────────────────────────────────────────────┐
│  Location Sharing                           │
│                                             │
│  Who can see your location:                 │
│                                             │
│  ☑ My Family — can see when I'm active     │
│  ☐ Spring Break Trip — not sharing         │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  Sharing mode:                              │
│  ○ Always (when app is open)               │
│  ○ Only during trips I share               │
│  ○ Manual — I turn on when I want          │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ [Start sharing now]                   │  │
│  │ [Stop sharing]                        │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  What they see: Your dot on map, no         │
│  history, no 24/7 tracking.                 │
└─────────────────────────────────────────────┘
```

---

## Flow 4: Safety Brief

### Screen 4.1: Safety Brief for Location

**Trigger:** Tap "Plan trip" → select location OR search from map.

**Layout:**

```
┌─────────────────────────────────────────────┐
│  ← Back           Downtown Phoenix          │
│                          [⭐ Save]          │
├─────────────────────────────────────────────┤
│  📋 What to know                            │
│                                             │
│  Mostly commercial area. Persistent         │
│  pickpocketing near the transit center,     │
│  evenings. Vehicle break-ins reported       │
│  in parking garages overnight.              │
│                                             │
│  Walking safety during daytime is generally │
│  good — lots of foot traffic.               │
│                                             │
│  [📋 How we know this]                      │
├─────────────────────────────────────────────┤
│  ⏰ Time of day matters                     │
│                                             │
│  • Daytime (6am–6pm): Routine activity      │
│  • Evening (6pm–11pm): Pickpocketing risk   │
│  • Late night (11pm–3am): Fewer reports     │
├─────────────────────────────────────────────┤
│  🏠 For your household                       │
│                                             │
│  Alex's bus route passes through here       │
│  at 3:30pm. During that time, area is      │
│  generally safe with active foot traffic.   │
│                                             │
│  [View Alex's route]                        │
├─────────────────────────────────────────────┤
│  [Plan trip from here]  [Report something]  │
└─────────────────────────────────────────────┘
```

---

### Screen 4.2: "How We Know This" Modal

**Trigger:** Tap the "How we know this" button on any safety card.

**Layout:**

```
┌─────────────────────────────────────────────┐
│  How we know this                    [✕]   │
├─────────────────────────────────────────────┤
│  Sources:                                   │
│                                             │
│  📊 Police data (Phoenix PD)               │
│     • 23 reports, last 60 days             │
│     • Within 0.5 miles                     │
│                                             │
│  👥 Community reports                       │
│     • 5 reports (clustered)                │
│     • Verified by AI: 2 confirmed          │
│                                             │
│  📰 Local news                               │
│     • 1 article (unrelated area)           │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  Incident breakdown (last 60 days):         │
│  • Theft from person: 12 reports           │
│  • Vehicle break-in: 8 reports             │
│  • Vandalism: 3 reports                    │
│                                             │
│  Last updated: March 21, 2026, 8:00 AM     │
│                                             │
│  [Report issue with this data]              │
└─────────────────────────────────────────────┘
```

**API Endpoint:**

```
GET /api/safety/brief?lat={lat}&lng={lng}&radius={radius}
Response: {
  summary,
  timeOfDayBreakdown,
  householdContext,
  sources: { police, community, news },
  incidentBreakdown
}
```

---

## Flow 5: Route Planning

### Screen 5.1: Route Planner

**Trigger:** Tap "Plan trip" from home screen.

**Layout:**

```
┌─────────────────────────────────────────────┐
│  ← Back           Plan a trip               │
├─────────────────────────────────────────────┤
│  From:                                      │
│  [School____________________] [📍]          │
│                                             │
│  To:                                        │
│  [Home_____________________] [📍]          │
│                                             │
│  Departure: [Today, 3:30 PM ▼]             │
│                                             │
│  Traveling: [Alex (teen) ▼]                │
│                                             │
│  [Find routes]                              │
├─────────────────────────────────────────────┤
│  Saved routes:                              │
│  • School → Home (daily, 3:30pm)           │
│  • Work → Home (evening)                   │
│  • + Add saved route                        │
└─────────────────────────────────────────────┘
```

---

### Screen 5.2: Route Comparison

**Trigger:** After finding routes.

**Layout:**

```
┌─────────────────────────────────────────────┐
│  ← Back        3 routes found               │
├─────────────────────────────────────────────┤
│  🚌 Route A — Bus 72                        │
│  35 min • 2.3 miles • 5 min walk           │
│  ┌───────────────────────────────────────┐  │
│  │ Safety: This route passes through     │  │
│  │ areas with recent pickpocketing       │  │
│  │ (evenings). At 3:30pm, area is busy   │  │
│  │ with students — lower risk.           │  │
│  │                                       │  │
│  │ ⚠️ Bus stop at 7th Ave & McDowell    │  │
│  │    had 2 reports of harassment        │  │
│  │    (both evenings, none daytime).     │  │
│  │                                       │  │
│  │ [View on map]  [Select route]         │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  🚶‍♂️ Route B — Walk + Bus 10                │
│  42 min • 2.1 miles • 12 min walk          │
│  ┌───────────────────────────────────────┐  │
│  │ Safety: This route stays on busier    │  │
│  │ streets with consistent foot traffic. │  │
│  │ No recent incidents reported.         │  │
│  │                                       │  │
│  │ [View on map]  [Select route]         │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  🚗 Route C — Rideshare                     │
│  15 min • estimated $12                    │
│  ┌───────────────────────────────────────┐  │
│  │ Safety: Standard rideshare safety     │  │
│  │ (match with licensed drivers).        │  │
│  │                                       │  │
│  │ [Book via Uber/Lyft]                  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**API Endpoint:**

```
POST /api/routes/compare
Request: { from, to, departureTime, travelerType }
Response: {
  routes: [{
    id,
    duration,
    distance,
    safetyContext,
    warnings,
    incidentsAlongRoute
  }]
}
```

---

## Flow 6: Community Report

### Screen 6.1: Submit Report

**Trigger:** Tap "Report" from home screen.

**Layout:**

```
┌─────────────────────────────────────────────┐
│  ← Back        Report something             │
├─────────────────────────────────────────────┤
│  What did you observe?                      │
│  (Reports are about conditions, not people) │
│                                             │
│  ☐ Streetlight out / broken                │
│  ☐ Unusual police activity                 │
│  ☐ I felt unsafe here (no details needed)  │
│  ☐ Heard gunshots / yelling / disturbance  │
│  ☐ Suspicious activity                     │
│  ☐ Other safety concern                    │
│                                             │
│  Description (optional):                    │
│  ┌───────────────────────────────────────┐  │
│  │                                       │  │
│  │                                       │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ⚠️ Please do NOT include:                  │
│  • Descriptions of specific people          │
│  • License plates                           │
│  • Addresses of private residences          │
│                                             │
│  Location: [Auto-detected] [Adjust]        │
│  Time: [Now ▼]                              │
│                                             │
│  [Submit report]                            │
└─────────────────────────────────────────────┘
```

**After Submit:**

```
┌─────────────────────────────────────────────┐
│  ✓ Report submitted                         │
│                                             │
│  Your report is now visible to others in    │
│  this area with an "unverified" tag.        │
│                                             │
│  AI will review it shortly. If verified,    │
│  it will help others stay informed.         │
│                                             │
│  [Done]  [View on map]                      │
└─────────────────────────────────────────────┘
```

**API Endpoint:**

```
POST /api/reports
Request: { category, description, lat, lng, timestamp }
Response: { reportId, status: "pending_verification" }
```

---

## Flow 7: Chat Assistant

### Screen 7.1: AI Chat Interface

**Trigger:** Tap chat icon (💬) from home screen.

**Layout:**

```
┌─────────────────────────────────────────────┐
│  ← Back        Ask StreetSense              │
├─────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐  │
│  │ 💬 Hey! Ask me about any area,        │  │
│  │ route, or safety question.            │  │
│  │                                       │  │
│  │ Try:                                  │  │
│  │ • "Is Tempe Town Lake safe tonight?"  │  │
│  │ • "What happened near downtown?"      │  │
│  │ • "Is my kid's bus route okay?"       │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ User: Is Tempe Town Lake safe tonight?│  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ AI: Based on last 30 days of data,   │  │
│  │ Tempe Town Lake is generally safe    │  │
│  │ in the evenings. There have been 2   │  │
│  │ reports of vehicle break-ins in the  │  │
│  │ parking lot, but no incidents on the │  │
│  │ walking paths.                       │  │
│  │                                       │  │
│  │ 📋 Sources: 12 police reports,       │  │
│  │    3 community reports               │  │
│  │                                       │  │
│  │ [Show on map] [How we know this]     │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ [Type your question..._________] [➤] │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**API Endpoint:**

```
POST /api/chat
Request: { query, context: { userId, location? } }
Response: { answer, sources, suggestedFollowups }
```

---

## Flow 8: Groups & Sharing

### Screen 8.1: Groups List

**Trigger:** Tap menu (☰) → "My Groups".

**Layout:**

```
┌─────────────────────────────────────────────┐
│  ← Back        My Groups                    │
│                                   [+ New]   │
├─────────────────────────────────────────────┤
│  👨‍👩‍👧 My Family                             │
│     4 members • Sharing: 2 active          │
│     Last active: 5 min ago                 │
│                                             │
│  🏖️ Spring Break Trip                       │
│     6 members • Sharing: 0 active          │
│     Last active: 2 days ago                │
│                                             │
│  🏠 Roommates (Downtown)                    │
│     3 members • Sharing: 1 active          │
│     Last active: Now                        │
└─────────────────────────────────────────────┘
```

---

### Screen 8.2: Group Details

**Trigger:** Tap a group from Groups List.

**Layout:**

```
┌─────────────────────────────────────────────┐
│  ← Back        My Family                    │
│                          [⚙️ Settings]      │
├─────────────────────────────────────────────┤
│  Members (4)                    [+ Invite]  │
│  ┌───────────────────────────────────────┐  │
│  │ 🟢 Maya (you)          Primary        │  │
│  ├───────────────────────────────────────┤  │
│  │ 🟢 Alex                Teen           │  │
│  │    Last seen: 5 min ago at school    │  │
│  ├───────────────────────────────────────┤  │
│  │ ⚪ Sarah               Adult          │  │
│  │    Not sharing                        │  │
│  ├───────────────────────────────────────┤  │
│  │ ⚪ Dad                 Adult          │  │
│  │    Not sharing                        │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Group settings:                            │
│  • Location sharing: Members choose        │
│  • Notifications: On for all              │
│                                             │
│  [Leave group]                              │
└─────────────────────────────────────────────┘
```

---

## Component Library

### Reusable Components


| Component        | Purpose                   | Props                                         |
| ---------------- | ------------------------- | --------------------------------------------- |
| `SafetyCard`     | Display safety brief      | `title`, `summary`, `onHowWeKnow`, `onAction` |
| `SourceModal`    | Show data sources         | `sources`, `incidentBreakdown`, `lastUpdated` |
| `MapView`        | Interactive map with pins | `center`, `markers`, `onMarkerTap`            |
| `UserDot`        | User location marker      | `user`, `status`, `onTap`                     |
| `EventPin`       | Incident/community pin    | `type`, `verified`, `onTap`                   |
| `LoadingSpinner` | Loading state             | `size`, `color`                               |
| `Toast`          | Temporary notifications   | `message`, `type`, `duration`                 |
| `BottomSheet`    | Modal that slides up      | `isOpen`, `onClose`, `children`               |


---

## API Contract Summary

### Authentication


| Endpoint           | Method | Request                     | Response          |
| ------------------ | ------ | --------------------------- | ----------------- |
| `/api/auth/login`  | POST   | `{ email, password }`       | `{ token, user }` |
| `/api/auth/signup` | POST   | `{ email, password, name }` | `{ token, user }` |


### Groups


| Endpoint                        | Method | Request                   | Response                                  |
| ------------------------------- | ------ | ------------------------- | ----------------------------------------- |
| `/api/groups`                   | POST   | `{ name, type, members }` | `{ groupId, inviteLink }`                 |
| `/api/groups/{id}/members`      | POST   | `{ name, role, email }`   | `{ memberId }`                            |
| `/api/groups/{id}/members/live` | GET    | —                         | `[{ memberId, name, lat, lng, sharing }]` |


### Safety


| Endpoint              | Method | Request                                     | Response                                     |
| --------------------- | ------ | ------------------------------------------- | -------------------------------------------- |
| `/api/safety/brief`   | GET    | `lat, lng, radius`                          | `{ summary, timeOfDay, sources, incidents }` |
| `/api/routes/compare` | POST   | `{ from, to, departureTime, travelerType }` | `{ routes }`                                 |
| `/api/events/nearby`  | GET    | `lat, lng, radius`                          | `[{ id, type, lat, lng, verified }]`         |


### Reports


| Endpoint       | Method | Request                                          | Response               |
| -------------- | ------ | ------------------------------------------------ | ---------------------- |
| `/api/reports` | POST   | `{ category, description, lat, lng, timestamp }` | `{ reportId, status }` |


### Chat


| Endpoint    | Method | Request              | Response              |
| ----------- | ------ | -------------------- | --------------------- |
| `/api/chat` | POST   | `{ query, context }` | `{ answer, sources }` |


---

## Build Order for Frontend (Priority)


| Priority | Screen/Component    | Dependencies                    |
| -------- | ------------------- | ------------------------------- |
| P0       | Landing + Auth      | None — can mock API             |
| P0       | Onboarding flow     | Auth token, mock group creation |
| P0       | Main Map view       | Map library, mock markers       |
| P1       | Safety Brief        | Brief API                       |
| P1       | "How We Know" modal | Source data from brief          |
| P2       | Route Planner       | Route API                       |
| P2       | Report submission   | Report API                      |
| P3       | Chat Assistant      | Chat API                        |
| P3       | Groups management   | Groups API                      |


---

## Quick Start Commands (Frontend)

If you're using React Native + Expo:

```bash
npx create-expo-app streetsense --template
cd streetsense
npm install react-native-maps @react-navigation/native @react-navigation/stack axios
```

If you're using React + Vite (web-first):

```bash
npm create vite@latest streetsense -- --template react-ts
cd streetsense
npm install react-router-dom leaflet react-leaflet axios
```

---

This spec gives you everything you need to start building. Your backend team knows exactly what endpoints to implement, and you know exactly what screens to build.

Want me to provide:

1. **Sample mock data** for you to test with while backend builds?
2. **Component code snippets** for the first few screens?
3. **Map integration setup** (Leaflet for web or React Native Maps)?

 