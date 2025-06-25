
// src/components/admin/quest-form.tsx
"use client";

import React, { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import type { Quest } from '@/types';
import { Loader2, Trash2, PlusCircle } from 'lucide-react';

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';


const questFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  level: z.coerce.number().min(0, "Level must be 0 or greater.").max(40, "Level cannot exceed 40."),
  adventurePackName: z.string().optional(),
  location: z.string().optional(),
  questGiver: z.string().optional(),
  casualExp: z.coerce.number().optional(),
  normalExp: z.coerce.number().optional(),
  hardExp: z.coerce.number().optional(),
  eliteExp: z.coerce.number().optional(),
  duration: z.string().optional(),
  baseFavor: z.coerce.number().optional(),
  patron: z.string().optional(),
  casualNotAvailable: z.boolean().default(false),
  normalNotAvailable: z.boolean().default(false),
  hardNotAvailable: z.boolean().default(false),
  eliteNotAvailable: z.boolean().default(false),
  // Epic Fields
  epicBaseLevel: z.coerce.number().min(0).max(40).optional().or(z.literal('')),
  epicCasualExp: z.coerce.number().optional(),
  epicNormalExp: z.coerce.number().optional(),
  epicHardExp: z.coerce.number().optional(),
  epicEliteExp: z.coerce.number().optional(),
  epicCasualNotAvailable: z.boolean().default(false),
  epicNormalNotAvailable: z.boolean().default(false),
  epicHardNotAvailable: z.boolean().default(false),
  epicEliteNotAvailable: z.boolean().default(false),
  // Wiki/Map Fields
  wikiUrl: z.string().optional(),
  mapUrls: z.array(z.object({ value: z.string() })).optional(),
});

export type QuestFormData = z.infer<typeof questFormSchema>;

interface QuestFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: QuestFormData) => Promise<void>;
  onDelete: () => Promise<void>;
  initialData?: Quest;
  isSubmitting?: boolean;
}

