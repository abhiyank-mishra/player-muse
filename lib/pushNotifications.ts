import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getApps } from 'firebase/app';

// Your VAPID key — generate this from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
// IMPORTANT: Replace this with your actual VAPID key from Firebase Console
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';

/**
 * Check if the browser supports push notifications
 */
export async function isPushSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  if (!('serviceWorker' in navigator)) return false;

  try {
    return await isSupported();
  } catch {
    return false;
  }
}

/**
 * Get the current notification permission status
 */
export function getPermissionStatus(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Ensures the service worker is activated before calling pushManager methods.
 * Prevents "Subscription failed - no active Service Worker" AbortError.
 */
async function waitForServiceWorkerActive(registration: ServiceWorkerRegistration, timeoutMs = 8000): Promise<boolean> {
  if (registration.active) return true;

  const worker = registration.installing || registration.waiting;
  if (!worker) return !!registration.active;

  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      resolve(!!registration.active);
    }, timeoutMs);

    const checkState = () => {
      if (worker.state === 'activated' || registration.active) {
        worker.removeEventListener('statechange', checkState);
        clearTimeout(timer);
        resolve(true);
      } else if (worker.state === 'redundant') {
        worker.removeEventListener('statechange', checkState);
        clearTimeout(timer);
        resolve(false);
      }
    };

    worker.addEventListener('statechange', checkState);
  });
}

/**
 * Request notification permission and register FCM token
 * Returns the token if successful, null otherwise
 */
export async function requestPushPermission(userId: string): Promise<string | null> {
  try {
    const supported = await isPushSupported();
    if (!supported) {
      console.warn('[Push] Push notifications not supported in this browser');
      return null;
    }

    if (!VAPID_KEY) {
      console.error('[Push] VAPID key not configured. Set NEXT_PUBLIC_FIREBASE_VAPID_KEY in your .env.local');
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[Push] Notification permission denied');
      return null;
    }

    // Register the FCM service worker
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    });

    console.log('[Push] FCM Service Worker registered');

    // Wait until the service worker is active to prevent AbortError in pushManager.subscribe
    await waitForServiceWorkerActive(swRegistration);

    if (!swRegistration.active) {
      console.warn('[Push] Service worker did not activate in time');
      return null;
    }

    // Get FCM token
    const app = getApps()[0];
    if (!app) {
      console.error('[Push] Firebase app not initialized');
      return null;
    }

    const messaging = getMessaging(app);
    let token: string | null = null;
    try {
      token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swRegistration,
      });
    } catch (tokenErr) {
      console.warn('[Push] getToken failed:', tokenErr);
      return null;
    }

    if (token) {
      console.log('[Push] FCM Token obtained');
      // Save token to Firestore
      await saveFCMToken(userId, token);
      return token;
    } else {
      console.warn('[Push] No token received');
      return null;
    }
  } catch (error) {
    console.error('[Push] Failed to setup push notifications:', error);
    return null;
  }
}

/**
 * Save FCM token to Firestore under the user's document
 */
async function saveFCMToken(userId: string, token: string): Promise<void> {
  try {
    // Save token with device info for multi-device support
    const tokenDocRef = doc(db, 'fcmTokens', `${userId}_${hashToken(token)}`);
    await setDoc(tokenDocRef, {
      userId,
      token,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      platform: typeof navigator !== 'undefined' ? (navigator as any).userAgentData?.platform || navigator.platform : 'unknown',
    }, { merge: true });

    console.log('[Push] FCM token saved to Firestore');
  } catch (error) {
    console.error('[Push] Failed to save FCM token:', error);
  }
}

/**
 * Remove FCM token on logout
 */
export async function removeFCMToken(userId: string, token: string): Promise<void> {
  try {
    const tokenDocRef = doc(db, 'fcmTokens', `${userId}_${hashToken(token)}`);
    await deleteDoc(tokenDocRef);
    console.log('[Push] FCM token removed');
  } catch (error) {
    console.error('[Push] Failed to remove FCM token:', error);
  }
}

/**
 * Listen for foreground messages and show them as in-app notifications
 */
export function setupForegroundListener(
  onNotification: (payload: { title: string; body: string; data?: Record<string, string> }) => void
): () => void {
  try {
    const app = getApps()[0];
    if (!app) return () => {};

    const messaging = getMessaging(app);
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[Push] Foreground message received:', payload);
      
      onNotification({
        title: payload.notification?.title || payload.data?.title || 'Muse Music',
        body: payload.notification?.body || payload.data?.body || '',
        data: payload.data,
      });
    });

    return unsubscribe;
  } catch (error) {
    console.error('[Push] Failed to setup foreground listener:', error);
    return () => {};
  }
}

/**
 * Simple hash for token to create a short document ID
 */
function hashToken(token: string): string {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
