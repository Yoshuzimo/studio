
import {genkit} from 'genkit';

// The googleAI plugin has been removed as it was not being used by any active flows.
// This removes the requirement for a GOOGLE_API_KEY.
export const ai = genkit({
  plugins: [],
});
