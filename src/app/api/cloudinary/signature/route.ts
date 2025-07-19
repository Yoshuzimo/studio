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

    const {
      timestamp,
      upload_preset,
      public_id,
      folder,
      custom_coordinates,
      source,
    } = await request.json();

    console.log("[Cloudinary Signature] Received params for signing:", {
      timestamp,
      upload_preset,
      public_id,
      folder,
      custom_coordinates,
      source,
    });

    if (!timestamp || !upload_preset) {
      return NextResponse.json(
        { error: 'Missing required parameters: timestamp and upload_preset are mandatory.' },
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

    // Build and sort the params
    const paramsToSign: Record<string, string> = {};
    if (custom_coordinates) paramsToSign.custom_coordinates = custom_coordinates;
    if (folder) paramsToSign.folder = folder;
    if (public_id) paramsToSign.public_id = public_id;
    if (source) paramsToSign.source = source;
    paramsToSign.timestamp = String(timestamp);
    paramsToSign.upload_preset = upload_preset;

    const sortedParams = Object.entries(paramsToSign)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${key}=${val}`)
      .join('&');

    const stringToSign = `${sortedParams}${cloudinaryApiSecret}`;

    const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');

    console.log("[Cloudinary Signature] Generated signature details:", {
      sortedParams,
      stringToSign,
      signature,
    });

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
