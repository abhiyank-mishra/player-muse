"use client";
import { useOfflineRedirect } from '@/hooks/useOfflineRedirect';

/**
 * Client component wrapper for offline detection
 * Must be a separate component since useOfflineRedirect is a client hook
 */
export default function OfflineDetector() {
  useOfflineRedirect();
  return null; // This component doesn't render anything
}
