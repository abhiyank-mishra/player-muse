"use client";

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Song } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import { 
    Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Shuffle, 
    X, Heart, PlusCircle, Download, CheckCircle, Music, Crown, ChevronLeft, Share2, ListMusic 
} from 'lucide-react';
import AddToPlaylistModal from '@/reusable/ui/modals/AddToPlaylistModal';
import { useCoverTheme } from '@/lib/coverTheme';
import { useToast } from '@/contexts/ToastContext';

interface LyricLine {
    time: number;
    text: string;
}

interface DesktopFullScreenPlayerProps {
    currentSong: Song;
    isPlaying: boolean;
    isLiked: boolean;
    seek: number;
    duration: number;
    volume: number;
    isShuffle: boolean;
    repeatMode: 'off' | 'one' | 'all';
    localSeek: number;
    playlists: any[];
    showPlaylistsModal: boolean;
    addingToId: string | null;
    isDownloaded: boolean;
    downloading: boolean;
    downloadPercent: number;
    canDownload: boolean;
    isPro: boolean;
    isQueueOpen?: boolean;
    onToggleQueue?: () => void;
    onTogglePlay: () => void;
    onNext: () => void;
    onPrev: () => void;
    onSeekStart: () => void;
    onSeekChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSeekCommit: () => void;
    onVolumeChange: (vol: number) => void;
    onToggleShuffle: () => void;
    onToggleRepeat: () => void;
    onLike: (e: React.MouseEvent) => void;
    onPlaylistClick: (e: React.MouseEvent) => void;
    onAddToPlaylist: (id: string, e: React.MouseEvent) => void;
    onClosePlaylist: () => void;
    onDownload: (e: React.MouseEvent) => void;
    onMinimize: () => void;
    onSeek: (time: number) => void;
    getCurrentTime?: () => number;
    isControlDisabled?: boolean;
}

