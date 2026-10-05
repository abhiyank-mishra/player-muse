"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, 
    Plus, 
    Check, 
    Music, 
    FolderPlus, 
    Download, 
    ListPlus, 
    Pin, 
    PinOff,
    Loader2,
    Trash2 
} from 'lucide-react';
import { Song } from '@/lib/types';
import { useUI } from '@/contexts/UIContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { getUserPlaylists, createPlaylist, addToPlaylist, deletePlaylist, toggleGlobalPin, isPinnedToGlobal } from '@/lib/ranking';
import { downloadSong, isDownloaded as checkIsDownloaded } from '@/lib/offlineStorage';
import { userPlaylistsCache } from '@/lib/userPlaylistsCache';
import ConfirmModal from '@/reusable/ui/modals/ConfirmModal';
import { useBackHandler } from '@/platform/useBackHandler';

interface AddToPlaylistModalProps {
    isOpen?: boolean;
    song?: Song | null;
    playlists?: any[];
    addingToId?: string | null;
    onAddToPlaylist?: (id: string, e: React.MouseEvent) => void;
    onClose?: () => void;
    positionClass?: string;
}

export default function AddToPlaylistModal({
    isOpen: propIsOpen,
    song: propSong,
    onClose: propOnClose
}: AddToPlaylistModalProps = {}) {
    const { playlistModalSong, closeAddToPlaylist, setProModalOpen } = useUI();
    const { user, isPro, isAdmin, login } = useAuth();
    const { showToast } = useToast();
    const { playNext } = usePlayer();

    // Determine target song and open state
    const targetSong = propSong || playlistModalSong;
    const isModalOpen = propIsOpen !== undefined ? propIsOpen : !!playlistModalSong;

    const [playlists, setPlaylists] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [addingToId, setAddingToId] = useState<string | null>(null);

    // New playlist inline creator state
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [creatingLoading, setCreatingLoading] = useState(false);

    // Quick actions state
    const [isPinned, setIsPinned] = useState(false);
    const [isDownloaded, setIsDownloaded] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const handleClose = () => {
        setIsCreatingNew(false);
        setNewPlaylistName('');
        setDeleteTargetPlaylist(null);
        if (propOnClose) {
            propOnClose();
        } else {
            closeAddToPlaylist();
        }
    };

    // Intercept phone back button to close Add to Playlist modal first
    useBackHandler(isModalOpen, handleClose, 'addToPlaylist');

    // Delete playlist confirmation state
    const [deleteTargetPlaylist, setDeleteTargetPlaylist] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleConfirmDelete = async () => {
        if (!user?.uid || !deleteTargetPlaylist?.id) return;
        setIsDeleting(true);
        try {
            await deletePlaylist(user.uid, deleteTargetPlaylist.id);
            userPlaylistsCache.removeSingle(user.uid, deleteTargetPlaylist.id);
            setPlaylists(prev => prev.filter(p => p.id !== deleteTargetPlaylist.id));
            showToast(`Deleted "${deleteTargetPlaylist.name}"`, 'info');
        } catch (err: any) {
            console.error('[AddToPlaylist] Delete failed:', err);
            showToast('Failed to delete playlist', 'error');
        } finally {
            setIsDeleting(false);
            setDeleteTargetPlaylist(null);
        }
    };

    // Load playlists and check song states when modal opens
    useEffect(() => {
        if (!isModalOpen || !user?.uid) return;

        let active = true;
        setLoading(true);

        getUserPlaylists(user.uid, isPro)
            .then(data => {
                if (active) {
                    setPlaylists(data || []);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (active) {
                    console.error("[AddToPlaylist] Error loading playlists:", err);
                    setLoading(false);
                }
            });

        if (targetSong?.id) {
            checkIsDownloaded(targetSong.id).then(status => {
                if (active) setIsDownloaded(status);
            });

            if (isAdmin) {
                isPinnedToGlobal(targetSong.id).then(status => {
                    if (active) setIsPinned(status);
                });
            }
        }

        return () => {
            active = false;
        };
    }, [isModalOpen, user?.uid, isPro, isAdmin, targetSong?.id]);

    // Close on Escape key
    useEffect(() => {
        if (!isModalOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isModalOpen]);

    // Handle adding to existing playlist
    const handleAddSong = async (playlistId: string) => {
        if (!user) {
            login();
            return;
        }
        if (!targetSong || addingToId) return;

        setAddingToId(playlistId);
        try {
            const res = await addToPlaylist(user.uid, playlistId, targetSong);
            if (res.alreadyExists) {
                showToast(`"${targetSong.name}" is already in ${res.playlistName}`, 'info');
            } else {
                showToast(`Added to ${res.playlistName}`, 'success');
                // Optimistically update playlist songs array
                setPlaylists(prev => prev.map(p => {
                    if (p.id === playlistId) {
                        const curSongs = p.songs || [];
                        return { ...p, songs: [...curSongs, targetSong] };
                    }
                    return p;
                }));
            }
            setTimeout(() => {
                handleClose();
            }, 250);
        } catch (err: any) {
            console.error("[AddToPlaylist] Add failed:", err);
            showToast(err.message || 'Failed to add to playlist', 'error');
        } finally {
            setAddingToId(null);
        }
    };

    // Handle inline playlist creation
    const handleCreatePlaylist = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newPlaylistName.trim();
        if (!trimmedName || !user || !targetSong) return;

        setCreatingLoading(true);
        try {
            const role = isPro ? 'pro' : isAdmin ? 'admin' : 'normal';
            const newPl = await createPlaylist(user.uid, trimmedName, role);
            const res = await addToPlaylist(user.uid, newPl.id, targetSong);
            
            showToast(`Created & added to "${res.playlistName}"`, 'success');
            setPlaylists(prev => [{ ...newPl, songs: [targetSong] }, ...prev]);
            setNewPlaylistName('');
            setIsCreatingNew(false);
            setTimeout(() => {
                handleClose();
            }, 250);
        } catch (err: any) {
            console.error("[AddToPlaylist] Create failed:", err);
            if (err.message?.includes('Upgrade to Pro')) {
                setProModalOpen(true);
            } else {
                showToast(err.message || 'Failed to create playlist', 'error');
            }
        } finally {
            setCreatingLoading(false);
        }
    };

    // Quick action: Play Next
    const handlePlayNext = () => {
        if (!targetSong) return;
        playNext(targetSong);
        showToast('Playing next in queue', 'info');
        handleClose();
    };

    // Quick action: Download
    const handleDownload = async () => {
        if (!user) {
            login();
            return;
        }
        if (!isPro) {
            setProModalOpen(true);
            return;
        }
        if (!targetSong || downloading || isDownloaded) return;

        setDownloading(true);
        try {
            await downloadSong(targetSong, user.email ?? undefined);
            setIsDownloaded(true);
            showToast('Song downloaded for offline listening', 'success');
        } catch (err) {
            showToast('Download failed', 'error');
        } finally {
            setDownloading(false);
        }
    };

    // Quick action: Admin Pin
    const handlePin = async () => {
        if (!targetSong || !isAdmin) return;
        const newPinned = !isPinned;
        setIsPinned(newPinned);
        try {
            await toggleGlobalPin(targetSong);
            showToast(newPinned ? 'Pinned to Global Top' : 'Unpinned from Global Top', 'success');
        } catch (err) {
            setIsPinned(!newPinned);
            showToast('Failed to update pin', 'error');
        }
    };

    const songImage = (() => {
        if (!targetSong) return '/logo.png';
        const raw = Array.isArray(targetSong.image) ? (targetSong.image[2] || targetSong.image[0]) : targetSong.image;
        return typeof raw === 'string' && raw.trim() !== '' ? raw : '/logo.png';
    })();

    return (
        <>
            <AnimatePresence>
                {isModalOpen && targetSong && (
                    <div key="add-to-playlist-container" className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
                        {/* Backdrop with smooth blur */}
                        <motion.div 
                            key="add-to-playlist-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 bg-black/65 backdrop-blur-md"
                            onClick={handleClose}
                        />

                        {/* Dialog Card (Bottom-sheet on mobile, centered dialog on desktop) */}
                        <motion.div 
                            key="add-to-playlist-card"
                    initial={{ opacity: 0, y: 30, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 30, scale: 0.98 }}
                    transition={{ type: "spring", damping: 25, stiffness: 350 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-sm sm:max-w-md bg-[#121214] border border-white/10 rounded-t-3xl sm:rounded-2xl p-5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] flex flex-col gap-4 z-10 max-h-[85vh] sm:max-h-[80vh] overflow-hidden"
                >
                    {/* Header: Title & Close */}
                    <div className="flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <FolderPlus className="w-5 h-5 text-white/90" />
                            <h3 className="text-base font-semibold text-white tracking-tight">Add to Playlist</h3>
                        </div>
                        <button 
                            type="button"
                            onClick={handleClose}
                            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                            aria-label="Close modal"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Song Preview Banner */}
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 shrink-0">
                        <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 aspect-square bg-[#0a0a0a] border border-white/5 shadow-sm">
                            <img 
                                src={songImage} 
                                alt={targetSong.name} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/logo.png';
                                }}
                            />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-semibold text-white truncate" title={targetSong.name}>
                                {targetSong.name}
                            </span>
                            <span className="text-xs text-zinc-400 truncate" title={targetSong.artist}>
                                {targetSong.artist}
                            </span>
                        </div>
                    </div>

                    {/* Inline Create Playlist Box */}
                    {isCreatingNew ? (
                        <form onSubmit={handleCreatePlaylist} className="flex items-center gap-2 shrink-0">
                            <input 
                                type="text"
                                autoFocus
                                value={newPlaylistName}
                                onChange={(e) => setNewPlaylistName(e.target.value)}
                                placeholder="Playlist title..."
                                maxLength={40}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition-all"
                            />
                            <button 
                                type="submit"
                                disabled={creatingLoading || !newPlaylistName.trim()}
                                className="px-3.5 py-2 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                            >
                                {creatingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create'}
                            </button>
                            <button 
                                type="button"
                                onClick={() => { setIsCreatingNew(false); setNewPlaylistName(''); }}
                                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </form>
                    ) : (
                        <button 
                            type="button"
                            onClick={() => setIsCreatingNew(true)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-dashed border-white/15 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.05] text-zinc-300 hover:text-white text-xs font-medium transition-all group shrink-0"
                        >
                            <Plus className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                            <span>New Playlist</span>
                        </button>
                    )}

                    {/* Playlists List */}
                    <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 -mr-0.5 custom-scrollbar min-h-[140px] max-h-[260px]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-8 gap-2 text-zinc-500">
                                <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                                <span className="text-xs">Loading playlists...</span>
                            </div>
                        ) : playlists.length > 0 ? (
                            playlists.map(p => {
                                const songCount = p.songs?.length || 0;
                                const isAlreadyAdded = p.songs?.some((s: any) => s.id === targetSong.id);
                                const isAddingThis = addingToId === p.id;

                                return (
                                    <div 
                                        key={p.id}
                                        className="flex items-center justify-between w-full p-2 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors group"
                                    >
                                        <button 
                                            type="button"
                                            disabled={isAddingThis}
                                            onClick={() => handleAddSong(p.id)}
                                            className="flex items-center gap-3 min-w-0 flex-1 text-left disabled:opacity-50"
                                        >
                                            <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400 group-hover:text-white shrink-0">
                                                <Music className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-medium text-zinc-200 group-hover:text-white truncate">
                                                    {p.name}
                                                </span>
                                                <span className="text-[11px] text-zinc-500">
                                                    {songCount} {songCount === 1 ? 'song' : 'songs'}
                                                </span>
                                            </div>
                                        </button>

                                        <div className="flex items-center gap-1 shrink-0 ml-2">
                                            {/* Delete playlist button */}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteTargetPlaylist(p);
                                                }}
                                                className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all opacity-80 sm:opacity-0 group-hover:opacity-100"
                                                title={`Delete "${p.name}"`}
                                                aria-label={`Delete ${p.name}`}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>

                                            {/* Add song button / indicator */}
                                            <button
                                                type="button"
                                                disabled={isAddingThis}
                                                onClick={() => handleAddSong(p.id)}
                                                className="p-1"
                                            >
                                                {isAddingThis ? (
                                                    <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />
                                                ) : isAlreadyAdded ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                                        <Check className="w-3 h-3" />
                                                        Added
                                                    </span>
                                                ) : (
                                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 group-hover:text-white group-hover:bg-white/10 transition-colors">
                                                        <Plus className="w-4 h-4" />
                                                    </div>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-500 gap-1.5">
                                <p className="text-xs">No playlists created yet.</p>
                                <p className="text-[11px] text-zinc-600">Click &ldquo;New Playlist&rdquo; above to start one!</p>
                            </div>
                        )}
                    </div>

                    {/* Quick Actions Footer (Preserved functionality: Play Next, Download, Pin) */}
                    <div className="pt-2.5 mt-0.5 border-t border-white/10 flex items-center justify-between gap-1 shrink-0">
                        <button 
                            type="button"
                            onClick={handlePlayNext}
                            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white py-1.5 px-2.5 rounded-lg hover:bg-white/5 active:scale-95 transition-all"
                            title="Play next in queue"
                        >
                            <ListPlus className="w-3.5 h-3.5" />
                            <span>Play Next</span>
                        </button>

                        <button 
                            type="button"
                            onClick={handleDownload}
                            disabled={downloading || isDownloaded}
                            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white py-1.5 px-2.5 rounded-lg hover:bg-white/5 active:scale-95 transition-all disabled:opacity-40"
                            title={isDownloaded ? "Already Downloaded" : "Download song"}
                        >
                            {isDownloaded ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : downloading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Download className="w-3.5 h-3.5" />
                            )}
                            <span>{isDownloaded ? 'Downloaded' : downloading ? 'Downloading...' : 'Download'}</span>
                        </button>

                        {isAdmin && (
                            <button 
                                type="button"
                                onClick={handlePin}
                                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white py-1.5 px-2.5 rounded-lg hover:bg-white/5 active:scale-95 transition-all"
                                title="Pin or unpin globally"
                            >
                                {isPinned ? (
                                    <Pin className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                ) : (
                                    <PinOff className="w-3.5 h-3.5 text-zinc-500" />
                                )}
                                <span>Pin</span>
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
            )}
            </AnimatePresence>

            {/* Confirm Delete Playlist Modal */}
            <ConfirmModal 
                isOpen={!!deleteTargetPlaylist}
                title="Delete Playlist"
                message={`Are you sure you want to delete "${deleteTargetPlaylist?.name}"? This cannot be undone.`}
                confirmText={isDeleting ? "Deleting..." : "Delete"}
                cancelText="Cancel"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteTargetPlaylist(null)}
            />
        </>
    );
}
