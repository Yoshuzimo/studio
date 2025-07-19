// src/app/api/genkit/[...path]/route.ts

// Temporarily disabled Genkit API route to fix build issues.
// The @genkit-ai/next package does not export handleNextRequest as expected.
// This placeholder ensures the build passes.
import {NextResponse} from 'next/server';

export async function GET() {
  return NextResponse.json({error: 'Not Implemented'}, {status: 501});
}

export async function POST() {
  return NextResponse.json({error: 'Not Implemented'}, {status: 501});
}
