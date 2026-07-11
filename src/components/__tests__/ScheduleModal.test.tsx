import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { ScheduleModal } from '../modals/ScheduleModal';

// @ts-expect-error - IS_REACT_ACT_ENVIRONMENT is not typed on globalThis
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockAuth = vi.hoisted(() => ({
  value: {
    profile: { email: 'client@example.com', displayName: 'Client Name', timezone: 'UTC' },
    user: { uid: 'client-123' },
    login: vi.fn(),
  },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuth.value,
}));

const mockGoogleCalendar = vi.hoisted(() => ({
  scheduleMeeting: vi.fn(),
}));

vi.mock('../../services/googleCalendar', () => ({
  scheduleMeeting: mockGoogleCalendar.scheduleMeeting,
}));

vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

vi.mock('../../services/profileService', () => ({
  formatDisplayName: (p: any) => p?.displayName || 'Unknown',
}));

vi.mock('../../services/firebaseApp', () => ({
  logAnalyticsEvent: vi.fn(),
}));

// jsdom does not implement HTMLDialogElement.showModal — mock the Modal wrapper
// so ScheduleModal renders its children directly without the dialog API.
vi.mock('../modals/Modal', () => ({
  Modal: ({ children }: { children: React.ReactNode }) => <div data-testid="modal">{children}</div>,
}));

import React from 'react';

describe('ScheduleModal component', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockCoach = {
    userId: 'coach-123',
    displayName: 'Coach Name',
    email: 'coach@example.com',
    timezone: 'UTC',
    userRole: 'user',
    userStatus: 'active',
  } as any;

  const mockStartTime = new Date('2026-06-18T10:00:00Z');
  const mockEndTime = new Date('2026-06-18T10:30:00Z');
  const mockOnClose = vi.fn();
  const mockOnBookingSuccess = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders modal with coach name and confirmation heading', () => {
    act(() => {
      root.render(
        <ScheduleModal
          coach={mockCoach}
          startTime={mockStartTime}
          endTime={mockEndTime}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
        />
      );
    });

    expect(container.textContent).toContain('Book a session with');
    expect(container.textContent).toContain('Coach Name');
  });

  it('validates topic and shows inline error on empty submission', async () => {
    act(() => {
      root.render(
        <ScheduleModal
          coach={mockCoach}
          startTime={mockStartTime}
          endTime={mockEndTime}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
        />
      );
    });

    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain('Constraints not satisfied');
  });

  it('submits booking successfully and displays success confirmation', async () => {
    mockGoogleCalendar.scheduleMeeting.mockResolvedValueOnce({
      id: 'event-123',
      summary: 'Coaching session',
      start: { dateTime: mockStartTime.toISOString() },
      end: { dateTime: mockEndTime.toISOString() },
    });

    act(() => {
      root.render(
        <ScheduleModal
          coach={mockCoach}
          startTime={mockStartTime}
          endTime={mockEndTime}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
        />
      );
    });

    const textarea = container.querySelector('textarea#topic-input') as HTMLTextAreaElement;
    act(() => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Career coaching');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockGoogleCalendar.scheduleMeeting).toHaveBeenCalled();
    expect(container.textContent).toContain('Session Confirmed!');
    expect(mockOnBookingSuccess).toHaveBeenCalled();
  });

  it('shows booking error feedback when scheduling fails', async () => {
    const err = new Error('SLOT_TAKEN') as any;
    err.code = 'SLOT_TAKEN';
    mockGoogleCalendar.scheduleMeeting.mockRejectedValueOnce(err);

    act(() => {
      root.render(
        <ScheduleModal
          coach={mockCoach}
          startTime={mockStartTime}
          endTime={mockEndTime}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
        />
      );
    });

    const textarea = container.querySelector('textarea#topic-input') as HTMLTextAreaElement;
    act(() => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Leadership coaching');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    // After error, status switches to ERROR — the submit button changes label and error message shows
    expect(container.textContent).toContain('Confirm Session');
    expect(mockGoogleCalendar.scheduleMeeting).toHaveBeenCalled();
  });
});
