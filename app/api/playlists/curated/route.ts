import { NextResponse } from 'next/server';
import {
  getCuratedPlaylists,
  getCuratedPlaylist,
  createCuratedPlaylist,
  updateCuratedPlaylist,
  deleteCuratedPlaylist
} from '@/lib/curatedPlaylists';

// GET - Fetch all playlists or a single playlist by ID
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const activeOnly = searchParams.get('activeOnly') === 'true';

  try {
    if (id) {
      const playlist = await getCuratedPlaylist(id);
      if (!playlist) {
        return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
      }
      return NextResponse.json(playlist);
    } else {
      const playlists = await getCuratedPlaylists(activeOnly);
      return NextResponse.json(playlists);
    }
  } catch (error: any) {
    console.error('GET curated playlists error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create a new curated playlist
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.keywords || !body.createdBy) {
      return NextResponse.json(
        { error: 'Missing required fields: name, keywords, createdBy' },
        { status: 400 }
      );
    }

    const playlistData = {
      name: body.name,
      description: body.description || '',
      keywords: body.keywords,
      spotifyPlaylistId: body.spotifyPlaylistId,
      coverImage: body.coverImage || '',
      songs: body.songs || [],
      createdBy: body.createdBy,
      isActive: body.isActive !== undefined ? body.isActive : true,
      priority: body.priority || 0
    };

    const playlistId = await createCuratedPlaylist(playlistData);
    
    return NextResponse.json({ 
      id: playlistId,
      message: 'Playlist created successfully' 
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST curated playlist error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update an existing curated playlist
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Playlist ID is required' }, { status: 400 });
    }

    await updateCuratedPlaylist(id, updates);
    
    return NextResponse.json({ message: 'Playlist updated successfully' });
  } catch (error: any) {
    console.error('PUT curated playlist error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete a curated playlist
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Playlist ID is required' }, { status: 400 });
  }

  try {
    await deleteCuratedPlaylist(id);
    return NextResponse.json({ message: 'Playlist deleted successfully' });
  } catch (error: any) {
    console.error('DELETE curated playlist error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
