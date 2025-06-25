// src/app/admin/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAppData } from '@/context/app-data-context';
import { CsvUploader } from '@/components/admin/csv-uploader';
import { ShieldCheck, ListChecks, Inbox, Loader2, User, Trash2, Edit, AlertTriangle, RefreshCw } from 'lucide-react';
import type { Quest, CSVQuest, Suggestion, User as AppUser, AdventurePack, CSVAdventurePack } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, doc, getDocs, query, orderBy, Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ReplyToSuggestionForm } from '@/components/admin/reply-to-suggestion-form';
import { QuestForm, type QuestFormData } from '@/components/admin/quest-form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { ManageAdminsPopover } from '@/components/admin/manage-admins-popover';
import { GeneratedCodeDialog } from '@/components/admin/generated-code-dialog';

const normalizeAdventurePackNameForStorage = (name?: string | null): string | null => {
  if (!name) return null;
  const trimmedName = name.trim();
  if (trimmedName.toLowerCase().startsWith("the ")) {
    return trimmedName.substring(4).trim();
  }
  return trimmedName;
};

// Helper function to properly parse a CSV line, respecting quotes.
const parseCsvLine = (line: string): string[] => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Escaped quote
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim().startsWith('"') && current.trim().endsWith('"') ? current.trim().slice(1, -1) : current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim().startsWith('"') && current.trim().endsWith('"') ? current.trim().slice(1, -1) : current.trim());
    return values;
};


function parseCsv<T extends Record<string, any>>(
  csvText: string,
  propertyNames: string[],
  linesToSkip: number,
  columnIndices: number[]
): T[] {
  const allFileLines = csvText.trim().split('\n');
  if (allFileLines.length < linesToSkip) {
    console.warn(`CSV has only ${allFileLines.length} lines, but configured to skip ${linesToSkip} lines. Returning empty array.`);
    return [];
  }
  const dataLines = allFileLines.slice(linesToSkip);
  const parsedData: T[] = [];
  dataLines.forEach((line, rowIndex) => {
    if (line.trim() === "") return;
    const values = parseCsvLine(line);
    const entry: any = {};
    for (let i = 0; i < propertyNames.length; i++) {
      const propName = propertyNames[i];
      const csvColIndex = columnIndices[i];
      if (csvColIndex < values.length) {
        entry[propName] = values[csvColIndex].trim();
      } else {
        entry[propName] = "";
      }
    }
    parsedData.push(entry as T);
  });
  return parsedData;
}

