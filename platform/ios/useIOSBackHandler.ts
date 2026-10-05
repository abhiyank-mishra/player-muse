"use client";

import { useBackHandler } from '@/platform/useBackHandler';

/**
 * Intercepts iOS swipe-back gestures to close overlays natively.
 * Powered by unified stack manager.
 */
export function useIOSBackHandler(isOpen: boolean, onClose: () => void, name?: string) {
  useBackHandler(isOpen, onClose, name || 'iosOverlay');
}

export { useBackHandler };
