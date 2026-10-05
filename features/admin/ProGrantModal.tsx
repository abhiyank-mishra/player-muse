"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Crown, Calendar, MessageSquare, Clock } from 'lucide-react';

interface ProGrantModalProps {
  isOpen: boolean;
  targetUser: { uid: string; displayName?: string; email?: string } | null;
  onConfirm: (uid: string, days: number, message: string) => Promise<void>;
  onClose: () => void;
}

const QUICK_DURATIONS = [
  { label: '1 Day', days: 1 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
];

const NOTE_PRESETS = [
  { label: 'Complimentary', note: 'Complimentary Pro Access - Enjoy Muse Pro!' },
  { label: 'Welcome', note: 'Welcome to Muse Pro - Enjoy premium features!' },
  { label: 'Verified', note: 'Payment verified - Pro activated!' },
  { label: 'Reward', note: 'Special reward - Pro unlocked!' },
];

const DEFAULT_NOTE = 'Complimentary Pro Access - Enjoy Muse Pro!';

export default function ProGrantModal({ isOpen, targetUser, onConfirm, onClose }: ProGrantModalProps) {
  const [days, setDays] = useState<string>('7');
  const [message, setMessage] = useState(DEFAULT_NOTE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset to default note when modal opens for a new target user
  useEffect(() => {
    if (isOpen) {
      setMessage(DEFAULT_NOTE);
      setError('');
    }
  }, [isOpen, targetUser]);

  const expiryDate = (() => {
    const d = parseInt(days, 10);
    if (!d || d <= 0) return null;
    const date = new Date();
    date.setDate(date.getDate() + d);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  })();

  const handleConfirm = async () => {
    const daysNum = parseInt(days, 10);
    if (!daysNum || daysNum <= 0) { setError('Enter a valid number of days'); return; }
    if (!targetUser) return;
    
    // Fall back to DEFAULT_NOTE if note was cleared
    const noteToSend = message.trim() || DEFAULT_NOTE;

    setError('');
    setLoading(true);
    try {
      await onConfirm(targetUser.uid, daysNum, noteToSend);
      setDays('7');
      setMessage(DEFAULT_NOTE);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to grant Pro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="border-b border-white/10 px-5 py-4 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <Crown className="w-4 h-4 text-amber-400" />
                <div>
                  <h2 className="text-white font-bold text-base">Grant Pro</h2>
                  <p className="text-xs text-zinc-400 truncate max-w-[260px]">{targetUser?.displayName || targetUser?.email}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Quick Duration */}
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Duration
                </label>
                <div className="flex gap-2">
                  {QUICK_DURATIONS.map(({ label, days: d }) => (
                    <button
                      key={d}
                      onClick={() => setDays(String(d))}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                        days === String(d)
                          ? 'bg-white/15 text-white border border-white/20'
                          : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-transparent'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Days Input */}
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Days
                </label>
                <input
                  type="number"
                  min={1}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  placeholder="Number of days..."
                  className="w-full bg-[#121214] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-white/25 transition-all"
                />
                {expiryDate && (
                  <p className="text-xs text-zinc-400 mt-1.5">
                    Expires on <span className="font-semibold text-white">{expiryDate}</span>
                  </p>
                )}
              </div>

              {/* Message Note */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" /> Note
                  </label>
                  <span className="text-[10px] text-zinc-500 font-mono">Pre-filled default</span>
                </div>

                {/* Quick Note Presets */}
                <div className="flex gap-1.5 mb-2 flex-wrap">
                  {NOTE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setMessage(p.note)}
                      className={`px-2 py-0.5 rounded text-[11px] transition-all whitespace-nowrap ${
                        message === p.note
                          ? 'bg-white/20 text-white font-semibold'
                          : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  placeholder="Reason for granting Pro..."
                  className="w-full bg-[#121214] border border-white/10 rounded-xl px-3 py-2 text-white text-xs resize-none focus:outline-none focus:border-white/25 transition-all"
                />
              </div>

              {error && (
                <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 font-semibold transition-all text-xs whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  {loading ? 'Granting...' : 'Grant Pro'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
