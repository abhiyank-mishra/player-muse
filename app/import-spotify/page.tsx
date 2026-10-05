"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Music, Sparkles, AlertCircle, ArrowLeft } from 'lucide-react';
import { createPlaylist, addToPlaylist, getUserPlaylists } from '@/lib/ranking';
import { useAuth } from '@/contexts/AuthContext';
import { Song } from '@/lib/types';
import Spinner from '@/reusable/animations/loading/Spinner';

function ImportSpotifyContent() {
  const { user, login, role } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [step, setStep] = useState<'auth' | 'idle' | 'name_prompt' | 'fetching' | 'matching' | 'complete' | 'error'>('idle');
  const [playlistName, setPlaylistName] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [progress, setProgress] = useState({ total: 0, current: 0 });
  const [status, setStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const extractPlaylistId = (input: string) => {
    const match = input.match(/playlist\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  };

  useEffect(() => {
    if (!user) {
        setStep('auth');
        return;
    }
    
    // Read from web share target
    const text = searchParams.get('text') || '';
    const url = searchParams.get('url') || '';
    const title = searchParams.get('title') || '';
    
    const combined = `${text} ${url} ${title}`;
    const playlistId = extractPlaylistId(combined);

    if (playlistId) {
        setPlaylistUrl(playlistId);
        setStep('name_prompt');
    } else {
        setStep('error');
        setErrorMsg("Couldn't find a valid Spotify playlist URL in the shared link.");
    }
  }, [searchParams, user]);

  const handleStartImport = () => {
      if (!playlistName.trim()) {
          setErrorMsg("Please provide a name for your playlist.");
          return;
      }
      handleImport(playlistUrl, playlistName.trim());
  };

  const handleImport = async (playlistId: string, customName: string) => {
    setStep('fetching');
    setStatus('Connecting to Spotify...');

    try {
      const existingPlaylists = await getUserPlaylists(user!.uid);
      if (role === 'normal' && existingPlaylists.length >= 2) throw new Error("Free limit reached (Max 2). Upgrade to Pro.");
      if (role === 'admin' && existingPlaylists.length >= 12) throw new Error("Admin limit reached (Max 12).");

      const res = await fetch(`/api/music/spotify?playlistId=${playlistId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("No tracks found. Is the playlist public?");
        throw new Error("Could not fetch Spotify tracks.");
      }
      
      const spotifyTracks = await res.json();
      if (spotifyTracks.length === 0) throw new Error("No tracks found in this playlist");

      setStep('matching');
      setProgress({ total: spotifyTracks.length, current: 0 });
      
      const newPlaylist = await createPlaylist(user!.uid, customName, role as 'normal' | 'pro' | 'admin');

      for (let i = 0; i < spotifyTracks.length; i++) {
        const track = spotifyTracks[i];
        setStatus(`Matching: ${track.name}`);
        setProgress(p => ({ ...p, current: i + 1 }));

        try {
          const matchRes = await fetch(`/api/music/spotify/match?name=${encodeURIComponent(track.name)}&artist=${encodeURIComponent(track.artist)}`);
          if (matchRes.ok) {
            const matchedSong = await matchRes.json();
            await addToPlaylist(user!.uid, newPlaylist.id, matchedSong);
          }
        } catch (e) {
          console.warn(`Failed to match ${track.name}`);
        }
      }

      setStep('complete');
    } catch (err: any) {
      setErrorMsg(err.message);
      setStep('error');
    }
  };

  return (
    <div className="min-h-screen bg-black pt-20 px-4 md:px-8 pb-32">
        <div className="max-w-md mx-auto mt-10">
            <button 
                onClick={() => router.push('/library')}
                className="mb-8 p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors inline-block"
            >
                <ArrowLeft className="w-6 h-6 text-white" />
            </button>

            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-[#18181b] border border-white/5 rounded-3xl p-8 text-center shadow-2xl"
            >
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-purple-500" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-white mb-2">Spotify Import</h1>

                {step === 'auth' && (
                    <div className="space-y-6 mt-6">
                        <p className="text-gray-400">Please login to import playlists to your library.</p>
                        <button 
                            onClick={login}
                            className="w-full py-4 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform"
                        >
                            Login
                        </button>
                    </div>
                )}

                {step === 'name_prompt' && (
                    <div className="space-y-6 mt-6">
                        <p className="text-gray-400 text-sm">You are importing a Spotify playlist. Let's give it a name first.</p>
                        <div className="space-y-2 text-left">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Playlist Name</label>
                            <input 
                                type="text" 
                                value={playlistName}
                                onChange={(e) => setPlaylistName(e.target.value)}
                                placeholder="My Imported Playlist"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                            />
                        </div>
                        <button 
                            onClick={handleStartImport}
                            disabled={!playlistName.trim()}
                            className="w-full py-4 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                        >
                            Start Import
                        </button>
                    </div>
                )}

                {(step === 'fetching' || step === 'matching') && (
                    <div className="py-8 space-y-6">
                        <Spinner className="w-12 h-12 text-purple-500 mx-auto" />
                        <div className="space-y-3">
                            <h3 className="text-xl font-bold text-white">
                                {step === 'fetching' ? 'Fetching Playlist...' : 'Matching Songs...'}
                            </h3>
                            <p className="text-gray-400 text-sm truncate max-w-[250px] mx-auto">{status}</p>
                        </div>
                        {step === 'matching' && (
                            <div className="w-full space-y-2 mt-4">
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                                    />
                                </div>
                                <div className="text-xs text-gray-500">
                                    {progress.current} / {progress.total} matched
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {step === 'complete' && (
                    <div className="py-8 space-y-6">
                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                            <Check className="w-10 h-10 text-green-500" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-2">Import Successful!</h3>
                            <p className="text-gray-400 text-sm mb-6">Your playlist is ready in your library.</p>
                            <button 
                                onClick={() => router.push('/library')}
                                className="w-full py-4 bg-white/10 text-white font-bold rounded-full hover:bg-white/20 transition-colors"
                            >
                                Go to Library
                            </button>
                        </div>
                    </div>
                )}

                {step === 'error' && (
                    <div className="py-8 space-y-6">
                        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                            <AlertCircle className="w-10 h-10 text-red-500" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-2">Import Failed</h3>
                            <p className="text-red-400 text-sm mb-6 max-w-[280px] mx-auto">{errorMsg}</p>
                            <button 
                                onClick={() => router.push('/explore')}
                                className="w-full py-4 bg-white/10 text-white font-bold rounded-full hover:bg-white/20 transition-colors"
                            >
                                Home
                            </button>
                        </div>
                    </div>
                )}

            </motion.div>
        </div>
    </div>
  );
}

export default function ImportSpotifyPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><Spinner className="w-8 h-8 text-purple-500" /></div>}>
            <ImportSpotifyContent />
        </Suspense>
    );
}
