
// src/app/api/genkit/[...path]/route.ts
import { nextjsHandler } from '@genkit-ai/next';

// Import flows that are defined in other files
import '@/ai/flows/submit-suggestion-flow';
import '@/ai/flows/reply-to-suggestion-flow';
import '@/ai/flows/generate-cloudinary-signature-flow';

// This is the Genkit handler that will be called by the Next.js app.
export const POST = nextjsHandler();
