import { NextResponse } from 'next/server';
import { getSpotifyPlaylistTracks } from '@/lib/spotify';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playlistId = searchParams.get('playlistId');

  if (!playlistId) {
    return NextResponse.json({ error: 'playlistId query parameter is required' }, { status: 400 });
  }

  try {
    const tracks = await getSpotifyPlaylistTracks(playlistId);
    if (!tracks || tracks.length === 0) {
      return NextResponse.json({ error: 'No tracks found in the playlist. Make sure it is public.' }, { status: 404 });
    }
    return NextResponse.json(tracks);
  } catch (error: any) {
    console.error('Spotify API Route Error:', error);
    return NextResponse.json({ error: 'Failed to fetch tracks from Spotify' }, { status: 500 });
  }
}
