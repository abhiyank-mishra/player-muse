"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Song } from '@/lib/types';
import { X, Plus, Save } from 'lucide-react';
import Spinner from '@/reusable/animations/loading/Spinner';

interface CuratedPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editPlaylist?: any; // Existing playlist for editing
}

export default function CuratedPlaylistModal({
  isOpen,
  onClose,
  onSuccess,
  editPlaylist
}: CuratedPlaylistModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: editPlaylist?.name || '',
    description: editPlaylist?.description || '',
    keywords: (editPlaylist?.keywords || []) as string[],
    spotifyUrl: editPlaylist?.spotifyPlaylistId || '',
    coverImage: editPlaylist?.coverImage || '',
    priority: editPlaylist?.priority || 0,
    isActive: editPlaylist?.isActive !== undefined ? editPlaylist.isActive : true,
    songs: (editPlaylist?.songs || []) as Song[]
  });

  const [keywordInput, setKeywordInput] = useState('');

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

  const extractSpotifyPlaylistId = (url: string): string | null => {
    const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
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
      // Fetch Spotify tracks
      const spotifyRes = await fetch(`/api/music/spotify?playlistId=${playlistId}`);
      if (!spotifyRes.ok) throw new Error('Failed to fetch Spotify tracks');
      
      const spotifyTracks = await spotifyRes.json();
      
      // Match each track to JioSaavn
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

  const handleSubmit = async () => {
    if (!formData.name || formData.keywords.length === 0) {
      setError('Please fill in name and add at least one keyword');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const playlistData = {
        ...formData,
        spotifyPlaylistId: extractSpotifyPlaylistId(formData.spotifyUrl) || undefined,
        createdBy: user?.email || 'unknown',
      };

      const url = '/api/playlists/curated';
      const method = editPlaylist ? 'PUT' : 'POST';
      const body = editPlaylist 
        ? { id: editPlaylist.id, ...playlistData }
        : playlistData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save playlist');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative bg-[#18181b] border border-[#27272a] text-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-[#18181b] z-10">
          <h2 className="text-xl font-bold">
            {editPlaylist ? 'Edit' : 'Create'} Curated Playlist
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-gray-400 block mb-2">Playlist Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Holi Special"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-400 block mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors resize-none"
            />
          </div>

          {/* Keywords */}
          <div>
            <label className="text-sm font-medium text-gray-400 block mb-2">Search Keywords *</label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                placeholder="e.g., holi, festival, colors"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button 
                onClick={handleAddKeyword}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-white transition-colors flex items-center justify-center"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.keywords.map(keyword => (
                <span
                  key={keyword}
                  className="bg-purple-500/20 border border-purple-500/30 text-purple-300 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                >
                  {keyword}
                  <button onClick={() => handleRemoveKeyword(keyword)} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Spotify Import */}
          <div>
            <label className="text-sm font-medium text-gray-400 block mb-2">Import from Spotify</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.spotifyUrl}
                onChange={(e) => setFormData({ ...formData, spotifyUrl: e.target.value })}
                placeholder="https://open.spotify.com/playlist/..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors"
              />
              <button 
                onClick={handleImportSpotify} 
                disabled={importing || !formData.spotifyUrl}
                className="px-6 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px] flex items-center justify-center"
              >
                {importing ? <Spinner className="w-5 h-5 " /> : 'Import'}
              </button>
            </div>
            {formData.songs.length > 0 && (
              <p className="text-sm text-green-400 mt-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                {formData.songs.length} songs imported successfully
              </p>
            )}
          </div>

          {/* Priority & Active Status */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-400 block mb-2">
                Priority Score
              </label>
              <input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
              />
              <p className="text-xs text-gray-500 mt-1">Higher shows first</p>
            </div>

            <div className="flex items-center h-full pt-6">
                 <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${formData.isActive ? 'bg-purple-500' : 'bg-white/10'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${formData.isActive ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                        Active (Visible)
                    </span>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                 </label>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 text-sm flex items-start gap-3">
               <div className="mt-0.5"><X className="w-4 h-4" /></div>
               <p>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-[#18181b] sticky bottom-0 rounded-b-2xl flex justify-end gap-3">
            <button 
                onClick={onClose} 
                disabled={loading}
                className="px-6 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-medium"
            >
              Cancel
            </button>
            <button 
                onClick={handleSubmit} 
                disabled={loading}
                className="px-8 py-2.5 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <Spinner className="w-4 h-4 " />}
              {editPlaylist ? 'Update Playlist' : 'Create Playlist'}
            </button>
        </div>

      </div>
    </div>
  );
}
