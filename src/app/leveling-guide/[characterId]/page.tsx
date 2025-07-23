
// src/app/leveling-guide/[characterId]/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppData } from '@/context/app-data-context';
import type { Character, Quest } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { UserCircle, ListOrdered, MapPin, UserSquare, ArrowUpDown, ArrowDown, ArrowUp, Package, Loader2, Settings, BookOpen, BarChartHorizontalBig, Timer, Activity, AlertTriangle, Pencil, Skull, TestTube2, Library } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DialogFooter } from '@/components/ui/dialog';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Separator } from '@/components/ui/separator';
import { CharacterForm, type CharacterFormData } from '@/components/character/character-form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { QuestWikiPopover } from '@/components/shared/quest-wiki-popover';
import { QuestMapViewer } from '@/components/shared/quest-map-viewer';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type SortableLevelingGuideColumnKey = 'name' | 'level' | 'adventurePackName' | 'location' | 'questGiver' | 'maxExp' | 'experienceScore';

interface SortConfig { key: SortableLevelingGuideColumnKey; direction: 'ascending' | 'descending'; }
type DurationCategory = "Very Short" | "Short" | "Medium" | "Long" | "Very Long";
const durationAdjustmentDefaults: Record<DurationCategory, number> = { "Very Short": 1.2, "Short": 1.1, "Medium": 1.0, "Long": 0.9, "Very Long": 0.8, };
const DURATION_CATEGORIES: DurationCategory[] = ["Very Short", "Short", "Medium", "Long", "Very Long"];

const getPrimaryLocation = (location?: string | null): string | null => {
  if (!location) return null;
  return location.split('(')[0].trim();
};

const getSortableName = (name: string): string => name.toLowerCase().replace(/^the\s+/i, '');

const allTableHeaders: { key: SortableLevelingGuideColumnKey | string; label: string; tooltip: string; icon?: React.ElementType, className?: string, isSortable?: boolean, isDifficulty?: boolean }[] = [
    { key: 'name', label: 'Quest Name', tooltip: "The name of the quest.", className: "w-[250px] whitespace-nowrap", isSortable: true },
    { key: 'level', label: 'LVL', tooltip: "The base level of the quest.", className: "text-center w-[80px]", isSortable: true },
    { key: 'adventurePackName', label: 'Adventure Pack', tooltip: "The Adventure Pack this quest belongs to.", icon: Package, className: "w-[200px] whitespace-nowrap", isSortable: true },
    { key: 'location', label: 'Location', tooltip: "The in-game location where this quest is found.", icon: MapPin, className: "w-[180px] whitespace-nowrap", isSortable: true },
    { key: 'questGiver', label: 'Quest Giver', tooltip: "The NPC who gives the quest.", icon: UserSquare, className: "w-[180px] whitespace-nowrap", isSortable: true },
    { key: 'adjustedCasualExp', label: 'C/S', tooltip: "Calculated EXP for Casual/Solo difficulty, including over-level penalties.", icon: BarChartHorizontalBig, className: "text-center w-[100px]", isSortable: false, isDifficulty: true },
    { key: 'adjustedNormalExp', label: 'N', tooltip: "Calculated EXP for Normal difficulty, including over-level penalties.", icon: BarChartHorizontalBig, className: "text-center w-[100px]", isSortable: false, isDifficulty: true },
    { key: 'adjustedHardExp', label: 'H', tooltip: "Calculated EXP for Hard difficulty, including over-level penalties.", icon: BarChartHorizontalBig, className: "text-center w-[100px]", isSortable: false, isDifficulty: true },
    { key: 'adjustedEliteExp', label: 'E', tooltip: "Calculated EXP for Elite difficulty, including over-level penalties.", icon: BarChartHorizontalBig, className: "text-center w-[100px]", isSortable: false, isDifficulty: true },
    { key: 'maxExp', label: 'Max EXP', tooltip: "The highest possible experience from any single difficulty for your character's level.", icon: BarChartHorizontalBig, className: "text-center w-[120px]", isSortable: true },
    { key: 'experienceScore', label: 'Score', tooltip: "Max EXP adjusted by quest duration. A higher score suggests a more efficient quest for EXP gain.", icon: Activity, className: "text-center w-[120px]", isSortable: true },
];
const difficultyColumnKeys: (keyof Quest | 'adjustedCasualExp' | 'adjustedNormalExp' | 'adjustedHardExp' | 'adjustedEliteExp')[] = ['adjustedCasualExp', 'adjustedNormalExp', 'adjustedHardExp', 'adjustedEliteExp'];

