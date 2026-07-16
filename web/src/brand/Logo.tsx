import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ size = 40, className = '', showText = true }) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 108 108"
        className="shrink-0"
      >
        <path fill="#1D6E5A" d="M18,16h72a16,16 0,0 1,16 16v44a16,16 0,0 1,-16 16H18a16,16 0,0 1,-16 -16V32a16,16 0,0 1,16 -16z" />
        <path fill="#53C49E" fillOpacity="0.42" d="M8,76c18,-26 40,-36 92,-49v49a10,10 0,0 1,-10 10H18a10,10 0,0 1,-10 -10z" />
        <path fill="#F8F7F2" d="M24,72l18,-22 14,15 9,-11 19,18z" />
        <circle cx="72" cy="34" r="9" fill="#E9C46A" />
        <path fill="#FFFFFF" fillOpacity="0.36" d="M22,24h42a5,5 0,0 1,0 10H22a5,5 0,0 1,0 -10z" />
      </svg>
      {showText && (
        <span className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Noto Serif SC', serif" }}>
          Memories
        </span>
      )}
    </div>
  );
};

export default Logo;