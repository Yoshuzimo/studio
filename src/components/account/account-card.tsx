// src/components/account/account-card.tsx
"use client";

import { useRouter } from 'next/navigation';
import type { Account } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppData } from '@/context/app-data-context';

interface AccountCardProps {
  account: Account;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  disabled?: boolean;
}

export function AccountCard({ account, onEdit, onDelete, disabled = false }: AccountCardProps) {
  const router = useRouter();
  const { setActiveAccountId } = useAppData();

  const handleCardClick = () => {
    if (disabled) return;
    setActiveAccountId(account.id);
    router.push('/'); // Navigate to the character list for this account
  };

  return (
    <Card 
      className={cn(
        "w-full max-w-sm transform transition-all hover:scale-105 hover:shadow-xl flex flex-col justify-between overflow-hidden bg-gradient-to-tr from-primary to-secondary",
        disabled && "opacity-70 pointer-events-none"
      )}
    >
      <div 
        className="flex-grow flex flex-col justify-between cursor-pointer"
        onClick={handleCardClick}
      >
        <CardHeader className="p-4">
          <CardTitle className="font-headline text-2xl text-primary-foreground shadow-lg">{account.name}</CardTitle>
          <CardDescription className="text-primary-foreground/80 font-medium">View characters for this account</CardDescription>
        </CardHeader>
      </div>
      <CardFooter className="flex justify-end gap-2 p-4 pt-2 border-t border-white/20 mt-auto">
        <Button variant="outline" size="sm" onClick={() => onEdit(account)} aria-label={`Edit ${account.name}`} disabled={disabled || account.name === 'Default'} className="bg-white/10 text-white border-white/30 hover:bg-white/20">
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </Button>
        <Button variant="destructive" size="sm" onClick={() => onDelete(account)} aria-label={`Delete ${account.name}`} disabled={disabled || account.name === 'Default'}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
