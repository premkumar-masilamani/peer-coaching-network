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

(* --algorithm BookingProtocol
variables
    \* Initialize state
    coachAvailability = [u \in Users |-> {}],
    bookings = [u \in Users, s \in Slots |-> [client |-> u, status |-> "NONE"]],
    busySlots = [u \in Users, s \in Slots |-> FALSE],
    clientCache = [u \in Users, s \in Slots |-> FALSE];

macro PublishSlot(coach, slot) begin
    coachAvailability[coach] := coachAvailability[coach] \cup {slot};
end macro;

macro UnpublishSlot(coach, slot) begin
    coachAvailability[coach] := coachAvailability[coach] \ {slot};
end macro;

macro ReserveBooking(client, coach, slot) begin
    if client # coach /\ slot \in coachAvailability[coach] then
        if ~busySlots[coach, slot] /\ ~clientCache[coach, slot] /\ ~clientCache[client, slot] /\ ~busySlots[client, slot] then
            bookings[coach, slot] := [client |-> client, status |-> "PENDING"];
            busySlots[coach, slot] := TRUE;
            clientCache[client, slot] := TRUE;
        end if;
    end if;
end macro;

macro ConfirmBooking(coach, slot) begin
    if bookings[coach, slot].status = "PENDING" then
        bookings[coach, slot].status := "CONFIRMED";
    end if;
end macro;

macro CancelBooking(coach, slot) begin
    if bookings[coach, slot].status \in {"PENDING", "CONFIRMED"} then
        clientCache[bookings[coach, slot].client, slot] := FALSE;
        bookings[coach, slot].status := "CANCELLED";
        busySlots[coach, slot] := FALSE;
    end if;
end macro;

process ClientAction \in Users
variables c \in Users, s \in Slots;
begin
ClientLoop:
    while TRUE do
        either
            PublishSlot(self, s);
        or
            UnpublishSlot(self, s);
        or
            ReserveBooking(self, c, s);
        or
            ConfirmBooking(self, s);
        or
            CancelBooking(self, s);
        end either;
    end while;
end process;
end algorithm; *)

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

=============================================================================
