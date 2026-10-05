"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { Song } from '@/lib/types';
import { getPreferredSeeds } from '@/lib/preferences';

export function useExploreSongs() {
    const [songs, setSongs] = useState<Song[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const loadingRef = useRef(false);

    // Helper to fetch keys
    const fetchFromSaavn = async (query: string, pageNum: number = 1) => {
        try {
            const res = await fetch(`/api/music/search?query=${encodeURIComponent(query)}&page=${pageNum}&limit=10`);
            const data = await res.json();
            return Array.isArray(data) ? data : (data.results || []);
        } catch (e) {
            console.error("Search failed", e);
            return [];
        }
    };

    const fetchPlaylistSongs = async (listId: string) => {
        try {
            const res = await fetch(`/api/music/playlist?id=${listId}`);
            if(res.ok) {
                const data = await res.json();
                return (Array.isArray(data) ? data : []).sort(() => Math.random() - 0.5);
            }
            return [];
        } catch (e) {
            return [];
        }
    };

    const fetchRecommendations = async (songId: string) => {
        try {
            const res = await fetch(`/api/music/recommendations?id=${songId}&limit=10`);
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        } catch (e) {
            return [];
        }
    }

    const loadMore = useCallback(async () => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);

        try {
            let newSongs: Song[] = [];
            
            if (songs.length > 0) {
                const lastSong = songs[songs.length - 1];
                newSongs = await fetchRecommendations(lastSong.id);
            } else {
                const seeds = getPreferredSeeds();
                const seed = seeds[0];
                
                if (seed && seed.type === 'song') {
                    newSongs = await fetchRecommendations(seed.value);
                } else if (seed && seed.type === 'mood') {
                     const moodPlaylists: Record<string, string> = {
                        'romantic': '107312845',
                        'sad': '105878208',
                        'party': '15570077',
                        'workout': '111603593',  
                        'happy': '15570077'
                     };
                     const listId = moodPlaylists[seed.value] || '110858205';
                     newSongs = await fetchPlaylistSongs(listId);
                }
            }

            if (newSongs.length === 0) {
                const fallbackPlaylists = [
                    '110858205', 
                    '1098670',   
                    '82914609',  
                    '159082065'  
                ];
                const randomId = fallbackPlaylists[Math.floor(Math.random() * fallbackPlaylists.length)];
                newSongs = await fetchPlaylistSongs(randomId);
            }
            
            setSongs(prev => {
                const existingIds = new Set(prev.map(s => s.id));
                const uniqueNew = newSongs.filter(s => !existingIds.has(s.id));
                return [...prev, ...uniqueNew];
            });

            setPage(p => p + 1);
            setError(null);

        } catch (e) {
            console.error("Explore load failed", e);
            if (songs.length === 0) setError("Failed to load songs");
        } finally {
            setLoading(false);
            loadingRef.current = false;
        }
    }, [songs.length, page]);

    useEffect(() => {
        loadMore();
    }, []);

    return { songs, loading, error, loadMore };
}
