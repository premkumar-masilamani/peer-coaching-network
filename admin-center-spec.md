# Feature: Platform Admin Center

## Overview / User Story
As an administrator, I want to have a single "Platform Admin" tab in the left navigation that houses the Admin Panel, System Logs, and Support Requests, so that the main navigation remains uncluttered and scalable for future administrative tools.

## Acceptance Criteria
- [ ] A new left navigation tab called **"Platform Admin"** (or similar agreed-upon name) replaces the individual "Admin Panel", "System Logs", and "Support Requests" tabs.
- [ ] The "Platform Admin" tab is only visible to users with `role === USER_ROLE.ADMIN` and `userStatus === USER_STATUS.ACTIVE`.
- [ ] Clicking on "Platform Admin" opens a new parent view component (`PlatformAdminDashboard`).
- [ ] `PlatformAdminDashboard` implements a sub-navigation layout (e.g., pill tabs or secondary side-nav) containing three views:
  - Users & Roles (migrated from `AdminDashboard.tsx`)
  - System Logs (migrated from `SystemLogs.tsx`)
  - Support Requests (migrated from `SupportDesk.tsx`)
- [ ] State for the active sub-tab is managed locally within `PlatformAdminDashboard` or through lightweight URL query parameters.
- [ ] The global `AGENTS.md` and `src/config.ts` (e.g., `TABS` constant) are updated to reflect the new navigation structure.

## Technical Specification

### Frontend UI/UX
- **`src/config.ts`**: 
  - Deprecate/remove `TABS.SYSTEM_LOGS` and `TABS.SUPPORT_REQUESTS`.
  - Rename `TABS.ADMIN` to `TABS.PLATFORM_ADMIN` (or keep it as `TABS.ADMIN` but change its label).
- **`LeftNav.tsx`**:
  - Remove the dedicated buttons for System Logs and Support Requests.
  - Keep the "Admin Panel" button but update its text to "Platform Admin".
- **`App.tsx`**:
  - Update routing logic: when `currentTab === TABS.ADMIN`, render `<PlatformAdminDashboard />` instead of `<AdminDashboard />`.
- **`PlatformAdminDashboard.tsx` (New Component)**:
  - A layout component that uses a simple state variable (e.g., `const [adminTab, setAdminTab] = useState<'users' | 'logs' | 'support'>('users')`) to toggle between the child components.
  - Import and render `<AdminDashboard />`, `<SystemLogs />`, and `<SupportDesk />` depending on the active `adminTab`.
  - Provide a clean, modern UI for the sub-tabs (e.g., horizontal tabs beneath the main header) to switch views seamlessly.

### Backend / APIs
- N/A (Client-side routing and layout changes only).

### Database Schema Changes
- N/A

### One-Time Data Updates
- N/A

### Security & Permissions
- The existing security rules on Firestore and component-level visibility checks (`role === USER_ROLE.ADMIN`) will naturally extend to this new parent component, protecting the child components as before.

## Next Steps
- Verify if any cross-tab navigation or specific query parameter routing logic in `App.tsx` needs to be adjusted for deep-linking directly into "System Logs" or "Support Requests".
