"use client";
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { useToast } from '@/contexts/ToastContext';
import { 
  getDownloadedSongs, 
  getDownloadedPlaylists, 
  deleteSong, 
  deletePlaylist,
  renamePlaylist,
  getStorageStats, 
  DownloadedPlaylist,
} from '@/lib/offlineStorage';
import { Song } from '@/lib/types';
import { DownloadedSongItem } from './downloads.types';

// Virtual playlist ID for individually downloaded songs
export const INDIVIDUAL_DOWNLOADS_ID = '__individual_downloads__';

export function useDownloadsLogic() {
  const { user, loading: authLoading } = useAuth();
  const { setQueueConfig, playNext, currentSong, isPlaying } = usePlayer();
  const { showToast } = useToast();
  
  const [allSongs, setAllSongs] = useState<DownloadedSongItem[]>([]);
  const [playlists, setPlaylists] = useState<DownloadedPlaylist[]>([]);
  const [stats, setStats] = useState({ totalSize: 0, count: 0 });
  const [browserQuota, setBrowserQuota] = useState<{ usage: number; quota: number } | null>(null);
  
  const [displayedCount, setDisplayedCount] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [viewPlaylistId, setViewPlaylistId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false, title: '', message: '', onConfirm: () => {}
  });

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    loadData();
    loadBrowserQuota();
  }, []);

  useEffect(() => {
    setDisplayedCount(20);
  }, [viewPlaylistId]);

  async function loadData() {
    try {
      const [downloadedSongs, downloadedPlaylists, storageStats] = await Promise.all([
        getDownloadedSongs(),
        getDownloadedPlaylists(),
        getStorageStats()
      ]);
      
      // Filter out songs whose blob is missing/invalid (deleted ghost entries fix)
      const validSongs = downloadedSongs.filter(ds => ds.blob && ds.blob.size > 0);

      const mappedSongs = validSongs.map(ds => ({
        song: {
          id: ds.id,
          name: ds.metadata.name,
          artist: ds.metadata.artist,
          image: Array.isArray(ds.metadata.image) ? ds.metadata.image : [ds.metadata.image as string],
          duration: ds.metadata.duration,
          url: ds.metadata.url,
        } as Song,
        downloadedAt: ds.downloadedAt,
        size: ds.size,
        playlistId: ds.metadata.playlistId
      }));

      mappedSongs.sort((a, b) => b.downloadedAt - a.downloadedAt);

      // Clean up ghost entries (songs in DB with no/empty blob)
      const ghostSongs = downloadedSongs.filter(ds => !ds.blob || ds.blob.size === 0);
      if (ghostSongs.length > 0) {
        console.log(`[Downloads] Cleaning ${ghostSongs.length} ghost entries`);
        for (const ghost of ghostSongs) {
          try { await deleteSong(ghost.id); } catch { /* silent */ }
        }
      }

      // Build virtual playlists list:
      // 1. Real playlists from store
      // 2. Virtual "Downloads" playlist for individual songs (no playlistId)
      const individualSongs = mappedSongs.filter(s => !s.playlistId);
      const enrichedPlaylists: DownloadedPlaylist[] = [...downloadedPlaylists];

      // Also check for playlists that have no valid songs left → remove them
      const validPlaylists = enrichedPlaylists.filter(p => {
        const songsInPlaylist = mappedSongs.filter(s => s.playlistId === p.id);
        return songsInPlaylist.length > 0;
      });

      // Add virtual "Downloads" playlist if there are individual songs
      if (individualSongs.length > 0) {
        validPlaylists.unshift({
          id: INDIVIDUAL_DOWNLOADS_ID,
          name: 'Downloads',
          description: 'Individually downloaded songs',
          image: undefined,
          type: 'user',
          songCount: individualSongs.length,
          downloadedAt: individualSongs[0]?.downloadedAt || Date.now(),
        });
      }
      
      setAllSongs(mappedSongs);
      setPlaylists(validPlaylists);
      setStats(storageStats);
    } catch (error) {
      console.error('[Downloads] Error loading:', error);
    }
  };

  async function loadBrowserQuota() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        // @ts-ignore
        const estimate = await navigator.storage.estimate();
        setBrowserQuota(estimate as any);
      }
    } catch (error) {
      console.error('[Downloads] Error getting quota:', error);
    }
  };

  const getCurrentList = useCallback(() => {
    if (viewPlaylistId === INDIVIDUAL_DOWNLOADS_ID) {
        // Virtual "Downloads" playlist — songs without a playlistId
        return allSongs.filter(s => !s.playlistId);
    } else if (viewPlaylistId) {
        return allSongs.filter(s => s.playlistId === viewPlaylistId);
    } else {
        // Main downloads view (no playlist selected) — show all songs
        return allSongs;
    }
  }, [viewPlaylistId, allSongs]);

  const loadMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayedCount(prev => prev + 20);
      setIsLoadingMore(false);
    }, 300);
  };

  const handleDeleteSong = (songId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Song',
      message: 'Are you sure you want to remove this song from your downloads?',
      onConfirm: async () => {
        try {
          await deleteSong(songId);
          // Immediately remove from local state for instant UI feedback
          setAllSongs(prev => prev.filter(s => s.song.id !== songId));
          showToast('Song deleted');
        } catch (error) {
          showToast('Failed to delete', 'error');
        }
        setConfirmConfig(p => ({ ...p, isOpen: false }));
      }
    });
  };

  const handleDeletePlaylist = (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Don't allow deleting the virtual "Downloads" playlist — user should delete songs individually
    if (playlistId === INDIVIDUAL_DOWNLOADS_ID) {
      setConfirmConfig({
        isOpen: true,
        title: 'Delete All Individual Downloads',
        message: 'Delete all individually downloaded songs? This cannot be undone.',
        onConfirm: async () => {
          try {
            const individualSongs = allSongs.filter(s => !s.playlistId);
            for (const item of individualSongs) {
              await deleteSong(item.song.id!);
            }
            if (viewPlaylistId === INDIVIDUAL_DOWNLOADS_ID) setViewPlaylistId(null);
            await loadData();
            showToast('Individual downloads deleted');
          } catch (error) {
            showToast('Failed to delete', 'error');
          }
          setConfirmConfig(p => ({ ...p, isOpen: false }));
        }
      });
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: 'Delete Playlist',
      message: 'Delete this entire playlist and all its downloaded songs? This cannot be undone.',
      onConfirm: async () => {
        try {
            await deletePlaylist(playlistId);
            if (viewPlaylistId === playlistId) setViewPlaylistId(null);
            await loadData();
            showToast('Playlist deleted');
        } catch (error) {
            showToast('Failed to delete playlist', 'error');
        }
        setConfirmConfig(p => ({ ...p, isOpen: false }));
      }
    });
  };

  const handlePlayQueue = (index: number) => {
    const currentList = getCurrentList();
    const songsToPlay = currentList.map(s => s.song);
    setQueueConfig(songsToPlay, index);
  };

  const handlePlayAll = (shuffle: boolean) => {
    const currentList = getCurrentList();
    const songs = currentList.map(s => s.song);
    if (songs.length > 0) {
        const queue = shuffle ? [...songs].sort(() => Math.random() - 0.5) : songs;
        setQueueConfig(queue, 0);
    }
  };

  const handleRenamePlaylist = async (playlistId: string, newName: string) => {
    try {
      await renamePlaylist(playlistId, newName);
      // Update local state immediately
      setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, name: newName } : p));
      showToast('Playlist renamed');
    } catch (error) {
      showToast('Failed to rename', 'error');
    }
  };

  const closeConfirm = () => setConfirmConfig(p => ({ ...p, isOpen: false }));

  return {
    state: { 
        user, authLoading, allSongs, playlists, stats, browserQuota, 
        displayedCount, isLoadingMore, viewPlaylistId, isOnline, confirmConfig,
        currentSong, isPlaying 
    },
    actions: { 
        setViewPlaylistId, loadMore, handleDeleteSong, handleDeletePlaylist, 
        handlePlayQueue, handlePlayAll, closeConfirm, playNext, handleRenamePlaylist 
    }
  };
}
