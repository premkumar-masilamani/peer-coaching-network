/**
 * Centralized registry of all user-facing validation errors, alerts,
 * toasts, and modal descriptions to eliminate magic strings in UI files.
 */
export const USER_MESSAGES = {
  TOASTS: {
    CANCEL_SESSION_FAILED: 'Could not cancel this session. Please try again in a moment.',
  },
  SYSTEM: {
    SOMETHING_WENT_WRONG: 'Something went wrong',
    UNEXPECTED_ERROR_RELOAD: 'We ran into a small problem. Refreshing the page usually fixes it.',
    RELOAD_BUTTON: 'Refresh Page',
    CONFIG_ERROR_TITLE: 'Unable to start the website',
    CONFIG_ERROR_DESC: 'The website needs a quick setup fix before it can open. Please contact support for help.',
  },
  AUTH: {
    INVALID_GOOGLE_SIGNIN: 'We could not get your name or email from Google. Please try signing in again.',
  },
  AVAILABILITY: {
    VALIDATION_INVALID_TIMES: 'Please make sure every time slot has both a start and finish time.',
    VALIDATION_TIME_ORDER: 'The finish time must be after the start time.',
    SAVE_FAILED: 'Could not save your available hours. Please try again.',
    SAVE_SUCCESS: 'Your available hours have been saved!',
  },
  PROFILE: {
    SAVE_FAILED: 'Could not update your profile. Please try again.',
    SAVE_SUCCESS: 'Your profile has been updated!',
  },
  BOOKING: {
    TOPIC_REQUIRED: 'Please write what you would like to discuss before booking.',
    CALENDAR_CONNECTION_REQUIRED: 'Please reconnect your Google Calendar to continue.',
    GOOGLE_CALENDAR_EXPIRED: 'Your Google Calendar is disconnected. Please reconnect it to continue.',
  },
  MODALS: {
    CANCEL_SESSION: {
      TITLE: 'Cancel this session?',
      DESCRIPTION: 'Are you sure? This will take the meeting off your Google Calendar and open the time slot for others.',
      CONFIRM: 'Yes, Cancel Session',
      CANCEL: 'Keep Session',
      CANCELLING: 'Cancelling...',
    },
    CALENDAR_CONNECTION: {
      TITLE: 'Connect Your Google Calendar',
      DESCRIPTION: 'To book and manage sessions, please connect your Google Calendar. This lets us automatically add meetings to your Google Calendar.',
      CONNECT: 'Connect Google Calendar',
      CONNECTING: 'Connecting...',
    },
    REVIEW_CHANGES: {
      TITLE: 'Review Your Changes',
      CONFIRM: 'Save Changes',
      DISCARD: 'Undo Changes',
      CANCEL: 'Go Back',
      NO_CHANGES: 'You have not made any changes yet.',
    },
    SESSION_DETAILS: {
      TITLE: 'Session Details',
      MEET_PENDING: 'Creating your video link...',
      JOIN_MEET: 'Join Video Call',
      CLOSE: 'Close',
    },
  },
} as const;

export type UserMessages = typeof USER_MESSAGES;
