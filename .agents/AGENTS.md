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
- **Service Layer**: Keep UI components strictly decoupled from storage and Google APIs.
- **Domain-Split Services**: The service layer is one module per domain — `firebaseApp` (Firebase bootstrap only), `authService`, `profileService`, `scheduleService`, `slotsService`, `supportService`, `discoveryService` — plus a side-effect-free `types.ts` and dependency-free `profileHelpers.ts`. New code MUST import from the specific service; `src/services/firebaseService.ts` is a pure barrel re-export kept only for backward compatibility, not an entry point for new code.
- **Side-Effect-Free Types**: Never export domain types from a module that also performs Firebase bootstrap. Domain types live in `src/services/types.ts`, so importing a type never triggers app initialization.
- **Single Slot Generator**: All expansion of a coach's availability template into bookable slot start times goes through `generateTemplateSlots()` in `src/utils/slotGeneration.ts`. Never re-inline the day-sweep / 30-minute-cadence loop — the cache-recalculation path (`slotsService`) and the Google Calendar fallback path (`googleCalendar`) must stay byte-for-byte identical, so any change happens in one place.
- **Call-Time-Only Import Cycles**: `scheduleService ↔ slotsService` is an intentional lazy import cycle (a schedule write triggers a recalc; the recalc reads the schedule). It works ONLY because the imported symbols are referenced inside function bodies, never at module top level — hoisting such a reference to module scope fails at import (TDZ), often only in the production bundle. Put genuinely shared, pure predicates (e.g. `isApproved`) in a dependency-free helper module rather than importing a heavy service and creating a real cycle.
- **Context Source of Truth**: `AuthContext.tsx` holds application auth and live Firestore profile state (`onSnapshot`).
- **Adjust-During-Render**: App routing changes and filtering are derived during render rather than side-effects to prevent flickering or cascading-render warnings.
- **Flat Routing**: Uses custom state (`currentTab`) and `window.history.pushState` + `PopStateEvent('popstate')`. Always clear routing parameters across global tab transitions. Guard history with `url.searchParams.has()` before pushing state.

## 3. Data & Storage Patterns
- **No Magic Strings**: Never use string literals directly in the codebase (e.g., `'users'`, `'admin'`) if the value is used in more than one place. All repeating string literals must be extracted to a centralized, strictly-typed constant object (e.g., `COLLECTIONS`, `USER_ROLE`) inside the `src/config/` module and used globally to ensure type safety.
- **Email Normalization**: To prevent Firestore query mismatches, emails must always be converted to and stored in lowercase.
- **Cache Recalculation Bypass (Data Syncing)**: Optimizing cache writes based strictly on structural equality (e.g., `areAvailableSlotsEqual`) is dangerous because it ignores critical profile metadata updates (like `userStatus`). When a user's status changes from 'inactive' to 'active', the availability cache MUST be rewritten to propagate that status change to the discovery engine, even if calendar slots didn't change.
- **Strict Typing with Firebase Compound Filters**: When programmatically constructing compound queries in Firestore v9 (e.g., using `or(...)` with dynamic arrays), you must explicitly type the constraints array as `QueryConstraint[]` to prevent TypeScript mismatch errors.
- **Concurrency Protection**: Calculations in `recalculateUserBusySlotsCache` must be serialized using a promise chain (`recalcChains`) to prevent interleaving writes from corrupting the busy slots cache.
- **Scheduling Guarantee**: Always use a Firestore transaction with a deterministic ID (`${coachUid}_${startIso}`) when persisting bookings to prevent double-booking.
- **Timezones**: Availability templates use local time strings (e.g., `"10:00 AM"`). They are resolved and queried in UTC ISO strings using `getUtcForLocalDateTime` to handle DST fixed-point convergence.
- **Multiple Concurrent Credentials**: Always store credentials as arrays rather than single strings to support users holding multiple concurrent overlapping badges (e.g., core certifications + specialized advanced certifications).
- **Dynamic URL Templates**: Construct external URLs by replacing `{placeholder}` strings using `encodeURIComponent` on dynamic data instead of static string concatenation to ensure flexibility and avoid breaking query parameters.
- **Centralized Input & Character Limits**: Any user input with database-enforced size or character constraints (e.g., biographical text, coaching topics, support ticket contents) must use centralized constants (e.g., `INPUT_LIMITS`) for both the frontend component's `maxLength` attribute and the `firestore.rules` size validation.
- **Message Spoofing and Role Validation**: In multi-party or collaborative collections (such as support ticket messages, chats, etc.), the `firestore.rules` file must explicitly validate that for non-admin creates and updates, the newly appended message's `senderId` matches `request.auth.uid` and `senderRole` matches the client's actual role (e.g., `'user'`) to prevent identity spoofing or role escalation.

