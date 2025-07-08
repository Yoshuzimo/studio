// Favor-Tracker-V1
// src/app/favor-tracker/[characterId]/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppData } from '@/context/app-data-context';
import type { Character, Quest, UserQuestCompletionData } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DialogFooter } from '@/components/ui/dialog';
import { FavorTrackerCsvUploaderDialog, type QuestCompletionCsvUploadResult } from '@/components/favor-tracker/favor-tracker-csv-uploader-dialog';
import type { QuestCompletionUpdate } from '@/context/app-data-context';
import { Download, UserCircle, ListOrdered, MapPin, UserSquare, ArrowUpDown, ArrowUp, ArrowDown, Package, Loader2, RotateCcw, Upload, Award, Timer, BarChartBig, Layers, Settings, BookOpen, AlertTriangle, TrendingUp, Maximize, Pencil, Skull, TestTube2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Separator } from '@/components/ui/separator';
import { CharacterForm, type CharacterFormData } from '@/components/character/character-form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { QuestWikiPopover } from '@/components/shared/quest-wiki-popover';
import { QuestMapViewer } from '@/components/shared/quest-map-viewer';


type DifficultyKey = 'casualCompleted' | 'normalCompleted' | 'hardCompleted' | 'eliteCompleted';
type DifficultyNotAvailableKey = 'casualNotAvailable' | 'normalNotAvailable' | 'hardNotAvailable' | 'eliteNotAvailable';

type SortableColumnKey =
  | 'name'
  | 'level'
  | 'adventurePackName'
  | 'location'
  | 'duration'
  | 'questGiver'
  | 'remainingPossibleFavor'
  | 'adjustedRemainingFavorScore'
  | 'areaRemainingFavor'
  | 'areaAdjustedRemainingFavorScore'
  | 'maxPotentialFavorSingleQuest';

interface SortConfig {
  key: SortableColumnKey;
  direction: 'ascending' | 'descending';
}

const getPrimaryLocation = (location?: string | null): string | null => {
  if (!location) return null;
  return location.split('(')[0].trim();
};

const getSortableName = (name: string): string => name.toLowerCase().replace(/^the\s+/i, '');

const difficultyLevels: {
  key: DifficultyKey;
  label: string;
  notAvailableKey: DifficultyNotAvailableKey;
  csvMapKey: string;
  multiplier: number;
}[] = [
  { key: 'casualCompleted', label: 'C/S', notAvailableKey: 'casualNotAvailable', csvMapKey: 'C/S', multiplier: 0.5 },
  { key: 'normalCompleted', label: 'N', notAvailableKey: 'normalNotAvailable', csvMapKey: 'N', multiplier: 1 },
  { key: 'hardCompleted', label: 'H', notAvailableKey: 'hardNotAvailable', csvMapKey: 'H', multiplier: 2 },
  { key: 'eliteCompleted', label: 'E', notAvailableKey: 'eliteNotAvailable', csvMapKey: 'E', multiplier: 3 },
];
const difficultyOrder: DifficultyKey[] = ['casualCompleted', 'normalCompleted', 'hardCompleted', 'eliteCompleted'];


type DurationCategory = "Very Short" | "Short" | "Medium" | "Long" | "Very Long";
const durationAdjustmentDefaults: Record<DurationCategory, number> = { "Very Short": 1.2, "Short": 1.1, "Medium": 1.0, "Long": 0.9, "Very Long": 0.8, };
const DURATION_CATEGORIES: DurationCategory[] = ["Very Short", "Short", "Medium", "Long", "Very Long"];

interface CharacterFavorTrackerPreferences {
  columnVisibility: Record<SortableColumnKey | string, boolean>;
  durationAdjustments: Record<DurationCategory, number>;
  showCompletedQuestsWithZeroRemainingFavor: boolean;
  onCormyr: boolean;
  showRaids: boolean;
  clickAction: 'none' | 'wiki' | 'map';
  sortConfig?: SortConfig | null;
}

function parseDurationToMinutes(durationString?: string | null): number | null {
  if (!durationString || durationString.trim() === "") return null;
  let parsableString = durationString.toUpperCase();
  if (parsableString.startsWith('PT') && parsableString.endsWith('M') && parsableString.length > 3) {
    const numericPart = parsableString.substring(2, parsableString.length - 1);
    if (/^\d+$/.test(numericPart)) parsableString = numericPart;
  } else if (parsableString.endsWith('M') && !parsableString.startsWith('PT') && /^\d+M$/.test(parsableString)) {
    parsableString = parsableString.slice(0, -1);
  } else if (parsableString.length >= 2 && /^\d\s/.test(parsableString)) {
     parsableString = parsableString.substring(2).trim();
  }

  const minutes = parseInt(parsableString, 10);
  return isNaN(minutes) ? null : minutes;
}
function getDurationCategory(durationInput?: string | null): DurationCategory | null {
  if (!durationInput || durationInput.trim() === "") return null;
  const normalizedInput = durationInput.trim();
  if (DURATION_CATEGORIES.includes(normalizedInput as DurationCategory)) return normalizedInput as DurationCategory;
  const minutes = parseDurationToMinutes(normalizedInput);
  if (minutes === null) return null;
  if (minutes <= 10) return "Very Short"; if (minutes <= 20) return "Short"; if (minutes <= 30) return "Medium"; if (minutes <= 45) return "Long"; return "Very Long";
}

const allTableHeaders: { key: SortableColumnKey | string; label: string; icon?: React.ElementType, className?: string, isSortable?: boolean, isDifficulty?: boolean }[] = [
    { key: 'name', label: 'Quest Name', className: "w-[200px] whitespace-nowrap", isSortable: true },
    { key: 'level', label: 'LVL', className: "text-center", isSortable: true },
    { key: 'adventurePackName', label: 'Adventure Pack', icon: Package, className: "whitespace-nowrap", isSortable: true },
    { key: 'location', label: 'Location', icon: MapPin, className: "whitespace-nowrap", isSortable: true },
    { key: 'duration', label: 'Length', icon: Timer, className: "whitespace-nowrap text-center", isSortable: true },
    { key: 'questGiver', label: 'Quest Giver', icon: UserSquare, className: "whitespace-nowrap", isSortable: true },
    { key: 'maxPotentialFavorSingleQuest', label: 'Max Favor', icon: Maximize, className: "text-center whitespace-nowrap", isSortable: true },
    { key: 'remainingPossibleFavor', label: 'Favor', icon: Award, className: "text-center whitespace-nowrap", isSortable: true },
    { key: 'adjustedRemainingFavorScore', label: 'Score', icon: TrendingUp, className: "text-center whitespace-nowrap", isSortable: true },
    { key: 'areaRemainingFavor', label: 'Area Favor', icon: Layers, className: "text-center whitespace-nowrap", isSortable: true },
    { key: 'areaAdjustedRemainingFavorScore', label: 'Area Score', icon: Layers, className: "text-center whitespace-nowrap", isSortable: true },
    ...difficultyLevels.map(diff => ({ key: diff.key, label: diff.label, isDifficulty: true, isSortable: false, className: "text-center whitespace-nowrap" }))
];

