"use client";
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Download, Wifi, Music2, ListPlus, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const PRO_BENEFITS = [
  { icon: ListPlus, text: 'Create unlimited playlists' },
  { icon: Download, text: 'Download any song' },
  { icon: Wifi, text: 'High-quality audio streaming' },
  { icon: Music2, text: 'Ad-free premium listening' },
];

export default function ProSubscriptionPopup() {
  const { isPro, subscriptionNotified, proAdminMessage, proGivenBy, proExpiryDate, markSubscriptionNotified } = useAuth();

  // Show only when: user is Pro, not yet notified, and there is an admin message (meaning it was admin-granted not just role-set)
  const shouldShow = isPro && !subscriptionNotified && !!proAdminMessage;

  const expiryStr = proExpiryDate
    ? proExpiryDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Unknown';

  const daysLeft = proExpiryDate
    ? Math.max(0, Math.ceil((proExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 18, stiffness: 260 }}
            className="bg-[#0f0f1a] border border-purple-500/40 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
          >
            {/* Hero Section */}
            <div className="relative overflow-hidden bg-gradient-to-br from-purple-900/60 via-amber-900/30 to-purple-900/60 px-6 pt-8 pb-6 text-center">
              {/* Animated glow */}
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                className="absolute inset-0 bg-radial-gradient bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-amber-500/20 blur-2xl"
              />
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                className="relative z-10 inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-400 to-purple-600 rounded-full mb-4 shadow-2xl"
              >
                <Crown className="w-8 h-8 text-white fill-white" />
              </motion.div>

              <h1 className="relative z-10 text-2xl font-black text-white mb-1">You got Pro! 🎉</h1>
              <p className="relative z-10 text-sm text-purple-300">
                {proGivenBy ? `${proGivenBy} gave you Pro subscription` : 'You received Pro subscription'}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Admin Message */}
              {proAdminMessage && (
                <div className="bg-white/5 border border-purple-500/20 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Message from Admin</p>
                  </div>
                  <p className="text-sm text-white/90 leading-relaxed italic">"{proAdminMessage}"</p>
                </div>
              )}

              {/* Subscription details */}
              <div className="flex gap-3">
                <div className="flex-1 bg-white/5 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-[10px] text-gray-400">Duration</p>
                  <p className="text-lg font-black text-amber-400">{daysLeft}<span className="text-xs font-medium ml-0.5">days</span></p>
                </div>
                <div className="flex-1 bg-white/5 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-[10px] text-gray-400">Expires</p>
                  <p className="text-xs font-bold text-white leading-tight mt-0.5">{expiryStr}</p>
                </div>
              </div>

              {/* Benefits */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Your Pro Benefits</p>
                {PRO_BENEFITS.map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2.5 text-sm text-gray-300">
                    <div className="w-6 h-6 rounded-full bg-purple-600/20 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    {text}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <motion.button
                onClick={markSubscriptionNotified}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-amber-500 to-purple-600 text-white font-black text-sm shadow-lg shadow-purple-500/30 hover:opacity-95 transition-all"
              >
                Start Listening ✨
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
