"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { Song } from '@/lib/types';
import { SearchState, SearchActions } from './search.types';

export function useSearchLogic() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setQueueConfig, playSong } = usePlayer();
  const { user } = useAuth();
  
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<{ artists: any[], playlists: any[], songs: Song[], intent?: any }>({
    artists: [],
    playlists: [],
    songs: []
  });
  const [loading, setLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState(searchParams.get('q') || '');
  const [searchHistory, setSearchHistory] = useState<Song[]>([]);
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Race condition & cancellation refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentReqIdRef = useRef<number>(0);
  const suggestionsAbortRef = useRef<AbortController | null>(null);

  // Flag to differentiate deliberate typing from programmatic query updates
  const isTypingRef = useRef<boolean>(false);
  // Track last committed search query to prevent duplicate searches
  const lastExecutedQueryRef = useRef<string>('');

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('search_history');
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse search history', e);
      }
    }
  }, []);

  const addToHistory = (song: Song) => {
    // Sanitize song object to avoid storing stale stream URLs
    const sanitized: Song = {
      id: song.id,
      name: song.name,
      artist: song.artist,
      album: song.album || '',
      image: song.image,
      url: song.url,
      duration: song.duration || 0,
      source: song.source || 'youtube',
      language: song.language || 'English',
      has_lyrics: song.has_lyrics || 'false',
      year: song.year || '',
      release_date: song.release_date || '',
      type: song.type
    };

    setSearchHistory(prev => {
      const filtered = prev.filter(s => s.id !== song.id);
      const updated = [sanitized, ...filtered].slice(0, 10);
      try {
        localStorage.setItem('search_history', JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage quota exceeded for history', e);
      }
      return updated;
    });
  };

  // Sync debounced query & URL params
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      const currentQ = searchParams.get('q') || '';
      if (query !== currentQ) {
        const newParams = new URLSearchParams(searchParams.toString());
        if (query.trim()) {
          newParams.set('q', query.trim());
        } else {
          newParams.delete('q');
        }
        router.replace(`/search?${newParams.toString()}`);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, router, searchParams]);

  // Fetch suggestions ONLY when user is actively typing
  useEffect(() => {
    if (!isTypingRef.current) {
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      if (!isTypingRef.current) return;

      if (suggestionsAbortRef.current) {
        suggestionsAbortRef.current.abort();
      }
      const controller = new AbortController();
      suggestionsAbortRef.current = controller;

      try {
        const res = await fetch(`/api/music/suggestions?query=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          if (!isTypingRef.current) return;
          const items = data.results || [];
          setSuggestions(items);
          setShowSuggestions(items.length > 0);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Suggestions fetch error:', err);
        }
      }
    }, 180);

    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  // Main search function with AbortController and Request Sequencing
  const searchMusic = useCallback(async (q: string, pageNum: number) => {
    if (!q.trim()) {
      setResults({ artists: [], playlists: [], songs: [] });
      setLoading(false);
      return;
    }

    // Cancel ongoing search request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const reqId = ++currentReqIdRef.current;
    lastExecutedQueryRef.current = `${q.trim().toLowerCase()}_p${pageNum}`;

    setLoading(true);

    try {
      const userId = user?.uid || '';
      const res = await fetch(
        `/api/music/search?query=${encodeURIComponent(q.trim())}&userId=${userId}&page=${pageNum}`,
        { signal: controller.signal }
      );

      // Verify this is the latest in-flight request
      if (reqId !== currentReqIdRef.current) return;

      if (res.ok) {
        const data = await res.json();
        const hasAnyData = (data.artists?.length > 0) || (data.playlists?.length > 0) || (data.songs?.length > 0);

        if (!hasAnyData) {
          setHasMore(false);
          if (pageNum === 1) {
            setResults({ artists: [], playlists: [], songs: [], intent: data.intent });
          }
        } else {
          if (pageNum === 1) {
            setResults({
              artists: data.artists || [],
              playlists: data.playlists || [],
              songs: data.songs || [],
              intent: data.intent
            });
            setHasMore((data.songs || []).length >= 10);
          } else {
            setResults(prev => {
              const existingIds = new Set(prev.songs.map((s: any) => s.id));
              const uniqueNew = (data.songs || []).filter((s: any) => !existingIds.has(s.id));
              if (uniqueNew.length === 0) setHasMore(false);
              return {
                ...prev,
                songs: [...prev.songs, ...uniqueNew]
              };
            });
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Search error:', error);
        if (pageNum === 1 && reqId === currentReqIdRef.current) {
          setResults({ artists: [], playlists: [], songs: [] });
        }
      }
    } finally {
      if (reqId === currentReqIdRef.current) {
        setLoading(false);
      }
    }
  }, [user]);

  // When debounced query changes, execute search if not already triggered
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setResults({ artists: [], playlists: [], songs: [] });
      setHasMore(false);
      setPage(1);
      return;
    }

    // Skip if this query and page was already executed by commitSearch/selectSuggestion
    if (lastExecutedQueryRef.current === `${trimmed.toLowerCase()}_p1`) {
      return;
    }

    setPage(1);
    setHasMore(true);
    searchMusic(trimmed, 1);
  }, [debouncedQuery, searchMusic]);

  // Infinite Scroll Trigger
  const loadMore = useCallback(() => {
    if (!loading && hasMore && debouncedQuery.trim()) {
      const nextPage = page + 1;
      setPage(nextPage);
      searchMusic(debouncedQuery, nextPage);
    }
  }, [loading, hasMore, debouncedQuery, page, searchMusic]);

  const handlePlay = (song: Song) => {
    addToHistory(song);
    playSong(song, 'standalone');
  };

  const handleQueryChange = (val: string) => {
    isTypingRef.current = true;
    setQuery(val);
  };

  const commitSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    isTypingRef.current = false;
    setShowSuggestions(false);
    setSuggestions([]);
    setQuery(trimmed);
    setDebouncedQuery(trimmed);
    setPage(1);
    setHasMore(true);
    searchMusic(trimmed, 1);
  };

  const clearSearch = () => {
    isTypingRef.current = false;
    setQuery('');
    setDebouncedQuery('');
    setResults({ artists: [], playlists: [], songs: [] });
    setSuggestions([]);
    setShowSuggestions(false);
    lastExecutedQueryRef.current = '';
    router.replace('/search');
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('search_history');
  };

  const handleBack = () => {
    router.back();
  };

  const selectSuggestion = (item: any) => {
    isTypingRef.current = false;
    setShowSuggestions(false);
    setSuggestions([]);

    if (item.type === 'artist') {
      router.push(`/artist/${item.id}`);
    } else if (item.type === 'album') {
      router.push(`/playlist/${item.id}?type=album`);
    } else {
      setQuery(item.title);
      setDebouncedQuery(item.title);
      setPage(1);
      setHasMore(true);
      searchMusic(item.title, 1);
    }
  };

  const state: SearchState = {
    query,
    results,
    loading,
    page,
    hasMore,
    searchHistory,
    suggestions,
    showSuggestions
  };

  const actions: SearchActions = {
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
  };

  return { state, actions };
}
