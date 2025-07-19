
import {genkit} from 'genkit';

// Re-enabling the googleAI plugin. Genkit flows, even non-generative ones,
// often rely on a configured plugin to properly initialize the server environment.
export const ai = genkit({
  plugins: [],
});
