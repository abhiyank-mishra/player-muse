"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, 
    ChevronDown, Share2, Heart, PlusCircle, Download, CheckCircle, 
    Crown, Disc3, Mic2, ListMusic, Trash2, GripVertical
} from 'lucide-react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { Song } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import AddToPlaylistModal from '@/reusable/ui/modals/AddToPlaylistModal';
import { useCoverTheme } from '@/lib/coverTheme';
import { usePlayer } from '@/contexts/PlayerContext';

interface LyricLine {
    time: number;
    text: string;
}

interface MobileExpandedPlayerProps {
    currentSong: Song;
    isPlaying: boolean;
    isLiked: boolean;
    seek: number;
    duration: number;
    isShuffle: boolean;
    repeatMode: 'off' | 'one' | 'all';
    localSeek: number;
    playlists: any[];
    showPlaylistsModal: boolean;
    addingToId: string | null;
    showLikeTooltip: boolean;
    isAdmin: boolean;
    isDownloaded: boolean;
    downloading: boolean;
    downloadPercent: number;
    canDownload: boolean;
    isPro: boolean;
    
    onCollapse: () => void;
    onTogglePlay: () => void;
    onNext: () => void;
    onPrev: () => void;
    onSeekStart: () => void;
    onSeekChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSeekCommit: () => void;
    onToggleShuffle: () => void;
    onToggleRepeat: () => void;
    onLike: (e: React.MouseEvent) => void;
    onShare: () => void;
    onPlaylistClick: (e: React.MouseEvent) => void;
    onAddToPlaylist: (id: string, e: React.MouseEvent) => void;
    onClosePlaylist: () => void;
    onDownload: (e: React.MouseEvent) => void;
    markLikeTooltipSeen: () => void;
    
    isControlDisabled?: boolean;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
}

function MobileQueueRow({
    song,
    index,
    onPlay,
    onRemove
}: {
    song: Song;
    index: number;
    onPlay: () => void;
    onRemove: () => void;
}) {
    const dragControls = useDragControls();

    return (
        <Reorder.Item
            value={song}
            id={song.id}
            dragListener={false}
            dragControls={dragControls}
            className="group flex items-center justify-between p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] active:bg-white/[0.08] transition-colors border border-transparent hover:border-white/5 select-none"
            whileDrag={{
                scale: 1,
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                boxShadow: "none"
            }}
        >
            <div 
                onClick={onPlay}
                className="flex items-center gap-3 min-w-0 flex-1 mr-2 cursor-pointer"
            >
                <span className="text-xs font-mono text-neutral-500 w-4 text-center shrink-0">
                    {index + 1}
                </span>
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-900 border border-white/5 relative">
                    <img 
                        src={song.image?.[0] || '/logo.png'} 
                        alt={song.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = '/logo.png';
                        }}
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-semibold text-white truncate group-hover:text-neutral-200">
                        {song.name}
                    </h5>
                    <p className="text-[11px] text-neutral-400 truncate">
                        {song.artist}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
                    title="Remove from queue"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div
                    onPointerDown={(e) => dragControls.start(e)}
                    className="p-1.5 text-neutral-400 hover:text-white cursor-grab active:cursor-grabbing touch-none select-none transition-colors"
                    title="Hold & drag to reorder"
                >
                    <GripVertical className="w-4 h-4" />
                </div>
            </div>
        </Reorder.Item>
    );
}

