import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase'; // Assume this works in Vercel Edge/Serverless if configured right.
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // In a real app we might verify admin or auth token here but since we are submitting bugs, auth might be optional.
    
    // Server-side validation
    if (!body || !body.timestamp) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const docRef = await addDoc(collection(db, 'bugReports'), {
      ...body,
      createdAt: serverTimestamp(),
      resolved: false,
    });

    return NextResponse.json({ id: docRef.id, success: true });
  } catch (error) {
    console.error('Failed to submit bug report:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // Should ideally check admin auth but left to client middleware/rules for this step.
  return NextResponse.json({ message: 'Use Firebase Client SDK to query reports in Admin UI' });
}
