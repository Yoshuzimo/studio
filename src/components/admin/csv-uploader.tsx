
// src/components/admin/csv-uploader.tsx
"use client";

import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UploadCloud, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CsvUploaderProps {
  dataType: 'Adventure Packs' | 'Quests';
  onFileUpload: (dataType: 'Adventure Packs' | 'Quests', file: File) => Promise<void>;
  disabled?: boolean;
}

export function CsvUploader({ dataType, onFileUpload, disabled = false }: CsvUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingInternal, setIsUploadingInternal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: `Please select a CSV file to upload for ${dataType}.`,
        variant: "destructive",
      });
      return;
    }

    setIsUploadingInternal(true);
    try {
      await onFileUpload(dataType, selectedFile);
      // Toast for success is handled by AppDataContext or the calling page now
      setSelectedFile(null); 
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
      }
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: `Error uploading ${dataType}: ${error instanceof Error ? error.message : String(error)}. Please check the console for details.`,
        variant: "destructive",
      });
      console.error(`Error uploading ${dataType} CSV:`, error);
    } finally {
      setIsUploadingInternal(false);
    }
  };
  
  const uniqueId = `csv-upload-${dataType.toLowerCase().replace(/\s+/g, '-')}`;
  const isEffectivelyDisabled = disabled || isUploadingInternal;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="font-headline flex items-center">
            <UploadCloud className="mr-2 h-6 w-6 text-primary" /> Upload {dataType} CSV
        </CardTitle>
        <CardDescription>
          Upload a CSV file to update the list of {dataType.toLowerCase()} in Firestore. This will overwrite existing data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
            <Label htmlFor={uniqueId} className="mb-2 block text-sm font-medium">
            Select CSV File
            </Label>
            <Input
            id={uniqueId}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            disabled={isEffectivelyDisabled}
            />
        </div>
        {selectedFile && (
          <p className="text-sm text-muted-foreground">Selected: {selectedFile.name}</p>
        )}
        <Button onClick={handleUpload} disabled={!selectedFile || isEffectivelyDisabled} className="w-full">
          {isEffectivelyDisabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isEffectivelyDisabled ? `Processing...` : `Upload ${dataType}`}
        </Button>
      </CardContent>
    </Card>
  );
}