export default function MobileExpandedPlayer({
    currentSong,
    isPlaying,
    isLiked,
    seek,
    duration,
    isShuffle,
    repeatMode,
    localSeek,
    playlists,
    showPlaylistsModal,
    addingToId,
    showLikeTooltip,
    isAdmin,
    isDownloaded,
    downloading,
    downloadPercent,
    canDownload,
    isPro,
    onCollapse,
    onTogglePlay,
    onNext,
    onPrev,
    onSeekStart,
    onSeekChange,
    onSeekCommit,
    onToggleShuffle,
    onToggleRepeat,
    onLike,
    onShare,
    onPlaylistClick,
    onAddToPlaylist,
    onClosePlaylist,
    onDownload,
    markLikeTooltipSeen,
    isControlDisabled,
    onTouchStart,
    onTouchMove,
    onTouchEnd
}: MobileExpandedPlayerProps) {
    const { 
        queue, 
        currentIndex, 
        manualQueue, 
        playSong, 
        removeQueueItem, 
        replaceUpcomingQueue,
        seekTo, 
        getCurrentTime 
    } = usePlayer();

    // Mode tabs: 'player' (Song) | 'lyrics' | 'queue'
    const [activeTab, setActiveTab] = useState<'player' | 'lyrics' | 'queue'>('player');

    // Dynamic cover art theme
    const coverUrl = currentSong.image?.[0]?.replace('150x150', '500x500') || currentSong.image?.[1] || currentSong.image?.[2] || '/logo.png';
    const theme = useCoverTheme(coverUrl);

    // Lyrics state
    const [lyrics, setLyrics] = useState<LyricLine[]>([]);
    const [isSynced, setIsSynced] = useState<boolean>(false);
    const [plainLyrics, setPlainLyrics] = useState<string | null>(null);
    const [loadingLyrics, setLoadingLyrics] = useState<boolean>(true);
    const activeLineRef = useRef<HTMLDivElement>(null);
    const lyricsScrollRef = useRef<HTMLDivElement>(null);

    // High-precision real-time audio position for synced lyrics
    const [realtimeSeek, setRealtimeSeek] = useState(localSeek);

    useEffect(() => {
        if (!isPlaying || !getCurrentTime) {
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
    }, [isPlaying, getCurrentTime, localSeek]);

    useEffect(() => {
        setRealtimeSeek(localSeek);
    }, [localSeek]);

    // Fetch live lyrics on song change
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

    // Active lyric calculation (with 250ms vocal anticipation)
    const activeIndex = useMemo(() => {
        if (!isSynced || lyrics.length === 0) return -1;
        const currentPlayhead = realtimeSeek > 0 ? realtimeSeek : localSeek;
        const adjustedSeek = currentPlayhead + 0.25;
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

    // Reliable auto-scroll using native scrollIntoView to keep active line centered
    useEffect(() => {
        if (activeTab === 'lyrics' && activeIndex >= 0 && activeLineRef.current) {
            activeLineRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        }
    }, [activeIndex, activeTab]);

    // Upcoming queue extraction
    const rawUpcoming: Song[] = useMemo(() => {
        const raw = [
            ...(manualQueue || []),
            ...queue.slice(currentIndex + 1)
        ];
        const seen = new Set<string>();
        if (currentSong?.id) seen.add(currentSong.id);
        const result: Song[] = [];
        for (const s of raw) {
            if (s && s.id && !seen.has(s.id)) {
                seen.add(s.id);
                result.push(s);
            }
        }
        return result;
    }, [manualQueue, queue, currentIndex, currentSong?.id]);

    const [upcomingSongs, setUpcomingSongs] = useState<Song[]>(rawUpcoming);

    useEffect(() => {
        setUpcomingSongs(rawUpcoming);
    }, [rawUpcoming]);

    const handleReorder = (newOrder: Song[]) => {
        setUpcomingSongs(newOrder);
        replaceUpcomingQueue(newOrder);
    };

    return (
        <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="md:hidden fixed inset-0 z-[60] bg-[#09090b] flex flex-col justify-between p-5 overflow-hidden select-none"
            style={{ touchAction: 'pan-y' }}
        >
            {/* ─── Full-Bleed Ambient Lighting (Clean, No Dark Edge Shadows) ─── */}
            <div 
                className="absolute -inset-10 bg-cover bg-center opacity-30 blur-[90px] saturate-150 pointer-events-none transition-all duration-1000"
                style={{ backgroundImage: coverUrl ? `url(${coverUrl})` : 'none' }}
            />

            <div 
                className="absolute inset-0 pointer-events-none transition-all duration-1000"
                style={{
                    background: `
                        radial-gradient(ellipse at 50% 30%, ${theme.glowRgba} 0%, ${theme.ambientRgba} 45%, rgba(9, 9, 11, 0.6) 80%, rgba(9, 9, 11, 0.95) 100%)
                    `
                }}
            />



            {/* ─── Top Header (Clean: Chevron Down + Now Playing + Share) ─── */}
            <div 
                className="relative z-20 flex items-center justify-between pt-1 pb-2 shrink-0"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <button 
                    onClick={onCollapse} 
                    className="p-2 text-neutral-300 hover:text-white active:scale-90 transition-all rounded-full hover:bg-white/10"
                    aria-label="Collapse player"
                >
                    <ChevronDown className="w-6 h-6" />
                </button>

                <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                    Now Playing
                </span>

                <button 
                    onClick={onShare} 
                    className="p-2 text-neutral-300 hover:text-white active:scale-90 transition-all rounded-full hover:bg-white/10"
                    aria-label="Share song"
                >
                    <Share2 className="w-5 h-5" />
                </button>
            </div>

            {/* ─── Center Interactive Area ─── */}
            <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center my-1 overflow-hidden">
                <AnimatePresence mode="wait">
                    {/* VIEW 1: Artwork & Soundwave (Clean, No Black Drop Shadow) */}
                    {activeTab === 'player' && (
                        <motion.div 
                            key="artwork-view"
                            initial={{ opacity: 0, scale: 0.94 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.94 }}
                            transition={{ duration: 0.22 }}
                            className="flex flex-col items-center justify-center w-full h-full"
                        >
                            <div className="relative flex items-center justify-center w-full">
                                {/* Ambient Breathing Aura Glow */}
                                <motion.div 
                                    animate={isPlaying ? {
                                        scale: [1, 1.08, 0.98, 1.05, 1],
                                        opacity: [0.35, 0.65, 0.35, 0.55, 0.35]
                                    } : { scale: 1, opacity: 0.2 }}
                                    transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute -inset-8 rounded-[40px] blur-3xl pointer-events-none transition-all duration-700"
                                    style={{
                                        background: `radial-gradient(circle, ${theme.glowRgba} 0%, ${theme.ambientRgba} 70%, transparent 100%)`
                                    }}
                                />

                                {/* Album Art Card — Crisp clean border, NO black drop shadow */}
                                <motion.div 
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setActiveTab('lyrics')}
                                    className="w-full aspect-square max-w-[295px] sm:max-w-[325px] rounded-3xl overflow-hidden border border-white/15 relative z-10 bg-neutral-900 mx-auto cursor-pointer"
                                    title="Tap to view lyrics"
                                >
                                    <img 
                                        src={coverUrl} 
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = '/logo.png';
                                        }}
                                        alt={currentSong.name} 
                                        className="w-full h-full object-cover select-none" 
                                    />
                                </motion.div>
                            </div>

                            {/* Fluid Soundwave Visualizer below Artwork */}
                            <div className="relative flex items-center justify-center gap-1 h-6 mt-4 z-10">
                                {[...Array(18)].map((_, i) => (
                                    <motion.span
                                        key={i}
                                        animate={isPlaying ? {
                                            scaleY: [0.2, 0.45 + (i % 5) * 0.15, 0.25, 0.85, 0.2]
                                        } : { scaleY: 0.15 }}
                                        transition={{
                                            duration: 1.2 + (i % 4) * 0.2,
                                            repeat: Infinity,
                                            ease: "easeInOut",
                                            delay: (i * 0.07) % 0.5
                                        }}
                                        className="w-[3px] h-5 rounded-full origin-bottom"
                                        style={{ background: theme.primary }}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* VIEW 2: Pure Lyrics Between Two Dividing Lines (NO Box, NO Card Outline) */}
                    {activeTab === 'lyrics' && (
                        <motion.div 
                            key="lyrics-view"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            className="w-full flex-1 min-h-0 flex flex-col justify-between relative -mx-5 px-5 my-1"
                        >
                            {/* Thin Top Dividing Line */}
                            <div className="w-full h-[1px] bg-white/10 shrink-0" />

                            {/* Expansive Scrolling Lyrics Stream with Frosted Blur */}
                            <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col justify-center backdrop-blur-md">
                                {loadingLyrics ? (
                                    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-neutral-400">
                                        <motion.div 
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                            className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full"
                                        />
                                        <span className="text-xs">Fetching lyrics...</span>
                                    </div>
                                ) : isSynced && lyrics.length > 0 ? (
                                    <div 
                                        ref={lyricsScrollRef}
                                        className="flex-1 overflow-y-auto px-4 py-8 space-y-5 text-center hide-scrollbar"
                                        style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)' }}
                                    >
                                        {lyrics.map((line, idx) => {
                                            const isCurrent = idx === activeIndex;
                                            return (
                                                <div
                                                    key={idx}
                                                    ref={isCurrent ? activeLineRef : null}
                                                    onClick={() => {
                                                        if (seekTo) seekTo(line.time);
                                                    }}
                                                    className={`cursor-pointer transition-all duration-300 py-1.5 px-3 select-none ${
                                                        isCurrent
                                                            ? 'text-white text-lg sm:text-xl font-bold tracking-wide scale-100'
                                                            : 'text-neutral-400/40 text-sm sm:text-base font-medium hover:text-white/80'
                                                    }`}
                                                    style={isCurrent ? { textShadow: `0 0 20px ${theme.glowRgba}` } : undefined}
                                                >
                                                    {line.text}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : plainLyrics ? (
                                    <div 
                                        className="flex-1 overflow-y-auto px-5 py-8 text-center hide-scrollbar"
                                        style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)' }}
                                    >
                                        <p className="text-neutral-200 text-sm sm:text-base leading-loose whitespace-pre-line font-medium">
                                            {plainLyrics}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center gap-1.5 text-neutral-400">
                                        <Mic2 className="w-8 h-8 opacity-30 mb-1" />
                                        <p className="text-sm font-medium">No lyrics available</p>
                                    </div>
                                )}
                            </div>

                            {/* Thin Bottom Dividing Line */}
                            <div className="w-full h-[1px] bg-white/10 shrink-0" />
                        </motion.div>
                    )}

                    {/* VIEW 3: Full-Height Queue with Grounded Drag & Drop (NO Awkward Lifting) */}
                    {activeTab === 'queue' && (
                        <motion.div 
                            key="queue-view"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.22 }}
                            className="w-full flex-1 min-h-0 flex flex-col max-w-md mx-auto"
                        >
                            <div className="flex items-center justify-between px-3 pb-2 border-b border-white/10 shrink-0">
                                <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                                    Up Next ({upcomingSongs.length})
                                </span>
                                <span className="text-[11px] text-neutral-400">
                                    Hold handle to reorder
                                </span>
                            </div>

                            {/* Full-Height Scrollable Queue */}
                            <div 
                                className="w-full flex-1 overflow-y-auto py-2 space-y-1.5 hide-scrollbar min-h-0"
                                style={{ maskImage: 'linear-gradient(to bottom, black 90%, transparent 100%)' }}
                            >
                                {upcomingSongs.length > 0 ? (
                                    <Reorder.Group
                                        axis="y"
                                        values={upcomingSongs}
                                        onReorder={handleReorder}
                                        className="space-y-1.5"
                                    >
                                        {upcomingSongs.map((song, idx) => (
                                            <MobileQueueRow
                                                key={song.id}
                                                song={song}
                                                index={idx}
                                                onPlay={() => playSong(song, 'queue')}
                                                onRemove={() => removeQueueItem(idx)}
                                            />
                                        ))}
                                    </Reorder.Group>
                                ) : (
                                    <div className="flex flex-col items-center justify-center gap-2 py-16 text-neutral-400">
                                        <ListMusic className="w-8 h-8 opacity-40 mb-1" />
                                        <p className="text-sm font-medium">Queue is empty</p>
                                        <p className="text-xs text-neutral-500">Auto-play will load upcoming tracks</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ─── Mode Switcher Pill (Spaced Nicely Above Song Title) ─── */}
            <div className="relative z-20 flex items-center justify-center mt-3 mb-2 shrink-0">
                <div className="flex items-center p-1 rounded-full bg-black/50 backdrop-blur-2xl border border-white/10 shadow-lg">
                    {(['player', 'lyrics', 'queue'] as const).map((tab) => {
                        const isActive = activeTab === tab;
                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 capitalize relative flex items-center gap-1.5 ${
                                    isActive ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
                                }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="mobilePlayerPill"
                                        className="absolute inset-0 bg-white/[0.16] rounded-full border border-white/10 shadow-sm"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-1.5">
                                    {tab === 'player' && <Disc3 className="w-3.5 h-3.5" />}
                                    {tab === 'lyrics' && <Mic2 className="w-3.5 h-3.5" />}
                                    {tab === 'queue' && <ListMusic className="w-3.5 h-3.5" />}
                                    {tab === 'player' ? 'Song' : tab}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ─── Bottom Persistent Controls Dock ─── */}
            <div className="relative z-20 w-full max-w-md mx-auto space-y-2.5 pb-1 shrink-0">
                {/* Track Info & Action Icons */}
                <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="marquee-container">
                            <h2 
                                className={`text-xl sm:text-2xl font-bold text-white tracking-tight leading-tight ${currentSong.name.length > 22 ? 'marquee-text' : ''}`}
                                title={currentSong.name}
                            >
                                {currentSong.name}
                            </h2>
                        </div>
                        <p className="text-neutral-400 text-sm font-medium truncate mt-0.5">
                            {currentSong.artist}
                        </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {/* Onboarding Tooltip */}
                        <AnimatePresence>
                            {showLikeTooltip && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="absolute -top-12 right-12 bg-neutral-900 border border-white/15 text-white text-xs px-3 py-2 rounded-xl shadow-xl z-50 pointer-events-none"
                                >
                                    Like songs to save them!
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Like Button */}
                        <button 
                            onClick={(e) => { onLike(e); markLikeTooltipSeen(); }}
                            className="p-2.5 rounded-full hover:bg-white/10 active:scale-75 transition-all"
                            aria-label={isLiked ? "Unlike song" : "Like song"}
                        >
                            <Heart className={`w-6 h-6 transition-colors ${isLiked ? 'fill-rose-500 text-rose-500' : 'text-neutral-300'}`} />
                        </button>

                        {/* Playlist Add */}
                        <button 
                            onClick={onPlaylistClick}
                            className="p-2.5 rounded-full hover:bg-white/10 active:scale-75 transition-all text-neutral-300 hover:text-white"
                            aria-label="Add to playlist"
                        >
                            <PlusCircle className="w-6 h-6" />
                        </button>

                        {/* Download */}
                        <button 
                            onClick={onDownload}
                            disabled={downloading || isDownloaded}
                            className="p-2.5 rounded-full hover:bg-white/10 active:scale-75 transition-all relative text-neutral-300"
                            title={isPro ? (isDownloaded ? "Downloaded" : downloading ? `${downloadPercent >= 0 ? downloadPercent + '%' : '...'}` : "Download for offline") : "Go Pro to Download"}
                        >
                            {downloading ? (
                                <div className="relative w-6 h-6 flex items-center justify-center">
                                    <svg className="w-6 h-6 -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="15" fill="none" stroke="white" strokeWidth="3" className="opacity-15" />
                                        <circle 
                                            cx="18" cy="18" r="15" fill="none" 
                                            stroke={theme.primary}
                                            strokeWidth="3.5" 
                                            strokeLinecap="round"
                                            strokeDasharray="94.25" 
                                            strokeDashoffset={downloadPercent >= 0 ? 94.25 - (94.25 * downloadPercent / 100) : 70}
                                            className={downloadPercent < 0 ? 'animate-spin origin-center' : 'transition-all duration-300'}
                                        />
                                    </svg>
                                </div>
                            ) : isDownloaded ? (
                                <CheckCircle className="w-6 h-6 text-emerald-400" />
                            ) : isPro ? (
                                <Download className="w-6 h-6" />
                            ) : (
                                <>
                                    <Download className="w-6 h-6 opacity-60" />
                                    <Crown className="w-3 h-3 text-amber-400 absolute top-1 right-1 fill-amber-400" />
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Progress Bar & Timestamps */}
                <div className="space-y-1 pt-1">
                    <div className={`relative h-2 bg-white/15 rounded-full overflow-hidden flex items-center ${isControlDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        <div 
                            className="h-full rounded-full transition-all duration-100"
                            style={{ 
                                width: `${(localSeek / (duration || 1)) * 100}%`,
                                background: theme.gradient || '#ffffff'
                            }}
                        />
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
                    <div className="flex justify-between text-[11px] font-mono text-neutral-400">
                        <span>{formatTime(localSeek)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Host Disabled Notice */}
                {isControlDisabled && (
                    <div className="flex items-center justify-center gap-1.5 py-1 px-3 rounded-full bg-white/5 border border-white/10 self-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-[11px] text-amber-200/90 font-medium">Host controls playback</span>
                    </div>
                )}

                {/* Playback Controls (Shuffle, Prev, Big Play, Next, Repeat) */}
                <div className="flex items-center justify-between px-2 pt-0.5">
                    <button 
                        onClick={onToggleShuffle} 
                        disabled={isControlDisabled}
                        className={`p-2 rounded-full transition-colors ${isShuffle ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'} ${isControlDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                        style={isShuffle ? { color: theme.primary } : undefined}
                        title="Shuffle"
                    >
                        <Shuffle className="w-5 h-5" />
                    </button>
                    
                    <div className="flex items-center gap-6">
                        <button 
                            onClick={onPrev} 
                            disabled={isControlDisabled}
                            className={`p-2 text-white hover:text-neutral-200 active:scale-90 transition-all ${isControlDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                            title="Previous song"
                        >
                            <SkipBack className="w-7 h-7 fill-white text-white" />
                        </button>

                        <button 
                            onClick={onTogglePlay}
                            disabled={isControlDisabled}
                            className={`w-16 h-16 bg-white text-black rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(255,255,255,0.22)] active:scale-95 hover:scale-105 transition-all ${
                                isControlDisabled ? 'opacity-40 cursor-not-allowed' : ''
                            }`}
                            title={isControlDisabled ? "Host controls playback" : (isPlaying ? "Pause" : "Play")}
                        >
                            {isPlaying ? (
                                <Pause className="w-7 h-7 fill-black text-black" />
                            ) : (
                                <Play className="w-7 h-7 fill-black text-black ml-1" />
                            )}
                        </button>

                        <button 
                            onClick={onNext} 
                            disabled={isControlDisabled}
                            className={`p-2 text-white hover:text-neutral-200 active:scale-90 transition-all ${isControlDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                            title="Next song"
                        >
                            <SkipForward className="w-7 h-7 fill-white text-white" />
                        </button>
                    </div>

                    <button 
                        onClick={onToggleRepeat} 
                        disabled={isControlDisabled}
                        className={`p-2 rounded-full transition-colors relative ${repeatMode !== 'off' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'} ${isControlDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                        style={repeatMode !== 'off' ? { color: theme.primary } : undefined}
                        title="Repeat"
                    >
                        <Repeat className="w-5 h-5" />
                        {repeatMode === 'one' && (
                            <span 
                                className="absolute top-1 right-1 text-[8px] font-bold text-black rounded-full w-3 h-3 flex items-center justify-center"
                                style={{ background: theme.primary }}
                            >
                                1
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
