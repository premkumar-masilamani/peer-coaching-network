------------------------- MODULE AvailabilityCaching -------------------------
EXTENDS Integers, Sequences, TLC

(* 
  This specification models the cache invalidation and concurrency serialization
  for the Availability Caching layer (matching `recalcChains` in `slotsService.ts`).
  
  The goal is to prove that despite concurrent schedule updates and the asynchronous
  nature of cache recalculation, the system never suffers from a "lost update"
  where the cache permanently drifts from the database's source of truth.
*)

CONSTANTS 
    Versions   \* A set of integers representing different schedule states (e.g., {1, 2, 3})

VARIABLES 
    dbSchedule,    \* The authoritative schedule in Firestore (users/{uid}/schedule)
    cacheSchedule, \* The materialized cache (personalAvailabilityCache / coachAvailabilityByDate)
    queue,         \* The JS promise chain queue (recalcChains)
    inFlight       \* The version currently being read/processed by the active promise

vars == <<dbSchedule, cacheSchedule, queue, inFlight>>

-----------------------------------------------------------------------------
(* Initial State *)
Init == 
    /\ dbSchedule = 0
    /\ cacheSchedule = 0
    /\ queue = 0     \* Number of queued recalculation requests
    /\ inFlight = -1 \* -1 means nothing is currently executing

-----------------------------------------------------------------------------
(* Actions *)

\* A user updates their schedule. In JS, this synchronously updates the DB
\* and then synchronously appends a promise to `recalcChains` (queueing a recalc).
UpdateSchedule(v) ==
    /\ dbSchedule' = v
    /\ queue' = queue + 1
    /\ UNCHANGED <<cacheSchedule, inFlight>>

\* The event loop starts the next queued promise.
\* It reads the CURRENT dbSchedule (which might be newer than the one that triggered it!)
StartRecalc ==
    /\ queue > 0
    /\ inFlight = -1
    /\ inFlight' = dbSchedule  \* Simulates `getSchedule(uid)`
    /\ queue' = queue - 1
    /\ UNCHANGED <<dbSchedule, cacheSchedule>>

\* The promise finishes its async work (slotGeneration) and writes the cache.
FinishRecalc ==
    /\ inFlight # -1
    /\ cacheSchedule' = inFlight \* Simulates `writePersonalAvailabilityCache` / `syncCoachAvailabilityShards`
    /\ inFlight' = -1            \* Frees the lock/chain for the next promise
    /\ UNCHANGED <<dbSchedule, queue>>

-----------------------------------------------------------------------------
(* Next State Relation *)
Next == 
    \/ (\E v \in Versions : UpdateSchedule(v))
    \/ StartRecalc
    \/ FinishRecalc

-----------------------------------------------------------------------------
(* Invariants *)

TypeOK == 
    /\ dbSchedule \in Versions \cup {0}
    /\ cacheSchedule \in Versions \cup {0}
    /\ queue \in Nat
    /\ inFlight \in Versions \cup {-1, 0}

\* Eventual Consistency: 
\* If all queued recalculations have finished (queue = 0 and inFlight = -1),
\* then the cache MUST mathematically match the database source of truth.
\* If this holds true, it proves `recalcChains` successfully prevents lost updates.
EventualConsistency == 
    (queue = 0 /\ inFlight = -1) => (cacheSchedule = dbSchedule)

=============================================================================
