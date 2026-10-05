"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, Info, Sparkles } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';

interface UserNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'bug_resolved';
  read: boolean;
  createdAt: any;
  sentBy: string;
}

export default function NotificationPopup() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [currentNotif, setCurrentNotif] = useState<UserNotification | null>(null);
  const [visible, setVisible] = useState(false);

  // Listen for unread notifications for this user
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('targetUserId', '==', user.uid),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const unread: UserNotification[] = [];
        snapshot.forEach((d) => {
          unread.push({ id: d.id, ...d.data() } as UserNotification);
        });
        setNotifications(unread);
      },
      (error) => {
        // Silently fail — notification is non-critical
        console.warn('[Notifications] Listener error:', error.message);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  // Show notifications one at a time
  useEffect(() => {
    if (notifications.length > 0 && !currentNotif) {
      // Show the most recent unread notification
      const next = notifications[0];
      setCurrentNotif(next);
      setVisible(true);

      // Auto-dismiss after 8 seconds
      const timeout = setTimeout(() => {
        dismissNotification(next.id);
      }, 8000);

      return () => clearTimeout(timeout);
    }
  }, [notifications, currentNotif]);

  const dismissNotification = useCallback(async (notifId: string) => {
    setVisible(false);
    // Wait for exit animation
    setTimeout(() => {
      setCurrentNotif(null);
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    }, 250);

    // Mark as read in Firestore
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read: true });
    } catch (e) {
      console.warn('[Notifications] Failed to mark as read:', e);
    }
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'bug_resolved':
        return <Sparkles className="w-4 h-4 text-sky-400" />;
      default:
        return <Info className="w-4 h-4 text-zinc-300" />;
    }
  };

  if (!currentNotif) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9998] w-full max-w-sm px-4 pointer-events-none">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="pointer-events-auto"
          >
            <div className="relative rounded-2xl bg-[#121215]/95 backdrop-blur-2xl border border-white/10 shadow-2xl p-3.5 sm:p-4 overflow-hidden">
              <div className="flex items-start gap-3">
                {/* Minimal Icon Badge */}
                <div className="p-2 rounded-xl bg-white/[0.05] border border-white/10 shrink-0 mt-0.5">
                  {getIcon(currentNotif.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <h4 className="text-xs font-semibold text-white tracking-tight truncate">
                      {currentNotif.title}
                    </h4>
                    <span className="text-[10px] text-zinc-500 font-medium shrink-0">Muse</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed break-words">
                    {currentNotif.message}
                  </p>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => dismissNotification(currentNotif.id)}
                  className="p-1 -mr-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
                  aria-label="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Minimal Progress Bar */}
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-white/20"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 8, ease: 'linear' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
