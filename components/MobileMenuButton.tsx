"use client";

import React from 'react';
import { Menu } from 'lucide-react';
import { useUI } from '@/contexts/UIContext';
import { usePathname } from 'next/navigation';

export default function MobileMenuButton() {
  const { toggleSidebar } = useUI();
  const pathname = usePathname();

  // Show only on home page
  const isHomePage = pathname === '/';

  if (!isHomePage) return null;

  return (
    <button 
      onClick={toggleSidebar}
      className="md:hidden fixed top-4 right-4 z-[60] p-3 bg-black/80 backdrop-blur-md border border-white/10 rounded-full text-gray-300 shadow-lg hover:bg-purple-600/20 hover:text-purple-400 hover:border-purple-500/30 active:scale-95 transition-all"
      style={{ position: 'fixed' }}
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}
