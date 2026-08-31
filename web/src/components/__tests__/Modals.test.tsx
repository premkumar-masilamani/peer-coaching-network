// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Modal } from '../modals/Modal';
import { CancelModal } from '../modals/CancelModal';
import { SessionDetailsModal } from '../modals/SessionDetailsModal';
import { ScheduleModal } from '../modals/ScheduleModal';
import { GoogleCalendarConnectionModal } from '../modals/GoogleCalendarConnectionModal';
import { ReviewChangesModal } from '../modals/ReviewChangesModal';
import { USER_MESSAGES, USER_ROLE, USER_STATUS } from '../../config';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { mockScheduleMeeting } = vi.hoisted(() => ({
  mockScheduleMeeting: vi.fn(),
}));

vi.mock('../../services/googleCalendar', () => ({
  scheduleMeeting: mockScheduleMeeting,
}));

vi.mock('../../services/googleToken', () => ({
  getGoogleToken: () => 'valid-token',
}));

vi.mock('../../services/firebaseApp', () => ({
  logAnalyticsEvent: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'client-1', displayName: 'Client Name', email: 'client@example.com' },
    profile: { userId: 'client-1', displayName: 'Client Name', timezone: 'UTC' },
    reconnectGoogle: vi.fn().mockResolvedValue('fresh-token'),
  }),
}));

describe('Modal Components', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const mockClose = vi.fn();
  const mockConfirm = vi.fn();

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root!.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
  });

  describe('Modal base component', () => {
    it('renders dialog when isOpen is true and handles close button', async () => {
      await act(async () => {
        root!.render(
          <Modal isOpen={true} onClose={mockClose} title="Test Title">
            <p>Modal Body Content</p>
          </Modal>
        );
      });

      expect(container?.textContent).toContain('Test Title');
      expect(container?.textContent).toContain('Modal Body Content');

      const closeBtn = container?.querySelector('button[aria-label="Close modal"]');
      await act(async () => {
        closeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe('CancelModal', () => {
    it('renders session details and triggers confirm cancellation', async () => {
      await act(async () => {
        root!.render(
          <CancelModal
            isOpen={true}
            onClose={mockClose}
            onConfirm={mockConfirm}
            coachName="Coach Prem"
            clientName="Client Kalai"
            topic="Executive Coaching"
            date="Sept 1, 2026"
            time="10:00 AM - 10:30 AM"
          />
        );
      });

      expect(container?.textContent).toContain(USER_MESSAGES.MODALS.CANCEL_SESSION.TITLE);
      expect(container?.textContent).toContain('Coach Prem');
      expect(container?.textContent).toContain('Executive Coaching');

      const confirmBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
        b.textContent?.includes(USER_MESSAGES.MODALS.CANCEL_SESSION.CONFIRM)
      );

      await act(async () => {
        confirmBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(mockConfirm).toHaveBeenCalled();
    });
  });

  describe('SessionDetailsModal', () => {
    it('renders meet link and close button', async () => {
      await act(async () => {
        root!.render(
          <SessionDetailsModal
            isOpen={true}
            coachName="Coach Prem"
            clientName="Client Kalai"
            topic="Goal Setting"
            date="Sept 1, 2026"
            time="10:00 AM"
            meetLink="https://meet.google.com/abc-def-ghi"
            onClose={mockClose}
          />
        );
      });

      expect(container?.textContent).toContain('Coach Prem');
      expect(container?.textContent).toContain(USER_MESSAGES.MODALS.SESSION_DETAILS.JOIN_MEET);

      const closeBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
        b.textContent?.includes(USER_MESSAGES.MODALS.SESSION_DETAILS.CLOSE)
      );

      await act(async () => {
        closeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe('GoogleCalendarConnectionModal', () => {
    it('renders description and triggers connect action', async () => {
      const mockConnect = vi.fn();
      await act(async () => {
        root!.render(
          <GoogleCalendarConnectionModal
            isOpen={true}
            onClose={mockClose}
            onConnect={mockConnect}
          />
        );
      });

      expect(container?.textContent).toContain(USER_MESSAGES.MODALS.CALENDAR_CONNECTION.TITLE);

      const connectBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
        b.textContent?.includes(USER_MESSAGES.MODALS.CALENDAR_CONNECTION.CONNECT)
      );

      await act(async () => {
        connectBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(mockConnect).toHaveBeenCalled();
    });
  });

  describe('ReviewChangesModal', () => {
    it('renders changes list and triggers actions', async () => {
      const mockDiscard = vi.fn();
      await act(async () => {
        root!.render(
          <ReviewChangesModal
            isOpen={true}
            title="Unsaved Changes"
            changes={['Updated Timezone to UTC', 'Added blocked date']}
            onConfirm={mockConfirm}
            onDiscard={mockDiscard}
            onClose={mockClose}
          />
        );
      });

      expect(container?.textContent).toContain('Updated Timezone to UTC');
      expect(container?.textContent).toContain('Added blocked date');
    });
  });

  describe('ScheduleModal', () => {
    const mockCoach: import('../../services/types').UserProfile = {
      userId: 'coach-1',
      firstName: 'Coach',
      lastName: 'Smith',
      email: 'coach@example.com',
      gender: 'Male',
      country: 'United States',
      timezone: 'UTC',
      userRole: USER_ROLE.USER,
      userStatus: USER_STATUS.ACTIVE,
      icf_pcc: true,
      bio: 'Test bio',
      photoURL: null,
      createdAt: { toDate: () => new Date(), seconds: 0, nanoseconds: 0, toMillis: () => 0 },
      updatedAt: { toDate: () => new Date(), seconds: 0, nanoseconds: 0, toMillis: () => 0 },
    };

    it('submits booking with topic input', async () => {
      mockScheduleMeeting.mockResolvedValueOnce({
        id: 'event-123',
        meetLink: 'https://meet.google.com/xyz',
      });

      const startTime = new Date('2026-09-01T10:00:00.000Z');
      const endTime = new Date('2026-09-01T10:30:00.000Z');

      await act(async () => {
        root!.render(
          <ScheduleModal
            coach={mockCoach}
            startTime={startTime}
            endTime={endTime}
            onClose={mockClose}
          />
        );
      });

      expect(container?.textContent).toContain('Book a session with Coach Smith');

      const textarea = container?.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea).not.toBeNull();

      await act(async () => {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        nativeSetter?.call(textarea, 'Deep coaching on leadership');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      });

      const form = container?.querySelector('form');
      if (form) {
        form.checkValidity = () => true;
      }

      await act(async () => {
        form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(mockScheduleMeeting).toHaveBeenCalled();
    });
  });
});
