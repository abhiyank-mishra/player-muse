"use client";
import React, { useState, useEffect, use, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { getUserPlaylists } from '@/lib/ranking';
import { useRouter, useSearchParams } from 'next/navigation';
import { Song } from '@/lib/types';
import UniversalPlaylistView from '@/components/UniversalPlaylistView';
import { userPlaylistsCache } from '@/lib/userPlaylistsCache';
import ConfirmModal from '@/reusable/ui/modals/ConfirmModal';
import { useToast } from '@/contexts/ToastContext';

function MyPlaylistDetailContent({ id }: { id: string }) {
  const { user, isPro, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setQueueConfig } = usePlayer();
  const [isConfirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const paramName = searchParams.get('name') || '';
  const paramCover = searchParams.get('cover') || '';
  const paramTracks = parseInt(searchParams.get('tracks') || '0', 10);

  // Instant hydration from cache
  const cached = userPlaylistsCache.getOne(user?.uid, id);

  const [playlist, setPlaylist] = useState<any>(() => {
    if (cached) return cached;
    if (paramName || paramCover) {
      return {
        id,
        name: paramName,
        songs: [],
        coverImage: paramCover,
        tracksCount: paramTracks,
      };
    }
    return null;
  });

  const [pageLoading, setPageLoading] = useState(() => !cached);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
    } else {
      loadPlaylist();
    }
  }, [user, authLoading, id]);

  const loadPlaylist = async () => {
    try {
      const cachedList = userPlaylistsCache.get(user!.uid);
      const cachedFound = cachedList?.find((p: any) => p.id === id);

      if (cachedFound) {
        setPlaylist(cachedFound);
        setPageLoading(false);
      }

      // Fresh background verification
      const playlists = await getUserPlaylists(user!.uid, isPro);
      if (Array.isArray(playlists)) {
        userPlaylistsCache.set(user!.uid, playlists);
        const found = playlists.find((p: any) => p.id === id);
        if (found) {
          setPlaylist(found);
        } else if (!cachedFound) {
          router.push('/');
        }
      }
    } catch (error) {
      console.error('Failed to load playlist:', error);
      if (!cached) router.push('/');
    } finally {
      setPageLoading(false);
    }
  };

  const handlePlay = (song: Song, index: number) => {
    if (!playlist || !playlist.songs || playlist.songs.length === 0) return;
    setQueueConfig(playlist.songs, index);
  };

  const handlePlayAll = (shuffle: boolean, shuffledSongs?: Song[]) => {
    if (!playlist || !playlist.songs || playlist.songs.length === 0) return;
    const songsToPlay = shuffledSongs || playlist.songs;
    setQueueConfig(songsToPlay, 0);
  };

  const handleRemoveFromPlaylist = async (song: Song) => {
    if (!playlist) return;
    try {
      const updatedSongs = playlist.songs.filter((s: Song) => s.id !== song.id);
      const nextPlaylist = { ...playlist, songs: updatedSongs };
      setPlaylist(nextPlaylist);

      if (user) {
        userPlaylistsCache.updateSingle(user.uid, id, { songs: updatedSongs });
        const { removeFromPlaylist } = await import('@/lib/ranking');
        await removeFromPlaylist(user.uid, id, song);
      }
    } catch (e) {
      console.error("Failed to remove song", e);
      loadPlaylist();
    }
  };

  const handleDeletePlaylist = async () => {
    if (!user || !id) return;
    try {
      const { deletePlaylist } = await import('@/lib/ranking');
      await deletePlaylist(user.uid, id);
      userPlaylistsCache.removeSingle(user.uid, id);
      showToast('Playlist deleted', 'info');
      router.push('/playlists');
    } catch (err: any) {
      console.error('Failed to delete playlist:', err);
      showToast('Failed to delete playlist', 'error');
    } finally {
      setConfirmDeleteOpen(false);
    }
  };

  if (authLoading && !cached) return null;

  const coverImg =
    playlist?.coverImage ||
    playlist?.songs?.[0]?.image?.[2] ||
    playlist?.songs?.[0]?.image?.[0] ||
    paramCover;

  return (
    <>
      <UniversalPlaylistView 
        title={playlist?.name || paramName || "My Playlist"}
        subtitle="User Playlist"
        image={coverImg}
        songs={playlist?.songs || []}
        loading={pageLoading && (!playlist?.songs || playlist.songs.length === 0)}
        onPlay={handlePlay}
        onPlayAll={handlePlayAll}
        onRemove={handleRemoveFromPlaylist}
        onDeletePlaylist={() => setConfirmDeleteOpen(true)}
        hasMore={false}
        playlistId={id}
        stats={
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow">
              {user?.displayName?.[0] || 'U'}
            </div>
            <span className="font-semibold text-white text-xs md:text-sm">{user?.displayName || 'My Collection'}</span>
            <span className="text-zinc-400 text-xs">• {playlist?.songs?.length ?? paramTracks} songs</span>
          </div>
        }
      />

      <ConfirmModal 
        isOpen={isConfirmDeleteOpen}
        title="Delete Playlist"
        message={`Are you sure you want to delete "${playlist?.name || paramName || 'this playlist'}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDeletePlaylist}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  );
}

export default function MyPlaylistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <MyPlaylistDetailContent id={id} />
    </Suspense>
  );
}
