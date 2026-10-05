"use client";

import React, { useState } from 'react';
import { useColab, parseRoomCode } from '@/contexts/ColabContext';
import { useAuth } from '@/contexts/AuthContext';
import { Radio, Users, Sparkles, Plus, ArrowRight, ShieldCheck, Headphones, Music2, LogIn } from 'lucide-react';
import Spinner from '@/reusable/animations/loading/Spinner';

interface ColabLobbyViewProps {
  initialCode?: string;
}

export default function ColabLobbyView({ initialCode = '' }: ColabLobbyViewProps) {
  const { createRoom, joinRoom, isLoading } = useColab();
  const { user, login } = useAuth();

  const [joinCode, setJoinCode] = useState(initialCode);
  const [roomName, setRoomName] = useState(user?.displayName ? `${user.displayName}'s Colab` : '');
  const [controlMode, setControlMode] = useState<'collab' | 'host-only'>('collab');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRoom(roomName, controlMode);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    await joinRoom(joinCode);
  };

  return (
    <div className="flex flex-col gap-10 max-w-4xl mx-auto w-full py-4 pb-20">
      
      {/* ─── Hero Intro ─── */}
      <div className="text-center flex flex-col items-center gap-2.5 sm:gap-3">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-white mb-1 shadow-sm">
          <Radio className="w-6 h-6" />
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
          Muse Colab
        </h1>
        <p className="text-xs sm:text-sm md:text-base text-neutral-400 max-w-md px-4 leading-relaxed">
          Listen to songs together with friends in real-time. Perfectly synced beats, shared queues, and live reactions.
        </p>
      </div>

      {/* ─── Sign In Required Guard ─── */}
      {!user ? (
        <div className="p-6 sm:p-8 rounded-2xl bg-[#121214] border border-white/10 text-center flex flex-col items-center gap-4 shadow-xl max-w-md mx-auto w-full">
          <div className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white">
            <LogIn className="w-5 h-5 text-neutral-300" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white mb-1">Sign in to Join or Host</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Colab sessions require an authenticated profile so everyone in the room knows who is DJing and listening.
            </p>
          </div>
          <button
            onClick={() => login()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer mt-1"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign in with Google</span>
          </button>
        </div>
      ) : (
        /* ─── Action Cards: Create & Join ─── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: Start New Session */}
          <div className="p-5 sm:p-6 md:p-8 rounded-2xl bg-[#121214] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between shadow-xl relative overflow-hidden group">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-white">
                  <Plus className="w-5 h-5" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">Create Session</h3>
              </div>
              <p className="text-xs text-neutral-400 mb-5">
                Start a session as host, get a shareable code or link, and invite your friends.
              </p>

              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5">
                    Session Name
                  </label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder={`${user.displayName || 'My'}'s Colab`}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-white/20 focus:ring-1 focus:ring-white/10 text-sm text-white placeholder-neutral-500 focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5">
                    Control Permission
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setControlMode('collab')}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border text-center transition-all ${
                        controlMode === 'collab'
                          ? 'bg-white/15 text-white border-white/25 shadow-sm'
                          : 'bg-white/[0.03] text-neutral-400 border-white/5 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Everyone Can DJ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setControlMode('host-only')}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border text-center transition-all ${
                        controlMode === 'host-only'
                          ? 'bg-white/15 text-white border-white/25 shadow-sm'
                          : 'bg-white/[0.03] text-neutral-400 border-white/5 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Host Only</span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-2.5 sm:py-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <Spinner className="w-4 h-4 text-black" />
                  ) : (
                    <>
                      <span>Start Colab Session</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Card 2: Join Existing Session */}
          <div className="p-5 sm:p-6 md:p-8 rounded-2xl bg-[#121214] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between shadow-xl relative overflow-hidden group">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-white">
                  <Headphones className="w-5 h-5" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">Join Session</h3>
              </div>
              <p className="text-xs text-neutral-400 mb-5">
                Have a code or link from a friend? Enter it below to tune in instantly.
              </p>

              <form onSubmit={handleJoin} className="flex flex-col gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5">
                    Room Code or Invite URL
                  </label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes('/') || val.includes('?') || val.includes('.') || val.length > 6) {
                        setJoinCode(parseRoomCode(val));
                      } else {
                        setJoinCode(val.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6));
                      }
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData('text');
                      if (text) {
                        e.preventDefault();
                        setJoinCode(parseRoomCode(text));
                      }
                    }}
                    placeholder="e.g. A7K2X9"
                    maxLength={100}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-white/20 focus:ring-1 focus:ring-white/10 text-sm font-mono text-white placeholder-neutral-500 focus:outline-none uppercase transition-all tracking-widest text-center"
                  />
                </div>

                <div className="text-[11px] text-neutral-500 leading-relaxed pt-1">
                  Tip: Enter the 6-character room code (e.g. <code className="text-neutral-300">A7K2X9</code>) or paste an invite link.
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !joinCode.trim()}
                  className="w-full mt-4 py-2.5 sm:py-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  {isLoading ? (
                    <Spinner className="w-4 h-4 text-black" />
                  ) : (
                    <>
                      <span>Join Colab</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

        </div>
      )}

      {/* ─── Feature Highlights ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        <div className="p-4 rounded-2xl bg-[#121214] border border-white/10 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-white/[0.06] border border-white/10 text-white shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white mb-0.5">Real-Time Beat Sync</h4>
            <p className="text-[11px] text-neutral-400">Sub-second synchronization ensures everyone hears the exact same note at the exact same time.</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#121214] border border-white/10 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-white/[0.06] border border-white/10 text-white shrink-0">
            <Music2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white mb-0.5">Collaborative Queue</h4>
            <p className="text-[11px] text-neutral-400">Anyone in the session can search and add tracks to keep the vibes going without interruption.</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#121214] border border-white/10 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-white/[0.06] border border-white/10 text-white shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white mb-0.5">Live Reactions</h4>
            <p className="text-[11px] text-neutral-400">React with interactive emojis while listening together that appear on everyone's screen live.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