export default function AdminPage() {
  const { currentUser, userData, isLoading: authIsLoading, getAllUsers } = useAuth();
  const router = useRouter();

  const {
    setQuests, 
    quests,
    isDataLoaded: isAppDataLoaded, 
    isLoading: isInitialAppDataLoading,    
    isUpdating: isAppContextUpdating, 
    updateQuestDefinition,
    deleteQuestDefinition
  } = useAppData();

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [isLoadingAllUsers, setIsLoadingAllUsers] = useState(false); 
  const [hasFetchedAllUsers, setHasFetchedAllUsers] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [generatedCodeDialogTitle, setGeneratedCodeDialogTitle] = useState('');
  const [generatedCodeDialogDescription, setGeneratedCodeDialogDescription] = useState('');
  const [generatedCodeDialogFilePath, setGeneratedCodeDialogFilePath] = useState('');
  const [isCodeDialogOpen, setIsCodeDialogOpen] = useState(false);


  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  const [isQuestFormOpen, setIsQuestFormOpen] = useState(false);
  const [questToDeleteId, setQuestToDeleteId] = useState<string | null>(null);
  const [isDeleteQuestDialogOpen, setIsDeleteQuestDialogOpen] = useState(false);

  useEffect(() => {
    console.log("[AdminPage] Auth state check: authIsLoading:", authIsLoading, "currentUser:", !!currentUser, "userData?.isAdmin:", !!userData?.isAdmin);
    if (!authIsLoading) {
      if (!currentUser || !userData?.isAdmin) {
        console.log("[AdminPage] Redirecting to '/' due to no currentUser or not admin.");
        router.replace('/');
      }
    }
  }, [currentUser, userData, authIsLoading, router]);

  const fetchSuggestions = useCallback(async () => {
    setIsLoadingSuggestions(true);
    try {
      const suggestionsQuery = query(collection(db, 'suggestions'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(suggestionsQuery);
      const fetchedSuggestions: Suggestion[] = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
              id: docSnap.id,
              text: data.text,
              createdAt: data.createdAt as FirestoreTimestamp,
              suggesterId: data.suggesterId,
              suggesterName: data.suggesterName,
          } as Suggestion;
      });
      setSuggestions(fetchedSuggestions);
    } catch (error) {
      console.error("[AdminPage] Firestore suggestions fetch error:", error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  const fetchAllUsersList = useCallback(async () => {
    if (currentUser && userData?.isAdmin && !hasFetchedAllUsers) {
      console.log("[AdminPage] fetchAllUsersList: Setting isLoadingAllUsers to true.");
      setIsLoadingAllUsers(true);
      try {
        console.log("[AdminPage] fetchAllUsersList: Attempting to call getAllUsers from AuthContext.");
        const usersList = await getAllUsers();
        setAllUsers(usersList);
        setHasFetchedAllUsers(true);
        console.log("[AdminPage] fetchAllUsersList: Successfully fetched and set all users. Count:", usersList.length);
      } catch (error) {
        console.error("[AdminPage] Failed to fetch all users on admin page:", error);
      } finally {
        console.log("[AdminPage] fetchAllUsersList: Setting isLoadingAllUsers to false.");
        setIsLoadingAllUsers(false);
      }
    } else if (hasFetchedAllUsers) {
      console.log("[AdminPage] fetchAllUsersList: Already fetched all users, skipping.");
      setIsLoadingAllUsers(false); 
    } else {
      console.log("[AdminPage] fetchAllUsersList: Conditions not met (currentUser/isAdmin), not fetching. Ensuring isLoadingAllUsers is false.");
      setIsLoadingAllUsers(false); 
    }
  }, [currentUser, userData, getAllUsers, hasFetchedAllUsers]);
  
  useEffect(() => {
    console.log("[AdminPage] Admin-specific data useEffect triggered. authIsLoading:", authIsLoading, "currentUser:", !!currentUser, "userData?.isAdmin:", !!userData?.isAdmin);
    if (!authIsLoading && currentUser && userData?.isAdmin) {
      console.log("[AdminPage] Admin-specific data useEffect: Auth loaded, user is admin. Calling initial data fetches.");
      fetchAllUsersList();
      fetchSuggestions();
    } else if (!authIsLoading) {
      console.log("[AdminPage] Admin-specific data useEffect: Auth loaded, but user not admin or no user. Resetting states.");
      setIsLoadingSuggestions(false);
      setSuggestions([]);
      setIsLoadingAllUsers(false);
      setAllUsers([]);
      setHasFetchedAllUsers(false);
    }
  }, [currentUser, userData, authIsLoading, fetchAllUsersList, fetchSuggestions]);

  const handleFileUpload = async (dataType: 'Adventure Packs' | 'Quests', file: File) => {
    const fileText = await file.text();
    console.log(`[AdminPage] Starting file upload for ${dataType}`);
    try {
      if (dataType === 'Adventure Packs') {
          const propNames: (keyof CSVAdventurePack)[] = ['name', 'pointsCost', 'totalFavor'];
          const colIndices = [0, 2, 3]; // Name (col 0), Points Cost (col 2), Total Favor (col 3)
          const linesToSkip = 1; // Just skip the header row.

          const parsedFromCsv = parseCsv<CSVAdventurePack>(fileText, propNames, linesToSkip, colIndices);
          
          const uniqueSortedPacks = [...new Map(parsedFromCsv.filter(p => p.name).map(p => [p.name.toLowerCase(), p])).values()]
            .sort((a, b) => a.name.localeCompare(b.name));

          const newPacks: AdventurePack[] = uniqueSortedPacks.map((pack, index) => {
              const pointsCost = parseInt(pack.pointsCost || '', 10);
              const totalFavor = parseInt(pack.totalFavor || '', 10);
              return {
                  id: `pack_${String(index + 1).padStart(3, '0')}`,
                  name: pack.name.replace(/'/g, "\\'"),
                  pointsCost: isNaN(pointsCost) ? null : pointsCost,
                  totalFavor: isNaN(totalFavor) ? null : totalFavor,
              };
          });

          const fileContentString = `// src/data/adventure-packs.ts
import type { AdventurePack } from '@/types';

// This is the master list for Adventure Packs.
// You can edit this list directly to add, remove, or modify packs.
// The Admin Panel's CSV uploader for Adventure Packs will generate a new version of this file's contents for you to copy-paste.
export const ADVENTURE_PACKS_DATA: AdventurePack[] = [
${newPacks.map(pack => `  { id: '${pack.id}', name: '${pack.name}', pointsCost: ${pack.pointsCost}, totalFavor: ${pack.totalFavor} }`).join(',\n')}
];
`;
          setGeneratedCode(fileContentString);
          setGeneratedCodeDialogTitle('Generated Adventure Packs Code');
          setGeneratedCodeDialogDescription('The uploaded CSV has been processed. Copy the code below and replace the entire content of the specified file to update the master list of adventure packs.');
          setGeneratedCodeDialogFilePath('src/data/adventure-packs.ts');
          setIsCodeDialogOpen(true);

      } else if (dataType === 'Quests') {
        const propertyNames: (keyof CSVQuest)[] = [
            'questGiver', 'name', 'location', 'level', 'casualSoloExp', 
            'normalExp', 'hardExp', 'eliteExp', 'duration', 'adventurePack', 
            'baseFavor', 'patron', 'casualNotAvailable', 'normalNotAvailable', 
            'hardNotAvailable', 'eliteNotAvailable',
            'epicBaseLevel', 'epicCasualExp', 'epicNormalExp', 'epicHardExp', 'epicEliteExp',
            'epicCasualNotAvailable', 'epicNormalNotAvailable', 'epicHardNotAvailable', 'epicEliteNotAvailable',
            'wikiUrl', 'mapUrl1', 'mapUrl2', 'mapUrl3', 'mapUrl4', 'mapUrl5', 'mapUrl6', 'mapUrl7'
        ];
        const columnIndices = [
          0, 2, 3, 4, 5, 6, 7, 8, 9, 18, 15, 19, 20, 21, 22, 23, 29, 30, 31, 32, 33, 20, 21, 22, 23,
          1, 35, 36, 37, 38, 39, 40, 41 // B=1, AJ=35, etc.
        ];
        const linesToSkip = 3;

        const parsedQuests = parseCsv<CSVQuest>(fileText, propertyNames as string[], linesToSkip, columnIndices);
        let questsWithLevelZeroWarningCount = 0;

        const newQuests: Quest[] = parsedQuests.map((q) => {
          const casualNotAvailable = q.casualNotAvailable?.toUpperCase() === 'TRUE';
          const normalNotAvailable = q.normalNotAvailable?.toUpperCase() === 'TRUE';
          const hardNotAvailable = q.hardNotAvailable?.toUpperCase() === 'TRUE';
          const eliteNotAvailable = q.eliteNotAvailable?.toUpperCase() === 'TRUE';
          
          const epicCasualNotAvailable = q.epicCasualNotAvailable?.toUpperCase() === 'TRUE';
          const epicNormalNotAvailable = q.epicNormalNotAvailable?.toUpperCase() === 'TRUE';
          const epicHardNotAvailable = q.epicHardNotAvailable?.toUpperCase() === 'TRUE';
          const epicEliteNotAvailable = q.epicEliteNotAvailable?.toUpperCase() === 'TRUE';
          
          let rawDuration = q.duration || '';
          let processedDuration = rawDuration.trim();
          let finalDurationString = processedDuration;
          if (processedDuration.startsWith('PT') && processedDuration.endsWith('M') && processedDuration.length > 3) {
            const numericPart = processedDuration.substring(2, processedDuration.length - 1);
            if (/^\d+$/.test(numericPart)) finalDurationString = numericPart;
          } else if (processedDuration.endsWith('M') && !processedDuration.startsWith('PT') && /^\d+M$/.test(processedDuration)) {
            finalDurationString = processedDuration.slice(0, -1);
          } else if (processedDuration.length >= 2 && /^\d\s/.test(processedDuration)) {
             finalDurationString = processedDuration.substring(2).trim();
          }
          
          const parseOptionalInt = (val?: string): number | null => {
            if (val === undefined || val === null || val.trim() === "") return null;
            const num = parseInt(val.replace(/,/g, ''), 10);
            return isNaN(num) ? null : num;
          };

          const parsedLevel = parseInt(q.level, 10);
          const finalLevel = isNaN(parsedLevel) ? 0 : parsedLevel;
          if (finalLevel === 0 && q.level && q.level.trim() !== "" && q.level.trim() !== "0") {
            questsWithLevelZeroWarningCount++;
          }
          
          const parsedEpicLevel = parseInt(q.epicBaseLevel || '', 10);
          const finalEpicLevel = isNaN(parsedEpicLevel) ? null : parsedEpicLevel;
          
          const mapUrls = [q.mapUrl1, q.mapUrl2, q.mapUrl3, q.mapUrl4, q.mapUrl5, q.mapUrl6, q.mapUrl7].filter(url => url && url.trim() !== '');

          return {
            id: q.id || doc(collection(db, 'quests')).id,
            name: q.name, level: finalLevel,
            adventurePackName: normalizeAdventurePackNameForStorage(q.adventurePack) || null,
            location: q.location === "" || q.location === undefined ? null : q.location,
            questGiver: q.questGiver === "" || q.questGiver === undefined ? null : q.questGiver,
            casualExp: parseOptionalInt(q.casualSoloExp), normalExp: parseOptionalInt(q.normalExp),
            hardExp: parseOptionalInt(q.hardExp), eliteExp: parseOptionalInt(q.eliteExp),
            duration: finalDurationString.trim() === "" ? null : finalDurationString.trim(),
            baseFavor: parseOptionalInt(q.baseFavor), patron: q.patron === "" || q.patron === undefined ? null : q.patron,
            casualNotAvailable, normalNotAvailable, hardNotAvailable, eliteNotAvailable,
            epicBaseLevel: finalEpicLevel, epicCasualExp: parseOptionalInt(q.epicCasualExp),
            epicNormalExp: parseOptionalInt(q.epicNormalExp), epicHardExp: parseOptionalInt(q.epicHardExp),
            epicEliteExp: parseOptionalInt(q.epicEliteExp), epicCasualNotAvailable,
            epicNormalNotAvailable, epicHardNotAvailable, epicEliteNotAvailable,
            wikiUrl: q.wikiUrl || null,
            mapUrls: mapUrls,
          };
        });
        
        await setQuests(newQuests);
      }
    } catch (error) {
        console.error(`[AdminPage] CSV Parsing/Upload Error for ${dataType} in handleFileUpload:`, error);
    }
  };

  const handleEditQuest = (quest: Quest) => { setEditingQuest(quest); setIsQuestFormOpen(true); };
  const handleQuestFormSubmit = async (data: QuestFormData) => {
    if (!editingQuest) return;

    const mapUrls = data.mapUrls?.map(item => item.value).filter(Boolean) || [];

    const updatedQuestData: Quest = {
      id: editingQuest.id,
      name: data.name,
      level: data.level,
      adventurePackName: normalizeAdventurePackNameForStorage(data.adventurePackName) || null,
      location: data.location || null,
      questGiver: data.questGiver || null,
      casualExp: (data.casualExp === undefined || isNaN(data.casualExp)) ? null : data.casualExp,
      normalExp: (data.normalExp === undefined || isNaN(data.normalExp)) ? null : data.normalExp,
      hardExp: (data.hardExp === undefined || isNaN(data.hardExp)) ? null : data.hardExp,
      eliteExp: (data.eliteExp === undefined || isNaN(data.eliteExp)) ? null : data.eliteExp,
      duration: data.duration || null,
      baseFavor: (data.baseFavor === undefined || isNaN(data.baseFavor)) ? null : data.baseFavor,
      patron: data.patron || null,
      casualNotAvailable: data.casualNotAvailable,
      normalNotAvailable: data.normalNotAvailable,
      hardNotAvailable: data.hardNotAvailable,
      eliteNotAvailable: data.eliteNotAvailable,
      epicBaseLevel: (data.epicBaseLevel === undefined || data.epicBaseLevel === '' || isNaN(Number(data.epicBaseLevel))) ? null : Number(data.epicBaseLevel),
      epicCasualExp: (data.epicCasualExp === undefined || isNaN(data.epicCasualExp)) ? null : data.epicCasualExp,
      epicNormalExp: (data.epicNormalExp === undefined || isNaN(data.epicNormalExp)) ? null : data.epicNormalExp,
      epicHardExp: (data.epicHardExp === undefined || isNaN(data.epicHardExp)) ? null : data.epicHardExp,
      epicEliteExp: (data.epicEliteExp === undefined || isNaN(data.epicEliteExp)) ? null : data.epicEliteExp,
      epicCasualNotAvailable: data.epicCasualNotAvailable,
      epicNormalNotAvailable: data.epicNormalNotAvailable,
      epicHardNotAvailable: data.epicHardNotAvailable,
      epicEliteNotAvailable: data.epicEliteNotAvailable,
      wikiUrl: data.wikiUrl || null,
      mapUrls: mapUrls,
    };
    await updateQuestDefinition(updatedQuestData);
    setIsQuestFormOpen(false); setEditingQuest(null);
  };
  const openDeleteQuestDialog = (questId: string) => { setQuestToDeleteId(questId); setIsDeleteQuestDialogOpen(true); };
  const confirmDeleteQuest = async () => {
    if (!questToDeleteId) return;
    await deleteQuestDefinition(questToDeleteId);
    setIsDeleteQuestDialogOpen(false); setQuestToDeleteId(null);
    if (editingQuest && editingQuest.id === questToDeleteId) { setIsQuestFormOpen(false); setEditingQuest(null); }
  };
  
  const pageOverallInitialLoad = authIsLoading || isInitialAppDataLoading;
  const pageContentLoading = isInitialAppDataLoading || isLoadingSuggestions || isLoadingAllUsers; 
  const uiDisabled = pageContentLoading || isAppContextUpdating; 

  console.log("[AdminPage] Render. authIsLoading:", authIsLoading, "isInitialAppDataLoading:", isInitialAppDataLoading, "isAppContextUpdating:", isAppContextUpdating, "isLoadingSuggestions:", isLoadingSuggestions, "isLoadingAllUsers:", isLoadingAllUsers, "pageContentLoading:", pageContentLoading, "uiDisabled:", uiDisabled);

  if (authIsLoading) { 
    return (
      <div className="flex flex-col justify-center items-center h-screen text-center">
        <Loader2 className="mr-2 h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg">Verifying access...</p>
      </div>
    );
  }

  if (!currentUser || !userData?.isAdmin) { 
     return (
      <div className="flex flex-col justify-center items-center h-screen text-center p-4">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You do not have permission to view this page.</p>
        <Button onClick={() => router.push('/')} className="mt-6">Go to Homepage</Button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-headline text-3xl font-bold flex items-center">
          <ShieldCheck className="mr-3 h-8 w-8 text-primary" /> Admin Panel
        </h1>
        {userData?.isAdmin && (
          <ManageAdminsPopover
            currentUserData={userData}
            allUsers={allUsers}
            onUsersUpdate={fetchAllUsersList}
            isLoadingUsers={isLoadingAllUsers} 
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="font-headline flex items-center">
              <Inbox className="mr-2 h-6 w-6 text-primary" /> Suggestions Inbox
            </CardTitle>
             <Button variant="outline" size="sm" onClick={fetchSuggestions} disabled={isLoadingSuggestions}>
              {isLoadingSuggestions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
          <CardDescription>User-submitted suggestions for the website, newest first. Admins can reply here.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSuggestions ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading suggestions...
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-muted-foreground">No suggestions submitted yet.</p>
          ) : (
            <ScrollArea className="h-auto max-h-[600px]">
              <ul className="space-y-4">
                {suggestions.map((suggestion, index) => (
                  <li key={suggestion.id} className="p-4 border rounded-lg shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">
                                Received: {suggestion.createdAt ? format(suggestion.createdAt.toDate(), 'MMM d, yyyy HH:mm') : 'No date'}
                            </div>
                            <div className="text-xs text-muted-foreground mb-2 flex items-center">
                                <User className="mr-1 h-3 w-3"/> From: {suggestion.suggesterName || 'Unknown User'} (ID: {suggestion.suggesterId})
                            </div>
                        </div>
                    </div>
                    <p className="text-sm bg-muted/30 p-3 rounded-md mb-3">{suggestion.text}</p>
                    <ReplyToSuggestionForm suggestion={suggestion} adminUser={userData} />
                    {index < suggestions.length - 1 && <Separator className="my-4" />}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <CsvUploader dataType="Adventure Packs" onFileUpload={handleFileUpload} disabled={uiDisabled} />
        <CsvUploader dataType="Quests" onFileUpload={handleFileUpload} disabled={uiDisabled} />
      </div>

      <div className="grid grid-cols-1 gap-8 mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center">
              <ListChecks className="mr-2 h-6 w-6 text-primary" /> Current Quests
            </CardTitle>
            <CardDescription>Overview of loaded quests. Click a quest to edit or delete.</CardDescription>
          </CardHeader>
          <CardContent>
            {isInitialAppDataLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <p>Total Quests: <strong>{quests.length}</strong></p>}
             {!isInitialAppDataLoading && quests.length > 0 && (
              <ScrollArea className="h-48 mt-2">
                <ul className="space-y-1 text-sm">
                  {quests.map(quest => (
                    <li
                      key={quest.id}
                      className="p-2 hover:bg-muted rounded-md cursor-pointer flex justify-between items-center group"
                      onClick={() => !uiDisabled && handleEditQuest(quest)}
                    >
                      <span>{quest.name} (Lvl {quest.level})</span>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); if (!uiDisabled) handleEditQuest(quest);}} aria-label={`Edit ${quest.name}`} disabled={uiDisabled}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); if (!uiDisabled) openDeleteQuestDialog(quest.id);}} aria-label={`Delete ${quest.name}`} disabled={uiDisabled}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
      {editingQuest && (
        <QuestForm isOpen={isQuestFormOpen} onOpenChange={setIsQuestFormOpen} initialData={editingQuest} onSubmit={handleQuestFormSubmit} onDelete={() => openDeleteQuestDialog(editingQuest.id)} isSubmitting={isAppContextUpdating} />
      )}
      <AlertDialog open={isDeleteQuestDialogOpen} onOpenChange={setIsDeleteQuestDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Quest?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete the quest "{quests.find(q => q.id === questToDeleteId)?.name || ''}"? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteQuestDialogOpen(false)} disabled={isAppContextUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteQuest} disabled={isAppContextUpdating} variant="destructive">
              {isAppContextUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete Quest
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <GeneratedCodeDialog
        isOpen={isCodeDialogOpen}
        onOpenChange={setIsCodeDialogOpen}
        generatedCode={generatedCode}
        title={generatedCodeDialogTitle}
        description={generatedCodeDialogDescription}
        filePath={generatedCodeDialogFilePath}
      />
    </div>
  );
}
