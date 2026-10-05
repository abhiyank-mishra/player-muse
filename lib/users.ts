import { db } from './firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Updates a user's display name (custom name).
 * Used by both the user (initial setup) and admins.
 */
export async function updateUserDisplayName(userId: string, newName: string): Promise<void> {
  if (!newName || !newName.trim()) {
    throw new Error('Name cannot be empty');
  }

  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    name: newName.trim(),
    updated_at: serverTimestamp()
  });
}
