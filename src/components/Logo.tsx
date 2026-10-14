import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = "w-10 h-10", size = 40 }) => {
  return (
    <div className={`relative flex items-center justify-center shrink-0 overflow-hidden rounded-2xl shadow-sm ${className}`} style={{ width: size, height: size }}>
      <img 
        src="/logo.jpg" 
        alt="DerivGo Logo" 
        className="w-full h-full object-cover rounded-2xl"
      />
    </div>
  );
};
