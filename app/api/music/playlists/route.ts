import { NextResponse } from 'next/server';
import { FEATURED_PLAYLISTS } from '@/lib/featuredPlaylists';

export async function GET() {
  return NextResponse.json(FEATURED_PLAYLISTS, {
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