export default function DesktopFullScreenPlayer({
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
    isControlDisabled,
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
    onMinimize,
    onSeek,
    getCurrentTime,
    isQueueOpen,
    onToggleQueue
}: DesktopFullScreenPlayerProps) {

    // Dynamic cover art theme extraction (colors, glowing aura, accents)
    const coverUrl = currentSong.image?.[0]?.replace('150x150', '500x500') || currentSong.image?.[1] || currentSong.image?.[2] || currentSong.image?.[0] || '/logo.png';
    const theme = useCoverTheme(coverUrl);
    const { showToast } = useToast();

    // Native & Clipboard Share handler
    const handleShare = async () => {
        if (!currentSong) return;
        const sourceSuffix = currentSong.source === 'soundcloud' ? '?source=soundcloud' : '';
        const shareUrl = typeof window !== 'undefined'
            ? `${window.location.origin}/song/${encodeURIComponent(currentSong.id)}${sourceSuffix}`
            : '';
        const shareData = {
            title: `Listen to ${currentSong.name}`,
            text: `Listen to ${currentSong.name} by ${currentSong.artist} on Muse - Premium Ad-Free Music.`,
            url: shareUrl || (typeof window !== 'undefined' ? window.location.href : '')
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
                return;
            } catch (err) {
                return;
            }
        }

        if (navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(shareData.url);
                showToast('Song link copied!', 'success');
            } catch {}
        }
    };

    // Subtitles / Lyrics state
    const [lyrics, setLyrics] = useState<LyricLine[]>([]);
    const [isSynced, setIsSynced] = useState<boolean>(false);
    const [plainLyrics, setPlainLyrics] = useState<string | null>(null);
    const [loadingLyrics, setLoadingLyrics] = useState<boolean>(true);
    const activeLineRef = useRef<HTMLParagraphElement>(null);
    const lyricsScrollRef = useRef<HTMLDivElement>(null);

    // High-precision real-time audio position (30-60fps) directly from the audio engine
    // Eliminates the 1-second discrete polling delay so subtitles sync with millisecond precision
    const [realtimeSeek, setRealtimeSeek] = useState(localSeek);

    useEffect(() => {
        if (!isPlaying || !getCurrentTime || isQueueOpen) {
            setRealtimeSeek(localSeek);
            return;
        }

        let frameId: number;
        let lastReported = -1;

        const updateTick = () => {
            const exactPos = getCurrentTime();
            if (exactPos > 0 && Math.abs(exactPos - lastReported) >= 0.025) {
                lastReported = exactPos;
                setRealtimeSeek(exactPos);
            }
            frameId = requestAnimationFrame(updateTick);
        };

        frameId = requestAnimationFrame(updateTick);
        return () => cancelAnimationFrame(frameId);
    }, [isPlaying, getCurrentTime, localSeek, isQueueOpen]);

    // Keep realtimeSeek in sync on manual seeks
    useEffect(() => {
        setRealtimeSeek(localSeek);
    }, [localSeek]);

    // Fetch live subtitles / lyrics on song change
    useEffect(() => {
        let isMounted = true;
        setLoadingLyrics(true);
        setLyrics([]);
        setPlainLyrics(null);
        setIsSynced(false);

        const fetchLyrics = async () => {
            try {
                const res = await fetch(`/api/music/lyrics?title=${encodeURIComponent(currentSong.name)}&artist=${encodeURIComponent(currentSong.artist)}&duration=${currentSong.duration || 0}`);
                if (!res.ok) throw new Error('Lyrics fetch failed');
                const data = await res.json();
                if (!isMounted) return;

                if (data.synced && Array.isArray(data.lines) && data.lines.length > 0) {
                    setLyrics(data.lines);
                    setIsSynced(true);
                } else if (data.plain) {
                    setPlainLyrics(data.plain);
                    setIsSynced(false);
                }
            } catch (err) {
                console.error('Failed to load lyrics:', err);
            } finally {
                if (isMounted) setLoadingLyrics(false);
            }
        };

        fetchLyrics();
        return () => { isMounted = false; };
    }, [currentSong.id, currentSong.name, currentSong.artist, currentSong.duration]);

    // Anticipation offset (250ms): With real-time audio engine tracking,
    // a 250ms lead-in compensates for human vocal attack and singer breathing
    const LYRICS_ANTICIPATION_OFFSET = 0.25;

    // Compute active lyric line based on high-precision real-time audio position
    const activeIndex = useMemo(() => {
        if (!isSynced || lyrics.length === 0) return -1;
        const currentPlayhead = realtimeSeek > 0 ? realtimeSeek : localSeek;
        const adjustedSeek = currentPlayhead + LYRICS_ANTICIPATION_OFFSET;
        let index = -1;
        for (let i = 0; i < lyrics.length; i++) {
            if (lyrics[i].time <= adjustedSeek) {
                index = i;
            } else {
                break;
            }
        }
        return index;
    }, [lyrics, realtimeSeek, localSeek, isSynced]);

    // Smooth auto-scroll active lyric into center view
    useEffect(() => {
        if (activeIndex >= 0 && activeLineRef.current && lyricsScrollRef.current) {
            const container = lyricsScrollRef.current;
            const activeEl = activeLineRef.current;
            const targetScroll = activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;
            container.scrollTo({
                top: Math.max(0, targetScroll),
                behavior: 'smooth'
            });
        }
    }, [activeIndex, lyrics]);

    // Proximity effect for Close (X) button on desktop / laptop view:
    // Revealed only when mouse is within 100px radius of the button
    const [isCloseVisible, setIsCloseVisible] = useState(false);
    const closeBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!closeBtnRef.current) return;
            const rect = closeBtnRef.current.getBoundingClientRect();
            // If button is hidden/unrendered (e.g. mobile view), skip calculation
            if (rect.width === 0 && rect.height === 0) return;

            // Shortest distance from mouse pointer to the button bounding box edges
            const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
            const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
            const distanceToEdge = Math.hypot(dx, dy);

            // Trigger visibility within 100px radius
            const isNear = distanceToEdge <= 100;
            setIsCloseVisible(prev => (prev !== isNear ? isNear : prev));
        };

        const handleMouseLeave = () => {
            setIsCloseVisible(false);
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        document.addEventListener('mouseleave', handleMouseLeave);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, []);

    // Handle Escape key to close full screen
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Escape') {
                e.preventDefault();
                onMinimize();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onMinimize]);

    return (
        <motion.div 
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[90] bg-[#070709] flex flex-col items-center justify-center overflow-hidden select-none"
        >
            {/* Ambient Background Blur Canvas */}
            <div 
                className="absolute inset-0 bg-cover bg-center opacity-70 blur-[120px] scale-135 saturate-200 pointer-events-none transition-all duration-1000"
                style={{ backgroundImage: coverUrl ? `url(${coverUrl})` : 'none' }}
            />

            {/* Dynamic Rich Ambient Theme Color Mesh */}
            <div 
                className="absolute inset-0 pointer-events-none transition-all duration-1000"
                style={{
                    background: `
                        radial-gradient(circle at 20% 35%, ${theme.glowRgba} 0%, transparent 60%),
                        radial-gradient(circle at 75% 65%, ${theme.ambientRgba} 0%, transparent 65%),
                        radial-gradient(circle at 50% 15%, ${theme.ambientRgba} 0%, transparent 55%),
                        radial-gradient(circle at 88% 12%, ${theme.ambientRgba} 0%, transparent 50%),
                        radial-gradient(ellipse at 50% 50%, rgba(7, 7, 9, 0.2) 0%, rgba(7, 7, 9, 0.82) 100%)
                    `
                }}
            />

            {/* Cinematic Soft Vignette Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/75 pointer-events-none" />

            {/* Top Bar: Back (<) on Left, Share (Mobile) / Close (Desktop) on Right */}
            <div className="absolute top-0 inset-x-0 p-4 sm:p-8 z-30 flex items-center justify-between pointer-events-auto">
                {/* Back Button (<) - Mobile Only */}
                <button 
                    onClick={onMinimize}
                    className="flex sm:hidden p-2 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-full transition-all backdrop-blur-md hover:scale-110 active:scale-95 group shadow-xl border border-white/10"
                    title="Back"
                >
                    <ChevronLeft className="w-5 h-5 transition-transform duration-200 group-hover:-translate-x-0.5" />
                </button>

                {/* Right Action: Mobile has Share, Desktop has Close X */}
                <div className="flex items-center gap-2 sm:ml-auto">
                    <button 
                        onClick={handleShare}
                        className="flex sm:hidden p-2 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-full transition-all backdrop-blur-md hover:scale-110 active:scale-95 group shadow-xl border border-white/10"
                        title="Share Song"
                    >
                        <Share2 className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                    </button>
                    <button 
                        ref={closeBtnRef}
                        onClick={onMinimize}
                        onMouseEnter={() => setIsCloseVisible(true)}
                        className={`hidden sm:flex p-2.5 rounded-full transition-all duration-300 ease-out backdrop-blur-md border group ${
                            isCloseVisible 
                                ? 'opacity-100 scale-100 pointer-events-auto' 
                                : 'opacity-0 scale-90 pointer-events-none'
                        } bg-white/[0.18] hover:bg-white/[0.28] active:bg-white/[0.35] text-white/90 hover:text-white border-white/25 hover:border-white/40 shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:scale-110 active:scale-95 focus-visible:opacity-100 focus-visible:scale-100 focus-visible:pointer-events-auto`}
                        style={{
                            boxShadow: isCloseVisible 
                                ? `0 4px 20px rgba(0, 0, 0, 0.15), 0 0 16px ${theme.ambientRgba}` 
                                : undefined
                        }}
                        title="Close Full Screen (Esc)"
                    >
                        <X className="w-5 h-5 transition-transform duration-200 group-hover:rotate-90" />
                    </button>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="relative z-10 flex flex-col lg:flex-row gap-1 sm:gap-8 lg:gap-12 xl:gap-20 items-center justify-between lg:justify-center w-full max-w-7xl px-4 sm:px-8 lg:px-12 h-full pt-12 sm:pt-14 pb-2 sm:pb-5 overflow-hidden lg:overflow-visible">
                
                {/* Left: Artwork with Blended Ambient Aura & Harmonic Waveform */}
                <div className="flex flex-col items-center justify-center relative shrink-0 mt-2 sm:mt-8">
                    <motion.div 
                        initial={{ scale: 0.92, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.15 }}
                        className="relative group" 
                    >
                        {/* Dynamic Ambient Breathing Aura Glow */}
                        <motion.div 
                            animate={isPlaying ? {
                                scale: [1, 1.08, 0.98, 1.05, 1],
                                opacity: [0.45, 0.75, 0.45, 0.65, 0.45]
                            } : { scale: 1, opacity: 0.25 }}
                            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute -inset-6 sm:-inset-10 rounded-[50px] blur-3xl pointer-events-none z-0 transition-all duration-700"
                            style={{
                                background: `radial-gradient(circle, ${theme.glowRgba} 0%, ${theme.ambientRgba} 70%, transparent 100%)`
                            }}
                        />

                        {/* Subtle Outer Pulsing Wave Ring */}
                        {isPlaying && (
                            <motion.div 
                                animate={{ scale: [1, 1.1, 1.18], opacity: [0.4, 0.18, 0] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
                                className="absolute -inset-4 rounded-3xl pointer-events-none z-0 transition-colors duration-700"
                                style={{
                                    border: `1px solid ${theme.glowRgba}`
                                }}
                            />
                        )}

                        {/* Album Artwork Image */}
                        <div className="w-[195px] h-[195px] min-[380px]:w-[220px] min-[380px]:h-[220px] sm:w-[340px] sm:h-[340px] lg:w-[380px] lg:h-[380px] xl:w-[440px] xl:h-[440px] max-h-[27vh] max-w-[27vh] sm:max-h-none sm:max-w-none aspect-square rounded-2xl sm:rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden relative border border-white/10 z-10 bg-[#121212] flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-500">
                            {coverUrl ? (
                                <img 
                                    src={coverUrl} 
                                    alt={currentSong.name} 
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <Music className="w-16 h-16 sm:w-24 sm:h-24 text-gray-600" />
                            )}
                        </div>
                    </motion.div>

                    {/* Modern Fluid Soundwave Equalizer at base of Artwork */}
                    <div className="relative flex items-center justify-center gap-[2.5px] sm:gap-[4px] h-[20px] sm:h-12 mt-[18px] sm:mt-6 z-10 px-4 py-0.5 sm:py-1">
                        {/* Subtle Underglow Reflection */}
                        <div 
                            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4/5 h-4 rounded-full blur-lg pointer-events-none transition-all duration-700"
                            style={{
                                background: `radial-gradient(ellipse at center, ${theme.primary} 0%, transparent 75%)`,
                                opacity: isPlaying ? 0.65 : 0.15
                            }}
                        />

                        {[...Array(32)].map((_, i) => {
                            const centerDist = Math.abs(i - 15.5) / 15.5;
                            // Gentle natural bell curve: peak in center, sides smoothly tapered
                            const amp = Math.max(0.42, Math.cos(centerDist * Math.PI * 0.42));
                            
                            // Multi-harmonic frequencies for traveling fluid ripples
                            const p1 = Math.sin((i / 31) * Math.PI * 2.2) * 0.4 + 0.6;
                            const p2 = Math.cos((i / 31) * Math.PI * 3.1) * 0.4 + 0.6;
                            const p3 = Math.sin((i / 31) * Math.PI * 1.8 + 1.2) * 0.4 + 0.6;
                            const p4 = Math.cos((i / 31) * Math.PI * 2.5 + 2.1) * 0.4 + 0.6;

                            const s1 = Math.max(0.25, amp * p1);
                            const s2 = Math.max(0.35, amp * (0.35 + p2 * 0.65));
                            const s3 = Math.max(0.28, amp * (0.3 + p3 * 0.7));
                            const s4 = Math.max(0.38, amp * (0.4 + p4 * 0.6));

                            return (
                                <motion.div 
                                    key={i}
                                    className="w-[2.5px] sm:w-[3.5px] h-5 sm:h-9 rounded-full origin-center transition-colors duration-500"
                                    style={{
                                        background: `linear-gradient(to top, ${theme.primary}, ${theme.accent}, ${theme.lightAccent})`,
                                        boxShadow: isPlaying ? `0 0 10px ${theme.glowRgba}` : 'none'
                                    }}
                                    animate={isPlaying ? {
                                        scaleY: [s1, s2, s3, s4, s1],
                                        opacity: [0.7, 1, 0.8, 0.95, 0.7]
                                    } : { 
                                        scaleY: 0.14, 
                                        opacity: 0.35 
                                    }}
                                    transition={{
                                        duration: 1.1 + ((i % 5) * 0.12),
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                        delay: (i * 0.035) % 0.35
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Right: Info, Live Subtitles/Karaoke Stream, & Controls — Balanced natural spacing */}
                <div className="flex flex-col flex-1 max-w-xl w-full justify-between sm:justify-center gap-[6px] sm:gap-8 lg:gap-10 pb-[8px] sm:pb-4 min-h-0">
                    
                    {/* Top Group: Song Info Header + Lyrics grouped naturally */}
                    <div className="flex flex-col gap-[30px] w-full text-left mt-[35px] sm:mt-4">
                        {/* Song Info Header: Positioned with clean gap below equalizer */}
                        <div className="flex flex-col gap-1 w-full text-left px-4 sm:pl-8 sm:pr-4">
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight line-clamp-1" title={currentSong.name}>
                                {currentSong.name}
                            </h1>
                            <h2 className="text-sm sm:text-base lg:text-lg font-medium transition-colors duration-500 truncate mt-0.5" style={{ color: theme.lightAccent }}>
                                {currentSong.artist}
                            </h2>
                        </div>

                        {/* Live Subtitles / Synced Lyrics Display */}
                        <div 
                            ref={lyricsScrollRef}
                            className="w-full h-[165px] sm:h-48 lg:h-56 overflow-y-auto px-4 sm:pl-8 sm:pr-4 relative flex flex-col scroll-smooth scrollbar-none"
                            style={{
                                maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
                                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)'
                            }}
                        >
                            {loadingLyrics ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 sm:gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-bounce [animation-delay:-0.3s]" style={{ backgroundColor: theme.primary }} />
                                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-bounce [animation-delay:-0.15s]" style={{ backgroundColor: theme.accent }} />
                                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-bounce" style={{ backgroundColor: theme.lightAccent }} />
                                    </div>
                                    <p className="text-xs font-semibold tracking-wider uppercase text-gray-500">Loading Subtitles...</p>
                                </div>
                            ) : isSynced && lyrics.length > 0 ? (
                                <div className="pt-7 pb-7 sm:py-24 flex flex-col gap-3 sm:gap-5">
                                    {lyrics.map((line, idx) => {
                                        const isActive = idx === activeIndex;
                                        const isPast = idx < activeIndex;
                                        return (
                                            <p
                                                key={idx}
                                                ref={isActive ? activeLineRef : null}
                                                onClick={() => onSeek(line.time)}
                                                className={`transition-all duration-250 ease-out cursor-pointer select-none origin-left ${
                                                    isActive
                                                        ? 'filter-none blur-0 opacity-100 scale-100 text-white text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight py-1'
                                                        : 'filter blur-[1px] opacity-35 scale-[0.97] text-white/70 text-sm sm:text-lg lg:text-xl font-semibold hover:filter-none hover:blur-0 hover:opacity-90 hover:scale-[1.0] py-0.5'
                                                }`}
                                                style={isActive ? {
                                                    textShadow: `0 0 16px rgba(255,255,255,0.7), 0 0 32px ${theme.glowRgba}`
                                                } : undefined}
                                            >
                                                {line.text}
                                            </p>
                                        );
                                    })}
                                </div>
                            ) : plainLyrics ? (
                                <div className="py-3 sm:py-8 text-gray-300 text-xs sm:text-base leading-relaxed whitespace-pre-line font-medium opacity-80">
                                    {plainLyrics}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-1.5 sm:gap-2">
                                    <Music className="w-6 h-6 sm:w-8 sm:h-8 opacity-30" />
                                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">Subtitles unavailable for this song</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Unified Bottom Controls Dock */}
                    <div className="w-full flex flex-col gap-[12px] sm:gap-4 pb-[18px] sm:pb-6 shrink-0 px-2 sm:px-0">
                        {/* Action Buttons Row: Like, Add to Playlist, Download, Queue (+ Desktop Volume) — ABOVE timeline at all sizes */}
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2 sm:gap-2.5">
                                <button 
                                    onClick={onLike}
                                    className="p-2 sm:p-2.5 bg-white/5 hover:bg-white/10 active:scale-90 rounded-full transition-all"
                                    title={isLiked ? "Unlike" : "Like"}
                                >
                                    <Heart className={`w-4.5 h-4.5 sm:w-5 sm:h-5 transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-300'}`} />
                                </button>
                                <button 
                                    onClick={onPlaylistClick}
                                    className="p-2 sm:p-2.5 bg-white/5 hover:bg-white/10 active:scale-90 rounded-full transition-all"
                                    title="Add to Playlist"
                                >
                                    <PlusCircle className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-gray-300" />
                                </button>
                                <button 
                                    onClick={onDownload}
                                    disabled={downloading || isDownloaded}
                                    className={`p-2 sm:p-2.5 bg-white/5 hover:bg-white/10 active:scale-90 rounded-full transition-all relative ${downloading ? 'p-1.5' : ''}`}
                                    title={isPro ? (isDownloaded ? "Downloaded" : downloading ? `${downloadPercent >= 0 ? downloadPercent + '%' : '...'}` : "Download for offline") : "Go Pro to Download"}
                                >
                                    {downloading ? (
                                        <div className="relative w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center">
                                          <svg className="w-6 h-6 sm:w-7 sm:h-7 -rotate-90" viewBox="0 0 36 36">
                                            <circle cx="18" cy="18" r="15" fill="none" stroke="white" strokeWidth="2" className="opacity-15" />
                                            <circle 
                                              cx="18" cy="18" r="15" fill="none" 
                                              stroke="url(#dlGradAction)" 
                                              strokeWidth="2.5" 
                                              strokeLinecap="round" 
                                              strokeDasharray="94.25" 
                                              strokeDashoffset={downloadPercent >= 0 ? 94.25 - (94.25 * downloadPercent / 100) : 70}
                                              className={downloadPercent < 0 ? 'animate-spin origin-center' : 'transition-all duration-300'}
                                            />
                                            <defs>
                                              <linearGradient id="dlGradAction" x1="0%" y1="0%" x2="100%" y2="100%">
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
                                        <CheckCircle className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-green-500" />
                                    ) : isPro ? (
                                        <Download className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-gray-300 transition-colors" />
                                    ) : (
                                        <>
                                            <Download className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-gray-300" />
                                            <Crown className="w-2 h-2 text-amber-500 absolute top-1.5 right-1.5 fill-amber-500" />
                                        </>
                                    )}
                                </button>
                                {onToggleQueue && (
                                    <button 
                                        type="button"
                                        onClick={onToggleQueue}
                                        className={`p-2 sm:p-2.5 rounded-full transition-all active:scale-90 ${isQueueOpen ? 'bg-white/20 text-white shadow-lg' : 'bg-white/5 hover:bg-white/10 text-gray-300'}`}
                                        title="Queue"
                                        aria-label="Queue"
                                    >
                                        <ListMusic className="w-4.5 h-4.5 sm:w-5 sm:h-5 transition-colors" />
                                    </button>
                                )}
                            </div>

                            {/* Desktop only volume control (Hidden on phone/mobile) */}
                            <div className="hidden lg:flex items-center gap-3 w-36 xl:w-44">
                                <button
                                    onClick={() => onVolumeChange(volume === 0 ? 0.7 : 0)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                    title={volume === 0 ? "Unmute" : "Mute"}
                                >
                                    {volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                                </button>
                                <div className="flex-1 h-1.5 bg-white/10 hover:h-2 rounded-full relative group transition-all">
                                    <div 
                                        className="absolute top-0 left-0 h-full bg-white rounded-full transition-colors"
                                        style={{ width: `${volume * 100}%` }}
                                    />
                                    <div 
                                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                        style={{ left: `${volume * 100}%` }}
                                    />
                                    <input 
                                        type="range" 
                                        min={0} 
                                        max={1} 
                                        step={0.01}
                                        value={volume}
                                        onChange={(e) => onVolumeChange(Number(e.target.value))}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar / Timeline */}
                        <div className="w-full group/seek">
                            <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5 sm:mb-2 font-mono tabular-nums">
                                <span>{formatTime(realtimeSeek > 0 ? realtimeSeek : localSeek)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                            <div className={`h-1.5 sm:h-2 bg-white/10 hover:h-2.5 rounded-full relative transition-all ${isControlDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                <div 
                                    className="absolute top-0 left-0 h-full rounded-full pointer-events-none"
                                    style={{ 
                                        width: `${((realtimeSeek > 0 ? realtimeSeek : localSeek) / (duration || 1)) * 100}%`,
                                        background: `linear-gradient(to right, ${theme.primary}, ${theme.accent})`,
                                        boxShadow: `0 0 10px ${theme.glowRgba}`
                                    }}
                                />
                                {!isControlDisabled && (
                                    <div 
                                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover/seek:opacity-100 transition-opacity"
                                        style={{ left: `${((realtimeSeek > 0 ? realtimeSeek : localSeek) / (duration || 1)) * 100}%` }}
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
                        </div>

                        {/* Main Playback Controls */}
                        <div className="flex items-center justify-between w-full">
                            <button 
                                onClick={onToggleShuffle}
                                disabled={isControlDisabled}
                                className={`p-2.5 sm:p-3 rounded-full transition-colors ${!isShuffle ? 'text-gray-400 hover:text-white hover:bg-white/5' : ''} ${isControlDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                                style={isShuffle ? { color: theme.lightAccent, backgroundColor: `${theme.primary}25` } : undefined}
                                title={isControlDisabled ? "Host controls playback" : (isShuffle ? "Shuffle on" : "Shuffle off")}
                            >
                                <Shuffle className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                            </button>
                            
                            <div className="flex items-center gap-5 sm:gap-6">
                                <button 
                                    onClick={onPrev} 
                                    disabled={isControlDisabled}
                                    className={`p-1.5 sm:p-2 text-gray-300 transition-transform ${isControlDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'hover:text-white hover:scale-110 active:scale-95'}`}
                                    title={isControlDisabled ? "Host controls playback" : "Previous"}
                                >
                                    <SkipBack className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
                                </button>
                                <button 
                                    onClick={onTogglePlay}
                                    disabled={isControlDisabled}
                                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white text-black flex items-center justify-center transition-transform shadow-xl shadow-white/10 ${isControlDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
                                    title={isControlDisabled ? "Host controls playback" : (isPlaying ? "Pause" : "Play")}
                                >
                                    {isPlaying ? <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-current" /> : <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-0.5 sm:ml-1" />}
                                </button>
                                <button 
                                    onClick={onNext} 
                                    disabled={isControlDisabled}
                                    className={`p-1.5 sm:p-2 text-gray-300 transition-transform ${isControlDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'hover:text-white hover:scale-110 active:scale-95'}`}
                                    title={isControlDisabled ? "Host controls playback" : "Next"}
                                >
                                    <SkipForward className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
                                </button>
                            </div>

                            <button 
                                onClick={onToggleRepeat}
                                disabled={isControlDisabled}
                                className={`p-2.5 sm:p-3 rounded-full transition-colors relative ${repeatMode === 'off' ? 'text-gray-400 hover:text-white hover:bg-white/5' : ''} ${isControlDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                                style={repeatMode !== 'off' ? { color: theme.lightAccent, backgroundColor: `${theme.primary}25` } : undefined}
                                title={isControlDisabled ? "Host controls playback" : (repeatMode === 'one' ? "Repeat one" : repeatMode === 'all' ? "Repeat all" : "Repeat off")}
                            >
                                <Repeat className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                                {repeatMode === 'one' && (
                                    <span className="absolute top-1 sm:top-2 right-1 sm:right-2 text-[8px] font-bold text-black rounded-full w-3 h-3 flex items-center justify-center" style={{ backgroundColor: theme.primary }}>1</span>
                                )}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </motion.div>
    );
}
