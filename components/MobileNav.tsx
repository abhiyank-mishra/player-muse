"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Radio } from 'lucide-react';
import { useColab } from '@/contexts/ColabContext';

export default function MobileNav() {
  const pathname = usePathname();
  const { isInRoom } = useColab();

  const links = [
    { name: 'Home', icon: Home, href: '/' },
    { name: 'Search', icon: Search, href: '/search' },
    { name: 'Colab', icon: Radio, href: '/colab', isColab: true },
  ];

  return (
    <div className="md:hidden fixed bottom-3 left-4 right-4 max-w-sm mx-auto h-14 bg-[#0f0f12]/80 backdrop-blur-2xl border border-white/10 rounded-full z-40 px-2 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.7)] mb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-full gap-1">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 rounded-full transition-all duration-200 relative ${
                isActive 
                  ? 'text-white bg-white/[0.12] shadow-sm' 
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <link.icon 
                  className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-105 text-white' : 'text-neutral-400'}`} 
                  strokeWidth={isActive ? 2.2 : 1.75}
                />
                {link.isColab && isInRoom && (
                  <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse border border-black" />
                )}
              </div>
              <span className={`text-[10px] tracking-wide transition-colors mt-0.5 ${isActive ? 'font-semibold text-white' : 'font-medium text-neutral-400'}`}>
                {link.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
