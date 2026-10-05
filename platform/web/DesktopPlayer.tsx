"use client";

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
    Play, 
    Pause, 
    SkipBack, 
    SkipForward, 
    Volume2, 
    VolumeX,
    Repeat, 
    Shuffle, 
    Maximize2, 
    Heart, 
    PlusCircle, 
    Download, 
    CheckCircle, 
    Music, 
    Crown,
    ListMusic
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Song } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import AddToPlaylistModal from '@/reusable/ui/modals/AddToPlaylistModal';
import { useCoverTheme } from '@/lib/coverTheme';

interface DesktopPlayerProps {
    currentSong: Song;
    isPlaying: boolean;
    isLiked: boolean;
    seek: number;
    duration: number;
    volume: number;
    isShuffle: boolean;
    repeatMode: 'off' | 'one' | 'all';
    localSeek: number;
    playlists: any[]; // Added
    showPlaylistsModal: boolean; // Added
    addingToId: string | null; // Added
    isDownloaded: boolean; // Added
    downloading: boolean;
    downloadPercent: number;
    canDownload: boolean; // Added for whitelist check
    isPro: boolean; // Added
    onTogglePlay: () => void;
    onNext: () => void;
    onPrev: () => void;
    onSeekStart: () => void; // Added
    onSeekChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSeekCommit: () => void;
    onVolumeChange: (vol: number) => void;
    onToggleShuffle: () => void;
    onToggleRepeat: () => void;
    onLike: (e: React.MouseEvent) => void;
    onPlaylistClick: (e: React.MouseEvent) => void; // Added
    onAddToPlaylist: (id: string, e: React.MouseEvent) => void;
    onClosePlaylist: () => void; // Added
    onDownload: (e: React.MouseEvent) => void;
    isControlDisabled?: boolean;
    onToggleFullScreen: () => void;
    isQueueOpen?: boolean;
    onToggleQueue?: () => void;
    getCurrentTime?: () => number;
}

