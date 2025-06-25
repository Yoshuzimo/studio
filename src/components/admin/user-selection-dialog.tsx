
// src/components/admin/user-selection-dialog.tsx
"use client";

import React, { useState, useEffect } from 'react';
import type { User as AppUser } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';

interface UserSelectionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  description: string;
  usersToList: AppUser[];
  onConfirmSelection: (selectedUserId: string) => Promise<void>;
  confirmButtonLabel: string;
  isProcessingConfirm?: boolean;
  currentUserId?: string; // To prevent selecting oneself for certain actions
}

export function UserSelectionDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  usersToList,
  onConfirmSelection,
  confirmButtonLabel,
  isProcessingConfirm = false,
  currentUserId,
}: UserSelectionDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      setSelectedUserId(undefined); // Reset selection when dialog opens
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (selectedUserId) {
      await onConfirmSelection(selectedUserId);
      // onOpenChange(false); // Let the caller decide if dialog should close
    }
  };

  const filteredUsers = usersToList.filter(user => user.id !== currentUserId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isProcessingConfirm) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {filteredUsers.length === 0 ? (
          <p className="py-4 text-muted-foreground text-center">No eligible users found.</p>
        ) : (
          <ScrollArea className="h-[300px] my-4">
            <RadioGroup value={selectedUserId} onValueChange={setSelectedUserId} className="space-y-2">
              {filteredUsers.map((user) => (
                <div key={user.id} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50">
                  <RadioGroupItem value={user.id} id={`user-${user.id}`} disabled={isProcessingConfirm} />
                  <Label htmlFor={`user-${user.id}`} className="flex-1 cursor-pointer">
                    {user.displayName || user.email}
                    {user.isAdmin && <span className="ml-2 text-xs text-primary">(Admin)</span>}
                    {user.isOwner && <span className="ml-2 text-xs text-destructive">(Owner)</span>}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </ScrollArea>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isProcessingConfirm}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedUserId || isProcessingConfirm || filteredUsers.length === 0}
          >
            {isProcessingConfirm && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
