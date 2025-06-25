// src/components/shared/quest-map-viewer.tsx
"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Menu, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';

interface QuestMapViewerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  mapFileNames: string[];
  questName: string;
}

// Function to construct the full Firebase Storage URL
const getMapUrl = (fileName: string): string => {
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucket) {
    console.error("Firebase storage bucket URL is not configured in .env");
    return "https://placehold.co/800x600.png"; // Fallback URL
  }
  // Note: a folder name like "maps" is part of the path encoded in the URL.
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/maps%2F${encodeURIComponent(fileName)}?alt=media`;
};


export function QuestMapViewer({
  isOpen,
  onOpenChange,
  mapFileNames,
  questName,
}: QuestMapViewerProps) {
  const [currentMapIndex, setCurrentMapIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentMapIndex(0);
      setIsLoading(true);
    }
  }, [isOpen]);

  const mapUrls = mapFileNames.map(getMapUrl);
  const currentMapUrl = mapUrls[currentMapIndex];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-full h-[95vh] flex flex-col p-2 sm:p-4">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="font-headline">{questName} - Map Viewer</DialogTitle>
          <DialogDescription>
            Map {currentMapIndex + 1} of {mapUrls.length}. Hover over the menu icon to select a map.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-grow relative bg-muted/20 rounded-md overflow-hidden">
          {/* Menu Popover */}
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="absolute top-4 left-4 z-20 bg-background/70 backdrop-blur-sm">
                <Menu className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className="w-auto p-2">
              <ScrollArea className="h-auto max-h-[70vh]">
                <div className="space-y-2">
                  {mapUrls.map((url, index) => (
                    <div
                      key={index}
                      className={cn(
                        "relative w-40 h-24 rounded-md overflow-hidden cursor-pointer border-2 transition-all",
                        currentMapIndex === index ? "border-primary" : "border-transparent hover:border-accent"
                      )}
                      onClick={() => {
                        setIsLoading(true);
                        setCurrentMapIndex(index);
                        setIsPopoverOpen(false);
                      }}
                    >
                      <Image src={url} alt={`Map thumbnail ${index + 1}`} layout="fill" objectFit="cover" sizes="160px" />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {/* Main Image */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          )}
          {currentMapUrl && (
            <Image
              src={currentMapUrl}
              alt={`Map ${currentMapIndex + 1} for ${questName}`}
              fill
              style={{ objectFit: 'contain' }}
              onLoad={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
              className={cn("transition-opacity duration-300", isLoading ? "opacity-0" : "opacity-100")}
            />
          )}
        </div>
        
        <DialogFooter className="flex-row justify-end items-center p-4 pt-2 border-t">
          <Button variant="ghost" onClick={() => window.open(currentMapUrl, '_blank')}>
            <ExternalLink className="mr-2 h-4 w-4" /> Open Image in New Tab
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
