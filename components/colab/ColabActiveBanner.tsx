"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useColab } from '@/contexts/ColabContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { ArrowRight, LogOut } from 'lucide-react';

export default function ColabActiveBanner() {
  const pathname = usePathname();
  const { isInRoom, room, roomId, leaveRoom } = useColab();
  const { isFullPlayerOpen, isDesktopFullScreen } = usePlayer();

  // Don't show if:
  // 1. User is not in an active room
  // 2. User is already on the /colab page
  // 3. Desktop full screen player or mobile expanded player is currently open
  if (!isInRoom || !room || pathname === '/colab' || isFullPlayerOpen || isDesktopFullScreen) {
    return null;
  }

  const memberCount = Object.keys(room.members || {}).length;

  return (
    <div className="fixed top-16 right-3 md:top-4 md:right-5 z-[50] pointer-events-auto">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#121214]/90 hover:bg-[#18181b] border border-white/10 hover:border-white/20 backdrop-blur-md transition-all shadow-md group">
        <Link 
          href="/colab" 
          className="flex items-center gap-2 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
          title="Return to Colab session"
        >
          {/* Subtle live indicator dot */}
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          
          <span className="font-mono text-zinc-100 font-semibold tracking-wider">{roomId}</span>
          <span className="text-zinc-400 text-[11px] hidden sm:inline">({memberCount} listening)</span>
          <ArrowRight className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
        </Link>

        <span className="h-3 w-px bg-white/10" />

        <button
          onClick={leaveRoom}
          className="text-zinc-500 hover:text-red-400 p-0.5 transition-colors"
          title="Leave Colab session"
        >
          <LogOut className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
