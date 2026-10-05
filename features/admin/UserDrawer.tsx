"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Crown, 
  Shield, 
  Ban, 
  CheckCircle, 
  Edit, 
  Copy, 
  Activity, 
  Clock, 
  Smartphone, 
  ListMusic, 
  Heart, 
  Send,
  Music,
  Zap,
  UserX,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Play,
  Pause
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/contexts/ToastContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { Song } from '@/lib/types';

function getSongArtwork(img: any): string {
  if (!img) return '';
  if (Array.isArray(img)) {
    return img[img.length - 1] || img[0] || '';
  }
  if (typeof img === 'string') return img;
  if (typeof img === 'object' && img.url) return img.url;
  return '';
}

interface UserDrawerProps {
  user: any | null;
  drawerData: {
    playlistsCount: number | null;
    likesCount: number | null;
    playlists: any[];
    likedSongs: Song[];
    loading: boolean;
  };
  fs: any;
  onClose: () => void;
  onGrantPro: (user: any) => void;
  onRevokePro: (uid: string, name: string) => void;
  onBlockToggle: (uid: string, isBlocked: boolean, name: string) => void;
  onEditName: (uid: string, name: string) => void;
  onSendDirectMessage: (uid: string, name: string, title: string, message: string) => Promise<void>;
}

