"use client";
import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Sparkles } from 'lucide-react';
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
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-28 left-4 right-4 md:left-auto md:right-8 md:w-96 z-[100]"
        >
          <div className="bg-[#18181b]/90 backdrop-blur-2xl border border-white/10 p-5 rounded-3xl shadow-2xl relative overflow-hidden group">
            {/* Background Sparkle Effect */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-600/20 rounded-full blur-3xl group-hover:bg-purple-600/30 transition-colors" />
            
            <button 
              onClick={handleLater}
              className="absolute top-4 right-4 p-1 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shrink-0">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
              <div className="pr-6">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-white font-bold text-lg">Download Muse App</h3>
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                {isIOS ? (
                  <div className="space-y-2 mt-2">
                    <p className="text-gray-400 text-sm leading-relaxed">To install on iPhone:</p>
                    <ol className="text-gray-300 text-xs space-y-2 list-none">
                      <li className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-white">1</span>
                        <span>Tap the <span className="bg-white/10 px-1.5 py-0.5 rounded inline-flex items-center"><svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg> Share</span> button below.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-white">2</span>
                        <span>Scroll down and select <span className="text-white font-semibold">"Add to Home Screen"</span>.</span>
                      </li>
                    </ol>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm leading-relaxed">Install Muse on your home screen for a premium, fullscreen ad-free experience.</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              {!isIOS ? (
                <button 
                  onClick={handleInstallClick}
                  className="flex-1 bg-white text-black py-3 rounded-2xl font-bold hover:scale-[1.02] transition-transform active:scale-95 shadow-xl"
                >
                  Install Now
                </button>
              ) : (
                <button 
                  onClick={() => setShowPrompt(false)}
                  className="flex-1 bg-white text-black py-3 rounded-2xl font-bold hover:scale-[1.02] transition-transform active:scale-95 shadow-xl"
                >
                  Got it!
                </button>
              )}
              <button 
                onClick={handleLater}
                className="px-6 py-3 bg-white/5 text-white border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
