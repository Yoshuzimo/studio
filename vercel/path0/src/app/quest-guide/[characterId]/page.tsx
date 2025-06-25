
// src/app/quest-guide/[characterId]/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppData } from '@/context/app-data-context';
import type { Character, Quest } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
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

type SortableQuestGuideColumnKey = 'name' | 'level' | 'adventurePackName' | 'location' | 'questGiver' | 'adjustedCasualExp' | 'adjustedNormalExp' | 'adjustedHardExp' | 'adjustedEliteExp' | 'maxExp' | 'experienceScore';
type ActualSortKey = 'experienceScore' | 'maxExp';

interface SortConfig { key: ActualSortKey; direction: 'descending'; }
type DurationCategory = "Very Short" | "Short" | "Medium" | "Long" | "Very Long";
const durationAdjustmentDefaults: Record<DurationCategory, number> = { "Very Short": 1.2, "Short": 1.1, "Medium": 1.0, "Long": 0.9, "Very Long": 0.8, };
const DURATION_CATEGORIES: DurationCategory[] = ["Very Short", "Short", "Medium", "Long", "Very Long"];

const tableHeaders: { key: SortableQuestGuideColumnKey; label: string; icon?: React.ElementType, className?: string, isSortable?: boolean, isDifficulty?: boolean }[] = [
    { key: 'name', label: 'Quest Name', className: "w-[250px] whitespace-nowrap", isSortable: false },
    { key: 'level', label: 'LVL', className: "text-center w-[80px]", isSortable: false },
    { key: 'adventurePackName', label: 'Adventure Pack', icon: Package, className: "w-[200px] whitespace-nowrap", isSortable: false },
    { key: 'location', label: 'Location', icon: MapPin, className: "w-[180px] whitespace-nowrap", isSortable: false },
    { key: 'questGiver', label: 'Quest Giver', icon: UserSquare, className: "w-[180px] whitespace-nowrap", isSortable: false },
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
            initial[header.key] = false;
        } else {
            initial[header.key] = true;
        }
    });
    return initial;
 };

interface QuestGuidePreferences { columnVisibility: Record<SortableQuestGuideColumnKey, boolean>; }
interface FavorTrackerPreferences { durationAdjustments: Record<DurationCategory, number>; onCormyr: boolean; showAllAdventurePacks: boolean; }

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

