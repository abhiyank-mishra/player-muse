"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Music, Check, Sparkles, AlertCircle } from 'lucide-react';
import { createPlaylist, addToPlaylist, getUserPlaylists } from '@/lib/ranking';
import { useAuth } from '@/contexts/AuthContext';
import { Song } from '@/lib/types';
import Spinner from '@/reusable/animations/loading/Spinner';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function ImportModal({ isOpen, onClose, onComplete }: ImportModalProps) {
  const { user, role } = useAuth();
  const [url, setUrl] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [step, setStep] = useState<'idle' | 'fetching' | 'matching' | 'complete'>('idle');
  const [progress, setProgress] = useState({ total: 0, current: 0 });
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const extractPlaylistId = (input: string) => {
    const match = input.match(/playlist\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  };

  const handleImport = async () => {
    if (!user) return;
    setError(null);
    const playlistId = extractPlaylistId(url);
    if (!playlistId) {
      setError("Invalid Spotify Playlist URL");
      return;
    }
    if (!playlistName.trim()) {
      setError("Please provide a name for your new playlist");
      return;
    }

    setStep('fetching');
    setStatus('Connecting to Spotify...');

    try {
      // Safety check for playlist limit based on role
      const existingPlaylists = await getUserPlaylists(user.uid);
      if (role === 'normal' && existingPlaylists.length >= 2) throw new Error("Free limit reached (Max 2). Upgrade to Pro.");
      if (role === 'admin' && existingPlaylists.length >= 12) throw new Error("Admin limit reached (Max 12).");

      const res = await fetch(`/api/music/spotify?playlistId=${playlistId}`);
      
      if (!res.ok) {
        if (res.status === 404) throw new Error("No tracks found. Is the playlist public?");
        throw new Error("Could not fetch Spotify tracks. Please try again later.");
      }
      
      const spotifyTracks = await res.json();

      if (spotifyTracks.length === 0) throw new Error("No tracks found in this playlist");

      setStep('matching');
      setProgress({ total: spotifyTracks.length, current: 0 });
      
      // Create a new playlist in Firestore
      const newPlaylist = await createPlaylist(user.uid, playlistName.trim(), role as 'normal' | 'pro' | 'admin');

      const matchedSongs: Song[] = [];

      for (let i = 0; i < spotifyTracks.length; i++) {
        const track = spotifyTracks[i];
        setStatus(`Matching: ${track.name}`);
        setProgress(p => ({ ...p, current: i + 1 }));

        try {
          const matchRes = await fetch(`/api/music/spotify/match?name=${encodeURIComponent(track.name)}&artist=${encodeURIComponent(track.artist)}`);
          if (matchRes.ok) {
            const matchedSong = await matchRes.json();
            await addToPlaylist(user.uid, newPlaylist.id, matchedSong);
            matchedSongs.push(matchedSong);
          }
        } catch (e) {
          console.warn(`Failed to match ${track.name}`);
        }
      }

      setStep('complete');
      onComplete();
    } catch (err: any) {
      setError(err.message);
      setStep('idle');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-[#18181b] border border-white/10 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl"
        >
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-purple-500" />
                Spotify Import
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-400">
                <X className="w-6 h-6" />
              </button>
            </div>

            {step === 'idle' && (
              <div className="space-y-6">
                <p className="text-gray-400 text-sm leading-relaxed">
                  Paste a Spotify playlist link and give it a name to import your music to Muse.
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Playlist Name</label>
                    <input 
                      type="text" 
                      value={playlistName}
                      onChange={(e) => setPlaylistName(e.target.value)}
                      placeholder="My Awesome Playlist"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Spotify URL</label>
                    <input 
                      type="text" 
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://open.spotify.com/playlist/..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 text-red-500 text-xs mt-2 ml-1">
                      <AlertCircle className="w-3 h-3" />
                      {error}
                    </div>
                  )}
                </div>
                <button 
                  onClick={handleImport}
                  disabled={!url || !playlistName.trim()}
                  className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  Start Import
                </button>
              </div>
            )}

            {(step === 'fetching' || step === 'matching') && (
              <div className="flex flex-col items-center justify-center py-10 space-y-6">
                <div className="relative">
                  <Spinner className="w-16 h-16 text-purple-500 " />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Music className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-white">{step === 'fetching' ? 'Fetching Tracks' : 'Matching Music'}</h3>
                  <p className="text-gray-400 text-sm max-w-[200px] truncate">{status}</p>
                </div>
                {step === 'matching' && (
                  <div className="w-full space-y-2">
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      <span>{progress.current} songs matched</span>
                      <span>Total {progress.total}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 'complete' && (
              <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                  <Check className="w-10 h-10 text-green-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">Import Successful!</h3>
                  <p className="text-gray-400 text-sm">
                    Your songs have been matched and added to a new playlist.
                  </p>
                </div>
                <button 
                  onClick={onClose}
                  className="w-full py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all active:scale-[0.98]"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
