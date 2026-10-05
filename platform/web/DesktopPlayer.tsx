"use client";

import React, { useMemo } from 'react';
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
    onToggleQueue
}: DesktopPlayerProps) {
    
    // Dynamic cover art theme extraction
    const coverUrl = useMemo(() => {
        const img = currentSong?.image?.[0];
        return typeof img === 'string' && img.trim() !== '' ? img : undefined;
    }, [currentSong?.image]);

    const theme = useCoverTheme(coverUrl);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25 }}
            className="hidden md:flex fixed bottom-6 left-72 right-8 h-20 bg-[#09090b]/90 backdrop-blur-2xl border border-white/10 z-[80] px-6 items-center justify-between shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden transition-all duration-700"
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
                    <div className="relative">
                        <button 
                            onClick={onPlaylistClick}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors group"
                            title="Add to playlist"
                        >
                            <PlusCircle className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                        </button>
                        <AddToPlaylistModal 
                            isOpen={showPlaylistsModal}
                            playlists={playlists}
                            addingToId={addingToId}
                            onAddToPlaylist={onAddToPlaylist}
                            onClose={onClosePlaylist}
                            positionClass="absolute bottom-14 left-0"
                        />
                    </div>
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
            <div className="relative z-10 flex-1 flex items-center gap-4 px-6 min-w-0">
                <span className="text-xs text-gray-400 font-mono tabular-nums select-none shrink-0 min-w-[36px] text-right">
                    {formatTime(localSeek)}
                </span>
                <div className={`flex-1 h-2 bg-white/10 hover:h-2.5 rounded-full relative transition-all ${isControlDisabled ? 'cursor-not-allowed' : 'cursor-pointer group/seek'}`}>
                    <div 
                        className="absolute top-0 left-0 h-full rounded-full transition-all"
                        style={{ 
                            width: `${(localSeek / (duration || 1)) * 100}%`,
                            background: `linear-gradient(to right, ${theme.primary}, ${theme.accent})`,
                            boxShadow: isPlaying ? `0 0 10px ${theme.glowRgba}` : 'none'
                        }}
                    />
                    {!isControlDisabled && (
                        <div 
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full shadow-lg opacity-0 group-hover/seek:opacity-100 transition-opacity pointer-events-none"
                            style={{ 
                                left: `${(localSeek / (duration || 1)) * 100}%`,
                                backgroundColor: theme.lightAccent || '#ffffff',
                                boxShadow: `0 0 10px ${theme.glowRgba}`
                            }}
                        />
                    )}
                    <input 
                        type="range" 
                        min={0} 
                        max={duration || 1} 
                        step={0.1}
                        value={localSeek}
                        disabled={isControlDisabled}
                        onPointerDown={onSeekStart}
                        onChange={onSeekChange}
                        onPointerUp={onSeekCommit}
                        onMouseUp={onSeekCommit}
                        onTouchEnd={onSeekCommit}
                        className={`absolute inset-0 w-full h-full opacity-0 ${isControlDisabled ? 'cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
                    />
                </div>
                <span className="text-xs text-gray-400 font-mono tabular-nums select-none shrink-0 min-w-[36px]">
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

                {/* Volume Icon with Hover Vertical Slider Popup */}
                <div className="relative group/vol flex items-center justify-center">
                    {/* Floating Vertical Slider Popup on Hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-3 opacity-0 pointer-events-none group-hover/vol:opacity-100 group-hover/vol:pointer-events-auto group-focus-within/vol:opacity-100 group-focus-within/vol:pointer-events-auto transition-all duration-200 z-50">
                        <div className="bg-[#141416]/95 backdrop-blur-xl border border-white/15 px-3 py-3 rounded-2xl shadow-2xl flex flex-col items-center gap-2">
                            <span className="text-[10px] font-mono font-medium text-gray-300 select-none">
                                {Math.round(volume * 100)}%
                            </span>
                            <div className="relative w-2 h-28 bg-white/15 hover:bg-white/20 rounded-full flex flex-col justify-end p-0.5 cursor-pointer">
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
                                />
                            </div>
                        </div>
                    </div>

                    {/* Volume Button */}
                    <button
                        onClick={() => onVolumeChange(volume === 0 ? 0.7 : 0)}
                        className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
                        title={volume === 0 ? "Unmute" : "Mute"}
                    >
                        {volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                </div>

                {/* Queue / Up Next Button (Added between Volume and Fullscreen with spacing) */}
                <button 
                    onClick={onToggleQueue}
                    className={`text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full ${isQueueOpen ? 'bg-white/10' : ''}`}
                    style={isQueueOpen ? { color: theme.lightAccent } : undefined}
                    title="Up Next (Queue)"
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
