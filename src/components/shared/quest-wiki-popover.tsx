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
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

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
          <DialogTitle className="font-headline">{questName} - DDO Wiki</DialogTitle>
          <DialogDescription>
            Displaying content from <a href={wikiUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">{wikiUrl}</a>.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-grow bg-background overflow-hidden">
          <iframe
            src={wikiUrl}
            title={`${questName} Wiki Page`}
            className="w-full h-full border-0"
          />
        </div>
        
        <DialogFooter className="flex-row justify-end items-center p-4 pt-2 border-t flex-shrink-0">
           <Button variant="ghost" onClick={() => window.open(wikiUrl, '_blank')}>
            <ExternalLink className="mr-2 h-4 w-4" /> Open in New Tab
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
