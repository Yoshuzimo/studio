
// src/components/character/character-card.tsx
"use client";

import Link from 'next/link';
import type { Character } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image'; // Import next/image

interface CharacterCardProps {
  character: Character;
  onEdit: (character: Character) => void;
  onDelete: (characterId: string) => void;
  disabled?: boolean;
}

export function CharacterCard({ character, onEdit, onDelete, disabled = false }: CharacterCardProps) {
  const linkHref = `/favor-tracker/${character.id}`;
  return (
    <Card className={cn(
        "w-full max-w-sm transform transition-all hover:scale-105 hover:shadow-xl flex flex-col",
        disabled && "opacity-70 pointer-events-none"
      )}>
      <Link
        href={disabled ? '#' : linkHref}
        className={cn(
            "flex-grow block hover:bg-card/50 transition-colors rounded-t-lg",
            disabled && "cursor-not-allowed"
        )}
        aria-disabled={disabled}
        onClick={(e) => disabled && e.preventDefault()}
        >
        <div className="p-1">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            {character.iconUrl ? (
              <div className="relative h-12 w-12 overflow-hidden border-2 border-primary rounded-md"> {/* Changed rounded-full to rounded-md for a square look */}
                <Image
                  src={character.iconUrl}
                  alt={`${character.name}'s icon`}
                  layout="fill"
                  objectFit="contain"
                  sizes="48px"
                />
              </div>
            ) : (
              <User className="h-10 w-10 text-primary" />
            )}
            <div>
              <CardTitle className="font-headline text-2xl">{character.name}</CardTitle>
              <CardDescription>Level {character.level}</CardDescription>
            </div>
          </CardHeader>
        </div>
      </Link>
      <CardFooter className="flex justify-end gap-2 pt-2 border-t border-border mt-auto">
        <Button variant="outline" size="sm" onClick={() => onEdit(character)} aria-label={`Edit ${character.name}`} disabled={disabled}>
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </Button>
        <Button variant="destructive" size="sm" onClick={() => onDelete(character.id)} aria-label={`Delete ${character.name}`} disabled={disabled}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
