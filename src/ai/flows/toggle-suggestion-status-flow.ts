
'use server';
/**
 * @fileOverview Handles toggling the status of a suggestion (open/closed).
 *
 * - toggleSuggestionStatus - An admin-only action to change a suggestion's status.
 * - ToggleSuggestionStatusInput - Input type for the function.
 * - ToggleSuggestionStatusOutput - Output type for the function.
 */

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { adminAuth } from '@/lib/firebase-admin';
import type { Suggestion } from '@/types';
import { cookies } from 'next/headers';

const ToggleSuggestionStatusInputSchema = z.object({
  suggestionId: z.string().describe('The ID of the suggestion whose status is being changed.'),
  adminId: z.string().describe('The ID of the admin making the change.'),
});
export type ToggleSuggestionStatusInput = z.infer<typeof ToggleSuggestionStatusInputSchema>;

const ToggleSuggestionStatusOutputSchema = z.object({
  message: z.string().describe('A confirmation message.'),
  newStatus: z.enum(['open', 'closed']).describe("The new status of the suggestion."),
});
export type ToggleSuggestionStatusOutput = z.infer<typeof ToggleSuggestionStatusOutputSchema>;

export async function toggleSuggestionStatus(input: ToggleSuggestionStatusInput): Promise<ToggleSuggestionStatusOutput> {
    const sessionCookie = cookies().get('__session')?.value;
    if (!sessionCookie) {
      throw new Error('Unauthorized');
    }

    let decodedToken;
    try {
        decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    } catch(error) {
        console.error("Authentication error in toggleSuggestionStatus", error);
        throw new Error('Authentication failed');
    }

    if (decodedToken.uid !== input.adminId) {
        throw new Error('Mismatched admin ID.');
    }

    const userDocSnap = await getDoc(doc(db, 'users', decodedToken.uid));
    if (!userDocSnap.exists() || userDocSnap.data().isAdmin !== true) {
        throw new Error('Insufficient permissions. Only admins can change status.');
    }

  try {
    const suggestionRef = doc(db, 'suggestions', input.suggestionId);
    const suggestionSnap = await getDoc(suggestionRef);

    if (!suggestionSnap.exists()) {
      throw new Error("Suggestion not found.");
    }

    const currentStatus = (suggestionSnap.data() as Suggestion).status;
    const newStatus = currentStatus === 'open' ? 'closed' : 'open';

    await updateDoc(suggestionRef, {
      status: newStatus
    });

    return {
      message: `Suggestion status changed to ${newStatus}.`,
      newStatus,
    };
  } catch (error) {
    console.error("Failed to toggle suggestion status in Firestore:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    throw new Error(`There was an issue updating the status: ${errorMessage}`);
  }
}
