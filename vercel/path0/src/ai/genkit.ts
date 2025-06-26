
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Ensure the API key is passed explicitly to the Google AI plugin.
// You can get a key from Google AI Studio: https://aistudio.google.com/
// This key should be set in your environment variables (e.g., in a .env.local file).
const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn(
    'WARNING: GOOGLE_API_KEY or GEMINI_API_KEY environment variable not set. AI features will not work.'
  );
}

export const ai = genkit({
  plugins: [
    // The Google AI plugin is initialized even without a key.
    // Genkit will throw an error at runtime if you try to use an AI model without a key.
    googleAI({ apiKey }),
  ],
  model: 'googleai/gemini-2.0-flash',
});
