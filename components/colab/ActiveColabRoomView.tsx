"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useColab } from '@/contexts/ColabContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { 
  Copy, Check, Users, Radio, Crown, LogOut, Trash2, 
  Plus, Music, Shield, RefreshCw, Sparkles, Volume2, Smile, Play 
} from 'lucide-react';
import AddSongToColabModal from './AddSongToColabModal';
import ColabEmojiPickerModal from './ColabEmojiPickerModal';
import HostLeaveModal from './HostLeaveModal';
import { Song } from '@/lib/types';
import { ColabBlendGenerator } from '@/core/colab/ColabBlendGenerator';
import { ColabQueueItem } from '@/lib/colabTypes';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

const REACTION_EMOJIS = ['🔥', '❤️', '💃', '🎧', '⚡', '🎉'];

export default function ActiveColabRoomView() {
  const { 
    room, roomId, isHost, leaveRoom, endRoom, 
    sendReaction, removeFromColabQueue, dismissUpcomingSong, playColabSong, 
    setControlMode, syncWithHost 
  } = useColab();
  const player = usePlayer();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [blendedItems, setBlendedItems] = useState<ColabQueueItem[]>([]);
  const [localDismissedIds, setLocalDismissedIds] = useState<Set<string>>(new Set());

  if (!room) return null;

  const canControl = isHost || room.controlMode === 'collab';
  const currentSong = room.currentSong || player.currentSong;
  const songImg = currentSong?.image 
    ? (Array.isArray(currentSong.image) ? currentSong.image[2] || currentSong.image[0] : currentSong.image) 
    : '/logo.png';

  const membersList = useMemo(() => {
    if (!room?.members) return [];
    return Object.values(room.members).sort((a, b) => {
      if (a.isHost) return -1;
      if (b.isHost) return 1;
      return (a.joinedAt || 0) - (b.joinedAt || 0) || a.id.localeCompare(b.id);
    });
  }, [room?.members]);

  const otherMembers = useMemo(() => {
    return membersList.filter(m => !m.isHost);
  }, [membersList]);
  const nextHostName = otherMembers[0]?.name;

  const currentSongId = currentSong?.id;
  const membersKey = useMemo(() => {
    return membersList.map(m => m.id).join('_');
  }, [membersList]);

  // Generate multi-user blended recommendations whenever current song or room members change (HOST ONLY)
  useEffect(() => {
    if (!currentSongId || !isHost) return;

    let isMounted = true;
    const dismissed = new Set([
      ...(room?.dismissedUpcomingIds || []),
      ...Array.from(localDismissedIds),
    ]);

    ColabBlendGenerator.generateBlend({
      currentSong,
      members: membersList,
      dismissedIds: dismissed,
      limit: 10,
    }).then((items) => {
      if (isMounted) {
        setBlendedItems(items);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentSongId, membersKey, localDismissedIds, isHost]);

  // Host broadcasts blended songs to Firestore when song changes OR when members blend updates
  const lastSyncedSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isHost || !roomId || !currentSongId || blendedItems.length === 0) return;
    const songsToSync = blendedItems.map(item => item.song);
    const currentSignature = `${currentSongId}_${membersKey}_${songsToSync.map(s => s.id).join(',')}`;
    if (lastSyncedSignatureRef.current === currentSignature) return;
    lastSyncedSignatureRef.current = currentSignature;

    const roomRef = doc(db, 'colab_rooms', roomId);
    updateDoc(roomRef, {
      upcomingSongs: songsToSync,
      upcomingSong: songsToSync[0] || null,
    }).catch(() => {});
  }, [isHost, roomId, currentSongId, membersKey, blendedItems]);

  const displayQueue = useMemo<ColabQueueItem[]>(() => {
    // 1. Manual songs queued by users
    const manualQueue: ColabQueueItem[] = (room?.queue || []).map((song) => ({
      song,
      isManual: true,
    }));

    // 2. Autoplay candidates: from blendedItems or fallback room.upcomingSongs
    const dismissed = new Set([
      ...(room?.dismissedUpcomingIds || []),
      ...Array.from(localDismissedIds),
    ]);
    const manualIds = new Set(manualQueue.map(m => m.song.id));
    const currentId = currentSong?.id;

    const autoplayItems: ColabQueueItem[] = [];

    const candidates: ColabQueueItem[] = blendedItems.length > 0
      ? blendedItems
      : (room?.upcomingSongs || []).map(song => ({ song, isManual: false }));

    for (const item of candidates) {
      if (!item.song || !item.song.id) continue;
      if (item.song.id === currentId) continue;
      if (manualIds.has(item.song.id)) continue;
      if (dismissed.has(item.song.id)) continue;
      if (autoplayItems.some(existing => existing.song.id === item.song.id)) continue;

      autoplayItems.push(item);
    }

    const combined = [...manualQueue, ...autoplayItems];
    return combined.slice(0, 7);
  }, [room?.queue, room?.upcomingSongs, room?.dismissedUpcomingIds, blendedItems, localDismissedIds, currentSong?.id]);

  const handleRemove = (item: ColabQueueItem, index: number) => {
    if (!canControl) return;
    if (item.isManual) {
      removeFromColabQueue(index);
    } else {
      setLocalDismissedIds(prev => new Set(prev).add(item.song.id));
      dismissUpcomingSong(item.song.id);
    }
  };

  const getSongImg = (song: Song | null) => {
    if (!song?.image) return '/logo.png';
    return Array.isArray(song.image) ? song.image[1] || song.image[0] : song.image;
  };


  const handleCopyCode = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!roomId || typeof window === 'undefined') return;
    const shareUrl = `${window.location.origin}/colab?room=${roomId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-20">
      {/* ─── Top Session Header Bar ─── */}
      <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 md:p-5 rounded-2xl bg-[#121214] border border-white/10 shadow-xl backdrop-blur-md">
        {/* End / Leave Session Circle Button (Top-Right Corner) */}
        {isHost ? (
          <button
            onClick={() => setIsLeaveModalOpen(true)}
            className="absolute top-3.5 right-3.5 md:top-1/2 md:-translate-y-1/2 md:right-4 w-8 h-8 rounded-full bg-white/[0.04] hover:bg-red-500/15 active:scale-95 border border-white/[0.08] hover:border-red-500/20 text-zinc-400 hover:text-red-400 transition-colors flex items-center justify-center cursor-pointer shrink-0 z-10"
            title="Leave or end session"
            aria-label="Leave or end session"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={leaveRoom}
            className="absolute top-3.5 right-3.5 md:top-1/2 md:-translate-y-1/2 md:right-4 w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/[0.08] text-zinc-400 hover:text-white transition-colors flex items-center justify-center cursor-pointer shrink-0 z-10"
            title="Leave this room"
            aria-label="Leave session"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="flex items-center gap-3 pr-10 md:pr-0">
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-300 shrink-0">
            <Radio className="w-5 h-5 text-purple-400 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base md:text-lg font-bold text-white tracking-tight truncate">{room.name}</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live
              </span>
            </div>
            <p className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
              <span>Host: <strong className="text-zinc-200">{room.hostName}</strong></span>
              <span>•</span>
              <span>{membersList.length} listening</span>
            </p>
          </div>
        </div>

        {/* Room Code & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:mr-10">
          {/* Room Code Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-zinc-300">
            <span className="font-semibold text-zinc-200 tracking-widest">{roomId}</span>
            <button 
              onClick={handleCopyCode} 
              className="text-zinc-400 hover:text-white transition-colors p-0.5"
              title="Copy Room Code"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Share Link Button */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 text-xs font-medium transition-colors"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
            <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
          </button>

          {/* Sync Button */}
          <button
            onClick={syncWithHost}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 text-xs font-medium transition-colors"
            title="Resync audio with session"
          >
            <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* ─── Main Content Grid: Hero Playing + Sidebar Details ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Now Playing Hero & Reactions */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-b from-[#18181d] to-[#101012] border border-white/[0.08] shadow-2xl flex flex-col md:flex-row items-center gap-6 md:gap-8 relative overflow-hidden">
            {/* Background Glow */}
            <div 
              className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-purple-600/15 blur-3xl pointer-events-none" 
            />

            {/* Album Cover with Animated Visualizer Halo */}
            <div className="relative w-44 h-44 md:w-52 md:h-52 rounded-2xl overflow-hidden shadow-2xl shrink-0 group border border-white/10">
              <img 
                src={songImg} 
                alt={currentSong?.name || 'Song'} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {/* Playing indicator overlay */}
              {room.isPlaying && (
                <div className="absolute bottom-2.5 right-2.5 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-1">
                  <div className="w-1 h-3 bg-purple-400 animate-pulse rounded-full" />
                  <div className="w-1 h-4 bg-purple-300 animate-pulse delay-75 rounded-full" />
                  <div className="w-1 h-2 bg-purple-500 animate-pulse delay-150 rounded-full" />
                </div>
              )}
            </div>

            {/* Track Info & Mode */}
            <div className="flex-1 flex flex-col text-center md:text-left min-w-0">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  Now Streaming
                </span>
                <span className="text-[10px] text-zinc-400">
                  {room.controlMode === 'collab' ? '🤝 Everyone Can DJ' : '👑 Host Controls'}
                </span>
              </div>

              <h1 className="text-xl md:text-2xl font-extrabold text-white truncate tracking-tight mb-1" title={currentSong?.name}>
                {currentSong?.name || 'No song selected'}
              </h1>
              <p className="text-sm text-zinc-400 truncate">
                {currentSong?.artist || 'Select a song to start'}
              </p>

              {/* Host Control Mode Switcher / Listener Notice */}
              {isHost ? (
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-center md:justify-start gap-3">
                  <span className="text-xs text-zinc-400">DJ Permission:</span>
                  <button
                    onClick={() => setControlMode(room.controlMode === 'collab' ? 'host-only' : 'collab')}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/[0.08] transition-colors"
                  >
                    {room.controlMode === 'collab' ? 'Switch to Host Only' : 'Allow Friends to DJ'}
                  </button>
                </div>
              ) : room.controlMode === 'host-only' ? (
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-center md:justify-start gap-2">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs text-amber-300/80">Host controls playback — sit back and enjoy</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* ─── Floating Live Emoji Reactions Toolbar ─── */}
          <div className="p-4 rounded-2xl bg-[#121214] border border-white/10 flex flex-wrap items-center justify-between gap-2 shadow-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-white">Live Reactions:</span>
            </div>
            
            <div className="flex items-center gap-1.5 md:gap-2">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/20 text-lg md:text-xl flex items-center justify-center transition-all hover:scale-125 active:scale-95 cursor-pointer shadow-sm"
                  title={`Send ${emoji}`}
                >
                  {emoji}
                </button>
              ))}

              <button
                onClick={() => setIsEmojiPickerOpen(true)}
                className="h-9 md:h-10 px-2.5 md:px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-300 hover:text-white flex items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                title="All Emojis & Reactions"
              >
                <Smile className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-zinc-400">+</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: Active Members & Shared Queue */}
        <div className="flex flex-col gap-6">
          
          {/* Members Shelf */}
          <div className="p-4 md:p-5 rounded-2xl bg-[#121214] border border-white/10 flex flex-col gap-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">In the Session ({membersList.length})</h3>
              </div>
            </div>

            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto hide-scrollbar">
              {membersList.map((member) => (
                <div 
                  key={member.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0">
                      {member.avatar ? (
                        <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-bold text-zinc-300">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-white truncate">{member.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {member.isHost ? (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-400/10 text-amber-300 border border-amber-400/20">
                        <Crown className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                        Host
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        Listening
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shared Colab Queue Shelf */}
          <div className="p-4 md:p-5 rounded-2xl bg-[#121214] border border-white/10 flex flex-col gap-3 shadow-lg flex-1">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-zinc-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Queue ({displayQueue.length})
                </h3>
              </div>

              {canControl && (
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 text-xs font-medium border border-white/[0.08] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Add Songs</span>
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto hide-scrollbar flex-1">
              {displayQueue.length > 0 ? (
                displayQueue.map((item, idx) => {
                  const { song, isManual, forUserName, isBlend } = item;
                  const img = getSongImg(song);

                  return (
                    <div 
                      key={`${song.id}-${idx}`}
                      className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2 flex-1">
                        <span className="text-[10px] text-zinc-500 font-mono w-4 shrink-0 text-center">
                          {idx + 1}
                        </span>
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-900 shrink-0">
                          {img ? (
                            <img src={img} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music className="w-3 h-3 text-zinc-600" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-medium text-white truncate group-hover:text-zinc-200 transition-colors">
                              {song.name}
                            </p>
                            {isManual && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-zinc-300 border border-white/10 shrink-0 font-medium">
                                Queue
                              </span>
                            )}
                            {!isManual && forUserName && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-zinc-300 border border-white/10 shrink-0 font-medium">
                                For {forUserName}
                              </span>
                            )}
                            {!isManual && isBlend && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 font-medium">
                                Blend
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-400 truncate">{song.artist}</p>
                        </div>
                      </div>

                      {canControl && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => playColabSong(song)}
                            className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            title="Play now"
                            aria-label="Play now"
                          >
                            <Play className="w-3 h-3 fill-current" />
                          </button>
                          <button
                            onClick={() => handleRemove(item, idx)}
                            className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            title="Remove"
                            aria-label="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
                  <p>Queue is empty.</p>
                  {canControl && (
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="text-xs text-zinc-300 hover:text-white underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Search & add songs</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Add Song Modal */}
      <AddSongToColabModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />

      {/* Full Emoji Picker Modal */}
      <ColabEmojiPickerModal
        isOpen={isEmojiPickerOpen}
        onClose={() => setIsEmojiPickerOpen(false)}
        onSelectEmoji={(emoji) => sendReaction(emoji)}
      />

      {/* Host Leave / Terminate Modal */}
      <HostLeaveModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onLeaveAndTransfer={leaveRoom}
        onTerminate={endRoom}
        nextHostName={nextHostName}
        hasOtherMembers={otherMembers.length > 0}
      />
    </div>
  );
}
