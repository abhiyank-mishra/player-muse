"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginModal() {
  const { isLoginModalOpen, setLoginModalOpen, signInWithGoogle, loading } = useAuth();

  // Don't show modal while auth is still loading (prevents flash on refresh)
  if (loading) return null;

  const handleLogin = async () => {
    await signInWithGoogle();
  };

  return (
    <AnimatePresence>
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLoginModalOpen(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl shadow-purple-900/20 overflow-hidden"
          >
            {/* Background glowing effects */}
            <div className="absolute top-0 left-1/4 w-32 h-32 bg-purple-500/30 rounded-full blur-[80px]" />
            <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-pink-500/20 rounded-full blur-[80px]" />

            <button
              onClick={() => setLoginModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-8 relative z-10">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Welcome to Muse</h2>
              <p className="text-gray-400 text-sm">Sign in to sync your playlists and favorites</p>
            </div>

            <div className="space-y-4 relative z-10">
              <button
                onClick={handleLogin}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-gray-100 text-black rounded-xl transition-all font-semibold active:scale-[0.98]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>

              <button
                onClick={handleLogin}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all font-semibold active:scale-[0.98]"
              >
                <Mail className="w-5 h-5 text-red-500" />
                Continue with Gmail
              </button>
            </div>
            
            <div className="mt-8 text-center relative z-10">
              <p className="text-xs text-gray-500">
                By continuing, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
