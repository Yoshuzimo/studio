console.log("[Cloudinary Signature] ENV CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY);

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

    // The widget now sends only the timestamp for signature generation purposes.
    // The other parameters are added by the widget itself during the actual upload.
    const { timestamp } = await request.json();

    if (!timestamp) {
      return NextResponse.json(
        { error: 'Missing required parameter: timestamp is mandatory.' },
        { status: 400 }
      );
    }

    const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;

    if (!cloudinaryApiSecret || !cloudinaryApiKey) {
      console.error("[Cloudinary Signature] Cloudinary credentials are missing.");
      return NextResponse.json(
        { error: 'Server configuration error: Cloudinary credentials missing.' },
        { status: 500 }
      );
    }
    
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!uploadPreset) {
      console.error("[Cloudinary Signature] Cloudinary upload preset is missing.");
       return NextResponse.json(
        { error: 'Server configuration error: Cloudinary upload preset missing.' },
        { status: 500 }
      );
    }

    // Per Cloudinary docs for uploadSignature, only timestamp and upload_preset are needed for this flow.
    // The widget will combine this server-generated signature with other parameters client-side.
    const paramsToSign = {
      timestamp: String(timestamp),
      upload_preset: uploadPreset,
    };

    const sortedParams = Object.entries(paramsToSign)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${key}=${val}`)
      .join('&');

    const stringToSign = `${sortedParams}${cloudinaryApiSecret}`;

    const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');

    console.log("[Cloudinary Signature] Generated signature for widget:", {
      sortedParams,
      signature,
    });

    // Return all necessary info for the widget to perform the upload.
    return NextResponse.json({
      signature,
      timestamp,
      api_key: cloudinaryApiKey,
    });

  } catch (error) {
    console.error("[Cloudinary Signature] Signature generation failed:", error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
