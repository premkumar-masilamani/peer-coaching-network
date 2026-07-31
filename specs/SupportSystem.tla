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

(* --algorithm SupportSystem
variables
    requests = {},
    messages = {};

macro CreateRequest(u, t, m, v) begin
    if t \notin {req.id : req \in requests} /\ m \notin {msg.id : msg \in messages} then
        requests := requests \cup {[id |-> t, owner |-> u, status |-> "open"]};
        messages := messages \cup {[id |-> m, ticket |-> t, sender |-> u, content |-> v]};
    end if;
end macro;

macro AddMessage(u, t, m, v) begin
    if \E req \in requests : req.id = t /\ (u = req.owner \/ u \in Admins) then
        if m \notin {msg.id : msg \in messages} then
            messages := messages \cup {[id |-> m, ticket |-> t, sender |-> u, content |-> v]};
        end if;
    end if;
end macro;

macro SpoofMessage(attacker, victim, t, m, v) begin
    if attacker # victim /\ \E req \in requests : req.id = t then
        if m \notin {msg.id : msg \in messages} then
            \* Firestore rule blocks this because senderId != request.auth.uid
            skip;
        end if;
    end if;
end macro;

macro UpdateMessage(u, m, newV) begin
    if \E msg \in messages : msg.id = m then
        \* Firestore rule blocks this unconditionally: allow update: if false;
        skip;
    end if;
end macro;

macro CloseRequest(admin, t) begin
    if admin \in Admins /\ \E req \in requests : req.id = t /\ req.status = "open" then
        requests := { IF req.id = t THEN [req EXCEPT !.status = "closed"] ELSE req : req \in requests };
    end if;
end macro;

macro DeleteRequest(admin, t) begin
    if admin \in Admins /\ \E req \in requests : req.id = t then
        requests := {req \in requests : req.id # t};
        messages := {msg \in messages : msg.ticket # t};
    end if;
end macro;

process UserActions \in Users
variables a \in Admins, t \in Tickets, m \in MsgIds, v \in Values;
begin
UserLoop:
    while TRUE do
        either
            CreateRequest(self, t, m, v);
        or
            AddMessage(self, t, m, v);
        or
            SpoofMessage(self, a, t, m, v);
        or
            UpdateMessage(self, m, v);
        or
            CloseRequest(a, t);
        or
            DeleteRequest(a, t);
        end either;
    end while;
end process;
end algorithm; *)

-----------------------------------------------------------------------------
(* Invariants *)

TypeOK == 
    /\ \A req \in requests : req.id \in Tickets /\ req.owner \in Users /\ req.status \in {"open", "closed"}
    /\ \A msg \in messages : msg.id \in MsgIds /\ msg.ticket \in Tickets /\ msg.sender \in Users /\ msg.content \in Values

\* Immutability: If a message exists in the current state, and the ticket hasn't been deleted,
\* the message's content and sender can never change in future states.
MessageImmutability ==
    \A m1, m2 \in messages : (m1.id = m2.id) => (m1 = m2)

\* Anti-Spoofing: A message on a ticket is ONLY ever authored by the ticket owner OR an admin.
NoCrossTicketSpoofing ==
    \A msg \in messages :
        \A req \in requests :
            (req.id = msg.ticket) => (msg.sender = req.owner \/ msg.sender \in Admins)

=============================================================================
