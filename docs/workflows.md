# Application Workflows

This document explains how the Peer Coaching Network works end to end: how each
coach's availability is calculated and updated, how bookings are created and
cancelled, and who is allowed to do what.

The app is a **client-only SPA** (React + Firebase, no backend services). All
"server logic" is therefore enforced in two places:

- **Firestore security rules** ([`firestore.rules`](../firestore.rules)) — the
  authorization boundary.
- **Client-side Firestore transactions** — the concurrency guard for bookings.

---

## 1. Data model — which data lives in which collection

Collection names come from [`src/config/collections.ts`](../src/config/collections.ts).

| Collection | Document ID | Holds | Who writes it |
|---|---|---|---|
| `users/{uid}` | Firebase Auth `uid` | Profile: name, email, gender, country, ICF credentials, bio, timezone, `userRole` (`user`/`admin`), `userStatus` (`active`/`inactive`) | Owner (non-privileged fields) / Admin (role + status) |
| `users/{uid}/schedule/availableDays` | fixed name `availableDays` | Weekly recurring template: 7 days, each `{ enabled, slots[] }` | Owner only |
| `users/{uid}/schedule/blockedDates` | fixed name `blockedDates` | Array of blackout date strings (max 100) | Owner only |
| `availableSlotsCache/{uid}` | `= uid` | **Derived** flat list of bookable UTC slot ISO strings + denormalized `gender` / `country` / `icf_*` / `userStatus` for querying | Owner only (recomputed client-side) |
| `bookings/{coachUid}_{startIso}` | `coachUid` + start ISO | Authoritative booking: `coachUid`, `clientUid`, `startTime`, `endTime`, `topic`, `status`, `googleEventId`, `googleMeetLink` | Either participant |
| `clientBookingCache/{clientUid}_{startIso}` | `clientUid` + start ISO | Per-mentee slot lock (TTL `expireAt`) to stop double-booking yourself across coaches | The client |
| `supportRequests/{id}` | auto | Support tickets + message thread | Owner + admin |
| `systemLogs/{id}` | auto | Telemetry (TTL `expireAt`) | Anyone creates, admin reads |

**Key design idea:** `availableDays` / `blockedDates` is the **source template**,
and `availableSlotsCache` is a **flattened, denormalized index** built from it so
discovery can run as a single Firestore query. Live bookings are always read from
the authoritative `bookings` collection and subtracted client-side — the cache is
never trusted for "is this slot free right now."

---

## 2. Permissions

Enforced server-side in [`firestore.rules`](../firestore.rules). `isAdmin()` =
signed-in **AND** `users/{me}.userRole == 'admin'` **AND** `userStatus == 'active'`
(a live `get()` on your own doc).

| Action | Anonymous | Signed-in `user` | Owner | Admin |
|---|---|---|---|---|
| Read any profile | ❌ | ✅ | ✅ | ✅ |
| Create own profile (must be `inactive` + `user`) | ❌ | — | ✅ (self) | ✅ |
| Edit own non-privileged fields | ❌ | ❌ | ✅ | ✅ |
| Change `userRole` / `userStatus` (approve users, make admins) | ❌ | ❌ | ❌ | ✅ |
| Edit own availability / blocked dates | ❌ | ❌ | ✅ | ✅ (as owner) |
| Create booking (must be a participant, id must start `coachUid_`, status `pending`) | ❌ | ✅ | ✅ | ✅ |
| Cancel / update booking | ❌ | participant only | ✅ | ✅ any |
| Read / manage support tickets | ❌ | own only | own | ✅ all |

There is **no self-serve admin**: new users are always created `inactive` / `user`,
and only an existing admin can flip them to `active` or `admin`.

---

## 3. Sign-up, onboarding & approval

`registerOrSyncGoogleUser` (`src/services/firebaseService.ts`) bootstraps the user
and default schedule. App gating lives in `src/App.tsx`.

```mermaid
sequenceDiagram
    actor U as New User
    participant App as React SPA
    participant Auth as Firebase Auth
    participant FS as Firestore

    U->>App: Click "Sign in with Google"
    App->>Auth: signInWithRedirect (calendar scopes)
    Auth-->>App: redirect back + access token (in-memory only)
    App->>FS: getDoc users/{uid}
    alt First time
        App->>FS: setDoc users/{uid} {userRole:user, userStatus:INACTIVE}
        App->>FS: setDoc users/{uid}/schedule/availableDays (Mon-Fri 9-5 default)
        App->>FS: setDoc users/{uid}/schedule/blockedDates {[]}
    else Returning
        App->>FS: updateDoc users/{uid} (sync Google name/photo/email)
    end
    App->>App: isApproved(profile)? userStatus==active
    alt Not onboarded
        App-->>U: OnboardingWizard
    else Onboarded but inactive
        App-->>U: VerificationNotice ("await admin approval")
    else Active
        App-->>U: Dashboard
    end
```

