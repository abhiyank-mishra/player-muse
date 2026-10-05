"use client";
import React, { useEffect, useRef } from 'react';
import { Search, X, TrendingUp, Music2 } from 'lucide-react';
import { SearchState, SearchActions } from './search.types';
import Link from 'next/link';
import SongListItem from '@/components/SongListItem';
import Footer from '@/components/Footer';
import { useInView } from 'react-intersection-observer';
import SearchSkeleton from '@/reusable/animations/search-skeleton/SearchSkeleton';
import Spinner from '@/reusable/animations/loading/Spinner';

interface SearchUIProps {
  state: SearchState;
  actions: SearchActions;
}

export default function SearchUI({ state, actions }: SearchUIProps) {
  const { query, results, loading, page, hasMore, searchHistory, suggestions, showSuggestions } = state;
  const { setQuery, clearSearch, clearHistory, handlePlay, handleBack, loadMore, selectSuggestion, setShowSuggestions } = actions;
  const { ref, inView } = useInView({ threshold: 0.1 });
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Trigger infinite scroll when sentinel enters view
  useEffect(() => {
    if (inView && hasMore && !loading) {
      loadMore();
    }
  }, [inView, hasMore, loading, loadMore]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setShowSuggestions]);

  const isArtistQuery = results.intent?.intent === 'artist_discography';
  const primaryArtist = results.artists?.[0];

  return (
    <div className="min-h-screen pb-32 bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          {/* Search Bar Row */}
          <div className="flex items-center gap-4" ref={searchContainerRef}>
            <button
              onClick={handleBack}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Back"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search songs, artists, albums..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                autoFocus
                className="w-full pl-12 pr-12 py-3 bg-[#121212] border border-white/10 rounded-xl text-white placeholder-gray-500 outline-none focus:border-purple-500/50 transition-colors"
              />
              {query && (
                <button
                  onClick={clearSearch}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  aria-label="Clear search"
                >
                  <X className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
                </button>
              )}

              {/* Autocomplete Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-[#121212] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 divide-y divide-white/5 max-h-96 overflow-y-auto">
                  {suggestions.map((item, idx) => (
                    <button
                      key={`sug-${idx}`}
                      type="button"
                      onClick={() => selectSuggestion(item)}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors group"
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-9 h-9 rounded object-cover shrink-0 bg-white/5"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-9 h-9 rounded bg-white/10 flex items-center justify-center shrink-0">
                          <Music2 className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate group-hover:text-purple-400 transition-colors">
                          {item.title}
                        </p>
                        {item.subtitle && (
                          <p className="text-xs text-gray-400 truncate">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider px-2 py-0.5 rounded bg-white/5">
                        {item.type}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Results Content */}
      <div className="max-w-4xl mx-auto px-6 py-6 transition-opacity duration-300">
        
        {/* Initial Loading Skeleton */}
        {loading && page === 1 && (
          <SearchSkeleton count={6} />
        )}

        {/* No Results */}
        {!loading && query && (!results.artists?.length && !results.playlists?.length && !results.songs?.length) && page === 1 && (
          <div className="text-center py-20">
            <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-white text-lg font-medium">No results found</h3>
            <p className="text-gray-500 text-sm mt-1">Try checking for typos or searching with artist name</p>
          </div>
        )}

        {/* Search History */}
        {!query && searchHistory.length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white">Recent Searches</h2>
              <button
                onClick={clearHistory}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="space-y-1">
              {searchHistory.map((song, idx) => (
                <SongListItem
                  key={`hist-${song.id}-${idx}`}
                  song={song}
                  index={idx}
                  onPlay={() => handlePlay(song, idx)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Actual Results */}
        {(results.artists?.length > 0 || results.playlists?.length > 0 || results.songs?.length > 0) && (() => {
          const topSongs = results.songs ? results.songs.slice(0, 5) : [];
          const restSongs = results.songs ? results.songs.slice(5) : [];

          return (
            <div className="space-y-8">
              {/* Artist Spotlight (elevated if artist query) */}
              {isArtistQuery && primaryArtist && (
                <div className="p-4 bg-[#121212] border border-white/10 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {primaryArtist.image ? (
                      <img
                        src={primaryArtist.image}
                        alt={primaryArtist.name}
                        className="w-16 h-16 rounded-full object-cover shadow-lg bg-white/5"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                        <Search className="w-6 h-6 text-white/40" />
                      </div>
                    )}
                    <div>
                      <span className="text-xs uppercase tracking-wider text-purple-400 font-semibold">Artist</span>
                      <h3 className="text-xl font-bold text-white">{primaryArtist.name}</h3>
                    </div>
                  </div>
                  <Link
                    href={`/artist/${primaryArtist.id}`}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-sm font-medium rounded-xl transition-colors shrink-0"
                  >
                    View Artist
                  </Link>
                </div>
              )}

              {/* Top Songs */}
              {topSongs.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-white mb-4">Songs</h2>
                  <div className="space-y-1">
                    {topSongs.map((song: any, i: number) => (
                      <SongListItem
                        key={`song-${song.id}-${i}`}
                        song={song}
                        index={i}
                        onPlay={() => handlePlay(song, i)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Playlists & Albums */}
              {results.playlists && results.playlists.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-white mb-4">Playlists & Albums</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {results.playlists.map((p: any) => (
                      <Link
                        key={`pl-${p.id}`}
                        href={`/playlist/curated/${p.id}?type=${p.type}`}
                        className="block group"
                      >
                        {p.image || p.coverImage ? (
                          <img
                            src={p.image || p.coverImage}
                            alt={p.title || p.name}
                            className="w-full aspect-square rounded-lg mb-2 object-cover group-hover:opacity-80 transition-opacity bg-white/5"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full aspect-square bg-white/5 rounded-lg mb-2 flex items-center justify-center group-hover:opacity-80 transition-opacity">
                            <TrendingUp className="w-8 h-8 text-white/20" />
                          </div>
                        )}
                        <p className="font-medium text-white truncate mt-1 text-sm">{p.title || p.name}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Artists Carousel (shown if not already spotlighted or multiple artists) */}
              {results.artists && results.artists.length > 0 && (!isArtistQuery || results.artists.length > 1) && (
                <div>
                  <h2 className="text-xl font-bold text-white mb-4">Artists</h2>
                  <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar snap-x" style={{ touchAction: 'pan-x pan-y' }}>
                    {results.artists.map((artist: any) => (
                      <Link
                        key={`art-${artist.id}`}
                        href={`/artist/${artist.id}`}
                        className="block group shrink-0 w-28 text-center snap-start"
                      >
                        {artist.image ? (
                          <img
                            src={artist.image}
                            alt={artist.name || artist.title}
                            className="w-full aspect-square rounded-full mb-2 object-cover group-hover:opacity-80 transition-opacity shadow-lg bg-white/5"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full aspect-square bg-white/5 rounded-full mb-2 flex items-center justify-center group-hover:opacity-80 transition-opacity flex-shrink-0">
                            <Search className="w-8 h-8 text-white/20" />
                          </div>
                        )}
                        <p className="font-medium text-white truncate text-sm mt-2">{artist.title || artist.name}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Remaining Songs */}
              {restSongs.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-white mb-4">More Songs</h2>
                  <div className="space-y-1">
                    {restSongs.map((song: any, i: number) => (
                      <SongListItem
                        key={`rest-${song.id}-${i + 5}`}
                        song={song}
                        index={i + 5}
                        onPlay={() => handlePlay(song, i + 5)}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Sentinel for Infinite Scroll */}
              {hasMore && (
                <div ref={ref} className="py-8 min-h-[64px] flex justify-center items-center">
                  {loading && <Spinner className="w-6 h-6 text-purple-500" />}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <Footer />
    </div>
  );
}
