import React from 'react';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | number;
  color?: string;
  className?: string;
  fullScreen?: boolean;
}

export default function Spinner({ 
  size = 'md', 
  color = 'text-purple-500', 
  className = '',
  fullScreen = false
}: SpinnerProps) {
  
  const sizeMap = {
    sm: 16,
    md: 24,
    lg: 32
  };

  const pixelSize = typeof size === 'number' ? size : sizeMap[size];

  const spinner = (
    <Loader2 
      size={pixelSize} 
      className={`animate-spin ${color} ${className}`} 
    />
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black/90 fixed inset-0 z-50">
        {spinner}
      </div>
    );
  }

  return (
    <div className={`flex justify-center items-center ${className.includes('p-') || className.includes('m-') ? '' : 'p-4'}`}>
      {spinner}
    </div>
  );
}