**Approval step:** an admin in `UserManagement` calls `setUserRoleAndStatus` →
`updateProfile`, which writes `userStatus: 'active'` (allowed because `isAdmin()`)
and immediately triggers `recalculateAvailableSlotsCache` so the newly-active coach
appears in discovery.

---

## 4. How availability is calculated & updated per coach

A coach edits their weekly template in `AvailabilityEdit`. Saving writes the two
`schedule/*` docs, then flattens them into `availableSlotsCache/{uid}` via
`doRecalculateAvailableSlotsCache`.

```mermaid
sequenceDiagram
    actor C as Coach (owner)
    participant AE as AvailabilityEdit.tsx
    participant FS as Firestore
    participant Recalc as recalculateAvailableSlotsCache

    C->>AE: Edit weekly slots / block dates, Save
    AE->>FS: setDoc schedule/availableDays (7 days x slots)
    AE->>FS: setDoc schedule/blockedDates {blockedDates[]}
    Note over FS: rules: isOwner(uid) + shape validation
    AE->>Recalc: recalculateAvailableSlotsCache(uid)
    Recalc->>FS: getDoc users/{uid} (timezone, gender, country, icf_*, status)
    Recalc->>FS: getSchedule(uid) (both schedule docs)
    loop next BOOKING_HORIZON_DAYS days
        Recalc->>Recalc: skip blocked / disabled days
        Recalc->>Recalc: expand each slot into hourly UTC ISO strings
    end
    Recalc->>FS: setDoc availableSlotsCache/{uid} {availableSlots[], availableDatesUtc[], gender, country, icf_*, userStatus}
```

Key points:

- **Timezone-aware:** the template stores wall-clock times; recalc converts them to
  absolute UTC using the coach's `timezone`, so a "9 AM" slot lands correctly for
  viewers in other zones.
- **The cache is intentionally denormalized** — it copies `gender` / `country` /
  `icf_*` / `userStatus` so discovery can filter coaches with one query without
  joining `users`.
- **Serialized per-uid:** `recalcChains` chains concurrent recalcs so overlapping
  triggers (schedule save + profile edit) can't clobber each other.
- **Re-triggered on any relevant change:** `updateSchedule`, `updateOwnProfile`, and
  admin `updateProfile` all call it — because a status / country / gender change
  alters what discovery should return.

---

## 5. Coach discovery (reading availability)

A mentee browses in `UpcomingSessions`, which calls `queryAvailableCoachesForDay`.
This is where the cache pays off, and where live bookings are subtracted.

```mermaid
sequenceDiagram
    actor M as Mentee
    participant UI as UpcomingSessions.tsx
    participant FS as Firestore

    M->>UI: Pick a day + filters (gender/country/ICF)
    UI->>FS: query availableSlotsCache where availableDatesUtc array-contains-any [dates] + filters
    FS-->>UI: candidate coaches (their cached slot lists)
    UI->>UI: drop self, keep userStatus==active
    UI->>FS: query bookings where startTime in [dayStart,dayEnd] AND status==confirmed
    FS-->>UI: confirmed bookings that day
    UI->>UI: build busy-set per slot (coachUid + clientUid busy)
    UI->>FS: getDocs users where documentId in candidateUids (chunks of 30)
    FS-->>UI: coach profiles
    loop each time slot
        UI->>UI: coach available if slot in cache AND not in busy-set
        UI->>UI: seededShuffle + slice to COACH_DISCOVERY_LIMIT
    end
    UI-->>M: available coaches per slot
```

So **availability shown = (cached template slots) − (confirmed bookings for that
coach/mentee at that time)**. The cache gives the candidate pool cheaply; the
authoritative `bookings` collection removes anything actually taken. `seededShuffle`
fairly rotates which coaches appear first.

---

## 6. Booking a session

The core of the app: `scheduleMeeting` (`src/services/googleCalendar.ts`). It uses
a **Firestore transaction to atomically claim the slot**, then creates the Google
Calendar event, then confirms — with rollback if Google fails.

