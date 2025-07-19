
'use server';
/**
 * @fileOverview Handles adding a reply to an existing suggestion conversation.
 *
 * - addReplyToSuggestion - Appends a message to a suggestion's conversation array.
 * - AddReplyToSuggestionInput - Input type for the function.
 * - AddReplyToSuggestionOutput - Output type for the function.
 */

import {z} from 'zod';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { adminAuth } from '@/lib/firebase-admin';
import type { SuggestionConversationItem, Suggestion } from '@/types';
import { serverTimestamp } from 'firebase/firestore';
import { cookies } from 'next/headers';

const AddReplyToSuggestionInputSchema = z.object({
  suggestionId: z.string().describe('The ID of the suggestion being replied to.'),
  replyText: z.string().min(1).max(5000).describe("The text of the user's or admin's reply."),
  senderId: z.string().describe('The ID of the user sending the reply.'),
  senderName: z.string().describe('The name of the user sending the reply.'),
});
export type AddReplyToSuggestionInput = z.infer<typeof AddReplyToSuggestionInputSchema>;

const AddReplyToSuggestionOutputSchema = z.object({
  message: z.string().describe('A confirmation message.'),
  suggestionId: z.string().describe('The ID of the updated suggestion.'),
});
export type AddReplyToSuggestionOutput = z.infer<typeof AddReplyToSuggestionOutputSchema>;


export async function addReplyToSuggestion(input: AddReplyToSuggestionInput): Promise<AddReplyToSuggestionOutput> {
  const sessionCookie = cookies().get('__session')?.value;
  if (!sessionCookie) {
    throw new Error('Unauthorized');
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch(error) {
    console.error("Authentication error in addReplyToSuggestion", error);
    throw new Error('Authentication failed');
  }

  if (decodedToken.uid !== input.senderId) {
      throw new Error('Mismatched sender ID');
  }
  
  try {
    AddReplyToSuggestionInputSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors.map(e => e.message).join(', '));
    }
    throw error;
  }
  
  try {
    const suggestionRef = doc(db, 'suggestions', input.suggestionId);
    const suggestionSnap = await getDoc(suggestionRef);

    if (!suggestionSnap.exists()) {
      throw new Error("Suggestion not found.");
    }

    const suggestionData = suggestionSnap.data() as Suggestion;
    
    // Authorization check: Only admin or original suggester can reply.
    const isSuggester = decodedToken.uid === suggestionData.suggesterId;
    const userDocSnap = await getDoc(doc(db, 'users', decodedToken.uid));
    const isAdmin = userDocSnap.exists() && userDocSnap.data().isAdmin === true;

    if (!isSuggester && !isAdmin) {
        throw new Error("You do not have permission to reply to this suggestion.");
    }
    
    if (suggestionData.status === 'closed' && !isAdmin) {
        throw new Error("This suggestion is closed and can no longer be replied to.");
    }

    const newConversationItem: SuggestionConversationItem = {
        senderId: input.senderId,
        senderName: input.senderName,
        text: input.replyText,
        timestamp: serverTimestamp(),
    };

    await updateDoc(suggestionRef, {
        conversation: arrayUnion(newConversationItem)
    });
    
    return {
      message: 'Your reply has been added.',
      suggestionId: input.suggestionId,
    };
  } catch (error) {
    console.error("Failed to add reply to Firestore:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while saving the reply.";
    throw new Error(`There was an issue sending your reply: ${errorMessage}`);
  }
}
