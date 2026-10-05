import { NextResponse } from 'next/server';
import { YouTubeSearchEngine } from '@/core/search/YouTubeSearchEngine';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') || '';
  const nameParam = searchParams.get('name') || '';

  const artistName = (nameParam || id).replace(/[-_]/g, ' ').trim();

  if (!artistName) {
    return NextResponse.json({ error: 'Artist identifier is required' }, { status: 400 });
  }

  try {
    const songs = await YouTubeSearchEngine.search(`${artistName} songs hits`, 30);

    const firstImage = songs[0]?.image?.[0] || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500';

    return NextResponse.json({
      id: id || artistName,
      name: artistName,
      image: [firstImage, firstImage, firstImage],
      follower_count: '1000000',
      is_verified: true,
      topSongs: songs,
      topAlbums: [],
      dedicated_artist_page: true
    });
  } catch (error) {
    console.error('Artist API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch artist details' }, { status: 500 });
  }
}
