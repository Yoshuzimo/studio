
'use server';
/**
 * @fileOverview Handles updating the master quest list.
 *
 * - updateQuests - An admin-only function that overwrites the entire quest list in Firestore.
 * - UpdateQuestsInput - The input type for the updateQuests function.
 * - UpdateQuestsOutput - The return type for the updateQuests function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, writeBatch, serverTimestamp, setDoc } from 'firebase/firestore';
import type { Quest } from '@/types';

// Zod schema mirroring the Quest type for validation.
const QuestSchema = z.object({
    id: z.string(),
    name: z.string(),
    level: z.number(),
    adventurePackName: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    questGiver: z.string().nullable().optional(),
    casualExp: z.number().nullable().optional(),
    normalExp: z.number().nullable().optional(),
    hardExp: z.number().nullable().optional(),
    eliteExp: z.number().nullable().optional(),
    duration: z.string().nullable().optional(),
    baseFavor: z.number().nullable().optional(),
    patron: z.string().nullable().optional(),
    casualNotAvailable: z.boolean().optional(),
    normalNotAvailable: z.boolean().optional(),
    hardNotAvailable: z.boolean().optional(),
    eliteNotAvailable: z.boolean().optional(),
    epicBaseLevel: z.number().nullable().optional(),
    epicCasualExp: z.number().nullable().optional(),
    epicNormalExp: z.number().nullable().optional(),
    epicHardExp: z.number().nullable().optional(),
    epicEliteExp: z.number().nullable().optional(),
    epicCasualNotAvailable: z.boolean().optional(),
    epicNormalNotAvailable: z.boolean().optional(),
    epicHardNotAvailable: z.boolean().optional(),
    epicEliteNotAvailable: z.boolean().optional(),
    wikiUrl: z.string().url().nullable().optional().or(z.literal('')),
    mapUrls: z.array(z.string().url()).optional(),
});

const UpdateQuestsInputSchema = z.object({
  quests: z.array(QuestSchema),
});
export type UpdateQuestsInput = z.infer<typeof UpdateQuestsInputSchema>;

const UpdateQuestsOutputSchema = z.object({
  message: z.string(),
  questsWritten: z.number(),
});
export type UpdateQuestsOutput = z.infer<typeof UpdateQuestsOutputSchema>;

const BATCH_OPERATION_LIMIT = 490;

export async function updateQuests(input: UpdateQuestsInput): Promise<UpdateQuestsOutput> {
  return updateQuestsFlow(input);
}

const updateQuestsFlow = ai.defineFlow(
  {
    name: 'updateQuestsFlow',
    inputSchema: UpdateQuestsInputSchema,
    outputSchema: UpdateQuestsOutputSchema,
  },
  async ({ quests: newQuests }) => {
    const questsCollectionRef = collection(db, 'quests');
    
    // Delete all existing documents
    const oldQuestsSnapshot = await getDocs(questsCollectionRef);
    let deleteBatch = writeBatch(db);
    let deleteCount = 0;
    oldQuestsSnapshot.forEach(docSnap => {
      deleteBatch.delete(docSnap.ref);
      deleteCount++;
      if (deleteCount % BATCH_OPERATION_LIMIT === 0) {
        deleteBatch.commit();
        deleteBatch = writeBatch(db);
      }
    });
    if (deleteCount > 0 && deleteCount % BATCH_OPERATION_LIMIT !== 0) {
      await deleteBatch.commit();
    }
    
    // Add all new documents
    let addBatch = writeBatch(db);
    let addCount = 0;
    newQuests.forEach(quest => {
      // Ensure quest has an ID, but use the one from CSV if present
      const questDocRef = doc(questsCollectionRef, quest.id);
      addBatch.set(questDocRef, quest);
      addCount++;
      if (addCount % BATCH_OPERATION_LIMIT === 0) {
        addBatch.commit();
        addBatch = writeBatch(db);
      }
    });
    if (addCount > 0 && addCount % BATCH_OPERATION_LIMIT !== 0) {
      await addBatch.commit();
    }
    
    // Update metadata timestamp to trigger clients to refetch
    const metadataDocRef = doc(db, 'metadata', 'questData');
    await setDoc(metadataDocRef, { lastUpdatedAt: serverTimestamp() });

    return {
      message: `Successfully updated ${newQuests.length} quests in the database.`,
      questsWritten: newQuests.length,
    };
  }
);
