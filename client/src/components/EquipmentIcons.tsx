import React from 'react';

export type EquipmentType = 'fins' | 'zoomers' | 'paddles' | 'pullbuoy' | 'snorkel';

interface EquipmentIconProps {
  type: EquipmentType;
  className?: string;
}

export const EquipmentIcons: React.FC<EquipmentIconProps> = ({ type, className = "w-6 h-6" }) => {
  switch (type) {
    case 'fins':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M6 3l2 16h8l2-16z" />
          <path d="M10 3v16M14 3v16" strokeOpacity="0.5" />
        </svg>
      );
    case 'zoomers':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M7 6l1 10h8l1-10z" />
          <path d="M10 6v10M14 6v10" strokeOpacity="0.5" />
        </svg>
      );
    case 'paddles':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <rect x="5" y="5" width="14" height="14" rx="3" />
          <circle cx="9" cy="9" r="0.5" fill="currentColor" />
          <circle cx="15" cy="9" r="0.5" fill="currentColor" />
          <circle cx="9" cy="15" r="0.5" fill="currentColor" />
          <circle cx="15" cy="15" r="0.5" fill="currentColor" />
        </svg>
      );
    case 'pullbuoy':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M9 7c0-2 6-2 6 0s-6 4-6 6 6 2 6 4s-6 2-6 0" />
          <path d="M9 7v10M15 7v10" strokeOpacity="0.3" />
        </svg>
      );
    case 'snorkel':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M14 3v12c0 3-2 5-5 5H8" />
          <path d="M13 6h3" />
        </svg>
      );
    default:
      return null;
  }
};


