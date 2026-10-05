"use client";
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Trash2 } from 'lucide-react';
import { Song } from '@/lib/types';

interface SwipeableSongItemProps {
  song: Song;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onSwipeRight?: () => void; // Usually "Add to Queue"
  onDelete?: () => void;     // Optional delete action
  size?: number | string;    // File size for downloads
}

// Visual Equalizer Component (Mini)
function VisualEqualizer() {
    return (
        <div className="flex items-end gap-[2px] h-3">
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    animate={{ 
                        height: i === 0 ? [4, 12, 6, 10, 4] : i === 1 ? [8, 4, 12, 8, 8] : [6, 10, 4, 12, 6] 
                    }}
                    transition={{ 
                        repeat: Infinity, 
                        duration: i === 0 ? 0.8 : i === 1 ? 0.6 : 0.7, 
                        ease: "easeInOut" 
                    }}
                    className="w-[3px] bg-purple-400 rounded-full"
                />
            ))}
        </div>
    );
}

export default function SwipeableSongItem({ 
    song, 
    index, 
    isCurrent,
    isPlaying,
    onPlay, 
    onSwipeRight,
    onDelete,
    size
}: SwipeableSongItemProps) {
    const [msg, setMsg] = useState('');
    const isDragging = useRef(false);

    const handleDragEnd = (_: any, info: any) => {
        const SWIPE_THRESHOLD = 50; 
        
        if (Math.abs(info.offset.x) > SWIPE_THRESHOLD) {
            // Right Swipe -> Add to Queue
            if (info.offset.x > 0 && onSwipeRight) {
                onSwipeRight();
                setMsg('Added to Queue');
                setTimeout(() => setMsg(''), 2000);
            }
        }
        
        setTimeout(() => {
            isDragging.current = false;
        }, 100);
    };

    const formatSize = (bytes: number | string | undefined) => {
        if (!bytes) return '';
        if (typeof bytes === 'string') return bytes;
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Disable Framer Motion drag on touch devices to preserve native scrolling
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

    return (
        <motion.div
            drag={isTouchDevice ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.1, right: 0.5 }}
            onDragStart={() => { isDragging.current = true; }}
            onDragEnd={handleDragEnd}
            dragSnapToOrigin
            onClick={() => {
                 if (isDragging.current) return;
                 onPlay();
            }}
            // Standardized padding and styling
            className={`relative flex items-center gap-3 p-3 py-4 md:gap-4 md:px-6 md:py-4 transition-colors border-b border-white/5 md:border-transparent cursor-pointer group 
                ${isCurrent ? 'bg-purple-900/20' : 'hover:bg-white/5 bg-black'}`}
        >
            {/* Feedback Overlay */}
            <AnimatePresence>
                {msg && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 bg-green-500/90 flex items-center justify-center md:rounded-xl pointer-events-none"
                    >
                        <span className="font-bold text-white flex items-center gap-2">
                            <Play className="w-5 h-5 fill-white" /> {msg}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Queue Indicator (Swipe Hint - Right Side) */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity md:rounded-l-xl" />
            
            {/* Active Indicator Bar (Left Side) */}
            {isCurrent && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 block md:rounded-l-xl animate-pulse" />
            )}

            {/* Index (Desktop Only) */}
            <span className={`w-6 text-center text-sm font-medium hidden md:block ${isCurrent ? 'text-purple-400' : 'text-gray-500'}`}>
                {isCurrent && isPlaying ? (
                    <Play className="w-4 h-4 mx-auto fill-purple-400" />
                ) : (
                    index + 1
                )}
            </span>

            {/* Album Art */}
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden relative flex-shrink-0 shadow-lg bg-zinc-800">
                <img 
                    src={(() => { const raw = Array.isArray(song.image) ? song.image[0] : song.image; return typeof raw === 'string' && raw.trim() !== '' ? raw : '/placeholder.png'; })()}
                    alt={song.name}
                    className={`w-full h-full object-cover ${isCurrent ? 'opacity-80' : ''}`}
                />
                {isCurrent && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                         <VisualEqualizer />
                    </div>
                )}
                <div className={`absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity ${isCurrent ? 'hidden' : ''}`}>
                    <Play className="w-6 h-6 fill-white text-white" />
                </div>
            </div>
            
            {/* Song Info */}
            <div className="flex-1 min-w-0 px-2">
                <div className={`font-medium text-base truncate mb-1 ${isCurrent ? 'text-purple-400' : 'text-white'}`}>
                    {song.name}
                </div>
                <div className="text-gray-400 text-sm truncate">{song.artist}</div>
            </div>

            {/* Metadata (Mobile: Compact, Desktop: Spread) */}
            <div className="text-xs text-right text-gray-500 flex flex-col items-end gap-1.5 min-w-[70px]">
                <span className={`${isCurrent ? 'text-purple-400' : 'text-gray-300'} text-sm font-medium`}>
                    {formatDuration(song.duration)}
                </span>
                {size && (
                    <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-gray-400 font-mono tracking-tighter">
                        {formatSize(size)}
                    </span>
                )}
            </div>

            {/* Delete Button (Optional) */}
            {onDelete && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-2 text-gray-500 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100 transition-all hover:bg-white/10 rounded-full" 
                    title="Delete"
                >
                    <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                </button>
            )}
        </motion.div>
    );
}
