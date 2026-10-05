"use client";

import React, { useState, useEffect } from 'react';
import { Search, Plus, Check, X, Music } from 'lucide-react';
import { useColab } from '@/contexts/ColabContext';
import { Song } from '@/lib/types';
import Spinner from '@/reusable/animations/loading/Spinner';

interface AddSongModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddSongToColabModal({ isOpen, onClose }: AddSongModalProps) {
  const { addToColabQueue, room } = useColab();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/music/search?query=${encodeURIComponent(searchQuery)}&limit=15`);
        if (res.ok) {
          const data = await res.json();
          const songs = Array.isArray(data) ? data : data.songs || [];
          setResults(songs);
        }
      } catch (e) {
        console.error('Colab search failed:', e);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!isOpen) return null;

  const handleAdd = (song: Song) => {
    addToColabQueue(song);
    setAddedIds(prev => new Set(prev).add(song.id));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-lg bg-[#121214] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold text-white">Add Songs to Colab</h3>
            <p className="text-xs text-zinc-400">Queue songs for everyone in {room?.name}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus-within:border-purple-500/50 transition-colors">
            <Search className="w-4 h-4 text-zinc-400 shrink-0" />
            <input 
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by song, artist, album..."
              className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
            />
            {isSearching && <Spinner className="w-4 h-4 text-purple-400" />}
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 hide-scrollbar">
          {results.length > 0 ? (
            results.map((song) => {
              const img = Array.isArray(song.image) ? song.image[1] || song.image[0] : song.image;
              const isAdded = addedIds.has(song.id);

              return (
                <div 
                  key={song.id}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-900 shrink-0 relative">
                      {img ? (
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-4 h-4 text-zinc-600" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{song.name}</p>
                      <p className="text-[11px] text-zinc-400 truncate">{song.artist}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAdd(song)}
                    disabled={isAdded}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 whitespace-nowrap ${
                      isAdded
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-white/10 hover:bg-white/20 text-white border border-white/10 active:scale-95'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Added</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          ) : searchQuery.trim() && !isSearching ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              No songs found. Try a different title or artist.
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-500 text-xs">
              Type to search songs to queue for the group session.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
