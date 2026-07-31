------------------------- MODULE BookingProtocol -------------------------
EXTENDS Integers, FiniteSets, TLC

(* 
  This specification models the Peer Coaching Network Booking Transaction Protocol,
  mirroring the current Firestore transaction in `firestoreRepository.ts` and
  the `firestore.rules` validations.
*)

CONSTANTS 
    Users,  \* The set of all users (can act as coaches or clients)
    Slots   \* The set of all time slots (for simplicity, discrete time instants)

VARIABLES 
    coachAvailability,  \* coachAvailabilityByDate: [Users -> SUBSET Slots]
    bookings,           \* bookings: [Users x Slots -> [client: Users, status: {"NONE", "PENDING", "CONFIRMED", "CANCELLED"}]]
    busySlots,          \* busySlots: [Users x Slots -> BOOLEAN]
    clientCache         \* clientBookingCache: [Users x Slots -> BOOLEAN]

vars == <<coachAvailability, bookings, busySlots, clientCache>>

-----------------------------------------------------------------------------
(* Initial State *)
Init == 
    /\ coachAvailability = [u \in Users |-> {}]
    /\ bookings = [u \in Users, s \in Slots |-> [client |-> u, status |-> "NONE"]]
    /\ busySlots = [u \in Users, s \in Slots |-> FALSE]
    /\ clientCache = [u \in Users, s \in Slots |-> FALSE]

-----------------------------------------------------------------------------
(* Actions *)

\* A coach publishes availability for a slot (handled by slotsService / syncCoachAvailabilityShards)
PublishSlot(coach, slot) ==
    /\ coachAvailability' = [coachAvailability EXCEPT ![coach] = coachAvailability[coach] \cup {slot}]
    /\ UNCHANGED <<bookings, busySlots, clientCache>>

\* A coach removes availability for a slot
UnpublishSlot(coach, slot) ==
    /\ coachAvailability' = [coachAvailability EXCEPT ![coach] = coachAvailability[coach] \ {slot}]
    /\ UNCHANGED <<bookings, busySlots, clientCache>>

\* A client reserves a slot with a coach (matches `reserveBookingSlots`)
ReserveBooking(client, coach, slot) ==
    /\ client # coach  \* Cannot book yourself
    \* PCN-038: Rules ensure the slot is actually published by the coach
    /\ slot \in coachAvailability[coach]
    \* Transaction Checks (1-4 in `reserveBookingSlots`)
    /\ ~busySlots[coach, slot]      \* 1. Coach availability check (not already booked as coach)
    /\ ~clientCache[coach, slot]    \* 2. Coach-as-client check (coach isn't busy being a client)
    /\ ~clientCache[client, slot]   \* 3. Client-as-client check (client isn't already booking another coach)
    /\ ~busySlots[client, slot]     \* 4. Client-as-coach check (client isn't already booked as a coach)
    \* Effects
    /\ bookings' = [bookings EXCEPT ![coach, slot] = [client |-> client, status |-> "PENDING"]]
    /\ busySlots' = [busySlots EXCEPT ![coach, slot] = TRUE]
    /\ clientCache' = [clientCache EXCEPT ![client, slot] = TRUE]
    /\ UNCHANGED <<coachAvailability>>

\* Confirm a pending booking (matches `confirmBooking`)
ConfirmBooking(coach, slot) ==
    /\ bookings[coach, slot].status = "PENDING"
    /\ bookings' = [bookings EXCEPT ![coach, slot] = [client |-> bookings[coach, slot].client, status |-> "CONFIRMED"]]
    \* TTLs are extended in actual code, but boolean state remains TRUE
    /\ UNCHANGED <<coachAvailability, busySlots, clientCache>>

\* Cancel or rollback a booking (matches `cancelBookingDoc` and `rollbackBooking`)
CancelBooking(coach, slot) ==
    /\ bookings[coach, slot].status \in {"PENDING", "CONFIRMED"}
    /\ bookings' = [bookings EXCEPT ![coach, slot] = [client |-> bookings[coach, slot].client, status |-> "CANCELLED"]]
    /\ busySlots' = [busySlots EXCEPT ![coach, slot] = FALSE]
    /\ clientCache' = [clientCache EXCEPT ![bookings[coach, slot].client, slot] = FALSE]
    /\ UNCHANGED <<coachAvailability>>

-----------------------------------------------------------------------------
(* Next State Relation *)
Next == 
    \E c, u \in Users, s \in Slots : 
        \/ PublishSlot(c, s)
        \/ UnpublishSlot(c, s)
        \/ ReserveBooking(u, c, s)
        \/ ConfirmBooking(c, s)
        \/ CancelBooking(c, s)

-----------------------------------------------------------------------------
(* Invariants *)

\* Type Invariant
TypeOK == 
    /\ coachAvailability \in [Users -> SUBSET Slots]
    /\ bookings \in [Users \X Slots -> [client: Users, status: {"NONE", "PENDING", "CONFIRMED", "CANCELLED"}]]
    /\ busySlots \in [Users \X Slots -> BOOLEAN]
    /\ clientCache \in [Users \X Slots -> BOOLEAN]

\* Safety: A user cannot be both a coach and a client at the same time slot
NoDoubleBooking == 
    \A u \in Users, s \in Slots : 
        ~(busySlots[u, s] /\ clientCache[u, s])

\* Safety: Only one active booking per slot per coach
SingleActiveBookingPerCoachSlot == 
    \A c \in Users, s \in Slots : 
        (bookings[c, s].status \in {"PENDING", "CONFIRMED"}) => busySlots[c, s]

\* Safety: No client has two active bookings at the same time
SingleActiveBookingPerClientSlot == 
    \A c \in Users, s \in Slots : 
        (bookings[c, s].status \in {"PENDING", "CONFIRMED"}) => clientCache[bookings[c, s].client, s]

-----------------------------------------------------------------------------
Spec == Init /\ [][Next]_vars

=============================================================================
