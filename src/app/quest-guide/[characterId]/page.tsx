
// src/app/quest-guide/[characterId]/page.tsx
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
import { UserCircle, ListOrdered, MapPin, UserSquare, ArrowUpDown, ArrowDown, ArrowUp, Package, Loader2, Settings, BookOpen, BarChartHorizontalBig, Timer, Activity, AlertTriangle, Pencil, Skull } from 'lucide-react';
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


type SortableQuestGuideColumnKey = 'name' | 'level' | 'adventurePackName' | 'location' | 'questGiver' | 'adjustedCasualExp' | 'adjustedNormalExp' | 'adjustedHardExp' | 'adjustedEliteExp' | 'maxExp' | 'experienceScore';
type ActualSortKey = 'experienceScore' | 'maxExp' | 'name' | 'level' | 'adventurePackName' | 'location' | 'questGiver';

interface SortConfig { key: ActualSortKey; direction: 'ascending' | 'descending'; }
type DurationCategory = "Very Short" | "Short" | "Medium" | "Long" | "Very Long";
const durationAdjustmentDefaults: Record<DurationCategory, number> = { "Very Short": 1.2, "Short": 1.1, "Medium": 1.0, "Long": 0.9, "Very Long": 0.8, };
const DURATION_CATEGORIES: DurationCategory[] = ["Very Short", "Short", "Medium", "Long", "Very Long"];

const getPrimaryLocation = (location?: string | null): string | null => {
  if (!location) return null;
  return location.split('(')[0].trim();
};

const getSortableName = (name: string): string => name.toLowerCase().replace(/^the\s+/i, '');

const tableHeaders: { key: SortableQuestGuideColumnKey | string; label: string; icon?: React.ElementType, className?: string, isSortable?: boolean, isDifficulty?: boolean }[] = [
    { key: 'name', label: 'Quest Name', className: "w-[250px] whitespace-nowrap", isSortable: true },
    { key: 'level', label: 'LVL', className: "text-center w-[80px]", isSortable: true },
    { key: 'adventurePackName', label: 'Adventure Pack', icon: Package, className: "w-[200px] whitespace-nowrap", isSortable: true },
    { key: 'location', label: 'Location', icon: MapPin, className: "w-[180px] whitespace-nowrap", isSortable: true },
    { key: 'questGiver', label: 'Quest Giver', icon: UserSquare, className: "w-[180px] whitespace-nowrap", isSortable: true },
    { key: 'adjustedCasualExp', label: 'C/S', icon: BarChartHorizontalBig, className: "text-center w-[100px]", isSortable: false, isDifficulty: true },
    { key: 'adjustedNormalExp', label: 'N', icon: BarChartHorizontalBig, className: "text-center w-[100px]", isSortable: false, isDifficulty: true },
    { key: 'adjustedHardExp', label: 'H', icon: BarChartHorizontalBig, className: "text-center w-[100px]", isSortable: false, isDifficulty: true },
    { key: 'adjustedEliteExp', label: 'E', icon: BarChartHorizontalBig, className: "text-center w-[100px]", isSortable: false, isDifficulty: true },
    { key: 'maxExp', label: 'Max EXP', icon: BarChartHorizontalBig, className: "text-center w-[120px]", isSortable: true },
    { key: 'experienceScore', label: 'Score', icon: Activity, className: "text-center w-[120px]", isSortable: true },
];
const difficultyColumnKeys: SortableQuestGuideColumnKey[] = ['adjustedCasualExp', 'adjustedNormalExp', 'adjustedHardExp', 'adjustedEliteExp'];
const getDefaultColumnVisibility = (): Record<SortableQuestGuideColumnKey, boolean> => { 
    const initial: Record<SortableQuestGuideColumnKey, boolean> = {} as any;
     tableHeaders.forEach(header => {
        if (['adventurePackName', 'questGiver'].includes(header.key)) {
            initial[header.key as SortableQuestGuideColumnKey] = false;
        } else {
            initial[header.key as SortableQuestGuideColumnKey] = true;
        }
    });
    return initial;
 };

