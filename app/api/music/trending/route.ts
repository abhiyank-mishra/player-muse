import { NextResponse } from 'next/server';
import { YouTubeSearchEngine } from '@/core/search/YouTubeSearchEngine';
import { Song } from '@/lib/types';

// In-memory cache for trending songs (20 minutes TTL)
let cachedTrending: Song[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 20 * 60 * 1000;

export async function GET() {
  try {
    if (cachedTrending && cachedTrending.length > 0 && Date.now() < cacheExpiry) {
      return NextResponse.json(cachedTrending, {
        headers: {
          'Cache-Control': 'public, max-age=900, s-maxage=1800, stale-while-revalidate=86400',
          'X-Cache': 'HIT',
        },
      });
    }

    const songs = await YouTubeSearchEngine.search('Top Trending Hindi Songs 2026', 25);
    if (Array.isArray(songs) && songs.length > 0) {
      cachedTrending = songs;
      cacheExpiry = Date.now() + CACHE_TTL_MS;
    }

    return NextResponse.json(songs, {
      headers: {
        'Cache-Control': 'public, max-age=900, s-maxage=1800, stale-while-revalidate=86400',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Trending API Error:', error);
    if (cachedTrending) {
      return NextResponse.json(cachedTrending, {
        headers: { 'X-Cache': 'STALE-FALLBACK' },
      });
    }
    return NextResponse.json([]);
  }
}
