
// src/components/admin/user-permission-dialog.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { User as AppUser, PermissionSettings } from '@/types';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserPermissionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  targetUser: AppUser;
  currentUser: AppUser;
  onSave: (newPermissions: PermissionSettings) => Promise<void>;
  isProcessing?: boolean;
}

// Helper to get permission level (consistent with AuthContext)
const getPermissionLevel = (user: AppUser | null): number => {
  if (!user) return -1;
  if (user.isCreator) return 3;
  if (user.isOwner) return 2;
  if (user.isAdmin) return 1;
  return 0;
};

export function UserPermissionDialog({
  isOpen,
  onOpenChange,
  targetUser,
  currentUser,
  onSave,
  isProcessing = false,
}: UserPermissionDialogProps) {
  const [localIsAdmin, setLocalIsAdmin] = useState(targetUser.isAdmin || false);
  const [localIsOwner, setLocalIsOwner] = useState(targetUser.isOwner || false);
  const { toast } = useToast();

  const currentUserLevel = getPermissionLevel(currentUser);
  const targetUserLevel = getPermissionLevel(targetUser);

  useEffect(() => {
    if (isOpen) {
      setLocalIsAdmin(targetUser.isAdmin || false);
      setLocalIsOwner(targetUser.isOwner || false);
    }
  }, [isOpen, targetUser]);

  const handleAdminChange = (checked: boolean) => {
    setLocalIsAdmin(checked);
    if (!checked && localIsOwner) {
      // If admin is unchecked, owner must also be unchecked
      setLocalIsOwner(false);
    }
  };

  const handleOwnerChange = (checked: boolean) => {
    setLocalIsOwner(checked);
    if (checked && !localIsAdmin) {
      // If owner is checked, admin must also be checked
      setLocalIsAdmin(true);
    }
  };

  const handleSaveChanges = async () => {
    // Prevent self-demotion by non-creator from owner/creator status
    if (currentUser.id === targetUser.id) {
      if ( (currentUser.isOwner && !localIsOwner && !currentUser.isCreator) || (currentUser.isCreator && (!localIsAdmin || !localIsOwner)) ) {
        toast({ title: "Action Restricted", description: "You cannot remove your own Owner/Creator defining roles unless you are a Creator modifying lower roles.", variant: "destructive" });
        return;
      }
    }
    // Prevent non-creator from demoting a creator
    if (targetUser.isCreator && !currentUser.isCreator && ( !localIsAdmin || !localIsOwner )) {
         toast({ title: "Permission Denied", description: "Only a Creator can change another Creator's core roles.", variant: "destructive" });
        return;
    }


    await onSave({ isAdmin: localIsAdmin, isOwner: localIsOwner });
  };

  // Determine if checkboxes should be enabled
  const canSetAdmin = currentUserLevel >= 1 && (!targetUser.isCreator || currentUser.isCreator);
  const canSetOwner = currentUserLevel >= 2 && (!targetUser.isCreator || currentUser.isCreator);
  
  // User cannot grant permissions higher than their own, unless they are a Creator modifying a non-Creator.
  const adminCheckboxDisabled = isProcessing || !canSetAdmin || (currentUserLevel < 1) || (targetUser.isCreator && !currentUser.isCreator);
  const ownerCheckboxDisabled = isProcessing || !canSetOwner || (currentUserLevel < 2) || !localIsAdmin || (targetUser.isCreator && !currentUser.isCreator);


  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isProcessing) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">Manage Permissions: {targetUser.displayName || targetUser.email}</DialogTitle>
          <DialogDescription>
            Set Admin and Owner roles. Current user tier: {getPermissionLevel(currentUser)}. Target user tier: {getPermissionLevel(targetUser)}.
            {targetUser.isCreator && <span className="font-bold text-red-500 block"> Target is a Creator.</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isAdmin"
              checked={localIsAdmin}
              onCheckedChange={handleAdminChange}
              disabled={adminCheckboxDisabled}
            />
            <Label htmlFor="isAdmin" className={adminCheckboxDisabled ? "text-muted-foreground" : ""}>
              Administrator Access
            </Label>
          </div>
          {currentUserLevel >= 2 && ( // Only show Owner option if current user is at least Owner
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isOwner"
                checked={localIsOwner}
                onCheckedChange={handleOwnerChange}
                disabled={ownerCheckboxDisabled}
              />
              <Label htmlFor="isOwner" className={ownerCheckboxDisabled ? "text-muted-foreground" : ""}>
                Owner Access (implies Administrator)
              </Label>
            </div>
          )}
           {targetUser.isCreator && !currentUser.isCreator && (
             <p className="text-xs text-destructive">Only a Creator can modify a Creator's core roles.</p>
           )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isProcessing}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSaveChanges}
            disabled={isProcessing || (targetUser.isCreator && !currentUser.isCreator && (targetUser.isAdmin !== localIsAdmin || targetUser.isOwner !== localIsOwner) ) }
          >
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
