
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
      console.log("[Cloudinary Signature] Firebase ID token verified successfully.");
    } catch (error) {
      console.error("[Cloudinary Signature] Firebase Auth Error:", error);
      return NextResponse.json({ error: 'Invalid authentication token.' }, { status: 401 });
    }

    // The widget sends all parameters it will use in the upload for signing.
    // We will sign all of them except for file data.
    const paramsToSign = await request.json();

    console.log("[Cloudinary Signature] Received params for signing:", paramsToSign);


    const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;

    if (!cloudinaryApiSecret || !cloudinaryApiKey) {
      console.error("[Cloudinary Signature] Cloudinary credentials are missing.");
      return NextResponse.json(
        { error: 'Server configuration error: Cloudinary credentials missing.' },
        { status: 500 }
      );
    }
    
    // The widget has already prepared the params. We just need to sort them and sign.
    const sortedParams = Object.entries(paramsToSign)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${key}=${val}`)
      .join('&');

    const stringToSign = `${sortedParams}${cloudinaryApiSecret}`;

    const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');

    console.log("[Cloudinary Signature] Generated signature details:", {
      sortedParams,
      signature,
    });

    // The widget only needs the signature itself in the response to the uploadSignature function.
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
