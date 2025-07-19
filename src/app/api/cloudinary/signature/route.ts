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

    const { timestamp, upload_preset, public_id } = await request.json();
    console.log("[Cloudinary Signature] Received params for signing:", { timestamp, upload_preset, public_id });


    if (!timestamp || !upload_preset) {
        console.error("[Cloudinary Signature] Error: Missing timestamp or upload_preset.");
        return NextResponse.json({ error: 'Missing timestamp or upload_preset' }, { status: 400 });
    }

    const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;

    if (!cloudinaryApiSecret || !cloudinaryApiKey) {
      console.error("[Cloudinary Signature] Error: Cloudinary API Key or Secret is not defined in environment variables.");
      return NextResponse.json({ error: 'Server configuration error: Cloudinary credentials missing.' }, { status: 500 });
    }
    
    // According to Cloudinary docs, when using a public_id, the `folder` is NOT included
    // in the signature string itself. The signature is based on the public_id and timestamp.
    const paramsToSign: Record<string, any> = {
        timestamp: timestamp,
        upload_preset: upload_preset,
    };
    if (public_id) paramsToSign.public_id = public_id;

    console.log("[Cloudinary Signature] Final params object to be signed:", paramsToSign);

    const sortedParams = Object.keys(paramsToSign)
        .sort()
        .map(key => `${key}=${paramsToSign[key]}`)
        .join('&');

    const stringToSign = `${sortedParams}${cloudinaryApiSecret}`;
    console.log("[Cloudinary Signature] String to sign (secret hidden):", `${sortedParams}SECRET_REDACTED`);


    const signature = crypto
      .createHash('sha1')
      .update(stringToSign)
      .digest('hex');
    
    console.log("[Cloudinary Signature] Generated signature:", signature);
    
    return NextResponse.json({
      signature,
      timestamp,
      api_key: cloudinaryApiKey
    });

  } catch (error) {
    console.error("[Cloudinary Signature] Overall signature generation error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
