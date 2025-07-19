
// src/app/api/auth/session/route.ts
import { auth } from '@/lib/firebase-admin'; // Correctly import our initialized admin auth
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('Authorization');
  if (authorization?.startsWith('Bearer ')) {
    const idToken = authorization.split('Bearer ')[1];
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

    try {
      const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
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

  return NextResponse.json({ status: 'error', message: 'Invalid token' }, { status: 400 });
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
