"use client";

import { use, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getCuratedPlaylist, createCuratedPlaylist, updateCuratedPlaylist } from '@/lib/curatedPlaylists';
import { Song } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X, Loader } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/contexts/ToastContext';

export default function CuratedPlaylistForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    keywords: [] as string[],
    spotifyUrl: '',
    coverImage: '',
    priority: 0,
    isActive: true,
    songs: [] as Song[]
  });

  const [keywordInput, setKeywordInput] = useState('');

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/');
      return;
    }

    if (!authLoading && isAdmin && !isNew) {
      loadPlaylist();
    }
  }, [authLoading, isAdmin, id]);

  const loadPlaylist = async () => {
    try {
      const playlist = await getCuratedPlaylist(id);
      if (!playlist) {
        setError('Playlist not found');
        return;
      }

      setFormData({
        name: playlist.name,
        description: playlist.description || '',
        keywords: playlist.keywords,
        spotifyUrl: playlist.spotifyPlaylistId || '',
        coverImage: playlist.coverImage,
        priority: playlist.priority,
        isActive: playlist.isActive,
        songs: playlist.songs
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const extractSpotifyPlaylistId = (url: string): string | null => {
    const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  };

  const handleAddKeyword = () => {
    const keyword = keywordInput.trim().toLowerCase();
    if (keyword && !formData.keywords.includes(keyword)) {
      setFormData({ ...formData, keywords: [...formData.keywords, keyword] });
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setFormData({
      ...formData,
      keywords: formData.keywords.filter(k => k !== keyword)
    });
  };

  const handleImportSpotify = async () => {
    const playlistId = extractSpotifyPlaylistId(formData.spotifyUrl);
    if (!playlistId) {
      setError('Invalid Spotify URL');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const spotifyRes = await fetch(`/api/music/spotify?playlistId=${playlistId}`);
      if (!spotifyRes.ok) throw new Error('Failed to fetch Spotify tracks');
      
      const spotifyTracks = await spotifyRes.json();
      
      const matchedSongs: Song[] = [];
      for (const track of spotifyTracks) {
        try {
          const matchRes = await fetch(
            `/api/music/spotify/match?name=${encodeURIComponent(track.name)}&artist=${encodeURIComponent(track.artist)}`
          );
          
          if (matchRes.ok) {
            const song = await matchRes.json();
            matchedSongs.push(song);
          }
        } catch (e) {
          console.error('Failed to match:', track.name);
        }
      }

      setFormData({
        ...formData,
        songs: matchedSongs,
        coverImage: formData.coverImage || (matchedSongs[0]?.image?.[2] || '')
      });
      
      showToast(`Imported ${matchedSongs.length} songs!`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || formData.keywords.length === 0) {
      setError('Please provide a name and at least one keyword');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const playlistData: any = {
        name: formData.name,
        description: formData.description,
        keywords: formData.keywords,
        spotifyPlaylistId: extractSpotifyPlaylistId(formData.spotifyUrl) || undefined,
        coverImage: formData.coverImage,
        songs: formData.songs,
        priority: formData.priority,
        isActive: formData.isActive,
        createdBy: user?.email || 'unknown'
      };

      if (isNew) {
        await createCuratedPlaylist(playlistData);
      } else {
        await updateCuratedPlaylist(id, playlistData);
      }

      router.push('/admin');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <Loader className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-32">
      <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
        <Link href="/admin" className="p-2 hover:bg-white/5 rounded-full transition-colors shrink-0">
          <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-white" />
        </Link>
        <h1 className="text-xl md:text-3xl font-bold text-white truncate">
          {isNew ? 'Create' : 'Edit'} Curated Playlist
        </h1>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-[#18181b] rounded-2xl md:rounded-3xl p-4 md:p-8 border border-[#27272a] space-y-4 md:space-y-6">
        {/* Name */}
        <div>
          <label className="text-sm text-gray-400 block mb-2">Playlist Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Holi Special"
            className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm text-gray-400 block mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description"
            className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
            rows={3}
          />
        </div>

        {/* Keywords */}
        <div>
          <label className="text-sm text-gray-400 block mb-2">Search Keywords *</label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
              placeholder="e.g., holi, festival, colors"
              className="flex-1 bg-white/5 border border-white/10 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="button"
              onClick={handleAddKeyword}
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.keywords.map(keyword => (
              <span
                key={keyword}
                className="bg-purple-500/20 text-purple-300 px-3 py-1.5 rounded-full text-sm flex items-center gap-2"
              >
                {keyword}
                <button type="button" onClick={() => handleRemoveKeyword(keyword)}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Spotify Import */}
        <div>
          <label className="text-sm text-gray-400 block mb-2">Spotify Playlist URL</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={formData.spotifyUrl}
              onChange={(e) => setFormData({ ...formData, spotifyUrl: e.target.value })}
              placeholder="https://open.spotify.com/playlist/..."
              className="flex-1 bg-white/5 border border-white/10 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="button"
              onClick={handleImportSpotify}
              disabled={importing || !formData.spotifyUrl}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg transition-colors font-semibold"
            >
              {importing ? 'Importing...' : 'Import'}
            </button>
          </div>
          {formData.songs.length > 0 && (
            <p className="text-sm text-green-400 mt-2">
              ✓ {formData.songs.length} songs imported
            </p>
          )}
        </div>

        {/* Priority */}
        <div>
          <label className="text-sm text-gray-400 block mb-2">Priority (Higher = Shows First)</label>
          <input
            type="number"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
            className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Active Toggle */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="w-5 h-5"
          />
          <label className="text-white">Active (Show in search results)</label>
        </div>

        {/* Submit */}
        <div className="flex gap-4 justify-end pt-4">
          <Link
            href="/admin"
            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors font-semibold"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg transition-colors font-semibold"
          >
            {saving ? 'Saving...' : isNew ? 'Create Playlist' : 'Update Playlist'}
          </button>
        </div>
      </form>
    </div>
  );
}
