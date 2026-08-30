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
    iconSize = 32;
    textSize = '1.25rem';
    gap = '0.5rem';
  } else if (size === 'lg') {
    iconSize = 40;
    textSize = '1.5rem';
    gap = '0.75rem';
  } else {
    // 'md' default
    iconSize = 36;
    textSize = '1.4rem';
    gap = '0.75rem';
  }

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap, ...style }}>
      <SolidRookIcon 
        size={iconSize} 
        color="var(--accent-color)" 
        style={{ flexShrink: 0 }}
      />
      <span style={{ fontSize: textSize, fontWeight: 'bold', letterSpacing: '1px', color: 'inherit' }}>Chess</span>
    </div>
  );
}
