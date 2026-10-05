"use client";
import React, { useState, useEffect } from 'react';
import { Home, Search, Heart, ListMusic, LogIn, LogOut, Shield, Download, Compass, Radio } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useUI } from '@/contexts/UIContext';
import { useColab } from '@/contexts/ColabContext';
import { motion, AnimatePresence } from 'framer-motion';
import { isIOSDevice, requestDeviceMotionPermission } from '@/platform/mobile/useShakeDetector';
import ProBadge from './ProBadge';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, login, logout, isAdmin, isPro, proExpiryDate } = useAuth();
  const { isSidebarOpen, setSidebarOpen } = useUI();
  const { isInRoom } = useColab();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showShakeOption, setShowShakeOption] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setTimeout(() => setIsInstalled(true), 0);
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Initial check for iOS shake permission
    if (isIOSDevice() && localStorage.getItem('shakePermissionGranted') !== 'true') {
      setShowShakeOption(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
  };

  const handleShakePermissionRequest = async () => {
    const granted = await requestDeviceMotionPermission();
    if (granted) {
      setShowShakeOption(false);
      window.location.reload(); // Reload to mount the motion detector
    }
  };

  const handleLinkClick = () => {
    setSidebarOpen(false);
  };
  
  const links = [
    { name: 'Home', icon: Home, href: '/' },
    { name: 'Colab', icon: Radio, href: '/colab', isColab: true },
    { name: 'Search', icon: Search, href: '/search' },
    { name: 'Favorites', icon: Heart, href: '/favorites' },
    { name: 'Library', icon: ListMusic, href: '/playlists' },
    { name: 'Downloads', icon: Download, href: '/downloads' },
  ];

  const content = (
    <div className="flex flex-col h-full w-full max-w-full overflow-hidden">
      <div className="p-4 md:p-5">
        <Link href="/?reset=true" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2.5 text-lg font-bold text-white mb-6 tracking-tight hover:opacity-80 transition-opacity px-2">
          <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain" />
          <span className="tracking-tight text-zinc-100">
            Muse
          </span>
        </Link>

        <nav className="flex flex-col gap-1 px-1">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link 
                key={link.name} 
                href={link.href}
                onClick={handleLinkClick}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group ${
                  isActive 
                    ? 'bg-white/[0.08] text-white font-medium' 
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <link.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-zinc-400 group-hover:text-white'}`} />
                <span className="flex-1">{link.name}</span>
                {link.isColab && isInRoom && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-green-500/20 text-green-300 border border-green-500/30 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Live
                  </span>
                )}
              </Link>
            );
          })}

          {/* Install App Button - Minimalist & Uniform */}
          {!isInstalled && deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/5 border border-white/10 transition-all group mt-2 w-full box-border"
            >
              <Download className="w-4 h-4 text-purple-400 group-hover:scale-105 transition-transform shrink-0" />
              <span>Install App</span>
            </button>
          )}

          {/* iOS Shake Permission Button - Minimalist & Uniform */}
          {showShakeOption && (
            <button
              onClick={handleShakePermissionRequest}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/5 border border-white/10 transition-all group mt-2 w-full box-border"
            >
              <Shield className="w-4 h-4 text-blue-400 group-hover:scale-105 transition-transform shrink-0" />
              <span>Enable Shake Report</span>
            </button>
          )}
        </nav>
      </div>
      
      <div className="mt-auto p-3 flex flex-col gap-2 w-full max-w-full overflow-hidden box-border">
        {isAdmin && (
          <Link 
            href="/admin"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-purple-300 hover:text-purple-200 bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/20 transition-all group w-full box-border"
          >
            <Shield className="w-4 h-4 shrink-0 group-hover:scale-105 transition-transform" />
            <span className="truncate">Admin Panel</span>
          </Link>
        )}

        {user ? (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/15 transition-all w-full max-w-full box-border overflow-hidden">
            {/* Avatar with fallback initial */}
            <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0">
              {typeof user.photoURL === 'string' && user.photoURL.trim() !== '' ? (
                <img 
                  src={user.photoURL} 
                  alt="" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="text-xs font-semibold text-zinc-300">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0 pr-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-xs font-medium text-white truncate min-w-0">{user.displayName || 'User'}</p>
                {isPro && (
                  <div className="shrink-0">
                    <ProBadge expiryDate={proExpiryDate} />
                  </div>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 truncate min-w-0">{user.email}</p>
            </div>

            {/* Compact Logout Icon Button */}
            <button 
              onClick={() => { logout(); setSidebarOpen(false); }}
              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors shrink-0"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button 
            onClick={() => { login(); setSidebarOpen(false); }}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-xl transition-all text-xs font-medium active:scale-95 box-border"
          >
            <LogIn className="w-4 h-4 text-purple-400" />
            <span>Sign in</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="w-64 bg-[#050505] h-screen border-r border-[#222] hidden md:flex flex-col sticky top-0 z-40 overflow-hidden select-none">
        {content}
      </aside>

      <AnimatePresence>
        {isSidebarOpen && (
          <div className="fixed inset-0 z-[100] md:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-y-0 left-0 w-64 bg-[#050505] border-r border-white/10 shadow-2xl"
            >
              {content}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
