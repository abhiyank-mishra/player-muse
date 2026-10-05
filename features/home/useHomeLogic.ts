import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUI } from '@/contexts/UIContext';
import { getGlobalExplorer, getDailyStats } from '@/lib/ranking';
import { Song } from '@/lib/types';
import EventBus from '@/core/events/EventBus';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { homeCache } from '@/lib/homeCache';

// Shared across hook instances so concurrent triggers reuse one network request
let madeForYouInFlight: Promise<void> | null = null;

export function useHomeLogic() {
  const { user, userName } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setQueueConfig, playSong, currentSong } = usePlayer();
  const { toggleSidebar } = useUI();

  // Instant hydration from homeCache — preserves songs across page transitions
  const initialFeed = homeCache.get();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [communityTrending, setCommunityTrending] = useState<Song[]>(() => initialFeed?.communityTrending || []);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [globalExplorer, setGlobalExplorer] = useState<Song[]>(() => initialFeed?.globalExplorer || []);
  const [allDiscoverSongs, setAllDiscoverSongs] = useState<Song[]>(() => initialFeed?.allDiscoverSongs || []);
  const [discoverPage, setDiscoverPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dailyPlays, setDailyPlays] = useState(0);
  const [streak, setStreak] = useState(0);
  const [madeForYou, setMadeForYou] = useState<Song[]>(() => initialFeed?.madeForYou || []);
  const [madeForYouPersonalized, setMadeForYouPersonalized] = useState(() => initialFeed?.madeForYouPersonalized || false);

  const touchStartRef = useRef<number>(0);
  const touchEndRef = useRef<number>(0);

  const resetSearch = () => {
    setQuery('');
    setResults([]);
    setDebouncedQuery('');
  };

  useEffect(() => {
    if (searchParams.get('reset') === 'true') resetSearch();
  }, [searchParams]);

  useEffect(() => {
    const handleLikeChange = () => loadCommunityTrending(false, true);
    EventBus.on('likeChanged', handleLikeChange);
    return () => EventBus.off('likeChanged', handleLikeChange);
  }, []);

  const handleSearchShortcut = useCallback(() => {
    router.push('/search');
  }, [router]);

  useKeyboardShortcut({ key: 's', modifiers: ['ctrlOrMeta'], onTrigger: handleSearchShortcut });

  useEffect(() => {
    // Post-hydration check & restore (safe from SSR hydration mismatches)
    const current = homeCache.get() || homeCache.restoreFromStorage();
    if (current) {
      if (current.communityTrending.length > 0) setCommunityTrending(current.communityTrending);
      if (current.globalExplorer.length > 0) {
        setGlobalExplorer(current.globalExplorer);
        setAllDiscoverSongs(current.allDiscoverSongs);
      }
      if (current.madeForYou.length > 0) {
        setMadeForYou(current.madeForYou);
        setMadeForYouPersonalized(current.madeForYouPersonalized);
      }
    }

    const needsTrending = !current || current.communityTrending.length === 0;
    const needsExplorer = !current || current.globalExplorer.length === 0;
    const needsMadeForYou = !current || current.madeForYou.length === 0;

    if (needsTrending) loadCommunityTrending(false);
    if (needsExplorer) loadGlobalExplorer();
    if (needsMadeForYou) loadMadeForYou();
  }, []);

  useEffect(() => {
    if (user) {
        loadDailyPlays();
        const current = homeCache.get();
        if (!current?.madeForYouPersonalized) {
            loadMadeForYou(true);
        }
    }
  }, [user]);

  useEffect(() => {
    if (user && currentSong) {
      const timer = setTimeout(loadDailyPlays, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentSong, user]);

  const loadDailyPlays = async () => {
    try {
      const stats = await getDailyStats(user!.uid);
      setDailyPlays(stats.count);
      setStreak(stats.streak);
    } catch (e) { console.error(e); }
  };

  const loadGlobalExplorer = async (forceRefresh = false) => {
    const current = homeCache.get();
    if (!forceRefresh && current && current.globalExplorer.length > 0) {
      setAllDiscoverSongs(current.allDiscoverSongs);
      setGlobalExplorer(current.globalExplorer);
      setDiscoverPage(1);
      return;
    }
    try {
      const res = await fetch('/api/music/discover');
      const songs = res.ok ? await res.json() : [];
      if (Array.isArray(songs) && songs.length > 0) {
        setAllDiscoverSongs(songs);
        const top7 = songs.slice(0, 7);
        setGlobalExplorer(top7);
        homeCache.set({ globalExplorer: top7, allDiscoverSongs: songs });
      }
      setDiscoverPage(1);
    } catch (e) { console.error(e); }
  };

  const loadMoreDiscover = () => {
      const nextPage = discoverPage + 1;
      setDiscoverPage(nextPage);
      setGlobalExplorer(allDiscoverSongs.slice(0, nextPage * 7));
  };

  const loadCommunityTrending = async (isLoadMore = false, forceRefresh = false) => {
    if (isLoadMore) return; // API returns all at once, no pagination
    const current = homeCache.get();
    if (!forceRefresh && current && current.communityTrending.length > 0) {
      setCommunityTrending(current.communityTrending);
      setHasMore(false);
      return;
    }
    try {
      const res = await fetch('/api/music/trending');
      const songs = res.ok ? await res.json() : [];
      if (Array.isArray(songs) && songs.length > 0) {
        setCommunityTrending(songs);
        homeCache.set({ communityTrending: songs });
      }
      setHasMore(false);
    } catch (e) { console.error(e); }
  };



  const searchMusic = (q: string) => {
    if (q?.trim()) {
      router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    }
  };

  const loadMadeForYou = async (forceRefresh = false) => {
    const current = homeCache.get();

    if (!forceRefresh && current && current.madeForYou.length > 0) {
      setMadeForYou(current.madeForYou);
      setMadeForYouPersonalized(current.madeForYouPersonalized);
      return;
    }

    // Mount and login effects can both trigger this; share one in-flight request.
    if (madeForYouInFlight) return madeForYouInFlight;
    madeForYouInFlight = loadMadeForYouInner().finally(() => { madeForYouInFlight = null; });
    return madeForYouInFlight;
  };

  const loadMadeForYouInner = async () => {
    try {
      const { getPreferredSeeds, getPreferences } = await import('@/lib/preferences');
      const prefs = getPreferences();
      const seeds = getPreferredSeeds();

      const sortedWeights = Object.entries(prefs.songWeights).sort((a, b) => b[1] - a[1]);
      const topSongIds: string[] = [];
      for (const [id] of sortedWeights) {
        if (topSongIds.length >= 3) break;
        topSongIds.push(id);
      }

      const seedSongIds = Array.from(new Set([
        ...topSongIds,
        ...seeds.filter(s => s.type === 'song').map(s => s.value),
      ])).slice(0, 4);

      const artists = (prefs.likedArtists || []).slice(0, 3);
      const moodSeed = seeds.find(s => s.type === 'mood');
      const mood = moodSeed?.value || '';

      const history = prefs.recentHistory || [];

      // Recent song names + artists for YouTube Music seeding (kept index-aligned)
      const seedPairs: { name: string; artist: string }[] = [];
      const seenSeedNames = new Set<string>();
      for (const s of history) {
        if (seedPairs.length >= 5) break;
        const name = (s.name || '').trim();
        if (!name || name === 'Unknown Song') continue;
        const key = name.toLowerCase();
        if (seenSeedNames.has(key)) continue;
        seenSeedNames.add(key);
        const artist = s.artist?.split(',')[0]?.trim() || '';
        seedPairs.push({ name, artist: artist === 'Unknown Artist' || artist === 'Unknown' ? '' : artist });
      }

      // Listening languages: share-weighted from recent history (recent plays count more)
      const langScore: Record<string, number> = {};
      let totalLangWeight = 0;
      history.slice(0, 20).forEach((s, idx) => {
        const lang = (s.language || '').toLowerCase().trim();
        if (!lang || lang === 'unknown') return;
        const w = 20 - idx;
        langScore[lang] = (langScore[lang] || 0) + w;
        totalLangWeight += w;
      });
      const langs = Object.entries(langScore)
        .filter(([, w]) => totalLangWeight > 0 && w / totalLangWeight >= 0.12)
        .sort((a, b) => b[1] - a[1])
        .map(([l]) => l)
        .slice(0, 3);

      const params = new URLSearchParams();
      if (seedSongIds.length > 0) params.set('seeds', seedSongIds.join(','));
      if (artists.length > 0) params.set('artists', artists.join(','));
      if (mood) params.set('mood', mood);
      // YouTube Music neural recommendation seeding
      if (seedPairs.length > 0) {
        params.set('seedNames', seedPairs.map(p => p.name).join('||'));
        params.set('seedArtists', seedPairs.map(p => p.artist).join('||'));
      }
      if (langs.length > 0) params.set('langs', langs.join(','));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(`/api/music/feed/personalized?${params.toString()}`, { signal: controller.signal })
        .finally(() => clearTimeout(timeout));
      if (res.ok) {
        const data = await res.json();
        const songs: Song[] = data.songs || [];
        if (songs.length > 0) {
          const existing = homeCache.get();
          if (!data.isPersonalized && existing?.madeForYouPersonalized && existing.madeForYou.length > 0) {
            // Keep the existing personalized shelf instead of downgrading it
            return;
          }
          setMadeForYou(songs);
          setMadeForYouPersonalized(data.isPersonalized);
          homeCache.set({ madeForYou: songs, madeForYouPersonalized: data.isPersonalized });
          return;
        }
      }

      // Fallback to discover if empty
      const discRes = await fetch('/api/music/discover');
      if (discRes.ok) {
        const discoverSongs: Song[] = await discRes.json();
        const top20 = (Array.isArray(discoverSongs) ? discoverSongs : []).slice(0, 20);
        setMadeForYou(top20);
        setMadeForYouPersonalized(false);
        homeCache.set({ madeForYou: top20, madeForYouPersonalized: false });
      }
    } catch (e) {
      console.error('[Home] Failed to load personalized feed:', e);
    }
  };

  const handleSuggestionClick = async (s: any) => {
    setShowSuggestions(false);
    if (s.type === 'song') {
      try {
        setLoading(true);
        const res = await fetch(`/api/music/song?id=${s.id}`);
        if (res.ok) {
          const songData = await res.json();
          setQueueConfig([songData], 0);
          setResults([songData]);
          setQuery(s.title);
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    } else {
      setQuery(s.title);
      setDebouncedQuery(s.title);
      searchMusic(s.title);
    }
  };

  const handlePlayAll = () => {
    if (results.length > 0) {
        setQueueConfig(results, 0);
    }
  };

  return {
    state: { user, userName, searchParams, query, results, communityTrending, hasMore, loadingMore, globalExplorer, allDiscoverSongs, discoverPage, loading, showSuggestions, dailyPlays, streak, madeForYou, madeForYouPersonalized },
    actions: { setQuery, resetSearch, loadCommunityTrending, loadMoreDiscover, handleSuggestionClick, handlePlayAll, toggleSidebar, setQueueConfig, playSong, searchMusic }
  };
}
