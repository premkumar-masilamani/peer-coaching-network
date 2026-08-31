import React from 'react';

interface LogoIconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const LogoIcon: React.FC<LogoIconProps> = ({
  size = 36,
  className,
  style,
}) => {
  return (
    <img
      src="/logo.png"
      alt="Peer Coaching Network Logo"
      width={size}
      height={size}
      className={className}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        objectFit: 'contain',
        flexShrink: 0,
        ...style,
      }}
    />
  );
};
