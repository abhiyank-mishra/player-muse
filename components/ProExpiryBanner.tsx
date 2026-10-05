"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Clock, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';

/**
 * Shows a subtle banner when the user's Pro subscription is about to expire.
 * Only appears when there are 3 days or less remaining.
 * Can be dismissed for the current session.
 */
export default function ProExpiryBanner() {
  const { isPro, proExpiryDate, user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state if expiry date changes
  useEffect(() => {
    setDismissed(false);
  }, [proExpiryDate?.getTime()]);

  // Check if dismissed this session
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const key = `pro_expiry_dismissed_${user?.uid}`;
      if (sessionStorage.getItem(key) === 'true') {
        setDismissed(true);
      }
    }
  }, [user?.uid]);

  if (!isPro || !proExpiryDate || dismissed) return null;

  const now = new Date();
  const msLeft = proExpiryDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));

  // Only show when 3 days or less remain
  if (daysLeft > 3) return null;

  const isExpired = msLeft <= 0;
  const isLastDay = daysLeft <= 1 && !isExpired;

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined' && user?.uid) {
      sessionStorage.setItem(`pro_expiry_dismissed_${user.uid}`, 'true');
    }
  };

  const expiryText = isExpired
    ? 'Your Pro subscription has expired'
    : isLastDay
      ? `Pro expires in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}`
      : `Pro expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;

  const bgColor = isExpired
    ? 'bg-red-500/10 border-red-500/20'
    : isLastDay
      ? 'bg-amber-500/10 border-amber-500/20'
      : 'bg-amber-500/5 border-amber-500/15';

  const textColor = isExpired ? 'text-red-400' : 'text-amber-400';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`fixed top-0 left-0 right-0 z-[90] ${bgColor} border-b backdrop-blur-xl`}
      >
        <div className="max-w-screen-lg mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1 rounded-lg ${isExpired ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
              {isExpired ? (
                <Clock className={`w-3.5 h-3.5 ${textColor}`} />
              ) : (
                <Crown className={`w-3.5 h-3.5 ${textColor} fill-current`} />
              )}
            </div>
            <p className={`text-xs font-bold ${textColor} truncate`}>
              {expiryText}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