## 4. React & Rendering Constraints
- **Avoid Cascading Renders (`react-hooks/set-state-in-effect`)**: Do not call `setState` synchronously within a `useEffect`.
- **Context Hooks Dependencies**: Always wrap extracted handlers (like `handleSave`) in `useCallback` when passing them into context state setters (like `setPageDirtyState`) to prevent infinite cascading render loops.
- **Decoupling State for Layout Flashes**: To prevent UI flickering on tab switches or date selection, decouple the "UI render state" from the "Query state" (`fetchedDayIndex` vs `selectedDayIndex`). Hold previous data on screen with a soft CSS transition until new data arrives rather than unmounting components for a spinner.
- **Carousel Centering**: Use `activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })` inside a `useEffect` to automatically center selected carousel items.
- **No Ref Mutation During Render (`react-hooks/refs`)**: Never write to `ref.current` in the render body. For arrays of element refs, assign in the ref callback and return the React 19 cleanup function (`return () => { refs.current[i] = null; }`).
- **Scoped DOM IDs**: Generate ids consumed by `aria-controls` / `aria-labelledby` with `useId()`, never module-level constants, so the wiring survives multiple mounts of the same component.

## 5. UI & Styling Guidelines
- **CSS Variables & HSL**: Theme colors in `index.css` (e.g., `--primary`) are raw HSL values. You **MUST ALWAYS** wrap them in inline styles: `hsl(var(--primary))`.
- **Theming**: Supported values are `'light' | 'dark'` only. No `'system'` fallback.
- **Buttons & Interactive Elements**: Never use inline styles for buttons. Always use utility classes `className="btn btn-primary"` or `className="btn btn-secondary"`.
- **Semantic Interactivity**: Never attach `onClick` to a `div`, `img`, or `span`. Use `<button type="button">`, which provides Enter/Space activation natively — no `onKeyDown` required.
- **Button Content Model**: A `<button>` may only contain phrasing content. Use `<span>`, never `div`/`h3`/`p`. When converting a heading, reapply the global `h1–h6` font and color, as a `span` does not inherit them.
- **Button CSS Resets**: Converting a `div` to a `button` resets inherited styles. Restore `font-family: inherit`, `color: inherit`, and `text-align` in the element's class (not inline).
- **Conditional Interactivity**: Render an element as a `<button>` only when it can actually act. `role` is `null` for pending users and `undefined` while auth loads; neither may receive a focusable control that does nothing.
- **Focus Rings**: Never declare `border-radius` inside a bare `:focus-visible` block. It ties `.btn`/`.input-field` on specificity and wins on source order, silently reshaping them for keyboard users only. The outline already follows each element's own radius.
- **Tabs Use Manual Activation**: When selecting a tab triggers a fetch, arrow keys move focus only (roving `tabIndex` driven by a `focusedTabIndex` separate from the selected index); `Enter`/`Space` commits. Automatic activation fires one query per keystroke and races the responses. Arrow keys must wrap, and `Home`/`End` must jump to the first/last tab. Always pair `role="tablist"` with a real `role="tabpanel"`, or `aria-selected` refers to nothing.
- **Semantic Text**: Use `hsl(var(--text-primary))`, `hsl(var(--text-secondary))`, and `hsl(var(--text-muted))`. Do not hardcode hex values.
- **Glassmorphism**: Use `className="glass-panel"` for intelligent theme-aware cards and containers.
- **Modals**: Never use inline JSX overlays. All modals must be standalone components in `src/components/modals/`.
- **Modal Backgrounds**: Modals overlaying content must use opaque backgrounds (e.g., `background: hsl(var(--bg-surface))`) rather than transparent glass panels to prevent distracting visual bleed-through.
- **Accessible Modal Semantics and Focus Restoration**: All modals must use standard HTML5 `<dialog>` semantics (or have explicit `role="dialog"` and `aria-modal="true"`). In addition, focus must be manually backed up upon opening the modal and explicitly restored to the triggering element when the modal is closed or unmounted to ensure full keyboard and screen-reader accessibility.
- **Custom Popups & Feedback**: Prefer custom popup components over native inputs (e.g., `<input type="date">`) for complex selection. Provide clear visual feedback (e.g., highlighting pre-selected states) to prevent redundant interactions.
- **Profile Banners**: Never block access to the dashboard or other tabs over an incomplete profile. Advisory banners only.
- **Inline Error Feedback**: Avoid intrusive success or error popups (like alerts) for background verification actions. Use subtle inline text directly below or beside action buttons for errors, and quietly revert to a normal state on success for a frictionless experience.
- **Background Action Buttons**: Always provide visual feedback on action buttons when waiting for async external requests by disabling the button and changing the text (e.g., "Verifying..."). Stack buttons and related links vertically for consistent, clean UI layouts.

