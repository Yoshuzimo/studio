// src/components/character/character-card.tsx
"use client";

import Link from 'next/link';
import type { Character } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CharacterCardProps {
  character: Character;
  onEdit: (character: Character) => void;
  onDelete: (characterId: string) => void;
  disabled?: boolean;
}

export function CharacterCard({ character, onEdit, onDelete, disabled = false }: CharacterCardProps) {
  const linkHref = `/favor-tracker/${character.id}`;
  
  const cardStyle = character.iconUrl ? { backgroundImage: `url(${character.iconUrl})` } : {};

  return (
    <Card className={cn(
        "w-full max-w-sm transform transition-all hover:scale-105 hover:shadow-xl flex flex-col justify-between overflow-hidden bg-cover bg-center",
        disabled && "opacity-70 pointer-events-none"
      )}
      style={cardStyle}
    >
      <div className="relative flex-grow flex flex-col justify-between bg-gradient-to-t from-black/80 via-black/50 to-transparent">
        <Link
          href={disabled ? '#' : linkHref}
          className={cn(
              "flex-grow block p-4",
              disabled && "cursor-not-allowed"
          )}
          aria-disabled={disabled}
          onClick={(e) => disabled && e.preventDefault()}
          >
            <CardHeader className="p-0">
              <CardTitle className="font-headline text-2xl text-white shadow-lg">{character.name}</CardTitle>
              <CardDescription className="text-primary-foreground/80 font-medium">Level {character.level}</CardDescription>
            </CardHeader>
        </Link>
        <CardFooter className="flex justify-end gap-2 p-4 pt-2 border-t border-white/20 mt-auto">
          <Button variant="outline" size="sm" onClick={() => onEdit(character)} aria-label={`Edit ${character.name}`} disabled={disabled} className="bg-white/10 text-white border-white/30 hover:bg-white/20">
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(character.id)} aria-label={`Delete ${character.name}`} disabled={disabled}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </CardFooter>
      </div>
    </Card>
  );
}
