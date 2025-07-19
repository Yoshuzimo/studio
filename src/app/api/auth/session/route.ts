// src/app/api/auth/session/route.ts
import { adminAuth } from '@/lib/firebase-admin'; // Correctly import our initialized admin auth
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken = body.idToken;

    if (!idToken) {
        return NextResponse.json({ status: 'error', message: 'Missing ID token' }, { status: 400 });
    }

    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    const options = {
      name: '__session',
      value: sessionCookie,
      maxAge: expiresIn,
      httpOnly: true,
      secure: true,
    };

    cookies().set(options);

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Session cookie creation error:', error);
    return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }
}


export async function DELETE() {
  try {
    cookies().delete('__session');
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Session cookie deletion error:', error);
    return NextResponse.json({ status: 'error', message: 'Internal Server Error' }, { status: 500 });
  }
}
