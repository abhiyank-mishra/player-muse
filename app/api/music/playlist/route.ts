import { NextResponse } from 'next/server';
import { FEATURED_PLAYLISTS, FeaturedPlaylist } from '@/lib/featuredPlaylists';
import { YouTubeSearchEngine } from '@/core/search/YouTubeSearchEngine';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID parameter is required' }, { status: 400 });
  }

  const match = FEATURED_PLAYLISTS.find((p: FeaturedPlaylist) => p.id === id);
  const query = match ? match.query : id.replace(/_/g, ' ');
  const name = match ? match.name : id.replace(/_/g, ' ');
  const subtitle = match ? match.subtitle : 'YouTube Music Playlist';
  const image = match ? match.image : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500';

  const songs = await YouTubeSearchEngine.search(query, 30);

  return NextResponse.json({
    id,
    name,
    subtitle,
    image,
    songs
  });
}