export function UserDrawer({
  user,
  drawerData,
  fs,
  onClose,
  onGrantPro,
  onRevokePro,
  onBlockToggle,
  onEditName,
  onSendDirectMessage,
}: UserDrawerProps) {
  const { showToast } = useToast();
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();

  const [activeTab, setActiveTab] = useState<'overview' | 'playlists' | 'likes'>('overview');
  const [expandedPlaylistId, setExpandedPlaylistId] = useState<string | null>(null);

  const [directTitle, setDirectTitle] = useState('');
  const [directMessage, setDirectMessage] = useState('');
  const [sendingDirect, setSendingDirect] = useState(false);

  if (!user) return null;

  const today = new Date().toISOString().split('T')[0];
  const playsToday = user.playStats?.date === today ? (user.playStats?.count || 0) : 0;
  const totalPlays = user.totalPlays ?? (user.playStats?.count || 0);
  const streak = user.playStats?.streak || 0;

  const isPro = user.role === 'pro';
  const proExpiryDate = user.pro_expiry_date?.seconds ? new Date(user.pro_expiry_date.seconds * 1000) : null;
  const isExpired = proExpiryDate ? proExpiryDate < new Date() : false;
  const daysLeft = proExpiryDate ? Math.ceil((proExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  // Active status
  const lastActiveDate = user.lastActive?.seconds ? new Date(user.lastActive.seconds * 1000) : null;
  const isOnlineRecently = lastActiveDate ? (Date.now() - lastActiveDate.getTime()) < 15 * 60 * 1000 : false;
  const lastActiveText = lastActiveDate 
    ? lastActiveDate.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
    : 'Never';

  const handleCopyUid = () => {
    navigator.clipboard.writeText(user.uid);
    showToast('UID copied', 'success');
  };

  const handleSendDirect = async () => {
    if (!directTitle.trim() || !directMessage.trim()) {
      showToast('Enter title and message', 'error');
      return;
    }
    setSendingDirect(true);
    try {
      await onSendDirectMessage(user.uid, user.name || user.displayName || 'User', directTitle.trim(), directMessage.trim());
      showToast('Message sent to user', 'success');
      setDirectTitle('');
      setDirectMessage('');
    } catch {
      showToast('Failed to send message', 'error');
    } finally {
      setSendingDirect(false);
    }
  };

  const toggleExpandPlaylist = (id: string) => {
    setExpandedPlaylistId(prev => prev === id ? null : id);
  };

  const handlePlaySong = (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    if (!song) return;
    if (currentSong?.id === song.id) {
      togglePlay();
    } else {
      playSong(song);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Slide-out Panel */}
        <div className="fixed inset-y-0 right-0 max-w-full flex pl-4">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="w-screen max-w-md bg-[#121214] border-l border-white/10 shadow-2xl flex flex-col h-full overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#161618]">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-mono tracking-wider text-zinc-400">User Profile</span>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Overview Card (Sticky Top of Drawer) */}
            <div className="p-4 border-b border-white/5 bg-[#141416] shrink-0 space-y-3">
              <div className="flex items-center gap-3.5">
                <img
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.name || 'User')}&background=27272a&color=fff`}
                  alt=""
                  className="w-11 h-11 rounded-full object-cover shrink-0 border border-white/10"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className={`font-bold text-white ${fs.md} truncate`}>{user.name || user.displayName || 'Unknown'}</h3>
                    <button
                      onClick={() => onEditName(user.uid, user.name || user.displayName || '')}
                      className="p-0.5 text-zinc-400 hover:text-white transition-colors"
                      title="Edit Name"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 truncate">{user.email || 'No email'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[150px]">{user.uid}</span>
                    <button onClick={handleCopyUid} className="text-zinc-500 hover:text-white" title="Copy UID">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                {user.role === 'admin' && (
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 font-medium flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Admin
                  </span>
                )}
                {isPro && !isExpired && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Pro ({daysLeft}d left)
                  </span>
                )}
                {isPro && isExpired && (
                  <span className="px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 font-medium">
                    Pro Expired
                  </span>
                )}
                {!isPro && (
                  <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-zinc-400">
                    Normal
                  </span>
                )}
                {user.isBlocked && (
                  <span className="px-2 py-0.5 rounded-md bg-red-500/20 border border-red-500/30 text-red-400 font-medium flex items-center gap-1">
                    <Ban className="w-3 h-3" /> Banned
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-zinc-400 flex items-center gap-1">
                  <Smartphone className="w-3 h-3" /> {user.device || 'Web'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-zinc-400 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnlineRecently ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                  {isOnlineRecently ? 'Online' : lastActiveText}
                </span>
              </div>

              {/* Section Tabs: Overview | Playlists | Liked Songs */}
              <div className="flex gap-1 bg-[#18181b] p-1 rounded-xl border border-white/5">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap text-center ${
                    activeTab === 'overview'
                      ? 'bg-white/15 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('playlists')}
                  className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap text-center flex items-center justify-center gap-1 ${
                    activeTab === 'playlists'
                      ? 'bg-white/15 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <ListMusic className="w-3 h-3" />
                  Playlists ({drawerData.loading ? '...' : drawerData.playlists?.length ?? 0})
                </button>
                <button
                  onClick={() => setActiveTab('likes')}
                  className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap text-center flex items-center justify-center gap-1 ${
                    activeTab === 'likes'
                      ? 'bg-white/15 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Heart className="w-3 h-3" />
                  Likes ({drawerData.loading ? '...' : drawerData.likedSongs?.length ?? 0})
                </button>
              </div>
            </div>

            {/* Scrollable Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {/* Usage Metrics 2x2 Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-[11px] uppercase tracking-wider text-zinc-400 block mb-1">Total Plays</span>
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-zinc-400" />
                        <span className="text-lg font-bold text-white">{totalPlays}</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-[11px] uppercase tracking-wider text-zinc-400 block mb-1">Today Plays</span>
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-zinc-400" />
                        <span className="text-lg font-bold text-white">{playsToday}</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-[11px] uppercase tracking-wider text-zinc-400 block mb-1">Streak</span>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-zinc-400" />
                        <span className="text-lg font-bold text-white">{streak} days</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-[11px] uppercase tracking-wider text-zinc-400 block mb-1">Plan Status</span>
                      <span className="text-sm font-semibold text-white">
                        {isPro && !isExpired ? `Pro (${daysLeft}d)` : isPro ? 'Expired' : 'Normal'}
                      </span>
                    </div>
                  </div>

                  {/* Last Played Song */}
                  {user.lastPlayedSong && user.lastPlayedSong.name && (() => {
                    const lastPlayedImg = getSongArtwork(user.lastPlayedSong.image);
                    const lastSong: Song = {
                      id: user.lastPlayedSong.id || '',
                      name: user.lastPlayedSong.name,
                      artist: user.lastPlayedSong.artist || '',
                      album: '',
                      image: [lastPlayedImg],
                      url: '',
                      duration: 0,
                      has_lyrics: 'false',
                      language: '',
                      year: '',
                      release_date: ''
                    };
                    const isCurrent = currentSong?.id === lastSong.id;
                    const isThisPlaying = isCurrent && isPlaying;

                    return (
                      <div
                        onClick={(e) => handlePlaySong(e, lastSong)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isCurrent ? 'border-white/20 bg-white/[0.06]' : 'border-white/5 bg-white/[0.02] hover:bg-white/5'
                        }`}
                      >
                        <span className="text-[11px] uppercase tracking-wider text-zinc-400 block mb-2">Last Played Track</span>
                        <div className="flex items-center gap-3">
                          {lastPlayedImg ? (
                            <img src={lastPlayedImg} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 aspect-square border border-white/10" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                              <Music className="w-5 h-5 text-zinc-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className={`text-sm truncate ${isCurrent ? 'font-bold text-white' : 'font-semibold text-zinc-200'}`}>
                              {user.lastPlayedSong.name}
                            </h4>
                            <p className="text-xs text-zinc-400 truncate">{user.lastPlayedSong.artist || 'Unknown'}</p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handlePlaySong(e, lastSong)}
                              className={`p-2 rounded-lg transition-colors ${
                                isThisPlaying ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20 text-white'
                              }`}
                              title={isThisPlaying ? 'Pause' : 'Play song'}
                            >
                              {isThisPlaying ? (
                                <Pause className="w-3.5 h-3.5 fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                              )}
                            </button>

                            {lastSong.id && (
                              <Link
                                href={`/song/${encodeURIComponent(lastSong.id)}`}
                                target="_blank"
                                className="p-2 text-zinc-500 hover:text-white rounded-lg transition-colors"
                                title="Open Song Page"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Direct Message Form */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2.5">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-400 block">Direct Push / Notification</span>
                    <input
                      type="text"
                      placeholder="Title..."
                      value={directTitle}
                      onChange={(e) => setDirectTitle(e.target.value)}
                      maxLength={80}
                      className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 transition-colors"
                    />
                    <textarea
                      placeholder="Message content..."
                      value={directMessage}
                      onChange={(e) => setDirectMessage(e.target.value)}
                      rows={2}
                      maxLength={300}
                      className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 transition-colors resize-none"
                    />
                    <button
                      onClick={handleSendDirect}
                      disabled={sendingDirect || !directTitle.trim() || !directMessage.trim()}
                      className="w-full py-2 bg-white/10 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {sendingDirect ? 'Sending...' : 'Send Message'}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: PLAYLISTS & THEIR SONGS */}
              {activeTab === 'playlists' && (
                <div className="space-y-2.5">
                  {drawerData.loading ? (
                    <div className="text-center py-10 text-zinc-500 text-xs">
                      Loading playlists...
                    </div>
                  ) : !drawerData.playlists || drawerData.playlists.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-white/10 rounded-xl text-zinc-500 text-xs">
                      No playlists created by this user.
                    </div>
                  ) : (
                    drawerData.playlists.map((playlist: any) => {
                      const isExpanded = expandedPlaylistId === playlist.id;
                      const songList: Song[] = playlist.songs || [];

                      return (
                        <div
                          key={playlist.id}
                          className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden transition-all"
                        >
                          {/* Playlist Header Row */}
                          <div
                            onClick={() => toggleExpandPlaylist(playlist.id)}
                            className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors gap-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 border border-white/5">
                                <ListMusic className="w-4 h-4 text-zinc-400" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-bold text-white truncate">{playlist.name}</h4>
                                <p className="text-[11px] text-zinc-400 truncate">
                                  {songList.length} track{songList.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                            <div className="p-1 text-zinc-500">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>

                          {/* Expanded Song List */}
                          {isExpanded && (
                            <div className="border-t border-white/5 p-2 bg-[#101012] space-y-1.5">
                              {songList.length === 0 ? (
                                <p className="text-[11px] text-zinc-500 p-2 italic text-center">Playlist is empty.</p>
                              ) : (
                                songList.map((song: Song, idx: number) => {
                                  const isCurrent = currentSong?.id === song.id;
                                  const isThisPlaying = isCurrent && isPlaying;
                                  const artwork = getSongArtwork(song.image);

                                  return (
                                    <div
                                      key={song.id || idx}
                                      onClick={(e) => handlePlaySong(e, song)}
                                      className={`flex items-center justify-between gap-2.5 p-1.5 rounded-lg transition-all cursor-pointer ${
                                        isCurrent ? 'bg-white/10 border border-white/15' : 'hover:bg-white/5 border border-transparent'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        {artwork ? (
                                          <img
                                            src={artwork}
                                            alt=""
                                            className="w-8 h-8 rounded-md object-cover shrink-0 aspect-square border border-white/10"
                                          />
                                        ) : (
                                          <div className="w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                                            <Music className="w-3.5 h-3.5 text-zinc-500" />
                                          </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <h5 className={`text-xs truncate ${isCurrent ? 'font-bold text-white' : 'font-semibold text-zinc-200'}`}>
                                            {song.name}
                                          </h5>
                                          <p className="text-[10px] text-zinc-400 truncate">{song.artist || 'Unknown'}</p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          type="button"
                                          onClick={(e) => handlePlaySong(e, song)}
                                          className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
                                            isThisPlaying
                                              ? 'bg-white text-black'
                                              : 'bg-white/10 hover:bg-white/20 text-white'
                                          }`}
                                          title={isThisPlaying ? 'Pause' : 'Play song'}
                                        >
                                          {isThisPlaying ? (
                                            <Pause className="w-3.5 h-3.5 fill-current" />
                                          ) : (
                                            <Play className="w-3.5 h-3.5 fill-current" />
                                          )}
                                        </button>

                                        {song.id && (
                                          <Link
                                            href={`/song/${encodeURIComponent(song.id)}`}
                                            target="_blank"
                                            className="p-1.5 text-zinc-500 hover:text-white rounded-lg transition-colors"
                                            title="Open song page"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                          </Link>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 3: LIKED SONGS */}
              {activeTab === 'likes' && (
                <div className="space-y-1.5">
                  {drawerData.loading ? (
                    <div className="text-center py-10 text-zinc-500 text-xs">
                      Loading liked songs...
                    </div>
                  ) : !drawerData.likedSongs || drawerData.likedSongs.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-white/10 rounded-xl text-zinc-500 text-xs">
                      No liked songs yet.
                    </div>
                  ) : (
                    drawerData.likedSongs.map((song: Song, idx: number) => {
                      const isCurrent = currentSong?.id === song.id;
                      const isThisPlaying = isCurrent && isPlaying;
                      const artwork = getSongArtwork(song.image);

                      return (
                        <div
                          key={song.id || idx}
                          onClick={(e) => handlePlaySong(e, song)}
                          className={`flex items-center justify-between gap-2.5 p-2 rounded-xl transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-white/10 border border-white/20'
                              : 'bg-white/[0.02] border border-white/5 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {artwork ? (
                              <img
                                src={artwork}
                                alt=""
                                className="w-9 h-9 rounded-md object-cover shrink-0 aspect-square border border-white/10"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                                <Music className="w-4 h-4 text-zinc-500" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <h5 className={`text-xs truncate ${isCurrent ? 'font-bold text-white' : 'font-semibold text-zinc-200'}`}>
                                {song.name}
                              </h5>
                              <p className="text-[11px] text-zinc-400 truncate">{song.artist || 'Unknown'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handlePlaySong(e, song)}
                              className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
                                isThisPlaying
                                  ? 'bg-white text-black'
                                  : 'bg-white/10 hover:bg-white/20 text-white'
                              }`}
                              title={isThisPlaying ? 'Pause' : 'Play song'}
                            >
                              {isThisPlaying ? (
                                <Pause className="w-3.5 h-3.5 fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                              )}
                            </button>

                            {song.id && (
                              <Link
                                href={`/song/${encodeURIComponent(song.id)}`}
                                target="_blank"
                                className="p-1.5 text-zinc-500 hover:text-white rounded-lg transition-colors"
                                title="Open song page"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="p-3 border-t border-white/10 bg-[#161618] shrink-0">
              <div className="flex gap-2">
                {!isPro || isExpired ? (
                  <button
                    onClick={() => onGrantPro({ uid: user.uid, displayName: user.displayName, email: user.email })}
                    className="flex-1 py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap"
                  >
                    <Crown className="w-3.5 h-3.5" /> Grant Pro
                  </button>
                ) : (
                  <button
                    onClick={() => onRevokePro(user.uid, user.name || user.displayName || 'User')}
                    className="flex-1 py-2 px-3 rounded-lg bg-white/5 hover:bg-red-500/10 text-red-300 border border-red-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap"
                  >
                    <UserX className="w-3.5 h-3.5" /> Revoke Pro
                  </button>
                )}
                <button
                  onClick={() => onBlockToggle(user.uid, user.isBlocked, user.name || user.displayName || 'User')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                    user.isBlocked
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                  }`}
                >
                  {user.isBlocked ? (
                    <><CheckCircle className="w-3.5 h-3.5" /> Unblock</>
                  ) : (
                    <><Ban className="w-3.5 h-3.5" /> Block</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
