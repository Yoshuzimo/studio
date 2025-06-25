
// src/components/favor-tracker/favor-tracker-csv-uploader-dialog.tsx
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

export interface QuestCompletionCsvUploadResult {
  totalCsvRowsProcessed: number; 
  questsUpdatedCount: number;
  questsNotFoundCount: number;
  notFoundNames: string[];
}

interface DifficultyLevelLabelInfo {
    label: string; 
    csvKey: string; // e.g., "C/S"
}

interface FavorTrackerCsvUploaderDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onCsvUpload: (file: File) => Promise<QuestCompletionCsvUploadResult>;
  isUploading: boolean;
  characterName: string;
  difficultyLevelLabels: DifficultyLevelLabelInfo[];
}

export function FavorTrackerCsvUploaderDialog({
    isOpen,
    onOpenChange,
    onCsvUpload,
    isUploading,
    characterName,
    difficultyLevelLabels
}: FavorTrackerCsvUploaderDialogProps) {
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
        description: "Please select a CSV file to upload quest completions.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await onCsvUpload(selectedFile);

      let descriptionParts = [
        `For ${characterName}: ${result.questsUpdatedCount} quest(s) had their completions updated.`,
        `Processed ${result.totalCsvRowsProcessed} data rows from CSV.`
      ];
      if (result.questsNotFoundCount > 0) {
        descriptionParts.push(`${result.questsNotFoundCount} quest name(s) from the CSV were not found or could not be updated.`);
      }

      toast({
        title: "Quest Completions CSV Processed",
        description: descriptionParts.join(' '),
        duration: 8000,
      });

      if (result.notFoundNames.length > 0) {
           toast({
            title: "Some Quests Not Found",
            description: `The following quest names from your CSV could not be found or updated: ${result.notFoundNames.join(', ')}. Please check spelling and ensure they exist in the main Quests list. Quests containing "Test" in their name are ignored.`,
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
        description: `Error processing CSV for quest completions: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    }
  };

  const uniqueId = "favor-tracker-csv-upload-dialog-input";
  
  const difficultyHeadersDesc = difficultyLevelLabels.map(dl => `'${dl.csvKey}' (${dl.label})`).join(', ');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isUploading) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center">
            <UploadCloud className="mr-2 h-6 w-6 text-primary" /> Upload CSV for Quest Completions ({characterName})
          </DialogTitle>
          <DialogDescription>
            Select a CSV file with the following structure:
            <ul className="list-disc list-inside text-xs mt-1 pl-2 space-y-0.5">
              <li>Line 1: General headers (ignored for Quest Name/Difficulty mapping but can exist).</li>
              <li>Line 2: Must contain a 'Quest Name' header (or variants like 'Name', 'Title') AND difficulty headers (e.g., {difficultyHeadersDesc}).</li>
              <li>Line 3: This line will be skipped.</li>
              <li>Line 4 onwards: Data rows. Values under difficulty columns (like TRUE, X, 1) mark completion.</li>
            </ul>
            Unavailable difficulties for a quest will be ignored. This will overwrite existing completion data for found quests. Quests containing "Test" in their name are also ignored.
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
          <Button onClick={handleSubmit} disabled={!selectedFile || isUploading} variant="outline">
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isUploading ? "Processing..." : "Upload & Update Completions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
