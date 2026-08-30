/**
 * Centralized configuration and constants for the public marketing & legal website.
 */
export const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string) || 'premkumar.masilamani.2020@gmail.com';

export const APP_URL = (import.meta.env.VITE_APP_URL as string) || (
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5173'
    : 'https://app.peercoachingnetwork.com'
);

export const LANDING_URL = (import.meta.env.VITE_LANDING_URL as string) || (
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5174'
    : 'https://www.peercoachingnetwork.com'
);
