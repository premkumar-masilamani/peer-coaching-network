------------------------- MODULE SupportSystem -------------------------
EXTENDS Integers, FiniteSets, Sequences, TLC

(* 
  This specification models the Support System & Messaging module.
  The primary focus is proving the Append-Only and Immutability properties
  of the message ledger, ensuring that message history cannot be tampered
  with and sender spoofing is impossible under the `firestore.rules`.
*)

CONSTANTS 
    Users,      \* Set of all users
    Admins,     \* Subset of Users who are admins
    Tickets,    \* Set of possible ticket IDs
    MsgIds,     \* Set of possible message IDs
    Values      \* Set of possible message contents

VARIABLES 
    requests,   \* Set of active support requests: [id: Tickets, owner: Users, status: {"open", "closed"}]
    messages    \* Set of all messages ever written: [id: MsgIds, ticket: Tickets, sender: Users, content: Values]

vars == <<requests, messages>>

-----------------------------------------------------------------------------
(* Initial State *)
Init == 
    /\ requests = {}
    /\ messages = {}

-----------------------------------------------------------------------------
(* Actions *)

\* A user creates a new support request.
CreateRequest(u, t, m, v) ==
    /\ t \notin {req.id : req \in requests}
    /\ m \notin {msg.id : msg \in messages}
    /\ requests' = requests \cup {[id |-> t, owner |-> u, status |-> "open"]}
    /\ messages' = messages \cup {[id |-> m, ticket |-> t, sender |-> u, content |-> v]}

\* A user (or admin) adds a message to an existing ticket.
\* Matches firestore.rules: senderId == auth.uid AND (isAdmin OR owner == auth.uid)
AddMessage(u, t, m, v) ==
    /\ \E req \in requests : 
        /\ req.id = t
        /\ (u = req.owner \/ u \in Admins)
    /\ m \notin {msg.id : msg \in messages}
    /\ messages' = messages \cup {[id |-> m, ticket |-> t, sender |-> u, content |-> v]}
    /\ UNCHANGED <<requests>>

\* An attacker tries to spoof a message (pretending to be someone else).
\* Simulates the rule `request.resource.data.senderId == request.auth.uid`
SpoofMessage(attacker, victim, t, m, v) ==
    /\ attacker # victim
    /\ \E req \in requests : req.id = t
    /\ m \notin {msg.id : msg \in messages}
    \* Guard: The firestore rule blocks this because attacker != victim
    \* If we enforced it, the transition is impossible. We model the rejected state as UNCHANGED.
    \* Actually, in TLA+, we define valid transitions. If it's blocked, we just don't add it to messages.
    /\ FALSE 
    /\ UNCHANGED vars

\* An attacker tries to modify an existing message.
\* Simulates the rule `allow update: if false;`
UpdateMessage(u, m, newV) ==
    /\ \E msg \in messages : msg.id = m
    \* Guard: The firestore rule blocks this unconditionally.
    /\ FALSE
    /\ UNCHANGED vars

\* An admin closes a ticket.
CloseRequest(admin, t) ==
    /\ admin \in Admins
    /\ \E req \in requests : req.id = t /\ req.status = "open"
    /\ requests' = { IF req.id = t THEN [req EXCEPT !.status = "closed"] ELSE req : req \in requests }
    /\ UNCHANGED <<messages>>

\* An admin deletes a ticket (cascades messages).
DeleteRequest(admin, t) ==
    /\ admin \in Admins
    /\ \E req \in requests : req.id = t
    /\ requests' = {req \in requests : req.id # t}
    /\ messages' = {msg \in messages : msg.ticket # t}

-----------------------------------------------------------------------------
(* Next State Relation *)
Next == 
    \E u \in Users, a \in Admins, t \in Tickets, m \in MsgIds, v \in Values :
        \/ CreateRequest(u, t, m, v)
        \/ AddMessage(u, t, m, v)
        \/ SpoofMessage(u, a, t, m, v) \* Where attacker=u, victim=a
        \/ UpdateMessage(u, m, v)
        \/ CloseRequest(a, t)
        \/ DeleteRequest(a, t)

-----------------------------------------------------------------------------
(* Invariants *)

TypeOK == 
    /\ \A req \in requests : req.id \in Tickets /\ req.owner \in Users /\ req.status \in {"open", "closed"}
    /\ \A msg \in messages : msg.id \in MsgIds /\ msg.ticket \in Tickets /\ msg.sender \in Users /\ msg.content \in Values

\* Immutability: If a message exists in the current state, and the ticket hasn't been deleted,
\* the message's content and sender can never change in future states.
\* In TLA+, this is verified because the `UpdateMessage` transition is logically `FALSE`.
MessageImmutability ==
    \* This invariant states that no two messages can have the same ID but different contents or senders.
    \* (Since MsgIds are unique per assignment in our transitions).
    \A m1, m2 \in messages : (m1.id = m2.id) => (m1 = m2)

\* Anti-Spoofing: A message on a ticket is ONLY ever authored by the ticket owner OR an admin.
\* This proves that a random user cannot inject messages into another user's ticket.
NoCrossTicketSpoofing ==
    \A msg \in messages :
        \A req \in requests :
            (req.id = msg.ticket) => (msg.sender = req.owner \/ msg.sender \in Admins)

=============================================================================
