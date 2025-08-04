
// src/components/adventure-pack/adventure-pack-item.tsx
"use client";

import type { AdventurePack } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Package, Gem, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

interface AdventurePackItemProps {
  pack: AdventurePack;
  isChecked: boolean;
  onCheckedChange: (packName: string, checked: boolean) => void;
  disabled?: boolean;
}

const FREE_TO_PLAY_PACK_NAME_LOWERCASE = "free to play";

export function AdventurePackItem({ pack, isChecked, onCheckedChange, disabled = false }: AdventurePackItemProps) {
  const uniqueId = `adv-pack-${pack.id}`;
  const isFreeToPlayPack = pack.name.toLowerCase() === FREE_TO_PLAY_PACK_NAME_LOWERCASE;
  const checkboxIsActuallyDisabled = disabled || isFreeToPlayPack;

  return (
    <Card className={cn(
        "hover:shadow-md transition-shadow",
        checkboxIsActuallyDisabled && "opacity-70 cursor-not-allowed"
      )}>
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <Checkbox
            id={uniqueId}
            checked={isChecked}
            onCheckedChange={(checkedState) => {
              if (isFreeToPlayPack) return; 
              onCheckedChange(pack.name, !!checkedState);
            }}
            aria-labelledby={`${uniqueId}-label`}
            disabled={checkboxIsActuallyDisabled}
            className={cn(isFreeToPlayPack && "cursor-not-allowed")}
          />
          <Package className="h-6 w-6 text-primary" />
          <Label 
            htmlFor={uniqueId} 
            id={`${uniqueId}-label`} 
            className={cn(
              "text-base font-medium flex-1", 
              checkboxIsActuallyDisabled ? "cursor-not-allowed" : "cursor-pointer"
            )}
          >
            {pack.name}
          </Label>
        </div>
         {(pack.pointsCost || pack.totalFavor) && (
          <div className="mt-2 text-xs text-muted-foreground pl-10 space-y-1">
            {pack.pointsCost && (
              <div className="flex items-center">
                <Gem className="h-3 w-3 mr-1.5" />
                <span>Points Cost: {pack.pointsCost}</span>
              </div>
            )}
            {pack.totalFavor && (
              <div className="flex items-center">
                <Star className="h-3 w-3 mr-1.5" />
                <span>Total Favor: {pack.totalFavor}</span>
              </div>
            )}
          </div>
        )}
        {pack.subPacks && pack.subPacks.length > 0 && (
            <div className="mt-3 pt-3 pl-6 border-t border-dashed">
                 <p className="text-xs font-semibold text-muted-foreground mb-2">Also available individually:</p>
                <div className="space-y-3">
                    {pack.subPacks.map(subPack => (
                        <div key={subPack.id} className="flex items-center space-x-3">
                             <Checkbox
                                id={`sub-pack-${subPack.id}`}
                                checked={isChecked} // Sub-packs are checked if parent is checked
                                onCheckedChange={(checkedState) => onCheckedChange(subPack.name, !!checkedState)}
                                disabled={disabled}
                            />
                            <Label htmlFor={`sub-pack-${subPack.id}`} className="font-normal text-sm flex-1 cursor-pointer">{subPack.name}</Label>
                             {subPack.pointsCost && (
                                <div className="flex items-center text-xs text-muted-foreground">
                                    <Gem className="h-3 w-3 mr-1.5" />
                                    <span>{subPack.pointsCost}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
