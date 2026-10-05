"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Sparkles, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const PRO_BENEFITS = [
  'Unlimited Custom Playlists',
  'Offline Song Downloads',
  'Lossless Audio Quality',
  '100% Ad-Free Experience',
];

export default function ProSubscriptionPopup() {
  const { isPro, subscriptionNotified, proAdminMessage, proGivenBy, proExpiryDate, markSubscriptionNotified } = useAuth();

  // Show only when: user is Pro, not yet notified, and there is an admin message
  const shouldShow = isPro && !subscriptionNotified && !!proAdminMessage;

  const expiryStr = proExpiryDate
    ? proExpiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Active';

  const daysLeft = proExpiryDate
    ? Math.max(0, Math.ceil((proExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <AnimatePresence>
      {shouldShow && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Subtle backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="relative w-full max-w-sm bg-[#121215]/95 border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl overflow-hidden space-y-4"
          >
            {/* Header Badge & Title */}
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
                <Crown className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">Pro Access Activated</h2>
              <p className="text-xs text-zinc-400 mt-1">
                {proGivenBy ? `Granted by ${proGivenBy}` : 'Your premium access is now live'}
              </p>
            </div>

            {/* Admin Personal Message (High Focus) */}
            {proAdminMessage && (
              <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400/90">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-semibold tracking-wider uppercase">Message from Admin</span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed italic">
                  "{proAdminMessage}"
                </p>
              </div>
            )}

            {/* Duration / Validity (High Focus) */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 text-center">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium block">Duration</span>
                <div className="mt-1 flex items-baseline justify-center gap-1">
                  <span className="text-xl font-bold text-white tracking-tight">{daysLeft}</span>
                  <span className="text-xs text-zinc-400 font-medium">Days</span>
                </div>
              </div>
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 text-center">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium block">Valid Until</span>
                <p className="text-xs font-semibold text-zinc-200 mt-1.5 truncate">
                  {expiryStr}
                </p>
              </div>
            </div>

            {/* Included Pro Features (High Focus) */}
            <div className="space-y-2">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block">Included Features</span>
              <div className="grid grid-cols-2 gap-2">
                {PRO_BENEFITS.map((text) => (
                  <div key={text} className="flex items-center gap-2 bg-white/[0.02] border border-white/5 rounded-lg px-2.5 py-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-xs text-zinc-300 font-medium leading-tight">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={markSubscriptionNotified}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 font-semibold text-xs transition-colors shadow-sm whitespace-nowrap mt-2"
            >
              Start Listening
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
