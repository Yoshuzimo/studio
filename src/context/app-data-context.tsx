
// src/context/app-data-context.tsx
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Character, AdventurePack, Quest, UserQuestCompletionData } from '@/types';
import { db, auth } from '@/lib/firebase';
import {
  collection, getDocs, doc, writeBatch, setDoc, deleteDoc, query,
  getDoc, where, type Timestamp as FirestoreTimestampType, serverTimestamp, type FieldValue,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './auth-context';
import { ADVENTURE_PACKS_DATA } from '@/data/adventure-packs';

export interface QuestCompletionUpdate {
  questId: string;
  casualCompleted?: boolean;
  normalCompleted?: boolean;
  hardCompleted?: boolean;
  eliteCompleted?: boolean;
}

interface AppDataContextType {
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  addCharacter: (characterData: Omit<Character, 'id' | 'userId' | 'iconUrl'> & { iconUrl?: string }) => Promise<Character | undefined>;
  updateCharacter: (character: Character) => Promise<void>;
  deleteCharacter: (characterId: string) => Promise<void>;

  adventurePacks: AdventurePack[];
  
  quests: Quest[];
  setQuests: (quests: Quest[]) => Promise<void>;
  updateQuestDefinition: (quest: Quest) => Promise<void>;
  deleteQuestDefinition: (questId: string) => Promise<void>;

  fetchQuestCompletionsForCharacter: (characterId: string) => Promise<void>;
  updateUserQuestCompletion: (characterId: string, questId: string, difficultyKey: keyof Pick<UserQuestCompletionData, 'casualCompleted' | 'normalCompleted' | 'hardCompleted' | 'eliteCompleted'>, isCompleted: boolean) => Promise<void>;
  batchResetUserQuestCompletions: (characterId: string, questIds: string[]) => Promise<void>;
  batchUpdateUserQuestCompletions: (characterId: string, updates: QuestCompletionUpdate[]) => Promise<void>;
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
const QUEST_COMPLETIONS_SUBCOLLECTION = 'questCompletions';
const FREE_TO_PLAY_PACK_NAME_LOWERCASE = "free to play";

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

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { currentUser, userData, isLoading: authIsLoading } = useAuth();
  const [characters, setCharactersState] = useState<Character[]>([]);
  const [quests, setQuestsState] = useState<Quest[]>([]);
  const [ownedPacks, setOwnedPacksInternal] = useState<string[]>([]);

  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const [activeCharacterQuestCompletions, setActiveCharacterQuestCompletions] = useState<Map<string, UserQuestCompletionData>>(new Map());

  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const { toast } = useToast();
  const initialDataLoadedForUserRef = useRef<string | null>(null);
  const lastKnownOwnedPacksRef = useRef<string | null>(null);

  console.log('[AppDataProvider] Render. Auth isLoading:', authIsLoading, 'AppData isLoading:', isLoading, 'AppData isUpdating:', isUpdating, 'Current user UID:', currentUser?.uid, 'Active Char ID:', activeCharacterId);

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

      const freeToPlayMaster = adventurePacks.find(p => normalizeAdventurePackNameForStorage(p.name)?.toLowerCase() === FREE_TO_PLAY_PACK_NAME_LOWERCASE);
      if (freeToPlayMaster && freeToPlayMaster.name) {
          const isFtpAlreadyInFinal = finalPacks.some(opName => normalizeAdventurePackNameForStorage(opName)?.toLowerCase() === FREE_TO_PLAY_PACK_NAME_LOWERCASE);
          if (!isFtpAlreadyInFinal) {
              finalPacks.push(freeToPlayMaster.name);
          }
      }
      return [...new Set(finalPacks)];
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    console.log('[AppDataProvider] Main data loading useEffect triggered. authIsLoading:', authIsLoading, 'currentUser?.uid:', currentUser?.uid);

    if (authIsLoading) {
      console.log('[AppDataProvider] Auth is still loading, AppData will wait.');
      setIsLoading(true);
      return;
    }

    console.log('[AppDataProvider] Auth resolved. Current user UID:', currentUser?.uid);
    setIsLoading(true);
    setIsUpdating(false);
    setIsDataLoaded(false);
    console.log('[AppDataProvider] loadAllData: Set AppData isLoading true, isDataLoaded false.');

    const loadAllData = async () => {
      console.log('[AppDataProvider] loadAllData async function started. Current user UID:', currentUser?.uid);

      if (currentUser && initialDataLoadedForUserRef.current !== currentUser.uid) {
          console.log('[AppDataProvider] New login or user switch detected.');
          React.startTransition(() => {
            setCharactersState([]);
            setOwnedPacksInternal([]);
            setActiveCharacterId(null);
            setActiveCharacterQuestCompletions(new Map());
          });
          console.log('[AppDataProvider] User-specific states reset for new login/user switch.');
      } else if (!currentUser && initialDataLoadedForUserRef.current !== null) {
          console.log('[AppDataProvider] User logged out. Resetting user-specific states and clearing initialDataLoadedForUserRef.');
           React.startTransition(() => {
            setCharactersState([]);
            setOwnedPacksInternal([]);
            setActiveCharacterId(null);
            setActiveCharacterQuestCompletions(new Map());
          });
          initialDataLoadedForUserRef.current = null;
      }
      
      try {
        const questSnapshot = await getDocs(collection(db, 'quests'));
        if (!isMounted) { console.log('[AppDataProvider] Unmounted during quest fetch.'); return; }
        const loadedQuests = questSnapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
        } as Quest)).map(q => ({
            ...q,
            adventurePackName: normalizeAdventurePackNameForStorage(q.adventurePackName)
        }));
        setQuestsState(loadedQuests);
        console.log(`[AppDataProvider] Loaded ${loadedQuests.length} quests from Firestore.`);
      } catch (error) {
        if (!isMounted) return;
        console.error("[AppDataProvider] Failed to load quests:", error);
        toast({ title: "Quest Load Error", description: (error as Error).message, variant: 'destructive' });
        setQuestsState([]);
      }

      let finalUserOwnedPacks: string[] = [];
      if (currentUser) {
        console.log('[AppDataProvider] CurrentUser exists, fetching user-specific data (characters, ownedPacks) for UID:', currentUser.uid);
        try {
          const charQuery = query(collection(db, 'characters'), where('userId', '==', currentUser.uid));
          const charSnapshot = await getDocs(charQuery);
          if (!isMounted) { console.log('[AppDataProvider] Unmounted during character fetch.'); return; }
          const loadedChars = charSnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              userId: data.userId,
              name: data.name,
              level: data.level,
              iconUrl: data.iconUrl || null,
            } as Character;
          });

          React.startTransition(() => {
            setCharactersState(loadedChars);
          });
          console.log('[AppDataProvider] Characters set in state:', loadedChars.length);

          const ownedPacksDocRef = doc(db, USER_CONFIGURATION_COLLECTION, currentUser.uid, OWNED_PACKS_SUBCOLLECTION, 'data');
          const ownedPacksDocSnap = await getDoc(ownedPacksDocRef);
          if (!isMounted) { console.log('[AppDataProvider] Unmounted during ownedPacks fetch.'); return; }

          const rawOwnedPacks = ownedPacksDocSnap.exists() ? (ownedPacksDocSnap.data()?.names || []) as string[] : [];
          finalUserOwnedPacks = rawOwnedPacks
            .map(name => normalizeAdventurePackNameForStorage(name))
            .filter((name): name is string => name !== null);
          console.log('[AppDataProvider] Fetched and normalized user-specific ownedPacks from Firestore:', finalUserOwnedPacks);

        } catch (error) {
          if (!isMounted) return;
          console.error("[AppDataProvider] Failed to load user-specific data:", error);
          toast({ title: "User Data Load Error", description: (error as Error).message, variant: 'destructive' });
          React.startTransition(() => {
            setCharactersState([]);
          });
          finalUserOwnedPacks = [];
        }
      } else {
        console.log('[AppDataProvider] No currentUser, user-specific states remain empty (or were reset).');
        if (isMounted) {
          React.startTransition(() => {
            setCharactersState([]);
          });
          finalUserOwnedPacks = [];
        }
      }

      let packsToSetInState = [...new Set(finalUserOwnedPacks)];

      if (SHADOWFELL_CONSPIRACY_PARENT_NORMALIZED && packsToSetInState.some(p => p.toLowerCase() === SHADOWFELL_CONSPIRACY_PARENT_NORMALIZED.toLowerCase())) {
        SHADOWFELL_CONSPIRACY_CHILDREN_NORMALIZED.forEach(childPackName => {
          if (!packsToSetInState.some(p => p.toLowerCase() === childPackName.toLowerCase())) {
            packsToSetInState.push(childPackName);
          }
        });
      }

      const freeToPlayMasterInstance = adventurePacks.find(p => normalizeAdventurePackNameForStorage(p.name)?.toLowerCase() === FREE_TO_PLAY_PACK_NAME_LOWERCASE);
      if (freeToPlayMasterInstance && freeToPlayMasterInstance.name) {
          const isFtpAlreadyInFinal = packsToSetInState.some(opName => normalizeAdventurePackNameForStorage(opName)?.toLowerCase() === FREE_TO_PLAY_PACK_NAME_LOWERCASE);
          if (!isFtpAlreadyInFinal) {
              packsToSetInState = [...packsToSetInState, freeToPlayMasterInstance.name];
              console.log('[AppDataProvider] Added "Free to play" to packsToSetInState on load.');
          }
      }

      if (isMounted) {
        React.startTransition(() => {
          setOwnedPacksInternal([...new Set(packsToSetInState)]);
        });
        lastKnownOwnedPacksRef.current = JSON.stringify([...new Set(packsToSetInState)].sort());
        console.log('[AppDataProvider] OwnedPacks set in state on load, lastKnownOwnedPacksRef updated with:', packsToSetInState);
        if (currentUser) initialDataLoadedForUserRef.current = currentUser.uid; else initialDataLoadedForUserRef.current = null;
        setIsDataLoaded(true);
        setIsLoading(false);
        console.log('[AppDataProvider] loadAllData finished. setIsLoading(false), setIsDataLoaded(true).');
      }
    };

    loadAllData();

    return () => {
      isMounted = false;
      console.log('[AppDataProvider] Main data loading useEffect unmounted.');
    };
  }, [currentUser?.uid, authIsLoading, toast, setOwnedPacks]);

  useEffect(() => {
    const currentOwnedPacksString = JSON.stringify(ownedPacks.sort());
    if (
      authIsLoading ||
      !currentUser ||
      !isDataLoaded ||
      initialDataLoadedForUserRef.current !== currentUser.uid ||
      currentOwnedPacksString === lastKnownOwnedPacksRef.current
    ) {
        console.log('[AppDataProvider] ownedPacks save effect: Skipping save. Guard conditions:', {
            authIsLoading,
            hasCurrentUser: !!currentUser,
            isDataLoaded,
            initialLoadMatchesUser: initialDataLoadedForUserRef.current === currentUser?.uid,
            contentChanged: currentOwnedPacksString !== lastKnownOwnedPacksRef.current
        });
      return;
    }
    console.log('[AppDataProvider] ownedPacks save effect triggered. currentUser:', currentUser.uid, 'isDataLoaded:', isDataLoaded, 'initialDataLoadedForUserRef:', initialDataLoadedForUserRef.current, 'lastKnown:', lastKnownOwnedPacksRef.current, 'current:', currentOwnedPacksString);
    const handler = setTimeout(async () => {
      const freshestCurrentUser = auth.currentUser;
      if (!freshestCurrentUser || freshestCurrentUser.uid !== currentUser.uid) {
        console.warn('[AppDataProvider] User changed during ownedPacks save timeout. Aborting save.');
        return;
      }
      setIsUpdating(true);
      console.log('[AppDataProvider] ownedPacks save: isUpdating set to true.');
      try {
        const packsToSave = ownedPacks.filter(pName => normalizeAdventurePackNameForStorage(pName)?.toLowerCase() !== FREE_TO_PLAY_PACK_NAME_LOWERCASE);
        const ownedPacksDocRef = doc(db, USER_CONFIGURATION_COLLECTION, freshestCurrentUser.uid, OWNED_PACKS_SUBCOLLECTION, 'data');
        console.log('[AppDataProvider] Saving owned packs to Firestore:', packsToSave, 'for UID:', freshestCurrentUser.uid);
        await setDoc(ownedPacksDocRef, { names: packsToSave }, { merge: true });
        lastKnownOwnedPacksRef.current = currentOwnedPacksString;
        console.log('[AppDataProvider] Owned packs saved successfully. lastKnownOwnedPacksRef updated.');
      } catch (error) {
        console.error('[AppDataProvider] Error saving owned packs:', error);
        toast({ title: "Error Saving Owned Packs", description: (error as Error).message, variant: 'destructive' });
      } finally {
        setIsUpdating(false);
        console.log('[AppDataProvider] ownedPacks save: isUpdating set to false.');
      }
    }, 1500);
    return () => clearTimeout(handler);
  }, [ownedPacks, currentUser?.uid, authIsLoading, isDataLoaded, toast]);

  const addCharacter = async (characterData: Omit<Character, 'id' | 'userId' | 'iconUrl'> & { iconUrl?: string }): Promise<Character | undefined> => {
    if (!currentUser) { toast({ title: "Not Authenticated", variant: "destructive" }); return undefined; }
    setIsUpdating(true);
    console.log('[AppDataProvider] addCharacter: isUpdating set to true.');
    try {
      const newId = doc(collection(db, 'characters')).id;
      const newCharacter: Character = { ...characterData, id: newId, userId: currentUser.uid, iconUrl: characterData.iconUrl || null };
      await setDoc(doc(db, 'characters', newId), newCharacter);
      React.startTransition(() => {
        setCharactersState(prev => [...prev, newCharacter]);
      });
      toast({ title: "Character Added", description: `${newCharacter.name} created.` });
      return newCharacter;
    } catch (error) { toast({ title: "Error Adding Character", description: (error as Error).message, variant: 'destructive' }); return undefined; }
    finally { setIsUpdating(false); console.log('[AppDataProvider] addCharacter: isUpdating set to false.');}
  };

  const updateCharacter = async (character: Character): Promise<void> => {
    if (!currentUser || character.userId !== currentUser.uid) { toast({ title: "Unauthorized", variant: "destructive" }); return; }
    setIsUpdating(true);
    console.log('[AppDataProvider] updateCharacter: isUpdating set to true.');
    try {
      await setDoc(doc(db, 'characters', character.id), character, { merge: true });
      React.startTransition(() => {
        setCharactersState(prev => prev.map(c => c.id === character.id ? character : c));
      });
      toast({ title: "Character Updated", description: `${character.name}'s details saved.`});
    } catch (error) { toast({ title: "Error Updating Character", description: (error as Error).message, variant: 'destructive' }); }
    finally { setIsUpdating(false); console.log('[AppDataProvider] updateCharacter: isUpdating set to false.');}
  };

  const deleteCharacter = async (characterId: string): Promise<void> => {
    const characterToDelete = characters.find(c => c.id === characterId);
    if (!currentUser || !characterToDelete || characterToDelete.userId !== currentUser.uid) {
      toast({ title: "Unauthorized", variant: "destructive" }); return;
    }
    setIsUpdating(true);
    console.log('[AppDataProvider] deleteCharacter: isUpdating set to true.');
    try {
      await deleteDoc(doc(db, 'characters', characterId));
      React.startTransition(() => {
        setCharactersState(prev => prev.filter(c => c.id !== characterId));
      });

      const completionsSubcollectionRef = collection(db, CHARACTERS_COLLECTION, characterId, QUEST_COMPLETIONS_SUBCOLLECTION);
      const completionsSnapshot = await getDocs(completionsSubcollectionRef);
      let currentBatch = writeBatch(db);
      let operationCount = 0;
      completionsSnapshot.docs.forEach(docSnap => {
        currentBatch.delete(docSnap.ref);
        operationCount++;
        if(operationCount >= BATCH_OPERATION_LIMIT) {
            currentBatch.commit();
            currentBatch = writeBatch(db);
            operationCount = 0;
        }
      });
      if (operationCount > 0) await currentBatch.commit();

      if (activeCharacterId === characterId) {
        React.startTransition(() => {
          setActiveCharacterId(null);
          setActiveCharacterQuestCompletions(new Map());
        });
      }
      toast({ title: "Character Deleted", description: `${characterToDelete.name} and their quest completions deleted.`, variant: "destructive" });
    } catch (error) { toast({ title: "Error Deleting Character", description: (error as Error).message, variant: 'destructive' }); }
    finally { setIsUpdating(false); console.log('[AppDataProvider] deleteCharacter: isUpdating set to false.');}
  };
  
  const setQuests = useCallback(async (newQuests: Quest[]) => {
    setIsUpdating(true);
    console.log('[AppDataProvider] setQuests: Starting Firestore update for master quest list.');
    try {
      const questsCollectionRef = collection(db, 'quests');
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
      if (deleteCount > 0) {
        await deleteBatch.commit();
        console.log(`[AppDataProvider] Deleted ${deleteCount} old quests.`);
      }

      let addBatch = writeBatch(db);
      let addCount = 0;
      newQuests.forEach(quest => {
        const questDocRef = doc(questsCollectionRef, quest.id || doc(collection(db, 'temp')).id);
        addBatch.set(questDocRef, { ...quest, id: questDocRef.id });
        addCount++;
        if (addCount % BATCH_OPERATION_LIMIT === 0) {
          addBatch.commit();
          addBatch = writeBatch(db);
        }
      });
      if (addCount > 0) {
        await addBatch.commit();
        console.log(`[AppDataProvider] Added ${addCount} new quests.`);
      }

      React.startTransition(() => {
        setQuestsState(newQuests);
      });
      toast({ title: 'Quests Updated', description: `Successfully updated ${newQuests.length} quests in the database.` });

    } catch (error) {
      console.error("Error setting quests in Firestore:", error);
      toast({ title: "Quest Update Failed", description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
      console.log('[AppDataProvider] setQuests: Finished Firestore update.');
    }
  }, [toast]);

  const updateQuestDefinition = useCallback(async (quest: Quest) => {
    setIsUpdating(true);
    try {
      const questDocRef = doc(db, 'quests', quest.id);
      await setDoc(questDocRef, quest, { merge: true });
      React.startTransition(() => {
        setQuestsState(prev => prev.map(q => q.id === quest.id ? quest : q));
      });
      toast({ title: 'Quest Updated', description: `${quest.name} has been saved.` });
    } catch (error) {
      console.error("Error updating quest:", error);
      toast({ title: "Update Failed", description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  }, [toast]);

  const deleteQuestDefinition = useCallback(async (questId: string) => {
    setIsUpdating(true);
    try {
      await deleteDoc(doc(db, 'quests', questId));
      React.startTransition(() => {
        setQuestsState(prev => prev.filter(q => q.id !== questId));
      });
      toast({ title: 'Quest Deleted', description: 'The quest has been removed from the database.' });
    } catch (error) {
      console.error("Error deleting quest:", error);
      toast({ title: "Delete Failed", description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  }, [toast]);

  const fetchQuestCompletionsForCharacter = useCallback(async (characterIdToFetch: string) => {
    if (!currentUser) {
      console.log('[AppDataProvider] fetchQuestCompletions: No current user, clearing active completions.');
      React.startTransition(() => {
        setActiveCharacterId(null);
        setActiveCharacterQuestCompletions(new Map());
      });
      return;
    }
    console.log('[AppDataProvider] fetchQuestCompletions: Fetching for character', characterIdToFetch);
    setIsLoading(true);
    try {
      const completionsPath = `${CHARACTERS_COLLECTION}/${characterIdToFetch}/${QUEST_COMPLETIONS_SUBCOLLECTION}`;
      const completionsQuery = query(collection(db, completionsPath));
      const snapshot = await getDocs(completionsQuery);
      const newCompletions = new Map<string, UserQuestCompletionData>();
      snapshot.docs.forEach(docSnap => {
        newCompletions.set(docSnap.id, { ...docSnap.data() } as UserQuestCompletionData);
      });
      React.startTransition(() => {
        setActiveCharacterQuestCompletions(newCompletions);
        setActiveCharacterId(characterIdToFetch);
      });
      console.log(`[AppDataProvider] Loaded ${newCompletions.size} completions for char ${characterIdToFetch}`);
    } catch (error) {
      console.error("[AppDataProvider] Error loading quest completions:", error);
      toast({ title: "Error Loading Quest Completions", description: (error as Error).message, variant: 'destructive' });
      React.startTransition(() => {
        setActiveCharacterQuestCompletions(new Map());
        setActiveCharacterId(null);
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast]);


  const updateUserQuestCompletion = useCallback(async (
    characterIdForUpdate: string,
    questId: string,
    difficultyKey: keyof Pick<UserQuestCompletionData, 'casualCompleted' | 'normalCompleted' | 'hardCompleted' | 'eliteCompleted'>,
    isCompleted: boolean
  ) => {
    if (!currentUser) {
      toast({ title: "Not Authenticated", variant: "destructive" });
      return;
    }
    const characterDoc = characters.find(c => c.id === characterIdForUpdate);
    if (!characterDoc || characterDoc.userId !== currentUser.uid) {
      toast({ title: "Unauthorized", description: "Cannot update completions for this character.", variant: "destructive" });
      return;
    }
    setIsUpdating(true);
    console.log('[AppDataProvider] updateUserQuestCompletion: isUpdating set to true.');
    try {
      const completionDocRef = doc(db, CHARACTERS_COLLECTION, characterIdForUpdate, QUEST_COMPLETIONS_SUBCOLLECTION, questId);
      const updatePayload: Partial<UserQuestCompletionData> = {
        [difficultyKey]: isCompleted,
        lastUpdatedAt: serverTimestamp() as FieldValue,
      };

      await setDoc(completionDocRef, updatePayload, { merge: true });

      if (characterIdForUpdate === activeCharacterId) {
        React.startTransition(() => {
          setActiveCharacterQuestCompletions(prevMap => {
            const newMap = new Map(prevMap);
            const existingEntry = newMap.get(questId) || { questId };
            newMap.set(questId, { ...existingEntry, ...updatePayload, lastUpdatedAt: undefined } as UserQuestCompletionData); // lastUpdatedAt set to undefined for local state
            return newMap;
          });
        });
      }
    } catch (error) {
      toast({ title: "Error Updating Quest Completion", description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
      console.log('[AppDataProvider] updateUserQuestCompletion: isUpdating set to false.');
    }
  }, [currentUser, characters, activeCharacterId, toast]);

  const batchResetUserQuestCompletions = useCallback(async (characterIdForReset: string, questIdsToReset: string[]): Promise<void> => {
    if (!currentUser) { toast({ title: "Not Authenticated", variant: "destructive" }); return; }
    const characterDoc = characters.find(c => c.id === characterIdForReset);
    if (!characterDoc || characterDoc.userId !== currentUser.uid) { toast({ title: "Unauthorized", variant: "destructive" }); return; }
    setIsUpdating(true);
    console.log('[AppDataProvider] batchResetUserQuestCompletions: isUpdating set to true.');
    try {
      let currentBatch = writeBatch(db);
      let operationCount = 0;
      const commitBatchIfNeeded = async () => {
        if (operationCount >= BATCH_OPERATION_LIMIT) {
            await currentBatch.commit();
            currentBatch = writeBatch(db);
            operationCount = 0;
        }
      };

      const updatedCompletionsMap = activeCharacterId === characterIdForReset ? new Map(activeCharacterQuestCompletions) : new Map();
      let changesMade = false;

      for (const questId of questIdsToReset) {
        await commitBatchIfNeeded();
        const quest = quests.find(q => q.id === questId);
        if (!quest) continue;

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
            updatedCompletionsMap.set(questId, {
             ...(currentCompletion || { questId }),
             ...payload,
             lastUpdatedAt: undefined // For local state consistency
            } as UserQuestCompletionData);
          }
          changesMade = true;
        }
      }

      if (operationCount > 0) await currentBatch.commit();

      if (changesMade) {
        if (activeCharacterId === characterIdForReset) {
          React.startTransition(() => {
            setActiveCharacterQuestCompletions(updatedCompletionsMap);
          });
        }
        toast({ title: "Quest Completions Reset" });
      } else { toast({ title: "No Changes", description: "No quest completions needed resetting." }); }
    } catch (error) { toast({ title: "Error Resetting Completions", description: (error as Error).message, variant: "destructive" }); throw error; }
    finally { setIsUpdating(false); console.log('[AppDataProvider] batchResetUserQuestCompletions: isUpdating set to false.'); }
  }, [currentUser, characters, quests, activeCharacterId, activeCharacterQuestCompletions, toast]);

  const batchUpdateUserQuestCompletions = useCallback(async (characterIdForUpdate: string, updates: QuestCompletionUpdate[]): Promise<void> => {
    if (!currentUser) { toast({ title: "Not Authenticated", variant: "destructive" }); return; }
    const characterDoc = characters.find(c => c.id === characterIdForUpdate);
    if (!characterDoc || characterDoc.userId !== currentUser.uid) { toast({ title: "Unauthorized", variant: "destructive" }); return; }
    setIsUpdating(true);
    console.log('[AppDataProvider] batchUpdateUserQuestCompletions: isUpdating set to true.');
    try {
      let currentBatch = writeBatch(db);
      let operationCount = 0;
      const commitBatchIfNeeded = async () => {
        if (operationCount >= BATCH_OPERATION_LIMIT) {
            await currentBatch.commit();
            currentBatch = writeBatch(db);
            operationCount = 0;
        }
      };

      const updatedCompletionsMap = activeCharacterId === characterIdForUpdate ? new Map(activeCharacterQuestCompletions) : new Map();
      let changesMade = 0;

      for (const update of updates) {
        await commitBatchIfNeeded();
        const { questId, ...completionData } = update;
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
        if (activeCharacterId === characterIdForUpdate) {
          React.startTransition(() => {
            setActiveCharacterQuestCompletions(updatedCompletionsMap);
          });
        }
        toast({ title: "Quest Completions Updated", description: `${changesMade} quest(s) updated from CSV.`});
      } else { toast({ title: "No Updates", description: "No quest completions were changed by CSV." }); }
    } catch (error) { toast({ title: "Error Updating from CSV", description: (error as Error).message, variant: "destructive" }); throw error; }
    finally { setIsUpdating(false); console.log('[AppDataProvider] batchUpdateUserQuestCompletions: isUpdating set to false.'); }
  }, [currentUser, characters, activeCharacterId, activeCharacterQuestCompletions, toast]);

  return (
    <AppDataContext.Provider value={{
      characters, setCharacters: setCharactersState,
      addCharacter, updateCharacter, deleteCharacter,
      adventurePacks, 
      quests, setQuests,
      updateQuestDefinition, deleteQuestDefinition,
      fetchQuestCompletionsForCharacter,
      updateUserQuestCompletion, batchResetUserQuestCompletions, batchUpdateUserQuestCompletions,
      activeCharacterId, activeCharacterQuestCompletions,
      ownedPacks, setOwnedPacks,
      isDataLoaded,
      isLoading,
      isUpdating
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
