"use client";

import { useEffect, useRef } from 'react';

interface OverlayEntry {
  id: string;
  name: string;
  onClose: () => void;
}

// Global in-memory stack of active overlays (LIFO)
const overlayStack: OverlayEntry[] = [];

// Track count of programmatic history.back() calls to ignore in popstate
let ignorePopCount = 0;
let popSafetyTimer: ReturnType<typeof setTimeout> | null = null;

// Track IDs that were closed via browser back (popstate)
const poppedByBrowserIds = new Set<string>();

let isPopListenerAttached = false;

function initGlobalPopListener() {
  if (typeof window === 'undefined' || isPopListenerAttached) return;
  isPopListenerAttached = true;

  window.addEventListener('popstate', () => {
    // If this popstate was triggered by our own programmatic history.back(), consume it
    if (ignorePopCount > 0) {
      ignorePopCount--;
      if (popSafetyTimer) {
        clearTimeout(popSafetyTimer);
        popSafetyTimer = null;
      }
      return;
    }

    // Topmost overlay on the stack handles the back action
    if (overlayStack.length > 0) {
      const top = overlayStack.pop()!;
      poppedByBrowserIds.add(top.id);
      try {
        top.onClose();
      } catch (err) {
        console.error(`[BackHandler] Error closing overlay "${top.name}":`, err);
      }
    }
  });
}

function triggerProgrammaticBack() {
  if (typeof window === 'undefined') return;
  ignorePopCount++;

  // Safety timer: in case popstate doesn't fire (e.g. at boundary), reset counter
  if (popSafetyTimer) clearTimeout(popSafetyTimer);
  popSafetyTimer = setTimeout(() => {
    if (ignorePopCount > 0) {
      ignorePopCount = 0;
    }
  }, 400);

  try {
    window.history.back();
  } catch (err) {
    console.warn('[BackHandler] history.back() failed:', err);
    ignorePopCount = Math.max(0, ignorePopCount - 1);
  }
}

/**
 * Universal Back-Button Stack Handler (Android hardware back, iOS swipe-back, browser back).
 * Guarantees proper LIFO behavior: pressing back closes only the topmost overlay.
 * 
 * @param isOpen Whether the overlay is currently visible
 * @param onClose Callback to close the overlay
 * @param overlayName Friendly identifier for debugging
 */
export function useBackHandler(
  isOpen: boolean,
  onClose: () => void,
  overlayName = 'overlay'
) {
  const idRef = useRef<string>('');
  if (!idRef.current) {
    idRef.current = `${overlayName}_${Math.random().toString(36).substring(2, 9)}`;
  }
  const id = idRef.current;

  // Always keep latest onClose callback in a ref
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const isTrapSet = useRef(false);

  useEffect(() => {
    initGlobalPopListener();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isOpen && !isTrapSet.current) {
      // Register on overlay stack
      overlayStack.push({
        id,
        name: overlayName,
        onClose: () => onCloseRef.current()
      });

      // Push history trap state so hardware/swipe back triggers popstate
      try {
        window.history.pushState({ __backOverlayId: id, name: overlayName }, '');
      } catch (e) {
        console.warn('[BackHandler] pushState failed:', e);
      }
      isTrapSet.current = true;
    } else if (!isOpen && isTrapSet.current) {
      isTrapSet.current = false;

      // If closed by browser back, it's already popped from history and overlayStack
      if (poppedByBrowserIds.has(id)) {
        poppedByBrowserIds.delete(id);
      } else {
        // Closed by UI (close button, swipe gesture, backdrop tap)
        const idx = overlayStack.findIndex(entry => entry.id === id);
        if (idx !== -1) {
          overlayStack.splice(idx, 1);
        }
        triggerProgrammaticBack();
      }
    }
  }, [isOpen, id, overlayName]);

  // Clean up if component unmounts while still open
  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return;
      if (isTrapSet.current) {
        isTrapSet.current = false;
        if (poppedByBrowserIds.has(id)) {
          poppedByBrowserIds.delete(id);
        } else {
          const idx = overlayStack.findIndex(entry => entry.id === id);
          if (idx !== -1) {
            overlayStack.splice(idx, 1);
          }
          triggerProgrammaticBack();
        }
      }
    };
  }, [id]);
}
