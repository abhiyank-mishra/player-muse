"use client";

import { useBackHandler } from '@/platform/useBackHandler';

/**
 * Intercepts Android hardware back button to close overlays natively without exiting the app.
 * Powered by unified stack manager.
 */
export function useAndroidBackHandler(isOpen: boolean, onClose: () => void, name?: string) {
  useBackHandler(isOpen, onClose, name || 'androidOverlay');
}

export { useBackHandler };
