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

(* --algorithm AvailabilityCaching
variables
    dbSchedule = 0,
    cacheSchedule = 0,
    queue = 0,
    inFlight = -1;

macro UpdateSchedule(v) begin
    dbSchedule := v;
    queue := queue + 1;
end macro;

macro StartRecalc() begin
    if queue > 0 /\ inFlight = -1 then
        inFlight := dbSchedule;
        queue := queue - 1;
    end if;
end macro;

macro FinishRecalc() begin
    if inFlight # -1 then
        cacheSchedule := inFlight;
        inFlight := -1;
    end if;
end macro;

process SystemLoop = 1
variables v \in Versions;
begin
Loop:
    while TRUE do
        either
            UpdateSchedule(v);
        or
            StartRecalc();
        or
            FinishRecalc();
        end either;
    end while;
end process;
end algorithm; *)

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
