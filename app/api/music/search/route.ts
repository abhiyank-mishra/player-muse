import { NextResponse } from 'next/server';
import { UnifiedSearchEngine } from '@/core/search/UnifiedSearchEngine';

interface CacheEntry {
  data: any;
  timestamp: number;
}

// In-memory LRU Cache with TTL for search queries
class SearchLRUCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(maxEntries = 500, ttlMinutes = 10) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Refresh position for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(key: string, data: any): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest (first item in Map iterator)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

const searchCache = new SearchLRUCache(500, 10);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get('query') || searchParams.get('q');
  const pageParam = searchParams.get('page');

  if (!rawQuery || !rawQuery.trim()) {
    return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
  }

  const query = rawQuery.trim();
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
  const cacheKey = `${query.toLowerCase()}_p${page}`;

  // Check LRU cache
  const cached = searchCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Cache': 'HIT'
      }
    });
  }

  try {
    const results = await UnifiedSearchEngine.search(query, page);
    
    // Cache valid results
    if (results && (results.songs?.length > 0 || results.artists?.length > 0 || results.playlists?.length > 0)) {
      searchCache.set(cacheKey, results);
    }

    return NextResponse.json(results, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Cache': 'MISS'
      }
    });
  } catch (error: any) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Search Error' }, { status: 500 });
  }
}
