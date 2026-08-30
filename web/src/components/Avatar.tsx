import React, { useState, useEffect } from 'react';
import { getInitials, getAvatarColor } from '../utils/avatarHelpers';
import { sanitizeHttpsUrl } from '../utils/url';
import { getCachedAvatar, fetchAndCacheAvatar } from '../services/avatarCache';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

export interface AvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: AvatarSize;
  className?: string;
  style?: React.CSSProperties;
  border?: string;
  alt?: string;
}

const SIZE_MAP: Record<string, { size: number; fontSize: number }> = {
  xs: { size: 24, fontSize: 10 },
  sm: { size: 38, fontSize: 13 },
  md: { size: 48, fontSize: 16 },
  lg: { size: 80, fontSize: 24 },
  xl: { size: 120, fontSize: 36 },
};

const resolveDimensions = (sizeProp?: AvatarSize): { dimension: number; fontSize: number } => {
  if (typeof sizeProp === 'number') {
    return { dimension: sizeProp, fontSize: Math.max(10, Math.round(sizeProp * 0.35)) };
  }
  const mapped = SIZE_MAP[sizeProp || 'sm'] || SIZE_MAP.sm;
  return { dimension: mapped.size, fontSize: mapped.fontSize };
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  email,
  size = 'sm',
  className = '',
  style = {},
  border,
  alt,
}) => {
  const safeUrl = sanitizeHttpsUrl(src);
  const [prevUrl, setPrevUrl] = useState<string | undefined>(safeUrl);
  const [imageError, setImageError] = useState(false);
  const [cachedSrc, setCachedSrc] = useState<string | null>(null);

  // Adjust during render when URL changes
  if (prevUrl !== safeUrl) {
    setPrevUrl(safeUrl);
    setImageError(false);
    setCachedSrc(null);
  }

  const initials = getInitials(name || email || '');
  const bgColor = getAvatarColor(name || email || '');
  const { dimension, fontSize } = resolveDimensions(size);

  // Attempt local cache lookup and prefetch
  useEffect(() => {
    if (!safeUrl) return;

    let isMounted = true;
    getCachedAvatar(safeUrl)
      .then((cached) => {
        if (cached && isMounted) {
          setCachedSrc(cached);
        }
      })
      .catch(() => {});

    fetchAndCacheAvatar(safeUrl)
      .then((cachedBlobUrl) => {
        if (cachedBlobUrl && isMounted) {
          setCachedSrc(cachedBlobUrl);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [safeUrl]);

  const resolvedSrc = cachedSrc || safeUrl;

  const containerStyle: React.CSSProperties = {
    width: `${dimension}px`,
    height: `${dimension}px`,
    minWidth: `${dimension}px`,
    minHeight: `${dimension}px`,
    borderRadius: '50%',
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    userSelect: 'none',
    border: border || 'none',
    ...style,
  };

  // If there's an image and no load error, render the <img>
  if (resolvedSrc && !imageError) {
    return (
      <span style={containerStyle} className={`avatar-container ${className}`.trim()}>
        <img
          src={resolvedSrc}
          alt={alt || name || 'User avatar'}
          onError={() => setImageError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </span>
    );
  }

  // Fallback: Initials badge with deterministic HSL background
  return (
    <span
      style={{
        ...containerStyle,
        backgroundColor: bgColor,
        color: '#ffffff',
        fontWeight: 700,
        fontSize: `${fontSize}px`,
        letterSpacing: '0.02em',
        fontFamily: 'var(--font-family)',
      }}
      className={`avatar-container avatar-initials ${className}`.trim()}
      aria-label={alt || name || 'User avatar'}
    >
      {initials}
    </span>
  );
};
