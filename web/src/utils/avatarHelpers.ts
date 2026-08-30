/**
 * Extracts 1-2 character uppercase initials from a user's display name or email.
 */
export const getInitials = (nameOrEmail?: string | null): string => {
  if (!nameOrEmail) return '?';

  const trimmed = nameOrEmail.trim();
  if (!trimmed) return '?';

  // If it's an email address, extract initials from the username part
  if (trimmed.includes('@')) {
    const username = trimmed
      .split('@')[0]
      .replace(/[._-]/g, ' ')
      .replace(/\d+/g, '')
      .trim();
    return getInitials(username || trimmed.split('@')[0]);
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  const firstChar = parts[0][0] || '';
  const lastChar = parts[parts.length - 1][0] || '';
  return (firstChar + lastChar).toUpperCase();
};

/**
 * Deterministic color palette for avatar backgrounds matching the PCN theme.
 */
const AVATAR_PALETTE = [
  'hsl(173, 84%, 30%)', // Primary Teal
  'hsl(142, 71%, 36%)', // Emerald
  'hsl(215, 65%, 44%)', // Slate / Indigo
  'hsl(260, 60%, 48%)', // Violet
  'hsl(340, 65%, 46%)', // Rose
  'hsl(28, 85%, 46%)',  // Amber / Warm Orange
  'hsl(190, 80%, 34%)', // Cyan
  'hsl(280, 55%, 44%)', // Purple
];

/**
 * Returns a consistent, deterministic HSL color for an avatar based on name or email.
 */
export const getAvatarColor = (identifier?: string | null): string => {
  if (!identifier) return AVATAR_PALETTE[0];

  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = (hash << 5) - hash + identifier.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
};
