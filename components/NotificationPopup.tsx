"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCircle, AlertTriangle, Info, Sparkles } from 'lucide-react';
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

    const unsub = onSnapshot(q, (snapshot) => {
      const unread: UserNotification[] = [];
      snapshot.forEach(doc => {
        unread.push({ id: doc.id, ...doc.data() } as UserNotification);
      });
      setNotifications(unread);
    }, (error) => {
      // Silently fail — notification is non-critical
      console.warn('[Notifications] Listener error:', error.message);
    });

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
      setNotifications(prev => prev.filter(n => n.id !== notifId));
    }, 300);

    // Mark as read in Firestore
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read: true });
    } catch (e) {
      console.warn('[Notifications] Failed to mark as read:', e);
    }
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'bug_resolved': return <Sparkles className="w-5 h-5 text-emerald-400" />;
      default: return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'success': return 'border-green-500/30';
      case 'warning': return 'border-amber-500/30';
      case 'bug_resolved': return 'border-emerald-500/30';
      default: return 'border-blue-500/30';
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-500/5';
      case 'warning': return 'bg-amber-500/5';
      case 'bug_resolved': return 'bg-emerald-500/5';
      default: return 'bg-blue-500/5';
    }
  };

  if (!currentNotif) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9998] w-full max-w-sm px-4 pointer-events-none">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: -60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="pointer-events-auto"
          >
            <div className={`
              relative rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden
              ${getBorderColor(currentNotif.type)} ${getBgColor(currentNotif.type)}
            `}>
              {/* Gradient accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-[2px] ${
                currentNotif.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                currentNotif.type === 'warning' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                currentNotif.type === 'bug_resolved' ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' :
                'bg-gradient-to-r from-blue-500 to-purple-500'
              }`} />

              <div className="p-4 pt-5">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`p-2 rounded-xl shrink-0 ${
                    currentNotif.type === 'success' ? 'bg-green-500/20' :
                    currentNotif.type === 'warning' ? 'bg-amber-500/20' :
                    currentNotif.type === 'bug_resolved' ? 'bg-emerald-500/20' :
                    'bg-blue-500/20'
                  }`}>
                    {getIcon(currentNotif.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white leading-tight">{currentNotif.title}</h4>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{currentNotif.message}</p>
                    <p className="text-[10px] text-gray-600 mt-2">From Muse Admin</p>
                  </div>

                  {/* Close */}
                  <button
                    onClick={() => dismissNotification(currentNotif.id)}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors shrink-0"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Progress bar for auto-dismiss */}
              <motion.div
                className={`h-[2px] ${
                  currentNotif.type === 'success' ? 'bg-green-500/50' :
                  currentNotif.type === 'warning' ? 'bg-amber-500/50' :
                  currentNotif.type === 'bug_resolved' ? 'bg-emerald-500/50' :
                  'bg-blue-500/50'
                }`}
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
