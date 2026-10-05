import { useState, useCallback, useEffect } from 'react';
import { TestSearchState, TestSearchActions } from './test.types';

export function useTestSearchLogic(): { state: TestSearchState, actions: TestSearchActions } {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ artists: any[], playlists: any[], songs: any[] }>({ artists: [], playlists: [], songs: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults({ artists: [], playlists: [], songs: [] });
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      // Points to the updated search endpoint
      const res = await fetch(`/api/music/search?query=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      
      // If the API returns the new structure, use it. Otherwise, fallback.
      if (data.artists || data.playlists || data.songs) {
          setResults({
              artists: data.artists || [],
              playlists: data.playlists || [],
              songs: data.songs || []
          });
      } else {
          // Legacy flat array fallback
          setResults({ artists: [], playlists: [], songs: Array.isArray(data) ? data : [] });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Simple debounce
  useEffect(() => {
    const timer = setTimeout(() => {
        search(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query, search]);

  return {
    state: { query, results, loading, error },
    actions: { setQuery, search }
  };
}