## 6. Unsaved State Tracking
- **Global Tracking**: Any form that mutates local state without persisting to Firestore must integrate the `useUnsavedChanges` hook to intercept and block accidental cross-tab navigation.
- **Guarded Profile Navigation**: Never import `navigateToProfile` from `utils/url` directly in a component — the raw util pushes URL state and dispatches `popstate`, bypassing the dirty guard. Always use the `useNavigateToProfile()` hook from `UnsavedChangesContext`, which routes the jump through `navigateWithConfirmation`.
- **Full Page-Unload Guard**: Tab close / reload / external navigation is covered by a `beforeunload` listener registered in `UnsavedChangesProvider` only while `isDirty`. In-app navigation (tabs, profiles) is intercepted separately via `navigateWithConfirmation`; the two layers together are what make the guard complete.
- **Specific Modification Feedback**: Provide concrete, contextual diff statements to `ReviewChangesModal` (e.g., `"Added blocked date: Dec 25, 2026"`). Do not push generic fallback messages.
- **Save Button Layout**: Save buttons inside complex user-editable forms (`ProfileEdit`, `AvailabilityEdit`) must be placed logically close to the fields they govern (e.g., at the bottom of the form or column container), rather than floating loosely in a global page header.

## 7. Layout & Coding Conventions
- **Accessibility Linting**: `eslint-plugin-jsx-a11y` runs on `**/*.tsx`. Never blanket-disable its rules. Deliberate exceptions (backdrop click-catchers, `stopPropagation` guards, modal `autoFocus`) require a narrowly-scoped `eslint-disable-next-line` naming each rule, plus a comment saying why keyboard users are unaffected.
- **jsx-a11y Peer Range**: The plugin caps its `eslint` peer at `^9` but runs correctly on `eslint` 10. `package.json` carries an `overrides` entry pinning it to the root `eslint`; without it, a plain `npm install` fails with `ERESOLVE`. Remove the override once the plugin declares v10 support.
- **Vitest Unit Glob Covers `.tsx`**: The `unit` project include is `src/**/*.test.{ts,tsx}`. Component/context suites that render JSX must be `.tsx` files — a `.ts`-only glob silently skips them (they never run, never fail). After adding a component test, confirm collection with `npx vitest list --project=unit --filesOnly`.
- **Testing `beforeunload` in jsdom**: A plain `Event`'s `returnValue` uses legacy boolean cancel semantics, not the string slot a real `BeforeUnloadEvent` exposes. Assert the guard via `preventDefault` / `defaultPrevented`; intercept the `returnValue` setter with `Object.defineProperty` if you must check the assigned value.
- **Named Exports**: Expose modules as named exports (e.g. `export const ProfileEdit`) rather than default exports.
- **Verbatim Module Syntax**: When importing type definitions, prefix them with the `type` keyword (e.g. `import { type UserRole, type UserStatus } from '../config'`) to comply with `verbatimModuleSyntax` and prevent build failures.
- **Constant & Type Naming**:
  - **No Hardcoded Options**: Fixed option values (roles, user statuses, themes, genders, qualifications, navigation tabs, and log severities) must never be hardcoded. They should reference centralized object constants in `src/config/` (e.g., `USER_ROLE`, `USER_STATUS`, `THEME`, `GENDER`, `QUALIFICATION`, `LOG_SEVERITY`, and `TABS`).
  - **Suffix Consistency**: Union types derived from config option arrays must not use the "Value" suffix (e.g. use `Gender`, `Theme`, `Qualification`, `UserRole`, `UserStatus`, and `LogSeverity` consistently).
- **Reusable Prop-Driven Forms**: Complex user-editable interfaces (`AvailabilityEdit`, `ProfileEdit`) must be built as singular, reusable components that accept behavioral props (e.g., `onboardingMode={true}`). The Onboarding Wizard and main Dashboard must use the exact same underlying logic, tweaked only by props.
- **Credential Presentation Normalization**: Credential badges must strictly enforce the short-form `"ICF "` prefix (e.g., `ICF ACC`) globally. Centralize this transformation in a utility file rather than handling it individually by components.

## 8. Updating This Document (Future Changes)
- **Constraint Focus**: Only append rules that dictate *how* code must be written (e.g., specific hooks to use, UI utility classes, security invariants, strict rendering patterns).
- **No Narrative**: Do not append narrative descriptions of features, component overviews, or step-by-step explanations of "how things work" under the hood. Let the code speak for itself.
- **Conciseness**: Keep entries extremely concise and organized by domain. Remove obsolete or deprecated rules immediately.
