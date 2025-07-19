
'use server';
/**
 * @fileOverview Handles admin replies to suggestions as a Next.js Server Action.
 *
 * - replyToSuggestion - A function that saves an admin's reply as a message in Firestore.
 * - ReplyToSuggestionInput - The input type for the replyToSuggestion function.
 * - ReplyToSuggestionOutput - The return type for the replyToSuggestion function.
 */

import {z} from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, type Timestamp, type FieldValue } from 'firebase/firestore';
import { auth } from 'firebase-admin';
import { headers } from 'next/headers';

const ReplyToSuggestionInputSchema = z.object({
  suggestionId: z.string().describe('The ID of the suggestion being replied to.'),
  replyText: z.string().min(1, { message: "Reply cannot be empty."}).max(5000, {message: "Reply must be 5000 characters or less."}).describe('The text of the admin\'s reply.'),
  suggesterId: z.string().describe('The ID of the user who made the original suggestion.'),
  suggesterName: z.string().describe('The name of the user who made the original suggestion.'),
  adminId: z.string().describe('The ID of the admin sending the reply.'),
  adminName: z.string().describe('The name of the admin sending the reply.'),
});
export type ReplyToSuggestionInput = z.infer<typeof ReplyToSuggestionInputSchema>;

const ReplyToSuggestionOutputSchema = z.object({
  message: z.string().describe('A confirmation message that the reply was sent and saved.'),
  messageId: z.string().describe('The ID of the saved message.'),
});
export type ReplyToSuggestionOutput = z.infer<typeof ReplyToSuggestionOutputSchema>;

// Internal type to handle both server-side Timestamps and client-side FieldValues
type MessageData = {
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  text: string;
  timestamp: Timestamp | FieldValue;
  isRead: boolean;
  relatedSuggestionId?: string;
};

export async function replyToSuggestion(input: ReplyToSuggestionInput): Promise<ReplyToSuggestionOutput> {
  const authorization = headers().get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }
  const idToken = authorization.split('Bearer ')[1];
  
  try {
    const decodedToken = await auth().verifyIdToken(idToken);
    if (decodedToken.uid !== input.adminId || !decodedToken.admin) { // Check if user is admin
        throw new Error('Mismatched user ID or insufficient permissions');
    }
  } catch(error) {
    console.error("Authentication error in replyToSuggestion", error);
    throw new Error('Authentication failed or insufficient permissions');
  }

  try {
    ReplyToSuggestionInputSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors.map(e => e.message).join(', '));
    }
    throw error;
  }
  
  try {
    const messageData: MessageData = {
      senderId: input.adminId, 
      senderName: input.adminName, 
      receiverId: input.suggesterId,
      receiverName: input.suggesterName,
      text: input.replyText,
      timestamp: serverTimestamp(), 
      isRead: false,
      relatedSuggestionId: input.suggestionId,
    };

    const docRef = await addDoc(collection(db, 'messages'), messageData);
    
    console.log(`New reply message saved to Firestore with ID: ${docRef.id} for suggestion ${input.suggestionId}`);

    return {
      message: `Your reply to ${input.suggesterName}'s suggestion has been sent and saved.`,
      messageId: docRef.id,
    };
  } catch (error) {
    console.error("Failed to save reply message to Firestore:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while saving the reply.";
    throw new Error(`There was an issue sending your reply: ${errorMessage}. Please try again later.`);
  }
}
