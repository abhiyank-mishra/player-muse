"use client";

import React from 'react';
import { ChevronLeft } from 'lucide-react';

interface BackNavigationProps {
  label: string;
  onClick: () => void;
}

export default function BackNavigation({ label, onClick }: BackNavigationProps) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
    >
      <ChevronLeft className="w-6 h-6" />
      <span className="text-base font-medium">{label}</span>
    </button>
  );
}
