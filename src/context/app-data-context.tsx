
// src/context/app-data-context.tsx
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Character, Account, AdventurePack, Quest, UserQuestCompletionData } from '@/types';
import { db, auth } from '@/lib/firebase';
import {
  collection, getDocs, doc, writeBatch, setDoc, deleteDoc, query,
  getDoc, where, type Timestamp as FirestoreTimestampType, serverTimestamp, type FieldValue, updateDoc,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './auth-context';
import { ADVENTURE_PACKS_DATA } from '@/data/adventure-packs';
import { QUESTS_DATA } from '@/data/quests'; // Import static quest data

export interface QuestCompletionUpdate {
  questId: string;
  casualCompleted?: boolean;
  normalCompleted?: boolean;
  hardCompleted?: boolean;
  eliteCompleted?: boolean;
}

interface AppDataContextType {
  accounts: Account[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  addAccount: (accountData: Omit<Account, 'id' | 'userId'>) => Promise<Account | undefined>;
  updateAccount: (account: Account) => Promise<void>;
  deleteAccount: (account: Account) => Promise<void>;
  activeAccountId: string | null;
  setActiveAccountId: (accountId: string) => void;

  characters: Character[];
  addCharacter: (characterData: Omit<Character, 'id' | 'userId' | 'iconUrl' | 'preferences'> & { iconUrl?: string | null }) => Promise<Character | undefined>;
  updateCharacter: (character: Character) => Promise<void>;
  deleteCharacter: (characterId: string) => Promise<void>;

  adventurePacks: AdventurePack[];
  
  quests: Quest[];
  updateQuestDefinition: (quest: Quest) => Promise<void>;
  deleteQuestDefinition: (questId: string) => Promise<void>;

  fetchQuestCompletionsForCharacter: (characterId: string) => Promise<void>;
  batchUpdateUserQuestCompletions: (characterId: string, updates: QuestCompletionUpdate[]) => Promise<void>;
  batchResetUserQuestCompletions: (characterId: string, questIds: string[]) => Promise<void>;
  activeCharacterId: string | null;
  activeCharacterQuestCompletions: Map<string, UserQuestCompletionData>;

  ownedPacks: string[];
  setOwnedPacks: React.Dispatch<React.SetStateAction<string[]>>;

  isDataLoaded: boolean;
  isLoading: boolean;
  isUpdating: boolean;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

const USER_CONFIGURATION_COLLECTION = 'userConfiguration';
const OWNED_PACKS_SUBCOLLECTION = 'ownedPacksInfo';
const CHARACTERS_COLLECTION = 'characters';
const ACCOUNTS_COLLECTION = 'accounts';
const QUEST_COMPLETIONS_SUBCOLLECTION = 'questCompletions';

const BATCH_OPERATION_LIMIT = 490;

const normalizeAdventurePackNameForStorage = (name?: string | null): string | null => {
  if (!name) return null;
  const trimmedName = name.trim();
  if (trimmedName.toLowerCase().startsWith("the ")) {
    return trimmedName.substring(4).trim();
  }
  return trimmedName;
};

const SHADOWFELL_CONSPIRACY_PARENT_NORMALIZED = normalizeAdventurePackNameForStorage("Shadowfell Conspiracy");
const SHADOWFELL_CONSPIRACY_CHILDREN_NORMALIZED = [
  normalizeAdventurePackNameForStorage("Disciples of Shadow"),
  normalizeAdventurePackNameForStorage("Shadow Over Wheloon"),
  normalizeAdventurePackNameForStorage("The Secret of the Storm Horns")
].filter((name): name is string => name !== null);

const adventurePacks: AdventurePack[] = ADVENTURE_PACKS_DATA.map(p => ({
  ...p,
  name: normalizeAdventurePackNameForStorage(p.name) || "Unnamed Pack",
}));

// Use static quests data
const quests: Quest[] = QUESTS_DATA.map(q => ({
    ...q,
    adventurePackName: normalizeAdventurePackNameForStorage(q.adventurePackName)
}));

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);

  const [ownedPacks, setOwnedPacksInternal] = useState<string[]>([]);
  
  const [activeCharacterId, setActiveCharacterIdState] = useState<string | null>(null);
  const [activeCharacterQuestCompletions, setActiveCharacterQuestCompletions] = useState<Map<string, UserQuestCompletionData>>(new Map());

  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const { toast } = useToast();
  const initialDataLoadedForUserRef = useRef<string | null>(null);
  const lastKnownOwnedPacksRef = useRef<string | null>(null);
  const characterUpdateDebounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const fetchQuestCompletionsForCharacter = useCallback(async (characterIdToFetch: string) => {
    if (!currentUser) {
      setActiveCharacterIdState(null);
      setActiveCharacterQuestCompletions(new Map());
      return;
    }
    setIsLoading(true);
    try {
      const completionsPath = `${CHARACTERS_COLLECTION}/${characterIdToFetch}/${QUEST_COMPLETIONS_SUBCOLLECTION}`;
      const completionsQuery = query(collection(db, completionsPath));
      const snapshot = await getDocs(completionsQuery);
      const newCompletions = new Map<string, UserQuestCompletionData>();
      snapshot.docs.forEach(docSnap => {
        newCompletions.set(docSnap.id, { ...docSnap.data() } as UserQuestCompletionData);
      });
      setActiveCharacterQuestCompletions(newCompletions);
      setActiveCharacterIdState(characterIdToFetch);
    } catch (error) {
      toast({ title: "Error Loading Quest Completions", description: (error as Error).message, variant: 'destructive' });
      setActiveCharacterQuestCompletions(new Map());
      setActiveCharacterIdState(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast]);


  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false);
      setIsDataLoaded(false);
      setAccounts([]);
      setCharacters([]);
      setOwnedPacksInternal([]);
      setActiveAccountId(null);
      setActiveCharacterIdState(null);
      initialDataLoadedForUserRef.current = null;
      return;
    }

    if (initialDataLoadedForUserRef.current === currentUser.uid) {
        setIsLoading(false);
        return;
    }
    
    setIsLoading(true);
    
    const loadInitialData = async () => {
      try {
        console.log('[AppDataProvider] Loading initial data for user:', currentUser.uid);

        // Fetch accounts first
        const accQuery = query(collection(db, ACCOUNTS_COLLECTION), where('userId', '==', currentUser.uid));
        const accSnapshot = await getDocs(accQuery);
        let loadedAccounts = accSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
        let currentActiveAccountId = activeAccountId;

        // Ensure default account exists
        if (loadedAccounts.length === 0) {
          console.log('[AppDataProvider] No accounts found, creating default account.');
          const defaultAccountData = { userId: currentUser.uid, name: "Default" };
          const defaultAccountRef = doc(collection(db, ACCOUNTS_COLLECTION));
          await setDoc(defaultAccountRef, defaultAccountData);
          const newDefaultAccount = { id: defaultAccountRef.id, ...defaultAccountData };
          loadedAccounts.push(newDefaultAccount);
          currentActiveAccountId = newDefaultAccount.id; // Set active ID to the new default
        }
        
        setAccounts(loadedAccounts);

        // Set active account ID if not already set or invalid
        if (!currentActiveAccountId || !loadedAccounts.some(acc => acc.id === currentActiveAccountId)) {
            const defaultAcc = loadedAccounts.find(acc => acc.name === 'Default');
            currentActiveAccountId = defaultAcc?.id || loadedAccounts[0]?.id || null;
        }
        setActiveAccountId(currentActiveAccountId);

        // Fetch characters now that we have accounts
        const charQuery = query(collection(db, CHARACTERS_COLLECTION), where('userId', '==', currentUser.uid));
        const charSnapshot = await getDocs(charQuery);
        const loadedChars = charSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            userId: data.userId,
            accountId: data.accountId,
            name: data.name,
            level: data.level,
            iconUrl: data.iconUrl || null,
            preferences: data.preferences || {},
          } as Character;
        });
        setCharacters(loadedChars);
        
        initialDataLoadedForUserRef.current = currentUser.uid;
      } catch (error) {
        console.error("[AppDataProvider] Failed to load initial user-specific data:", error);
        toast({ title: "Data Load Error", description: (error as Error).message, variant: 'destructive' });
      } finally {
        setIsDataLoaded(true);
        setIsLoading(false);
      }
    };
    
    loadInitialData();

  }, [currentUser, toast, activeAccountId]);
  
  const setOwnedPacks: React.Dispatch<React.SetStateAction<string[]>> = useCallback((valueOrFn) => {
    setOwnedPacksInternal(prevOwnedPacks => {
      const newPacksRaw = typeof valueOrFn === 'function' ? valueOrFn(prevOwnedPacks) : valueOrFn;
      const normalizedNewPacks = newPacksRaw
        .map(name => normalizeAdventurePackNameForStorage(name))
        .filter((name): name is string => name !== null);

      let finalPacks = [...new Set(normalizedNewPacks)];

      if (SHADOWFELL_CONSPIRACY_PARENT_NORMALIZED && finalPacks.some(p => p.toLowerCase() === SHADOWFELL_CONSPIRACY_PARENT_NORMALIZED.toLowerCase())) {
        SHADOWFELL_CONSPIRACY_CHILDREN_NORMALIZED.forEach(childPackName => {
          if (!finalPacks.some(p => p.toLowerCase() === childPackName.toLowerCase())) {
            finalPacks.push(childPackName);
          }
        });
      }

      return [...new Set(finalPacks)];
    });
  }, []);
  
  // Fetch owned packs when activeAccountId changes
  useEffect(() => {
    if (!currentUser || !activeAccountId) {
      setOwnedPacksInternal([]);
      return;
    };
    
    const fetchOwnedPacks = async () => {
      setIsUpdating(true);
      try {
        const ownedPacksDocRef = doc(db, USER_CONFIGURATION_COLLECTION, currentUser.uid, OWNED_PACKS_SUBCOLLECTION, activeAccountId);
        const ownedPacksDocSnap = await getDoc(ownedPacksDocRef);
        const rawOwnedPacks = ownedPacksDocSnap.exists() ? (ownedPacksDocSnap.data()?.names || []) as string[] : [];
        setOwnedPacks(rawOwnedPacks); // This will normalize and handle special packs
        lastKnownOwnedPacksRef.current = JSON.stringify([...new Set(rawOwnedPacks)].sort());
      } catch (error) {
         toast({ title: "Error Loading Packs", description: (error as Error).message, variant: "destructive" });
      } finally {
        setIsUpdating(false);
      }
    };
    fetchOwnedPacks();
  }, [currentUser, activeAccountId, toast, setOwnedPacks]);

  // Save owned packs when they change
  useEffect(() => {
    const currentOwnedPacksString = JSON.stringify(ownedPacks.sort());
    if (isLoading || !currentUser || !activeAccountId || currentOwnedPacksString === lastKnownOwnedPacksRef.current) return;
    
    const handler = setTimeout(async () => {
      const freshestCurrentUser = auth.currentUser;
      if (!freshestCurrentUser || freshestCurrentUser.uid !== currentUser.uid) return;
      
      setIsUpdating(true);
      try {
        const ownedPacksDocRef = doc(db, USER_CONFIGURATION_COLLECTION, freshestCurrentUser.uid, OWNED_PACKS_SUBCOLLECTION, activeAccountId);
        await setDoc(ownedPacksDocRef, { names: ownedPacks }, { merge: true });
        lastKnownOwnedPacksRef.current = currentOwnedPacksString;
        toast({ title: "Adventure Packs Saved", description: "Your owned packs for this account have been saved."});
      } catch (error) {
        toast({ title: "Error Saving Owned Packs", description: (error as Error).message, variant: "destructive" });
      } finally {
        setIsUpdating(false);
      }
    }, 1500);
    return () => clearTimeout(handler);
  }, [ownedPacks, currentUser, isLoading, activeAccountId, toast]);

  const addAccount = async (accountData: Omit<Account, 'id' | 'userId'>): Promise<Account | undefined> => {
    if (!currentUser) { toast({ title: "Not Authenticated", variant: "destructive" }); return undefined; }
    setIsUpdating(true);
    try {
      const newId = doc(collection(db, ACCOUNTS_COLLECTION)).id;
      const newAccount: Account = { ...accountData, id: newId, userId: currentUser.uid };
      await setDoc(doc(db, ACCOUNTS_COLLECTION, newId), newAccount);
      setAccounts(prev => [...prev, newAccount]);
      toast({ title: "Account Added", description: `${newAccount.name} created.` });
      return newAccount;
    } catch (error) { toast({ title: "Error Adding Account", description: (error as Error).message, variant: 'destructive' }); return undefined; }
    finally { setIsUpdating(false); }
  };

  const updateAccount = async (account: Account): Promise<void> => {
     if (!currentUser || account.userId !== currentUser.uid) {
      toast({ title: "Unauthorized", variant: "destructive" });
      return;
    }
    if (account.name === 'Default') {
      toast({ title: "Invalid Action", description: "The Default account cannot be renamed.", variant: 'default' });
      return;
    }
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, ACCOUNTS_COLLECTION, account.id), { name: account.name });
      setAccounts(prev => prev.map(acc => acc.id === account.id ? account : acc));
      toast({ title: "Account Updated", description: `Account renamed to ${account.name}.` });
    } catch(error) {
       toast({ title: "Error Updating Account", description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const deleteAccount = async (accountToDelete: Account): Promise<void> => {
    if (!currentUser || accountToDelete.userId !== currentUser.uid || accountToDelete.name === 'Default') {
      toast({ title: "Unauthorized or Invalid Action", description: "You cannot delete this account.", variant: "destructive" }); return;
    }
    setIsUpdating(true);
    try {
      const batch = writeBatch(db);
      
      // Delete the account document
      const accountRef = doc(db, ACCOUNTS_COLLECTION, accountToDelete.id);
      batch.delete(accountRef);

      // Move characters to the default account
      const defaultAccount = accounts.find(acc => acc.name === 'Default');
      if (!defaultAccount) throw new Error("Could not find a Default account to move characters to.");

      const charsToMove = characters.filter(c => c.accountId === accountToDelete.id);
      if (charsToMove.length > 0) {
        charsToMove.forEach(char => {
          const charRef = doc(db, CHARACTERS_COLLECTION, char.id);
          batch.update(charRef, { accountId: defaultAccount.id });
        });
      }

      await batch.commit();

      // Optimistic UI updates
      setAccounts(prev => prev.filter(c => c.id !== accountToDelete.id));
      setCharacters(prev => prev.map(c => c.accountId === accountToDelete.id ? {...c, accountId: defaultAccount.id} : c));

      if (activeAccountId === accountToDelete.id) {
        setActiveAccountId(defaultAccount.id);
      }
      
      toast({ title: "Account Deleted", description: `The account "${accountToDelete.name}" was deleted. Its characters were moved to "Default".`, variant: "destructive" });
    } catch (error) { toast({ title: "Error Deleting Account", description: (error as Error).message, variant: 'destructive' }); }
    finally { setIsUpdating(false); }
  }


  const addCharacter = async (characterData: Omit<Character, 'id' | 'userId' | 'iconUrl' | 'preferences'> & { iconUrl?: string | null }): Promise<Character | undefined> => {
    if (!currentUser) { toast({ title: "Not Authenticated", variant: "destructive" }); return undefined; }
    setIsUpdating(true);
    try {
      const newId = doc(collection(db, CHARACTERS_COLLECTION)).id;
      const newCharacter: Character = { ...characterData, id: newId, userId: currentUser.uid, iconUrl: characterData.iconUrl || null, preferences: {} };
      await setDoc(doc(db, CHARACTERS_COLLECTION, newId), newCharacter);
      setCharacters(prev => [...prev, newCharacter]);
      toast({ title: "Character Added", description: `${newCharacter.name} created.` });
      return newCharacter;
    } catch (error) { toast({ title: "Error Adding Character", description: (error as Error).message, variant: 'destructive' }); return undefined; }
    finally { setIsUpdating(false); }
  };

  const updateCharacter = useCallback(async (character: Character): Promise<void> => {
    if (!currentUser || character.userId !== currentUser.uid) {
      toast({ title: "Unauthorized", variant: "destructive" });
      return;
    }
    setCharacters(prev => prev.map(c => c.id === character.id ? character : c));
    if (characterUpdateDebounceTimers.current.has(character.id)) {
      clearTimeout(characterUpdateDebounceTimers.current.get(character.id));
    }
  
    const timer = setTimeout(async () => {
      setIsUpdating(true);
      try {
        const charRef = doc(db, CHARACTERS_COLLECTION, character.id);
        const updatePayload = {
          name: character.name,
          level: character.level,
          iconUrl: character.iconUrl === undefined ? null : character.iconUrl,
          preferences: character.preferences || {},
          accountId: character.accountId,
        };
        await updateDoc(charRef, updatePayload);
        toast({ title: "Character Updated", description: `${character.name}'s details saved.` });
      } catch (error) {
        toast({ title: "Error Updating Character", description: (error as Error).message, variant: 'destructive' });
      } finally {
        setIsUpdating(false);
        characterUpdateDebounceTimers.current.delete(character.id);
      }
    }, 1500);
    characterUpdateDebounceTimers.current.set(character.id, timer);
  }, [currentUser, toast]);
  
  const deleteCharacter = async (characterId: string): Promise<void> => {
    const characterToDelete = characters.find(c => c.id === characterId);
    if (!currentUser || !characterToDelete || characterToDelete.userId !== currentUser.uid) {
      toast({ title: "Unauthorized", variant: "destructive" }); return;
    }
    setIsUpdating(true);
    try {
      await deleteDoc(doc(db, CHARACTERS_COLLECTION, characterId));
      setCharacters(prev => prev.filter(c => c.id !== characterId));
      
      const completionsPath = `${CHARACTERS_COLLECTION}/${characterId}/${QUEST_COMPLETIONS_SUBCOLLECTION}`;
      const completionsSnapshot = await getDocs(collection(db, completionsPath));
      let currentBatch = writeBatch(db); let operationCount = 0;
      completionsSnapshot.docs.forEach(docSnap => {
        currentBatch.delete(docSnap.ref); operationCount++;
        if(operationCount >= BATCH_OPERATION_LIMIT) { currentBatch.commit(); currentBatch = writeBatch(db); operationCount = 0; }
      });
      if (operationCount > 0) await currentBatch.commit();

      if (activeCharacterId === characterId) { setActiveCharacterIdState(null); setActiveCharacterQuestCompletions(new Map()); }
      toast({ title: "Character Deleted", description: `${characterToDelete.name} and their quest completions deleted.`, variant: "destructive" });
    } catch (error) { toast({ title: "Error Deleting Character", description: (error as Error).message, variant: 'destructive' }); }
    finally { setIsUpdating(false); }
  };
  
  const batchUpdateUserQuestCompletions = useCallback(async (characterIdForUpdate: string, updates: QuestCompletionUpdate[]): Promise<void> => {
    if (!currentUser) { toast({ title: "Not Authenticated", variant: "destructive" }); return; }
    const characterDoc = characters.find(c => c.id === characterIdForUpdate);
    if (!characterDoc || characterDoc.userId !== currentUser.uid) { toast({ title: "Unauthorized", variant: "destructive" }); return; }
    setIsUpdating(true);
    try {
      let currentBatch = writeBatch(db); let operationCount = 0;
      const commitBatchIfNeeded = async () => { if (operationCount >= BATCH_OPERATION_LIMIT) { await currentBatch.commit(); currentBatch = writeBatch(db); operationCount = 0; } };

      const updatedCompletionsMap = activeCharacterId === characterIdForUpdate ? new Map(activeCharacterQuestCompletions) : new Map();
      let changesMade = 0;
      for (const update of updates) {
        await commitBatchIfNeeded(); const { questId, ...completionData } = update;
        if (Object.keys(completionData).length > 0) {
            const questRef = doc(db, CHARACTERS_COLLECTION, characterIdForUpdate, QUEST_COMPLETIONS_SUBCOLLECTION, questId);
            const payloadWithTimestamp = {...completionData, lastUpdatedAt: serverTimestamp() as FieldValue };
            currentBatch.set(questRef, payloadWithTimestamp, { merge: true });
            operationCount++;
            if (activeCharacterId === characterIdForUpdate) {
              const existingEntry = updatedCompletionsMap.get(questId) || { questId };
              updatedCompletionsMap.set(questId, { ...existingEntry, ...payloadWithTimestamp, lastUpdatedAt: undefined } as UserQuestCompletionData);
            }
            changesMade++;
        }
      }
      if (operationCount > 0) await currentBatch.commit();
      if (changesMade > 0) {
        if (activeCharacterId === characterIdForUpdate) setActiveCharacterQuestCompletions(updatedCompletionsMap);
        toast({ title: "Quest Completions Updated", description: `${changesMade} quest(s) updated from CSV.`});
      } else { toast({ title: "No Updates", description: "No quest completions were changed by CSV." }); }
    } catch (error) { toast({ title: "Error Updating from CSV", description: (error as Error).message, variant: "destructive" }); throw error; }
    finally { setIsUpdating(false); }
  }, [currentUser, characters, activeCharacterId, activeCharacterQuestCompletions, toast]);

   const batchResetUserQuestCompletions = useCallback(async (characterIdForReset: string, questIdsToReset: string[]): Promise<void> => {
    if (!currentUser) { toast({ title: "Not Authenticated", variant: "destructive" }); return; }
    const characterDoc = characters.find(c => c.id === characterIdForReset);
    if (!characterDoc || characterDoc.userId !== currentUser.uid) { toast({ title: "Unauthorized", variant: "destructive" }); return; }
    setIsUpdating(true);
    try {
      let currentBatch = writeBatch(db);
      let operationCount = 0;
      const commitBatchIfNeeded = async () => { if (operationCount >= BATCH_OPERATION_LIMIT) { await currentBatch.commit(); currentBatch = writeBatch(db); operationCount = 0; } };

      const updatedCompletionsMap = activeCharacterId === characterIdForReset ? new Map(activeCharacterQuestCompletions) : new Map();
      let changesMade = false;

      for (const questId of questIdsToReset) {
        await commitBatchIfNeeded();
        const quest = quests.find(q => q.id === questId); if (!quest) continue;
        const completionDocRef = doc(db, CHARACTERS_COLLECTION, characterIdForReset, QUEST_COMPLETIONS_SUBCOLLECTION, questId);
        const payload: Partial<UserQuestCompletionData> = { lastUpdatedAt: serverTimestamp() as FieldValue };
        let questChanged = false;
        const currentCompletion = activeCharacterId === characterIdForReset ? updatedCompletionsMap.get(questId) : undefined;
        if (!quest.casualNotAvailable && currentCompletion?.casualCompleted) { payload.casualCompleted = false; questChanged = true; }
        if (!quest.normalNotAvailable && currentCompletion?.normalCompleted) { payload.normalCompleted = false; questChanged = true; }
        if (!quest.hardNotAvailable && currentCompletion?.hardCompleted) { payload.hardCompleted = false; questChanged = true; }
        if (!quest.eliteNotAvailable && currentCompletion?.eliteCompleted) { payload.eliteCompleted = false; questChanged = true; }
        if (questChanged) {
          currentBatch.set(completionDocRef, payload, { merge: true });
          operationCount++;
          if (activeCharacterId === characterIdForReset) {
            updatedCompletionsMap.set(questId, { ...(currentCompletion || { questId }), ...payload, lastUpdatedAt: undefined } as UserQuestCompletionData);
          }
          changesMade = true;
        }
      }
      if (operationCount > 0) await currentBatch.commit();
      if (changesMade) { if (activeCharacterId === characterIdForReset) setActiveCharacterQuestCompletions(updatedCompletionsMap); toast({ title: "Quest Completions Reset" });
      } else { toast({ title: "No Changes", description: "No quest completions needed resetting." }); }
    } catch (error) { toast({ title: "Error Resetting Completions", description: (error as Error).message, variant: "destructive" }); throw error; }
    finally { setIsUpdating(false); }
  }, [currentUser, characters, activeCharacterId, activeCharacterQuestCompletions, toast]);
  
  // These are now for the admin page to generate code, not for direct DB manipulation from context
  const updateQuestDefinition = async (quest: Quest): Promise<void> => { console.warn("updateQuestDefinition is a dev-only method now"); };
  const deleteQuestDefinition = async (questId: string): Promise<void> => { console.warn("deleteQuestDefinition is a dev-only method now"); };

  return (
    <AppDataContext.Provider value={{
      accounts, setAccounts, addAccount, updateAccount, deleteAccount, activeAccountId, setActiveAccountId,
      characters, addCharacter, updateCharacter, deleteCharacter,
      adventurePacks,
      quests,
      updateQuestDefinition, deleteQuestDefinition,
      fetchQuestCompletionsForCharacter,
      batchUpdateUserQuestCompletions, batchResetUserQuestCompletions,
      activeCharacterId, activeCharacterQuestCompletions,
      ownedPacks, setOwnedPacks,
      isDataLoaded,
      isLoading,
      isUpdating,
    }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
}
