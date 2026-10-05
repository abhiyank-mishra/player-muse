import { db } from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  DocumentData
} from 'firebase/firestore';
import { CuratedPlaylist } from './types';

const COLLECTION_NAME = 'curatedPlaylists';

/**
 * Get all curated playlists (or only active ones)
 */
export async function getCuratedPlaylists(activeOnly = false): Promise<CuratedPlaylist[]> {
  try {
    const q = activeOnly
      ? query(
          collection(db, COLLECTION_NAME),
          where('isActive', '==', true),
          orderBy('priority', 'desc')
        )
      : query(collection(db, COLLECTION_NAME), orderBy('priority', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as CuratedPlaylist));
  } catch (error) {
    console.error('Error fetching curated playlists:', error);
    return [];
  }
}

/**
 * Get a single curated playlist by ID
 */
export async function getCuratedPlaylist(id: string): Promise<CuratedPlaylist | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as CuratedPlaylist;
    }
    return null;
  } catch (error) {
    console.error('Error fetching curated playlist:', error);
    return null;
  }
}

/**
 * Search curated playlists by keywords
 */
export async function searchCuratedPlaylists(searchQuery: string): Promise<CuratedPlaylist[]> {
  try {
    const allPlaylists = await getCuratedPlaylists(true); // Only active
    const lowerQuery = searchQuery.toLowerCase().trim();
    
    return allPlaylists.filter(playlist => 
      playlist.keywords.some(keyword => 
        keyword.toLowerCase().includes(lowerQuery) ||
        lowerQuery.includes(keyword.toLowerCase())
      ) ||
      playlist.name.toLowerCase().includes(lowerQuery)
    ).sort((a, b) => b.priority - a.priority);
  } catch (error) {
    console.error('Error searching curated playlists:', error);
    return [];
  }
}

/**
 * Create a new curated playlist (Admin only)
 */
export async function createCuratedPlaylist(
  playlistData: Omit<CuratedPlaylist, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    const newPlaylistRef = doc(collection(db, COLLECTION_NAME));
    const now = Date.now();
    
    await setDoc(newPlaylistRef, {
      ...playlistData,
      createdAt: now,
      updatedAt: now
    });
    
    return newPlaylistRef.id;
  } catch (error) {
    console.error('Error creating curated playlist:', error);
    throw new Error('Failed to create playlist');
  }
}

/**
 * Update an existing curated playlist (Admin only)
 */
export async function updateCuratedPlaylist(
  id: string,
  updates: Partial<Omit<CuratedPlaylist, 'id' | 'createdAt'>>
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error('Error updating curated playlist:', error);
    throw new Error('Failed to update playlist');
  }
}

/**
 * Delete a curated playlist (Admin only)
 */
export async function deleteCuratedPlaylist(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting curated playlist:', error);
    throw new Error('Failed to delete playlist');
  }
}
