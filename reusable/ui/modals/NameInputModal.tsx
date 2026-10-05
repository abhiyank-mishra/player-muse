"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Send } from 'lucide-react';
import { updateUserDisplayName } from '@/lib/users';

interface NameInputModalProps {
  isOpen: boolean;
  userId: string;
  onSuccess: (name: string) => void;
}

export default function NameInputModal({ isOpen, userId, onSuccess }: NameInputModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await updateUserDisplayName(userId, name.trim());
      onSuccess(name.trim());
    } catch (err: any) {
      console.error('Failed to set name:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-[#18181b] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
          >
            {/* Modal Header */}
            <div className="p-8 pb-0">
              <div className="w-16 h-16 bg-purple-600/20 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/30">
                <User className="w-8 h-8 text-purple-500" />
              </div>
              <h2 className="text-3xl font-black text-white mb-2 leading-tight">
                Set Your Name
              </h2>
              <p className="text-gray-400 text-sm font-medium">
                To continue, please let us know how we should address you.
              </p>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-8">
              <div className="space-y-4">
                <div className="relative group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1">
                    Enter your Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Abhiyank Mishra"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-lg placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-600/50 focus:border-purple-600 transition-all group-hover:bg-white/10"
                    disabled={loading}
                    autoFocus
                    required
                  />
                  {error && (
                    <p className="text-red-500 text-xs mt-2 font-medium px-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                      {error}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-lg font-black tracking-wide transition-all ${
                    loading || !name.trim()
                      ? 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-[0_0_30px_rgba(147,51,234,0.3)] hover:shadow-[0_0_40px_rgba(147,51,234,0.5)] active:scale-95'
                  }`}
                >
                  {loading ? (
                    <div className="w-6 h-6 border-b-2 border-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Confirm <Send className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-gray-600 text-center mt-6 font-bold uppercase tracking-widest">
                This name will be displayed on your homepage greeting
              </p>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
