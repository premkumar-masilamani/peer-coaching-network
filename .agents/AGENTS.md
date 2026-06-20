# Peer Coaching Network — Custom Workspace Rules & Learnings

This document contains key architectural learnings, state management patterns, and guidelines established during feature implementations in this workspace.

---

## 🧭 Light-Weight Routing & Query Parameters

For Single Page Applications (SPA) with no external routing libraries (e.g., React Router), client-side routing can be modeled using URL query parameters (e.g., `?profile=userId`):
1. **Programmatic Navigation**:
   - Use `window.history.pushState` to update search parameters without triggering a full page reload.
   - Dispatch a `PopStateEvent('popstate')` programmatically immediately after `pushState` so that other router-like components listening to the URL change can sync their state.
2. **Tab Navigation Interception**:
   - Any global tab transitions (e.g. from a side navigation panel or header) must clear active route-gating query parameters (like `profile=userId`) to return the user to the correct tab views. 
   - Define a unified tab handler that sets the current tab state and invokes `clearProfileFromUrl()` to clear parameters.
3. **History Guarding**:
   - Always check if a query parameter exists (e.g. `url.searchParams.has('profile')`) before calling `pushState` to clear it, preventing redundant entries in the browser history.

---

## ⚡ React State & Render Patterns

1. **Avoid Cascading Renders (`react-hooks/set-state-in-effect`)**:
   - Calling `setState` synchronously within the body of a `useEffect` triggers cascading render cycles.
   - Use the **adjust state during render** pattern (updating state variables conditionally inside the component render body when props or data changes, before returning JSX) to reset state variables or auto-advance indices.
   - Ensure the conditional check prevents infinite loops by verifying that the new value is different from the current state (e.g., `if (nextIdx !== -1 && nextIdx !== selectedDayIndex)`).

---

## 🎨 Carousel UX & Scroll Centering

1. **Active Tab Centering**:
   - When programmatically updating index selections in a horizontal carousel, automatically center the active DOM node.
   - Use a `useEffect` triggered by index changes to call `scrollIntoView` on the target child element:
     ```typescript
     activeEl.scrollIntoView({
       behavior: 'smooth',
       block: 'nearest',
       inline: 'center'
     });
     ```