export default function QuestGuidePage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser, isLoading: authIsLoading } = useAuth(); 
  const { characters, quests, ownedPacks, isDataLoaded, isLoading: appDataIsLoading, updateCharacter } = useAppData();
  const { toast } = useToast();

  const [character, setCharacter] = useState<Character | null>(null);
  const characterId = params.characterId as string;
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'experienceScore', direction: 'descending' });
  const [durationAdjustments, setDurationAdjustments] = useState<Record<DurationCategory, number>>(durationAdjustmentDefaults);
  const [onCormyr, setOnCormyr] = useState(false);
  const [showAllAdventurePacks, setShowAllAdventurePacks] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<SortableQuestGuideColumnKey, boolean>>(getDefaultColumnVisibility());
  const [popoverColumnVisibility, setPopoverColumnVisibility] = useState<Record<SortableQuestGuideColumnKey, boolean>>({});
  const [isSettingsPopoverOpen, setIsSettingsPopoverOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);

  const pageOverallLoading = authIsLoading || appDataIsLoading;

  useEffect(() => {
    if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router]);

  const saveSharedPreference = useCallback((updatedPrefs: Partial<FavorTrackerPreferences>) => {
    if (typeof window === 'undefined' || !characterId || !isDataLoaded || !currentUser) return;
    try { localStorage.setItem(`ddoToolkit_favorTrackerPrefs_${currentUser.uid}_${characterId}`, JSON.stringify({ ...(JSON.parse(localStorage.getItem(`ddoToolkit_favorTrackerPrefs_${currentUser.uid}_${characterId}`) || '{}')), ...updatedPrefs })); } 
    catch (error) { console.error("Failed to save shared preferences:", error); toast({ title: "Error Saving Preferences", variant: "destructive" }); }
  }, [characterId, isDataLoaded, currentUser, toast]);

  const saveQuestGuidePreference = useCallback((updatedPrefs: Partial<QuestGuidePreferences>) => {
    if (typeof window === 'undefined' || !characterId || !isDataLoaded || !currentUser) return;
    try { localStorage.setItem(`ddoToolkit_questGuidePrefs_${currentUser.uid}_${characterId}`, JSON.stringify({ ...(JSON.parse(localStorage.getItem(`ddoToolkit_questGuidePrefs_${currentUser.uid}_${characterId}`) || '{}')), ...updatedPrefs })); }
    catch (error) { console.error("Failed to save quest guide preferences:", error); toast({ title: "Error Saving View Settings", variant: "destructive" }); }
  }, [characterId, isDataLoaded, currentUser, toast]);

  useEffect(() => { 
    if (typeof window === 'undefined' || !characterId || !isDataLoaded || !currentUser) return;
    try {
        const storedFavorPrefs = localStorage.getItem(`ddoToolkit_favorTrackerPrefs_${currentUser.uid}_${characterId}`);
        if (storedFavorPrefs) {
            const prefs = JSON.parse(storedFavorPrefs) as FavorTrackerPreferences;
            if (prefs.durationAdjustments) {
              const mergedAdjustments = { ...durationAdjustmentDefaults };
              for (const cat of DURATION_CATEGORIES) { if (prefs.durationAdjustments[cat] !== undefined && typeof prefs.durationAdjustments[cat] === 'number') mergedAdjustments[cat] = prefs.durationAdjustments[cat]; }
              setDurationAdjustments(mergedAdjustments);
            }
            if (typeof prefs.onCormyr === 'boolean') setOnCormyr(prefs.onCormyr);
            if (typeof prefs.showAllAdventurePacks === 'boolean') setShowAllAdventurePacks(prefs.showAllAdventurePacks);
        }
    } catch (error) { console.error("Error loading favor tracker preferences:", error); }
    try {
        const storedGuidePrefs = localStorage.getItem(`ddoToolkit_questGuidePrefs_${currentUser.uid}_${characterId}`);
         if (storedGuidePrefs) {
            const prefs = JSON.parse(storedGuidePrefs) as QuestGuidePreferences;
            const defaultVis = getDefaultColumnVisibility();
            const mergedVisibility: Record<SortableQuestGuideColumnKey, boolean> = {} as any;
            tableHeaders.forEach(header => { mergedVisibility[header.key] = prefs.columnVisibility?.[header.key] ?? defaultVis[header.key]; });
            setColumnVisibility(mergedVisibility);
        }
    } catch (error) { console.error("Error loading quest guide preferences:", error); }
  }, [characterId, isDataLoaded, currentUser]);

  useEffect(() => { if (isDataLoaded && characterId && currentUser) saveSharedPreference({ durationAdjustments }); }, [durationAdjustments, saveSharedPreference, isDataLoaded, characterId, currentUser]);
  useEffect(() => { if (isDataLoaded && characterId && currentUser) saveSharedPreference({ onCormyr }); }, [onCormyr, saveSharedPreference, isDataLoaded, characterId, currentUser]);
  useEffect(() => { if (isDataLoaded && characterId && currentUser) saveSharedPreference({ showAllAdventurePacks }); }, [showAllAdventurePacks, saveSharedPreference, isDataLoaded, characterId, currentUser]);
  
  const handlePopoverColumnVisibilityChange = (key: SortableQuestGuideColumnKey, checked: boolean) => setPopoverColumnVisibility(prev => ({ ...prev, [key]: checked }));
  const handleApplyColumnSettings = () => { setColumnVisibility(popoverColumnVisibility); saveQuestGuidePreference({ columnVisibility: popoverColumnVisibility }); setIsSettingsPopoverOpen(false); };
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

  const getRelevantQuestDetails = useCallback((quest: Quest, char: Character) => {
    const useEpic = quest.epicBaseLevel != null && char.level >= quest.epicBaseLevel;
    return {
      tier: useEpic ? 'Epic' : 'Heroic',
      baseLevel: useEpic ? quest.epicBaseLevel! : quest.level,
      casualExp: useEpic ? quest.epicCasualExp : quest.casualExp,
      normalExp: useEpic ? quest.epicNormalExp : quest.normalExp,
      hardExp: useEpic ? quest.epicHardExp : quest.hardExp,
      eliteExp: useEpic ? quest.epicEliteExp : quest.eliteExp,
      casualNotAvailable: useEpic ? quest.epicCasualNotAvailable : quest.casualNotAvailable,
      normalNotAvailable: useEpic ? quest.epicNormalNotAvailable : quest.normalNotAvailable,
      hardNotAvailable: useEpic ? quest.epicHardNotAvailable : quest.hardNotAvailable,
      eliteNotAvailable: useEpic ? quest.epicEliteNotAvailable : quest.eliteNotAvailable,
    };
  }, []);

  const getHeroicPenaltyPercent = useCallback((charLevel: number, questEffectiveLevel: number): number => {
    const levelDifference = charLevel - questEffectiveLevel;

    if (levelDifference <= 1) return 0;
    switch (levelDifference) {
      case 2: return 10;
      case 3: return 25;
      case 4: return 50;
      case 5: return 75;
      default: return 100; // 6 or more levels over
    }
  }, []);

  const calculateAdjustedCasualExp = useCallback((quest: Quest, char: Character | null): number | null => { 
    if (!char) return null;
    const { baseLevel, casualExp, casualNotAvailable } = getRelevantQuestDetails(quest, char);
    if (!casualExp || casualNotAvailable) return null;
    const effectiveLevel = baseLevel - 2; // For C/S
    if (char.level < effectiveLevel) return null;
    const penalty = getHeroicPenaltyPercent(char.level, effectiveLevel);
    if (penalty >= 100) return null;
    return Math.round(casualExp * (1 - penalty / 100));
  }, [getRelevantQuestDetails, getHeroicPenaltyPercent]);
  
  const calculateAdjustedNormalExp = useCallback((quest: Quest, char: Character | null): number | null => { 
    if (!char) return null;
    const { baseLevel, normalExp, normalNotAvailable } = getRelevantQuestDetails(quest, char);
    if (!normalExp || normalNotAvailable) return null;

    const effectiveLevel = baseLevel;
    if (char.level < effectiveLevel) return null;

    const penalty = getHeroicPenaltyPercent(char.level, effectiveLevel);
    if (penalty >= 100) return null;
    return Math.round(normalExp * (1 - penalty / 100));
   }, [getRelevantQuestDetails, getHeroicPenaltyPercent]);

  const calculateAdjustedHardExp = useCallback((quest: Quest, char: Character | null): number | null => { 
    if (!char) return null;
    const { baseLevel, hardExp, hardNotAvailable } = getRelevantQuestDetails(quest, char);
    if (!hardExp || hardNotAvailable) return null;
    
    const effectiveLevel = baseLevel + 1;
    if (char.level < effectiveLevel) return null;

    const penalty = getHeroicPenaltyPercent(char.level, effectiveLevel);
    if (penalty >= 100) return null;
    return Math.round(hardExp * (1 - penalty / 100));
  }, [getRelevantQuestDetails, getHeroicPenaltyPercent]);

  const calculateAdjustedEliteExp = useCallback((quest: Quest, char: Character | null): number | null => {
    if (!char) return null;
    const { baseLevel, eliteExp, eliteNotAvailable } = getRelevantQuestDetails(quest, char);
    if (!eliteExp || eliteNotAvailable) return null;
    
    const effectiveLevel = baseLevel + 2;
    if (char.level < effectiveLevel) return null;
    
    // Special rule: No penalty for Elite if the effective level is 20 or higher.
    if (effectiveLevel >= 20) {
      return eliteExp; // No penalty
    }

    // Standard heroic penalty for sub-20 elite quests
    const penalty = getHeroicPenaltyPercent(char.level, effectiveLevel);
    if (penalty >= 100) return null;
    return Math.round(eliteExp * (1 - penalty / 100));
  }, [getRelevantQuestDetails, getHeroicPenaltyPercent]);
  
  const calculateMaxExp = useCallback((quest: Quest, char: Character | null): number | null => { 
    if (!char) return null;
    const exps = [
        calculateAdjustedCasualExp(quest, char),
        calculateAdjustedNormalExp(quest, char),
        calculateAdjustedHardExp(quest, char),
        calculateAdjustedEliteExp(quest, char)
    ].filter(exp => exp !== null) as number[];
    return exps.length > 0 ? Math.max(...exps) : null;
  }, [calculateAdjustedCasualExp, calculateAdjustedNormalExp, calculateAdjustedHardExp, calculateAdjustedEliteExp]);
  
  const calculateExperienceScore = useCallback((quest: Quest, char: Character | null): number | null => { 
    const maxExp = calculateMaxExp(quest, char);
    if (maxExp === null) return null;
    const durationCategory = getDurationCategory(quest.duration);
    const adjustmentFactor = durationCategory ? (durationAdjustments[durationCategory] ?? 1.0) : 1.0;
    return Math.round(maxExp * adjustmentFactor);
  }, [durationAdjustments, calculateMaxExp]);

  const filteredQuests = useMemo(() => {
    if (!character || !isDataLoaded || !quests) return [];
    return quests.filter(quest => {
      const maxPossibleExp = calculateMaxExp(quest, character);
      if (maxPossibleExp === null || maxPossibleExp <= 0) {
        return false;
      }

      const isActuallyFreeToPlay = quest.adventurePackName?.toLowerCase() === FREE_TO_PLAY_PACK_NAME_LOWERCASE;
      const isOwned =
        isActuallyFreeToPlay ||
        !quest.adventurePackName || 
        showAllAdventurePacks ||
        (quest.adventurePackName && ownedPacks.some(op => op.toLowerCase() === quest.adventurePackName!.toLowerCase()));
        
      const isNotOnCormyrQuest = !onCormyr || quest.name.toLowerCase() !== "the curse of the five fangs";
      const isTestQuest = quest.name.toLowerCase().includes("test");

      return isOwned && isNotOnCormyrQuest && !isTestQuest;
    });
  }, [quests, character, onCormyr, ownedPacks, isDataLoaded, showAllAdventurePacks, calculateMaxExp]);

  const getSortableName = (name: string) => name.toLowerCase().replace(/^(a|an|the)\s+/i, '');
  
  const sortedQuests = useMemo(() => {
    let sortableQuests = [...filteredQuests];
    if (sortConfig !== null && character) {
      sortableQuests.sort((a, b) => {
        let aValue: string | number | null | undefined;
        let bValue: string | number | null | undefined;

        if (sortConfig.key === 'experienceScore') {
            aValue = calculateExperienceScore(a, character);
            bValue = calculateExperienceScore(b, character);
        } else if (sortConfig.key === 'maxExp') {
            aValue = calculateMaxExp(a, character);
            bValue = calculateMaxExp(b, character);
        } else { 
            aValue = a[sortConfig.key as keyof Quest]; 
            bValue = b[sortConfig.key as keyof Quest];
        }
        
        if (aValue === null || aValue === undefined) aValue = sortConfig.direction === 'ascending' ? Infinity : -Infinity;
        if (bValue === null || bValue === undefined) bValue = sortConfig.direction === 'ascending' ? Infinity : -Infinity;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableQuests;
  }, [filteredQuests, sortConfig, character, calculateExperienceScore, calculateMaxExp]);

  const requestSort = (key: ActualSortKey) => setSortConfig({ key, direction: 'descending' });
  const getSortIndicator = (columnKey: SortableQuestGuideColumnKey) => { 
    if (!sortConfig || sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return <ArrowDown className="ml-2 h-3 w-3 text-accent" />; 
  };
  
  if (authIsLoading || (!currentUser && !authIsLoading) || (!character && isDataLoaded && currentUser)) {
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
                    <Checkbox id="on-cormyr" checked={onCormyr} onCheckedChange={(checked) => setOnCormyr(!!checked)} disabled={pageOverallLoading} />
                    <Label htmlFor="on-cormyr" className={cn("font-normal", pageOverallLoading && "cursor-not-allowed opacity-50")}>On Cormyr</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="show-all-packs-guide" checked={showAllAdventurePacks} onCheckedChange={(checked) => setShowAllAdventurePacks(!!checked)} disabled={pageOverallLoading} />
                    <Label htmlFor="show-all-packs-guide" className={cn("font-normal", pageOverallLoading && "cursor-not-allowed opacity-50")}>Show All Packs</Label>
                  </div>
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
            </div>
        </CardHeader>
      </Card>
      <Card className="sticky top-14 lg:top-[60px] z-20 flex flex-col max-h-[calc(70vh+5rem)]">
        <CardHeader className="bg-card border-b">
          <div className="flex justify-between items-center">
            <CardTitle className="font-headline flex items-center"><BookOpen className="mr-2 h-6 w-6 text-primary" /> Quest Guide</CardTitle>
            <div className="flex items-center space-x-2">
              <Link href={`/reaper-rewards/${characterId}`} passHref><Button variant="outline" size="sm" disabled={pageOverallLoading}><Skull className="mr-2 h-4 w-4" />Reaper Rewards</Button></Link>
              <Link href={`/favor-tracker/${characterId}`} passHref><Button variant="outline" size="sm" disabled={pageOverallLoading}><ListOrdered className="mr-2 h-4 w-4" />Favor Tracker</Button></Link>
              <Popover open={isSettingsPopoverOpen} onOpenChange={handleSettingsPopoverOpenChange}>
                <PopoverTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9" disabled={pageOverallLoading}><Settings className="h-4 w-4" /><span className="sr-only">Column Settings</span></Button></PopoverTrigger>
                <PopoverContent className="w-auto p-4 min-w-[280px] sm:min-w-[360px]">
                   <div className="space-y-4">
                    <h4 className="font-medium leading-none">Display Columns</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                      {tableHeaders.filter(h => !h.isDifficulty).map(header => (
                        <div key={header.key} className="flex items-center space-x-2">
                          <Checkbox id={`vis-guide-${header.key}`} checked={popoverColumnVisibility[header.key as SortableQuestGuideColumnKey]} onCheckedChange={(checked) => handlePopoverColumnVisibilityChange(header.key as SortableQuestGuideColumnKey, !!checked)} />
                          <Label htmlFor={`vis-guide-${header.key}`} className="font-normal whitespace-nowrap">{header.label}</Label>
                        </div>
                      ))}
                    </div>
                    <Separator />
                    <h4 className="font-medium leading-none pt-2">EXP Columns</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                      {tableHeaders.filter(h => h.isDifficulty).map(header => (
                        <div key={header.key} className="flex items-center space-x-2">
                          <Checkbox id={`vis-guide-${header.key}`} checked={popoverColumnVisibility[header.key as SortableQuestGuideColumnKey]} onCheckedChange={(checked) => handlePopoverColumnVisibilityChange(header.key as SortableQuestGuideColumnKey, !!checked)} />
                          <Label htmlFor={`vis-guide-${header.key}`} className="font-normal whitespace-nowrap">{header.label}</Label>
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
        <CardContent className="pt-6 flex-grow overflow-y-auto">
          {pageOverallLoading && sortedQuests.length === 0 && filteredQuests.length > 0 ? (
            <div className="text-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin mx-auto" /> <p>Filtering quests...</p></div>
          ) : !pageOverallLoading && sortedQuests.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xl text-muted-foreground mb-4">No quests available for {character.name} based on current level and filters.</p>
              <img src="https://i.imgflip.com/2adszq.jpg" alt="Empty quest log" data-ai-hint="sad spongebob" className="mx-auto rounded-lg shadow-md max-w-xs" />
            </div>
          ) : (
            <div className="overflow-x-auto">
                <Table>
                <TableCaption className="py-4">End of quest guide for {character.name} at level {character.level}.</TableCaption>
                <TableHeader>
                    <TableRow>
                    {tableHeaders.filter(h => columnVisibility[h.key as SortableQuestGuideColumnKey]).map((header) => (
                        <TableHead key={header.key} className={cn("sticky top-0 bg-card z-10", header.className)}>
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
                    {sortedQuests.map((quest) => (
                    <TableRow key={quest.id} className={cn(getRelevantQuestDetails(quest, character).baseLevel > character.level ? 'opacity-60' : '')}>
                        {columnVisibility['name'] && <TableCell className="font-medium whitespace-nowrap">{quest.name}</TableCell>}
                        {columnVisibility['level'] && <TableCell className="text-center">{getRelevantQuestDetails(quest, character).baseLevel}</TableCell>}
                        {columnVisibility['adventurePackName'] && <TableCell className="whitespace-nowrap">{quest.adventurePackName || 'Free to Play'}</TableCell>}
                        {columnVisibility['location'] && <TableCell className="whitespace-nowrap">{quest.location || 'N/A'}</TableCell>}
                        {columnVisibility['questGiver'] && <TableCell className="whitespace-nowrap">{quest.questGiver || 'N/A'}</TableCell>}
                        {columnVisibility['adjustedCasualExp'] && <TableCell className="text-center">{calculateAdjustedCasualExp(quest, character) ?? '-'}</TableCell>}
                        {columnVisibility['adjustedNormalExp'] && <TableCell className="text-center">{calculateAdjustedNormalExp(quest, character) ?? '-'}</TableCell>}
                        {columnVisibility['adjustedHardExp'] && <TableCell className="text-center">{calculateAdjustedHardExp(quest, character) ?? '-'}</TableCell>}
                        {columnVisibility['adjustedEliteExp'] && <TableCell className="text-center">{calculateAdjustedEliteExp(quest, character) ?? '-'}</TableCell>}
                        {columnVisibility['maxExp'] && <TableCell className="text-center">{calculateMaxExp(quest, character) ?? '-'}</TableCell>}
                        {columnVisibility['experienceScore'] && <TableCell className="text-center">{calculateExperienceScore(quest, character) ?? '-'}</TableCell>}
                    </TableRow>
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
    </div>
  );
}
