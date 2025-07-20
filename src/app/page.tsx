
// src/app/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useAppData } from '@/context/app-data-context';
import { CharacterCard } from '@/components/character/character-card';
import { CharacterForm, type CharacterFormData } from '@/components/character/character-form';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users, Loader2, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { Character } from '@/types';
import { useAuth, DISPLAY_NAME_PLACEHOLDER_SUFFIX } from '@/context/auth-context'; // Import placeholder suffix
import { useRouter } from 'next/navigation';
import { SetDisplayNameModal } from '@/components/auth/set-display-name-modal'; // Import the new modal
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';

export default function CharactersPage() {
  const { currentUser, userData, isLoading: authIsLoading } = useAuth(); 
  const { characters, addCharacter, updateCharacter, deleteCharacter, accounts, activeAccountId, setActiveAccountId, isDataLoaded, isLoading: appDataIsLoading } = useAppData();
  const router = useRouter();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | undefined>(undefined);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [characterToDeleteId, setCharacterToDeleteId] = useState<string | null>(null);

  const [isSetDisplayNameModalOpen, setIsSetDisplayNameModalOpen] = useState(false);

  const pageOverallLoading = authIsLoading || appDataIsLoading;

  useEffect(() => {
    if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router]);

  useEffect(() => {
    // If accounts are loaded but no active account is set, select the default or first one.
    if (isDataLoaded && accounts.length > 0 && !activeAccountId) {
      const defaultAccount = accounts.find(acc => acc.name === 'Default') || accounts[0];
      if (defaultAccount) {
        setActiveAccountId(defaultAccount.id);
      }
    }
  }, [isDataLoaded, accounts, activeAccountId, setActiveAccountId]);

  useEffect(() => {
    if (currentUser && userData && userData.displayName === currentUser.uid + DISPLAY_NAME_PLACEHOLDER_SUFFIX) {
      setIsSetDisplayNameModalOpen(true);
    } else {
      setIsSetDisplayNameModalOpen(false);
    }
  }, [currentUser, userData]);


  const handleAddCharacterSubmit = async (data: CharacterFormData, _id?:string, iconUrl?: string | null) => {
    await addCharacter({ ...data, iconUrl }); 
    setIsCreateModalOpen(false);
  };

  const handleEditCharacterSubmit = async (data: CharacterFormData, id?: string, iconUrl?: string | null) => {
    if (!id || !editingCharacter) return;
    
    const updatedCharacterData: Character = {
        ...editingCharacter,
        name: data.name,
        level: data.level,
        accountId: data.accountId,
        iconUrl: iconUrl !== undefined ? iconUrl : editingCharacter.iconUrl,
    };

    await updateCharacter(updatedCharacterData);
    setIsEditModalOpen(false);
    setEditingCharacter(undefined);
  };

  const openEditModal = (character: Character) => {
    setEditingCharacter(character);
    setIsEditModalOpen(true);
  };

  const openDeleteDialog = (characterId: string) => {
    setCharacterToDeleteId(characterId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteCharacter = async () => {
    if (!characterToDeleteId) return;
    await deleteCharacter(characterToDeleteId);
    setIsDeleteDialogOpen(false);
    setCharacterToDeleteId(null);
  };
  
  if (pageOverallLoading || (!currentUser && !authIsLoading)) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="mr-2 h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="py-8 space-y-6"> 
      {currentUser && userData?.displayName === currentUser.uid + DISPLAY_NAME_PLACEHOLDER_SUFFIX && (
        <SetDisplayNameModal 
          isOpen={isSetDisplayNameModalOpen} 
          onOpenChange={setIsSetDisplayNameModalOpen}
        />
      )}
      
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-headline text-3xl font-bold flex items-center">
          <Users className="mr-3 h-8 w-8 text-primary" /> My Characters
        </h1>
        <div className="flex items-center gap-4">
          <div className="w-48">
             <Label htmlFor="account-select" className="sr-only">Select Account for New Character</Label>
             <Select value={activeAccountId || ''} onValueChange={(value) => setActiveAccountId(value)} disabled={pageOverallLoading}>
                  <SelectTrigger id="account-select">
                    <SelectValue placeholder="Select Account" />
                  </SelectTrigger>
                  <SelectContent>
                     {accounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
              </Select>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)} size="lg" disabled={pageOverallLoading || isSetDisplayNameModalOpen || !activeAccountId}>
            {pageOverallLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlusCircle className="mr-2 h-5 w-5" />} 
            Add New Character
          </Button>
        </div>
      </div>

      {pageOverallLoading && characters.length === 0 && !isDataLoaded && (
        <div className="text-center py-10"><Loader2 className="mr-2 h-8 w-8 animate-spin mx-auto" /> <p>Loading characters...</p></div>
      )}

      {!pageOverallLoading && characters.length === 0 && isDataLoaded && !isSetDisplayNameModalOpen && (
        <div className="text-center py-10">
          <p className="text-xl text-muted-foreground mb-4">No characters found. Add one to get started!</p>
           <img src="https://i.imgflip.com/2adszq.jpg" alt="Empty character list placeholder" data-ai-hint="sad spongebob" className="mx-auto rounded-lg shadow-md max-w-xs" />
        </div>
      )}

      {!isSetDisplayNameModalOpen && characters.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
              onEdit={openEditModal}
              onDelete={() => openDeleteDialog(character.id)}
              disabled={pageOverallLoading || isSetDisplayNameModalOpen}
            />
          ))}
        </div>
      )}

      <CharacterForm
        isOpen={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSubmit={handleAddCharacterSubmit}
        isSubmitting={pageOverallLoading}
      />
      {editingCharacter && (
        <CharacterForm
          isOpen={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          onSubmit={handleEditCharacterSubmit}
          initialData={editingCharacter}
          isSubmitting={pageOverallLoading}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this character?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the character
              "{characters.find(c => c.id === characterToDeleteId)?.name || ''}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pageOverallLoading} onClick={() => setCharacterToDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteCharacter} 
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={pageOverallLoading}
            >
              {pageOverallLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
