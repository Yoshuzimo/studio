
// src/app/api/cloudinary/signature/route.ts
import { NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      console.error("[Cloudinary Signature] Error: Missing Authorization header.");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authorization.split('Bearer ')[1];

    try {
      await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      console.error("[Cloudinary Signature] Firebase Auth Error:", error);
      return NextResponse.json({ error: 'Invalid authentication token.' }, { status: 401 });
    }

    const body = await request.json();
    const paramsToSign = body;

    const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudinaryApiSecret) {
      console.error("[Cloudinary Signature] Cloudinary API secret is missing.");
      return NextResponse.json(
        { error: 'Server configuration error: Cloudinary credentials missing.' },
        { status: 500 }
      );
    }
    
    // The widget sends all parameters it will use in the upload for signing.
    // We must sign all of them except for file data and api_key which are excluded by the widget.
    const sortedParams = Object.keys(paramsToSign)
      .sort()
      .map(key => `${key}=${paramsToSign[key]}`)
      .join('&');

    const stringToSign = `${sortedParams}${cloudinaryApiSecret}`;

    const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');

    // The widget only needs the signature itself in the response.
    return NextResponse.json({
      signature: signature
    });

  } catch (error) {
    console.error("[Cloudinary Signature] Signature generation failed:", error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
