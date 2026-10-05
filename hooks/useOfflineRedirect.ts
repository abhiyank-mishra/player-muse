"use client";
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * Offline Detection Hook
 * Redirects to /downloads page when user goes offline
 */
export function useOfflineRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleOffline = () => {
      if (pathname === '/downloads') return;
      console.log('[OfflineRedirect] User is offline, redirecting to downloads...');
      router.push('/downloads');
    };

    // Check if already offline
    if (!navigator.onLine && pathname !== '/downloads') {
      handleOffline();
    }

    // Listen for offline event
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('offline', handleOffline);
    };
  }, [router, pathname]);
}
