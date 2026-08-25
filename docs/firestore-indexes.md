# Cloud Firestore Composite Indexes

This document inventories the composite indexes configured in `firestore.indexes.json` along with the query shapes they support.

---

## 1. `systemLogs`

### `type` (ASC) + `timestamp` (DESC)
- **Query Function**: `systemLogsQuery` in `web/src/services/firestoreRepository.ts`
- **Purpose**: Powers the Admin System Logs view when filtering by severity (e.g. `type == 'error'` or `type in ['error', 'warn']`) ordered by most recent logs first.

### `userId` (ASC) + `timestamp` (DESC)
- **Query Function**: `systemLogsByUserQuery` in `web/src/services/firestoreRepository.ts`
- **Purpose**: Powers user activity traceability in the Admin System Logs view by fetching all telemetry and cloud function logs associated with a specific `userId`, ordered chronologically (newest first).

---

## 2. `bookings`

### `coachUid` (ASC) + `endTime` (ASC)
- **Query Function**: `upcomingCoachBookingsQuery` in `web/src/services/firestoreRepository.ts`
- **Purpose**: Powers upcoming bookings queries for coaches where `coachUid == x` and `endTime >= now` sorted ascending by slot time.

### `clientUid` (ASC) + `endTime` (ASC)
- **Query Function**: `upcomingClientBookingsQuery` in `web/src/services/firestoreRepository.ts`
- **Purpose**: Powers upcoming bookings queries for clients where `clientUid == x` and `endTime >= now` sorted ascending by slot time.
