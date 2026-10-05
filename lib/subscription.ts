import { db } from './firebase';
import {
  doc,
  updateDoc,
  collection,
  getDocs,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';

export type UserRole = 'normal' | 'pro' | 'admin';

export interface ProSubscriptionData {
  role: 'pro';
  pro_start_date: Timestamp;
  pro_expiry_date: Timestamp;
  pro_admin_message: string;
  pro_given_by: string;
  subscription_notified: boolean;
}

/**
 * Grant Pro subscription to a user.
 * Should only be called server-side (via API route) after admin verification.
 */
export async function grantProSubscription(
  targetUid: string,
  days: number,
  message: string,
  adminName: string
): Promise<void> {
  if (days <= 0) throw new Error('Duration must be at least 1 day');
  if (!message.trim()) throw new Error('Message is required');

  const now = new Date();
  const expiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const userRef = doc(db, 'users', targetUid);

  await updateDoc(userRef, {
    role: 'pro',
    pro_start_date: Timestamp.fromDate(now),
    pro_expiry_date: Timestamp.fromDate(expiry),
    pro_admin_message: message.trim(),
    pro_given_by: adminName,
    subscription_notified: false,
  });

  // Restore all playlists on upgrade
  await restorePlaylistsOnUpgrade(targetUid);
}

/**
 * Revoke Pro subscription and revert to normal.
 */
export async function revokeProSubscription(targetUid: string): Promise<void> {
  const userRef = doc(db, 'users', targetUid);

  await updateDoc(userRef, {
    role: 'normal',
    pro_start_date: null,
    pro_expiry_date: null,
    pro_admin_message: null,
    pro_given_by: null,
    subscription_notified: false,
  });

  // Hide playlists beyond first 2
  await setPlaylistsOnExpiry(targetUid);
}

/**
 * On Pro expiry: keep all playlists but deactivate those beyond index 2.
 */
export async function setPlaylistsOnExpiry(userId: string): Promise<void> {
  const playlistsRef = collection(db, 'users', userId, 'playlists');
  const snap = await getDocs(playlistsRef);
  const batch = writeBatch(db);

  snap.docs.forEach((docSnap, index) => {
    batch.update(docSnap.ref, { is_active: index < 2 });
  });

  await batch.commit();
}

/**
 * On Pro (re)grant: restore all playlists to visible.
 */
export async function restorePlaylistsOnUpgrade(userId: string): Promise<void> {
  const playlistsRef = collection(db, 'users', userId, 'playlists');
  const snap = await getDocs(playlistsRef);
  const batch = writeBatch(db);

  snap.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, { is_active: true });
  });

  await batch.commit();
}

/**
 * Check if a user's Pro subscription has expired.
 * Returns true if expired (and role is still 'pro' in DB).
 */
export function isSubscriptionExpired(proExpiryDate: Timestamp | null, role: UserRole): boolean {
  if (role !== 'pro' || !proExpiryDate) return false;
  return proExpiryDate.toDate() < new Date();
}

/**
 * Performs a check and revokes Pro if expired.
 * Safe to call client-side for the current user.
 */
export async function checkAndExpireSubscription(userId: string): Promise<void> {
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return;
  
  const data = snap.data();
  if (data.role === 'pro' && data.pro_expiry_date) {
    const expiry = data.pro_expiry_date as Timestamp;
    if (expiry.toDate() < new Date()) {
      console.log(`[Subscription] Expiring Pro for ${userId}`);
      await revokeProSubscription(userId);
    }
  }
}
