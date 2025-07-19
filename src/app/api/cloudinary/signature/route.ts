
// src/app/api/cloudinary/signature/route.ts
import { NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    
    try {
        await adminAuth.verifyIdToken(idToken);
    } catch (error) {
        console.error("Firebase Auth Error:", error);
        return NextResponse.json({ error: 'Invalid authentication token.' }, { status: 401 });
    }

    const { timestamp, upload_preset, folder, public_id } = await request.json();

    if (!timestamp || !upload_preset) {
        return NextResponse.json({ error: 'Missing timestamp or upload_preset' }, { status: 400 });
    }

    const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;

    if (!cloudinaryApiSecret || !cloudinaryApiKey) {
      console.error("Cloudinary API Key or Secret is not defined in environment variables.");
      return NextResponse.json({ error: 'Server configuration error: Cloudinary credentials missing.' }, { status: 500 });
    }
    
    const paramsToSign: Record<string, any> = {
        timestamp: timestamp,
        upload_preset: upload_preset,
    };
    if (folder) paramsToSign.folder = folder;
    if (public_id) paramsToSign.public_id = public_id;

    const sortedParams = Object.keys(paramsToSign)
        .sort()
        .map(key => `${key}=${paramsToSign[key]}`)
        .join('&');

    const stringToSign = `${sortedParams}${cloudinaryApiSecret}`;

    const signature = crypto
      .createHash('sha1')
      .update(stringToSign)
      .digest('hex');
    
    return NextResponse.json({
      signature,
      timestamp,
      api_key: cloudinaryApiKey
    });

  } catch (error) {
    console.error("Signature generation error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
