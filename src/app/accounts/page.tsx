
// src/app/accounts/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useAppData } from '@/context/app-data-context';
import { AccountCard } from '@/components/account/account-card';
import { AccountForm, type AccountFormData } from '@/components/account/account-form';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Library } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { Account } from '@/types';
import { useAuth } from '@/context/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AccountsPage() {
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const { accounts, addAccount, updateAccount, deleteAccount, isDataLoaded, isLoading: appDataIsLoading } = useAppData();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>(undefined);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

  const pageOverallLoading = authIsLoading || appDataIsLoading;

  useEffect(() => {
    if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router]);

  useEffect(() => {
    if (searchParams.get('action') === 'create' && isDataLoaded && accounts.length === 0) {
      setIsCreateModalOpen(true);
    }
  }, [searchParams, isDataLoaded, accounts.length]);


  const handleAddAccountSubmit = async (data: AccountFormData) => {
    const newAccount = await addAccount(data);
    setIsCreateModalOpen(false);
    // After creating the very first account, redirect to the home page
    if(newAccount && accounts.length === 0) {
        router.push('/');
    }
  };

  const handleEditAccountSubmit = async (data: AccountFormData) => {
    if (!editingAccount) return;
    await updateAccount({ ...editingAccount, name: data.name });
    setIsEditModalOpen(false);
    setEditingAccount(undefined);
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setIsEditModalOpen(true);
  };

  const openDeleteDialog = (account: Account) => {
    setAccountToDelete(account);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteAccount = async () => {
    if (!accountToDelete) return;
    await deleteAccount(accountToDelete);
    setIsDeleteDialogOpen(false);
    setAccountToDelete(null);
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
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-headline text-3xl font-bold flex items-center">
          <Library className="mr-3 h-8 w-8 text-primary" /> My Accounts
        </h1>
        <Button onClick={() => setIsCreateModalOpen(true)} size="lg" disabled={pageOverallLoading}>
          {pageOverallLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlusCircle className="mr-2 h-5 w-5" />}
          Add New Account
        </Button>
      </div>

      {pageOverallLoading && accounts.length === 0 && !isDataLoaded && (
        <div className="text-center py-10"><Loader2 className="mr-2 h-8 w-8 animate-spin mx-auto" /> <p>Loading accounts...</p></div>
      )}

      {!pageOverallLoading && accounts.length === 0 && isDataLoaded && (
        <div className="text-center py-10">
          <p className="text-xl text-muted-foreground mb-4">No accounts found. Add one to get started!</p>
        </div>
      )}

      {accounts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={openEditModal}
              onDelete={() => openDeleteDialog(account)}
              disabled={pageOverallLoading}
            />
          ))}
        </div>
      )}

      <AccountForm
        isOpen={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSubmit={handleAddAccountSubmit}
        isSubmitting={pageOverallLoading}
      />
      {editingAccount && (
        <AccountForm
          isOpen={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          onSubmit={handleEditAccountSubmit}
          initialData={editingAccount}
          isSubmitting={pageOverallLoading}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the "{accountToDelete?.name || ''}" account and all its associated data, including owned adventure packs.
              Any characters assigned to this account will be moved to your "Default" account. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pageOverallLoading} onClick={() => setAccountToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAccount}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={pageOverallLoading}
            >
              {pageOverallLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
