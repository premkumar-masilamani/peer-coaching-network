// URL validation helpers. Data in Firestore is client-written, so any string
// that ends up in an href/src must be protocol-checked before rendering to
// avoid javascript:-URI script execution and phishing payloads.

// Returns the URL only if it is a well-formed https URL, otherwise undefined.
export const sanitizeHttpsUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === 'https:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
};

// Returns a Google Meet link only if it is https and hosted on meet.google.com.
export const sanitizeMeetLink = (url?: string | null): string | undefined => {
  const safe = sanitizeHttpsUrl(url);
  if (!safe) return undefined;
  try {
    const host = new URL(safe).hostname.toLowerCase();
    return host === 'meet.google.com' ? safe : undefined;
  } catch {
    return undefined;
  }
};

// Returns the image URL if it is a safe https URL, otherwise the provided
// fallback (defaults to the generated avatar service).
export const sanitizeImageUrl = (
  url?: string | null,
  fallback = 'https://api.dicebear.com/7.x/bottts/svg'
): string => {
  return sanitizeHttpsUrl(url) || fallback;
};

// Programmatically navigates to a coach/user public profile by modifying URL query parameters.
export const navigateToProfile = (uid: string): void => {
  const url = new URL(window.location.href);
  url.searchParams.set('profile', uid);
  window.history.pushState({}, '', url.toString());
  window.dispatchEvent(new PopStateEvent('popstate'));
};

// Clears the profile query parameter from the URL, returning back to the normal dashboard/navigation.
export const clearProfileFromUrl = (): void => {
  const url = new URL(window.location.href);
  if (url.searchParams.has('profile')) {
    url.searchParams.delete('profile');
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
};