```mermaid
sequenceDiagram
    actor M as Mentee (client)
    participant SM as ScheduleModal.tsx
    participant Book as scheduleMeeting()
    participant TX as Firestore Transaction
    participant G as Google Calendar API

    M->>SM: Enter topic, Confirm
    SM->>Book: scheduleMeeting(coach, client, start, end, topic)
    Note over Book: bookingId = coachUid_startIso<br/>lock = clientUid_startIso

    rect rgb(230,240,255)
    Book->>TX: runTransaction (up to 3 attempts)
    TX->>TX: read bookings/coachUid_start (coach busy as coach?)
    TX->>TX: read clientBookingCache/coachUid_start (coach busy as client?)
    TX->>TX: read clientBookingCache/clientUid_start (client already booked?)
    TX->>TX: read bookings/clientUid_start (client busy as coach?)
    alt any conflict
        TX-->>Book: throw SLOT_TAKEN / BOOKED_AS_CLIENT / BOOKED_AS_COACH
    else free
        TX->>TX: set bookings/{bookingId} status=PENDING
        TX->>TX: set clientBookingCache/{clientUid_start} (TTL +24h)
    end
    end

    Book->>G: POST /events (attendee=coach, create Meet link, sendUpdates=all)
    alt Google 401 / error / network
        Book->>TX: updateDoc booking status=CANCELLED
        Book->>TX: deleteDoc clientBookingCache lock
        Book-->>SM: GOOGLE_TOKEN_EXPIRED / GOOGLE_API_ERROR
        SM-->>M: "Reconnect Google" / retry
    else success
        G-->>Book: eventId + hangoutLink
        Book->>TX: updateDoc booking {googleEventId, googleMeetLink, status=CONFIRMED}
        Book-->>SM: CalendarEvent
        SM-->>M: "Session Confirmed" + Meet link
    end
```

Why it's built this way:

- **The transaction is the concurrency guard.** Two mentees racing for the same
  coach slot both read `bookings/{coachUid}_{start}`; only one commits, the other
  gets `SLOT_TAKEN`. The security rule also pins `bookingId` to the `coachUid_`
  prefix so a client can't fabricate a booking ID to hijack a different slot.
- **Four conflict checks** cover every double-book: coach busy as coach, coach busy
  as client, mentee already has this slot with *any* coach (the `clientBookingCache`
  lock), and mentee busy as a coach at that time.
- **Two-phase status (`pending` → `confirmed`)** means a booking only becomes
  visible to discovery (which filters `status == confirmed`) after the Google event
  exists. If Google fails, it's rolled back to `cancelled` and never counted as busy.
- The Google **access token is held in memory only** (never persisted) — an expired
  token surfaces as the "Reconnect Google" flow in the modal.

---

## 7. Cancellation

`cancelBooking` (`src/services/googleCalendar.ts`) — Google first, then Firestore,
then release the lock.

```mermaid
sequenceDiagram
    actor P as Participant (coach or client)
    participant UI as MySessions / UpcomingSessions
    participant Cancel as cancelBooking()
    participant G as Google Calendar API
    participant FS as Firestore

    P->>UI: Cancel session
    UI->>Cancel: cancelBooking(bookingId)
    Cancel->>FS: getDoc bookings/{bookingId}
    Cancel->>G: DELETE /events/{googleEventId} (sendUpdates=all)
    Note over G: 404 tolerated, 401 -> reconnect
    Cancel->>FS: updateDoc booking {status=CANCELLED, cancelledAt}
    Cancel->>FS: deleteDoc clientBookingCache/{clientUid_start}
```

Setting `status = cancelled` immediately drops the slot out of the `confirmed`-only
subscriptions, and deleting the `clientBookingCache` lock frees the mentee to rebook
that time. The rule allows either participant **or** an admin to cancel/delete, but
`coachUid` / `clientUid` / `startTime` / `endTime` are immutable on update — you can
change status, never rewrite who/when.

---

## The mental model in one line

`schedule/*` (template, owner-written) → flattened into `availableSlotsCache`
(denormalized index) → filtered against live `bookings` (authoritative,
transaction-guarded) at discovery time; `clientBookingCache` is the per-mentee lock
that makes the booking transaction safe; and every write boundary is enforced by
[`firestore.rules`](../firestore.rules) since there is no server.
