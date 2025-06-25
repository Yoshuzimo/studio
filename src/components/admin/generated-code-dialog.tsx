
// src/components/admin/generated-code-dialog.tsx
"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from '../ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Copy } from 'lucide-react';

interface GeneratedCodeDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  generatedCode: string;
  title: string;
  description: string;
  filePath: string;
}

export function GeneratedCodeDialog({
  isOpen,
  onOpenChange,
  generatedCode,
  title,
  description,
  filePath
}: GeneratedCodeDialogProps) {
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      toast({
        title: "Copied to Clipboard",
        description: `The code for ${filePath} has been copied.`,
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy code to clipboard. Please copy it manually.",
        variant: "destructive",
      });
      console.error("Clipboard copy error:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[80vw] md:max-w-[60vw] lg:max-w-[50vw]">
        <DialogHeader>
          <DialogTitle className="font-headline">{title}</DialogTitle>
          <DialogDescription>
            {description} Replace the entire contents of <code className="font-mono bg-muted p-1 rounded-sm text-xs">{filePath}</code> with the code below.
          </DialogDescription>
        </DialogHeader>
        <div className="my-4">
          <Textarea
            readOnly
            value={generatedCode}
            className="h-64 font-mono text-xs bg-muted/50"
          />
        </div>
        <DialogFooter className="justify-between">
          <Button onClick={handleCopy} variant="outline">
            <Copy className="mr-2 h-4 w-4" /> Copy Code
          </Button>
          <DialogClose asChild>
            <Button type="button">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
