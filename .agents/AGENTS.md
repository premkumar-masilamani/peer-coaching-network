# Peer Coaching Network — AI Agent Guide

This document acts as the definitive codebase guide and runtime manual. It strictly details prescriptive engineering constraints and patterns to guide AI development.

---

## 1. Tech Stack & Environment
- **Core**: Vite + React 19 + TypeScript (SPA), Cloud Firestore, Google Calendar REST API.
- **Environment Overrides**:
  - `VITE_USE_FIREBASE_EMULATOR=true`: Routes to local emulators (Auth :9099, Firestore :8080).
  - `VITE_ENABLE_GOOGLE_INTEGRATION=false`: Disables real API calls; runs sandbox fallback mode.
  - `VITE_LOG_LEVEL`: Overrides console verbosity (`'debug'`, `'info'`, `'warn'`, `'error'`).
- **Commands**:
  - `make dev` / `make local` (emulator) / `make build` / `make build-prod` / `make lint` / `make emulator` / `make install` / `npm run test`
- **Deployments**: 
  - `firebase.json` uses an array of database configurations (`firestore: [{ database: "pcn-dev", ... }, { database: "pcn-prod", ... }]`).
  - Deploy using dynamic targets: `firebase deploy --only firestore:${VITE_FIRESTORE_DATABASE_ID},hosting`

## 2. Architecture & State Flow
- **Service Layer**: Keep UI components strictly decoupled from storage and Google APIs (use `src/services/firebaseService.ts` and `src/services/googleCalendar.ts`).
- **Context Source of Truth**: `AuthContext.tsx` holds application auth and live Firestore profile state (`onSnapshot`).
- **Adjust-During-Render**: App routing changes and filtering are derived during render rather than side-effects to prevent flickering or cascading-render warnings.
- **Flat Routing**: Uses custom state (`currentTab`) and `window.history.pushState` + `PopStateEvent('popstate')`. Always clear routing parameters across global tab transitions. Guard history with `url.searchParams.has()` before pushing state.

## 3. Data & Storage Patterns
- **No Magic Strings**: Never use string literals directly in the codebase (e.g., `'users'`, `'admin'`) if the value is used in more than one place. All repeating string literals must be extracted to a centralized, strictly-typed constant object (e.g., `COLLECTIONS`, `USER_ROLE`) inside the `src/config/` module and used globally to ensure type safety.
- **Email Normalization**: To prevent Firestore query mismatches, emails must always be converted to and stored in lowercase.
- **Concurrency Protection**: Calculations in `recalculateUserBusySlotsCache` must be serialized using a promise chain (`recalcChains`) to prevent interleaving writes from corrupting the busy slots cache.
- **Scheduling Guarantee**: Always use a Firestore transaction with a deterministic ID (`${coachUid}_${startIso}`) when persisting bookings to prevent double-booking.
- **Timezones**: Availability templates use local time strings (e.g., `"10:00 AM"`). They are resolved and queried in UTC ISO strings using `getUtcForLocalDateTime` to handle DST fixed-point convergence.
- **Multiple Concurrent Credentials**: Always store credentials as arrays rather than single strings to support users holding multiple concurrent overlapping badges (e.g., core certifications + specialized advanced certifications).
- **Dynamic URL Templates**: Construct external URLs by replacing `{placeholder}` strings using `encodeURIComponent` on dynamic data instead of static string concatenation to ensure flexibility and avoid breaking query parameters.

## 4. React & Rendering Constraints
- **Avoid Cascading Renders (`react-hooks/set-state-in-effect`)**: Do not call `setState` synchronously within a `useEffect`.
- **Context Hooks Dependencies**: Always wrap extracted handlers (like `handleSave`) in `useCallback` when passing them into context state setters (like `setPageDirtyState`) to prevent infinite cascading render loops.
- **Carousel Centering**: Use `activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })` inside a `useEffect` to automatically center selected carousel items.