const getDefaultColumnVisibility = (): Record<SortableColumnKey | string, boolean> => {
    const initial: Record<SortableColumnKey | string, boolean> = {} as any;
     allTableHeaders.forEach(header => {
        if (['adventurePackName', 'questGiver', 'location', 'duration', 'areaRemainingFavor', 'remainingPossibleFavor', 'maxPotentialFavorSingleQuest'].includes(header.key)) {
            initial[header.key] = false;
        }
        else {
            initial[header.key] = true;
        }
    });
    initial['areaAdjustedRemainingFavorScore'] = true;
    initial['remainingPossibleFavor'] = false;
    return initial;
 };
const CSV_QUEST_NAME_HEADER_LINE_INDEX = 1;
const CSV_DIFFICULTY_HEADER_LINE_INDEX = 1;
const CSV_DATA_START_LINE_INDEX = 3;
const FREE_TO_PLAY_PACK_NAME_LOWERCASE = "free to play";

const normalizeAdventurePackNameForComparison = (name?: string | null): string => {
  if (!name) return "";
  const trimmedName = name.trim();
  const lowerName = trimmedName.toLowerCase();
  const withoutThe = lowerName.startsWith("the ") ? lowerName.substring(4) : lowerName;
  return withoutThe.replace(/[^a-z0-9]/g, '');
};

type QuestWithSortValue = Quest & {
  casualCompleted: boolean;
  normalCompleted: boolean;
  hardCompleted: boolean;
  eliteCompleted: boolean;
  remainingPossibleFavor: number;
  adjustedRemainingFavorScore: number;
  maxPotentialFavorSingleQuest: number;
  hiddenReasons: string[];
  _sortValue: any;
  _areaFavorSortValue: number;
  _areaScoreSortValue: number;
  _locationSortValue: string;
};

