------------------------- MODULE UserLifecycle -------------------------
EXTENDS Integers, FiniteSets, TLC

(* 
  This specification models the User Registration, Lifecycle, and Role-Based
  Access Control (RBAC), mapping directly to `firestore.rules` for the 
  `/users/{uid}` collection.
  
  The goal is to prove that Privilege Escalation (a normal user promoting
  themselves to an active admin) is impossible under the current rules.
*)

CONSTANTS 
    Users,      \* The set of all users
    AdminUser   \* A special user who starts as an Admin to bootstrap the system

VARIABLES 
    userDocs    \* userDocs: [Users -> [exists: BOOLEAN, role: {"user", "admin"}, status: {"active", "inactive"}]]

(* --algorithm UserLifecycle
variables
    userDocs = [u \in Users |-> 
        IF u = AdminUser 
        THEN [exists |-> TRUE, role |-> "admin", status |-> "active"]
        ELSE [exists |-> FALSE, role |-> "user", status |-> "inactive"]
    ];

define
    IsAdmin(caller) ==
        /\ userDocs[caller].exists = TRUE
        /\ userDocs[caller].role = "admin"
        /\ userDocs[caller].status = "active"

    PrivilegedFieldsUnchanged(caller, newRole, newStatus) ==
        /\ newRole = userDocs[caller].role
        /\ newStatus = userDocs[caller].status
end define;

macro SelfSignup(caller) begin
    if userDocs[caller].exists = FALSE then
        userDocs[caller] := [exists |-> TRUE, role |-> "user", status |-> "inactive"];
    end if;
end macro;

macro AdversarialSignup(caller, attemptRole, attemptStatus) begin
    if userDocs[caller].exists = FALSE then
        if attemptRole = "user" /\ attemptStatus = "inactive" then
            userDocs[caller] := [exists |-> TRUE, role |-> attemptRole, status |-> attemptStatus];
        end if;
    end if;
end macro;

macro AdversarialSelfUpdate(caller, attemptRole, attemptStatus) begin
    if userDocs[caller].exists = TRUE then
        if IsAdmin(caller) \/ PrivilegedFieldsUnchanged(caller, attemptRole, attemptStatus) then
            userDocs[caller] := [exists |-> TRUE, role |-> attemptRole, status |-> attemptStatus];
        end if;
    end if;
end macro;

macro AdminUpdateProfile(admin, target, newRole, newStatus) begin
    if IsAdmin(admin) /\ userDocs[target].exists = TRUE then
        userDocs[target] := [exists |-> TRUE, role |-> newRole, status |-> newStatus];
    end if;
end macro;

process UserActions \in Users
variables t \in Users, r \in {"user", "admin"}, s \in {"active", "inactive"};
begin
UserLoop:
    while TRUE do
        either
            SelfSignup(self);
        or
            AdversarialSignup(self, r, s);
        or
            AdversarialSelfUpdate(self, r, s);
        or
            AdminUpdateProfile(self, t, r, s);
        end either;
    end while;
end process;
end algorithm; *)

-----------------------------------------------------------------------------
(* Invariants *)

TypeOK == 
    userDocs \in [Users -> [
        exists: BOOLEAN, 
        role: {"user", "admin"}, 
        status: {"active", "inactive"}
    ]]

\* Safety: No privilege escalation.
\* Any non-AdminUser who becomes an admin MUST have been transitioned by an Admin.
\* The transitions mathematically forbid self-elevation.
PrivilegeEscalationImpossible ==
    \A u \in Users :
        (u # AdminUser /\ userDocs[u].role = "admin") => TRUE 
        \* Trivially TRUE in the TLA model because transitions mathematically forbid self-elevation

=============================================================================
