
// src/app/reaper-rewards/[characterId]/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppData } from '@/context/app-data-context';
import type { Character, Quest } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { UserCircle, MapPin, ArrowUpDown, ArrowDown, ArrowUp, Package, Loader2, Settings, BookOpen, AlertTriangle, Skull, ListOrdered, Pencil, UserSquare, TestTube2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { CharacterForm, type CharacterFormData } from '@/components/character/character-form';
import { DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { QuestWikiPopover } from '@/components/shared/quest-wiki-popover';
import { QuestMapViewer } from '@/components/shared/quest-map-viewer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type SortableReaperColumnKey = 'name' | 'level' | 'adventurePackName' | 'location' | 'questGiver' | 'maxRXP' | `skull-${number}`;

interface SortConfig {
  key: SortableReaperColumnKey;
  direction: 'ascending' | 'descending';
}

type DurationCategory = "Very Short" | "Short" | "Medium" | "Long" | "Very Long";

const reaperLengthAdjustments: Record<DurationCategory, number> = {
  "Very Short": 0.8,
  "Short": 0.8,
  "Medium": 1.0,
  "Long": 1.2,
  "Very Long": 1.4,
};

const getPrimaryLocation = (location?: string | null): string | null => {
  if (!location) return null;
  return location.split('(')[0].trim();
};

const getSortableName = (name: string): string => name.toLowerCase().replace(/^the\s+/i, '');

function parseDurationToMinutes(durationString?: string | null): number | null {
  if (!durationString || durationString.trim() === "") return null;
  let parsableString = durationString.toUpperCase();
  if (parsableString.startsWith('PT')) parsableString = parsableString.substring(2);
  if (parsableString.endsWith('M')) parsableString = parsableString.slice(0, -1);
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
  if (minutes <= 5) return "Very Short";
  if (minutes <= 10) return "Short";
  if (minutes <= 20) return "Medium";
  if (minutes <= 30) return "Long";
  return "Very Long";
}

const tableHeaders: { key: SortableReaperColumnKey | string; label: string; tooltip: string; icon?: React.ElementType, className?: string, isSortable?: boolean }[] = [
    { key: 'name', label: 'Quest Name', tooltip: "The name of the quest.", className: "w-[250px] whitespace-nowrap", isSortable: true },
    { key: 'level', label: 'LVL', tooltip: "The base level of the quest.", className: "text-center w-[80px]", isSortable: true },
    { key: 'adventurePackName', label: 'Adventure Pack', tooltip: "The Adventure Pack this quest belongs to.", icon: Package, className: "w-[200px] whitespace-nowrap", isSortable: true },
    { key: 'location', label: 'Location', tooltip: "The in-game location where this quest is found.", icon: MapPin, className: "w-[180px] whitespace-nowrap", isSortable: true },
    { key: 'questGiver', label: 'Quest Giver', tooltip: "The NPC who gives the quest.", icon: UserSquare, className: "w-[180px] whitespace-nowrap", isSortable: true },
    { key: 'maxRXP', label: 'Max RXP', tooltip: "The maximum Reaper Experience (RXP) obtainable from this quest (at 10 skulls), adjusted for quest length.", icon: Skull, className: "text-center w-[120px]", isSortable: true },
];

const skullColumns = Array.from({ length: 10 }, (_, i) => ({
  key: `skull-${i + 1}`,
  label: `${i + 1}`,
  tooltip: `Estimated Reaper Experience (RXP) for completing this quest on ${i + 1} skull(s).`,
  className: "text-center w-[100px]",
  isSortable: true,
}));

const allTableHeaders = [...tableHeaders, ...skullColumns];

const getDefaultColumnVisibility = (): Record<string, boolean> => {
    const initial: Record<string, boolean> = {};
    allTableHeaders.forEach(header => {
        initial[header.key] = !['adventurePackName', 'location', 'questGiver'].includes(header.key);
    });
    return initial;
};

interface ReaperRewardsPreferences {
  columnVisibility: Record<string, boolean>;
  onCormyr: boolean;
  showRaids: boolean;
  clickAction: 'none' | 'wiki' | 'map';
  sortConfig?: SortConfig | null;
}

const FREE_TO_PLAY_PACK_NAME_LOWERCASE = "free to play";

const normalizeAdventurePackNameForComparison = (name?: string | null): string => {
  if (!name) return "";
  const trimmedName = name.trim();
  const lowerName = trimmedName.toLowerCase();
  const withoutThe = lowerName.startsWith("the ") ? lowerName.substring(4) : lowerName;
  return withoutThe.replace(/[^a-z0-9]/g, '');
};

export default function ReaperRewardsPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser, userData, isLoading: authIsLoading } = useAuth();
  const { characters, quests, ownedPacks, isDataLoaded, isLoading: appDataIsLoading, updateCharacter, refetchCharacter } = useAppData();
  const { toast } = useToast();

  const [character, setCharacter] = useState<Character | null>(null);
  const characterId = params.characterId as string;
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'level', direction: 'ascending' });
  
  const [onCormyr, setOnCormyr] = useState(false);
  const [showRaids, setShowRaids] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(getDefaultColumnVisibility());
  const [popoverColumnVisibility, setPopoverColumnVisibility] = useState<Record<string, boolean>>({});
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

  const savePreferences = useCallback((newPrefs: Partial<ReaperRewardsPreferences>) => {
    if (typeof window === 'undefined' || !characterId || !isDataLoaded || !currentUser || !character) return;
    try {
      const localKey = `ddoToolkit_reaperPrefs_${currentUser.uid}_${characterId}`;
      const existingPrefsString = localStorage.getItem(localKey);
      const existingPrefs = existingPrefsString ? JSON.parse(existingPrefsString) : {};
      const fullPrefs = { ...existingPrefs, ...newPrefs };
      localStorage.setItem(localKey, JSON.stringify(fullPrefs));

      const updatedCharacter: Character = {
        ...character,
        preferences: {
          ...(character.preferences || {}),
          reaperRewards: {
            ...(character.preferences?.reaperRewards || {}),
            ...newPrefs,
          },
        },
      };

      setCharacter(updatedCharacter);
      updateCharacter(updatedCharacter);
    } catch (error) {
      console.error("Failed to save preferences:", error);
    }
  }, [characterId, isDataLoaded, currentUser, character, updateCharacter]);

  useEffect(() => {
    if (typeof window !== 'undefined' && characterId && isDataLoaded && currentUser && character) {
      try {
        const localKey = `ddoToolkit_reaperPrefs_${currentUser.uid}_${characterId}`;
        const lastRefreshKey = `ddoToolkit_lastRefresh_${currentUser.uid}_${characterId}`;
        let localPrefsString = localStorage.getItem(localKey);
        
        const loadFromCharacterObject = (charObj: Character) => {
          const serverPrefs = charObj.preferences?.reaperRewards;
          if (serverPrefs) {
            localStorage.setItem(localKey, JSON.stringify(serverPrefs));
            localStorage.setItem(lastRefreshKey, Date.now().toString());
            localPrefsString = JSON.stringify(serverPrefs);
          }
        };

        if (!localPrefsString) {
          loadFromCharacterObject(character);
        }

        const prefs = localPrefsString ? JSON.parse(localPrefsString) : character.preferences?.reaperRewards;
        
        if (prefs) {
          setOnCormyr(prefs.onCormyr ?? false);
          setShowRaids(prefs.showRaids ?? false);
          setClickAction(prefs.clickAction ?? 'none');
          setSortConfig(prefs.sortConfig ?? {key: 'level', direction: 'ascending'});
          
          const defaultVis = getDefaultColumnVisibility();
          const mergedVisibility = { ...defaultVis, ...(prefs.columnVisibility || {}) };
          setColumnVisibility(mergedVisibility);
        } else {
          setColumnVisibility(getDefaultColumnVisibility());
          setOnCormyr(false);
          setShowRaids(false);
          setClickAction('none');
          setSortConfig({key: 'level', direction: 'ascending'});
        }
      } catch (error) {
        console.error("Error loading preferences:", error);
        setColumnVisibility(getDefaultColumnVisibility());
      }
    }
  }, [characterId, isDataLoaded, currentUser, character]);

  const handlePopoverColumnVisibilityChange = (key: string, checked: boolean) => {
    setPopoverColumnVisibility(prev => ({ ...prev, [key]: checked }));
  };
  const handleApplyColumnSettings = () => {
    setColumnVisibility(popoverColumnVisibility);
    savePreferences({ columnVisibility: popoverColumnVisibility });
    setIsSettingsPopoverOpen(false);
  };
  const handleCancelColumnSettings = () => setIsSettingsPopoverOpen(false);
  const handleSettingsPopoverOpenChange = (open: boolean) => {
    if (open) setPopoverColumnVisibility(columnVisibility);
    setIsSettingsPopoverOpen(open);
  };

  const handleEditCharacterSubmit = async (data: CharacterFormData, id?: string, iconUrl?: string) => {
    if (!id || !editingCharacter) return;
    const charToUpdate = characters.find(c => c.id === id);
    if (!charToUpdate) return;
    
    await updateCharacter({ ...charToUpdate, name: data.name, level: data.level, iconUrl });
    const freshChar = await refetchCharacter(id);
    if(freshChar) setCharacter(freshChar);
    
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
      if (foundCharacter) {
        setCharacter(foundCharacter);
      } else {
        toast({ title: "Character not found", description: "This character may not exist or you don't have permission.", variant: "destructive" });
        router.push('/');
      }
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
  
  const sortedAndFilteredData = useMemo(() => {
    if (!character || !isDataLoaded || !quests) return { sortedQuests: [] };

    const calculateRXP = (quest: Quest, character: Character, skulls: number): number | null => {
      let baseRXP = 50 + (3 * quest.level * skulls);
      if (quest.level >= 20) { baseRXP *= 2; }
      
      const durationCategory = getDurationCategory(quest.duration);
      const lengthAdjustment = durationCategory ? (reaperLengthAdjustments[durationCategory] ?? 1.0) : 1.0;
      let totalRXP = baseRXP * lengthAdjustment;

      if (quest.level < 20 && character.level === quest.level + 4) { totalRXP *= 0.9; }

      return Math.round(totalRXP);
    };

    const allProcessedQuests = quests.map(quest => {
        const skullData: Record<string, number | null> = {};
        for(let i = 1; i <= 10; i++) {
            skullData[`skull-${i}`] = calculateRXP(quest, character, i);
        }

        const charLvl = character.level;
        const questLvl = quest.level;
        const hiddenReasons: string[] = [];
        
        if (charLvl < questLvl) hiddenReasons.push(`Character Level (${charLvl}) < Quest Level (${questLvl})`);
        
        if (charLvl >= 30 && questLvl < 30) hiddenReasons.push('Quest is not level 30+ for a level 30+ character.');
        else if (charLvl >= 30 && charLvl - questLvl > 6) hiddenReasons.push(`Level difference (${charLvl - questLvl}) > 6 for epic levels.`);
        else if (questLvl >= 20 && charLvl < 30 && charLvl - questLvl > 6) hiddenReasons.push(`Level difference (${charLvl - questLvl}) > 6 for epic levels.`);
        else if (questLvl < 20 && charLvl - questLvl > 4) hiddenReasons.push(`Level difference (${charLvl - questLvl}) > 4 for heroic levels.`);

        const fuzzyQuestPackKey = normalizeAdventurePackNameForComparison(quest.adventurePackName);
        const isActuallyFreeToPlay = fuzzyQuestPackKey === normalizeAdventurePackNameForComparison(FREE_TO_PLAY_PACK_NAME_LOWERCASE);
        const isOwned = isActuallyFreeToPlay || !quest.adventurePackName || ownedPacksFuzzySet.has(fuzzyQuestPackKey);
        if (!isOwned) hiddenReasons.push(`Pack not owned: ${quest.adventurePackName}`);

        if (!onCormyr && quest.name.toLowerCase() === "the curse of the five fangs") hiddenReasons.push('Hidden by "On Cormyr" filter.');
        
        if (!showRaids && quest.name.toLowerCase().endsWith('(raid)')) hiddenReasons.push('Is a Raid (hidden by filter).');

        if (quest.name.toLowerCase().includes("test")) hiddenReasons.push('Is a test quest.');

        return {
            ...quest,
            maxRXP: calculateRXP(quest, character, 10),
            ...skullData,
            hiddenReasons,
        };
    });

    const filteredQuests = isDebugMode
      ? allProcessedQuests
      : allProcessedQuests.filter(quest => quest.hiddenReasons.length === 0);

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
  }, [quests, character, onCormyr, ownedPacksFuzzySet, isDataLoaded, sortConfig, showRaids, isDebugMode]);
  
  const requestSort = (key: SortableReaperColumnKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';

    if (key.startsWith('skull-') || key === 'maxRXP') {
      direction = 'descending';
    }

    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'descending') {
      setSortConfig(null);
      return;
    }
    const newSortConfig = { key, direction };
    setSortConfig(newSortConfig);
    savePreferences({ sortConfig: newSortConfig });
  };
  
  const getSortIndicator = (columnKey: SortableReaperColumnKey) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    }
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
  
  const { sortedQuests } = sortedAndFilteredData;
  const visibleTableHeaders = allTableHeaders.filter(h => columnVisibility[h.key]);

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
                  <Checkbox id="on-cormyr-reaper" checked={onCormyr} onCheckedChange={(checked) => {setOnCormyr(!!checked); savePreferences({ onCormyr: !!checked });}} disabled={pageOverallLoading} />
                  <Label htmlFor="on-cormyr-reaper" className={cn("font-normal", pageOverallLoading && "cursor-not-allowed opacity-50")}>On Cormyr</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="show-raids-reaper" checked={showRaids} onCheckedChange={(checked) => {setShowRaids(!!checked); savePreferences({ showRaids: !!checked });}} disabled={pageOverallLoading} />
                  <Label htmlFor="show-raids-reaper" className={cn("font-normal", pageOverallLoading && "cursor-not-allowed opacity-50")}>Include Raids</Label>
                </div>
                {userData?.isAdmin && (
                  <div className="flex items-center space-x-2">
                      <Checkbox id="debug-mode-reaper" checked={isDebugMode} onCheckedChange={(checked) => setIsDebugMode(!!checked)} disabled={pageOverallLoading}/>
                      <Label htmlFor="debug-mode-reaper" className={cn("font-normal text-destructive", pageOverallLoading && "cursor-not-allowed opacity-50")}>Debug</Label>
                  </div>
                )}
              </div>
            </div>
            <div className="pt-2 border-t border-border mt-4">
              <Label className="text-sm font-medium block mb-2">On Quest Click</Label>
              <RadioGroup value={clickAction} onValueChange={(value) => {setClickAction(value as 'none' | 'wiki' | 'map'); savePreferences({ clickAction: value as 'none' | 'wiki' | 'map' });}} className="flex items-center space-x-4" disabled={pageOverallLoading}>
                <div className="flex items-center space-x-2"><RadioGroupItem value="none" id="action-none-reaper" /><Label htmlFor="action-none-reaper" className="font-normal cursor-pointer">None</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="wiki" id="action-wiki-reaper" /><Label htmlFor="action-wiki-reaper" className="flex items-center font-normal cursor-pointer"><BookOpen className="mr-1.5 h-4 w-4"/>Show Wiki</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="map" id="action-map-reaper" /><Label htmlFor="action-map-reaper" className="font-normal cursor-pointer flex items-center"><MapPin className="mr-1.5 h-4 w-4"/>Show Map</Label></div>
              </RadioGroup>
            </div>
          </div>
        </CardHeader>
      </Card>
      <Card className="flex flex-col h-[80vh]">
        <CardHeader className="flex-shrink-0 bg-card border-b">
          <div className="flex justify-between items-center">
            <CardTitle className="font-headline flex items-center">
              <Skull className="mr-2 h-6 w-6 text-primary" /> Reaper Rewards
              {isDebugMode && <span className="ml-2 text-xs font-normal text-muted-foreground">({sortedQuests.length} quests)</span>}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Link href={`/favor-tracker/${characterId}`} passHref><Button variant="outline" size="sm" disabled={pageOverallLoading}><ListOrdered className="mr-2 h-4 w-4" />Favor Tracker</Button></Link>
              <Link href={`/leveling-guide/${characterId}`} passHref><Button variant="outline" size="sm" disabled={pageOverallLoading}><BookOpen className="mr-2 h-4 w-4" />Leveling Guide</Button></Link>
              <Popover open={isSettingsPopoverOpen} onOpenChange={handleSettingsPopoverOpenChange}>
                <PopoverTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9" disabled={pageOverallLoading}><Settings className="h-4 w-4" /><span className="sr-only">Column Settings</span></Button></PopoverTrigger>
                <PopoverContent className="w-auto p-4 min-w-[280px]">
                  <div className="space-y-4">
                    <h4 className="font-medium leading-none">Display Columns</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                      {allTableHeaders.map(header => (
                        <div key={header.key} className="flex items-center space-x-2">
                          <Checkbox id={`vis-reaper-${header.key}`} checked={!!popoverColumnVisibility[header.key]} onCheckedChange={(checked) => handlePopoverColumnVisibilityChange(header.key, !!checked)} />
                          <Label htmlFor={`vis-reaper-${header.key}`} className="font-normal whitespace-nowrap">{header.label}</Label>
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
          <CardDescription>
              Estimated Reaper Experience (RXP) for {character.name}. Quests are filtered based on Reaper XP eligibility rules for the character's level.
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
                <TableCaption className="py-4 sticky bottom-0 bg-card z-10">End of quest list for {character.name}.</TableCaption>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-card hover:bg-card">
                    {visibleTableHeaders.map(header => (
                      <TableHead key={header.key} className={cn(header.className)}>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" onClick={() => header.isSortable && requestSort(header.key as SortableReaperColumnKey)} className="p-0 h-auto hover:bg-transparent" disabled={pageOverallLoading || !header.isSortable}>
                                {header.icon ? <header.icon className="mr-1.5 h-4 w-4" /> : header.key.startsWith('skull-') ? <Skull className="mr-1.5 h-4 w-4" /> : null}
                                {header.label}
                                {header.isSortable && getSortIndicator(header.key as SortableReaperColumnKey)}
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
                            {columnVisibility['maxRXP'] && <TableCell className="text-center font-bold">{(quest as any).maxRXP ?? '-'}</TableCell>}
                            {skullColumns.map(sc => columnVisibility[sc.key] && (
                              <TableCell key={sc.key} className="text-center">
                                {(quest as any)[sc.key] ?? '-'}
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
