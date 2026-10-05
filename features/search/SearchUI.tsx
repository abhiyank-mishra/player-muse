"use client";
import React, { useEffect, useRef } from 'react';
import { Search, X, TrendingUp, Music2 } from 'lucide-react';
import { SearchState, SearchActions } from './search.types';
import Link from 'next/link';
import SongListItem from '@/components/SongListItem';
import { useInView } from 'react-intersection-observer';
import SearchSkeleton from '@/reusable/animations/search-skeleton/SearchSkeleton';
import Spinner from '@/reusable/animations/loading/Spinner';

interface SearchUIProps {
  state: SearchState;
  actions: SearchActions;
}

const POPULAR_SEARCH_TAGS = [
  'Trending Hindi',
  'Arijit Singh',
  'Bollywood Classics',
  'Punjabi Hits',
  'Lo-Fi Chill',
  'Romantic',
  'English Pop',
  'Indie India'
];

export default function SearchUI({ state, actions }: SearchUIProps) {
  const { query, results, loading, page, hasMore, searchHistory, suggestions, showSuggestions } = state;
  const {
    setQuery,
    handleQueryChange,
    commitSearch,
    clearSearch,
    clearHistory,
    handlePlay,
    handleBack,
    loadMore,
    selectSuggestion,
    setShowSuggestions
  } = actions;
  const { ref, inView } = useInView({ threshold: 0.1 });
  const searchContainerRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Trigger infinite scroll when sentinel enters view
  useEffect(() => {
    if (inView && hasMore && !loading) {
      loadMore();
    }
  }, [inView, hasMore, loading, loadMore]);

  // Close suggestions on outside click, touch, or scroll
  useEffect(() => {
    const handleDismiss = (e: MouseEvent | TouchEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    const handleScroll = () => {
      if (showSuggestions) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleDismiss);
    document.addEventListener('touchstart', handleDismiss, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleDismiss);
      document.removeEventListener('touchstart', handleDismiss);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [showSuggestions, setShowSuggestions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setShowSuggestions(false);
      inputRef.current?.blur();
      commitSearch(query.trim());
    }
  };

  const isArtistQuery = results.intent?.intent === 'artist_discography';
  const primaryArtist = results.artists?.[0];

  return (
    <div className="w-full text-white">
      {/* Mobile transparent overlay for outside tap dismiss without blurring the screen */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          className="fixed inset-0 z-40 sm:hidden"
          onClick={() => setShowSuggestions(false)}
          onTouchStart={() => setShowSuggestions(false)}
        />
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-3.5 sm:py-4">
        <div className="max-w-4xl mx-auto">
          {/* Search Bar Form */}
          <form
            onSubmit={handleSubmit}
            className="relative w-full z-50"
            ref={searchContainerRef}
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search songs, artists, albums..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setShowSuggestions(false);
                  inputRef.current?.blur();
                }
              }}
              autoFocus
              className="w-full pl-11 sm:pl-12 pr-11 sm:pr-12 py-3 bg-[#121214] border border-white/10 rounded-2xl text-white placeholder-neutral-500 text-sm sm:text-base outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all shadow-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  clearSearch();
                  inputRef.current?.focus();
                }}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 hover:text-white transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}

            {/* Autocomplete Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-[#121214] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 divide-y divide-white/5 max-h-80 sm:max-h-96 overflow-y-auto backdrop-blur-xl">
                {suggestions.map((item, idx) => (
                  <button
                    key={`sug-${idx}`}
                    type="button"
                    onClick={() => {
                      inputRef.current?.blur();
                      selectSuggestion(item);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 active:bg-white/10 transition-colors group"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-9 h-9 rounded-lg object-cover shrink-0 aspect-square bg-white/5"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center shrink-0 aspect-square">
                        <Music2 className="w-4 h-4 text-neutral-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate group-hover:text-white transition-colors">
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="text-xs text-neutral-400 truncate">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider px-2 py-0.5 rounded bg-white/5 border border-white/5">
                      {item.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Results Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 transition-opacity duration-300 flex-1 w-full">
        
        {/* Initial Loading Skeleton */}
        {loading && page === 1 && (
          <SearchSkeleton count={6} />
        )}

        {/* No Results */}
        {!loading && query && (!results.artists?.length && !results.playlists?.length && !results.songs?.length) && page === 1 && (
          <div className="text-center py-16 sm:py-20">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <Search className="w-6 h-6 text-neutral-400" />
            </div>
            <h3 className="text-white text-base sm:text-lg font-medium">No results found</h3>
            <p className="text-neutral-400 text-xs sm:text-sm mt-1 max-w-xs mx-auto">Try checking for typos or searching with artist or song name</p>
          </div>
        )}

        {/* When no query is typed: Show Recent Searches (if any) + Quick Discover Tags */}
        {!query && (
          <div className="space-y-8">
            {searchHistory.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Recent Searches</h2>
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="text-xs text-neutral-400 hover:text-white transition-colors"
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

            {/* Quick Explore / Trending Chips */}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white mb-3 tracking-tight">
                {searchHistory.length > 0 ? "Trending Searches" : "Explore & Search"}
              </h2>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SEARCH_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      inputRef.current?.blur();
                      commitSearch(tag);
                    }}
                    className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#121214] border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-200 active:scale-95"
                  >
                    {tag}
                  </button>
                ))}
              </div>
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
                <div className="p-4 bg-[#121214] border border-white/10 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    {primaryArtist.image ? (
                      <img
                        src={primaryArtist.image}
                        alt={primaryArtist.name}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover shrink-0 aspect-square shadow-lg bg-white/5"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/5 border border-white/5 flex items-center justify-center shrink-0 aspect-square">
                        <Search className="w-6 h-6 text-white/40" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Artist</span>
                      <h3 className="text-lg sm:text-xl font-bold text-white truncate">{primaryArtist.name}</h3>
                    </div>
                  </div>
                  <Link
                    href={`/artist/${primaryArtist.id}`}
                    className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium rounded-xl transition-colors shrink-0 text-white"
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
                            className="w-full aspect-square shrink-0 rounded-lg mb-2 object-cover group-hover:opacity-80 transition-opacity bg-white/5"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full aspect-square shrink-0 bg-white/5 rounded-lg mb-2 flex items-center justify-center group-hover:opacity-80 transition-opacity">
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
                            className="w-full aspect-square shrink-0 rounded-full mb-2 object-cover group-hover:opacity-80 transition-opacity shadow-lg bg-white/5"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full aspect-square shrink-0 bg-white/5 rounded-full mb-2 flex items-center justify-center group-hover:opacity-80 transition-opacity">
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
                  {loading && <Spinner className="w-6 h-6 text-neutral-400" />}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
