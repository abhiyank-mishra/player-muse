import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Download, Music, Play, Trash2, ArrowLeft, Shuffle, Pencil, X } from 'lucide-react';
import ConfirmModal from '@/reusable/ui/modals/ConfirmModal';
import PageHeader from '@/components/common/PageHeader';
import SongList from '@/components/common/SongList';
import Spinner from '@/reusable/animations/loading/Spinner';
import { canDownload } from '@/lib/downloadWhitelist';
import { DownloadsState, DownloadsActions } from './downloads.types';
import { INDIVIDUAL_DOWNLOADS_ID } from './useDownloadsLogic';

interface DownloadsUIProps {
  state: DownloadsState;
  actions: DownloadsActions;
}

export default function DownloadsUI({ state, actions }: DownloadsUIProps) {
  const { 
    user, authLoading, allSongs, playlists, stats, 
    displayedCount, isLoadingMore, viewPlaylistId, isOnline, 
    confirmConfig, currentSong, isPlaying 
  } = state;
  
  const { 
    setViewPlaylistId, loadMore, handleDeleteSong, handleDeletePlaylist, 
    handlePlayQueue, handlePlayAll, closeConfirm, playNext, handleRenamePlaylist
  } = actions;

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ playlistId: string; x: number; y: number } | null>(null);
  // Rename modal state
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; playlistId: string; currentName: string }>({
    isOpen: false, playlistId: '', currentName: ''
  });
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handler = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handler);
      document.addEventListener('touchstart', handler);
    }
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [contextMenu]);

  // Auto-focus rename input
  useEffect(() => {
    if (renameModal.isOpen) {
      setTimeout(() => renameInputRef.current?.focus(), 100);
    }
  }, [renameModal.isOpen]);

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  if (authLoading && isOnline && allSongs.length === 0) {
    return <Spinner fullScreen />;
  }

  if (isOnline && !canDownload(user?.email) && allSongs.length === 0) {
     return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
             <Download className="w-16 h-16 text-gray-600 mb-4" />
             <h1 className="text-2xl font-bold text-white mb-2">Offline Downloads</h1>
             <p className="text-gray-400">This feature is restricted to Admin users.</p>
        </div>
     );
  }

  const getCurrentList = () => {
    if (viewPlaylistId === INDIVIDUAL_DOWNLOADS_ID) {
        return allSongs.filter(s => !s.playlistId);
    } else if (viewPlaylistId) {
        return allSongs.filter(s => s.playlistId === viewPlaylistId);
    } else {
        return allSongs;
    }
  };

  const currentList = getCurrentList();
  const displayedSongs = currentList.slice(0, displayedCount);
  const hasMore = displayedCount < currentList.length;

  const currentPlaylist = playlists.find(p => p.id === viewPlaylistId);
  const totalPlaylistDuration = currentPlaylist 
    ? currentList.reduce((acc, s) => acc + (s.song.duration || 0), 0)
    : 0;

  const isInsidePlaylist = viewPlaylistId !== null;

  const openContextMenu = (playlistId: string, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Get position
    let x = 0, y = 0;
    if ('touches' in e) {
      x = e.touches[0]?.clientX || e.changedTouches[0]?.clientX || 0;
      y = e.touches[0]?.clientY || e.changedTouches[0]?.clientY || 0;
    } else {
      x = e.clientX;
      y = e.clientY;
    }
    setContextMenu({ playlistId, x, y });
  };

  const handleContextRename = () => {
    if (!contextMenu) return;
    const pl = playlists.find(p => p.id === contextMenu.playlistId);
    setRenameModal({ isOpen: true, playlistId: contextMenu.playlistId, currentName: pl?.name || '' });
    setRenameValue(pl?.name || '');
    setContextMenu(null);
  };

  const handleContextDelete = () => {
    if (!contextMenu) return;
    // Create a synthetic mouse event for the handler
    const fakeEvent = { stopPropagation: () => {} } as React.MouseEvent;
    handleDeletePlaylist(contextMenu.playlistId, fakeEvent);
    setContextMenu(null);
  };

  const submitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== renameModal.currentName && handleRenamePlaylist) {
      handleRenamePlaylist(renameModal.playlistId, trimmed);
    }
    setRenameModal({ isOpen: false, playlistId: '', currentName: '' });
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      
      {isInsidePlaylist && currentPlaylist ? (
        <>
          {/* Playlist Detail View */}
          {viewPlaylistId === INDIVIDUAL_DOWNLOADS_ID ? (
            <div className="p-4 md:p-8">
              <button 
                onClick={() => setViewPlaylistId(null)}
                className="text-gray-400 hover:text-white flex items-center gap-2 text-sm mb-6 group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Library
              </button>
              <div className="flex items-center gap-5 mb-6">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shrink-0 shadow-xl">
                  <Download className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-white">Downloads</h1>
                  <p className="text-sm text-gray-400 mt-1">{currentList.length} songs • Individually downloaded</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handlePlayAll(false)}
                  className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-full font-bold hover:bg-gray-200 transition-colors"
                >
                  <Play className="w-4 h-4 fill-black" />
                  Play All
                </button>
                <button
                  onClick={() => handlePlayAll(true)}
                  className="flex items-center gap-2 bg-white/10 text-white px-5 py-2.5 rounded-full font-semibold hover:bg-white/20 transition-colors"
                >
                  <Shuffle className="w-4 h-4" />
                  Shuffle
                </button>
              </div>
            </div>
          ) : (
            <>
              <PageHeader 
                title={currentPlaylist.name}
                subtitle="Offline Playlist"
                image={currentPlaylist.image || '/placeholder.png'}
                stats={{ count: currentList.length, duration: totalPlaylistDuration }}
                actions={{
                    onPlayAll: () => handlePlayAll(false),
                    onShuffle: () => handlePlayAll(true)
                }}
                backLink={undefined as any}
              />
              <div className="px-6 py-4">
                <button 
                  onClick={() => setViewPlaylistId(null)}
                  className="text-gray-400 hover:text-white flex items-center gap-2 text-sm mb-4 group"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Library
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        /* ─── Main Downloads Library View ─── */
        <div className="p-2 md:p-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 px-2 md:px-0">
                <div className="flex flex-col items-center text-center gap-3">
                    {isOnline && (
                        <Link href="/" className="self-start p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6 text-white" />
                        </Link>
                    )}
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shrink-0">
                        <Download className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-base md:text-xl font-bold text-white">Offline Library</h1>
                        <p className="text-[10px] md:text-xs text-gray-400 mt-1">Long press a playlist to rename or delete</p>
                    </div>
                </div>

                <div className="flex gap-3">
                     <button
                        onClick={() => handlePlayAll(false)}
                        className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-full font-bold hover:bg-gray-200 transition-colors"
                     >
                        <Play className="w-4 h-4 fill-black" />
                        Play All
                     </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-10 px-2 md:px-0">
                <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Music className="w-20 h-20 text-purple-500" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-400 text-sm mb-1">Total Downloads</p>
                        <p className="text-3xl font-bold text-white mb-2">{stats.count}</p>
                        <p className="text-xs text-purple-400 font-medium">
                            {formatSize(stats.totalSize)} of music available offline
                        </p>
                    </div>
                </div>
            </div>

            {/* ─── Playlist Grid ─── */}
            {playlists.length > 0 && (
                <div className="mb-10 px-2 md:px-0">
                    <h2 className="text-lg font-bold text-white mb-4">Your Offline Playlists</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {playlists.map(playlist => {
                            return (
                            <div 
                                key={playlist.id}
                                onClick={() => setViewPlaylistId(playlist.id)}
                                onTouchStart={(e) => { longPressTimer.current = setTimeout(() => openContextMenu(playlist.id, e), 500); }}
                                onTouchEnd={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
                                onTouchMove={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
                                onContextMenu={(e) => { e.preventDefault(); openContextMenu(playlist.id, e); }}
                                className="group relative bg-zinc-900/50 rounded-xl p-3 hover:bg-zinc-800 transition-colors cursor-pointer border border-white/5 select-none"
                            >
                                <div className="aspect-square relative rounded-lg overflow-hidden mb-3">
                                    {playlist.id === INDIVIDUAL_DOWNLOADS_ID ? (
                                      <div className="w-full h-full bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600 flex items-center justify-center">
                                        <Download className="w-12 h-12 text-white/80" />
                                      </div>
                                    ) : (
                                      <img 
                                          src={playlist.image || '/placeholder.png'} 
                                          alt={playlist.name}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="bg-purple-500 rounded-full p-3 shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all">
                                            <Play className="w-6 h-6 text-white fill-white" />
                                        </div>
                                    </div>
                                </div>
                                <h3 className="font-semibold text-white truncate">{playlist.name}</h3>
                                <p className="text-sm text-gray-500">{playlist.songCount} songs</p>
                            </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {playlists.length === 0 && (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-zinc-900/20 mx-2 md:mx-0">
                    <Music className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400">No downloads yet.</p>
                    <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm mt-2 inline-block">Go to Home</Link>
                </div>
            )}
        </div>
      )}

      {/* ─── Long Press Context Menu ─── */}
      {contextMenu && (
        <div 
          className="fixed z-[100] bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[180px] animate-in fade-in zoom-in-95 duration-150"
          style={{ 
            top: Math.min(contextMenu.y, window.innerHeight - 120), 
            left: Math.min(contextMenu.x, window.innerWidth - 200) 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.playlistId !== INDIVIDUAL_DOWNLOADS_ID && (
            <button 
              onClick={handleContextRename}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors"
            >
              <Pencil className="w-4 h-4 text-purple-400" />
              Rename
            </button>
          )}
          <button 
            onClick={handleContextDelete}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}

      {/* ─── Rename Modal ─── */}
      {renameModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Rename Playlist</h3>
              <button onClick={() => setRenameModal({ isOpen: false, playlistId: '', currentName: '' })} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">This only changes the offline name</p>
            <input 
              ref={renameInputRef}
              type="text" 
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitRename()}
              className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors mb-4"
              placeholder="Playlist name"
              maxLength={50}
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setRenameModal({ isOpen: false, playlistId: '', currentName: '' })}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-gray-300 font-semibold text-sm hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={submitRename}
                disabled={!renameValue.trim() || renameValue.trim() === renameModal.currentName}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
         isOpen={confirmConfig.isOpen}
         title={confirmConfig.title}
         message={confirmConfig.message}
         onConfirm={confirmConfig.onConfirm}
         onCancel={closeConfirm}
         variant="danger"
      />

      {/* Song List (only shown when inside a playlist) */}
      <div className="px-0 md:px-8">
         {isInsidePlaylist && displayedSongs.length === 0 ? (
             <p className="text-gray-500 text-center py-12">No songs available offline in this playlist.</p>
         ) : isInsidePlaylist ? (
             <SongList 
                songs={displayedSongs.map(s => s.song)}
                currentSong={currentSong!}
                isPlaying={isPlaying}
                onPlay={(index) => handlePlayQueue(index)}
                onSwipeRight={(song) => playNext(song)}
                onDelete={(song) => handleDeleteSong(song.id!)}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                onLoadMore={loadMore}
                useInfiniteScroll={true}
             />
         ) : null}
      </div>
    </div>
  );
}
