
'use server';
/**
 * @fileOverview A server-side flow for migrating character data to the new accounts structure.
 *
 * - migrateCharactersToAccounts: An admin-only function to assign characters to default accounts.
 * - MigrateCharactersInput - Input type for the function.
 * - MigrateCharactersOutput - Output type for the function.
 */

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, query, writeBatch, setDoc, where } from 'firebase/firestore';
import { adminAuth } from '@/lib/firebase-admin';
import type { Character, Account } from '@/types';
import { cookies } from 'next/headers';

const MigrateCharactersInputSchema = z.object({
  adminId: z.string().describe('The ID of the admin initiating the migration.'),
});
export type MigrateCharactersInput = z.infer<typeof MigrateCharactersInputSchema>;

const MigrateCharactersOutputSchema = z.object({
  message: z.string().describe('A summary of the migration process.'),
  usersProcessed: z.number(),
  accountsCreated: z.number(),
  charactersMigrated: z.number(),
});
export type MigrateCharactersOutput = z.infer<typeof MigrateCharactersOutputSchema>;

const BATCH_LIMIT = 490;

export async function migrateCharactersToAccounts(input: MigrateCharactersInput): Promise<MigrateCharactersOutput> {
  // Authorization Check
  const sessionCookie = cookies().get('__session')?.value;
  if (!sessionCookie) {
    throw new Error('Unauthorized');
  }
  const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
  if (decodedToken.uid !== input.adminId) {
    throw new Error('Mismatched admin ID.');
  }
  const userDocSnap = await getDoc(doc(db, 'users', decodedToken.uid));
  if (!userDocSnap.exists() || userDocSnap.data().isAdmin !== true) {
    throw new Error('Insufficient permissions. Only admins can run this migration.');
  }

  // --- Migration Logic ---
  console.log("Starting character migration process...");
  let usersProcessed = 0;
  let accountsCreated = 0;
  let charactersMigrated = 0;

  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    usersProcessed = usersSnapshot.size;

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      console.log(`Processing user: ${userId}`);

      // Step 1: Find or Create a "Default" account for the user
      const accountsRef = collection(db, 'accounts');
      const q = query(accountsRef, where('userId', '==', userId), where('name', '==', 'Default'));
      const defaultAccountSnapshot = await getDocs(q);

      let defaultAccountId: string;

      if (defaultAccountSnapshot.empty) {
        console.log(`No Default account for user ${userId}. Creating one.`);
        const newAccountRef = doc(collection(db, 'accounts'));
        const newAccountData: Account = {
          id: newAccountRef.id,
          userId: userId,
          name: 'Default',
        };
        await setDoc(newAccountRef, newAccountData);
        defaultAccountId = newAccountRef.id;
        accountsCreated++;
      } else {
        defaultAccountId = defaultAccountSnapshot.docs[0].id;
        console.log(`Found Default account for user ${userId}: ${defaultAccountId}`);
      }

      // Step 2: Find and migrate characters for this user
      const charactersRef = collection(db, 'characters');
      const charQuery = query(charactersRef, where('userId', '==', userId));
      const charactersSnapshot = await getDocs(charQuery);
      
      const charsToMigrate: Character[] = [];
      charactersSnapshot.forEach(charDoc => {
        const character = charDoc.data() as Character;
        if (!character.accountId) {
          charsToMigrate.push({ ...character, id: charDoc.id });
        }
      });

      if (charsToMigrate.length > 0) {
        console.log(`Found ${charsToMigrate.length} characters to migrate for user ${userId}.`);
        let batch = writeBatch(db);
        let opCount = 0;

        for (const char of charsToMigrate) {
          const charRef = doc(db, 'characters', char.id);
          batch.update(charRef, { accountId: defaultAccountId });
          charactersMigrated++;
          opCount++;
          if (opCount >= BATCH_LIMIT) {
            await batch.commit();
            console.log("Committed a batch of character updates.");
            batch = writeBatch(db);
            opCount = 0;
          }
        }
        if (opCount > 0) {
          await batch.commit();
          console.log("Committed the final batch of character updates.");
        }
      }
    }

    const message = `Migration complete. Processed ${usersProcessed} users. Created ${accountsCreated} new 'Default' accounts. Migrated ${charactersMigrated} characters.`;
    console.log(message);
    return {
      message,
      usersProcessed,
      accountsCreated,
      charactersMigrated,
    };

  } catch (error) {
    console.error("Character migration failed:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    throw new Error(`Migration failed: ${errorMessage}`);
  }
}
