
// src/components/account/account-form.tsx
"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { Account } from '@/types';
import { Loader2 } from 'lucide-react';

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
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const accountFormSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }).max(50, {
    message: "Name cannot be more than 50 characters."
  }),
});

export type AccountFormData = z.infer<typeof accountFormSchema>;

interface AccountFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: AccountFormData) => Promise<void>;
  initialData?: Account;
  isSubmitting?: boolean;
}

export function AccountForm({ isOpen, onOpenChange, onSubmit, initialData, isSubmitting: isParentSubmitting = false }: AccountFormProps) {
  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: initialData ? { name: initialData.name } : { name: "" },
  });

  React.useEffect(() => {
    if (isOpen) {
      form.reset(initialData ? { name: initialData.name } : { name: "" });
    }
  }, [initialData, form, isOpen]);

  const handleSubmit = async (data: AccountFormData) => {
    await onSubmit(data);
  };
  
  const effectiveIsSubmitting = isParentSubmitting || form.formState.isSubmitting;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!effectiveIsSubmitting) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">{initialData ? "Edit Account" : "Create Account"}</DialogTitle>
          <DialogDescription>
            {initialData ? "Update this account's name." : "Create a new account to manage a separate collection of adventure packs."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Main Account, F2P Account" {...field} disabled={effectiveIsSubmitting || initialData?.name === 'Default'} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={effectiveIsSubmitting}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={effectiveIsSubmitting || initialData?.name === 'Default'}>
                {effectiveIsSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {initialData ? "Save Changes" : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
