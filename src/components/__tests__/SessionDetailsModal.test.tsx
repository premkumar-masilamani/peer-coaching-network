import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { SessionDetailsModal } from '../modals/SessionDetailsModal';

// @ts-expect-error - IS_REACT_ACT_ENVIRONMENT is not typed on globalThis
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom does not implement HTMLDialogElement.showModal — mock the Modal wrapper
// so SessionDetailsModal renders its children directly without the dialog API.
vi.mock('../modals/Modal', () => ({
  Modal: ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <div data-testid="modal">
      {title && <h2>{title}</h2>}
      {children}
    </div>
  ),
}));

import React from 'react';

describe('SessionDetailsModal component', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockProps = {
    isOpen: true,
    coachName: 'John Doe',
    clientName: 'Jane Smith',
    topic: 'Career Growth',
    date: 'Wednesday, June 18, 2026',
    time: '10:00 AM - 10:30 AM',
    onClose: vi.fn(),
  };

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

  it('does not render when isOpen is false', () => {
    act(() => {
      root.render(<SessionDetailsModal {...mockProps} isOpen={false} />);
    });
    expect(container.children.length).toBe(0);
  });

  it('renders all session details correctly', () => {
    act(() => {
      root.render(<SessionDetailsModal {...mockProps} />);
    });

    expect(container.textContent).toContain('Session Details');
    expect(container.textContent).toContain('Coach: John Doe');
    expect(container.textContent).toContain('Client: Jane Smith');
    expect(container.textContent).toContain('Topic: Career Growth');
    expect(container.textContent).toContain('Date: Wednesday, June 18, 2026');
    expect(container.textContent).toContain('Time: 10:00 AM - 10:30 AM');
  });

  it('does not render Google Meet button if meetLink is not provided or null', () => {
    act(() => {
      root.render(<SessionDetailsModal {...mockProps} meetLink={null} />);
    });

    expect(container.textContent).not.toContain('Join Google Meet');
  });

  it('renders Google Meet button if a valid meetLink is provided', () => {
    const validMeetLink = 'https://meet.google.com/abc-defg-hij';
    act(() => {
      root.render(<SessionDetailsModal {...mockProps} meetLink={validMeetLink} />);
    });

    expect(container.textContent).toContain('Join Google Meet');
    const linkElement = container.querySelector('a');
    expect(linkElement).not.toBeNull();
    expect(linkElement?.getAttribute('href')).toBe(validMeetLink);
  });

  it('does NOT render Google Meet button if an unsafe/malicious meetLink is provided', () => {
    const maliciousMeetLink = 'javascript:alert("XSS")';
    act(() => {
      root.render(<SessionDetailsModal {...mockProps} meetLink={maliciousMeetLink} />);
    });

    expect(container.textContent).not.toContain('Join Google Meet');
  });

  it('does NOT render Google Meet button if meetLink is on an invalid domain', () => {
    const invalidDomainLink = 'https://meet.google.com.attacker.com/abc';
    act(() => {
      root.render(<SessionDetailsModal {...mockProps} meetLink={invalidDomainLink} />);
    });

    expect(container.textContent).not.toContain('Join Google Meet');
  });

  it('calls onClose when Close Window button is clicked', () => {
    act(() => {
      root.render(<SessionDetailsModal {...mockProps} />);
    });

    const closeButton = container.querySelector('button');
    expect(closeButton).not.toBeNull();
    expect(closeButton?.textContent).toBe('Close Window');

    act(() => {
      closeButton?.click();
    });

    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });
});
