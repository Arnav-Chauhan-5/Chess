import React from 'react';

const SolidRookIcon = ({ size, color, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M4 19h16v3H4z M5 16h14l1 3H4z M7 16L5 8V4h3v4h2V4h4v4h2V4h3v4l-2 8z" />
  </svg>
);

export default function Logo({ size = 'md', className = '', style = {} }) {
  let iconSize, textSize, gap;

  if (size === 'sm') {
    iconSize = 28;
    textSize = '1.1rem';
    gap = '8px';
  } else if (size === 'lg') {
    iconSize = 36;
    textSize = '1.4rem';
    gap = '10px';
  } else {
    // 'md' default
    iconSize = 32;
    textSize = '1.25rem';
    gap = '8px';
  }

  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap, ...style }}
    >
      <SolidRookIcon
        size={iconSize}
        color="var(--on-surface)"
        style={{ flexShrink: 0 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{
          fontSize: textSize,
          fontWeight: '700',
          letterSpacing: '-0.01em',
          color: 'var(--on-surface)',
          fontFamily: 'var(--font-sans)',
        }}>Chess</span>
        <span style={{
          fontSize: '10px',
          fontWeight: '500',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--on-surface-variant)',
          fontFamily: 'var(--font-sans)',
          marginTop: '1px',
        }}>Professional Platform</span>
      </div>
    </div>
  );
}
