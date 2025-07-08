// src/components/shared/quest-map-viewer.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
import { Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';

interface QuestMapViewerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  mapUrls: string[]; // These are now expected to be filenames, e.g., "map1.jpg"
  questName: string;
}

// A single map pane with zoom and scroll
const MapPane = ({ src, questName, mapIndex }: { src: string, questName: string, mapIndex: number }) => {
  const [isLoading, setIsLoading] = useState(true);

  // Reset loading state when src changes
  useEffect(() => {
    setIsLoading(true);
  }, [src]);

  return (
    <div className="relative h-full w-full overflow-auto bg-muted/20 border-r border-border last:border-r-0">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      )}
      <div className={cn("relative min-w-[600px] min-h-[600px] w-full h-full", isLoading ? 'opacity-0' : 'opacity-100')}>
        <Image
          src={src}
          alt={`Map ${mapIndex + 1} for ${questName}`}
          fill
          style={{ objectFit: 'contain' }}
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
          className="transition-opacity duration-300"
          data-ai-hint="map video-game"
        />
      </div>
    </div>
  );
};

export function QuestMapViewer({
  isOpen,
  onOpenChange,
  mapUrls,
  questName,
}: QuestMapViewerProps) {
  const [currentPairIndex, setCurrentPairIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentPairIndex(0);
    }
  }, [isOpen]);

  const mapPairs = useMemo(() => {
    const pairs: string[][] = [];
    for (let i = 0; i < mapUrls.length; i += 2) {
      pairs.push(mapUrls.slice(i, i + 2));
    }
    return pairs;
  }, [mapUrls]);
  
  const currentPair = mapPairs[currentPairIndex] || [];
  const map1Url = currentPair[0] ? `/maps/${currentPair[0]}` : null;
  const map2Url = currentPair[1] ? `/maps/${currentPair[1]}` : null;
  
  const map1Index = currentPairIndex * 2;
  const map2Index = currentPairIndex * 2 + 1;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-full max-h-full flex flex-col p-0 sm:p-0 border-0 rounded-none">
        <DialogHeader className="p-4 pb-2 border-b flex-shrink-0">
          <DialogTitle className="font-headline">{questName} - Map Viewer</DialogTitle>
          <DialogDescription>
             Use the thumbnails below to select maps for viewing. You can view up to two maps side-by-side.
          </DialogDescription>
          {mapUrls.length > 2 && (
             <ScrollArea className="w-full whitespace-nowrap rounded-md">
              <div className="flex w-max space-x-4 p-4">
                  {mapPairs.map((pair, index) => (
                      <div
                          key={index}
                          className={cn(
                              "flex items-center justify-center gap-1 p-1 rounded-md cursor-pointer border-2 transition-all",
                              currentPairIndex === index ? "border-primary" : "border-transparent hover:border-accent"
                          )}
                           onClick={() => setCurrentPairIndex(index)}
                           role="button"
                           aria-label={`Select map pair ${index + 1}`}
                      >
                          <div className="relative w-28 h-20 rounded-sm overflow-hidden border">
                              <Image src={`/maps/${pair[0]}`} alt={`Map thumbnail ${index * 2 + 1}`} layout="fill" objectFit="cover" sizes="112px" data-ai-hint="map screenshot" />
                          </div>
                          {pair[1] ? (
                             <div className="relative w-28 h-20 rounded-sm overflow-hidden border">
                                <Image src={`/maps/${pair[1]}`} alt={`Map thumbnail ${index * 2 + 2}`} layout="fill" objectFit="cover" sizes="112px" data-ai-hint="map screenshot" />
                            </div>
                          ) : (
                            <div className="relative w-28 h-20 rounded-sm flex items-center justify-center bg-muted/50 text-muted-foreground text-xs">Single Map</div>
                          )}
                      </div>
                  ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </DialogHeader>
        
        <div className={cn(
          "flex-grow relative bg-muted/50 grid h-full",
          map2Url ? "grid-cols-2" : "grid-cols-1"
        )}>
          {map1Url && <MapPane src={map1Url} questName={questName} mapIndex={map1Index} />}
          {map2Url && <MapPane src={map2Url} questName={questName} mapIndex={map2Index} />}
        </div>
        
        <DialogFooter className="flex-row justify-end items-center p-4 pt-2 border-t flex-shrink-0 gap-4">
          {map1Url && (
             <Button variant="ghost" size="sm" onClick={() => window.open(map1Url, '_blank')}>
              <ExternalLink className="mr-2 h-4 w-4" /> Open Map {map1Index + 1}
            </Button>
          )}
           {map2Url && (
             <Button variant="ghost" size="sm" onClick={() => window.open(map2Url, '_blank')}>
              <ExternalLink className="mr-2 h-4 w-4" /> Open Map {map2Index + 1}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
