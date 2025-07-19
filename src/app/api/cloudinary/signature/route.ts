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

    if (!timestamp || !upload_preset || !public_id) {
        console.error("[Cloudinary Signature] Error: Missing timestamp, upload_preset, or public_id.");
        return NextResponse.json({ error: 'Missing required parameters for signing' }, { status: 400 });
    }

    const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;

    if (!cloudinaryApiSecret || !cloudinaryApiKey) {
      console.error("[Cloudinary Signature] Error: Cloudinary API Key or Secret is not defined in environment variables.");
      return NextResponse.json({ error: 'Server configuration error: Cloudinary credentials missing.' }, { status: 500 });
    }
    
    const paramsToSign: Record<string, any> = {
        public_id,
        timestamp,
        upload_preset,
    };

    // Force alphabetical sorting of keys to match Cloudinary's expectation.
    const sortedParams = Object.entries(paramsToSign)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${key}=${val}`)
      .join('&');
    
    const stringToSign = `${sortedParams}${cloudinaryApiSecret}`;
    
    console.log("[Signature Debug]", {
      paramsToSign,
      sortedParams,
      stringToSign,
      cloudinaryApiSecret,
    });
    
    const signature = crypto
      .createHash('sha1')
      .update(stringToSign)
      .digest('hex');
    
    console.log("[Signature Generation]", {
      sortedParams,
      stringToSign,
      expectedSignature: signature
    });
    
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
