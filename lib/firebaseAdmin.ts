import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

/**
 * Firebase Admin SDK initialization (server-side only).
 * 
 * Loads credentials in order of priority:
 * 1. FIREBASE_SERVICE_ACCOUNT env var (JSON string)
 * 2. GOOGLE_APPLICATION_CREDENTIALS env var (file path)
 * 3. Auto-detect service account JSON in project root
 */

function getFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin;
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // Option 1: JSON string in env var
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
      console.log('[Firebase Admin] Initialized from FIREBASE_SERVICE_ACCOUNT env');
      return admin;
    } catch (error) {
      console.error('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT:', error);
    }
  }

  // Option 2: GOOGLE_APPLICATION_CREDENTIALS file path
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
    console.log('[Firebase Admin] Initialized from GOOGLE_APPLICATION_CREDENTIALS');
    return admin;
  }

  // Option 3: Auto-detect service account JSON file in project root
  try {
    const rootDir = process.cwd();
    const files = fs.readdirSync(rootDir);
    const saFile = files.find(f => f.includes('firebase-adminsdk') && f.endsWith('.json'));
    
    if (saFile) {
      const filePath = path.join(rootDir, saFile);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const serviceAccount = JSON.parse(fileContent);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
      console.log(`[Firebase Admin] Initialized from file: ${saFile}`);
      return admin;
    }
  } catch (error) {
    console.error('[Firebase Admin] Failed to auto-detect service account file:', error);
  }

  // Fallback: no credentials
  console.warn('[Firebase Admin] No credentials found. Push notifications will not work.');
  admin.initializeApp({ projectId });
  return admin;
}

export const adminApp = getFirebaseAdmin();
export const adminMessaging = adminApp.messaging();
export const adminDb = adminApp.firestore();
