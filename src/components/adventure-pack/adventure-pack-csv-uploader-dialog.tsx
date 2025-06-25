
// src/components/adventure-pack/adventure-pack-csv-uploader-dialog.tsx
"use client";

import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { UploadCloud, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface AdventurePackCsvUploadResult {
  successfullyMarkedCount: number;
  couldNotFindCount: number;
  totalCsvRowsProcessed: number;
  csvRowsConsideredForOwnership: number;
  csvRowsMarkedForOwnershipInFile: number;
  notFoundNames: string[];
}

interface AdventurePackCsvUploaderDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onCsvUpload: (file: File) => Promise<AdventurePackCsvUploadResult>;
  isUploading: boolean;
  expectedPackNameHeader: string; // e.g., "Adventure Pack Name"
  expectedOwnedStatusHeader: string; // e.g., "Owned"
}

export function AdventurePackCsvUploaderDialog({ 
    isOpen, 
    onOpenChange, 
    onCsvUpload, 
    isUploading, 
    expectedPackNameHeader, 
    expectedOwnedStatusHeader 
}: AdventurePackCsvUploaderDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to upload.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await onCsvUpload(selectedFile);
      
      let descriptionParts = [
        `${result.successfullyMarkedCount} new pack(s) marked as owned.`,
        `Processed ${result.totalCsvRowsProcessed} data rows from CSV.`,
        `${result.csvRowsMarkedForOwnershipInFile} row(s) indicated 'owned' in the file.`
      ];
      if (result.couldNotFindCount > 0) {
        descriptionParts.push(`${result.couldNotFindCount} pack name(s) (marked 'owned') were not found in the master list.`);
      }
      
      toast({
        title: "CSV Processed",
        description: descriptionParts.join(' '),
        duration: 7000,
      });

      if (result.notFoundNames.length > 0) {
           toast({
            title: "Some Packs Not Found",
            description: `The following pack names from your CSV (marked as 'owned') were not found or could not be updated: ${result.notFoundNames.join(', ')}. Please check spelling and ensure they exist in the main Adventure Packs list.`,
            variant: "destructive",
            duration: 10000, 
          });
      }
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onOpenChange(false); 
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: `Error processing CSV: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    }
  };
  
  const uniqueId = "adventure-pack-csv-upload-dialog-input";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isUploading) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center">
            <UploadCloud className="mr-2 h-6 w-6 text-primary" /> Upload CSV to Mark Owned Packs
          </DialogTitle>
          <DialogDescription>
            Select a CSV file. Line 1 should contain headers (e.g., '{expectedPackNameHeader}', '{expectedOwnedStatusHeader}').
            Lines 2 and 3 (the two lines immediately following the header line) will be skipped. Data processing starts from Line 4.
            Packs marked as owned (e.g., TRUE, X, YES, 1) under the '{expectedOwnedStatusHeader}' column will be updated in your collection.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={uniqueId} className="text-right col-span-1">
              CSV File
            </Label>
            <Input
              id={uniqueId}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="col-span-3 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              disabled={isUploading}
            />
          </div>
          {selectedFile && (
            <p className="text-sm text-muted-foreground text-center col-span-4">Selected: {selectedFile.name}</p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isUploading}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={!selectedFile || isUploading} variant="default">
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isUploading ? "Processing..." : "Upload and Mark Owned"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

