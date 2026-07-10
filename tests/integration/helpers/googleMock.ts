import { vi } from 'vitest';

const originalFetch = globalThis.fetch;

export const mockGoogleCalendarFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const urlString = typeof input === 'string' 
    ? input 
    : input instanceof URL 
      ? input.toString() 
      : input.url;

  if (urlString.includes('googleapis.com/calendar')) {
    const method = init?.method?.toUpperCase() || 'GET';
    
    if (method === 'POST') {
      return new Response(JSON.stringify({
        id: 'mock-event-id',
        hangoutLink: 'https://meet.google.com/mock-link'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Fallback to real fetch for emulator control or other HTTP requests
  return originalFetch(input, init);
};

export function setupGoogleCalendarMock() {
  vi.stubGlobal('fetch', mockGoogleCalendarFetch);
}
