// src/components/adventure-pack/adventure-pack-item.tsx
"use client";

import type { AdventurePack } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Package, Gem, Star, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
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
  const hasSubPacks = pack.subPacks && pack.subPacks.length > 0;

  return (
    <Card className={cn(
        "hover:shadow-md transition-shadow flex flex-col h-full",
        checkboxIsActuallyDisabled && "opacity-70 cursor-not-allowed"
      )}>
      <CardContent className="p-4 flex-grow flex flex-col">
        <div className="flex items-start space-x-3">
          <Checkbox
            id={uniqueId}
            checked={isChecked}
            onCheckedChange={(checkedState) => {
              if (isFreeToPlayPack) return; 
              onCheckedChange(pack.name, !!checkedState);
            }}
            aria-labelledby={`${uniqueId}-label`}
            disabled={checkboxIsActuallyDisabled}
            className={cn("mt-1", isFreeToPlayPack && "cursor-not-allowed")}
          />
          <div className="flex-1 space-y-1">
             <div className="flex justify-between items-center">
                <Label 
                  htmlFor={uniqueId} 
                  id={`${uniqueId}-label`} 
                  className={cn(
                    "text-base font-medium", 
                    checkboxIsActuallyDisabled ? "cursor-not-allowed" : "cursor-pointer"
                  )}
                >
                  {pack.name}
                </Label>
                 {hasSubPacks && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={checkboxIsActuallyDisabled}>
                                <Plus className="h-4 w-4" />
                                <span className="sr-only">Show Sub-packs</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                            <div className="space-y-4">
                                <h4 className="font-medium leading-none">Individual Packs</h4>
                                <p className="text-sm text-muted-foreground">
                                    These packs are included in the "{pack.name}" bundle.
                                </p>
                                <div className="space-y-3">
                                    {pack.subPacks?.map(subPack => (
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
                        </PopoverContent>
                    </Popover>
                )}
             </div>

            {(pack.pointsCost || pack.totalFavor) && (
              <div className="text-xs text-muted-foreground space-y-1">
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
