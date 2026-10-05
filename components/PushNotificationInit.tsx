"use client";

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { 
  requestPushPermission, 
  setupForegroundListener, 
  isPushSupported, 
  getPermissionStatus 
} from '@/lib/pushNotifications';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Sparkles } from 'lucide-react';

/**
 * PushNotificationInit
 * 
 * Mounted once in the root layout. Handles:
 * 1. Auto-requesting push permission after login (with a polite prompt)
 * 2. Setting up foreground message listener
 * 3. Showing a one-time "Enable Notifications" banner
 */
export default function PushNotificationInit() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const foregroundUnsub = useRef<(() => void) | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!user?.uid) {
      // Cleanup on logout
      if (foregroundUnsub.current) {
        foregroundUnsub.current();
        foregroundUnsub.current = null;
      }
      initialized.current = false;
      return;
    }

    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      const supported = await isPushSupported();
      if (!supported) return;

      const permission = getPermissionStatus();

      if (permission === 'granted') {
        // Already granted — silently register token & setup listener
        await requestPushPermission(user.uid);
        foregroundUnsub.current = setupForegroundListener((payload) => {
          showToast(payload.title + (payload.body ? `: ${payload.body}` : ''), 'info');
        });
      } else if (permission === 'default') {
        // Not yet asked — show a polite banner after a delay
        const dismissed = localStorage.getItem('muse_push_dismissed');
        if (!dismissed) {
          setTimeout(() => setShowBanner(true), 5000); // Show after 5s
        }
      }
      // If 'denied', do nothing — user explicitly blocked notifications
    };

    init();

    return () => {
      if (foregroundUnsub.current) {
        foregroundUnsub.current();
        foregroundUnsub.current = null;
      }
    };
  }, [user?.uid]);

  const handleEnable = async () => {
    if (!user?.uid || isRequesting) return;
    setIsRequesting(true);

    const token = await requestPushPermission(user.uid);
    
    if (token) {
      showToast('🔔 Notifications enabled!', 'success');
      foregroundUnsub.current = setupForegroundListener((payload) => {
        showToast(payload.title + (payload.body ? `: ${payload.body}` : ''), 'info');
      });
    } else {
      showToast('Could not enable notifications', 'error');
    }

    setShowBanner(false);
    setIsRequesting(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      localStorage.setItem('muse_push_dismissed', 'true');
    } catch {}
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ opacity: 0, y: 80, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 80, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9997] w-full max-w-sm px-4"
        >
          <div className="relative rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-xl shadow-2xl shadow-purple-500/10 overflow-hidden">
            {/* Gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500" />
            
            <div className="p-4 pt-5">
              <div className="flex items-start gap-3">
                {/* Animated bell icon */}
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/20 shrink-0">
                  <motion.div
                    animate={{ rotate: [0, 15, -15, 10, -10, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
                  >
                    <Bell className="w-5 h-5 text-purple-300" />
                  </motion.div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    Stay Updated 
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </h4>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    Get notified about new features, your bug fix updates, and important messages from Muse.
                  </p>
                </div>

                {/* Close */}
                <button
                  onClick={handleDismiss}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors shrink-0 -mt-1"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleEnable}
                  disabled={isRequesting}
                  className="flex-1 py-2 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                >
                  {isRequesting ? 'Enabling...' : 'Enable Notifications'}
                </button>
                <button
                  onClick={handleDismiss}
                  className="py-2 px-3 rounded-xl text-gray-400 hover:text-white text-xs font-medium transition-colors hover:bg-white/5"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
