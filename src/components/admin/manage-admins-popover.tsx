
// src/components/admin/manage-admins-popover.tsx
"use client";

import React, { useState, useMemo } from 'react';
import type { User as AppUser, PermissionSettings } from '@/types';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UserSelectionDialog } from './user-selection-dialog';
import { UserPermissionDialog } from './user-permission-dialog'; // New dialog
import { Users, PlusCircle, Trash2, Loader2, UserCog } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface ManageAdminsPopoverProps {
  currentUserData: AppUser | null;
  allUsers: AppUser[];
  onUsersUpdate: () => Promise<void>;
  isLoadingUsers: boolean;
}

// Helper to get permission level (moved from AuthContext for local use if needed, or use from AuthContext)
const getPermissionLevel = (user: AppUser | null): number => {
  if (!user) return -1;
  if (user.isCreator) return 3;
  if (user.isOwner) return 2;
  if (user.isAdmin) return 1;
  return 0;
};

export function ManageAdminsPopover({ currentUserData, allUsers, onUsersUpdate, isLoadingUsers }: ManageAdminsPopoverProps) {
  const { updateUserAdminStatus, updateUserOwnerStatus, isLoading: isAuthProcessing } = useAuth();
  const { toast } = useToast();

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isUserListDialogOpen, setIsUserListDialogOpen] = useState(false); // For selecting a user via '+'
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false); // For UserPermissionDialog
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<AppUser | null>(null);
  const [localOpLoading, setLocalOpLoading] = useState(false);

  const isLoading = isAuthProcessing || localOpLoading || isLoadingUsers;

  const adminUsers = useMemo(() => allUsers.filter(user => user.isAdmin || user.isOwner || user.isCreator).sort((a,b) => (getPermissionLevel(b) - getPermissionLevel(a)) || (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '')), [allUsers]);

  const handleOpenUserListDialog = () => {
    setSelectedUserForPermissions(null); // Clear any previously selected user
    setIsUserListDialogOpen(true);
  };

  const handleUserSelectedForPermissions = (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      setSelectedUserForPermissions(user);
      setIsUserListDialogOpen(false); // Close user selection dialog
      setIsPermissionDialogOpen(true); // Open permission setting dialog
    }
  };

  const handleOpenPermissionsForExistingAdmin = (user: AppUser) => {
    if (!currentUserData) return;
    const currentUserLevel = getPermissionLevel(currentUserData);
    const targetUserLevel = getPermissionLevel(user);

    // Allow modification if current user is higher tier OR if current user is Creator (can modify anyone not Creator)
    // OR if target is self and current is Creator (Creator can demote self, but this is complex) - let UserPermissionDialog handle self-mod limits
    if (currentUserData.id !== user.id && currentUserLevel <= targetUserLevel && !currentUserData.isCreator) {
      toast({ title: "Permission Denied", description: "You cannot modify users of an equal or higher permission tier unless you are a Creator.", variant: "destructive" });
      return;
    }
    // Special check: Non-creator cannot modify a Creator
    if (user.isCreator && !currentUserData.isCreator) {
        toast({ title: "Permission Denied", description: "Only a Creator can modify another Creator's permissions.", variant: "destructive" });
        return;
    }


    setSelectedUserForPermissions(user);
    setIsPermissionDialogOpen(true);
  };
  
  const handleSavePermissions = async (newPermissions: PermissionSettings) => {
    if (!selectedUserForPermissions || !currentUserData) return;

    setLocalOpLoading(true);
    try {
      const { isAdmin: newIsAdmin, isOwner: newIsOwner } = newPermissions;

      // Apply owner status changes first.
      // updateUserOwnerStatus also handles making user admin if they become an owner.
      if (newIsOwner !== selectedUserForPermissions.isOwner) {
        await updateUserOwnerStatus(selectedUserForPermissions.id, newIsOwner);
      }
      
      // Then apply admin status changes if necessary.
      // This handles cases where owner status didn't change, or if admin status is set independently (e.g., becoming admin but not owner, or losing admin while owner was already false).
      // The AuthContext function `updateUserAdminStatus` will correctly handle making `isOwner` false if `isAdmin` is set to false.
      // Need to get potentially updated user data if owner status changed their admin status.
      // For simplicity and robustness, we can just call both if they are different from original, AuthContext is idempotent.
      // However, a more precise approach:
      let effectiveCurrentIsAdmin = selectedUserForPermissions.isAdmin;
      if (newIsOwner && !selectedUserForPermissions.isOwner) { // if they just became owner
          effectiveCurrentIsAdmin = true; // they are now admin due to becoming owner
      } else if (!newIsOwner && selectedUserForPermissions.isOwner && !newIsAdmin) { // if they just lost owner AND are intended to lose admin
          effectiveCurrentIsAdmin = false; // they will lose admin
      }


      if (newIsAdmin !== effectiveCurrentIsAdmin) {
         await updateUserAdminStatus(selectedUserForPermissions.id, newIsAdmin);
      }


      await onUsersUpdate(); // Refresh the list of users/admins
      setIsPermissionDialogOpen(false);
      setSelectedUserForPermissions(null);
      toast({ title: "Permissions Updated", description: `Permissions for ${selectedUserForPermissions.displayName || selectedUserForPermissions.email} have been updated.`});
    } catch (error) {
      // Toast is usually handled in AuthContext, but a general one here might be ok
      // toast({ title: "Update Failed", description: (error as Error).message, variant: "destructive" });
      console.error("Error saving permissions on popover:", error);
    } finally {
      setLocalOpLoading(false);
    }
  };


  if (!currentUserData?.isAdmin) return null;

  const getDisplayRole = (user: AppUser): string => {
    if (user.isCreator) return "(Creator)";
    if (user.isOwner) return "(Owner)";
    if (user.isAdmin) return "(Admin)";
    return "";
  };

  return (
    <>
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" disabled={isLoading && !localOpLoading}>
            {(isLoading && !localOpLoading && !isAuthProcessing) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <UserCog className="mr-2 h-4 w-4" />
            Manage Permissions
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto min-w-[350px] max-w-xl p-4" side="bottom" align="end">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium leading-none flex items-center"><Users className="mr-2 h-5 w-5 text-primary" /> Current Privileged Users</h4>
              <Button variant="ghost" size="icon" onClick={handleOpenUserListDialog} disabled={isLoading} title="Modify User Permissions">
                <PlusCircle className="h-5 w-5" />
              </Button>
            </div>
            {isLoadingUsers ? (
              <div className="flex items-center justify-center py-4"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading users...</div>
            ) : adminUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No privileged users (Admin, Owner, Creator) found.</p>
            ) : (
              <ScrollArea className="h-auto max-h-[250px]">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {adminUsers.map(admin => (
                    <div key={admin.id} className="flex items-center justify-between p-2 border rounded-md text-sm group">
                      <span className="truncate" title={`${admin.displayName || admin.email || admin.id} ${getDisplayRole(admin)}`}>
                        {admin.displayName || admin.email?.split('@')[0]}
                        {getDisplayRole(admin) && <span className={`ml-1 text-xs ${admin.isCreator ? 'text-red-500' : admin.isOwner ? 'text-destructive' : 'text-primary'}`}>{getDisplayRole(admin)}</span>}
                      </span>
                      {(getPermissionLevel(currentUserData) > getPermissionLevel(admin) || (currentUserData?.isCreator && !admin.isCreator)) && admin.id !== currentUserData?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleOpenPermissionsForExistingAdmin(admin)}
                          disabled={isLoading}
                          title={`Modify permissions for ${admin.displayName || admin.email}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <UserSelectionDialog
        isOpen={isUserListDialogOpen}
        onOpenChange={setIsUserListDialogOpen}
        title="Select User to Modify Permissions"
        description="Choose a user from the list to adjust their Admin or Owner roles."
        usersToList={allUsers} // Show all users
        onConfirmSelection={handleUserSelectedForPermissions}
        confirmButtonLabel="Configure Permissions"
        isProcessingConfirm={localOpLoading}
        currentUserId={currentUserData?.id} // Not strictly needed for selection, but good practice
      />

      {selectedUserForPermissions && currentUserData && (
        <UserPermissionDialog
          isOpen={isPermissionDialogOpen}
          onOpenChange={setIsPermissionDialogOpen}
          targetUser={selectedUserForPermissions}
          currentUser={currentUserData}
          onSave={handleSavePermissions}
          isProcessing={localOpLoading}
        />
      )}
    </>
  );
}
