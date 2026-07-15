# Firestore Queries & Composite Indexes

This document records how the app's Firestore reads map to composite indexes,
and the query optimizations that let us shrink the index set.

All Firestore access lives in a single data-access module —
[`src/services/firestoreRepository.ts`](../src/services/firestoreRepository.ts) —
whose private query builders can be audited against
[`firestore.indexes.json`](../firestore.indexes.json) in one place. (The call
chain is `application → service → firestoreRepository → Firestore`.)

## When a composite index is required

Firestore automatically maintains **single-field** indexes (both directions).
A **composite** index is only required when a query combines:

- an equality / `in` filter (or an `orderBy`) with a range or `orderBy` on a
  **different** field.

Queries that do **not** need a composite index:

- equality-only filters, including `and` / `or` compositions of them
  (served by single-field indexes + merge join);
- a range on a **single** field (e.g. `startTime >= a AND startTime <= b`);
- a single-field `orderBy`.

## Query → index audit

Query builders are private helpers inside `firestoreRepository.ts`, executed by
the exported repository functions.

| Query builder (private, in `firestoreRepository.ts`) | Collection      | Shape                                                        | Composite index needed?                         |
| --------------------------------------- | ------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| `allUsersCollection`                    | users                     | full collection                                              | No                                              |
| `usersByStatusQuery`                    | users                     | `userStatus == x`                                            | No (single equality)                            |
| `usersByIdsQuery`                       | users                     | `documentId() in [...]`                                      | No (single `in`)                                |
| `activeUsersByIdsQuery`                 | users                     | `documentId() in [...] AND userStatus == active`            | No (equality-only)                              |
| `bookingsByClientQuery`                 | bookings                  | `clientUid == x`                                             | No (single equality)                            |
| `bookingsByCoachQuery`                  | bookings                  | `coachUid == x`                                              | No (single equality)                            |
| `upcomingBookingsByClientQuery`         | bookings                  | `clientUid == x AND endTime >= now`                          | **Yes** — `bookings (clientUid, endTime)`       |
| `upcomingBookingsByCoachQuery`          | bookings                  | `coachUid == x AND endTime >= now`                           | **Yes** — `bookings (coachUid, endTime)`        |
| `confirmedBookingsByParticipantQuery`   | bookings                  | `status == CONFIRMED AND (clientUid == x OR coachUid == x)`  | No (equality-only and/or)                       |
| `busySlotsInStartTimeRangeQuery`        | busySlots                 | `startTime >= a AND startTime <= b`                          | No (single-field range)                         |
| `coachAvailabilityByCoachQuery`         | coachAvailabilityByDate   | `coachUid == x`                                              | No (single equality)                            |
| `coachAvailabilityByDatesQuery`         | coachAvailabilityByDate   | `dateISO in [...]`                                           | No (single `in`)                                |
| `personalAvailabilityCacheByIdsQuery`   | personalAvailabilityCache | `documentId() in [...]`                                      | No (single `in`)                                |
| `supportRequestsByUserQuery`            | supportRequests           | `userId == x`                                                | No (single equality)                            |
| `supportMessagesQuery`                  | supportRequests/{id}/messages | `orderBy(createdAt asc)`                                 | No (single-field orderBy)                       |
| `systemLogsQuery`                       | systemLogs                | `orderBy(timestamp desc)` [+ `type ==` / `type in`] + page   | **Yes** (when filtered) — `systemLogs (type, timestamp)` |

(`fetchAllSupportRequestDocs` reads the whole `supportRequests` collection with
no filter/order and sorts by `updatedAt` in memory — no index.)

## Result: 3 composite indexes

`firestore.indexes.json` carries **3** composite indexes:
`bookings (clientUid, endTime)`, `bookings (coachUid, endTime)`, and
`systemLogs (type, timestamp)`. Two indexes that previously existed are no longer
needed and were dropped:

### Dropped — `supportRequests (userId ASC, updatedAt DESC)`

`getSupportRequestsForUser` and `getAllSupportRequests` filter without a
server-side `orderBy` and sort by `updatedAt` **in memory**. A user owns only a
handful of tickets, so the sort is trivial and no composite index is needed.

### Dropped — `bookings (status ASC, startTime ASC)`

Coach discovery no longer scans `bookings` for busy times; it reads the public
`busySlots` collection with a single-field `startTime` day-range (no composite
index). The old `bookings (status, startTime)` index is dead.

### Kept — `bookings (clientUid, endTime)` and `bookings (coachUid, endTime)`

`getUpcomingEvents` fetches a user's **future** bookings via
`endTime >= now` combined with the participant (`clientUid` / `coachUid`)
equality filter. These two indexes are retained on purpose: dropping the
`endTime` range would require reading **every** booking the user has ever had
(bookings have no TTL and grow unbounded) and re-deriving "upcoming" in memory,
which trades a bounded, indexed read on a hot dashboard path for an unbounded
one. The read cost outweighs the one-index saving, so the indexes stay.

### Kept — `systemLogs (type, timestamp)`

The admin log viewer paginates server-side (`orderBy(timestamp)` + `startAfter`
+ `limit`) and filters by severity. The log collection is large, so in-memory
filtering/sorting is not viable — this composite index is genuinely required.