interface QuestGuidePreferences {
  columnVisibility: Record<SortableQuestGuideColumnKey, boolean>;
  clickAction: 'none' | 'wiki' | 'map';
}

interface FavorTrackerPreferences {
  durationAdjustments: Record<DurationCategory, number>;
  onCormyr: boolean;
  showRaids: boolean;
}


function parseDurationToMinutes(durationString?: string | null): number | null { 
  if (!durationString || durationString.trim() === "") return null;
  let parsableString = durationString.toUpperCase();
  if (parsableString.startsWith('PT')) parsableString = parsableString.substring(2);
  if (parsableString.endsWith('M')) parsableString = parsableString.slice(0, -1);
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

const FREE_TO_PLAY_PACK_NAME_LOWERCASE = "free to play";

const normalizeAdventurePackNameForComparison = (name?: string | null): string => {
  if (!name) return "";
  const trimmedName = name.trim();
  const lowerName = trimmedName.toLowerCase();
  const withoutThe = lowerName.startsWith("the ") ? lowerName.substring(4) : lowerName;
  return withoutThe.replace(/[^a-z0-9]/g, '');
};

export default function QuestGuidePage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser, userData, isLoading: authIsLoading } = useAuth(); 
  const { characters, quests, ownedPacks, isDataLoaded, isLoading: appDataIsLoading, updateCharacter } = useAppData();
  const { toast } = useToast();

  const [character, setCharacter] = useState<Character | null>(null);
  const characterId = params.characterId as string;
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'experienceScore', direction: 'descending' });
  const [durationAdjustments, setDurationAdjustments] = useState<Record<DurationCategory, number>>(durationAdjustmentDefaults);
  const [onCormyr, setOnCormyr] = useState(false);
  const [showRaids, setShowRaids] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<SortableQuestGuideColumnKey, boolean>>(getDefaultColumnVisibility());
  const [popoverColumnVisibility, setPopoverColumnVisibility] = useState<Record<SortableQuestGuideColumnKey, boolean>>({});
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
  
  const saveQuestGuidePreference = useCallback((updatedPrefs: Partial<QuestGuidePreferences>) => {
    if (typeof window === 'undefined' || !characterId || !isDataLoaded || !currentUser) return;
    try { localStorage.setItem(`ddoToolkit_questGuidePrefs_${currentUser.uid}_${characterId}`, JSON.stringify({ ...(JSON.parse(localStorage.getItem(`ddoToolkit_questGuidePrefs_${currentUser.uid}_${characterId}`) || '{}')), ...updatedPrefs })); }
    catch (error) { console.error("Failed to save quest guide preferences:", error); toast({ title: "Error Saving View Settings", variant: "destructive" }); }
  }, [characterId, isDataLoaded, currentUser, toast]);

  useEffect(() => { 
    if (typeof window === 'undefined' || !characterId || !isDataLoaded || !currentUser) return;
    try {
        const storedFavorPrefs = localStorage.getItem(`ddoToolkit_charPrefs_${currentUser.uid}_${characterId}`);
        if (storedFavorPrefs) {
            const prefs = JSON.parse(storedFavorPrefs) as FavorTrackerPreferences;
            if (prefs.durationAdjustments) {
              const mergedAdjustments = { ...durationAdjustmentDefaults };
              for (const cat of DURATION_CATEGORIES) { if (prefs.durationAdjustments[cat] !== undefined && typeof prefs.durationAdjustments[cat] === 'number') mergedAdjustments[cat] = prefs.durationAdjustments[cat]; }
              setDurationAdjustments(mergedAdjustments);
            }
            if (typeof prefs.onCormyr === 'boolean') setOnCormyr(prefs.onCormyr);
            if (typeof prefs.showRaids === 'boolean') setShowRaids(prefs.showRaids);
        }
    } catch (error) { console.error("Error loading favor tracker preferences:", error); }
    try {
        const storedGuidePrefs = localStorage.getItem(`ddoToolkit_questGuidePrefs_${currentUser.uid}_${characterId}`);
         if (storedGuidePrefs) {
            const prefs = JSON.parse(storedGuidePrefs) as QuestGuidePreferences;
            if (prefs.clickAction && ['none', 'wiki', 'map'].includes(prefs.clickAction)) { setClickAction(prefs.clickAction); }
            const defaultVis = getDefaultColumnVisibility();
            const mergedVisibility: Record<SortableQuestGuideColumnKey, boolean> = {} as any;
            tableHeaders.forEach(header => { mergedVisibility[header.key as SortableQuestGuideColumnKey] = prefs.columnVisibility?.[header.key as SortableQuestGuideColumnKey] ?? defaultVis[header.key as SortableQuestGuideColumnKey]; });
            setColumnVisibility(mergedVisibility);
        }
    } catch (error) { console.error("Error loading quest guide preferences:", error); }
  }, [characterId, isDataLoaded, currentUser]);

  useEffect(() => { if (isDataLoaded && characterId && currentUser) saveQuestGuidePreference({ columnVisibility }); }, [columnVisibility, saveQuestGuidePreference, isDataLoaded, characterId, currentUser]);
  useEffect(() => { if (isDataLoaded && characterId && currentUser) saveQuestGuidePreference({ clickAction }); }, [clickAction, saveQuestGuidePreference, isDataLoaded, characterId, currentUser]);
  
  const handlePopoverColumnVisibilityChange = (key: SortableQuestGuideColumnKey, checked: boolean) => setPopoverColumnVisibility(prev => ({ ...prev, [key]: checked }));
  const handleApplyColumnSettings = () => { setColumnVisibility(popoverColumnVisibility); setIsSettingsPopoverOpen(false); };
  const handleCancelColumnSettings = () => setIsSettingsPopoverOpen(false);
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
    if (isDataLoaded && characterId && currentUser) {
      const foundCharacter = characters.find(c => c.id === characterId && c.userId === currentUser.uid);
      if (foundCharacter) setCharacter(foundCharacter);
      else { toast({ title: "Character not found", description: "This character may not exist or you don't have permission.", variant: "destructive" }); router.push('/'); }
    }
  }, [characterId, characters, isDataLoaded, currentUser, router, toast]);
  
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
  
  const sortedAndFilteredQuests = useMemo(() => {
    if (!character || !isDataLoaded || !quests) return [];

    const getRelevantQuestDetails = (quest: Quest, char: Character) => {
      const useEpic = quest.epicBaseLevel != null && char.level >= quest.epicBaseLevel;
      return { tier: useEpic ? 'Epic' : 'Heroic', baseLevel: useEpic ? quest.epicBaseLevel! : quest.level, casualExp: useEpic ? quest.epicCasualExp : quest.casualExp, normalExp: useEpic ? quest.epicNormalExp : quest.normalExp, hardExp: useEpic ? quest.epicHardExp : quest.hardExp, eliteExp: useEpic ? quest.epicEliteExp : quest.eliteExp, casualNotAvailable: useEpic ? quest.epicCasualNotAvailable : quest.casualNotAvailable, normalNotAvailable: useEpic ? quest.epicNormalNotAvailable : quest.normalNotAvailable, hardNotAvailable: useEpic ? quest.epicHardNotAvailable : quest.hardNotAvailable, eliteNotAvailable: useEpic ? quest.epicEliteNotAvailable : quest.eliteNotAvailable, };
    };

    const getHeroicPenaltyPercent = (charLevel: number, questEffectiveLevel: number): number => {
      if (charLevel >= 20) return 0; const levelDifference = charLevel - questEffectiveLevel;
      if (levelDifference <= 1) return 0;
      switch (levelDifference) { case 2: return 10; case 3: return 25; case 4: return 50; case 5: return 75; default: return 100; }
    };
    
    const calculateAdjustedExp = (quest: Quest, char: Character) => {
      const details = getRelevantQuestDetails(quest, char);
      const calc = (exp: number | null | undefined, notAvailable: boolean | null | undefined, effectiveLevel: number) => {
          if (!exp || notAvailable) return null;
          if (details.tier === 'Epic') {
              if (char.level < details.baseLevel) return null;
              const penalty = char.level - (effectiveLevel);
              if (penalty > 6) return null;
              return exp;
          }
          if (char.level < effectiveLevel) return null;
          if (char.level >= 20) return exp;
          const penaltyPercent = getHeroicPenaltyPercent(char.level, effectiveLevel);
          if (penaltyPercent >= 100) return null;
          return Math.round(exp * (1 - penaltyPercent / 100));
      };
      
      return {
          adjustedCasualExp: calc(details.casualExp, details.casualNotAvailable, details.baseLevel - 1),
          adjustedNormalExp: calc(details.normalExp, details.normalNotAvailable, details.baseLevel),
          adjustedHardExp: calc(details.hardExp, details.hardNotAvailable, details.baseLevel + 1),
          adjustedEliteExp: calc(details.eliteExp, details.eliteNotAvailable, details.baseLevel + 2),
      };
    };
    
    const allProcessedQuests = quests.map(quest => {
        const adjustedExps = calculateAdjustedExp(quest, character);
        const allExps = Object.values(adjustedExps).filter(v => v !== null) as number[];
        const maxExp = allExps.length > 0 ? Math.max(...allExps) : null;
        const durationCategory = getDurationCategory(quest.duration);
        const adjustmentFactor = durationCategory ? (durationAdjustments[durationCategory] ?? 1.0) : 1.0;
        const experienceScore = maxExp !== null ? Math.round(maxExp * adjustmentFactor) : null;

        const hiddenReasons: string[] = [];
        if (maxExp === null || maxExp <= 0) hiddenReasons.push('No eligible EXP for character level.');
        
        const fuzzyQuestPackKey = normalizeAdventurePackNameForComparison(quest.adventurePackName);
        const isActuallyFreeToPlay = fuzzyQuestPackKey === normalizeAdventurePackNameForComparison(FREE_TO_PLAY_PACK_NAME_LOWERCASE);
        const isOwned = isActuallyFreeToPlay || !quest.adventurePackName || ownedPacksFuzzySet.has(fuzzyQuestPackKey);
        if (!isOwned) hiddenReasons.push(`Pack not owned: ${quest.adventurePackName}`);
        
        if (!onCormyr && quest.name.toLowerCase() === "the curse of the five fangs") hiddenReasons.push('Hidden by "On Cormyr" filter.');
        
        if (!showRaids && quest.name.toLowerCase().endsWith('(raid)')) hiddenReasons.push('Is a Raid (hidden by filter).');
        
        if (quest.name.toLowerCase().includes("test")) hiddenReasons.push('Is a test quest.');

        return { ...quest, ...adjustedExps, maxExp, experienceScore, hiddenReasons };
    });

    const filteredQuests = isDebugMode
      ? allProcessedQuests
      : allProcessedQuests.filter(quest => quest.hiddenReasons.length === 0);

    return [...filteredQuests].sort((a, b) => {
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
  }, [quests, character, onCormyr, ownedPacksFuzzySet, isDataLoaded, showRaids, durationAdjustments, sortConfig, isDebugMode]);

  const requestSort = (key: ActualSortKey) => {
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
    setSortConfig({ key, direction });
  };
  
  const getSortIndicator = (columnKey: ActualSortKey) => { 
    if (!sortConfig || sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-3 w-3 text-accent" /> : <ArrowDown className="ml-2 h-3 w-3 text-accent" />; 
  };
  
  if (pageOverallLoading || !isDataLoaded || !character) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="mr-2 h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  if (!currentUser) {
    return <div className="container mx-auto py-8 text-center"><AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" /><h1 className="text-2xl font-bold">Access Denied</h1><p className="text-muted-foreground mt-2">Please log in to view this page.</p><Button onClick={() => router.push('/login')} className="mt-6">Log In</Button></div>;
  }
  
  if (!character) { 
     return <div className="flex justify-center items-center h-screen"><p>Character not found or access denied.</p></div>;
  }
  
  const popoverVisibleNonDifficultyHeaders = tableHeaders.filter(header => !header.isDifficulty);
  const visibleTableHeaders = tableHeaders.filter(h => columnVisibility[h.key as SortableQuestGuideColumnKey]);

  return (
    <div className="py-8 space-y-8">
      <Card className="mb-8">
        <CardHeader>
            <div className="flex justify-between items-center">
                <CardTitle className="font-headline text-3xl flex items-center"><UserCircle className="mr-3 h-8 w-8 text-primary" /> {character.name}</CardTitle>
                <Button variant="outline" size="sm" onClick={() => openEditModal(character)} disabled={pageOverallLoading}><Pencil className="mr-2 h-4 w-4" /> Edit Character</Button>
            </div>
            <CardDescription>Level {character.level}</CardDescription>
             <div className="pt-4 flex flex-col space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="on-cormyr-reaper" checked={onCormyr} onCheckedChange={(checked) => setOnCormyr(!!checked)} disabled={pageOverallLoading} />
                    <Label htmlFor="on-cormyr-reaper" className={cn("font-normal", pageOverallLoading && "cursor-not-allowed opacity-50")}>On Cormyr</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="show-raids-guide" checked={showRaids} onCheckedChange={(checked) => setShowRaids(!!checked)} disabled={pageOverallLoading} />
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
              <div className="pt-2 border-t border-border">
                  <Label className="text-sm font-medium block mb-2 mt-2">Duration Adjustments (<Timer className="inline h-4 w-4 mr-1"/> Score Multiplier)</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {(Object.keys(durationAdjustments) as DurationCategory[]).map(category => (
                          <div key={category} className="space-y-1">
                              <Label htmlFor={`guide-adj-${category.toLowerCase().replace(/\s+/g, '-')}`} className="text-xs">{category}</Label>
                              <Input type="number" id={`guide-adj-${category.toLowerCase().replace(/\s+/g, '-')}`} value={durationAdjustments[category]}
                                  onChange={(e) => { const val = parseFloat(e.target.value); if(!isNaN(val)) setDurationAdjustments(p => ({...p, [category]: val})); else if (e.target.value === "") setDurationAdjustments(p => ({...p, [category]:0})); }}
                                  step="0.1" className="h-8 text-sm" disabled={pageOverallLoading} placeholder="e.g. 1.0"/>
                          </div>
                      ))}
                  </div>
              </div>
              <div className="pt-2 border-t border-border mt-4">
                <Label className="text-sm font-medium block mb-2">On Quest Click</Label>
                <RadioGroup value={clickAction} onValueChange={(value) => setClickAction(value as 'none' | 'wiki' | 'map')} className="flex items-center space-x-4" disabled={pageOverallLoading}>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="none" id="action-none-guide" /><Label htmlFor="action-none-guide" className="font-normal cursor-pointer">None</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="wiki" id="action-wiki-guide" /><Label htmlFor="action-wiki-guide" className="flex items-center font-normal cursor-pointer"><BookOpen className="mr-1.5 h-4 w-4"/>Show Wiki</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="map" id="action-map-guide" /><Label htmlFor="action-map-guide" className="font-normal cursor-pointer flex items-center"><MapPin className="mr-1.5 h-4 w-4"/>Show Map</Label></div>
                </RadioGroup>
              </div>
            </div>
        </CardHeader>
      </Card>
      <Card className="sticky top-14 lg:top-[60px] z-20 flex flex-col max-h-[calc(70vh+5rem)]">
        <CardHeader className="bg-card border-b flex-shrink-0">
          <div className="flex justify-between items-center">
            <CardTitle className="font-headline flex items-center">
              <BookOpen className="mr-2 h-6 w-6 text-primary" /> Quest Guide
              {isDebugMode && <span className="ml-2 text-xs font-normal text-muted-foreground">({sortedAndFilteredQuests.length} quests)</span>}
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
                          <Checkbox id={`vis-guide-${header.key}`} checked={!!columnVisibility[header.key as SortableQuestGuideColumnKey]} onCheckedChange={(checked) => handlePopoverColumnVisibilityChange(header.key as SortableQuestGuideColumnKey, !!checked)} />
                          <Label htmlFor={`vis-guide-${header.key}`} className="font-normal whitespace-nowrap">{header.label}</Label>
                        </div>
                      ))}
                    </div>
                    <Separator />
                    <h4 className="font-medium leading-none pt-2">EXP Columns</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                      {difficultyColumnKeys.map(key => (
                          <div key={key} className="flex items-center space-x-2">
                          <Checkbox id={`vis-guide-${key}`} checked={!!columnVisibility[key]} onCheckedChange={(checked) => handlePopoverColumnVisibilityChange(key, !!checked)} />
                          <Label htmlFor={`vis-guide-${key}`} className="font-normal whitespace-nowrap">{tableHeaders.find(h=>h.key===key)?.label}</Label>
                          </div>
                      ))}
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
          <CardDescription>Experience guide for {character.name}. Shows relevant Heroic or Epic EXP based on character level. Score is Max EXP adjusted by quest duration.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0">
          {pageOverallLoading && sortedAndFilteredQuests.length === 0 ? (
            <div className="p-6 text-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin mx-auto" /> <p>Filtering quests...</p></div>
          ) : !pageOverallLoading && sortedAndFilteredQuests.length === 0 ? (
            <div className="p-6 text-center py-10">
              <p className="text-xl text-muted-foreground mb-4">No quests available for {character.name} based on current level and filters.</p>
              <img src="https://i.imgflip.com/2adszq.jpg" alt="Empty quest log" data-ai-hint="sad spongebob" className="mx-auto rounded-lg shadow-md max-w-xs" />
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
                <Table>
                <TableCaption className="py-4 sticky bottom-0 bg-card z-10">End of quest guide for {character.name} at level {character.level}.</TableCaption>
                <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                    {visibleTableHeaders.map((header) => (
                        <TableHead key={header.key} className={cn(header.className)}>
                        <Button 
                            variant="ghost" 
                            onClick={() => header.isSortable && requestSort(header.key as ActualSortKey)} 
                            className="p-0 h-auto hover:bg-transparent" 
                            disabled={pageOverallLoading || !header.isSortable}
                        >
                            {header.icon && <header.icon className="mr-1.5 h-4 w-4" />}
                            {header.label}
                            {header.isSortable && getSortIndicator(header.key as ActualSortKey)}
                        </Button>
                        </TableHead>
                    ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedAndFilteredQuests.map((quest) => (
                    <TooltipProvider key={quest.id} delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <TableRow 
                              className={cn(clickAction !== 'none' && 'cursor-pointer', isDebugMode && (quest.hiddenReasons?.length ?? 0) > 0 && 'text-destructive/80 hover:text-destructive')} 
                              onClick={() => handleRowClick(quest)}
                            >
                              {columnVisibility['name'] && <TableCell className="font-medium whitespace-nowrap">{quest.name}</TableCell>}
                              {columnVisibility['level'] && <TableCell className="text-center">{getRelevantQuestDetails(quest, character).baseLevel}</TableCell>}
                              {columnVisibility['adventurePackName'] && <TableCell className="whitespace-nowrap">{quest.adventurePackName || 'Free to Play'}</TableCell>}
                              {columnVisibility['location'] && <TableCell className="whitespace-nowrap">{quest.location || 'N/A'}</TableCell>}
                              {columnVisibility['questGiver'] && <TableCell className="whitespace-nowrap">{quest.questGiver || 'N/A'}</TableCell>}
                              {columnVisibility['adjustedCasualExp'] && <TableCell className="text-center">{quest.adjustedCasualExp ?? '-'}</TableCell>}
                              {columnVisibility['adjustedNormalExp'] && <TableCell className="text-center">{quest.adjustedNormalExp ?? '-'}</TableCell>}
                              {columnVisibility['adjustedHardExp'] && <TableCell className="text-center">{quest.adjustedHardExp ?? '-'}</TableCell>}
                              {columnVisibility['adjustedEliteExp'] && <TableCell className="text-center">{quest.adjustedEliteExp ?? '-'}</TableCell>}
                              {columnVisibility['maxExp'] && <TableCell className="text-center">{quest.maxExp ?? '-'}</TableCell>}
                              {columnVisibility['experienceScore'] && <TableCell className="text-center">{quest.experienceScore ?? '-'}</TableCell>}
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
