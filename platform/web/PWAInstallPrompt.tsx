"use client";
import React, { useState, useEffect } from 'react';
import { X, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if it's iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setTimeout(() => setIsIOS(isIOSDevice), 0);

    // Check if already in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone').matches || (navigator as any).standalone;

    if (isStandalone) return;

    // Check if user clicked "Later" recently (10 min cooldown)
    const laterTimestamp = localStorage.getItem('pwaInstallLater');
    if (laterTimestamp) {
      const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
      const timeSince = Date.now() - parseInt(laterTimestamp);
      if (timeSince < tenMinutes) {
        // Don't show prompt yet
        return;
      }
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // For Android, show after 5s
      setTimeout(() => setShowPrompt(true), 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, manually show the prompt after 5s if not standalone
    if (isIOSDevice && !isStandalone) {
      setTimeout(() => setShowPrompt(true), 5000);
    }

    window.addEventListener('appinstalled', () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      // For iOS, we just show instructions (which is handled in the UI)
      // or we can just hide the main button and show text
      return;
    }

    if (!deferredPrompt) {
      alert("To install Muse: Tap the browser menu (⋮) and select 'Install App' or 'Add to Home screen'.");
      return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleLater = () => {
    // Save current timestamp to localStorage
    localStorage.setItem('pwaInstallLater', Date.now().toString());
    setShowPrompt(false);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div 
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-24 sm:bottom-28 left-4 right-4 md:left-auto md:right-6 md:w-80 z-[100]"
        >
          <div className="bg-[#121214]/95 backdrop-blur-2xl border border-white/10 p-3 sm:p-3.5 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.85)] relative">
            <div className="flex items-center justify-between gap-3">
              {/* Left: Icon + Concise Info */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/[0.08] border border-white/10 flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-white font-semibold text-xs sm:text-sm leading-tight truncate">Install Muse</h3>
                  <p className="text-neutral-400 text-[11px] truncate mt-0.5">
                    {isIOS ? 'Add to Home Screen' : 'Fullscreen & ad-free'}
                  </p>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {!isIOS ? (
                  <button 
                    onClick={handleInstallClick}
                    className="px-3 py-1.5 bg-white text-black text-xs font-semibold rounded-xl hover:bg-neutral-200 transition-all active:scale-95 whitespace-nowrap shadow-sm"
                  >
                    Install
                  </button>
                ) : (
                  <button 
                    onClick={() => setShowPrompt(false)}
                    className="px-3 py-1.5 bg-white text-black text-xs font-semibold rounded-xl hover:bg-neutral-200 transition-all active:scale-95 whitespace-nowrap shadow-sm"
                  >
                    Got it
                  </button>
                )}
                <button 
                  onClick={handleLater}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* iOS specific tip */}
            {isIOS && (
              <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-neutral-400">
                <span>Tap <span className="text-white font-medium">Share</span> then <span className="text-white font-medium">"Add to Home Screen"</span></span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
