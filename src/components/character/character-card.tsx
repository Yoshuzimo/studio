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

// Function to generate a Cloudinary transformation URL
const getCloudinaryBgUrl = (imageUrl: string) => {
  // Example URL: https://res.cloudinary.com/dgd1q5ufm/image/upload/v1721388856/ddo_toolkit/characters/yoshuzimo_a7035dts.jpg
  // We want to insert transformations after /upload/
  const parts = imageUrl.split('/upload/');
  if (parts.length !== 2) {
    // Not a standard Cloudinary URL, return as is
    return imageUrl;
  }
  
  // Transformations:
  // c_fill: Fill the container
  // g_auto: Gravity auto - AI finds the subject
  // ar_4:3: Aspect ratio (adjust as needed for card shape)
  // w_600: Width of 600px (good for cards)
  // q_auto:f_auto: Automatic quality and format
  // e_blur:800: A slight blur for background effect
  // e_brightness:-20: Slightly darken the image for text contrast
  const transformation = "c_fill,g_auto,ar_4:3,w_600,q_auto,f_auto,e_blur:200,e_brightness:-20";
  
  return `${parts[0]}/upload/${transformation}/${parts[1]}`;
};


export function CharacterCard({ character, onEdit, onDelete, disabled = false }: CharacterCardProps) {
  const linkHref = `/favor-tracker/${character.id}`;
  
  const cardStyle = character.iconUrl && character.iconUrl.includes('res.cloudinary.com')
    ? { backgroundImage: `url(${getCloudinaryBgUrl(character.iconUrl)})` }
    : character.iconUrl
    ? { backgroundImage: `url(${character.iconUrl})` } // Fallback for non-cloudinary URLs
    : {};

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
