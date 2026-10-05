import { NextResponse } from 'next/server';
import { adminMessaging, adminDb } from '@/lib/firebaseAdmin';

/**
 * POST /api/admin/send-push
 * 
 * Sends a push notification via Firebase Admin SDK (FCM HTTP v1 API).
 * This is the modern approach — no legacy server key needed.
 * 
 * Body:
 * - targetUserId?: string (specific user) — if omitted, sends to all
 * - title: string
 * - body: string
 * - data?: Record<string, string> (optional custom data like URL)
 * - adminEmail: string (for authorization check)
 */

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://muse.abhiyank.in';

async function sendPushToToken(
  token: string, 
  title: string, 
  body: string, 
  data?: Record<string, string>
): Promise<{ success: boolean; invalidToken?: boolean }> {
  try {
    await adminMessaging.send({
      token,
      notification: {
        title,
        body,
      },
      webpush: {
        notification: {
          title,
          body,
          icon: '/android-chrome-192x192.png',
          badge: '/favicon-32x32.png',
        },
        fcmOptions: {
          link: data?.url || APP_URL,
        },
      },
      data: {
        ...data,
        title,
        body,
      },
    });

    return { success: true };
  } catch (error: any) {
    // Token is invalid/expired — should be cleaned up
    if (
      error?.code === 'messaging/registration-token-not-registered' ||
      error?.code === 'messaging/invalid-registration-token'
    ) {
      console.warn('[FCM] Invalid token, will clean up');
      return { success: false, invalidToken: true };
    }

    console.error('[FCM] Send error:', error?.message || error);
    return { success: false };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { targetUserId, title, body: messageBody, data, adminEmail } = body;

    // Simple auth check
    if (!adminEmail || adminEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!title || !messageBody) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    // Get FCM tokens from Firestore
    let tokensSnap;
    if (targetUserId) {
      tokensSnap = await adminDb.collection('fcmTokens').where('userId', '==', targetUserId).get();
    } else {
      // Send to all
      tokensSnap = await adminDb.collection('fcmTokens').get();
    }
    
    if (tokensSnap.empty) {
      return NextResponse.json({ 
        success: false, 
        message: 'No push tokens found for the target user(s)',
        sent: 0 
      });
    }

    let successCount = 0;
    let failCount = 0;
    const invalidTokenIds: string[] = [];

    const sendPromises = tokensSnap.docs.map(async (tokenDoc) => {
      const tokenData = tokenDoc.data();
      const result = await sendPushToToken(tokenData.token, title, messageBody, data);
      
      if (result.success) {
        successCount++;
      } else {
        failCount++;
        // Track invalid tokens for cleanup
        if (result.invalidToken) {
          invalidTokenIds.push(tokenDoc.id);
        }
      }
    });

    await Promise.all(sendPromises);

    // Cleanup invalid/expired tokens
    if (invalidTokenIds.length > 0) {
      const batch = adminDb.batch();
      invalidTokenIds.forEach(id => {
        batch.delete(adminDb.collection('fcmTokens').doc(id));
      });
      await batch.commit().catch(() => {});
      console.log(`[FCM] Cleaned up ${invalidTokenIds.length} invalid tokens`);
    }

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failCount,
      cleaned: invalidTokenIds.length,
      total: tokensSnap.size,
    });
  } catch (error: any) {
    console.error('[Send Push] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
