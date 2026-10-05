
"use client";

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Zap, Heart, Disc, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !loading) {
      router.push('/');
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 overflow-hidden relative">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-600/20 blur-[120px] rounded-full" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-10">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="w-32 h-32 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-purple-500/10 overflow-hidden"
          >
            <img src="/logo.png" alt="Muse Logo" className="w-full h-full object-cover" />
          </motion.div>
          
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2 italic">Muse</h1>
          <h2 className="text-xl font-bold text-gray-300 mb-2">Premium Ad-free Music</h2>
          <p className="text-gray-500 text-sm font-medium">Please sign in to continue listening.</p>
        </div>

        <div className="space-y-3 mb-10">
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white-[0.07] transition-all">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-300 font-semibold uppercase tracking-wider">Unlimited Playback</span>
          </div>
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white-[0.07] transition-all">
            <Heart className="w-4 h-4 text-pink-400" />
            <span className="text-xs text-gray-300 font-semibold uppercase tracking-wider">Personalized for YOU</span>
          </div>
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white-[0.07] transition-all">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-300 font-semibold uppercase tracking-wider">Secure Library Sync</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
            <button 
                onClick={login}
                disabled={loading}
                className="w-full py-4 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-white/5"
            >
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="" />
                Continue with Google
            </button>
            <button 
                onClick={login}
                disabled={loading}
                className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-white/10 hover:scale-[1.02] active:scale-95 transition-all"
            >
                <Mail className="w-5 h-5 text-gray-400" />
                Sign in with Gmail
            </button>
        </div>

        <p className="text-center text-[10px] text-gray-600 mt-8 uppercase tracking-widest font-black">
          Powered by <span className="text-purple-500">Muse Music</span>
        </p>
      </motion.div>

      {/* Floating Decoration */}
      <motion.div 
        animate={{ 
            y: [0, -30, 0],
            rotate: [0, 10, 0]
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 right-[15%] opacity-10 hidden lg:block"
      >
        <div className="w-32 h-32 border-4 border-white rounded-full flex items-center justify-center">
            <Disc className="w-20 h-20 text-white" />
        </div>
      </motion.div>
    </div>
  );
}
