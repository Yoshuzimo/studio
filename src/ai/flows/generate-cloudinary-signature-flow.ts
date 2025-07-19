'use server';
/**
 * @fileOverview A Genkit flow to securely generate a signature for Cloudinary uploads.
 * 
 * - generateCloudinarySignature - A function that creates a signature for a direct client-side upload.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as crypto from 'crypto';

const GenerateCloudinarySignatureInputSchema = z.object({
  timestamp: z.number().describe('The current UNIX timestamp.'),
  upload_preset: z.string().describe('The Cloudinary upload preset name.'),
});

const GenerateCloudinarySignatureOutputSchema = z.object({
  signature: z.string().describe('The generated SHA-256 signature.'),
  timestamp: z.number().describe('The timestamp used for the signature.'),
  api_key: z.string().describe('The Cloudinary public API key.')
});

const generateCloudinarySignatureFlow = ai.defineFlow(
  {
    name: 'generateCloudinarySignatureFlow',
    inputSchema: GenerateCloudinarySignatureInputSchema,
    outputSchema: GenerateCloudinarySignatureOutputSchema,
    auth: {
      forceAuth: true, // Ensures only logged-in users can get a signature
    },
  },
  async (params) => {
    const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;

    if (!cloudinaryApiSecret || !cloudinaryApiKey) {
      console.error("Cloudinary API Key or Secret is not defined in environment variables.");
      throw new Error("Server configuration error: Cloudinary credentials missing.");
    }

    const stringToSign = `timestamp=${params.timestamp}&upload_preset=${params.upload_preset}${cloudinaryApiSecret}`;

    const signature = crypto
      .createHash('sha256')
      .update(stringToSign)
      .digest('hex');

    return {
      signature,
      timestamp: params.timestamp,
      api_key: cloudinaryApiKey
    };
  }
);


export async function generateCloudinarySignature(params: z.infer<typeof GenerateCloudinarySignatureInputSchema>) {
    return generateCloudinarySignatureFlow(params);
}