const getDefaultColumnVisibility = (): Record<SortableLevelingGuideColumnKey | string, boolean> => {
    const initial: Record<SortableLevelingGuideColumnKey, boolean> = {} as any;
     allTableHeaders.forEach(header => {
        if (['adventurePackName', 'questGiver'].includes(header.key)) {
            initial[header.key as SortableLevelingGuideColumnKey] = false;
        } else {
            initial[header.key as SortableLevelingGuideColumnKey] = true;
        }
    });
    return initial;
 };

interface LevelingGuidePreferences {
  columnVisibility: Record<SortableLevelingGuideColumnKey | string, boolean>;
  clickAction: 'none' | 'wiki' | 'map';
  durationAdjustments: Record<DurationCategory, number>;
  onCormyr: boolean;
  showRaids: boolean;
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
  const DURATION_CATEGORIES: DurationCategory[] = ["Very Short", "Short", "Medium", "Long", "Very Long"];
  if (!durationInput || durationInput.trim() === "") return null;
  const normalizedInput = durationInput.trim();
  if (DURATION_CATEGORIES.includes(normalizedInput as DurationCategory)) return normalizedInput as DurationCategory;
  const minutes = parseDurationToMinutes(durationInput);
  if (minutes === null) return null;
  if (minutes <= 10) return "Very Short"; if (minutes <= 20) return "Short"; if (minutes <= 30) return "Medium"; if (minutes <= 45) return "Long"; return "Very Long";
}

const FREE_TO_PLAY_PACK_NAME_LOWERCASE = "free to play";

const normalizeAdventurePackNameForComparison = (name?: string | null): string => {
  if (!name) return "";
  const trimmedName = name.trim();
  const lowerName = trimmedName.toLowerCase();
  const withoutThe = lowerName.startsWith("the ") ? lowerName.substring(4) : lowerName;
  return withoutThe.replace(/[^a-z0-9]/g, '');
};

const calculateAdjustedExpForTier = (
    quest: Quest,
    charLevel: number,
    tier: 'Heroic' | 'Epic'
) => {
    const penalties = [0, -0.1, -0.25, -0.5, -0.9, -0.99];
    let baseLevel, casualExp, normalExp, hardExp, eliteExp, casualNotAvailable, normalNotAvailable, hardNotAvailable, eliteNotAvailable;

    if (tier === 'Epic') {
        baseLevel = quest.epicBaseLevel!;
        casualExp = quest.epicCasualExp;
        normalExp = quest.epicNormalExp;
        hardExp = quest.epicHardExp;
        eliteExp = quest.epicEliteExp;
        casualNotAvailable = quest.epicCasualNotAvailable;
        normalNotAvailable = quest.epicNormalNotAvailable;
        hardNotAvailable = quest.epicHardNotAvailable;
        eliteNotAvailable = quest.epicEliteNotAvailable;
    } else {
        baseLevel = quest.level;
        casualExp = quest.casualExp;
        normalExp = quest.normalExp;
        hardExp = quest.hardExp;
        eliteExp = quest.eliteExp;
        casualNotAvailable = quest.casualNotAvailable;
        normalNotAvailable = quest.normalNotAvailable;
        hardNotAvailable = quest.hardNotAvailable;
        eliteNotAvailable = quest.eliteNotAvailable;
    }

    const calc = (exp: number | null | undefined, notAvailable: boolean | null | undefined, difficultyLevel: number) => {
        if (!exp || notAvailable) return null;
        if (charLevel < difficultyLevel) return exp; // No penalty if under level

        const overLevel = charLevel - difficultyLevel;
        if (overLevel <= 1) return exp;

        const penaltyIndex = Math.min(overLevel, penalties.length);
        const penalty = penalties[penaltyIndex - 1];

        return Math.floor(exp * (1 + penalty));
    };

    return {
        adjustedCasualExp: calc(casualExp, casualNotAvailable, baseLevel - 1),
        adjustedNormalExp: calc(normalExp, normalNotAvailable, baseLevel),
        adjustedHardExp: calc(hardExp, hardNotAvailable, baseLevel + 1),
        adjustedEliteExp: calc(eliteExp, eliteNotAvailable, baseLevel + 2),
    };
};


