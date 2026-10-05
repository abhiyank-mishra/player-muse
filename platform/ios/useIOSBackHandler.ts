"use client";

import { useEffect, useRef } from 'react';

/**
 * Intercepts iOS swipe-back gestures to close overlays natively.
 * Implements pushState history mirroring for unified UX.
 */
export function useIOSBackHandler(isOpen: boolean, onClose: () => void) {
  const isTrapSet = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Set trap
    if (isOpen && !isTrapSet.current) {
      window.history.pushState({ overlayOpen: true }, '');
      isTrapSet.current = true;
    } 
    // Clear trap if closed manually (e.g. swipe down)
    else if (!isOpen && isTrapSet.current) {
      if (window.history.state?.overlayOpen) {
          window.history.back(); // Pop the trap gracefully
      }
      isTrapSet.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (e: PopStateEvent) => {
      if (isOpen) {
        onClose();
        isTrapSet.current = false;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, onClose]);
}
