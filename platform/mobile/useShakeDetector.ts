import { useEffect, useRef } from 'react';

/**
 * Shake Detection Configuration
 * 
 * To avoid false positives (phone placed down, pocket movement, etc.),
 * we require MULTIPLE consecutive shake events within a short window.
 * 
 * SHAKE_THRESHOLD  — minimum acceleration delta to count as a "shake event"
 * REQUIRED_SHAKES  — how many shake events needed within the window
 * SHAKE_WINDOW_MS  — time window in which all required shakes must happen
 * DEBOUNCE_TIME    — cooldown after a confirmed shake before detecting again
 */
const SHAKE_THRESHOLD = 80;     // Much higher than before (was 55) — requires vigorous shaking
const REQUIRED_SHAKES = 3;      // Need 3 spike events to confirm intentional shake
const SHAKE_WINDOW_MS = 1500;   // All 3 must happen within 1.5 seconds
const DEBOUNCE_TIME = 5000;     // 5-second cooldown after a confirmed shake

// Simple regex for iOS device detection
export const isIOSDevice = () => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

// Request permission (must be called from a user gesture)
export const requestDeviceMotionPermission = async (): Promise<boolean> => {
  if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
    try {
      const permissionState = await (DeviceMotionEvent as any).requestPermission();
      if (permissionState === 'granted') {
        localStorage.setItem('shakePermissionGranted', 'true');
        return true;
      }
    } catch (error) {
      console.error('Error requesting device motion permission:', error);
    }
    return false;
  }
  // Not iOS 13+ or not supported
  return true; 
};

export function useShakeDetector(onShake: () => void) {
  const lastConfirmedShake = useRef<number>(0);
  const shakeTimestamps = useRef<number[]>([]); // timestamps of recent spike events
  const lastX = useRef<number | null>(null);
  const lastY = useRef<number | null>(null);
  const lastZ = useRef<number | null>(null);

  useEffect(() => {
    // Check if motion is supported/granted on this device
    const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // On iOS 13+, we must not add the devicemotion listener until permission is explicitly granted
    if (isIOSDevice()) {
        const hasPermission = localStorage.getItem('shakePermissionGranted') === 'true';
        if (!hasPermission) return;
    }

    if (!isMobile) return;

    // --- Devicemotion handler (Requires HTTPS) ---
    const handleMotion = (event: DeviceMotionEvent) => {
      const { accelerationIncludingGravity } = event;
      if (!accelerationIncludingGravity) return;

      const { x, y, z } = accelerationIncludingGravity;

      if (x !== null && y !== null && z !== null) {
        if (lastX.current !== null && lastY.current !== null && lastZ.current !== null) {
          const deltaX = Math.abs(lastX.current - x);
          const deltaY = Math.abs(lastY.current - y);
          const deltaZ = Math.abs(lastZ.current - z);
          const totalDelta = deltaX + deltaY + deltaZ;

          if (totalDelta > SHAKE_THRESHOLD) {
            const now = Date.now();

            // Check debounce — don't detect again if we just confirmed a shake
            if (now - lastConfirmedShake.current < DEBOUNCE_TIME) return;

            // Record this spike event
            shakeTimestamps.current.push(now);

            // Prune old timestamps outside the window
            shakeTimestamps.current = shakeTimestamps.current.filter(
              ts => now - ts < SHAKE_WINDOW_MS
            );

            // Check if we have enough recent spikes for a confirmed shake
            if (shakeTimestamps.current.length >= REQUIRED_SHAKES) {
              lastConfirmedShake.current = now;
              shakeTimestamps.current = []; // Reset

              // Don't trigger if offline
              if (typeof navigator !== 'undefined' && !navigator.onLine) return;

              onShake();
            }
          }
        }
        lastX.current = x;
        lastY.current = y;
        lastZ.current = z;
      }
    };

    window.addEventListener('devicemotion', handleMotion);

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [onShake]);
}
