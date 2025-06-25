
// src/components/admin/adventure-pack-form.tsx
"use client";

import React, { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { AdventurePack } from '@/types';
import { Loader2, Trash2 } from 'lucide-react';

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const adventurePackFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  pointsCost: z.coerce.number().min(0, "Point Cost must be 0 or greater.").optional().or(z.literal('')),
  totalFavor: z.coerce.number().min(0, "Total Favor must be 0 or greater.").optional().or(z.literal('')),
});

export type AdventurePackFormData = z.infer<typeof adventurePackFormSchema>;

interface AdventurePackFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: AdventurePackFormData) => Promise<void>;
  onDelete: () => Promise<void>;
  initialData?: AdventurePack;
  isSubmitting?: boolean;
}

export function AdventurePackForm({ 
  isOpen, 
  onOpenChange, 
  onSubmit, 
  onDelete,
  initialData, 
  isSubmitting: isParentSubmitting = false 
}: AdventurePackFormProps) {
  const form = useForm<AdventurePackFormData>({
    resolver: zodResolver(adventurePackFormSchema),
    defaultValues: initialData ? {
      name: initialData.name,
      pointsCost: initialData.pointsCost ?? undefined,
      totalFavor: initialData.totalFavor ?? undefined,
    } : {
      name: "",
    },
  });

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      form.reset(initialData ? {
        name: initialData.name,
        pointsCost: initialData.pointsCost ?? undefined,
        totalFavor: initialData.totalFavor ?? undefined,
      } : {
        name: "",
        pointsCost: undefined,
        totalFavor: undefined,
      });
    }
  }, [initialData, form, isOpen]);

  const handleFormSubmit = async (data: AdventurePackFormData) => {
    await onSubmit(data);
  };

  const handleDeleteConfirm = async () => {
    setIsProcessingDelete(true);
    await onDelete();
    setIsProcessingDelete(false);
    setIsDeleteDialogOpen(false);
    onOpenChange(false); 
  };
  
  const effectiveIsSubmitting = isParentSubmitting || form.formState.isSubmitting;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!effectiveIsSubmitting && !isProcessingDelete) onOpenChange(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline">{initialData ? "Edit Adventure Pack" : "Create Adventure Pack"}</DialogTitle>
            <DialogDescription>
              {initialData ? "Update the adventure pack's details." : "Define a new adventure pack."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Pack Name</FormLabel><FormControl><Input {...field} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="pointsCost" render={({ field }) => (
                <FormItem><FormLabel>Point Cost (Optional)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} placeholder="e.g., 950" disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="totalFavor" render={({ field }) => (
                <FormItem><FormLabel>Total Favor (Optional)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} placeholder="e.g., 100" disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
              )} />
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
                  {initialData ? "Save Changes" : "Create Pack"}
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
              Are you sure you want to delete the adventure pack "{initialData?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)} disabled={isProcessingDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isProcessingDelete} variant="destructive">
              {isProcessingDelete ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Pack
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