export default function LevelingGuidePage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser, userData, isLoading: authIsLoading } = useAuth();
  const { accounts, allCharacters, quests, ownedPacks, isDataLoaded, isLoading: appDataIsLoading, updateCharacter } = useAppData();
  const { toast } = useToast();

  const [character, setCharacter] = useState<Character | null>(null);
  const characterId = params.characterId as string;
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'experienceScore', direction: 'descending' });
  const [durationAdjustments, setDurationAdjustments] = useState<Record<DurationCategory, number>>(durationAdjustmentDefaults);
  const [onCormyr, setOnCormyr] = useState(false);
  const [showRaids, setShowRaids] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<SortableLevelingGuideColumnKey | string, boolean>>(getDefaultColumnVisibility());
  const [popoverColumnVisibility, setPopoverColumnVisibility] = useState<Record<SortableLevelingGuideColumnKey | string, boolean>>({});
  const [isSettingsPopoverOpen, setIsSettingsPopoverOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);

  const [clickAction, setClickAction] = useState<'none' | 'wiki' | 'map'>('none');
  const [isWikiOpen, setIsWikiOpen] = useState(false);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [isMapViewerOpen, setIsMapViewerOpen] = useState(false);
  const [selectedQuestForMap, setSelectedQuestForMap] = useState<Quest | null>(null);

  const pageOverallLoading = authIsLoading || appDataIsLoading;
  
  useEffect(() => {
    if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router]);

  const savePreferences = useCallback((newPrefs: Partial<LevelingGuidePreferences>, isShared: boolean = false) => {
    if (typeof window === 'undefined' || !characterId || !isDataLoaded || !currentUser || !character) return;
    try {
        const localKey = `ddoToolkit_charPrefs_${currentUser.uid}_${characterId}`;
        const existingPrefsString = localStorage.getItem(localKey);
        const existingPrefs = existingPrefsString ? JSON.parse(existingPrefsString) : {};

        const prefsToUpdate = { ...existingPrefs, levelingGuide: { ...(existingPrefs.levelingGuide || {}), ...(isShared ? {} : newPrefs) } };
        if (isShared) {
            Object.assign(prefsToUpdate, newPrefs);
        }

        localStorage.setItem(localKey, JSON.stringify(prefsToUpdate));
        const updatedCharacter = { ...character, preferences: { ...character.preferences, ...prefsToUpdate } };

        setCharacter(updatedCharacter);
        updateCharacter(updatedCharacter);
    } catch (error) { console.error("Failed to save leveling guide preferences:", error); }
  }, [characterId, isDataLoaded, currentUser, character, updateCharacter]);

  const saveSharedLevelOffset = useCallback((offsetEnabled: boolean, offsetValue: number) => {
    if (!character) return;
    const newPrefs = {
      ...character.preferences,
      useLevelOffset: offsetEnabled,
      levelOffset: offsetValue,
    };
    const updatedCharacter = { ...character, preferences: newPrefs };
    setCharacter(updatedCharacter);
    updateCharacter(updatedCharacter);
  }, [character, updateCharacter]);


  // Load preferences
  useEffect(() => {
    if (typeof window !== 'undefined' && characterId && isDataLoaded && currentUser && character) {
      try {
        const localKey = `ddoToolkit_charPrefs_${currentUser.uid}_${characterId}`;
        const localPrefsString = localStorage.getItem(localKey);
        const storedPrefs = localPrefsString ? JSON.parse(localPrefsString) : character.preferences;

        if (storedPrefs) {
            const levelingPrefs = storedPrefs.levelingGuide;
            if (levelingPrefs) {
                const mergedAdjustments = { ...durationAdjustmentDefaults };
                if (levelingPrefs.durationAdjustments) {
                  for (const cat of DURATION_CATEGORIES) { if (levelingPrefs.durationAdjustments[cat] !== undefined && typeof levelingPrefs.durationAdjustments[cat] === 'number') mergedAdjustments[cat] = levelingPrefs.durationAdjustments[cat]; }
                }
                setDurationAdjustments(mergedAdjustments);
                
                setOnCormyr(levelingPrefs.onCormyr ?? false);
                setShowRaids(levelingPrefs.showRaids ?? false);
                setClickAction(levelingPrefs.clickAction ?? 'none');
                setSortConfig(levelingPrefs.sortConfig ?? { key: 'experienceScore', direction: 'descending' });
                
                const defaultVis = getDefaultColumnVisibility();
                const mergedVisibility = { ...defaultVis, ...(levelingPrefs.columnVisibility || {}) };
                setColumnVisibility(mergedVisibility);
            }
        }
      } catch (error) { console.error("Error loading quest guide preferences:", error); }
    }
  }, [characterId, isDataLoaded, currentUser, character]);

  const handleDurationChange = (newAdjustments: Record<DurationCategory, number>) => {
    setDurationAdjustments(newAdjustments);
    savePreferences({ durationAdjustments: newAdjustments });
  }

  const handlePopoverColumnVisibilityChange = (key: SortableLevelingGuideColumnKey | string, checked: boolean) => setPopoverColumnVisibility(prev => ({ ...prev, [key]: checked }));
  const handleApplyColumnSettings = () => { setColumnVisibility(popoverColumnVisibility); savePreferences({ columnVisibility: popoverColumnVisibility }); setIsSettingsPopoverOpen(false); };
  const handleCancelColumnSettings = () => setIsSettingsPopoverOpen(false);
  const handleSettingsPopoverOpenChange = (open: boolean) => { if (open) setPopoverColumnVisibility(columnVisibility); setIsSettingsPopoverOpen(open); };

  const handleEditCharacterSubmit = async (data: CharacterFormData) => {
    if (!editingCharacter) return;
    
    // Optimistic UI update
    const updatedCharacterData: Character = {
        ...editingCharacter,
        name: data.name,
        level: data.level,
        accountId: data.accountId,
        iconUrl: data.iconUrl,
    };
    setCharacter(updatedCharacterData);
    
    setIsEditModalOpen(false);
    setEditingCharacter(null);
  
    // Debounced update to Firestore via context
    await updateCharacter(updatedCharacterData);
  };

  const openEditModal = (characterToEdit: Character) => {
    setEditingCharacter(characterToEdit);
    setIsEditModalOpen(true);
  };

  useEffect(() => {
    if (isDataLoaded && characterId && currentUser) {
      const foundCharacter = allCharacters.find(c => c.id === characterId && c.userId === currentUser.uid);
      if (foundCharacter) setCharacter(foundCharacter);
      else { toast({ title: "Character not found", description: "This character may not exist or you don't have permission.", variant: "destructive" }); router.push('/'); }
    }
  }, [characterId, allCharacters, isDataLoaded, currentUser, router, toast]);

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

  const ownedPacksFuzzySet = useMemo(() => new Set(ownedPacks.map(p => normalizeAdventurePackNameForComparison(p))), [ownedPacks]);
  
  const effectiveCharacterLevel = character ? ((character.preferences?.useLevelOffset ?? false) ? character.level + (character.preferences?.levelOffset ?? 0) : character.level) : 0;
  
  const sortedAndFilteredData = useMemo(() => {
    if (!character || !isDataLoaded || !quests) return { sortedQuests: [] };

    const processedQuests = quests.flatMap(quest => {
        const questEntries = [];
        const trueCharLevel = character.level; // Always use true level for calculations

        // Check for Heroic version
        if (quest.level > 0 && trueCharLevel < 20) {
            const adjustedExps = calculateAdjustedExpForTier(quest, trueCharLevel, 'Heroic');
            const allExps = Object.values(adjustedExps).filter(v => v !== null) as number[];
            const maxExp = allExps.length > 0 ? Math.max(...allExps) : null;
            const durationCategory = getDurationCategory(quest.duration);
            const adjustmentFactor = durationCategory ? (durationAdjustments[durationCategory] ?? 1.0) : 1.0;
            const experienceScore = maxExp !== null ? Math.round(maxExp * adjustmentFactor) : null;

            const hiddenReasons: string[] = [];
            if (quest.level > effectiveCharacterLevel) hiddenReasons.push(`Level out of range (with offset).`);
            if (maxExp === null || maxExp <= 0) hiddenReasons.push('No eligible EXP for character\'s actual level.');
            const fuzzyQuestPackKey = normalizeAdventurePackNameForComparison(quest.adventurePackName);
            const isActuallyFreeToPlay = fuzzyQuestPackKey === normalizeAdventurePackNameForComparison(FREE_TO_PLAY_PACK_NAME_LOWERCASE);
            const isOwned = isActuallyFreeToPlay || !quest.adventurePackName || ownedPacksFuzzySet.has(fuzzyQuestPackKey);
            if (!isOwned) hiddenReasons.push(`Pack not owned: ${quest.adventurePackName}`);
            if (onCormyr && quest.name.toLowerCase() === "the curse of the five fangs") hiddenReasons.push('Hidden by "On Cormyr" filter.');
            if (!showRaids && quest.name.toLowerCase().endsWith('(raid)')) hiddenReasons.push('Is a Raid (hidden by filter).');
            if (quest.name.toLowerCase().includes("test")) hiddenReasons.push('Is a test quest.');
            
            questEntries.push({
                ...quest,
                id: `${quest.id}-heroic`,
                name: `${quest.name} (Heroic)`,
                level: quest.level,
                ...adjustedExps, maxExp, experienceScore, hiddenReasons,
            });
        }
        
        // Check for Epic version
        if (quest.epicBaseLevel != null && trueCharLevel >= 20) {
             const adjustedExps = calculateAdjustedExpForTier(quest, trueCharLevel, 'Epic');
             const allExps = Object.values(adjustedExps).filter(v => v !== null) as number[];
             const maxExp = allExps.length > 0 ? Math.max(...allExps) : null;
             const durationCategory = getDurationCategory(quest.duration);
             const adjustmentFactor = durationCategory ? (durationAdjustments[durationCategory] ?? 1.0) : 1.0;
             const experienceScore = maxExp !== null ? Math.round(maxExp * adjustmentFactor) : null;

             const hiddenReasons: string[] = [];
             if (quest.epicBaseLevel > effectiveCharacterLevel) hiddenReasons.push('Level out of range (with offset).');
             if (maxExp === null || maxExp <= 0) hiddenReasons.push('No eligible EXP for character\'s actual level.');
             const fuzzyQuestPackKey = normalizeAdventurePackNameForComparison(quest.adventurePackName);
             const isActuallyFreeToPlay = fuzzyQuestPackKey === normalizeAdventurePackNameForComparison(FREE_TO_PLAY_PACK_NAME_LOWERCASE);
             const isOwned = isActuallyFreeToPlay || !quest.adventurePackName || ownedPacksFuzzySet.has(fuzzyQuestPackKey);
             if (!isOwned) hiddenReasons.push(`Pack not owned: ${quest.adventurePackName}`);
             if (!showRaids && quest.name.toLowerCase().endsWith('(raid)')) hiddenReasons.push('Is a Raid (hidden by filter).');
             if (quest.name.toLowerCase().includes("test")) hiddenReasons.push('Is a test quest.');

            questEntries.push({
                ...quest,
                id: `${quest.id}-epic`,
                name: `${quest.name} (Epic)`,
                level: quest.epicBaseLevel,
                ...adjustedExps, maxExp, experienceScore, hiddenReasons,
            });
        }

        return questEntries;
    });

    const filteredQuests = processedQuests.filter(quest => {
        if (isDebugMode) return true;
        return quest.hiddenReasons.length === 0;
    });

    const sortedQuests = [...filteredQuests].sort((a, b) => {
      if (!sortConfig || !character) return 0;

      let aValue: string | number | null | undefined;
      let bValue: string | number | null | undefined;

      if (sortConfig.key === 'name') {
        aValue = getSortableName(a.name);
        bValue = getSortableName(b.name);
      } else if (sortConfig.key === 'location') {
        aValue = getPrimaryLocation(a.location);
        bValue = getPrimaryLocation(b.location);
      } else {
        aValue = (a as any)[sortConfig.key];
        bValue = (b as any)[sortConfig.key];
      }

      if (aValue === null || aValue === undefined) aValue = sortConfig.direction === 'ascending' ? Infinity : -Infinity;
      if (bValue === null || bValue === undefined) bValue = sortConfig.direction === 'ascending' ? Infinity : -Infinity;

      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else {
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;
      }

      if (comparison !== 0) {
        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      }

      return getSortableName(a.name).localeCompare(getSortableName(b.name));
    });

    return { sortedQuests };
  }, [quests, character, onCormyr, ownedPacksFuzzySet, isDataLoaded, showRaids, durationAdjustments, sortConfig, isDebugMode, effectiveCharacterLevel]);

  const requestSort = (key: SortableLevelingGuideColumnKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';

    if (['experienceScore', 'maxExp'].includes(key)) {
      direction = 'descending';
    }

    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'descending') {
      setSortConfig({ key: 'experienceScore', direction: 'descending' });
      return;
    }
    const newSortConfig = { key, direction };
    setSortConfig(newSortConfig);
    savePreferences({ sortConfig: newSortConfig });
  };

  const getSortIndicator = (columnKey: SortableLevelingGuideColumnKey) => {
    if (!sortConfig || sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-3 w-3 text-accent" /> : <ArrowDown className="ml-2 h-3 w-3 text-accent" />;
  };
  
  const accountNameMap = useMemo(() => {
    return new Map(accounts.map(acc => [acc.id, acc.name]));
  }, [accounts]);
  
  const accountName = character ? accountNameMap.get(character.accountId) || 'Unknown' : '...';

  if (pageOverallLoading || !isDataLoaded || !character) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="mr-2 h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!currentUser) {
    return <div className="container mx-auto py-8 text-center"><AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" /><h1 className="text-2xl font-bold">Access Denied</h1><p className="text-muted-foreground mt-2">Please log in to view this page.</p><Button onClick={() => router.push('/login')} className="mt-6">Log In</Button></div>;
  }

  if (!character) {
     return <div className="flex justify-center items-center h-screen"><p>Character not found or access denied.</p></div>;
  }

  const { sortedQuests } = sortedAndFilteredData;
  const popoverVisibleNonDifficultyHeaders = allTableHeaders.filter(h => !difficultyColumnKeys.includes(h.key as any));
  const visibleTableHeaders = allTableHeaders.filter(h => columnVisibility[h.key as SortableLevelingGuideColumnKey]);

  return (
    <div className="py-8 space-y-8">
      <Card className="mb-8">
        <CardHeader>
            <div className="flex justify-between items-center">
                <CardTitle className="font-headline text-3xl flex items-center">
                  <Avatar className="mr-3 h-10 w-10 border-2 border-primary">
                      <AvatarImage src={character.iconUrl || undefined} alt={character.name} />
                      <AvatarFallback><UserCircle className="h-10 w-10 text-muted-foreground" /></AvatarFallback>
                  </Avatar>
                  {character.name}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => openEditModal(character)} disabled={pageOverallLoading}><Pencil className="mr-2 h-4 w-4" /> Edit Character</Button>
            </div>
            <CardDescription>
                Level {character.level} {(character.preferences?.useLevelOffset ?? false) ? `(Effective: ${effectiveCharacterLevel})` : ''}
                <span className="mx-2 text-muted-foreground">|</span>
                <Library className="inline-block h-4 w-4 mr-1.5 align-middle" />
                Account: <span className="font-semibold">{accountName}</span>
            </CardDescription>
             <div className="pt-4 flex flex-col space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="on-cormyr-guide" checked={onCormyr} onCheckedChange={(checked) => {setOnCormyr(!!checked); savePreferences({ onCormyr: !!checked });}} disabled={pageOverallLoading} />
                    <Label htmlFor="on-cormyr-guide" className={cn("font-normal", pageOverallLoading && "cursor-not-allowed opacity-50")}>On Cormyr</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="show-raids-guide" checked={showRaids} onCheckedChange={(checked) => {setShowRaids(!!checked); savePreferences({ showRaids: !!checked });}} disabled={pageOverallLoading} />
                    <Label htmlFor="show-raids-guide" className={cn("font-normal", pageOverallLoading && "cursor-not-allowed opacity-50")}>Include Raids</Label>
                  </div>
                   {userData?.isAdmin && (
                      <div className="flex items-center space-x-2">
                          <Checkbox id="debug-mode-guide" checked={isDebugMode} onCheckedChange={(checked) => setIsDebugMode(!!checked)} disabled={pageOverallLoading}/>
                          <Label htmlFor="debug-mode-guide" className={cn("font-normal text-destructive", pageOverallLoading && "cursor-not-allowed opacity-50")}>Debug</Label>
                      </div>
                    )}
                </div>
              </div>
              <div className="pt-2 border-t border-border mt-4 flex justify-between items-center">
                <div>
                    <Label className="text-sm font-medium block mb-2">On Quest Click</Label>
                    <RadioGroup value={clickAction} onValueChange={(value) => {setClickAction(value as 'none' | 'wiki' | 'map'); savePreferences({ clickAction: value as 'none' | 'wiki' | 'map' });}} className="flex items-center space-x-4" disabled={pageOverallLoading}>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="none" id="action-none-guide" /><Label htmlFor="action-none-guide" className="font-normal cursor-pointer">None</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="wiki" id="action-wiki-guide" /><Label htmlFor="action-wiki-guide" className="flex items-center font-normal cursor-pointer"><BookOpen className="mr-1.5 h-4 w-4"/>Show Wiki</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="map" id="action-map-guide" /><Label htmlFor="action-map-guide" className="font-normal cursor-pointer flex items-center"><MapPin className="mr-1.5 h-4 w-4"/>Show Map</Label></div>
                    </RadioGroup>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="use-level-offset-leveling" 
                    checked={character.preferences?.useLevelOffset ?? false} 
                    onCheckedChange={(checked) => {
                        saveSharedLevelOffset(!!checked, character.preferences?.levelOffset ?? 0);
                    }} 
                    disabled={pageOverallLoading}
                  />
                  <Label htmlFor="use-level-offset-leveling" className={cn("font-normal", pageOverallLoading && "cursor-not-allowed opacity-50")}>
                      Use LVL Offset:
                  </Label>
                  <Input
                    type="number"
                    id="level-offset-leveling"
                    value={character.preferences?.levelOffset ?? 0}
                    onChange={(e) => {
                        const newOffset = parseInt(e.target.value, 10);
                        if (!isNaN(newOffset)) {
                            saveSharedLevelOffset(character.preferences?.useLevelOffset ?? false, newOffset);
                        }
                    }}
                    className="h-8 w-20"
                    disabled={!(character.preferences?.useLevelOffset ?? false) || pageOverallLoading}
                  />
                </div>
              </div>
            </div>
        </CardHeader>
      </Card>
      <Card className="flex flex-col h-[80vh]">
        <CardHeader className="flex-shrink-0 bg-card border-b">
          <div className="flex justify-between items-center">
            <CardTitle className="font-headline flex items-center">
              <BookOpen className="mr-2 h-6 w-6 text-primary" /> Leveling Guide
              {isDebugMode && <span className="ml-2 text-xs font-normal text-muted-foreground">({sortedQuests.length} quests)</span>}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Link href={`/reaper-rewards/${characterId}`} passHref><Button variant="outline" size="sm" disabled={pageOverallLoading}><Skull className="mr-2 h-4 w-4" />Reaper Rewards</Button></Link>
              <Link href={`/favor-tracker/${characterId}`} passHref><Button variant="outline" size="sm" disabled={pageOverallLoading}><ListOrdered className="mr-2 h-4 w-4" />Favor Tracker</Button></Link>
              <Popover open={isSettingsPopoverOpen} onOpenChange={handleSettingsPopoverOpenChange}>
                <PopoverTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9" disabled={pageOverallLoading}><Settings className="h-4 w-4" /><span className="sr-only">Column Settings</span></Button></PopoverTrigger>
                <PopoverContent className="w-auto p-4 min-w-[280px] sm:min-w-[360px]">
                   <div className="space-y-4">
                    <h4 className="font-medium leading-none">Display Columns</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                      {popoverVisibleNonDifficultyHeaders.map(header => (
                        <div key={header.key} className="flex items-center space-x-2">
                          <Checkbox id={`vis-guide-${header.key}`} checked={!!popoverColumnVisibility[header.key as SortableLevelingGuideColumnKey]} onCheckedChange={(checked) => handlePopoverColumnVisibilityChange(header.key as SortableLevelingGuideColumnKey, !!checked)} />
                          <Label htmlFor={`vis-guide-${header.key}`} className="font-normal whitespace-nowrap">{header.label}</Label>
                        </div>
                      ))}
                    </div>
                    <Separator />
                    <h4 className="font-medium leading-none pt-2">EXP Columns</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                      {difficultyColumnKeys.map(key => (
                          <div key={key as string} className="flex items-center space-x-2">
                          <Checkbox id={`vis-guide-${key}`} checked={!!popoverColumnVisibility[key as SortableLevelingGuideColumnKey]} onCheckedChange={(checked) => handlePopoverColumnVisibilityChange(key as SortableLevelingGuideColumnKey, !!checked)} />
                          <Label htmlFor={`vis-guide-${key}`} className="font-normal whitespace-nowrap">{allTableHeaders.find(h=>h.key===key)?.label}</Label>
                          </div>
                      ))}
                    </div>
                    <Separator />
                     <div className="pt-2">
                        <Label className="text-sm font-medium block mb-2">Duration Adjustments (<Timer className="inline h-4 w-4 mr-1"/> Score Multiplier)</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                            {(Object.keys(durationAdjustments) as DurationCategory[]).map(category => (
                                <div key={category} className="space-y-1">
                                    <Label htmlFor={`guide-adj-${category.toLowerCase().replace(/\s+/g, '-')}`} className="text-xs">{category}</Label>
                                    <Input type="number" id={`guide-adj-${category.toLowerCase().replace(/\s+/g, '-')}`} value={durationAdjustments[category]}
                                        onChange={(e) => { const val = parseFloat(e.target.value); const newAdjs = {...durationAdjustments, [category]: isNaN(val) ? 0 : val}; handleDurationChange(newAdjs); }}
                                        step="0.1" className="h-8 text-sm" disabled={pageOverallLoading} placeholder="e.g. 1.0"/>
                                </div>
                            ))}
                        </div>
                    </div>
                    <DialogFooter className="pt-2">
                        <Button variant="ghost" onClick={handleCancelColumnSettings}>Cancel</Button>
                        <Button onClick={handleApplyColumnSettings}>Apply</Button>
                    </DialogFooter>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <CardDescription>
              Experience guide for {character.name}. Shows relevant Heroic or Epic EXP based on character level. Score is Max EXP adjusted by quest duration.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0">
          {pageOverallLoading && sortedQuests.length === 0 ? (
            <div className="p-6 text-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin mx-auto" /><p>Filtering quests...</p></div>
          ) : !pageOverallLoading && sortedQuests.length === 0 ? (
            <div className="p-6 text-center py-10">
              <p className="text-xl text-muted-foreground mb-4">No quests available for {character.name} based on current level and filters.</p>
              <img src="https://i.imgflip.com/2adszq.jpg" alt="Empty quest log" data-ai-hint="sad spongebob" className="mx-auto rounded-lg shadow-md max-w-xs" />
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
                <Table>
                <TableCaption className="py-4 sticky bottom-0 bg-card z-10">End of quest guide for {character.name} at level {effectiveCharacterLevel}.</TableCaption>
                <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-card hover:bg-card">
                    {visibleTableHeaders.map((header) => (
                        <TableHead key={header.key} className={cn(header.className)}>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    onClick={() => header.isSortable && requestSort(header.key as SortableLevelingGuideColumnKey)}
                                    className="p-0 h-auto hover:bg-transparent"
                                    disabled={pageOverallLoading || !header.isSortable}
                                >
                                    {header.icon && <header.icon className="mr-1.5 h-4 w-4" />}
                                    {header.label}
                                    {header.isSortable && getSortIndicator(header.key as SortableLevelingGuideColumnKey)}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{header.tooltip}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                    ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedQuests.map((quest) => (
                    <TooltipProvider key={quest.id} delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <TableRow
                              className={cn(clickAction !== 'none' && 'cursor-pointer', isDebugMode && (quest.hiddenReasons?.length ?? 0) > 0 && 'text-destructive/80 hover:text-destructive')}
                              onClick={() => handleRowClick(quest)}
                            >
                              {columnVisibility['name'] && <TableCell className="font-medium whitespace-nowrap">{quest.name}</TableCell>}
                              {columnVisibility['level'] && <TableCell className="text-center">{quest.level}</TableCell>}
                              {columnVisibility['adventurePackName'] && <TableCell className="whitespace-nowrap">{quest.adventurePackName || 'Free to Play'}</TableCell>}
                              {columnVisibility['location'] && <TableCell className="whitespace-nowrap">{quest.location || 'N/A'}</TableCell>}
                              {columnVisibility['questGiver'] && <TableCell className="whitespace-nowrap">{quest.questGiver || 'N/A'}</TableCell>}
                              {columnVisibility['adjustedCasualExp'] && <TableCell className="text-center">{(quest as any).adjustedCasualExp ?? '-'}</TableCell>}
                              {columnVisibility['adjustedNormalExp'] && <TableCell className="text-center">{(quest as any).adjustedNormalExp ?? '-'}</TableCell>}
                              {columnVisibility['adjustedHardExp'] && <TableCell className="text-center">{(quest as any).adjustedHardExp ?? '-'}</TableCell>}
                              {columnVisibility['adjustedEliteExp'] && <TableCell className="text-center">{(quest as any).adjustedEliteExp ?? '-'}</TableCell>}
                              {columnVisibility['maxExp'] && <TableCell className="text-center font-bold">{(quest as any).maxExp ?? '-'}</TableCell>}
                              {columnVisibility['experienceScore'] && <TableCell className="text-center">{(quest as any).experienceScore ?? '-'}</TableCell>}
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
