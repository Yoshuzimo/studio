
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Re-enabling the googleAI plugin. Genkit flows, even non-generative ones,
// often rely on a configured plugin to properly initialize the server environment.
export const ai = genkit({
  plugins: [googleAI()],
});
