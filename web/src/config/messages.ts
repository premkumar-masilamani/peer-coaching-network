/**
 * Centralized registry of all user-facing validation errors, alerts,
 * toasts, and modal descriptions to eliminate magic strings in UI files.
 */
export const USER_MESSAGES = {
  TOASTS: {
    CANCEL_SESSION_FAILED: 'Failed to cancel session. Please try again.',
    CANCEL_BOOKING_FAILED: 'Failed to cancel booking. Please try again.',
  },
  SYSTEM: {
    SOMETHING_WENT_WRONG: 'Something went wrong',
    UNEXPECTED_ERROR_RELOAD: 'An unexpected error occurred. Reloading the page usually fixes it.',
    RELOAD_BUTTON: 'Reload',
    CONFIG_ERROR_TITLE: 'Configuration error',
    CONFIG_ERROR_DESC: 'The application is not configured correctly and can’t start. Please contact the site administrator.',
    LOCAL_HOST_BLOCKED: "Accessing the application via 'localhost' or '127.0.0.1' is blocked to prevent Google Sign-In redirect loops. Please access the application via 'https://local.peercoachingnetwork.com:5173' instead. (Refer to the README.md for setup instructions).",
  },
  AUTH: {
    INVALID_GOOGLE_SIGNIN: 'Google Sign-In did not return a valid email or display name.',
  },
  AVAILABILITY: {
    VALIDATION_INVALID_TIMES: 'Please select valid start and end times for all active slots.',
    VALIDATION_TIME_ORDER: 'End times must be later than start times.',
    SAVE_FAILED: 'Failed to save availability settings. Please try again.',
    SAVE_SUCCESS: 'Availability template and schedules saved successfully!',
  },
  PROFILE: {
    SAVE_FAILED: 'Failed to save profile changes. Please try again.',
    SAVE_SUCCESS: 'Profile changes saved successfully!',
  },
  BOOKING: {
    TOPIC_REQUIRED: 'Please enter a coaching topic to confirm your booking.',
    CALENDAR_CONNECTION_REQUIRED: 'Your Google Calendar connection has expired or is missing. Please reconnect to proceed.',
    GOOGLE_CALENDAR_EXPIRED: 'Google Calendar token is missing or expired. Please connect your Google Calendar.',
  },
  MODALS: {
    CANCEL_SESSION: {
      TITLE: 'Cancel Session?',
      DESCRIPTION: 'Are you sure you want to cancel this peer coaching session? This will remove the event from Google Calendar and release the slot.',
      CONFIRM: 'Yes, Cancel Session',
      CANCEL: 'No, Keep Session',
      CANCELLING: 'Cancelling...',
    },
    CALENDAR_CONNECTION: {
      TITLE: 'Google Calendar Connection Required',
      DESCRIPTION: 'To manage or book peer coaching sessions, you must connect your Google Calendar. This allows the platform to sync availability and automatically schedule meetings.',
      CONNECT: 'Connect Google Calendar',
      CONNECTING: 'Connecting...',
    },
    REVIEW_CHANGES: {
      TITLE: 'Review changes',
      CONFIRM: 'Confirm Approval',
      DISCARD: 'Discard',
      CANCEL: 'Cancel',
      NO_CHANGES: 'No modifications detected in draft.',
    },
    SESSION_DETAILS: {
      TITLE: 'Session Details',
      MEET_PENDING: 'Google Meet link pending...',
      JOIN_MEET: 'Join Google Meet',
      CLOSE: 'Close Window',
    },
  },
} as const;

export type UserMessages = typeof USER_MESSAGES;
