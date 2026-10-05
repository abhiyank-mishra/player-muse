"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getGuestPlayCount } from '@/lib/preferences';

export default function LoginModal() {
  const { user, isLoginModalOpen, setLoginModalOpen, signInWithGoogle, loading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  // Don't show modal while auth is still loading (prevents flash on refresh)
  if (loading) return null;

  const isGuestLimitReached = !user && getGuestPlayCount() >= 5;

  const handleLogin = async () => {
    try {
      setSigningIn(true);
      await signInWithGoogle();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <AnimatePresence>
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Subtle backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLoginModalOpen(false)}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className="relative w-full max-w-sm bg-[#121215]/95 border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden"
          >
            {/* Close Button */}
            <button
              onClick={() => setLoginModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header / Logo */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/10 mx-auto mb-3.5 flex items-center justify-center p-2.5">
                <img src="/logo.png" alt="Muse" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-xl font-semibold text-white tracking-tight">
                {isGuestLimitReached ? 'Sign In to Continue' : 'Welcome to Muse'}
              </h2>
              <p className="text-zinc-400 text-xs mt-1">
                {isGuestLimitReached
                  ? 'Free preview limit (5 songs) reached. Sign in to keep listening.'
                  : 'Sign in to sync your playlists and favorites'}
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-2.5">
              <button
                onClick={handleLogin}
                disabled={signingIn}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-zinc-100 text-zinc-950 rounded-xl transition-all font-medium text-sm active:scale-[0.98] disabled:opacity-70 shadow-sm"
              >
                {signingIn ? (
                  <div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                )}
                <span>{signingIn ? 'Connecting...' : 'Continue with Google'}</span>
              </button>
            </div>
            
            {/* Legal */}
            <div className="mt-5 text-center">
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                By continuing, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
