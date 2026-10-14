import React, { useEffect } from 'react';
import { Logo } from './Logo';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div 
      onClick={onFinish}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 select-none p-6 cursor-pointer"
      title="Tap to continue"
    >
      <div className="relative flex items-center justify-center pointer-events-none">
        {/* Spinning Outer Ring */}
        <div className="absolute -inset-12 rounded-full border-4 border-dashed border-blue-500 animate-spin" style={{ animationDuration: '4s' }}></div>
        <div className="absolute -inset-6 rounded-full border-2 border-blue-200"></div>
        
        {/* Logo */}
        <div className="relative z-10 transform scale-125 shadow-2xl rounded-3xl overflow-hidden pointer-events-auto opacity-100">
          <Logo size={96} />
        </div>
      </div>
    </div>
  );
};
