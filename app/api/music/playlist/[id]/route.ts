import { NextResponse } from 'next/server';
import { FEATURED_PLAYLISTS, FeaturedPlaylist } from '@/lib/featuredPlaylists';
import { YouTubeSearchEngine } from '@/core/search/YouTubeSearchEngine';

const playlistCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    if (!id) {
      return NextResponse.json({ error: 'Playlist ID required' }, { status: 400 });
    }

    const cached = playlistCache.get(id);
    if (cached && Date.now() < cached.expiry) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, max-age=1800, s-maxage=3600',
          'X-Cache': 'HIT',
        },
      });
    }

    const match = FEATURED_PLAYLISTS.find((p: FeaturedPlaylist) => p.id === id);
    const query = match ? match.query : id.replace(/_/g, ' ');
    const name = match ? match.name : id.replace(/_/g, ' ');
    const subtitle = match ? match.subtitle : 'YouTube Music Playlist';
    const image = match ? match.image : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500';

    const songs = await YouTubeSearchEngine.search(query, 30);

    const playlist = {
      id,
      name,
      subtitle,
      image,
      header_desc: subtitle,
      songs: songs
    };

    playlistCache.set(id, {
      data: playlist,
      expiry: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json(playlist, {
      headers: {
        'Cache-Control': 'public, max-age=1800, s-maxage=3600',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Error fetching playlist:', error);
    return NextResponse.json({ error: 'Failed to fetch playlist details' }, { status: 500 });
  }
}
