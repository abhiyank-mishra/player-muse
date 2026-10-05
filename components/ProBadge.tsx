"use client";
import React, { useState, useEffect } from 'react';
import { Crown, Clock, Download, Wifi, Music2, ListPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProBadgeProps {
  expiryDate: Date | null;
}

function getTimeRemaining(expiryDate: Date) {
  const now = new Date();
  const diff = expiryDate.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, expired: true };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, minutes, expired: false };
}

const PRO_BENEFITS = [
  { icon: ListPlus, text: 'Create unlimited playlists' },
  { icon: Download, text: 'Download songs for offline use' },
  { icon: Wifi, text: 'High-quality audio streaming' },
  { icon: Music2, text: 'Access all premium features' },
];

export default function ProBadge({ expiryDate }: ProBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [timeLeft, setTimeLeft] = useState(expiryDate ? getTimeRemaining(expiryDate) : null);

  useEffect(() => {
    if (!expiryDate) return;
    const interval = setInterval(() => {
      setTimeLeft(getTimeRemaining(expiryDate));
    }, 60000);
    setTimeLeft(getTimeRemaining(expiryDate));
    return () => clearInterval(interval);
  }, [expiryDate]);

  return (
    <div className="relative inline-flex items-center">
      {/* Minimal PRO badge */}
      <button
        onClick={() => setShowTooltip(v => !v)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase text-amber-300/90 bg-amber-400/10 border border-amber-400/20 hover:bg-amber-400/20 transition-colors select-none cursor-pointer"
        title="Pro Membership"
      >
        <Crown className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
        <span>PRO</span>
      </button>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setShowTooltip(false)} />
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 mb-2 z-50 w-60 bg-[#121214] border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-md"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 bg-white/[0.02]">
                <div className="flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="font-semibold text-white text-xs">Pro Membership</span>
                </div>
                <span className="text-[10px] text-amber-400 font-medium px-1.5 py-0.5 bg-amber-400/10 rounded">Active</span>
              </div>

              <div className="p-3 space-y-2.5">
                {/* Time remaining */}
                {timeLeft && !timeLeft.expired ? (
                  <div className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-2.5 py-1.5 border border-white/5">
                    <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-zinc-400">Remaining</p>
                      <p className="text-xs font-semibold text-zinc-200">
                        {timeLeft.days > 0 && `${timeLeft.days}d `}
                        {timeLeft.hours > 0 && `${timeLeft.hours}h `}
                        {timeLeft.minutes}m
                      </p>
                    </div>
                    {expiryDate && (
                      <div className="ml-auto text-right">
                        <p className="text-[10px] text-zinc-500">Expires</p>
                        <p className="text-[10px] font-medium text-zinc-300">
                          {expiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-400">Admin account — Lifetime Pro active</p>
                )}

                {/* Benefits */}
                <div className="space-y-1 pt-1">
                  <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Features</p>
                  {PRO_BENEFITS.map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-2 text-[11px] text-zinc-300">
                      <Icon className="w-3 h-3 text-purple-400 shrink-0" />
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