export default function DesktopPlayer({
    currentSong,
    isPlaying,
    isLiked,
    seek,
    duration,
    volume,
    isShuffle,
    repeatMode,
    localSeek,
    playlists,
    showPlaylistsModal,
    addingToId,
    isDownloaded,
    downloading,
    downloadPercent,
    canDownload,
    isPro,
    onTogglePlay,
    onNext,
    onPrev,
    onSeekStart,
    onSeekChange,
    onSeekCommit,
    onVolumeChange,
    onToggleShuffle,
    onToggleRepeat,
    onLike,
    onPlaylistClick,
    onAddToPlaylist,
    onClosePlaylist,
    onDownload,
    isControlDisabled,
    onToggleFullScreen,
    isQueueOpen,
    onToggleQueue,
    getCurrentTime
}: DesktopPlayerProps) {
    
    // Dynamic cover art theme extraction
    const coverUrl = useMemo(() => {
        const img = currentSong?.image?.[0];
        return typeof img === 'string' && img.trim() !== '' ? img : undefined;
    }, [currentSong?.image]);

    const theme = useCoverTheme(coverUrl);

    // High-precision smooth playhead state (60fps rAF loop)
    const [realtimeSeek, setRealtimeSeek] = useState(localSeek);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [hoverPercent, setHoverPercent] = useState<number | null>(null);
    const [hoverTime, setHoverTime] = useState<number | null>(null);
    const [hoverPos, setHoverPos] = useState<number>(0);
    const progressBarRef = useRef<HTMLDivElement>(null);

    // Smooth continuous playhead rAF loop polling audio engine directly
    useEffect(() => {
        if (!isPlaying || !getCurrentTime || isScrubbing) {
            setRealtimeSeek(localSeek);
            return;
        }

        let frameId: number;
        let lastReported = -1;

        const updateTick = () => {
            const exactPos = getCurrentTime();
            if (exactPos !== undefined && exactPos >= 0 && Math.abs(exactPos - lastReported) >= 0.015) {
                lastReported = exactPos;
                setRealtimeSeek(exactPos);
            }
            frameId = requestAnimationFrame(updateTick);
        };
        frameId = requestAnimationFrame(updateTick);
        return () => cancelAnimationFrame(frameId);
    }, [isPlaying, getCurrentTime, isScrubbing, localSeek]);

    useEffect(() => {
        if (!isPlaying || isScrubbing) {
            setRealtimeSeek(localSeek);
        }
    }, [localSeek, isPlaying, isScrubbing]);

    const displaySeek = isScrubbing ? localSeek : (isPlaying && getCurrentTime ? realtimeSeek : localSeek);
    const progressPercent = Math.min(100, Math.max(0, (displaySeek / (duration || 1)) * 100));

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressBarRef.current || !duration) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const pct = (offsetX / rect.width) * 100;
        setHoverPercent(pct);
        setHoverTime((pct / 100) * duration);
        // Clamp tooltip badge so it never clips off the container
        const clampedPos = Math.max(22, Math.min(rect.width - 22, offsetX));
        setHoverPos(clampedPos);
    };

    const handleMouseLeave = () => {
        setHoverPercent(null);
        setHoverTime(null);
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25 }}
            className="hidden md:flex fixed bottom-6 left-72 right-8 h-20 bg-[#09090b]/90 backdrop-blur-2xl border border-white/10 z-[80] px-6 items-center justify-between shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] rounded-2xl transition-[border-color,box-shadow] duration-700"
            style={{
                borderColor: `${theme.primary}2e`,
                boxShadow: `0 20px 50px -12px rgba(0,0,0,0.7), 0 0 35px -8px ${theme.ambientRgba}`
            }}
        >
            {/* Dynamic Ambient Theme Mesh Glow */}
            <div 
                className="absolute inset-0 rounded-2xl pointer-events-none transition-all duration-1000 overflow-hidden"
                style={{
                    background: `
                        radial-gradient(circle at 10% 50%, ${theme.glowRgba} 0%, transparent 45%),
                        radial-gradient(circle at 85% 50%, ${theme.ambientRgba} 0%, transparent 55%),
                        linear-gradient(to right, ${theme.primary}12, transparent 50%, ${theme.accent}12)
                    `,
                    opacity: 0.45
                }}
            />

            {/* 1. Left Section: Track Info & Action Buttons */}
            <div className="relative z-10 flex items-center gap-3 shrink-0 min-w-0 max-w-[340px]">
                <div className="w-12 h-12 rounded-xl overflow-hidden relative group shadow-md bg-white/5 flex items-center justify-center shrink-0 aspect-square border border-white/5">
                    {currentSong.image?.[0] ? (
                        <img 
                            src={typeof currentSong.image?.[0] === 'string' && currentSong.image[0].trim() !== '' ? currentSong.image[0] : '/logo.png'} 
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = '/logo.png';
                            }}
                            alt={currentSong.name} 
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <Music className="w-6 h-6 text-gray-500" />
                    )}
                </div>
                <div className="flex flex-col min-w-0 pr-1">
                    <h4 className="text-white font-semibold text-sm truncate max-w-[130px] xl:max-w-[180px]" title={currentSong.name}>
                        {currentSong.name}
                    </h4>
                    <p className="text-gray-400 text-xs truncate max-w-[130px] xl:max-w-[180px]" title={currentSong.artist}>
                        {currentSong.artist}
                    </p>
                </div>
                
                {/* Actions: Like, Add to Playlist, Download */}
                <div className="flex items-center gap-0.5 shrink-0">
                    <button 
                        onClick={onLike}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors group"
                        title={isLiked ? "Unlike" : "Like"}
                    >
                        <Heart className={`w-4 h-4 transition-all ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400 group-hover:text-white'}`} />
                    </button>
                    <button 
                        onClick={onPlaylistClick}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors group"
                        title="Add to playlist"
                    >
                        <PlusCircle className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                    </button>
                    <button 
                        onClick={onDownload}
                        disabled={downloading || isDownloaded}
                        className={`p-2 hover:bg-white/10 rounded-full transition-colors group relative ${downloading ? 'p-1' : ''}`}
                        title={isPro ? (isDownloaded ? "Downloaded" : downloading ? `${downloadPercent >= 0 ? downloadPercent + '%' : '...'}` : "Download for offline") : "Go Pro to Download"}
                    >
                        {downloading ? (
                            <div className="relative w-6 h-6 flex items-center justify-center">
                              <svg className="w-6 h-6 -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="15" fill="none" stroke="white" strokeWidth="2" className="opacity-15" />
                                <circle 
                                  cx="18" cy="18" r="15" fill="none" 
                                  stroke="url(#dlGradDesktop)" 
                                  strokeWidth="2.5" 
                                  strokeLinecap="round"
                                  strokeDasharray="94.25" 
                                  strokeDashoffset={downloadPercent >= 0 ? 94.25 - (94.25 * downloadPercent / 100) : 70}
                                  className={downloadPercent < 0 ? 'animate-spin origin-center' : 'transition-all duration-300'}
                                />
                                <defs>
                                  <linearGradient id="dlGradDesktop" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor={theme.primary} />
                                    <stop offset="100%" stopColor={theme.accent} />
                                  </linearGradient>
                                </defs>
                              </svg>
                              {downloadPercent >= 0 && (
                                <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold" style={{ color: theme.lightAccent }}>
                                  {downloadPercent}%
                                </span>
                              )}
                            </div>
                        ) : isDownloaded ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : isPro ? (
                            <Download className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                        ) : (
                            <>
                                <Download className="w-4 h-4 text-gray-400 group-hover:text-gray-300" />
                                <Crown className="w-2 h-2 text-amber-500 absolute top-1.5 right-1.5 fill-amber-500" />
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* 2. Middle Section: Timeline / Progress Scrubber spanning across full available space */}
            <div className="relative z-10 flex-1 flex items-center gap-3.5 px-6 min-w-0 group/timeline">
                <span className="text-xs text-gray-400 group-hover/timeline:text-gray-200 font-mono tabular-nums select-none shrink-0 min-w-[38px] text-right transition-colors">
                    {formatTime(displaySeek)}
                </span>
                
                <div 
                    ref={progressBarRef}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    className={`flex-1 py-3.5 flex items-center relative select-none ${isControlDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    {/* Floating Hover Timestamp Tooltip */}
                    {hoverPercent !== null && hoverTime !== null && !isControlDisabled && (
                        <div 
                            className="absolute bottom-full mb-1 -translate-x-1/2 pointer-events-none z-30 flex flex-col items-center animate-in fade-in duration-150"
                            style={{ left: `${hoverPos}px` }}
                        >
                            <div className="bg-[#121215]/95 backdrop-blur-md text-white text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full shadow-2xl border border-white/20 whitespace-nowrap">
                                {formatTime(hoverTime)}
                            </div>
                            <div className="w-1.5 h-1.5 bg-[#121215] border-r border-b border-white/20 rotate-45 -mt-1" />
                        </div>
                    )}

                    {/* Track Container (Sleek expansion on hover) */}
                    <div className="w-full h-1.5 group-hover/timeline:h-2.5 bg-white/10 group-hover/timeline:bg-white/15 rounded-full relative transition-[height,background-color] duration-200 overflow-hidden shadow-inner">
                        {/* Ghost Hover Preview Track */}
                        {hoverPercent !== null && !isControlDisabled && (
                            <div 
                                className="absolute top-0 left-0 h-full rounded-full bg-white/20 pointer-events-none"
                                style={{ width: `${hoverPercent}%` }}
                            />
                        )}
                        {/* Hardware-accelerated 60 FPS Continuous Progress Bar */}
                        <div 
                            className="absolute top-0 left-0 h-full rounded-full pointer-events-none"
                            style={{ 
                                width: `${progressPercent}%`,
                                background: `linear-gradient(90deg, ${theme.primary}, ${theme.accent})`,
                                boxShadow: isPlaying ? `0 0 14px ${theme.glowRgba}` : 'none'
                            }}
                        />
                    </div>

                    {/* Glowing Leading Thumb Dot */}
                    {!isControlDisabled && (
                        <div 
                            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full pointer-events-none transition-transform duration-150 shadow-md ${
                                isScrubbing 
                                    ? 'scale-125 opacity-100 ring-4 ring-white/20' 
                                    : 'scale-90 opacity-0 group-hover/timeline:opacity-100 group-hover/timeline:scale-100'
                            }`}
                            style={{ 
                                left: `${progressPercent}%`,
                                backgroundColor: '#ffffff',
                                border: `2.5px solid ${theme.primary}`,
                                boxShadow: `0 0 12px ${theme.glowRgba}, 0 2px 6px rgba(0,0,0,0.6)`
                            }}
                        />
                    )}

                    {/* Accessible Transparent Range Input */}
                    <input 
                        type="range" 
                        min={0} 
                        max={duration || 1} 
                        step={0.1}
                        value={displaySeek}
                        disabled={isControlDisabled}
                        onPointerDown={() => {
                            setIsScrubbing(true);
                            onSeekStart();
                        }}
                        onChange={onSeekChange}
                        onPointerUp={() => {
                            setIsScrubbing(false);
                            onSeekCommit();
                        }}
                        onMouseUp={() => {
                            setIsScrubbing(false);
                            onSeekCommit();
                        }}
                        onTouchEnd={() => {
                            setIsScrubbing(false);
                            onSeekCommit();
                        }}
                        className={`absolute inset-0 w-full h-full opacity-0 ${isControlDisabled ? 'cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
                        aria-label="Seek timeline"
                    />
                </div>

                <span className="text-xs text-gray-400 group-hover/timeline:text-gray-200 font-mono tabular-nums select-none shrink-0 min-w-[38px] transition-colors">
                    {formatTime(duration)}
                </span>
            </div>

            {/* 3. Right Section: Song Controls, Hover Volume Popup, FullScreen */}
            <div className="relative z-10 flex items-center justify-end gap-2.5 shrink-0">
                {/* Playback controls */}
                <div className="flex items-center gap-1.5">
                    <button 
                        onClick={onToggleShuffle}
                        disabled={isControlDisabled}
                        className={`p-1.5 rounded-full hover:bg-white/5 transition-colors ${isShuffle ? '' : 'text-gray-400 hover:text-white'} ${isControlDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                        style={isShuffle ? { color: theme.lightAccent } : undefined}
                        title={isControlDisabled ? "Host controls playback" : (isShuffle ? "Shuffle on" : "Shuffle off")}
                    >
                        <Shuffle className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={onPrev} 
                        disabled={isControlDisabled}
                        className={`p-1.5 rounded-full hover:bg-white/5 text-gray-300 hover:text-white transition-colors ${isControlDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                        title={isControlDisabled ? "Host controls playback" : "Previous"}
                    >
                        <SkipBack className="w-4 h-4 fill-current" />
                    </button>
                    <button 
                        onClick={onTogglePlay}
                        disabled={isControlDisabled}
                        className={`w-10 h-10 rounded-full bg-white text-black flex items-center justify-center transition-transform shadow-md ${isControlDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
                        style={isPlaying ? { boxShadow: `0 0 16px ${theme.glowRgba}` } : undefined}
                        title={isControlDisabled ? "Host controls playback" : (isPlaying ? "Pause" : "Play")}
                    >
                        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                    </button>
                    <button 
                        onClick={onNext} 
                        disabled={isControlDisabled}
                        className={`p-1.5 rounded-full hover:bg-white/5 text-gray-300 hover:text-white transition-colors ${isControlDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                        title={isControlDisabled ? "Host controls playback" : "Next"}
                    >
                        <SkipForward className="w-4 h-4 fill-current" />
                    </button>
                    <button 
                        onClick={onToggleRepeat}
                        disabled={isControlDisabled}
                        className={`p-1.5 rounded-full hover:bg-white/5 transition-colors relative ${repeatMode !== 'off' ? '' : 'text-gray-400 hover:text-white'} ${isControlDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                        style={repeatMode !== 'off' ? { color: theme.lightAccent } : undefined}
                        title={isControlDisabled ? "Host controls playback" : (repeatMode === 'one' ? "Repeat one" : repeatMode === 'all' ? "Repeat all" : "Repeat off")}
                    >
                        <Repeat className="w-4 h-4" />
                        {repeatMode === 'one' && (
                            <span 
                                className="absolute top-0.5 -right-0.5 text-[8px] font-bold text-black rounded-full w-3 h-3 flex items-center justify-center"
                                style={{ backgroundColor: theme.primary }}
                            >1</span>
                        )}
                    </button>
                </div>

                {/* Subtle Divider */}
                <div className="w-[1px] h-6 bg-white/10 mx-1 shrink-0" />

                {/* Volume Icon with Floating Vertical Slider Popup on TOP (upr side) */}
                <div className="relative group/vol flex items-center justify-center">
                    {/* Floating Vertical Slider Popup on Top (Above the Player Bar) */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-3 opacity-0 pointer-events-none group-hover/vol:opacity-100 group-hover/vol:pointer-events-auto group-focus-within/vol:opacity-100 group-focus-within/vol:pointer-events-auto transition-all duration-200 z-50">
                        <div className="bg-[#141416]/95 backdrop-blur-2xl border border-white/15 px-3 py-3.5 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] flex flex-col items-center gap-2.5">
                            <span className="text-[10px] font-mono font-medium text-gray-300 select-none">
                                {Math.round(volume * 100)}%
                            </span>
                            <div className="relative w-2 h-28 bg-white/15 hover:bg-white/25 rounded-full flex flex-col justify-end p-0.5 cursor-pointer">
                                <div 
                                    className="w-full rounded-full transition-all"
                                    style={{ 
                                        height: `${volume * 100}%`,
                                        background: `linear-gradient(to top, ${theme.primary}, ${theme.accent})`
                                    }}
                                />
                                <div 
                                    className="absolute left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md pointer-events-none"
                                    style={{ bottom: `calc(${volume * 100}% - 7px)` }}
                                />
                                <input 
                                    type="range" 
                                    min={0} 
                                    max={1} 
                                    step={0.01}
                                    value={volume}
                                    onChange={(e) => onVolumeChange(Number(e.target.value))}
                                    {...({ orient: 'vertical' } as any)}
                                    style={{
                                        writingMode: 'vertical-lr',
                                        direction: 'rtl',
                                        WebkitAppearance: 'slider-vertical',
                                    }}
                                    className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] opacity-0 cursor-pointer"
                                    aria-label="Volume Slider"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Volume Button */}
                    <button
                        type="button"
                        onClick={() => onVolumeChange(volume === 0 ? 0.7 : 0)}
                        className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
                        title={volume === 0 ? "Unmute" : "Mute"}
                        aria-label={volume === 0 ? "Unmute" : "Mute"}
                    >
                        {volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                </div>

                {/* Queue / Up Next Button (Added between Volume and Fullscreen with spacing) */}
                <button 
                    type="button"
                    onClick={onToggleQueue}
                    className={`text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full ${isQueueOpen ? 'bg-white/10' : ''}`}
                    style={isQueueOpen ? { color: theme.lightAccent } : undefined}
                    title="Up Next (Queue)"
                    aria-label="Up Next (Queue)"
                >
                    <ListMusic className="w-4 h-4" />
                </button>

                <button 
                    onClick={onToggleFullScreen}
                    className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
                    title="Full Screen"
                >
                    <Maximize2 className="w-4 h-4" />
                </button>
            </div>
        </motion.div>
    );
}
