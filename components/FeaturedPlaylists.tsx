
"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Music } from 'lucide-react';
import Spinner from '@/reusable/animations/loading/Spinner';

interface Playlist {
    id: string;
    name: string;
    subtitle?: string;
    image: string;
}

let memoryFeaturedPlaylists: Playlist[] | null = null;
let lastFeaturedFetch = 0;
const FEATURED_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export default function FeaturedPlaylists() {
    const [playlists, setPlaylists] = useState<Playlist[]>(() => {
        if (memoryFeaturedPlaylists && Date.now() - lastFeaturedFetch < FEATURED_CACHE_TTL) {
            return memoryFeaturedPlaylists;
        }
        return [];
    });
    const [loading, setLoading] = useState(() => {
        return !(memoryFeaturedPlaylists && Date.now() - lastFeaturedFetch < FEATURED_CACHE_TTL);
    });

    useEffect(() => {
        if (memoryFeaturedPlaylists && Date.now() - lastFeaturedFetch < FEATURED_CACHE_TTL) {
            setPlaylists(memoryFeaturedPlaylists);
            setLoading(false);
            return;
        }

        const fetchPlaylists = async () => {
            try {
                const res = await fetch('/api/music/playlists');
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        memoryFeaturedPlaylists = data;
                        lastFeaturedFetch = Date.now();
                        setPlaylists(data);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch featured playlists", e);
            } finally {
                setLoading(false);
            }
        };
        fetchPlaylists();
    }, []);

    if (loading) return (
        <div className="flex gap-4 overflow-hidden py-4">
             {[1,2,3,4].map(i => (
                 <div key={i} className="w-32 h-40 bg-white/5 animate-pulse rounded-xl shrink-0" />
             ))}
        </div>
    );

    if (playlists.length === 0) return null;

    return (
        <div className="flex flex-col gap-4 mb-10">
            <h2 className="text-xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                Featured Charts
                <span className="px-1.5 py-0.5 bg-red-600/20 text-red-400 text-[10px] md:text-xs rounded-md uppercase tracking-wider">YouTube Music</span>
            </h2>
            
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar" style={{ touchAction: 'pan-x pan-y' }}>
                {playlists.map((playlist) => (
                    <Link 
                        key={playlist.id} 
                        href={`/playlist/${playlist.id}?name=${encodeURIComponent(playlist.name)}&image=${encodeURIComponent(playlist.image || '')}&subtitle=${encodeURIComponent(playlist.subtitle || '')}`}
                        className="group flex flex-col gap-2 w-32 md:w-40 shrink-0 cursor-pointer"
                    >
                        <div className="relative aspect-square rounded-xl overflow-hidden shadow-lg">
                            <img 
                                src={typeof playlist.image === 'string' && playlist.image.trim() !== '' ? playlist.image : undefined} 
                                alt={playlist.name} 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                            />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <Music className="w-8 h-8 text-white drop-shadow-lg" />
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-sm font-bold text-white truncate group-hover:text-pink-400 transition-colors">{playlist.name}</p>
                            <p className="text-[10px] text-gray-500 truncate">{playlist.subtitle || 'Top Hits'}</p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
