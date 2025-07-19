// src/app/api/genkit/[...path]/route.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { nextHandler } from '@genkit-ai/next';
import { defineFlow } from 'genkit/flow';
import { z } from 'zod';
import * as "crypto-js";

// Import flows that are defined in other files
import '@/ai/flows/submit-suggestion-flow';
import '@/ai/flows/reply-to-suggestion-flow';
import '@/ai/flows/generate-cloudinary-signature-flow';


// This is the Genkit handler that will be called by the Next.js app.
export const POST = nextHandler();