// src/components/character/character-form.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { Character, Account } from '@/types';
import { Loader2, ImagePlus } from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { useAppData } from "@/context/app-data-context";


const characterFormSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  level: z.coerce.number().min(1, { message: "Level must be at least 1." }).max(34, { message: "Level cannot exceed 34."}),
  accountId: z.string().min(1, { message: "An account must be selected." }),
  iconUrl: z.string().url().nullable().optional(),
});

export type CharacterFormData = z.infer<typeof characterFormSchema>;

interface CharacterFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: CharacterFormData) => Promise<void>;
  initialData?: Character;
  isSubmitting?: boolean;
}

export function CharacterForm({ isOpen, onOpenChange, onSubmit, initialData, isSubmitting: isParentSubmitting = false }: CharacterFormProps) {
  const { currentUser } = useAuth();
  const { accounts, activeAccountId } = useAppData();
  const { toast } = useToast();
  
  const form = useForm<CharacterFormData>({
    resolver: zodResolver(characterFormSchema),
    defaultValues: { 
        name: "", 
        level: 1, 
        accountId: activeAccountId || undefined,
        iconUrl: null
    },
  });
  
  const [isUploading, setIsUploading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const defaultValues = initialData 
        ? { 
            name: initialData.name, 
            level: initialData.level, 
            accountId: initialData.accountId,
            iconUrl: initialData.iconUrl 
          } 
        : { 
            name: "", 
            level: 1, 
            accountId: activeAccountId || undefined,
            iconUrl: null
          };
      form.reset(defaultValues);
      setPreviewImageUrl(defaultValues.iconUrl);
    }
  }, [initialData, isOpen, activeAccountId, form]);

 const handleIconUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      toast({ title: "Client Configuration Error", description: "Cloudinary settings are missing.", variant: "destructive" });
      return;
    }
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    
    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      
      if (data.secure_url) {
        form.setValue('iconUrl', data.secure_url, { shouldValidate: true });
        setPreviewImageUrl(data.secure_url);
        toast({ title: "Image Uploaded", description: "Your new icon is ready to be saved." });
      } else {
        throw new Error(data.error?.message || "Unknown Cloudinary error");
      }
    } catch (error) {
      toast({ title: "Upload Failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmission = (data: CharacterFormData) => {
    onSubmit(data);
  };
  
  const effectiveIsSubmitting = isParentSubmitting || form.formState.isSubmitting || isUploading;

  return (
      <Dialog open={isOpen} onOpenChange={(open) => { if (!effectiveIsSubmitting) onOpenChange(open); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-headline">{initialData ? "Edit Character" : "Create Character"}</DialogTitle>
            <DialogDescription>
              {initialData ? "Update this character's name, level, or background image." : "Create a new character for your trackers."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmission)} className="space-y-8 pt-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Character Name" {...field} disabled={effectiveIsSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Character Level" {...field} disabled={effectiveIsSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''} disabled={effectiveIsSubmitting}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts.map((account) => (
                           <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Assign this character to an account to track owned packs.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel htmlFor="icon-upload-button">Card Background Image (Optional)</FormLabel>
                <div className="flex items-center gap-4">
                  <Input
                    id="icon-upload-input"
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleIconUpload}
                    accept="image/png, image/jpeg, image/gif"
                    disabled={effectiveIsSubmitting}
                  />
                  <Button
                    id="icon-upload-button"
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={effectiveIsSubmitting}
                  >
                     <ImagePlus className="mr-2 h-4 w-4" />
                    {isUploading ? "Uploading..." : "Upload Image"}
                  </Button>
                  {previewImageUrl && (
                      <img src={previewImageUrl} alt="Thumbnail preview" className="h-10 w-10 rounded-md object-cover border" />
                  )}
                </div>
                 <FormDescription>
                    Choose an image for the character card's background.
                </FormDescription>
              </FormItem>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={effectiveIsSubmitting}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={effectiveIsSubmitting}>
                  {(isParentSubmitting || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {initialData ? "Save Changes" : "Create Character"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
  );
}
