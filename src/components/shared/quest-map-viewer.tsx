
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
import { ChevronLeft, ChevronRight, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuestMapViewerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  mapUrls: string[];
  questName: string;
}

export function QuestMapViewer({
  isOpen,
  onOpenChange,
  mapUrls,
  questName,
}: QuestMapViewerProps) {
  const [currentMapIndex, setCurrentMapIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setCurrentMapIndex(0);
      setIsLoading(true);
    }
  }, [isOpen]);

  const handleNext = () => {
    setIsLoading(true);
    setCurrentMapIndex((prev) => (prev + 1) % mapUrls.length);
  };

  const handlePrev = () => {
    setIsLoading(true);
    setCurrentMapIndex((prev) => (prev - 1 + mapUrls.length) % mapUrls.length);
  };

  const currentMapUrl = mapUrls[currentMapIndex];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-2 sm:p-4">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="font-headline">{questName} - Map ({currentMapIndex + 1} of {mapUrls.length})</DialogTitle>
          <DialogDescription>
            Map image from the DDO Wiki.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-grow relative flex items-center justify-center bg-muted/20 rounded-md overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          )}
          {currentMapUrl && (
            <Image
              src={currentMapUrl}
              alt={`Map ${currentMapIndex + 1} for ${questName}`}
              layout="fill"
              objectFit="contain"
              onLoad={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
              className={cn("transition-opacity duration-300", isLoading ? "opacity-0" : "opacity-100")}
            />
          )}
        </div>
        
        <DialogFooter className="flex-row justify-between items-center p-4 pt-2 border-t">
          <div className="flex gap-2">
            {mapUrls.length > 1 && (
              <>
                <Button variant="outline" size="icon" onClick={handlePrev} disabled={isLoading}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleNext} disabled={isLoading}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          <Button variant="ghost" onClick={() => window.open(currentMapUrl, '_blank')}>
            <ExternalLink className="mr-2 h-4 w-4" /> Open Image in New Tab
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
