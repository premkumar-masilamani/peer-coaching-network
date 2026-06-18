export const TelemetryErrors = {
  RECALCULATION_FAILURE: {
    code: 'RECALCULATION_FAILURE',
    message: 'Failed to recalculate user busy slots cache.'
  },
  GOOGLE_API_CREATE_FAILURE: {
    code: 'GOOGLE_API_CREATE_FAILURE',
    message: 'Google Calendar API event creation failed.'
  },
  GOOGLE_API_DELETE_FAILURE: {
    code: 'GOOGLE_API_DELETE_FAILURE',
    message: 'Google Calendar API event deletion failed.'
  },
  TRANSACTION_FAILURE: {
    code: 'TRANSACTION_FAILURE',
    message: 'Firestore transaction failed to persist booking after maximum retries.'
  },
  CLIENT_CONFLICT: {
    code: 'CLIENT_CONFLICT',
    message: 'Client has a double-booking conflict.'
  },
  SLOT_TAKEN: {
    code: 'SLOT_TAKEN',
    message: 'The requested coaching slot is already booked.'
  },
  FETCH_EVENTS_FAILURE: {
    code: 'FETCH_EVENTS_FAILURE',
    message: 'Failed to fetch upcoming events from Google Calendar.'
  },
  FREEBUSY_API_FAILURE: {
    code: 'FREEBUSY_API_FAILURE',
    message: 'Google Calendar FreeBusy API query failed.'
  },
  CACHE_QUERY_FAILURE: {
    code: 'CACHE_QUERY_FAILURE',
    message: 'Failed to query user busy slots cache chunks.'
  }
} as const;
