"use client";
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { usePlayer } from '@/contexts/PlayerContext';
import { Song } from '@/lib/types';
import { playlistCache } from '@/lib/playlistCache';

export function usePlaylistLogic() {
    const params = useParams();
    const searchParams = useSearchParams();
    const { setQueueConfig } = usePlayer();
    
    const playlistId = params.id as string;
    const initialName = searchParams.get('name') || '';
    const initialImage = searchParams.get('image') || '';
    const initialSubtitle = searchParams.get('subtitle') || '';

    // Check client cache immediately for 0ms instant loading
    const cached = playlistCache.get(playlistId);

    const [allSongs, setAllSongs] = useState<Song[]>(() => cached ? cached.songs : []);
    const [visibleSongs, setVisibleSongs] = useState<Song[]>(() => cached ? cached.songs.slice(0, 10) : []);
    const [playlistInfo, setPlaylistInfo] = useState<any>(() => {
        if (cached?.info) return cached.info;
        if (initialName || initialImage) {
            return { 
                name: initialName, 
                image: initialImage, 
                subtitle: initialSubtitle || 'Playlist',
                id: playlistId,
            };
        }
        return null;
    });
    const [loading, setLoading] = useState<boolean>(() => !cached);
    const [page, setPage] = useState(1);

    useEffect(() => {
        let isMounted = true;

        const fetchPlaylist = async () => {
            try {
                const res = await fetch(`/api/music/playlist/${playlistId}`);
                if (res.ok && isMounted) {
                    const data = await res.json();
                    const songs: Song[] = Array.isArray(data) ? data : (data?.songs ?? []);
                    
                    const firstSongImg = songs[0]?.image ? (Array.isArray(songs[0].image) ? songs[0].image[2] || songs[0].image[0] : songs[0].image) : undefined;
                    const info = {
                        id: data?.id || playlistId,
                        name: data?.name || initialName || 'Featured Playlist',
                        image: data?.image || initialImage || firstSongImg,
                        description: data?.description || '',
                        subtitle: data?.subtitle || initialSubtitle || 'Playlist',
                    };

                    setAllSongs(songs);
                    setPlaylistInfo(info);
                    setVisibleSongs(songs.slice(0, page * 10));
                    playlistCache.set(playlistId, { songs, info });
                }
            } catch (e) {
                console.error("Failed to fetch playlist", e);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchPlaylist();

        return () => {
            isMounted = false;
        };
    }, [playlistId, initialName, initialImage, initialSubtitle]);

    useEffect(() => {
        if (page > 1) {
            const nextBatch = allSongs.slice(0, page * 10);
            setVisibleSongs(nextBatch);
        }
    }, [page, allSongs]);

    const handlePlay = (song: Song, index: number) => {
        setQueueConfig(allSongs, index);
    };

    const handlePlayAll = (shuffle: boolean, shuffledSongs?: Song[]) => {
        if (allSongs.length === 0) return;
        const songsToPlay = shuffledSongs || allSongs;
        setQueueConfig(songsToPlay, 0);
    };

    const handleLoadMore = () => {
        setPage(prev => prev + 1);
    };

    const hasMore = visibleSongs.length < allSongs.length;

    return {
        state: { allSongs, visibleSongs, playlistInfo, loading, page, hasMore },
        actions: { handlePlay, handlePlayAll, handleLoadMore }
    };
}