export function QuestForm({ 
  isOpen, 
  onOpenChange, 
  onSubmit, 
  onDelete,
  initialData, 
  isSubmitting: isParentSubmitting = false 
}: QuestFormProps) {
  const form = useForm<QuestFormData>({
    resolver: zodResolver(questFormSchema),
    defaultValues: initialData ? {
      ...initialData,
      level: initialData.level || 0,
      casualExp: initialData.casualExp || undefined,
      normalExp: initialData.normalExp || undefined,
      hardExp: initialData.hardExp || undefined,
      eliteExp: initialData.eliteExp || undefined,
      baseFavor: initialData.baseFavor || undefined,
      epicBaseLevel: initialData.epicBaseLevel || undefined,
      epicCasualExp: initialData.epicCasualExp || undefined,
      epicNormalExp: initialData.epicNormalExp || undefined,
      epicHardExp: initialData.epicHardExp || undefined,
      epicEliteExp: initialData.epicEliteExp || undefined,
      wikiUrl: initialData.wikiUrl || undefined,
      mapUrls: initialData.mapUrls?.map(url => ({ value: url })) || [],
    } : {
      name: "",
      level: 1,
      casualNotAvailable: false,
      normalNotAvailable: false,
      hardNotAvailable: false,
      eliteNotAvailable: false,
      epicCasualNotAvailable: false,
      epicNormalNotAvailable: false,
      epicHardNotAvailable: false,
      epicEliteNotAvailable: false,
      mapUrls: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "mapUrls"
  });

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      form.reset(initialData ? {
        ...initialData,
        level: initialData.level || 0,
        casualExp: initialData.casualExp ?? undefined,
        normalExp: initialData.normalExp ?? undefined,
        hardExp: initialData.hardExp ?? undefined,
        eliteExp: initialData.eliteExp ?? undefined,
        baseFavor: initialData.baseFavor ?? undefined,
        epicBaseLevel: initialData.epicBaseLevel ?? undefined,
        epicCasualExp: initialData.epicCasualExp ?? undefined,
        epicNormalExp: initialData.epicNormalExp ?? undefined,
        epicHardExp: initialData.epicHardExp ?? undefined,
        epicEliteExp: initialData.epicEliteExp ?? undefined,
        wikiUrl: initialData.wikiUrl || undefined,
        mapUrls: initialData.mapUrls?.map(url => ({ value: url })) || [],
      } : {
        name: "",
        level: 1,
        casualNotAvailable: false,
        normalNotAvailable: false,
        hardNotAvailable: false,
        eliteNotAvailable: false,
        epicCasualNotAvailable: false,
        epicNormalNotAvailable: false,
        epicHardNotAvailable: false,
        epicEliteNotAvailable: false,
        mapUrls: [],
      });
    }
  }, [initialData, form, isOpen]);

  const handleFormSubmit = async (data: QuestFormData) => {
    await onSubmit(data);
    onOpenChange(false); // Close dialog on successful submission
  };

  const handleDeleteConfirm = async () => {
    setIsProcessingDelete(true);
    await onDelete();
    setIsProcessingDelete(false);
    setIsDeleteDialogOpen(false);
    onOpenChange(false); 
  };
  
  const effectiveIsSubmitting = isParentSubmitting || form.formState.isSubmitting;

  const difficultyAvailabilityFields: Array<{notAvailableKey: keyof QuestFormData, label: string}> = [
    { notAvailableKey: 'casualNotAvailable', label: 'Casual'},
    { notAvailableKey: 'normalNotAvailable', label: 'Normal'},
    { notAvailableKey: 'hardNotAvailable', label: 'Hard'},
    { notAvailableKey: 'eliteNotAvailable', label: 'Elite'},
  ];

  const epicDifficultyAvailabilityFields: Array<{notAvailableKey: keyof QuestFormData, label: string}> = [
    { notAvailableKey: 'epicCasualNotAvailable', label: 'Epic Casual'},
    { notAvailableKey: 'epicNormalNotAvailable', label: 'Epic Normal'},
    { notAvailableKey: 'epicHardNotAvailable', label: 'Epic Hard'},
    { notAvailableKey: 'epicEliteNotAvailable', label: 'Epic Elite'},
  ];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!effectiveIsSubmitting && !isProcessingDelete) onOpenChange(open); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline">{initialData ? "Edit Quest Definition" : "Create Quest Definition"}</DialogTitle>
            <DialogDescription>
              {initialData ? "Update the quest's core details." : "Define a new quest for the master list."}
              User completions are managed separately.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
              <ScrollArea className="h-[60vh] pr-6">
                <div className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Quest Name</FormLabel><FormControl><Input {...field} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="adventurePackName" render={({ field }) => (
                    <FormItem><FormLabel>Adventure Pack Name</FormLabel><FormControl><Input {...field} value={field.value ?? ""} placeholder="e.g., The Lost Gatekeepers" disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="location" render={({ field }) => (
                    <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} value={field.value ?? ""} placeholder="e.g., The Harbor" disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="questGiver" render={({ field }) => (
                    <FormItem><FormLabel>Quest Giver</FormLabel><FormControl><Input {...field} value={field.value ?? ""} placeholder="e.g., Baudry Cartamon" disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="duration" render={({ field }) => (
                    <FormItem><FormLabel>Duration</FormLabel><FormControl><Input {...field} value={field.value ?? ""} placeholder="e.g., 20m or PT20M" disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="baseFavor" render={({ field }) => (
                    <FormItem><FormLabel>Base Favor</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="patron" render={({ field }) => (
                    <FormItem><FormLabel>Patron</FormLabel><FormControl><Input {...field} value={field.value ?? ""} placeholder="e.g., The Coin Lords" disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <Separator className="my-4" />
                  <FormLabel className="text-lg font-semibold">Heroic Details</FormLabel>
                   <FormField control={form.control} name="level" render={({ field }) => (
                    <FormItem><FormLabel>Heroic Level</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="casualExp" render={({ field }) => (
                      <FormItem><FormLabel>Casual EXP</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="normalExp" render={({ field }) => (
                      <FormItem><FormLabel>Normal EXP</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="hardExp" render={({ field }) => (
                      <FormItem><FormLabel>Hard EXP</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="eliteExp" render={({ field }) => (
                      <FormItem><FormLabel>Elite EXP</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="space-y-3 p-3 border rounded-md">
                      <FormLabel className="text-md font-medium">Heroic Difficulty Availability</FormLabel>
                       <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {difficultyAvailabilityFields.map(df => (
                          <FormField
                              key={`heroic-${df.notAvailableKey}`}
                              control={form.control}
                              name={df.notAvailableKey}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={effectiveIsSubmitting} /></FormControl>
                                  <FormLabel className="font-normal">Not Available: {df.label}</FormLabel>
                                </FormItem>
                              )}
                            />
                        ))}
                      </div>
                  </div>

                  <Separator className="my-4" />
                  <FormLabel className="text-lg font-semibold">Epic Details (Optional)</FormLabel>
                  <FormField control={form.control} name="epicBaseLevel" render={({ field }) => (
                    <FormItem><FormLabel>Epic Level</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} placeholder="e.g., 20" disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="epicCasualExp" render={({ field }) => (
                      <FormItem><FormLabel>Epic Casual EXP</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="epicNormalExp" render={({ field }) => (
                      <FormItem><FormLabel>Epic Normal EXP</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="epicHardExp" render={({ field }) => (
                      <FormItem><FormLabel>Epic Hard EXP</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="epicEliteExp" render={({ field }) => (
                      <FormItem><FormLabel>Epic Elite EXP</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="space-y-3 p-3 border rounded-md">
                      <FormLabel className="text-md font-medium">Epic Difficulty Availability</FormLabel>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {epicDifficultyAvailabilityFields.map(df => (
                          <FormField
                              key={`epic-${df.notAvailableKey}`}
                              control={form.control}
                              name={df.notAvailableKey}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={effectiveIsSubmitting} /></FormControl>
                                  <FormLabel className="font-normal">Not Available: {df.label}</FormLabel>
                                </FormItem>
                              )}
                            />
                        ))}
                      </div>
                  </div>

                  <Separator className="my-4" />
                  <FormLabel className="text-lg font-semibold">Wiki and Map Details (Optional)</FormLabel>
                  <FormField control={form.control} name="wikiUrl" render={({ field }) => (
                      <FormItem>
                          <FormLabel>DDO Wiki URL</FormLabel>
                          <FormControl><Input {...field} value={field.value ?? ""} placeholder="https://ddowiki.com/page/Quest_Name" disabled={effectiveIsSubmitting} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                   <div>
                        <Label>Map Image URLs</Label>
                        {fields.map((field, index) => (
                            <FormField
                            key={field.id}
                            control={form.control}
                            name={`mapUrls.${index}.value`}
                            render={({ field }) => (
                                <FormItem className="flex items-center space-x-2 mt-2">
                                <FormControl>
                                    <Input {...field} placeholder={`https://ddowiki.com/images/map_${index + 1}.jpg`} disabled={effectiveIsSubmitting} />
                                </FormControl>
                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={effectiveIsSubmitting}><Trash2 className="h-4 w-4" /></Button>
                                </FormItem>
                            )}
                            />
                        ))}
                        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append({ value: "" })} disabled={effectiveIsSubmitting}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Map URL
                        </Button>
                    </div>

                </div>
              </ScrollArea>
              <DialogFooter className="pt-4 border-t">
                {initialData && (
                  <Button type="button" variant="destructive" onClick={() => setIsDeleteDialogOpen(true)} disabled={effectiveIsSubmitting || isProcessingDelete}>
                    {isProcessingDelete ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Delete
                  </Button>
                )}
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={effectiveIsSubmitting || isProcessingDelete}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={effectiveIsSubmitting || isProcessingDelete}>
                  {effectiveIsSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {initialData ? "Save Changes" : "Create Quest"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the quest "{initialData?.name}"? This action cannot be undone. 
              This will remove the quest from the master list; user completion data for this quest will be orphaned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)} disabled={isProcessingDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isProcessingDelete} variant="destructive">
              {isProcessingDelete ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Quest
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
