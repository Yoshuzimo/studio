// src/components/shared/quest-wiki-popover.tsx
"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { ExternalLink, AlertTriangle, X } from 'lucide-react';

interface QuestWikiPopoverProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  wikiUrl: string | null;
  questName: string;
}

export function QuestWikiPopover({
  isOpen,
  onOpenChange,
  wikiUrl,
  questName,
}: QuestWikiPopoverProps) {
  if (!wikiUrl) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-full max-h-full flex flex-col p-0 sm:p-0 border-0 rounded-none">
        <DialogHeader className="p-4 pb-2 border-b flex-shrink-0">
          <DialogTitle className="font-headline text-center">{questName}</DialogTitle>
          <DialogDescription className="flex items-center justify-center text-xs">
            <AlertTriangle className="h-4 w-4 mr-2 text-amber-500 shrink-0" />
            <span>Note: Some sites block being displayed in an overlay. If the content is blank, please use the "Open in New Tab" button.</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-grow bg-background overflow-hidden">
          <iframe
            src={wikiUrl}
            title={questName}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
        
        <DialogFooter className="p-2 absolute top-0 left-1/2 -translate-x-1/2 z-20 bg-background/80 backdrop-blur-sm rounded-b-lg border border-t-0 flex flex-row items-center gap-2">
           <Button variant="ghost" size="sm" onClick={() => window.open(wikiUrl, '_blank', 'noopener,noreferrer')}>
            <ExternalLink className="mr-2 h-4 w-4" /> Open in New Tab
          </Button>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
