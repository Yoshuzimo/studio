
'use server';
/**
 * @fileOverview Handles suggestion submissions as a Next.js Server Action.
 *
 * - submitSuggestion - A function that processes a user's suggestion and saves it to Firestore.
 * - SubmitSuggestionInput - The input type for the submitSuggestion function.
 * - SubmitSuggestionOutput - The return type for the submitSuggestion function.
 */

import {z} from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, type Timestamp, type FieldValue } from 'firebase/firestore';
import { auth } from 'firebase-admin';
import { headers } from 'next/headers';

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
  const authorization = headers().get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }
  const idToken = authorization.split('Bearer ')[1];
  
  try {
    const decodedToken = await auth().verifyIdToken(idToken);
    if (decodedToken.uid !== input.suggesterId) {
        throw new Error('Mismatched user ID');
    }
  } catch(error) {
    console.error("Authentication error in submitSuggestion", error);
    throw new Error('Authentication failed');
  }

  try {
    SubmitSuggestionInputSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors.map(e => e.message).join(', '));
    }
    throw error;
  }
  
  try {
    const suggestionData: SuggestionData = {
      text: input.suggestionText,
      createdAt: serverTimestamp(),
      suggesterId: input.suggesterId, 
      suggesterName: input.suggesterName,
    };
    const docRef = await addDoc(collection(db, 'suggestions'), suggestionData);
    
    console.log(`New suggestion saved to Firestore with ID: ${docRef.id}`);

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
