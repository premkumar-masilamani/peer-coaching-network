// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// Flag to tell React 19 that we are running in an act environment
// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../services/avatarCache', () => ({
  getCachedAvatar: vi.fn().mockResolvedValue(null),
  fetchAndCacheAvatar: vi.fn().mockResolvedValue('blob:http://localhost/fake-blob'),
}));

import { Avatar } from '../Avatar';

describe('Avatar component', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
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

  it('renders initials fallback when photo URL is missing', async () => {
    await act(async () => {
      root!.render(
        <Avatar
          src={null}
          name="Premkumar Masilamani"
          email="premkumar@example.com"
          size="sm"
        />
      );
    });

    expect(container?.querySelector('.avatar-initials')?.textContent).toBe('PM');
    expect(container?.querySelector('img')).toBeNull();
  });

  it('renders image when valid photo URL is provided', async () => {
    await act(async () => {
      root!.render(
        <Avatar
          src="https://example.com/avatar.jpg"
          name="Kalaiyarasi Masilamani"
          size="md"
        />
      );
    });

    const img = container?.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('blob:http://localhost/fake-blob');
  });

  it('switches to initials on image loading error (onError)', async () => {
    await act(async () => {
      root!.render(
        <Avatar
          src="https://example.com/broken-avatar.jpg"
          name="Aradhana Premkumar"
          size="lg"
        />
      );
    });

    const img = container?.querySelector('img');
    expect(img).not.toBeNull();

    // Trigger onError on the image
    await act(async () => {
      img?.dispatchEvent(new Event('error'));
    });

    expect(container?.querySelector('img')).toBeNull();
    expect(container?.querySelector('.avatar-initials')?.textContent).toBe('AP');
  });
});
