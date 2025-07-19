
'use server';
/**
 * @fileOverview Handles suggestion submissions.
 *
 * - submitSuggestion - A function that processes a user's suggestion and saves it to Firestore.
 * - SubmitSuggestionInput - The input type for the submitSuggestion function.
 * - SubmitSuggestionOutput - The return type for the submitSuggestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, type Timestamp, type FieldValue } from 'firebase/firestore';

const SubmitSuggestionInputSchema = z.object({
  suggestionText: z.string().min(10, { message: "Suggestion must be at least 10 characters."}).max(5000, {message: "Suggestion must be 5000 characters or less."}).describe('The text of the user\'s suggestion.'),
  suggesterId: z.string().describe('The ID of the user making the suggestion.'),
  suggesterName: z.string().describe('The name/email of the user making the suggestion.'),
});
export type SubmitSuggestionInput = z.infer<typeof SubmitSuggestionInputSchema>;

const SubmitSuggestionOutputSchema = z.object({
  message: z.string().describe('A confirmation message that the suggestion was received and saved.'),
  suggestionId: z.string().describe('The ID of the saved suggestion.'),
});
export type SubmitSuggestionOutput = z.infer<typeof SubmitSuggestionOutputSchema>;


// Internal type to handle both server-side Timestamps and client-side FieldValues
type SuggestionData = {
  text: string;
  createdAt: Timestamp | FieldValue;
  suggesterId: string;
  suggesterName: string;
};

export async function submitSuggestion(input: SubmitSuggestionInput): Promise<SubmitSuggestionOutput> {
  try {
    SubmitSuggestionInputSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors.map(e => e.message).join(', '));
    }
    throw error;
  }
  return submitSuggestionFlow(input);
}

const submitSuggestionFlow = ai.defineFlow(
  {
    name: 'submitSuggestionFlow',
    inputSchema: SubmitSuggestionInputSchema,
    outputSchema: SubmitSuggestionOutputSchema,
  },
  async (input) => {
    try {
      const suggestionData: SuggestionData = {
        text: input.suggestionText,
        createdAt: serverTimestamp(),
        suggesterId: input.suggesterId, 
        suggesterName: input.suggesterName,
      };
      const docRef = await addDoc(collection(db, 'suggestions'), suggestionData);
      
      console.log(`New suggestion saved to Firestore with ID: ${docRef.id}`);
      console.log(`Suggestion text: "${input.suggestionText}" by ${suggestionData.suggesterName}`);

      return {
        message: 'Thank you! Your suggestion has been received and saved for review.',
        suggestionId: docRef.id,
      };
    } catch (error) {
      console.error("Failed to save suggestion to Firestore:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while saving your suggestion.";
      throw new Error(`There was an issue submitting your suggestion: ${errorMessage}. Please try again later.`);
    }
  }
);
