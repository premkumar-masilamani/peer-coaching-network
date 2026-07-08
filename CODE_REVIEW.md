# Consolidated Code Review — Peer Coaching Network

- **Date:** 2026-07-07
- **Repository:** https://github.com/premkumar-masilamani/peer-coaching-network
- **Commit reviewed:** b5a991e
- **Stack:** React 19 + TypeScript + Vite + Firebase (Firestore, Auth, Hosting) SPA — no server-side component
- **Methodology:** Four specialist review agents (Solution Architect, Security Architect, Frontend Expert, Backend Expert) reviewed the codebase independently. This report is the consolidation pass: every finding was critically reviewed, doubtful claims were spot-checked against the source, duplicates were merged, and severities were normalized. All Critical/High findings and all security-rule findings were verified line-by-line against the repository.

> **Tracking status (updated 2026-07-07).** All 52 findings below were filed as GitHub issues **except PCN-008**, which was skipped because it duplicates the pre-existing open issue [#110 "Google Calendar Token Expiry detection"](https://github.com/premkumar-masilamani/peer-coaching-network/issues/110). The other 51 findings are issues **#116–#166** (in report order, skipping PCN-008), each titled `[PCN-nnn][Severity][Category]`. Every issue was tagged with a severity label (`severity: critical` / `high` / `medium` / `low`), and the **13 Critical + High** findings (PCN-001–PCN-014, minus PCN-008) were grouped under the milestone [**"Code Review Remediation — Critical & High"**](https://github.com/premkumar-masilamani/peer-coaching-network/milestone/1). No findings were added, removed, or reworded after this report was generated.

## Executive Summary

The application is a well-intentioned client-only Firebase SPA with several genuinely strong practices (memory-only OAuth token handling, URL sanitizers, admin-gated privileged writes, forced-inactive self-signup). However, the client-only architecture pushes responsibilities that need a trusted backend — booking orchestration, cache maintenance, credential verification — into the browser, and this is the root cause of the most serious findings. The single Critical finding is the non-atomic three-step booking saga: an interrupted flow leaves a `pending` booking that permanently blocks the slot, with orphaned Google Calendar events and no reaper to clean up. Two High security-rule bugs were verified: any signed-in user can overwrite any coach's availability cache (a broken disjunct in `firestore.rules`), and users can self-assign verified ICF credentials because the self-update rule does not pin the credential fields.

Beyond those, a cluster of verified High-severity correctness bugs undermine the core discovery/booking feature: the rules' 200-slot cap silently rejects cache writes for coaches with ample availability (30-day horizon can generate 240+ slots), exact ISO-string slot matching breaks for fractional-offset timezones (notable given the asia-south1 deployment target), deactivated users remain discoverable and bookable, and the availability cache decays for idle coaches because nothing refreshes it server-side. The production build config can silently fall back to the development database ID. Frontend quality is mixed: solid utility/test hygiene in places, but systemic accessibility gaps (no dialog semantics, keyboard-inaccessible controls), a StrictMode-unsafe state-update pattern, and a bypassable unsaved-changes guard. The recurring recommendation across all four reviews is to introduce a minimal Cloud Functions layer and fix the two rules vulnerabilities immediately.

## Summary Table

| ID | Title | Severity | Category | Type |
|---|---|---|---|---|
| PCN-001 | Non-atomic client-side booking saga permanently blocks slots on interruption | Critical | Backend | Issue |
| PCN-002 | Any signed-in user can overwrite any coach's availableSlotsCache | High | Security | Vulnerability |
| PCN-003 | Users can self-assign verified ICF credentials via direct profile update | High | Security | Vulnerability |
| PCN-004 | Rules 200-slot cap silently rejects availability cache writes for available coaches | High | Backend | Issue |
| PCN-005 | Exact ISO slot matching breaks across fractional-offset timezones | High | Backend | Issue |
| PCN-006 | Deactivated/inactive users remain discoverable and bookable | High | Backend | Issue |
| PCN-007 | Availability cache goes stale for idle coaches; no scheduled refresh; credential updates skip recalc | High | Architecture | Issue |
| PCN-008 | Google OAuth token lost on reload; calendar operations (incl. cancel) fail until re-login | High | Backend | Issue |
| PCN-009 | Production build silently falls back to development database ID | High | Architecture | Issue |
| PCN-010 | Side effects inside setState updaters double-fire under StrictMode | High | Frontend | Issue |
| PCN-011 | Unsaved-changes guard bypassed by profile navigation and page unload | High | Frontend | Issue |
| PCN-012 | All modals lack dialog semantics, focus management, and Escape handling | High | Frontend | Issue |
| PCN-013 | Keyboard-inaccessible interactive elements (date tabs, avatars, logo) | High | Frontend | Issue |
| PCN-014 | firebaseService.ts is a 933-line god module spanning seven domains | High | Architecture | Issue |
| PCN-015 | All bookings (incl. Meet links and topics) readable by any signed-in user | Medium | Security | Vulnerability |
| PCN-016 | Fabricated fallback Google Meet links persisted to bookings | Medium | Backend | Issue |
| PCN-017 | meetLink rendered as unsanitized href in SessionDetailsModal | Medium | Frontend | Issue |
| PCN-018 | Support ticket messages stored as one doc array with non-transactional read-modify-write | Medium | Backend | Issue |
| PCN-019 | N+1 sequential profile reads in booking hydration (batched helper exists) | Medium | Backend | Issue |
| PCN-020 | Day-availability fetch race lets stale results overwrite newer selection | Medium | Frontend | Issue |
| PCN-021 | Client clocks used for authoritative timestamps and cache expiry | Medium | Backend | Warning |
| PCN-022 | Firestore listeners without error callbacks die silently | Medium | Backend | Warning |
| PCN-023 | Client-side HTML scraping of ICF credential site is fragile and likely CORS-blocked | Medium | Backend | Warning |
| PCN-024 | No React error boundary; module-scope config throw white-screens the app | Medium | Frontend | Issue |
| PCN-025 | No router; broken history behavior and no deep-linking | Medium | Frontend | Issue |
| PCN-026 | Components bypass the service layer with raw Firestore queries | Medium | Architecture | Issue |
| PCN-027 | Unbounded collection reads without limits or pagination | Medium | Architecture | Warning |
| PCN-028 | Dev deploy channel ships a development-mode bundle, disarming prod guards | Medium | Architecture | Warning |
| PCN-029 | CI/CD gaps: no CI on push/PR, no environment protection, --debug deploys | Medium | Backend | Warning |
| PCN-030 | No code splitting; admin-only code and 1,944-line timezone data eagerly bundled | Medium | Frontend | Issue |
| PCN-031 | Monolithic components with large inline style blocks and unscoped selectors | Medium | Frontend | Warning |
| PCN-032 | Inconsistent failure feedback: alert() vs silently swallowed errors | Medium | Frontend | Issue |
| PCN-033 | Form controls without accessible names | Medium | Frontend | Issue |
| PCN-034 | Zero component tests despite configured RTL/jsdom/vitest | Medium | Frontend | Recommendation |
| PCN-035 | No server-side component: no cross-doc enforcement, notifications, or reaper jobs | Medium | Architecture | Recommendation |
| PCN-036 | All user profiles including emails readable by any signed-in user | Low | Security | Warning |
| PCN-037 | clientBookingCache readable by any signed-in user leaks booking relationships | Low | Security | Warning |
| PCN-038 | Booking create allows initiator to name an arbitrary counterparty | Low | Security | Warning |
| PCN-039 | systemLogs create accepts unbounded details map from any signed-in user | Low | Security | Recommendation |
| PCN-040 | .env.development committed with live dev Firebase config; .gitignore lacks .env* | Low | Security | Warning |
| PCN-041 | Broader Google Calendar OAuth scope requested than needed | Low | Security | Recommendation |
| PCN-042 | Google Calendar fetch: silent truncation at 250 events and swallowed non-OK responses | Low | Backend | Warning |
| PCN-043 | "now" frozen at mount causes stale upcoming/past classification | Low | Frontend | Warning |
| PCN-044 | Ineffective memoization and unmemoized AuthContext value | Low | Frontend | Warning |
| PCN-045 | Global window CustomEvent used for component communication | Low | Frontend | Warning |
| PCN-046 | Dead code: loggingService.ts, subscribeToBookings, CoachCard.tsx, unused assets | Low | Architecture | Issue |
| PCN-047 | Stale schema documentation and broken ERD generator | Low | Architecture | Warning |
| PCN-048 | Unbounded, ever-growing subscribeToUserBookings snapshot listener | Medium | Frontend | Issue |
| PCN-049 | Day-tab/focus refetch triggers full Google Calendar + slots reload with dead cancel guard | Medium | Frontend | Issue |
| PCN-050 | Coach-meetings fetch re-runs on every users snapshot with no cancellation | Medium | Frontend | Issue |
| PCN-051 | UnsavedChangesContext retains stale isDirty/onSave closure after editor unmounts | Medium | Frontend | Warning |
| PCN-052 | Feedback setTimeouts never cleared (fire after unmount, overlap-clobber) | Low | Frontend | Warning |

> Findings PCN-048 through PCN-052 were added in a focused second-pass review specifically targeting network leaks, memory leaks, and residual frontend vulnerabilities. That pass also **verified as sound**: every `onSnapshot`/`subscribeTo*` call site returns its unsubscribe from `useEffect` cleanup; both `tab-reclick` listeners are removed; `useFocusRefresh` and the App `popstate` listener clean up; all six `target="_blank"` anchors carry `rel="noopener noreferrer"`; the Google token is memory-only; and no tokens/PII reach the console.

---

## [PCN-001] Non-atomic client-side booking saga permanently blocks slots on interruption
**Severity:** Critical | **Category:** Backend | **Type:** Issue | **Sources:** BE-1, ARCH-2
**Location:** `src/services/googleCalendar.ts:280-429` (transaction check :315-317, pending write :328, Google event :374-421, confirm :425-429, requestId :250)

**Description:** Booking runs as a client-executed three-step saga: (1) a Firestore transaction writes a `pending` booking plus a `clientBookingCache` lock, (2) the browser calls the Google Calendar API, (3) a final `updateDoc` sets status `confirmed`. Verified in code: if the tab closes, the network drops, or any rollback `updateDoc`/`deleteDoc` itself fails between steps, the `pending` booking is left in place forever. The transaction's conflict check (`googleCalendar.ts:315`) treats any non-`cancelled` booking — including an orphaned `pending` — as taken, so the slot is permanently blocked for that coach with no reaper, no TTL on booking documents, and no UI surface that shows pending bookings (only `confirmed` bookings are listed). A Google Calendar event created in step 2 is orphaned if step 3 fails. The Meet `requestId` is regenerated randomly per call (`:250`), so retries are not idempotent. This is the direct consequence of having no trusted server-side component (see PCN-035).

**Recommendation:** Move booking orchestration into a callable Cloud Function that creates the calendar event and confirms the booking atomically from the server's perspective. Short of that: add a TTL/`expireAt` on `pending` bookings and treat expired pendings as free in the transaction check; make the transaction retry path reuse a deterministic `requestId` (e.g. derived from `bookingId`); add a scheduled reaper (or lazy cleanup on read) that cancels stale pendings and deletes orphaned Google events.

## [PCN-002] Any signed-in user can overwrite any coach's availableSlotsCache
**Severity:** High | **Category:** Security | **Type:** Vulnerability | **Sources:** SEC-1
**Location:** `firestore.rules:274-281`

**Description:** Verified. The write rule is:
```
allow write: if (isSignedIn() && isValidAvailableSlotsCache(request.resource.data))
  || (isOwner(uid) && isValidAvailableSlotsCache(...))
  || (isAdmin() && isValidAvailableSlotsCache(...));
```
The first disjunct makes the `isOwner`/`isAdmin` disjuncts dead code: any signed-in user (self-signup is open) who submits a shape-valid document can overwrite any coach's cache — despite the comment on lines 275-277 stating "only the OWNER may write their own cache." `isValidAvailableSlotsCache` (rules :136-149) does not tie `data.userId` to `request.auth.uid` either. An attacker can zero out competitors' availability (denial of discovery), fabricate availability, or poison the faceted filter fields (`gender`, `country`, `icf_*`) that discovery filters on (`firebaseService.ts:808-819`).

**Recommendation:** Replace the rule with `allow write: if (isOwner(uid) || isAdmin()) && isValidAvailableSlotsCache(request.resource.data) && request.resource.data.userId == uid;`. Deploy immediately; this is a one-line fix.

## [PCN-003] Users can self-assign verified ICF credentials via direct profile update
**Severity:** High | **Category:** Security | **Type:** Vulnerability | **Sources:** SEC-2
**Location:** `firestore.rules:186-206` (`selfUpdateAllowed` :186-191, `isValidUserDoc` :59-81)

**Description:** Verified. `selfUpdateAllowed()` pins only `userRole`, `userStatus`, `userId`, `email`, and `createdAt`. The credential fields `icf_acc`/`icf_pcc`/`icf_mcc`/`icf_actc`, `icfCredentials`, and `qualifications` are not pinned, and `isValidUserDoc` only type-checks them (bool/list). The client code path (`updateOwnProfile`, `firebaseService.ts:351-368`) excludes these fields, but rules are the security boundary: any user can call `updateDoc` directly against their own `users/{uid}` doc and set `icf_mcc: true` or fabricate `icfCredentials`, bypassing the admin verification flow (`updateVerifiedCredentials`). These flags feed both the profile display and the discovery facet filters, so users can advertise credentials they do not hold.

**Recommendation:** Extend `selfUpdateAllowed()` to require `icf_acc`, `icf_pcc`, `icf_mcc`, `icf_actc`, `icfCredentials`, and `qualifications` to be unchanged (`request.resource.data.get(f, null) == resource.data.get(f, null)`), leaving admin updates unrestricted.

## [PCN-004] Rules 200-slot cap silently rejects availability cache writes for available coaches
**Severity:** High | **Category:** Backend | **Type:** Issue | **Sources:** BE-2
**Location:** `firestore.rules:141`; `src/services/firebaseService.ts:532-587` (generation), `:345,367,490` (swallowed errors); `src/config/constants.ts:5`

**Description:** Verified. `isValidAvailableSlotsCache` requires `data.availableSlots.size() <= 200`, but the client generates one slot per hour per configured range across `BOOKING_HORIZON_DAYS = 30`. A coach available 8 hours/day, 7 days/week generates 240 slots; broader availability generates far more. For such coaches every cache `setDoc` is denied by rules. All three trigger call sites swallow the rejection with `.catch(console.error)` (`firebaseService.ts:345,367,490`), so the coach sees a successful save while their public availability is frozen at the last successful write (or empty). The most-available coaches — exactly the ones the platform wants discoverable — are the ones hit.

**Recommendation:** Align the two constants: either raise the rules cap to `BOOKING_HORIZON_DAYS * 24` (720) plus headroom, or cap generation client-side to match the rule. Surface cache-write failures to the user (and telemetry) instead of `console.error`, and add a rules-emulator test that writes a maximal realistic schedule.

## [PCN-005] Exact ISO slot matching breaks across fractional-offset timezones
**Severity:** High | **Category:** Backend | **Type:** Issue | **Sources:** BE-3
**Location:** `src/services/firebaseService.ts:559-561` (coach slot generation), `:872-878` (`coachSlots.includes(slotIso)`); `src/components/UpcomingSessions.tsx:188-198` (viewer slot generation)

**Description:** Verified. Coach cache slots are anchored to the coach's local wall-clock hours converted to UTC (`getUtcForLocalDateTime(..., hour, parsedStart.minute, timezone)`), so a coach in Asia/Kolkata (UTC+5:30) with a 9:00 start produces slots at `03:30:00.000Z`, `04:30Z`, etc. The viewer's discovery grid generates whole hours in the viewer's timezone (`getUtcForSlot(activeDayDate, hour, viewerTimezone)`), producing `:00Z` instants for whole-hour timezones. Matching is exact string equality (`coachSlots.includes(slotIso)`, `firebaseService.ts:878`), so a fractional-offset coach and a whole-hour viewer (or vice versa) can never match — the coach is invisible. The deploy region is asia-south1 (India, UTC+5:30), making this a mainline failure, not an edge case.

**Recommendation:** Normalize slot boundaries to a global grid (e.g. UTC whole hours) at generation time, or match by time-range overlap rather than exact instant equality. Add unit tests pairing Asia/Kolkata, Asia/Kathmandu (+5:45), and UTC viewers/coaches.

## [PCN-006] Deactivated/inactive users remain discoverable and bookable
**Severity:** High | **Category:** Backend | **Type:** Issue | **Sources:** BE-4
**Location:** `src/services/firebaseService.ts:772-888` (`queryAvailableCoachesForDay`; profile filter :861-868)

**Description:** Verified. The discovery query filters the cache only by `availableDatesUtc` and in-memory facets; the candidate-profile pass keeps every profile where `userRole === 'user'` (`:864`) and never checks `userStatus`. The cache document even stores `userStatus` (`:586`) but it is never consulted, and nothing removes or empties a cache document on deactivation. A user the admin deactivates (or who was never approved but has a stale cache doc) stays discoverable and bookable, bypassing the approval workflow that the rest of the app (and the rules' `isAdmin` gate) treats as central.

**Recommendation:** Filter on `userStatus === 'active'` in both the cache query (`where('userStatus','==','active')`) and the profile pass; on admin deactivation, delete or empty the user's `availableSlotsCache` doc (already triggered via `updateProfile` → recalc, but recalc must then write `availableSlots: []` for inactive users).

## [PCN-007] Availability cache goes stale for idle coaches; no scheduled refresh; credential updates skip recalc
**Severity:** High | **Category:** Architecture | **Type:** Issue | **Sources:** ARCH-1, BE-5
**Location:** `src/services/firebaseService.ts:500-606` (recalc), triggers only at `:345,367,490`; `updateVerifiedCredentials` `:447-459` (no recalc); `firestore.rules:274-281` comment

**Description:** Verified. `availableSlotsCache` holds a sliding 30-day window of slots, but it is recomputed only when the owner writes their profile or schedule. A coach who sets availability once and stops logging in has a window that shrinks daily and reaches zero within 30 days — silently undiscoverable despite an active schedule. There are no Cloud Functions or scheduled jobs to refresh caches (the rules comment at :18-22 acknowledges the missing backend). Additionally verified: `updateVerifiedCredentials` (`:447-459`) writes `icf_*` flags straight to the profile without triggering `recalculateAvailableSlotsCache`, so the credential facets denormalized into the cache (`:582-585`) go stale until an unrelated profile/schedule write occurs — admin-verified credentials do not show up in discovery filters.

**Recommendation:** Add a scheduled Cloud Function that recomputes all caches daily (or recompute a coach's cache lazily on read when `lastUpdated` is older than 24h). Add the missing recalc call to `updateVerifiedCredentials` as an immediate fix.

## [PCN-008] Google OAuth token lost on reload; calendar operations (incl. cancel) fail until re-login
**Severity:** High | **Category:** Backend | **Type:** Issue | **Sources:** BE-6
**Location:** `src/services/googleToken.ts:1-20`; `src/services/firebaseService.ts:208-214,307-316`; `src/services/googleCalendar.ts:365-372,460-465`

**Description:** Verified. The Google access token is captured only from the redirect sign-in result and held in memory (deliberately, for XSS safety — see Positive observations). It expires after ~1 hour and is lost on any reload, while the Firebase Auth session persists. Result: a routinely signed-in user hits `GOOGLE_TOKEN_EXPIRED` on every booking attempt and — worse — `cancelBooking` refuses to proceed at all without a token (`googleCalendar.ts:461-465`), even though Firestore is the booking source of truth and the Google event delete tolerates 404. Users cannot cancel their own sessions without signing out and back in.

**Recommendation:** Silently re-acquire the token when needed (e.g. `signInWithPopup`/token client with `prompt=none` on `GOOGLE_TOKEN_EXPIRED`), and decouple cancellation: cancel in Firestore first, then best-effort delete the Google event (queueing/flagging the orphan for cleanup if the token is absent).

## [PCN-009] Production build silently falls back to development database ID
**Severity:** High | **Category:** Architecture | **Type:** Issue | **Sources:** ARCH-8
**Location:** `vite.config.ts:7-12`

**Description:** Verified. When `VITE_FIRESTORE_DATABASE_ID` is unset in a production build, the config loads the development env file and uses its database ID (`loadEnv('development', ...)` at :10-11) instead of failing. The throw at :14-18 is unreachable for production whenever `.env.development` exists (it is committed — see PCN-040). A misconfigured prod build therefore ships pointing at the `pcn-dev` database with no error at build or run time.

**Recommendation:** Delete the fallback block; in `mode === 'production'`, missing `VITE_FIRESTORE_DATABASE_ID` must throw.

## [PCN-010] Side effects inside setState updaters double-fire under StrictMode
**Severity:** High | **Category:** Frontend | **Type:** Issue | **Sources:** FE-2
**Location:** `src/context/UnsavedChangesContext.tsx:61-66,76-81`; StrictMode enabled in `src/main.tsx`

**Description:** Verified. Both `handleConfirm` and `handleDiscard` call `prev.navigateAction()` inside the `setModalState` updater function. React updaters must be pure; under `<StrictMode>` (enabled) React invokes updaters twice in development, double-firing navigation, and in general React is free to re-invoke updaters. Navigation here mutates history/URL state, so double invocation causes duplicated pushState/popstate dispatches.

**Recommendation:** Capture `modalState.navigateAction` outside the updater, call `setModalState({...isOpen:false})` purely, then invoke the action (or via `useEffect` keyed on a "pendingNavigation" state).

## [PCN-011] Unsaved-changes guard bypassed by profile navigation and page unload
**Severity:** High | **Category:** Frontend | **Type:** Issue | **Sources:** FE-3
**Location:** `src/utils/url.ts:38-43` (`navigateToProfile`); `src/components/ProfileEdit.tsx:224`; `src/components/UpcomingSessions.tsx:948,954`; no `beforeunload` handler anywhere

**Description:** Verified. The dirty-state guard is enforced only through `navigateWithConfirmation` in tab navigation. `navigateToProfile` pushes URL state and dispatches `popstate` directly, unmounting the editing view without any confirmation; it is called from ProfileEdit and UpcomingSessions. There is also no `beforeunload` listener, so closing the tab or reloading with unsaved edits loses data silently. The guard exists but is trivially bypassed by the app's own code paths.

**Recommendation:** Route profile navigation through `navigateWithConfirmation`, and register a `beforeunload` handler while `isDirty` is true.

## [PCN-012] All modals lack dialog semantics, focus management, and Escape handling
**Severity:** High | **Category:** Frontend | **Type:** Issue | **Sources:** FE-1
**Location:** `src/components/modals/ScheduleModal.tsx`, `SessionDetailsModal.tsx`, `CancelModal.tsx`, `CalendarModal.tsx`, `ReviewChangesModal.tsx`

**Description:** Verified — no `role="dialog"` or `aria-modal` exists anywhere in `src/`. None of the five modals implement focus trapping, initial focus, focus restoration on close, or Escape-to-close; icon-only close buttons lack accessible labels. Keyboard and screen-reader users cannot reliably operate the booking, cancellation, or review flows — the core product interactions.

**Recommendation:** Extract a shared `<Modal>` built on the native `<dialog>` element (free focus trap + Escape) or add `role="dialog"`, `aria-modal="true"`, labelled close buttons, and a focus trap; apply to all five modals.

## [PCN-013] Keyboard-inaccessible interactive elements (date tabs, avatars, logo)
**Severity:** High | **Category:** Frontend | **Type:** Issue | **Sources:** FE-8
**Location:** `src/components/UpcomingSessions.tsx:857-868` (date tabs), `:944-955` (coach avatar/name); `src/components/Header.tsx:49` (logo)

**Description:** Click handlers are attached to `div`/`img` elements with no `tabindex`, `role`, or key handling. The date-tab strip (primary navigation for booking), coach profile links, and the header logo are unusable by keyboard, violating WCAG 2.1.1. Combined with PCN-012 this makes the booking flow inaccessible end-to-end.

**Recommendation:** Use `<button>` elements (date strip as a `role="tablist"` with arrow-key handling); make avatar/name a link or button.

## [PCN-014] firebaseService.ts is a 933-line god module spanning seven domains
**Severity:** High | **Category:** Architecture | **Type:** Issue | **Sources:** ARCH-3
**Location:** `src/services/firebaseService.ts` (933 lines)

**Description:** Verified. One module mixes Firebase bootstrap/config, auth/session, profile CRUD, schedule management, slots-cache recalculation, support tickets, and coach discovery; `googleCalendar.ts` imports back into it, and domain types are exported from a module with import-time side effects (app initialization, config throw — see PCN-024). This coupling is a root enabler of other findings: duplicated slot generation (part of PCN-046's cleanup scope), components bypassing the layer (PCN-026), and the untestability of booking logic. The slot-generation algorithm is duplicated near-verbatim between `firebaseService.ts:532-564` and `googleCalendar.ts:530-561` (`generateFallbackAvailableSlots`), along with `chunkArray`; divergence would silently produce inconsistent bookable slots (verified both copies exist and are currently parallel).

**Recommendation:** Split into `firebaseApp.ts` (bootstrap only), `authService`, `profileService`, `scheduleService`, `slotsService` (single shared slot-generation util used by both current copies), `supportService`, `discoveryService`; move shared types to a side-effect-free `types.ts`.

## [PCN-015] All bookings (incl. Meet links and topics) readable by any signed-in user
**Severity:** Medium | **Category:** Security | **Type:** Vulnerability | **Sources:** SEC-3
**Location:** `firestore.rules:221-222`

**Description:** Verified: `match /bookings/{bookingId} { allow read: if isSignedIn(); }`. Every authenticated account — including self-signed-up, never-approved accounts, since Google sign-in is open — can enumerate all bookings and read `googleMeetLink`, `topic`, participant UIDs, and times. This allows uninvited users to join others' coaching sessions and leaks potentially sensitive session topics. (Discovery's busy-slot merge reads the bookings collection client-side, which is why the rule is broad — a design constraint of the no-backend architecture, PCN-035.)

**Recommendation:** Restrict booking reads to participants and admins. For discovery's busy-check, either accept the coarse-grained `availableSlotsCache` as the only public surface, or expose a minimal "busy instants" projection (no links/topics) via a separate collection or Cloud Function.

## [PCN-016] Fabricated fallback Google Meet links persisted to bookings
**Severity:** Medium | **Category:** Backend | **Type:** Issue | **Sources:** BE-7
**Location:** `src/services/googleCalendar.ts:211-214` (random link), `:408` (`realMeetLink = data.hangoutLink || meetLink`), `:425-429` (persisted)

**Description:** Verified. `scheduleMeeting` pre-generates a random `https://meet.google.com/xxx-xxxx-xxx` string. If the Google event is created but returns no `hangoutLink` (conference creation pending/failed), or when Google integration is disabled, this fabricated link is persisted as the booking's `googleMeetLink` and shown to both participants, who will join a dead (or worse, someone else's) meeting code at session time.

**Recommendation:** Never fabricate Meet URLs. If `hangoutLink` is absent, store an empty link and surface "link pending" in the UI, retrying event fetch; treat a missing conference as a booking-flow error where appropriate.

## [PCN-017] meetLink rendered as unsanitized href in SessionDetailsModal
**Severity:** Medium | **Category:** Frontend | **Type:** Issue | **Sources:** FE-9
**Location:** `src/components/modals/SessionDetailsModal.tsx:68-88` (`href={meetLink}`); caller `src/components/UpcomingSessions.tsx:1139`

**Description:** Verified. Every other render path passes stored links through `sanitizeMeetLink` (e.g. `ScheduleModal.tsx:194,207`), consistent with the project's own convention that Firestore data is client-written and must be protocol-checked (`url.ts:1-3`). SessionDetailsModal renders the raw value. Booking docs are writable by participants (and `googleMeetLink` is only type-checked by rules), so a malicious participant can store a `javascript:` or phishing URL that the counterparty clicks from this modal.

**Recommendation:** Apply `sanitizeMeetLink` in SessionDetailsModal (one-line fix); consider enforcing the `meet.google.com` host in `isValidBookingDoc` as defense-in-depth.

## [PCN-018] Support ticket messages stored as one doc array with non-transactional read-modify-write
**Severity:** Medium | **Category:** Backend | **Type:** Issue | **Sources:** ARCH-12, BE-9
**Location:** `src/services/firebaseService.ts:704-738` (`addMessageToSupportRequest`); `firestore.rules:317-326`

**Description:** Verified. Replies are appended via `getDoc` → spread → `updateDoc` with no transaction. Concurrent replies (user and admin at once) lose messages: the rules' size-plus-one guard (`rules:320`) rejects the stale write outright (data loss surfaced as an error at best), and admin writes bypass that guard entirely (`isAdmin()` short-circuits), silently overwriting. Message IDs and `createdAt`/`updatedAt` come from the client clock (`:720,723,728,735`) and `updatedAt` drives `orderBy` in both list queries, so clock skew reorders tickets. The single-array design also grows toward the 1MB document cap with no pruning.

**Recommendation:** Wrap the append in `runTransaction` (or better, move messages to a subcollection with `serverTimestamp()`), and use `serverTimestamp()` for `updatedAt`.

## [PCN-019] N+1 sequential profile reads in booking hydration (batched helper exists)
**Severity:** Medium | **Category:** Backend | **Type:** Issue | **Sources:** ARCH-6, BE-8
**Location:** `src/services/googleCalendar.ts:125-185` (`getProfile` per booking, awaited serially in `processSnap`); duplicated pattern in `src/components/UserManagement.tsx:74-93` (per-coach booking queries + `getDoc` per uid)

**Description:** Verified. `getUpcomingEvents` awaits one `getDoc` per coach and per client, per booking, sequentially inside a for-loop (memoized only within a single call). `UserManagement` repeats the pattern per user row. The batched `getProfiles` (chunked `documentId() in` queries, `firebaseService.ts:920-933`) already exists and is used elsewhere. Cost is latency (serial round-trips on the main sessions screen) and read billing.

**Recommendation:** Collect all UIDs from both snapshots, call `getProfiles` once, then hydrate from the returned map; reuse in UserManagement.

## [PCN-020] Day-availability fetch race lets stale results overwrite newer selection
**Severity:** Medium | **Category:** Frontend | **Type:** Issue | **Sources:** FE-7
**Location:** `src/components/UpcomingSessions.tsx:242-276` (`loadDayAvailability`), `:288-295` (effect)

**Description:** Verified. The effect's `active` flag is checked only before awaiting `handleRefresh`; `loadDayAvailability` unconditionally calls `setDayAvailability(availability)` and `setFetchedDayIndex(selectedDayIndex)` after its awaits, with no staleness check. Rapidly switching day tabs lets a slower earlier query resolve last and overwrite the newer day's results — the UI shows day A's coaches under day B's tab.

**Recommendation:** Use a request-sequence counter or AbortController: capture the request's day index and discard results if a newer request has started.

## [PCN-021] Client clocks used for authoritative timestamps and cache expiry
**Severity:** Medium | **Category:** Backend | **Type:** Warning | **Sources:** BE-10
**Location:** `src/services/firebaseService.ts:251` (profile `createdAt`), `:577` (cache `lastUpdated`), `:655,720,745` (support ISO strings); `src/services/googleCalendar.ts:296,337,497` (`Timestamp.now()`), `:330-338` (`expireAt` = slot start + 24h from client-parsed ISO)

**Description:** Verified. `Timestamp.now()` and `new Date().toISOString()` (client clock) are used for `createdAt`, `cancelledAt`, cache freshness, and the `clientBookingCache` TTL `expireAt`. A skewed client clock corrupts ordering (support tickets order by client-written `updatedAt`), freshness checks, and lock expiry.

**Recommendation:** Use `serverTimestamp()` for all audit/ordering fields; `expireAt` derived from `startIso` is acceptable but should be computed against server time semantics (slot start is trusted input, so this one is minor).

## [PCN-022] Firestore listeners without error callbacks die silently
**Severity:** Medium | **Category:** Backend | **Type:** Warning | **Sources:** BE-11
**Location:** `src/services/firebaseService.ts:328-337` (`subscribeToProfile`), `:396-405` (`subscribeToAllUsers`), `:410-417` (`subscribeToActiveCoaches`), `:421-424` (`subscribeToPendingUsersCount`)

**Description:** Verified. These four `onSnapshot` subscriptions pass no error observer; on a permission error or backend failure the listener terminates permanently and the UI silently freezes on stale data (profile, admin user list, pending-count badge). The booking subscriptions (`:608-620`, `:890-911`) show the correct pattern with error handlers.

**Recommendation:** Add error callbacks that log/telemetry and set an error/retry state, matching the booking subscriptions.

## [PCN-023] Client-side HTML scraping of ICF credential site is fragile and likely CORS-blocked
**Severity:** Medium | **Category:** Backend | **Type:** Warning | **Sources:** BE-12
**Location:** `src/services/icfService.ts:11-94`

**Description:** The credential verification helper fetches and regex-parses HTML from `apps.coachingfederation.org` in the browser: the cross-origin fetch is likely CORS-blocked in production (errors swallowed at :90-93 and returned as `null`, indistinguishable from "not found"), the `tblResults` regex parsing breaks with any markup change, substring name matching produces false positives ("Ann Lee" matches "Joanne Leeson"), there is no timeout, and a fallback expiry date is invented (:71). Because this feeds admin credential verification (see PCN-003 for why that matters), unreliable results are a trust problem.

**Recommendation:** Move verification into a Cloud Function (server-side fetch, no CORS), parse defensively, match names exactly/normalized, distinguish "lookup failed" from "not found", and never fabricate expiry dates.

## [PCN-024] No React error boundary; module-scope config throw white-screens the app
**Severity:** Medium | **Category:** Frontend | **Type:** Issue | **Sources:** ARCH-11
**Location:** `src/main.tsx:6-10`; `src/services/firebaseService.ts:136-145` (module-scope throw); `src/App.tsx:306-314`

**Description:** Verified — no `ErrorBoundary`/`componentDidCatch` exists in `src/`. Any render-time error anywhere unmounts the whole tree to a blank page. Worse, the Firebase config guard throws at module import time (`import.meta.env.PROD` path), before React mounts, so a misconfigured production deployment renders a white screen with no user-facing message.

**Recommendation:** Add a top-level error boundary with a fallback UI; convert the module-scope throw into a rendered "configuration error" screen (export a flag, branch in `main.tsx`).

## [PCN-025] No router; broken history behavior and no deep-linking
**Severity:** Medium | **Category:** Frontend | **Type:** Issue | **Sources:** ARCH-10, FE-4
**Location:** `src/App.tsx:35-58,281-297`; `src/utils/url.ts:38-53`

**Description:** Verified. Navigation is a `useState` tab index; only `?profile=` is synced via hand-rolled `pushState` + synthetic `popstate` dispatch. Concrete bugs: `clearProfileFromUrl` uses `pushState` (`url.ts:50`), so pressing Back after closing a profile re-opens it (should be `replaceState` or `history.back()`); tabs are not represented in history or the URL at all, so Back/Forward skip them and no view except profiles is deep-linkable/shareable; `adminTabFilter` is prop-drilled to work around the missing router.

**Recommendation:** Adopt react-router (routes per tab, `/profile/:uid`), which also gives navigation blocking for PCN-011; as a minimal fix, use `replaceState` in `clearProfileFromUrl` and encode the active tab in the URL.

## [PCN-026] Components bypass the service layer with raw Firestore queries
**Severity:** Medium | **Category:** Architecture | **Type:** Issue | **Sources:** ARCH-4
**Location:** `src/components/UserManagement.tsx:23,74-93`; `src/components/SystemLogs.tsx:12,90-111`

**Description:** Verified (UserManagement imports `collection/query/where/getDocs/getDoc` from `firebase/firestore` and queries bookings/users directly). Admin components construct their own Firestore queries instead of going through the service layer, duplicating collection names/shapes and the N+1 anti-pattern (PCN-019), and making the rules/service contract harder to evolve.

**Recommendation:** Add `adminService` functions (e.g. `getUserBookingStats`, `getLogsPage`) and remove direct `firebase/firestore` imports from components; enforce with an ESLint `no-restricted-imports` rule scoped to `src/components`.

## [PCN-027] Unbounded collection reads without limits or pagination
**Severity:** Medium | **Category:** Architecture | **Type:** Warning | **Sources:** ARCH-7
**Location:** `src/services/firebaseService.ts:396-405` (`subscribeToAllUsers`), `:695-702` (`getAllSupportRequests`)

**Description:** Verified. Both read entire collections with no `limit()`; as users/tickets grow this degrades the admin dashboard and inflates read costs. `SystemLogs` demonstrates the correct paginated pattern in the same codebase.

**Recommendation:** Add `limit()` + cursor pagination (`startAfter`) mirroring the SystemLogs implementation; for the users list, consider server-side search/filtering as the collection grows.

## [PCN-028] Dev deploy channel ships a development-mode bundle, disarming prod guards
**Severity:** Medium | **Category:** Architecture | **Type:** Warning | **Sources:** ARCH-9
**Location:** `package.json:7-11` (`build` and `build:dev` both use `--mode development`); `.github/workflows/firebase-deploy.yml:40`

**Description:** Verified. The development deploy job builds with `--mode development`, so the hosted dev-channel bundle is an unminified/dev-mode build and `import.meta.env.PROD` is false — which disarms the fail-fast config guard (`firebaseService.ts:140-144`, it only logs) on a deployed environment. Also note the default `build` script is dev-mode, an easy foot-gun.

**Recommendation:** Build all deployed channels with `--mode production` (differentiating env vars, not mode); make plain `npm run build` production or remove it.

## [PCN-029] CI/CD gaps: no CI on push/PR, no environment protection, --debug deploys
**Severity:** Medium | **Category:** Backend | **Type:** Warning | **Sources:** BE-13
**Location:** `.github/workflows/firebase-deploy.yml:3-13,56,101`; `Makefile:37,40`

**Description:** Verified. The only workflow is `workflow_dispatch` deploy — lint/tests never run on push or PR, so broken code merges silently. The production job has no `environment:` protection rule (no approval gate). Both deploys pass `--debug` to the Firebase CLI, leaking verbose logs (project internals, potentially tokens) into CI output. The Makefile permits ad-hoc production deploys from a laptop, bypassing tests entirely.

**Recommendation:** Add a CI workflow on push/PR (lint + test + build); add `environment: production` with required reviewers to the prod job; drop `--debug`; remove or gate the Makefile prod-deploy target.

## [PCN-030] No code splitting; admin-only code and 1,944-line timezone data eagerly bundled
**Severity:** Medium | **Category:** Frontend | **Type:** Issue | **Sources:** FE-5
**Location:** `src/App.tsx:2-19` (static imports); `src/components/UserManagement.tsx` (805 lines), `SystemLogs.tsx` (603), `AdminDashboard`; `src/config/timezones.ts` (1,944 lines)

**Description:** Verified — no `React.lazy`/dynamic `import()` anywhere in `src/`. Every user downloads the admin dashboard, user management, system logs, and the full timezone table on first paint.

**Recommendation:** `React.lazy` + `Suspense` for admin routes and modals; dynamic-import the timezone list where it's consumed.

## [PCN-031] Monolithic components with large inline style blocks and unscoped selectors
**Severity:** Medium | **Category:** Frontend | **Type:** Warning | **Sources:** FE-6
**Location:** `src/components/UpcomingSessions.tsx` (1,170 lines; `<style>` block :423-659); `src/components/AvailabilityEdit.tsx:430-542`; `src/components/PublicProfile.tsx:292-298`

**Description:** UpcomingSessions combines discovery, filtering, booking, session listing, and five modal integrations in one 1,170-line file with a 240-line inline `<style>` element whose selectors are global (collision risk across components rendering simultaneously). Same pattern in AvailabilityEdit and PublicProfile.

**Recommendation:** Split UpcomingSessions into DayPicker/SlotGrid/FilterBar/SessionList; move styles to CSS modules or co-located `.css` files with scoped class names.

## [PCN-032] Inconsistent failure feedback: alert() vs silently swallowed errors
**Severity:** Medium | **Category:** Frontend | **Type:** Issue | **Sources:** FE-10
**Location:** `src/components/UpcomingSessions.tsx:1153-1155` (`alert()`); `src/components/MySessions.tsx:50-61,332-337` and `src/components/ProfileEdit.tsx:140-142` (console-only)

**Description:** Verified for the alert path. Cancellation failure in UpcomingSessions uses a blocking `alert()`, while equivalent failures in MySessions and profile-save in ProfileEdit only `console.error` — the user gets no indication their action failed (compounding PCN-004's silent cache failures).

**Recommendation:** Introduce one toast/notification primitive and use it for all user-initiated action failures; remove `alert()`.

## [PCN-033] Form controls without accessible names
**Severity:** Medium | **Category:** Frontend | **Type:** Issue | **Sources:** FE-13
**Location:** `src/components/AvailabilityEdit.tsx:613-631` (start/end time selects); `src/components/UpcomingSessions.tsx:674-698` (qualifications dropdown)

**Description:** The availability start/end `<select>` elements have no associated `<label>`/`aria-label`, and the custom qualifications dropdown lacks `aria-expanded`, `aria-haspopup`, and label association — screen-reader users cannot tell what these controls set.

**Recommendation:** Add `aria-label`s (or visually-hidden labels) to the selects; give the dropdown proper disclosure semantics (`button` + `aria-expanded` + `aria-controls`).

## [PCN-034] Zero component tests despite configured RTL/jsdom/vitest
**Severity:** Medium | **Category:** Frontend | **Type:** Recommendation | **Sources:** FE-14
**Location:** test config in `vite.config.ts:29-37`; coverage `include` limited to utils/services/context/hooks/templates

**Description:** Services, utils, and context have tests, but no component has any — the booking flow, onboarding wizard, and dirty-state integration (where PCN-010/011/020 live) are untested. jsdom + vitest are already configured; the coverage `include` list even excludes `src/components` from measurement, hiding the gap.

**Recommendation:** Add React Testing Library tests for the booking modal flow, unsaved-changes navigation, and day-switch race; include `src/components` in coverage.

## [PCN-035] No server-side component: no cross-doc enforcement, notifications, or reaper jobs
**Severity:** Medium | **Category:** Architecture | **Type:** Recommendation | **Sources:** BE-16, ARCH-1 (partial)
**Location:** repo-wide (no `functions/` directory); `firestore.rules:18-22` (acknowledging comment)

**Description:** The app has no Cloud Functions or any trusted backend. Consequences verified throughout this review: rules cannot perform cross-document slot-conflict checks (the booking-ID pattern match at `rules:232` is the only structural guard), there is no reaper for orphaned pending bookings (PCN-001), no scheduled cache refresh (PCN-007), no server-side credential verification (PCN-023), admin checks require a per-request `get()` instead of custom claims, and bookings must be world-readable for discovery (PCN-015). No notifications exist beyond Google Calendar invites.

**Recommendation:** Introduce a minimal Cloud Functions layer: a callable booking function, a daily scheduled cache-refresh/reaper, an ICF verification function, and an auth trigger to set an `admin` custom claim. This single investment structurally resolves or simplifies PCN-001, 004, 005, 006, 007, 015, and 023.

## [PCN-036] All user profiles including emails readable by any signed-in user
**Severity:** Low | **Category:** Security | **Type:** Warning | **Sources:** SEC-4
**Location:** `firestore.rules:193-195`

**Description:** Verified: `allow read: if isSignedIn()` on `users/{uid}`. Since sign-up is open, any Google account can enumerate all members' emails, names, countries, and bios — including pending users and admin accounts. Peer browsing needs active coaches only.

**Recommendation:** Restrict full-profile reads to active users' profiles (or move public fields to a separate readable projection); at minimum exclude email from the readable surface.

## [PCN-037] clientBookingCache readable by any signed-in user leaks booking relationships
**Severity:** Low | **Category:** Security | **Type:** Warning | **Sources:** SEC-9
**Location:** `firestore.rules:262-263`

**Description:** Verified: `allow read: if isSignedIn()`. Documents contain `clientUid`, `coachUid`, `startIso` — who books whom and when. The lock check happens inside a transaction as the booking participant, so broad read access is unnecessary.

**Recommendation:** Restrict reads to `resource.data.clientUid == request.auth.uid || resource.data.coachUid == request.auth.uid || isAdmin()`.

## [PCN-038] Booking create allows initiator to name an arbitrary counterparty
**Severity:** Low | **Category:** Security | **Type:** Warning | **Sources:** SEC-5
**Location:** `firestore.rules:227-234`

**Description:** Verified. Create requires only that the caller is one of `coachUid`/`clientUid`. A malicious user can create bookings naming any victim as the other party (griefing: squatting a coach's slots as fake client, or fabricating sessions "as coach" for an arbitrary client). The `clientBookingCache` self-lock only binds when the caller is the client.

**Recommendation:** Hard to fully fix in rules alone (another argument for PCN-035); mitigations: require the named coach's cache to actually contain the slot (a rules `get()` on `availableSlotsCache`), and give users visibility/decline controls over bookings created in their name.

## [PCN-039] systemLogs create accepts unbounded details map from any signed-in user
**Severity:** Low | **Category:** Security | **Type:** Recommendation | **Sources:** SEC-6
**Location:** `firestore.rules:283-292`

**Description:** Verified: `event` is capped at 200 chars but `details` is only `is map` — any signed-in user can write near-1MB log documents at will (storage/cost abuse, admin log-view degradation). Reads/updates/deletes are correctly admin-only, and a TTL `expireAt` is required.

**Recommendation:** Bound the `details` payload (e.g. validate known keys with `isValidString(..., 1000)` or cap `details.keys().size()`), and consider per-user rate limiting via a Cloud Function sink.

## [PCN-040] .env.development committed with live dev Firebase config; .gitignore lacks .env*
**Severity:** Low | **Category:** Security | **Type:** Warning | **Sources:** SEC-7
**Location:** `/.env.development`, `/.env.emulator`; `.gitignore` (no `.env*` entry)

**Description:** Verified — `.env.development` is committed and `.gitignore` contains no env exclusions. Firebase web config is public by design, but publishing it alongside the weak rules (PCN-002/003) and open self-signup lowers the bar for targeted abuse of the dev environment, and the missing `.gitignore` entry invites a future accidental commit of a genuinely secret env file. It also enables the PCN-009 fallback.

**Recommendation:** Add `.env*` (allowing `.env.example`) to `.gitignore`; move real values to untracked files/CI variables (the CI already injects them).

## [PCN-041] Broader Google Calendar OAuth scope requested than needed
**Severity:** Low | **Category:** Security | **Type:** Recommendation | **Sources:** SEC-8
**Location:** `src/services/firebaseService.ts:296-305` (scopes at :299-300)

**Description:** Verified: login requests both `auth/calendar` (full calendar control, incl. calendar list/settings) and `auth/calendar.events`. All API calls in the codebase are event CRUD on the primary calendar, needing only `calendar.events`. Broader scope increases blast radius of token theft and worsens the consent screen.

**Recommendation:** Remove the `auth/calendar` scope; keep `calendar.events` only.

## [PCN-042] Google Calendar fetch: silent truncation at 250 events and swallowed non-OK responses
**Severity:** Low | **Category:** Backend | **Type:** Warning | **Sources:** BE-14
**Location:** `src/services/googleCalendar.ts:76-100`

**Description:** Verified. The events request sets `timeMin` but no `timeMax` or `maxResults` and never follows `nextPageToken`; Google returns at most 250 items by default, silently truncating busy users' calendars so PCN's busy-overlay shows them free when they are not. Non-OK responses (including 401 token-expired) are silently ignored — the `if (response.ok)` has no else branch — so the user sees an empty calendar rather than a re-auth prompt.

**Recommendation:** Add `timeMax` (booking horizon), `maxResults`, and pagination; on 401 surface `GOOGLE_TOKEN_EXPIRED` to trigger the re-auth flow (ties into PCN-008).

## [PCN-043] "now" frozen at mount causes stale upcoming/past classification
**Severity:** Low | **Category:** Frontend | **Type:** Warning | **Sources:** FE-11
**Location:** `src/components/UpcomingSessions.tsx:67`; `src/components/MySessions.tsx:28,82-83`

**Description:** The reference time used to classify sessions as upcoming vs past is captured once at mount. In a long-lived tab, sessions that end remain listed as upcoming/joinable; `useFocusRefresh` refetches data but does not refresh the frozen timestamp.

**Recommendation:** Recompute `now` on each render or on focus-refresh (e.g. state updated in the refresh handler / a minute-interval tick).

## [PCN-044] Ineffective memoization and unmemoized AuthContext value
**Severity:** Low | **Category:** Frontend | **Type:** Warning | **Sources:** FE-12
**Location:** `src/components/MySessions.tsx:82-133`; `src/context/AuthContext.tsx:115-127`

**Description:** MySessions' `useMemo` filters depend on values recreated each render, so the memo recomputes every time (dead memoization). The AuthContext provider passes a fresh object literal as `value`, re-rendering every consumer on every provider render.

**Recommendation:** Stabilize the memo dependencies; wrap the context value in `useMemo`.

## [PCN-045] Global window CustomEvent used for component communication
**Severity:** Low | **Category:** Frontend | **Type:** Warning | **Sources:** FE-16
**Location:** `src/components/LeftNav.tsx:97-102` (dispatch); `src/components/SupportFeedback.tsx:66-68`, `src/components/SupportDesk.tsx:70-72` (listeners)

**Description:** A window-level `'tab-reclick'` CustomEvent couples the nav to feature components invisibly — no type safety, unmockable in tests, leak-prone listeners, and behavior invisible in the component tree.

**Recommendation:** Model "re-click resets view" via props/state — e.g. a reclick counter passed down, or a `key` change on the tab's root component.

## [PCN-046] Dead code: loggingService.ts, subscribeToBookings, CoachCard.tsx, unused assets
**Severity:** Low | **Category:** Architecture | **Type:** Issue | **Sources:** ARCH-13, BE-15, FE-15
**Location:** `src/services/loggingService.ts` (imported only by its own test); `src/services/firebaseService.ts:608-620` (`subscribeToBookings`, unbounded, used only in tests); `src/components/CoachCard.tsx` (170 lines, never imported — verified); unused assets `hero.png`, `react.svg`, `vite.svg`

**Description:** Verified. Two parallel telemetry implementations exist: `loggingService.ts` (never `initializeLogger`'d in app code, so its `logEvent` no-ops) duplicates `logger.telemetry`; only the latter is live. `subscribeToBookings` subscribes to all confirmed bookings with no bounds and has no production caller. `CoachCard.tsx` is referenced by no module. Dead parallel implementations invite future divergence (a maintainer may "fix" the dead one).

**Recommendation:** Delete `loggingService.ts` (+ its test), `subscribeToBookings`, `CoachCard.tsx`, and unused assets; keep `logger.telemetry` as the single sink (and cache its `getFirestore` resolution).

## [PCN-047] Stale schema documentation and broken ERD generator
**Severity:** Low | **Category:** Architecture | **Type:** Warning | **Sources:** ARCH-14
**Location:** `docs/schema-erd.md`; `scripts/generate-erd.js`

**Description:** The documented schema describes `busySlotsCache` while the implementation uses `availableSlotsCache`, and omits `supportRequests` and `systemLogs`; the generator script produces the outdated model. Misleading docs are worse than none for onboarding and for reasoning about the rules surface.

**Recommendation:** Regenerate/rewrite the ERD from the actual `COLLECTIONS` constants and rules file, or delete the doc until it can be maintained.

---

# Second-Pass Findings — Network & Memory Leaks (Frontend)

The following five findings come from a dedicated second-pass review targeting network leaks, memory leaks, and residual frontend vulnerabilities. They are additive to the findings above and were each verified against the source.

## [PCN-048] Unbounded, ever-growing subscribeToUserBookings snapshot listener
**Severity:** Medium | **Category:** Frontend | **Type:** Issue | **Sources:** FE2-1
**Location:** `src/services/firebaseService.ts:890-911`; consumed at `src/components/UpcomingSessions.tsx:217-221`

**Description:** The dashboard listener queries `status == 'confirmed' AND (clientUid == uid OR coachUid == uid)` with no time bound and no `limit`. Because bookings only ever move between `pending|confirmed|cancelled` (`src/config/bookingTypes.ts:4-8`) and nothing demotes a past session out of `confirmed`, the subscribed result set grows monotonically for the life of the account, and the initial snapshot re-downloads the user's entire booking history on every Dashboard mount (i.e. every tab switch back to it). The one-shot path already bounds this correctly with `where('endTime', '>=', Timestamp.now())` (`googleCalendar.ts:119-120`).

**Recommendation:** Add `where('endTime', '>=', Timestamp.now())` to the listener query (the UI only uses future slots for busy-marking), or add a `limit()` plus an index-backed time bound.

## [PCN-049] Day-tab/focus refetch triggers full Google Calendar + slots reload with a dead cancel guard
**Severity:** Medium | **Category:** Frontend | **Type:** Issue | **Sources:** FE2-2
**Location:** `src/components/UpcomingSessions.tsx:278-295` (also 223-240, 286)

**Description:** `handleRefresh` (line 278) always runs all three loaders, and the effect at 288-295 depends on `handleRefresh`, whose identity changes whenever `activeDayDate`/`selectedDayIndex`/any filter changes. So every day-tab click or filter toggle re-runs not just `loadDayAvailability` but also `loadGoogleCalendarEvents` (full Google Calendar REST fetch + two Firestore booking queries + per-participant `getDoc`s) and `loadCurrentUserAvailableSlots`, none of whose inputs changed. `useFocusRefresh(handleRefresh)` (line 286) triggers the same triple fetch on every window focus. The `active` flag in the effect is checked only synchronously before the first `await` (line 291) and never gates result application, so it cancels nothing — including under StrictMode double-mount, where the whole triple fetch runs twice.

**Recommendation:** Split into two effects — a mount/focus-scoped effect for `loadGoogleCalendarEvents` + `loadCurrentUserAvailableSlots`, and a day/filter-scoped effect for `loadDayAvailability` alone; make the guard effective by checking `active` after each `await` before calling setters (or thread an `AbortSignal`).

## [PCN-050] Coach-meetings fetch re-runs on every users snapshot with no cancellation
**Severity:** Medium | **Category:** Frontend | **Type:** Issue | **Sources:** FE2-3
**Location:** `src/components/UserManagement.tsx:64-143` (deps at 143), fed by `subscribeToAllUsers` at 162-168

**Description:** The effect that loads a selected coach's meeting history depends on `[selectedCoachUid, users]`, where `users` is a fresh array delivered by the live `subscribeToAllUsers` onSnapshot. While a coach detail panel is open, any write to any user document anywhere (someone editing their bio, an admin approving a user) re-triggers the entire fetch: two booking queries plus a sequential `getDoc` per participant (lines 74-133). There is no cancelled flag or abort, so if the admin switches `selectedCoachUid` quickly, a slow older fetch can resolve last and `setCoachMeetings` (line 136) with the previous coach's meetings under the new coach's panel.

**Recommendation:** Depend on `selectedCoachUid` only (resolve the coach via a ref or a functional read of `users`), and add a `let cancelled = false` cleanup guard around `setCoachMeetings`.

## [PCN-051] UnsavedChangesContext retains stale isDirty/onSave closure after editor unmounts
**Severity:** Medium | **Category:** Frontend | **Type:** Warning | **Sources:** FE2-4
**Location:** `src/context/UnsavedChangesContext.tsx:29-49`; consumers `ProfileEdit.tsx:148-158`, `AvailabilityEdit.tsx:389-417`, `UserManagement.tsx:254-286`

**Description:** No consumer effect has a cleanup calling `setPageDirtyState(false, [], ...)`, and the provider never clears state on its own (`handleDiscard`/`handleConfirm` clear `isDirty` but never `onSave`). If a dirty editor unmounts via a path that skips confirmation (e.g. `navigateToProfile` avatar click swaps `main` to PublicProfile, `App.tsx:281`), the provider keeps `isDirty=true`, the change list, and the save closure over the dead component's state. The next tab click then shows an "unsaved changes" modal for a page that no longer exists, and "Save & Continue" executes the stale closure, writing outdated form data to Firestore; the closure (form state, profile, the `users` array in UserManagement's case) is retained in memory until another editor overwrites it. This is both a correctness bug and a memory-retention leak, and it compounds PCN-011.

**Recommendation:** In each consumer, return `() => setPageDirtyState(false, [], async () => true)` from the dirty-tracking effect; also null out `onSave` in `handleDiscard`/`handleConfirm`.

## [PCN-052] Feedback setTimeouts never cleared (fire after unmount, overlap-clobber)
**Severity:** Low | **Category:** Frontend | **Type:** Warning | **Sources:** FE2-5
**Location:** `SystemLogs.tsx:153`; `PublicProfile.tsx:59`; `VerificationNotice.tsx:88`; `AvailabilityEdit.tsx:261,270,276,376`; `ProfileEdit.tsx:138,246`

**Description:** Nine "clear this message after N seconds" timers are created without storing/clearing the handle in any effect cleanup. They keep firing after the component unmounts (setState on an unmounted component — a silent no-op, but the closure is retained until the timer fires), and rapid repeat actions (e.g. two copy clicks within 2s in `SystemLogs.tsx:150-154`) let the first timer prematurely clear the second action's feedback.

**Recommendation:** Store the timeout id in a ref, `clearTimeout` the previous one before setting a new one, and clear it in a `useEffect` unmount cleanup — or extract a small `useTransientMessage` hook.

---

## Positive Observations

Verified sound during the security review and consolidation spot-checks:

- **OAuth token hygiene:** the Google access token is held in memory only (`googleToken.ts`), deliberately never persisted to localStorage/sessionStorage and never logged — a correct XSS-exfiltration defense (its UX cost is PCN-008, but the security posture is right).
- **URL sink sanitization:** `src/utils/url.ts` provides protocol- and host-checked sanitizers (`sanitizeHttpsUrl`, `sanitizeMeetLink`, `sanitizeImageUrl`) with a clearly documented threat model, and they are used on nearly every render path (the one gap is PCN-017).
- **No dangerous DOM APIs:** no `dangerouslySetInnerHTML`, no `eval`/`Function` construction anywhere in the app code.
- **Privileged writes are admin-gated:** role/status changes and user deletion require `isAdmin()` in rules; self-signup is correctly forced to `userStatus: 'inactive'` and `userRole: 'user'` (`firestore.rules:199-202`), and `privilegedFieldsUnchanged()` pins role/status on self-update.
- **Booking immutability guards:** booking updates pin `coachUid`, `clientUid`, `startTime`, `endTime` (`rules:245-248`), and the booking-ID-must-match-coachUid pattern (`rules:232`) blocks slot-ID hijacking.
- **systemLogs access model:** user-writable, admin-only-readable, with required TTL `expireAt` — a reasonable client-telemetry design (modulo the size cap in PCN-039).
- **Sensible hosting headers:** `firebase.json` and the Vite dev server set an appropriate `Cross-Origin-Opener-Policy` (`same-origin-allow-popups`) for the Google sign-in flow.
- **Good patterns exist in-repo to copy from:** paginated reads (SystemLogs), batched profile fetches (`getProfiles`), error-handled snapshot listeners (booking subscriptions), and per-uid serialized cache recalculation (`recalcChains`) show the team knows the right patterns — the findings above are largely about applying them consistently.