export default function FavorTrackerPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser, userData, isLoading: authIsLoading } = useAuth();
  const {
    characters, quests, ownedPacks,
    batchUpdateUserQuestCompletions,
    batchResetUserQuestCompletions,
    activeCharacterQuestCompletions,
    fetchQuestCompletionsForCharacter,
    activeCharacterId,
    isDataLoaded, isLoading: appDataIsLoading,
    updateCharacter
  } = useAppData();
  const { toast } = useToast();

  const [character, setCharacter] = useState<Character | null>(null);
  const characterId = params.characterId as string;
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });

  const [showCompletedQuestsWithZeroRemainingFavor, setShowCompletedQuestsWithZeroRemainingFavor] = useState(false);
  const [onCormyr, setOnCormyr] = useState(false);
  const [showRaids, setShowRaids] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isUploadCsvDialogOpen, setIsUploadCsvDialogOpen] = useState(false);
  const [isCsvProcessing, setIsCsvProcessing] = useState(false);
  const [durationAdjustments, setDurationAdjustments] = useState<Record<DurationCategory, number>>(durationAdjustmentDefaults);
  const [columnVisibility, setColumnVisibility] = useState<Record<SortableColumnKey | string, boolean>>(getDefaultColumnVisibility());
  const [popoverColumnVisibility, setPopoverColumnVisibility] = useState<Record<SortableColumnKey | string, boolean>>({});
  const [isSettingsPopoverOpen, setIsSettingsPopoverOpen] = useState(false);
  const [isLoadingCompletions, setIsLoadingCompletions] = useState(true);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);

  const [clickAction, setClickAction] = useState<'none' | 'wiki' | 'map'>('none');
  const [isWikiOpen, setIsWikiOpen] = useState(false);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [isMapViewerOpen, setIsMapViewerOpen] = useState(false);
  const [selectedQuestForMap, setSelectedQuestForMap] = useState<Quest | null>(null);

  const pageOverallLoading = authIsLoading || appDataIsLoading || isCsvProcessing || isLoadingCompletions;

  useEffect(() => { if (!authIsLoading && !currentUser) router.replace('/login'); }, [authIsLoading, currentUser, router]);

  const savePreferences = useCallback((updatedPrefs: Partial<CharacterFavorTrackerPreferences>) => {
     if (typeof window === 'undefined' || !characterId || !isDataLoaded || !currentUser) return;
    try {
        localStorage.setItem(`ddoToolkit_charPrefs_${currentUser.uid}_${characterId}`, JSON.stringify({
        ...(JSON.parse(localStorage.getItem(`ddoToolkit_charPrefs_${currentUser.uid}_${characterId}`) || '{}')),
        ...updatedPrefs,
        }));
    } catch (error) { console.error("Failed to save preferences:", error); toast({ title: "Error Saving Preferences", variant: "destructive" }); }
  }, [characterId, isDataLoaded, currentUser, toast]);

 useEffect(() => {
    if (typeof window !== 'undefined' && characterId && isDataLoaded && currentUser) {
      try {
        const storedPrefs = localStorage.getItem(`ddoToolkit_charPrefs_${currentUser.uid}_${characterId}`);
        if (storedPrefs) {
          const prefs = JSON.parse(storedPrefs) as CharacterFavorTrackerPreferences;
          if (prefs.durationAdjustments) {
            const mergedAdjustments = { ...durationAdjustmentDefaults };
            for (const cat of DURATION_CATEGORIES) { if (prefs.durationAdjustments[cat] !== undefined && typeof prefs.durationAdjustments[cat] === 'number') mergedAdjustments[cat] = prefs.durationAdjustments[cat]; }
            setDurationAdjustments(mergedAdjustments);
          }
          if (typeof prefs.showCompletedQuestsWithZeroRemainingFavor === 'boolean') setShowCompletedQuestsWithZeroRemainingFavor(prefs.showCompletedQuestsWithZeroRemainingFavor);
          else if (typeof (prefs as any).showCompleted === 'boolean') setShowCompletedQuestsWithZeroRemainingFavor((prefs as any).showCompleted);

          if (typeof prefs.onCormyr === 'boolean') setOnCormyr(prefs.onCormyr);
          if (typeof prefs.showRaids === 'boolean') setShowRaids(prefs.showRaids);

          if (prefs.clickAction && ['none', 'wiki', 'map'].includes(prefs.clickAction)) {
            setClickAction(prefs.clickAction);
          }

          if (prefs.sortConfig) {
            setSortConfig(prefs.sortConfig);
          }

          const defaultVis = getDefaultColumnVisibility();
          const mergedVisibility: Record<SortableColumnKey | string, boolean> = {} as any;
          allTableHeaders.forEach(header => { mergedVisibility[header.key] = popoverColumnVisibility[header.key] ?? prefs.columnVisibility?.[header.key] ?? defaultVis[header.key]; });
          setColumnVisibility(mergedVisibility);
        } else {
          savePreferences({ 
              columnVisibility: getDefaultColumnVisibility(), 
              durationAdjustments: durationAdjustmentDefaults, 
              showCompletedQuestsWithZeroRemainingFavor: false, 
              onCormyr: false, 
              showRaids: false, 
              clickAction: 'none',
              sortConfig: { key: 'name', direction: 'ascending' }
            });
        }
      } catch (error) { console.error("Error loading preferences:", error); }
    }
  }, [characterId, isDataLoaded, currentUser, savePreferences]);


  useEffect(() => { if (isDataLoaded && characterId && currentUser) savePreferences({ durationAdjustments }); }, [durationAdjustments, savePreferences, isDataLoaded, characterId, currentUser]);
  useEffect(() => { if (isDataLoaded && characterId && currentUser) savePreferences({ showCompletedQuestsWithZeroRemainingFavor }); }, [showCompletedQuestsWithZeroRemainingFavor, savePreferences, isDataLoaded, characterId, currentUser]);
  useEffect(() => { if (isDataLoaded && characterId && currentUser) savePreferences({ onCormyr }); }, [onCormyr, savePreferences, isDataLoaded, characterId, currentUser]);
  useEffect(() => { if (isDataLoaded && characterId && currentUser) savePreferences({ showRaids }); }, [showRaids, savePreferences, isDataLoaded, characterId, currentUser]);
  useEffect(() => { if (isDataLoaded && characterId && currentUser) savePreferences({ clickAction }); }, [clickAction, savePreferences, isDataLoaded, characterId, currentUser]);
  useEffect(() => {
    if (isDataLoaded && characterId && currentUser && sortConfig !== null) {
      savePreferences({ sortConfig });
    }
  }, [sortConfig, savePreferences, isDataLoaded, characterId, currentUser]);


  const handlePopoverColumnVisibilityChange = (key: SortableColumnKey | string, checked: boolean) => setPopoverColumnVisibility(prev => ({ ...prev, [key]: checked }));
  const handleApplyColumnSettings = () => { setColumnVisibility(popoverColumnVisibility); savePreferences({ columnVisibility: popoverColumnVisibility }); setIsSettingsPopoverOpen(false); };
  const handleCancelColumnSettings = () => setIsSettingsPopoverOpen(false);
  const handleResetColumnSettingsToDefault = () => { setPopoverColumnVisibility(getDefaultColumnVisibility()); };
  const handleSettingsPopoverOpenChange = (open: boolean) => { if (open) setPopoverColumnVisibility(columnVisibility); setIsSettingsPopoverOpen(open); };

  const handleEditCharacterSubmit = async (data: CharacterFormData, id?: string, iconUrl?: string) => {
    if (!id || !editingCharacter) return;
    await updateCharacter({ ...editingCharacter, name: data.name, level: data.level, iconUrl });
    setIsEditModalOpen(false);
    setEditingCharacter(null);
  };

  const openEditModal = (characterToEdit: Character) => {
    setEditingCharacter(characterToEdit);
    setIsEditModalOpen(true);
  };

  useEffect(() => {
    if (authIsLoading || appDataIsLoading || !isDataLoaded || !currentUser || !characterId) {
      if (!(isLoadingCompletions && activeCharacterId === characterId && !authIsLoading && !appDataIsLoading)) {
        setIsLoadingCompletions(true);
      }
      return;
    }

    const foundChar = characters.find(c => c.id === characterId && c.userId === currentUser.uid);

    if (foundChar) {
      setCharacter(foundChar);
      if (characterId !== activeCharacterId) {
        setIsLoadingCompletions(true);
        fetchQuestCompletionsForCharacter(characterId)
          .catch(err => console.error(`[FavorTrackerPage] Error fetching completions for ${characterId}:`, err))
          .finally(() => setIsLoadingCompletions(false));
      } else {
        setIsLoadingCompletions(false);
      }
    } else {
      toast({ title: "Character not found", variant: "destructive" });
      router.push('/');
      setIsLoadingCompletions(false);
    }
  }, [characterId, currentUser?.uid, isDataLoaded, authIsLoading, appDataIsLoading, fetchQuestCompletionsForCharacter, activeCharacterId, characters, router, toast, isLoadingCompletions]);

  const handleCompletionChange = async (questId: string, changedDifficultyKey: DifficultyKey, isNowCompleted: boolean) => {
    if (!character) return;
    const quest = quests.find(q => q.id === questId);
    if (!quest) return;

    const currentCompletionData = activeCharacterQuestCompletions.get(questId);
    const newCompletionStates: Record<DifficultyKey, boolean> = {
        casualCompleted: (currentCompletionData?.casualCompleted && !quest.casualNotAvailable) || false,
        normalCompleted: (currentCompletionData?.normalCompleted && !quest.normalNotAvailable) || false,
        hardCompleted: (currentCompletionData?.hardCompleted && !quest.hardNotAvailable) || false,
        eliteCompleted: (currentCompletionData?.eliteCompleted && !quest.eliteNotAvailable) || false,
    };

    const changedDifficultyIndex = difficultyOrder.indexOf(changedDifficultyKey);

    if (isNowCompleted) {
        for (let i = 0; i <= changedDifficultyIndex; i++) {
            const diffKey = difficultyOrder[i];
            if (!quest[difficultyLevels[i].notAvailableKey]) {
                newCompletionStates[diffKey] = true;
            }
        }
    } else {
        for (let i = changedDifficultyIndex; i < difficultyOrder.length; i++) {
            const diffKey = difficultyOrder[i];
            newCompletionStates[diffKey] = false;
        }
    }

    const updatePayload: Partial<QuestCompletionUpdate> = { questId };
    let hasChanged = false;

    for (const key of difficultyOrder) {
        const typedKey = key as DifficultyKey;
        if (newCompletionStates[typedKey] !== (currentCompletionData?.[typedKey] ?? false)) {
            (updatePayload as any)[typedKey] = newCompletionStates[typedKey];
            hasChanged = true;
        } else if (newCompletionStates[typedKey] && (updatePayload as any)[typedKey] === undefined) {
            (updatePayload as any)[typedKey] = true;
        }
    }

    if ((currentCompletionData?.[changedDifficultyKey] ?? false) !== isNowCompleted) {
        (updatePayload as any)[changedDifficultyKey] = isNowCompleted;
        hasChanged = true;
    }

    if (hasChanged) {
        await batchUpdateUserQuestCompletions(character.id, [updatePayload as QuestCompletionUpdate]);
    }
  };

  const handleConfirmResetCompletions = async () => {
    if (!character || !displayData) return;
    const questsForCharacterLevel = displayData.allProcessedQuests
        .filter(q => q.level <= character.level && q.level > 0)
        .map(q => q.id);
    await batchResetUserQuestCompletions(character.id, questsForCharacterLevel);
    setIsResetDialogOpen(false);
   };

  const handleQuestCompletionCsvUpload = async (file: File): Promise<QuestCompletionCsvUploadResult> => {
    if (!character) throw new Error("Character not loaded, cannot process CSV.");
    setIsCsvProcessing(true);
    try {
      const fileText = await file.text();
      const allLines = fileText.split('\n').map(line => line.trim());

      if (allLines.length < CSV_DATA_START_LINE_INDEX + 1) throw new Error(`CSV too short. Headers expected around Line ${CSV_QUEST_NAME_HEADER_LINE_INDEX + 1}/${CSV_DIFFICULTY_HEADER_LINE_INDEX + 1}, data on Line ${CSV_DATA_START_LINE_INDEX + 1}.`);

      const questNameHeaderLineContent = allLines[CSV_QUEST_NAME_HEADER_LINE_INDEX];
      const difficultyHeaderLineContent = allLines[CSV_DIFFICULTY_HEADER_LINE_INDEX];
      if (!questNameHeaderLineContent || !difficultyHeaderLineContent) throw new Error(`Header lines not found. Quest Name on Line ${CSV_QUEST_NAME_HEADER_LINE_INDEX + 1}, Difficulties on Line ${CSV_DIFFICULTY_HEADER_LINE_INDEX + 1}.`);

      const questNameHeaderVariants = ["quest name", "name", "title"];
      const questNameCsvHeaders = questNameHeaderLineContent.split(',').map(h => h.trim().toLowerCase());
      const questNameColumnIndex = questNameCsvHeaders.findIndex(h => questNameHeaderVariants.includes(h));
      if (questNameColumnIndex === -1) throw new Error(`'Quest Name' header not found on Line ${CSV_QUEST_NAME_HEADER_LINE_INDEX + 1}.`);

      const csvDifficultyAllHeaders = difficultyHeaderLineContent.split(',').map(h => h.trim());
      const difficultyDataColumnIndices: { [key in DifficultyKey]?: number } = {};
      difficultyLevels.forEach(dl => { const index = csvDifficultyAllHeaders.findIndex(h => h.toUpperCase() === dl.csvMapKey.toUpperCase()); if (index !== -1) difficultyDataColumnIndices[dl.key] = index; });
      if (Object.keys(difficultyDataColumnIndices).length === 0) throw new Error(`No difficulty headers (e.g., ${difficultyLevels.map(d => d.csvMapKey).join(', ')}) found on Line ${CSV_DIFFICULTY_HEADER_LINE_INDEX + 1}.`);

      const dataLines = allLines.slice(CSV_DATA_START_LINE_INDEX).filter(line => line.trim() !== "");
      const updates: QuestCompletionUpdate[] = [];
      const notFoundNames: string[] = [];
      let questsUpdatedCount = 0;

      dataLines.forEach(line => {
        const columns = line.split(',').map(col => col.trim());
        const questNameCsv = columns[questNameColumnIndex];
        if (!questNameCsv || questNameCsv.toLowerCase().includes("test")) return;

        const quest = quests.find(q => q.name.toLowerCase() === questNameCsv.toLowerCase());
        if (quest) {
          const questUpdate: Partial<QuestCompletionUpdate> = { questId: quest.id };
          let changed = false;
          const charCompletionsForThisQuest = activeCharacterQuestCompletions.get(quest.id);

          for (const diffLevel of difficultyLevels) {
            const difficultyKey = diffLevel.key;
            const csvColIdx = difficultyDataColumnIndices[difficultyKey];

            if (csvColIdx !== undefined && csvColIdx < columns.length) {
              const isCompletedCsv = columns[csvColIdx]?.toLowerCase() === 'true' || columns[csvColIdx]?.toLowerCase() === 'x' || columns[csvColIdx] === '1';
              const notAvailableKey = diffLevel.notAvailableKey;

              if (!quest[notAvailableKey]) {
                 if (charCompletionsForThisQuest?.[difficultyKey] !== isCompletedCsv) {
                   (questUpdate as any)[difficultyKey] = isCompletedCsv;
                   changed = true;
                 }
              }
            }
          }
          if (changed) { updates.push(questUpdate as QuestCompletionUpdate); questsUpdatedCount++; }
        } else { if (!notFoundNames.includes(questNameCsv)) notFoundNames.push(questNameCsv); }
      });

      if (updates.length > 0) await batchUpdateUserQuestCompletions(character.id, updates);
      return { totalCsvRowsProcessed: dataLines.length, questsUpdatedCount, questsNotFoundCount: notFoundNames.length, notFoundNames };
    } catch (error) { console.error("Quest Completion CSV Upload Error:", error); throw error; }
    finally { setIsCsvProcessing(false); }
  };

  const handleRowClick = (quest: Quest) => {
    if (clickAction === 'wiki') {
        if (quest.wikiUrl) {
            setSelectedQuest(quest);
            setIsWikiOpen(true);
        } else {
            toast({ title: "No Wiki Link", description: `A wiki link is not available for "${quest.name}".` });
        }
    } else if (clickAction === 'map') {
        if (quest.mapUrls && quest.mapUrls.length > 0) {
            setSelectedQuestForMap(quest);
            setIsMapViewerOpen(true);
        } else {
            toast({ title: "No Maps Available", description: `Maps are not available for "${quest.name}".` });
        }
    }
  };

  const handleDownloadBackup = () => {
    if (!character || !displayData.allProcessedQuests.length) return;

    const questNameHeader = "Quest Name";
    const difficultyHeaders = difficultyLevels.map(dl => `"${dl.csvMapKey}"`).join(',');
    const headerRow1 = `"${character.name}","${character.level}","${character.id}","${new Date().toISOString()}"`;
    const headerRow2 = `"${questNameHeader}",,,,,,,,"${difficultyHeaders}"`;
    const headerRow3 = ``; // Blank line

    const dataRows = displayData.allProcessedQuests
      .filter(q => q.level > 0)
      .sort((a,b) => getSortableName(a.name).localeCompare(getSortableName(b.name)))
      .map(quest => {
        const difficultyValues = difficultyLevels.map(dl => quest[dl.key] ? "TRUE" : "").join(',');
        return `"${quest.name.replace(/"/g, '""')}",,,,,,,,${difficultyValues}`;
      });

    const csvContent = [headerRow1, headerRow2, headerRow3, ...dataRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${character.name}_favor_backup_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getQuestCompletion = useCallback((questId: string, difficultyKey: DifficultyKey): boolean => {
    const completion = activeCharacterQuestCompletions.get(questId);
    return !!completion?.[difficultyKey];
  }, [activeCharacterQuestCompletions]);

  const calculateFavorMetrics = useCallback((quest: Quest, getCompletionFn: (questId: string, difficultyKey: DifficultyKey) => boolean) => {
    if (!quest.baseFavor) return { earned: 0, remaining: 0, maxPossible: 0 };
    
    let difficultiesWithMultipliers = [
      { key: 'eliteCompleted', mult: 3, notAvailable: quest.eliteNotAvailable },
      { key: 'hardCompleted', mult: 2, notAvailable: quest.hardNotAvailable },
      { key: 'normalCompleted', mult: 1, notAvailable: quest.normalNotAvailable },
      { key: 'casualCompleted', mult: 0.5, notAvailable: quest.casualNotAvailable },
    ].filter(d => !d.notAvailable);
    
    if (difficultiesWithMultipliers.length === 1 && difficultiesWithMultipliers[0].key === 'casualCompleted') {
      difficultiesWithMultipliers[0].mult = 1.0;
    }
  
    let highestCompletedMultiplier = 0;
    for (const diff of difficultiesWithMultipliers) {
      if (getCompletionFn(quest.id, diff.key as DifficultyKey)) {
        highestCompletedMultiplier = Math.max(highestCompletedMultiplier, diff.mult);
      }
    }
    
    const highestAvailableMultiplier = difficultiesWithMultipliers.reduce((max, d) => Math.max(max, d.mult), 0);
    
    const earned = quest.baseFavor * highestCompletedMultiplier;
    const maxPossible = quest.baseFavor * highestAvailableMultiplier;
    const remaining = Math.max(0, maxPossible - earned);
    
    return { earned: Math.round(earned), remaining: Math.round(remaining), maxPossible: Math.round(maxPossible) };
  }, []);

  const completionDep = JSON.stringify(Array.from(activeCharacterQuestCompletions.entries()));
  const ownedPacksFuzzySet = useMemo(() => new Set(ownedPacks.map(p => normalizeAdventurePackNameForComparison(p))), [ownedPacks]);

  const displayData = useMemo(() => {
    if (!character || !isDataLoaded || !quests) {
      return {
        allProcessedQuests: [],
        processedQuests: [],
        areaAggregates: { favorMap: new Map<string, number>(), scoreMap: new Map<string, number>() },
      };
    }

    const allProcessedQuests = quests.map(quest => {
        const { remaining: remainingPossibleFavor } = calculateFavorMetrics(quest, getQuestCompletion);

        const calculateAdjustedRemainingFavorScore = (q: Quest, remainingFavor: number): number => {
            if (remainingFavor <= 0) return 0;
            const durationCategory = getDurationCategory(q.duration);
            const adjustmentFactor = durationCategory ? (durationAdjustments[durationCategory] ?? 1.0) : 1.0;
            return Math.round(remainingFavor * adjustmentFactor);
        };

        const hiddenReasons: string[] = [];
        const isEligibleLevel = quest.level > 0 && quest.level <= character.level;
        if (!isEligibleLevel) {
            hiddenReasons.push(`Level too high (Lvl ${quest.level} vs Char Lvl ${character.level})`);
        }

        const fuzzyQuestPackKey = normalizeAdventurePackNameForComparison(quest.adventurePackName);
        const isActuallyFreeToPlay = fuzzyQuestPackKey === normalizeAdventurePackNameForComparison(FREE_TO_PLAY_PACK_NAME_LOWERCASE);
        const isOwned = isActuallyFreeToPlay || !quest.adventurePackName || ownedPacksFuzzySet.has(fuzzyQuestPackKey);
        if (!isOwned) {
            hiddenReasons.push(`Pack not owned: ${quest.adventurePackName}`);
        }

        if (!onCormyr && quest.name.toLowerCase() === "the curse of the five fangs") {
          hiddenReasons.push('Hidden by "On Cormyr" filter');
        }

        if (!showRaids && quest.name.toLowerCase().endsWith('(raid)')) {
          hiddenReasons.push('Is a Raid (hidden by filter).');
        }

        if (quest.name.toLowerCase().includes("test")) {
          hiddenReasons.push('Is a test quest');
        }

        if (!isDebugMode && !showCompletedQuestsWithZeroRemainingFavor && remainingPossibleFavor <= 0) {
            hiddenReasons.push('Completed with 0 remaining favor');
        }

        return {
            ...quest,
            casualCompleted: getQuestCompletion(quest.id, 'casualCompleted'),
            normalCompleted: getQuestCompletion(quest.id, 'normalCompleted'),
            hardCompleted: getQuestCompletion(quest.id, 'hardCompleted'),
            eliteCompleted: getQuestCompletion(quest.id, 'eliteCompleted'),
            remainingPossibleFavor: remainingPossibleFavor,
            adjustedRemainingFavorScore: calculateAdjustedRemainingFavorScore(quest, remainingPossibleFavor),
            maxPotentialFavorSingleQuest: (quest.baseFavor || 0) * 3,
            hiddenReasons,
        };
    });

    const filteredQuests = isDebugMode
      ? allProcessedQuests
      : allProcessedQuests.filter(quest => quest.hiddenReasons.length === 0);

    const areaAggregates = {
      favorMap: new Map<string, number>(),
      scoreMap: new Map<string, number>(),
    };

    allProcessedQuests.forEach(quest => {
        const primaryLocation = getPrimaryLocation(quest.location);
        if(quest.hiddenReasons.length === 0 && primaryLocation) {
            areaAggregates.favorMap.set(primaryLocation, (areaAggregates.favorMap.get(primaryLocation) || 0) + quest.remainingPossibleFavor);
            areaAggregates.scoreMap.set(primaryLocation, (areaAggregates.scoreMap.get(primaryLocation) || 0) + quest.adjustedRemainingFavorScore);
        }
    });

    return { allProcessedQuests, processedQuests: filteredQuests, areaAggregates };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    quests, character, ownedPacksFuzzySet, onCormyr, showRaids, showCompletedQuestsWithZeroRemainingFavor,
    completionDep, durationAdjustments, isDataLoaded, isDebugMode
  ]);

  const sortedAndFilteredData = useMemo(() => {
    if (!character) {
      return { sortedQuests: [] };
    }
  
    const questsToSort = displayData.processedQuests;
  
    const getSortValue = (quest: QuestWithSortValue, config: SortConfig) => {
      const { key } = config;
      if (key === 'areaRemainingFavor' || key === 'areaAdjustedRemainingFavorScore') {
        const primaryLocation = getPrimaryLocation(quest.location);
        const mapToUse = key === 'areaRemainingFavor' ? displayData.areaAggregates.favorMap : displayData.areaAggregates.scoreMap;
        return primaryLocation ? mapToUse.get(primaryLocation) ?? 0 : 0;
      }
      if (key === 'name') return getSortableName(quest.name);
      if (key === 'location') return quest.location || '';
      return (quest as any)[key];
    };
  
    const sortedQuests = [...questsToSort].sort((a, b) => {
      if (!sortConfig) return 0;
  
      const aValue = getSortValue(a, sortConfig);
      const bValue = getSortValue(b, sortConfig);
  
      let aComparable = aValue === null || aValue === undefined ? (sortConfig.direction === 'ascending' ? Infinity : -Infinity) : aValue;
      let bComparable = bValue === null || bValue === undefined ? (sortConfig.direction === 'ascending' ? Infinity : -Infinity) : bValue;
  
      let comparison = 0;
      if (typeof aComparable === 'string' && typeof bComparable === 'string') {
        comparison = aComparable.localeCompare(bComparable);
      } else {
        if (aComparable < bComparable) comparison = -1;
        if (aComparable > bComparable) comparison = 1;
      }
  
      if (comparison !== 0) {
        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      }
  
      if (sortConfig.key === 'areaRemainingFavor' || sortConfig.key === 'areaAdjustedRemainingFavorScore') {
        const aLocation = a.location || '';
        const bLocation = b.location || '';
        const locationComparison = aLocation.localeCompare(bLocation);
        if (locationComparison !== 0) return locationComparison;
      }
  
      return getSortableName(a.name).localeCompare(getSortableName(b.name));
    });
  
    return { ...displayData, sortedQuests };
  }, [displayData, sortConfig, character]);
  
  const pageStats = useMemo(() => {
    const allQuests = displayData.allProcessedQuests;
    const visibleQuests = sortedAndFilteredData.sortedQuests;

    if (!allQuests.length) {
        return { questsCompleted: 0, favorEarned: 0, favorRemaining: 0 };
    }

    const favorEarned = allQuests.reduce((total, quest) => {
        if (!quest.baseFavor) return total;
        const { earned } = calculateFavorMetrics(quest, getQuestCompletion);
        return total + earned;
    }, 0);

    const questsCompleted = allQuests.filter(q => 
        q.baseFavor && q.baseFavor > 0 &&
        q.remainingPossibleFavor <= 0 && 
        (q.casualCompleted || q.normalCompleted || q.hardCompleted || q.eliteCompleted)
    ).length;

    const favorRemaining = visibleQuests.reduce((total, q) => total + q.remainingPossibleFavor, 0);

    return {
        questsCompleted: Math.round(questsCompleted),
        favorEarned: Math.round(favorEarned),
        favorRemaining: Math.round(favorRemaining)
    };
  }, [displayData.allProcessedQuests, sortedAndFilteredData.sortedQuests, calculateFavorMetrics, getQuestCompletion]);
  
  const requestSort = (key: SortableColumnKey) => {
    let newDirection: 'ascending' | 'descending' = 'ascending';

    if (sortConfig && sortConfig.key === key) {
        newDirection = sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
    } else {
        const specialSortKeys: SortableColumnKey[] = [
            'remainingPossibleFavor', 'adjustedRemainingFavorScore', 'areaRemainingFavor', 'areaAdjustedRemainingFavorScore', 'maxPotentialFavorSingleQuest'
        ];
        if (specialSortKeys.includes(key)) {
            newDirection = 'descending';
        }
    }

    const newSortConfig = { key, direction: newDirection };
    setSortConfig(newSortConfig);
  };

  const getSortIndicator = (columnKey: SortableColumnKey) => {
    if (!sortConfig || sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-3 w-3 text-accent" /> : <ArrowDown className="ml-2 h-3 w-3 text-accent" />;
  };

  const popoverVisibleNonDifficultyHeaders = allTableHeaders.filter(
    header => !header.isDifficulty
  );

  const visibleTableHeaders = allTableHeaders.filter(h => columnVisibility[h.key]);

  if (pageOverallLoading || !isDataLoaded || !character) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="mr-2 h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!currentUser) { 
     return (
      <div className="container mx-auto py-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Please log in to view this page.</p>
        <Button onClick={() => router.push('/login')} className="mt-6">Log In</Button>
      </div>
    );
  }

  if (!character) { 
     return <div className="flex justify-center items-center h-screen"><p>Character not found or access denied.</p></div>;
  }

  const { sortedQuests } = sortedAndFilteredData;

  return (
    <div className="py-8 space-y-8">
      {character && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex justify-between items-center">
                <CardTitle className="font-headline text-3xl flex items-center">
                <UserCircle className="mr-3 h-8 w-8 text-primary" /> {character.name}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => openEditModal(character)} disabled={pageOverallLoading}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit Character
                </Button>
            </div>
            <CardDescription>Level {character.level}</CardDescription>
          </CardHeader>
           <CardContent className="pt-2">
            <div className="pt-4 border-t">
                <div className="flex justify-around items-center text-sm">
                    <div className="text-center">
                        <div className="text-muted-foreground text-xs">Quests Done</div>
                        <div className="font-bold text-lg">{pageStats.questsCompleted}</div>
                    </div>
                    <Separator orientation="vertical" className="h-8" />
                    <div className="text-center">
                        <div className="text-muted-foreground text-xs">Favor Earned</div>
                        <div className="font-bold text-lg">{pageStats.favorEarned}</div>
                    </div>
                    <Separator orientation="vertical" className="h-8" />
                    <div className="text-center">
                        <div className="text-muted-foreground text-xs">Favor Remaining</div>
                        <div className="font-bold text-lg">{pageStats.favorRemaining}</div>
                    </div>
                </div>
            </div>
            <div className="pt-4 border-t mt-4 flex flex-col space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="flex items-center space-x-2">
                        <Checkbox id="show-completed" checked={showCompletedQuestsWithZeroRemainingFavor} onCheckedChange={(checked) => setShowCompletedQuestsWithZeroRemainingFavor(!!checked)} disabled={pageOverallLoading} aria-label="Toggle visibility of fully completed quests"/>
                        <Label htmlFor="show-completed" className={cn("font-normal", pageOverallLoading && "cursor-not-allowed opacity-50")}>Show Completed</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="on-cormyr" checked={onCormyr} onCheckedChange={(checked) => setOnCormyr(!!checked)} disabled={pageOverallLoading} aria-label="Toggle hiding of 'The Curse of the Five Fangs' quest"/>
                        <Label htmlFor="on-cormyr" className={cn("font-normal", pageOverallLoading && "cursor-not-allowed opacity-50")}>On Cormyr</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="show-raids" checked={showRaids} onCheckedChange={(checked) => setShowRaids(!!checked)} disabled={pageOverallLoading} aria-label="Toggle visibility of raids"/>
                        <Label htmlFor="show-raids" className={cn("font-normal", pageOverallLoading && "cursor-not-allowed opacity-50")}>Show Raids</Label>
                    </div>
                    {userData?.isAdmin && (
                      <div className="flex items-center space-x-2">
                          <Checkbox id="debug-mode" checked={isDebugMode} onCheckedChange={(checked) => setIsDebugMode(!!checked)} disabled={pageOverallLoading}/>
                          <Label htmlFor="debug-mode" className={cn("font-normal text-destructive", pageOverallLoading && "cursor-not-allowed opacity-50")}>Debug</Label>
                      </div>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                     <Button onClick={handleDownloadBackup} variant="outline" disabled={pageOverallLoading || sortedQuests.length === 0} size="sm">
                       <Download className="mr-2 h-4 w-4" /> Save Backup
                    </Button>
                    <Button onClick={() => setIsUploadCsvDialogOpen(true)} variant="outline" disabled={pageOverallLoading || quests.length === 0} size="sm">
                        {isCsvProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Upload CSV
                    </Button>
                    <Button onClick={() => setIsResetDialogOpen(true)} variant="outline" disabled={pageOverallLoading || sortedQuests.length === 0} size="sm">
                        {appDataIsLoading && !isCsvProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />} Reset Completions
                    </Button>
                </div>
              </div>
               <div className="pt-2 border-t border-border mt-4">
                <Label className="text-sm font-medium block mb-2">On Quest Click</Label>
                <RadioGroup
                  value={clickAction}
                  onValueChange={(value) => setClickAction(value as 'none' | 'wiki' | 'map')}
                  className="flex items-center space-x-4"
                  disabled={pageOverallLoading}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="action-none" />
                    <Label htmlFor="action-none" className="font-normal cursor-pointer">None</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="wiki" id="action-wiki" />
                    <Label htmlFor="action-wiki" className="flex items-center font-normal cursor-pointer"><BookOpen className="mr-1.5 h-4 w-4"/>Show Wiki</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="map" id="action-map" />
                    <Label htmlFor="action-map" className="font-normal cursor-pointer flex items-center"><MapPin className="mr-1.5 h-4 w-4"/>Show Map</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="flex flex-col h-[80vh]">
        <CardHeader className="flex-shrink-0 bg-card border-b">
          <div className="flex justify-between items-center">
            <CardTitle className="font-headline flex items-center">
              <ListOrdered className="mr-2 h-6 w-6 text-primary" /> Favor Tracker
              {isDebugMode && <span className="ml-2 text-xs font-normal text-muted-foreground">({sortedQuests.length} quests)</span>}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Link href={`/reaper-rewards/${characterId}`} passHref><Button variant="outline" size="sm" disabled={pageOverallLoading}><Skull className="mr-2 h-4 w-4" />Reaper Rewards</Button></Link>
              <Link href={`/leveling-guide/${characterId}`} passHref><Button variant="outline" size="sm" disabled={pageOverallLoading}><BookOpen className="mr-2 h-4 w-4" />Leveling Guide</Button></Link>
              <Popover open={isSettingsPopoverOpen} onOpenChange={handleSettingsPopoverOpenChange}>
                <PopoverTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9" disabled={pageOverallLoading}><Settings className="h-4 w-4" /><span className="sr-only">Column Settings</span></Button></PopoverTrigger>
                <PopoverContent className="w-auto p-4 min-w-[360px] sm:min-w-[480px] md:min-w-[600px]">
                  <div className="space-y-4">
                    <h4 className="font-medium leading-none">Display Columns</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {popoverVisibleNonDifficultyHeaders.map(header => (
                        <div key={header.key} className="flex items-center space-x-2">
                          <Checkbox id={`vis-${header.key}`} checked={!!popoverColumnVisibility[header.key]} onCheckedChange={(checked) => handlePopoverColumnVisibilityChange(header.key, !!checked)} />
                          <Label htmlFor={`vis-${header.key}`} className="font-normal">{header.label}</Label>
                        </div>
                      ))}
                    </div>
                    <Separator />
                    <h4 className="font-medium leading-none pt-2">Difficulty Columns</h4>
                     <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {difficultyLevels.map(dl => (
                            <div key={dl.key} className="flex items-center space-x-2">
                            <Checkbox id={`vis-${dl.key}`} checked={!!popoverColumnVisibility[dl.key]} onCheckedChange={(checked) => handlePopoverColumnVisibilityChange(dl.key, !!checked)} />
                            <Label htmlFor={`vis-${dl.key}`} className="font-normal">{dl.label}</Label>
                            </div>
                        ))}
                      </div>
                    <DialogFooter className="pt-2 flex justify-between sm:justify-end">
                        <Button variant="outline" onClick={handleResetColumnSettingsToDefault} disabled={pageOverallLoading}>Reset to Default</Button>
                        <div className="flex space-x-2">
                            <Button variant="ghost" onClick={handleCancelColumnSettings}>Cancel</Button>
                            <Button onClick={handleApplyColumnSettings}>Apply</Button>
                        </div>
                    </DialogFooter>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <CardDescription>
            Mark completions for each quest and difficulty. 'Favor' is remaining possible favor. 'Score' is remaining favor adjusted by quest duration. Area columns sum remaining values.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0">
           {pageOverallLoading && sortedQuests.length === 0 ? ( <div className="p-6 text-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin mx-auto" /> <p>Filtering quests...</p></div> )
           : !pageOverallLoading && sortedQuests.length === 0 && character ? ( <div className="p-6 text-center py-10"> <p className="text-xl text-muted-foreground mb-4">No quests available at or below LVL {character.level}, matching your owned packs/filters and completion status.</p> <img src="https://i.imgflip.com/2adszq.jpg" alt="Empty quest log" data-ai-hint="sad spongebob" className="mx-auto rounded-lg shadow-md max-w-xs" /> </div> )
           : ( 
            <div className="h-full overflow-y-auto">
               <Table>
                <TableCaption className="py-4 sticky bottom-0 bg-card z-10">End of quest list for {character?.name} at level {character?.level}.</TableCaption>
                <TableHeader className="sticky top-0 z-10"> 
                    <TableRow className="bg-card hover:bg-card">
                    {visibleTableHeaders.map((header) => (
                        <TableHead key={header.key} className={cn(header.className)}>
                        <Button variant="ghost" onClick={() => header.isSortable && requestSort(header.key as SortableColumnKey)} className="p-0 h-auto hover:bg-transparent" disabled={pageOverallLoading || !header.isSortable}>
                            {header.icon && <header.icon className="mr-1.5 h-4 w-4" />} {header.label} {header.isSortable && getSortIndicator(header.key as SortableColumnKey)}
                        </Button>
                        </TableHead>
                    ))}
                </TableRow> </TableHeader>
                <TableBody>
                    {sortedQuests.map((quest) => (
                    <TooltipProvider key={quest.id} delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <TableRow
                            className={cn(
                              clickAction !== 'none' && 'cursor-pointer',
                              isDebugMode && quest.hiddenReasons.length > 0 && 'text-destructive/80 hover:text-destructive'
                            )}
                            onClick={() => handleRowClick(quest)}
                          >
                              {columnVisibility['name'] && <TableCell className="font-medium whitespace-nowrap">{quest.name}</TableCell>}
                              {columnVisibility['level'] && <TableCell className="text-center">{quest.level}</TableCell>}
                              {columnVisibility['adventurePackName'] && <TableCell className="whitespace-nowrap">{quest.adventurePackName || 'Free to Play'}</TableCell>}
                              {columnVisibility['location'] && <TableCell className="whitespace-nowrap">{quest.location || 'N/A'}</TableCell>}
                              {columnVisibility['questGiver'] && <TableCell className="whitespace-nowrap">{quest.questGiver || 'N/A'}</TableCell>}
                              {columnVisibility['maxPotentialFavorSingleQuest'] && <TableCell className="text-center">{(quest as any).maxPotentialFavorSingleQuest ?? '-'}</TableCell>}
                              {columnVisibility['remainingPossibleFavor'] && <TableCell className="text-center">{(quest as any).remainingPossibleFavor ?? '-'}</TableCell>}
                              {columnVisibility['adjustedRemainingFavorScore'] && <TableCell className="text-center">{(quest as any).adjustedRemainingFavorScore ?? '-'}</TableCell>}
                              {columnVisibility['areaRemainingFavor'] && <TableCell className="text-center">{quest.location ? (sortedAndFilteredData.areaAggregates.favorMap.get(getPrimaryLocation(quest.location) || '') ?? 0) : '-'}</TableCell>}
                              {columnVisibility['areaAdjustedRemainingFavorScore'] && <TableCell className="text-center">{quest.location ? (sortedAndFilteredData.areaAggregates.scoreMap.get(getPrimaryLocation(quest.location) || '') ?? 0) : '-'}</TableCell>}

                              {difficultyLevels.map(diff => columnVisibility[diff.key] && (
                              <TableCell key={diff.key} className="text-center" onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                  checked={(quest as any)[diff.key]}
                                  onCheckedChange={(checked) => handleCompletionChange(quest.id, diff.key, !!checked)}
                                  disabled={!!(quest as any)[diff.notAvailableKey] || pageOverallLoading}
                                  aria-label={`${quest.name} ${diff.label} completion status`}
                                  />
                              </TableCell>
                              ))}
                          </TableRow>
                        </TooltipTrigger>
                        {isDebugMode && quest.hiddenReasons.length > 0 && (
                            <TooltipContent>
                                <p>Normally hidden because: {quest.hiddenReasons.join(', ')}</p>
                            </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                    ))}
                </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {character && (
        <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}> <AlertDialogContent> <AlertDialogHeader> <AlertDialogTitle>Reset Quest Completions?</AlertDialogTitle> <AlertDialogDescription> This will reset all quest completion data for {character.name} for the quests currently visible in the table. This action cannot be undone. </AlertDialogDescription> </AlertDialogHeader> <AlertDialogFooter> <AlertDialogCancel disabled={pageOverallLoading} onClick={() => setIsResetDialogOpen(false)}>Cancel</AlertDialogCancel> <AlertDialogAction onClick={handleConfirmResetCompletions} variant="destructive" disabled={pageOverallLoading}> {appDataIsLoading && !isCsvProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Reset Completions </AlertDialogAction> </AlertDialogFooter> </AlertDialogContent> </AlertDialog>
      )}
      {character && (
        <FavorTrackerCsvUploaderDialog isOpen={isUploadCsvDialogOpen} onOpenChange={setIsUploadCsvDialogOpen} onCsvUpload={handleQuestCompletionCsvUpload} isUploading={isCsvProcessing} characterName={character.name} difficultyLevelLabels={difficultyLevels.map(dl => ({label: dl.label, csvKey: dl.csvMapKey}))} />
      )}
       {editingCharacter && (
        <CharacterForm
          isOpen={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          onSubmit={handleEditCharacterSubmit}
          initialData={editingCharacter}
          isSubmitting={pageOverallLoading}
        />
      )}
      {selectedQuest && (
        <QuestWikiPopover
            isOpen={isWikiOpen}
            onOpenChange={setIsWikiOpen}
            questName={selectedQuest.name}
            wikiUrl={selectedQuest.wikiUrl}
        />
      )}
       {selectedQuestForMap && (
        <QuestMapViewer
          isOpen={isMapViewerOpen}
          onOpenChange={setIsMapViewerOpen}
          questName={selectedQuestForMap.name}
          mapUrls={selectedQuestForMap.mapUrls || []}
        />
      )}
    </div>
  );
}