## 5. UI & Styling Guidelines
- **CSS Variables & HSL**: Theme colors in `index.css` (e.g., `--primary`) are raw HSL values. You **MUST ALWAYS** wrap them in inline styles: `hsl(var(--primary))`.
- **Theming**: Supported values are `'light' | 'dark'` only. No `'system'` fallback.
- **Buttons & Interactive Elements**: Never use inline styles for buttons. Always use utility classes `className="btn btn-primary"` or `className="btn btn-secondary"`.
- **Semantic Text**: Use `hsl(var(--text-primary))`, `hsl(var(--text-secondary))`, and `hsl(var(--text-muted))`. Do not hardcode hex values.
- **Glassmorphism**: Use `className="glass-panel"` for intelligent theme-aware cards and containers.
- **Modals**: Never use inline JSX overlays. All modals must be standalone components in `src/components/modals/`.
- **Modal Backgrounds**: Modals overlaying content must use opaque backgrounds (e.g., `background: hsl(var(--bg-surface))`) rather than transparent glass panels to prevent distracting visual bleed-through.
- **Custom Popups & Feedback**: Prefer custom popup components over native inputs (e.g., `<input type="date">`) for complex selection. Provide clear visual feedback (e.g., highlighting pre-selected states) to prevent redundant interactions.
- **Profile Banners**: Never block access to the dashboard or other tabs over an incomplete profile. Advisory banners only.
- **Inline Error Feedback**: Avoid intrusive success or error popups (like alerts) for background verification actions. Use subtle inline text directly below or beside action buttons for errors, and quietly revert to a normal state on success for a frictionless experience.
- **Background Action Buttons**: Always provide visual feedback on action buttons when waiting for async external requests by disabling the button and changing the text (e.g., "Verifying..."). Stack buttons and related links vertically for consistent, clean UI layouts.

## 6. Unsaved State Tracking
- **Global Tracking**: Any form that mutates local state without persisting to Firestore must integrate the `useUnsavedChanges` hook to intercept and block accidental cross-tab navigation.
- **Specific Modification Feedback**: Provide concrete, contextual diff statements to `ReviewChangesModal` (e.g., `"Added blocked date: Dec 25, 2026"`). Do not push generic fallback messages.
- **Save Button Layout**: Save buttons inside complex user-editable forms (`ProfileEdit`, `AvailabilityEdit`) must be placed logically close to the fields they govern (e.g., at the bottom of the form or column container), rather than floating loosely in a global page header.

## 7. Layout & Coding Conventions
- **Named Exports**: Expose modules as named exports (e.g. `export const ProfileEdit`) rather than default exports.
- **Verbatim Module Syntax**: When importing type definitions, prefix them with the `type` keyword (e.g. `import { type UserRole, type UserStatus } from '../config'`) to comply with `verbatimModuleSyntax` and prevent build failures.
- **Constant & Type Naming**:
  - **No Hardcoded Options**: Fixed option values (roles, user statuses, themes, genders, qualifications, navigation tabs, and log severities) must never be hardcoded. They should reference centralized object constants in `src/config/` (e.g., `USER_ROLE`, `USER_STATUS`, `THEME`, `GENDER`, `QUALIFICATION`, `LOG_SEVERITY`, and `TABS`).
  - **Suffix Consistency**: Union types derived from config option arrays must not use the "Value" suffix (e.g. use `Gender`, `Theme`, `Qualification`, `UserRole`, `UserStatus`, and `LogSeverity` consistently).

## 8. Updating This Document (Future Changes)
- **Constraint Focus**: Only append rules that dictate *how* code must be written (e.g., specific hooks to use, UI utility classes, security invariants, strict rendering patterns).
- **No Narrative**: Do not append narrative descriptions of features, component overviews, or step-by-step explanations of "how things work" under the hood. Let the code speak for itself.
- **Conciseness**: Keep entries extremely concise and organized by domain. Remove obsolete or deprecated rules immediately.
