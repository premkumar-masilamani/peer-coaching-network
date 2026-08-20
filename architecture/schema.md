# Firestore Schema

```mermaid
erDiagram
    users ||--o{ availability : "coachUid"
    users ||--o{ bookings : "clientUid"
    users ||--o{ bookings : "coachUid"
    users ||--o{ supportRequests : "userId"
    users ||--o{ systemLogs : "userId"

    availability {
        string_array availableSlotsUtc
        string coachUid FK
        Timestamp lastUpdated
        UserStatus userStatus
        string gender
        string country
        boolean icf_acc
        boolean icf_pcc
        boolean icf_mcc
        boolean icf_actc
    }

    availableDays {
        DayAvailability monday
        DayAvailability tuesday
        DayAvailability wednesday
        DayAvailability thursday
        DayAvailability friday
        DayAvailability saturday
        DayAvailability sunday
    }

    blockedDates {
        string_array blockedDates
    }

    bookings {
        string bookingId FK
        string coachUid FK
        string clientUid FK
        string startIso
        string endIso
        Timestamp startTime
        Timestamp endTime
        string topic
        string status
        Timestamp createdAt
        string googleEventId FK
        string googleMeetLink
        Timestamp updatedAt
    }

    supportRequests {
        string id PK
        string userId FK
        string userDisplayName
        string userEmail
        SupportCategory category
        string subject
        SupportStatus status
        Timestamp createdAt
        Timestamp updatedAt
    }

    systemLogs {
        string type
        CalendarEvent event
        string userId FK
        Record_string details
        Timestamp timestamp
        Timestamp expireAt
    }

    users {
        Timestamp updatedAt
        string userId FK
        string email
        string firstName
        string lastName
        string displayName
        string photoURL
        Gender gender
        string country
        boolean icf_acc
        boolean icf_pcc
        boolean icf_mcc
        boolean icf_actc
        string bio
        string timezone
        UserRole userRole
        UserStatus userStatus
        boolean onboardingComplete
        string credentialDetails
        FirestoreTimestamp createdAt
    }
```

## Collections

### 1. `availability`
* **Fields**: 10 (`availableSlotsUtc`, `coachUid`, `lastUpdated`, `userStatus`, `gender`, `country`, `icf_acc`, `icf_pcc`, `icf_mcc`, `icf_actc`)
* **Primary key**: _(document-scoped / composite id)_
* **References**: `coachUid` → `users`

### 2. `availableDays`
* **Fields**: 7 (`monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`)
* **Primary key**: _(document-scoped / composite id)_

### 3. `blockedDates`
* **Fields**: 1 (`blockedDates`)
* **Primary key**: _(document-scoped / composite id)_

### 4. `bookings`
* **Fields**: 13 (`bookingId`, `coachUid`, `clientUid`, `startIso`, `endIso`, `startTime`, `endTime`, `topic`, `status`, `createdAt`, `googleEventId`, `googleMeetLink`, `updatedAt`)
* **Primary key**: _(document-scoped / composite id)_
* **References**: `coachUid` → `users`, `clientUid` → `users`

### 5. `supportRequests`
* **Fields**: 9 (`id`, `userId`, `userDisplayName`, `userEmail`, `category`, `subject`, `status`, `createdAt`, `updatedAt`)
* **Primary key**: `id`
* **References**: `userId` → `users`

### 6. `systemLogs`
* **Fields**: 6 (`type`, `event`, `userId`, `details`, `timestamp`, `expireAt`)
* **Primary key**: _(document-scoped / composite id)_
* **References**: `userId` → `users`

### 7. `users`
* **Fields**: 20 (`updatedAt`, `userId`, `email`, `firstName`, `lastName`, `displayName`, `photoURL`, `gender`, `country`, `icf_acc`, `icf_pcc`, `icf_mcc`, `icf_actc`, `bio`, `timezone`, `userRole`, `userStatus`, `onboardingComplete`, `credentialDetails`, `createdAt`)
* **Primary key**: _(document-scoped / composite id)_
