// src/app/adventure-packs/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useAppData } from '@/context/app-data-context';
import { AdventurePackItem } from '@/components/adventure-pack/adventure-pack-item';
import type { AdventurePack, AdventurePackCsvUploadResult } from '@/types';
import { AdventurePackCsvUploaderDialog } from '@/components/adventure-pack/adventure-pack-csv-uploader-dialog';
import { Button } from '@/components/ui/button';
import { Package, Info, Loader2, Upload, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';

const CSV_HEADER_PACK_NAME = "Adventure Pack Name"; 
const CSV_HEADER_IS_OWNED = "Owned"; 

const normalizeAdventurePackNameForStorage = (name?: string | null): string | null => {
  if (!name) return null;
  const trimmedName = name.trim();
  if (trimmedName.toLowerCase().startsWith("the ")) {
    return trimmedName.substring(4).trim();
  }
  return trimmedName;
};

export default function AdventurePacksPage() {
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const { 
    adventurePacks, 
    ownedPacks, 
    setOwnedPacks, 
    accounts,
    activeAccountId,
    setActiveAccountId,
    isDataLoaded, 
    isLoading: isContextLoading 
  } = useAppData();
  const router = useRouter();
  
  const [isUploadCsvDialogOpen, setIsUploadCsvDialogOpen] = useState(false);
  const [isCsvProcessing, setIsCsvProcessing] = useState(false);

  useEffect(() => {
    if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router]);

  const handleTogglePackOwnership = (packName: string, isOwned: boolean) => {
    setOwnedPacks((prevOwnedPacks) => {
      const normalizedPackName = normalizeAdventurePackNameForStorage(packName);
      if (!normalizedPackName) return prevOwnedPacks;

      const newOwnedPacks = isOwned
        ? [...prevOwnedPacks, normalizedPackName]
        : prevOwnedPacks.filter((pName) => normalizeAdventurePackNameForStorage(pName)?.toLowerCase() !== normalizedPackName.toLowerCase());
      return [...new Set(newOwnedPacks)];
    });
  };

  const { owned, unowned } = useMemo(() => {
    if (!adventurePacks) return { owned: [], unowned: [] };

    const ownedList: AdventurePack[] = [];
    const unownedList: AdventurePack[] = [];

    adventurePacks.forEach(pack => {
      const isOwned = ownedPacks.some(opName => normalizeAdventurePackNameForStorage(opName)?.toLowerCase() === pack.name.toLowerCase());
      if (isOwned) {
        ownedList.push(pack);
      } else {
        unownedList.push(pack);
      }
    });

    const sortFn = (a: AdventurePack, b: AdventurePack) => a.name.localeCompare(b.name);

    ownedList.sort(sortFn);
    unownedList.sort(sortFn);

    return { owned: ownedList, unowned: unownedList };
  }, [adventurePacks, ownedPacks]);

  const handleAdventurePackCsvUpload = async (file: File): Promise<AdventurePackCsvUploadResult> => {
    setIsCsvProcessing(true);
    try {
      const fileText = await file.text();
      const allLines = fileText.split('\n').map(line => line.trim());
      
      if (allLines.length < 1) { 
        throw new Error(`CSV file is too short. Expected headers on Line 1.`);
      }

      const headerLine = allLines[0];
      if (!headerLine) {
        throw new Error(`CSV header row (Line 1) not found or empty.`);
      }

      const csvHeaders = headerLine.split(',').map(h => h.trim().toLowerCase());
      const packNameHeaderVariants = [CSV_HEADER_PACK_NAME.toLowerCase(), "pack name", "name"];
      const ownedHeaderVariants = [CSV_HEADER_IS_OWNED.toLowerCase(), "is owned", "checked", "own"];

      let packNameIndex = -1;
      for (const variant of packNameHeaderVariants) {
        packNameIndex = csvHeaders.indexOf(variant);
        if (packNameIndex !== -1) break;
      }

      let ownedStatusIndex = -1;
      for (const variant of ownedHeaderVariants) {
        ownedStatusIndex = csvHeaders.indexOf(variant);
        if (ownedStatusIndex !== -1) break;
      }
      
      if (packNameIndex === -1) {
        throw new Error(`Required header '${CSV_HEADER_PACK_NAME}' (or similar) not found in CSV on Line 1.`);
      }
      if (ownedStatusIndex === -1) {
        throw new Error(`Required header '${CSV_HEADER_IS_OWNED}' (or similar) not found in CSV on Line 1.`);
      }

      const dataLines = allLines.slice(3).filter(line => line.trim() !== "");
      const packNamesToMarkAsOwned = new Set<string>();
      const notFoundPackNames: string[] = [];
      
      let csvRowsProcessedForOwnership = 0;
      let csvRowsMarkedForOwnershipInFile = 0;
      let successfullyMarkedCount = 0;
      let couldNotFindCount = 0;

      dataLines.forEach(line => {
        const columns = line.split(',').map(col => col.trim());
        
        const nameInCsvRaw = columns[packNameIndex];
        const ownedStatusCsv = columns[ownedStatusIndex]?.toLowerCase();
        const normalizedNameInCsv = normalizeAdventurePackNameForStorage(nameInCsvRaw);

        if (!normalizedNameInCsv) return;

        csvRowsProcessedForOwnership++;

        if (ownedStatusCsv === "true" || ownedStatusCsv === "checked" || ownedStatusCsv === "yes" || ownedStatusCsv === "x" || ownedStatusCsv === "1") {
          csvRowsMarkedForOwnershipInFile++;
          const packExists = adventurePacks.find(p => p.name.toLowerCase() === normalizedNameInCsv.toLowerCase());
          
          if (packExists) {
            if (!ownedPacks.includes(packExists.name)) {
              successfullyMarkedCount++;
            }
            packNamesToMarkAsOwned.add(packExists.name);
          } else {
            couldNotFindCount++;
            if (!notFoundPackNames.includes(nameInCsvRaw)) {
              notFoundPackNames.push(nameInCsvRaw);
            }
          }
        }
      });
      
      setOwnedPacks(Array.from(packNamesToMarkAsOwned)); 
      
      return { 
        successfullyMarkedCount, 
        couldNotFindCount, 
        totalCsvRowsProcessed: dataLines.length, 
        csvRowsConsideredForOwnership: csvRowsProcessedForOwnership, 
        csvRowsMarkedForOwnershipInFile,
        notFoundNames: notFoundPackNames 
      };

    } catch (error) {
      console.error("CSV Upload error:", error);
      throw error;
    } finally {
      setIsCsvProcessing(false);
    }
  };
  
  const pageIsLoading = authIsLoading || isContextLoading || isCsvProcessing;

  if (authIsLoading || (!currentUser && !authIsLoading)) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="mr-2 h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!currentUser) {
     return (
      <div className="container mx-auto py-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Please log in to manage your adventure packs.</p>
        <Button onClick={() => router.push('/login')} className="mt-6">Log In</Button>
      </div>
    );
  }

  return (
    <div className="py-8 space-y-6"> 
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-headline text-3xl font-bold flex items-center">
          <Package className="mr-3 h-8 w-8 text-primary" /> Adventure Packs
        </h1>
        <div className="flex items-center gap-4">
            <div className="w-48">
              <Label htmlFor="account-select-packs" className="sr-only">Select Account</Label>
              <Select value={activeAccountId || ''} onValueChange={(value) => setActiveAccountId(value)} disabled={pageIsLoading}>
                    <SelectTrigger id="account-select-packs">
                      <SelectValue placeholder="Select Account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                </Select>
            </div>
            <Button 
                variant="outline" 
                onClick={() => setIsUploadCsvDialogOpen(true)} 
                disabled={pageIsLoading || adventurePacks.length === 0 || !activeAccountId}
                size="sm"
            >
              {pageIsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Upload CSV
            </Button>
        </div>
      </div>

      <Alert className="mb-6 bg-accent/10 border-accent/30">
        <Info className="h-5 w-5 text-accent" />
        <AlertTitle className="font-semibold text-accent">Manage Your Collection</AlertTitle>
        <AlertDescription className="text-accent/80">
          Select the adventure packs owned by the currently selected account, or upload a CSV to mark them in bulk. 
          Your CSV should have headers on Line 1 (e.g., '{CSV_HEADER_PACK_NAME}', '{CSV_HEADER_IS_OWNED}'). Lines 2 and 3 will be skipped. Data starts on Line 4.
          Changes are saved automatically. If you are not sure if you own a pack or expansion, open the store in game and look for it. If it shows up, you don't own it.
        </AlertDescription>
      </Alert>
      
      {isContextLoading && adventurePacks.length === 0 && !isDataLoaded && (
         <div className="text-center py-10"><Loader2 className="mr-2 h-8 w-8 animate-spin mx-auto" /> <p>Loading adventure packs...</p></div>
      )}

      {!isContextLoading && adventurePacks.length === 0 && isDataLoaded ? (
         <div className="text-center py-10">
          <p className="text-xl text-muted-foreground mb-4">No adventure packs found. An admin might need to upload them.</p>
           <img src="https://i.imgflip.com/2adszq.jpg" alt="Empty adventure packs list" data-ai-hint="sad spongebob" className="mx-auto rounded-lg shadow-md max-w-xs" />
        </div>
      ) : (
        <div className="space-y-8">
          {unowned.length > 0 && (
            <div>
              <h2 className="font-headline text-2xl font-semibold mb-4 border-b pb-2">Available Packs</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                {unowned.map(pack => (
                  <AdventurePackItem
                    key={pack.id}
                    pack={pack}
                    isChecked={false}
                    onCheckedChange={handleTogglePackOwnership}
                    disabled={pageIsLoading}
                  />
                ))}
              </div>
            </div>
          )}

          {unowned.length > 0 && owned.length > 0 && <Separator />}

          {owned.length > 0 && (
            <div>
              <h2 className="font-headline text-2xl font-semibold mb-4 border-b pb-2">Owned Packs</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                {owned.map(pack => (
                  <AdventurePackItem
                    key={pack.id}
                    pack={pack}
                    isChecked={true}
                    onCheckedChange={handleTogglePackOwnership}
                    disabled={pageIsLoading}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <AdventurePackCsvUploaderDialog
        isOpen={isUploadCsvDialogOpen}
        onOpenChange={setIsUploadCsvDialogOpen}
        onCsvUpload={handleAdventurePackCsvUpload}
        isUploading={isCsvProcessing}
        expectedPackNameHeader={CSV_HEADER_PACK_NAME}
        expectedOwnedStatusHeader={CSV_HEADER_IS_OWNED}
      />
    </div>
  );
}
