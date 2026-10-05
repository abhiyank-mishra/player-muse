"use client";

import React from 'react';
import { Play, Pause, Heart, Music } from 'lucide-react';
import { motion } from 'framer-motion';
import { Song } from '@/lib/types';
import { useCoverTheme } from '@/lib/coverTheme';

interface MobileMiniPlayerProps {
    currentSong: Song | null;
    isPlaying: boolean;
    isLiked: boolean;
    seek: number;
    duration: number;
    onTogglePlay: () => void;
    onNext: () => void;
    onPrev: () => void;
    onLike: (e: React.MouseEvent) => void;
    onExpand: () => void;
    isControlDisabled?: boolean;
    // Touch props for gestures
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
}

export default function MobileMiniPlayer({
    currentSong,
    isPlaying,
    isLiked,
    seek,
    duration,
    onTogglePlay,
    onLike,
    onExpand,
    isControlDisabled,
    onTouchStart,
    onTouchMove,
    onTouchEnd
}: MobileMiniPlayerProps) {
    if (!currentSong) return null;

    const coverUrl = currentSong.image?.[2] || currentSong.image?.[1] || currentSong.image?.[0] || '';
    const theme = useCoverTheme(coverUrl);

    const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (seek / duration) * 100)) : 0;

    return (
        <motion.div 
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          onClick={onExpand}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            background: `linear-gradient(135deg, ${theme.primary}18 0%, rgba(18, 18, 22, 0.88) 50%, rgba(10, 10, 14, 0.94) 100%)`,
            borderColor: `${theme.primary}28`,
            boxShadow: `0 10px 32px -4px rgba(0, 0, 0, 0.75), 0 0 24px -6px ${theme.ambientRgba}`
          }}
          className="md:hidden fixed bottom-[4.75rem] left-3 right-3 max-w-md mx-auto h-[60px] rounded-2xl z-40 flex items-center px-2.5 backdrop-blur-2xl border cursor-pointer select-none overflow-hidden transition-all duration-300 mb-[env(safe-area-inset-bottom)]"
        >
            {/* Subtle ambient light glow spot inside */}
            <div 
              className="absolute -left-6 -top-6 w-28 h-28 rounded-full blur-2xl pointer-events-none opacity-25 transition-all duration-700"
              style={{ background: theme.primary }}
            />

            {/* Album Thumbnail */}
            <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 aspect-square mr-3 bg-neutral-900 border border-white/10 shadow-md flex items-center justify-center relative">
                 {coverUrl ? (
                    <img 
                        src={coverUrl} 
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = '/logo.png';
                        }}
                        alt={currentSong.name} 
                        className="w-full h-full object-cover" 
                    />
                 ) : (
                    <Music className="w-5 h-5 text-neutral-500" />
                 )}
            </div>

            {/* Title & Artist */}
            <div className="flex-1 min-w-0 pr-2 flex flex-col justify-center">
                 <h4 className="text-white font-semibold text-sm truncate leading-tight tracking-tight">
                    {currentSong.name}
                 </h4>
                 <p className="text-neutral-400 text-[11px] truncate leading-tight mt-0.5 font-medium">
                    {currentSong.artist}
                 </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 relative z-10 shrink-0">
                 {/* Like Button */}
                 <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onLike(e); 
                  }}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/[0.08] active:scale-75 transition-all"
                  aria-label={isLiked ? "Unlike song" : "Like song"}
                >
                  <Heart 
                    className={`w-5 h-5 transition-all ${isLiked ? 'fill-rose-500 text-rose-500 scale-105' : 'text-neutral-400'}`} 
                    strokeWidth={isLiked ? 2.5 : 2}
                  />
                </button>

                 {/* Play/Pause Button */}
                 <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (!isControlDisabled) onTogglePlay(); 
                    }}
                    disabled={isControlDisabled}
                    className={`w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 active:scale-90 flex items-center justify-center text-white border border-white/10 shadow-sm transition-all ${
                      isControlDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''
                    }`}
                    title={isControlDisabled ? "Host controls playback" : (isPlaying ? "Pause" : "Play")}
                 >
                     {isPlaying ? (
                       <Pause className="w-4 h-4 fill-white text-white" />
                     ) : (
                       <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                     )}
                 </button>
            </div>

            {/* Progress Bar (at bottom with subtle cover theme gradient) */}
            <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-white/[0.08] overflow-hidden rounded-b-2xl">
                <div 
                  className="h-full transition-all duration-150 rounded-r-full" 
                  style={{ 
                    width: `${progressPercent}%`,
                    background: theme.gradient || '#ffffff'
                  }}
                />
            </div>
        </motion.div>
    );
}
