"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { getUserPlaylists, createPlaylist, deletePlaylist, renamePlaylist } from '@/lib/ranking';
import { Music, Heart, Plus, Sparkles, ChevronRight, Search, ListMusic, Trash2, Edit2 } from 'lucide-react';
import { motion } from 'framer-motion';
import Footer from '@/components/Footer';
import ImportModal from '@/reusable/ui/modals/ImportModal';
import ConfirmModal from '@/reusable/ui/modals/ConfirmModal';
import Link from 'next/link';
import Spinner from '@/reusable/animations/loading/Spinner';
import { useUI } from '@/contexts/UIContext';
import { useToast } from '@/contexts/ToastContext';
import { userPlaylistsCache } from '@/lib/userPlaylistsCache';
import ProPurchaseModal from '@/reusable/ui/modals/ProPurchaseModal';

export default function PlaylistsPage() {
  const { user, login, isAdmin, role, isPro } = useAuth();
  const { isProModalOpen, setProModalOpen } = useUI();
  const { showToast } = useToast();
  const { setQueueConfig } = usePlayer();
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [error, setError] = useState('');
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'playlists' | 'artists' | 'albums'>('playlists');

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Playlist creation modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalName, setCreateModalName] = useState('');

  // Playlist rename modal
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renamePlaylistId, setRenamePlaylistId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Long press state
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [longPressPlaylist, setLongPressPlaylist] = useState<string | null>(null);
  const [clickStartTime, setClickStartTime] = useState(0);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const playlistRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (user) {
      loadPlaylists();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadPlaylists = async () => {
    try {
      const data = await getUserPlaylists(user!.uid);
      setPlaylists(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!createModalName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const newPlaylist = await createPlaylist(user!.uid, createModalName, role as "normal" | "pro" | "admin");
      setPlaylists([...playlists, newPlaylist]);
      setCreateModalName('');
      setShowCreateModal(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async () => {
    if (!renamePlaylistId || !renameValue.trim()) return;
    try {
      await renamePlaylist(user!.uid, renamePlaylistId, renameValue.trim());
      
      // Update local state
      setPlaylists(playlists.map(p => 
        p.id === renamePlaylistId ? { ...p, name: renameValue.trim() } : p
      ));
      
      setShowRenameModal(false);
      setRenamePlaylistId(null);
      setRenameValue('');
    } catch (e) {
      console.error('Rename error:', e);
    }
  };

  const handleDelete = (id: string, name?: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const targetName = name || playlists.find(p => p.id === id)?.name || 'this playlist';
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Playlist',
      message: `Are you sure you want to delete "${targetName}"? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await deletePlaylist(user!.uid, id);
          userPlaylistsCache.removeSingle(user!.uid, id);
          setPlaylists(prev => prev.filter(p => p.id !== id));
          showToast(`Deleted "${targetName}"`, 'info');
        } catch (e) {
          console.error(e);
          showToast('Failed to delete playlist', 'error');
        }
        setConfirmConfig(p => ({ ...p, isOpen: false }));
      }
    });
  };

  const handleLongPressStart = (playlistId: string) => {
    setClickStartTime(Date.now());
    const timer = setTimeout(() => {
      // Calculate menu position from the playlist card element
      const el = playlistRefs.current[playlistId];
      if (el) {
        const rect = el.getBoundingClientRect();
        setMenuPosition({ top: rect.top + 8, right: window.innerWidth - rect.right + 8 });
      }
      setLongPressPlaylist(playlistId);
    }, 500); // 500ms for long press
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = (e?: React.MouseEvent | React.TouchEvent) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    // Check if it was a long press
    const pressDuration = Date.now() - clickStartTime;
    if (pressDuration >= 500 && e) {
      e.preventDefault();
      e.stopPropagation();
      return true; // Indicates it was a long press
    }
    return false;
  };

  const closeMenu = () => {
    setLongPressPlaylist(null);
    setMenuPosition(null);
  };

  const handleEditClick = (playlist: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRenamePlaylistId(playlist.id);
    setRenameValue(playlist.name);
    setShowRenameModal(true);
    closeMenu();
  };

  const handleDeleteClick = (playlistId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    // Use setTimeout to ensure menu closes before confirm modal opens
    setTimeout(() => handleDelete(playlistId), 50);
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-6 px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-purple-600/10 flex items-center justify-center mb-4">
          <Music className="w-10 h-10 text-purple-500" />
        </div>
        <h1 className="text-3xl font-bold text-white">Your Musical Sanctuary</h1>
        <p className="text-gray-400 max-w-sm">Sign in to create your personal playlists and keep your favorite vibes organized.</p>
        <button 
          onClick={login}
          className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-purple-900/20 active:scale-95"
        >
          Sign in to get started
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative pb-32">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-black/60 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Library</h1>
        <div className="flex gap-2">
          <Link
            href="/search"
            aria-label="Search"
            className="p-3 rounded-full bg-[#1E1E1E] hover:bg-[#2A2A2A] transition-colors flex items-center justify-center group"
          >
            <Search className="w-5 h-5 text-gray-300 group-hover:text-purple-500 transition-colors" />
          </Link>
          {user?.photoURL && (
            <button 
              aria-label="Profile"
              className="p-3 rounded-full bg-[#1E1E1E] hover:bg-[#2A2A2A] transition-colors flex items-center justify-center"
            >
              <img src={user.photoURL} alt="Profile" className="w-6 h-6 rounded-full object-cover" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 mt-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Your Collections</h2>
          <button 
            onClick={() => setImportModalOpen(true)}
            className="text-purple-500 text-sm font-semibold hover:text-purple-400 flex items-center gap-1"
          >
            <Sparkles className="w-4 h-4" />
            Import
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner className="w-10 h-10 text-purple-500 " />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Create New / Upgrade Button */}
            {(role === 'pro' || (role === 'admin' && playlists.length < 12) || (role === 'normal' && playlists.length < 2)) ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-4 p-3 rounded-2xl bg-[#121212] border border-white/5 hover:border-purple-500/50 group transition-all duration-300 w-full h-full"
              >
                <div className="w-16 h-16 shrink-0 rounded-xl bg-[#252525] flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300">
                  <Plus className="w-8 h-8 text-purple-500 group-hover:text-white" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-bold text-white text-lg group-hover:text-purple-400 transition-colors truncate">Create New</p>
                  <p className="text-sm text-gray-400 truncate">Build your vibe</p>
                </div>
              </button>
            ) : (
              <button
                onClick={() => setProModalOpen(true)}
                className="flex items-center gap-4 p-3 rounded-2xl bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border border-purple-500/30 hover:border-purple-500 group transition-all duration-300 w-full h-full text-left"
              >
                <div className="w-16 h-16 shrink-0 rounded-xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 text-base md:text-lg leading-tight">Unlock Unlimited Playlists</p>
                  <p className="text-xs text-purple-300/70 mt-1 uppercase tracking-wider font-bold">Go Pro</p>
                </div>
              </button>
            )}

            {/* Liked Songs */}
            <Link 
              href="/favorites"
              className="group flex items-center gap-4 p-3 rounded-2xl bg-[#121212] border border-transparent hover:bg-white/5 transition-all cursor-pointer h-full"
            >
              <div className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
                  <Heart className="w-7 h-7 text-white fill-current" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white truncate text-lg">Liked Songs</h3>
                <p className="text-sm text-gray-400 truncate">Your favorites</p>
              </div>
            </Link>

            {/* User Playlists */}
            {playlists.map((playlist) => (
              <div key={playlist.id} className="relative group/card h-full" ref={(el) => { playlistRefs.current[playlist.id] = el; }}>
                <Link
                  href={`/my-playlist/${playlist.id}`}
                  className="group flex items-center gap-4 p-3 pr-20 rounded-2xl bg-[#121212] border border-transparent hover:bg-white/5 transition-all cursor-pointer h-full"
                >
                  <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-gray-800 shadow-lg relative">
                    {playlist.songs && playlist.songs[0]?.image?.[2] ? (
                      <img src={playlist.songs[0].image[2]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-900/40 to-blue-900/40 flex items-center justify-center">
                        <ListMusic className="w-8 h-8 text-white/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white truncate text-lg group-hover:text-purple-400 transition-colors">{playlist.name}</h3>
                    <p className="text-sm text-gray-400 truncate">
                      {playlist.songs?.length || 0} songs
                    </p>
                  </div>
                </Link>

                {/* Visible Actions: Rename & Delete */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleEditClick(playlist, e);
                    }}
                    className="p-2 rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-white/10 transition-colors"
                    title="Rename Playlist"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(playlist.id, playlist.name, e);
                    }}
                    className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete Playlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {playlists.length === 0 && !loading && (
             <div className="py-12 text-center text-gray-500 col-span-full">
               <Music className="w-12 h-12 mx-auto mb-3 opacity-30" />
               <p>Start building your library!</p>
             </div>
        )}
      </main>

      <Footer />

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Create New Playlist</h2>
            <input
              type="text"
              placeholder="Playlist name"
              value={createModalName}
              onChange={(e) => setCreateModalName(e.target.value)}
              autoFocus
              className="w-full bg-[#282828] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-purple-500 mb-4"
              onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCreate()}
                disabled={!createModalName.trim() || creating}
                className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-xl text-white font-bold transition-colors"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Playlist Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowRenameModal(false)}>
          <div className="bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Rename Playlist</h2>
            <input
              type="text"
              placeholder="New playlist name"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              className="w-full bg-[#282828] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-purple-500 mb-4"
              onKeyPress={(e) => e.key === 'Enter' && handleRename()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowRenameModal(false)}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={!renameValue.trim()}
                className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-xl text-white font-bold transition-colors"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Long Press Context Menu - rendered as fixed overlay */}
      {longPressPlaylist && (
        <>
          {/* Backdrop to close menu */}
          <div 
            className="fixed inset-0 z-[60]" 
            onClick={closeMenu}
          />
          {/* Floating menu */}
          {(() => {
            const playlist = playlists.find(p => p.id === longPressPlaylist);
            if (!playlist) return null;
            return (
              <div 
                className="fixed z-[70] bg-[#282828] border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[160px]"
                style={menuPosition ? { top: menuPosition.top, right: menuPosition.right } : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
              >
                <button
                  onClick={(e) => handleEditClick(playlist, e)}
                  className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  <span>✏️</span> Rename
                </button>
                <button
                  onClick={(e) => handleDeleteClick(playlist.id, e)}
                  className="w-full px-4 py-3 text-left text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                >
                  <span>🗑️</span> Delete
                </button>
              </div>
            );
          })()}
        </>
      )}
      
      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setImportModalOpen(false)} 
        onComplete={loadPlaylists}
      />

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(p => ({ ...p, isOpen: false }))}
        variant="danger"
      />

      <ProPurchaseModal 
        isOpen={isProModalOpen} 
        onClose={() => setProModalOpen(false)} 
      />
    </div>
  );
}





