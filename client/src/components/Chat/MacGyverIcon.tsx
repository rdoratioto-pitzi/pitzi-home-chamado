import React from 'react';

interface MacGyverIconProps {
  size?: number;
}

const MacGyverIcon: React.FC<MacGyverIconProps> = ({ size = 64 }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background */}
      <circle cx="32" cy="32" r="30" fill="#4ade80"/>
      
      {/* Robot head */}
      <rect x="20" y="20" width="24" height="20" rx="4" fill="white"/>
      
      {/* Eyes */}
      <circle cx="26" cy="30" r="3" fill="#1f2937"/>
      <circle cx="38" cy="30" r="3" fill="#1f2937"/>
      
      {/* Antenna with wrench */}
      <line x1="32" y1="20" x2="32" y2="14" stroke="white" strokeWidth="2"/>
      <circle cx="32" cy="12" r="2" fill="#fbbf24"/>
      
      {/* Wrench symbol */}
      <path d="M28 42L36 42M32 38L32 46" stroke="#1f2937" strokeWidth="2.5" strokeLinecap="round"/>
      
      {/* Smile */}
      <path d="M26 35Q32 38 38 35" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" fill="none"/>
    </svg>
  );
};

export default MacGyverIcon;
