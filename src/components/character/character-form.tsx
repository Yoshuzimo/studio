
// src/components/character/character-form.tsx
"use client";

import React, { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { Character } from '@/types';
import { Loader2, UploadCloud } from 'lucide-react';
import Image from 'next/image';

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
import { storage } from "@/lib/firebase"; // Firebase storage instance
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

const characterFormSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  level: z.coerce.number().min(1, { message: "Level must be at least 1." }).max(34, { message: "Level cannot exceed 34."}),
});

export type CharacterFormData = z.infer<typeof characterFormSchema>;

interface CharacterFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: CharacterFormData, id?: string, iconUrl?: string) => Promise<void>;
  initialData?: Character;
  isSubmitting?: boolean; // This is the overall form submission state from the parent
}

export function CharacterForm({ isOpen, onOpenChange, onSubmit, initialData, isSubmitting: isParentSubmitting = false }: CharacterFormProps) {
  const form = useForm<CharacterFormData>({
    resolver: zodResolver(characterFormSchema),
    defaultValues: initialData ? { name: initialData.name, level: initialData.level } : { name: "", level: 1 },
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialData?.iconUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      form.reset(initialData ? { name: initialData.name, level: initialData.level } : { name: "", level: 1 });
      setSelectedFile(null);
      setPreviewUrl(initialData?.iconUrl || null);
      setIsUploading(false);
      setUploadProgress(null);
    }
  }, [initialData, form, isOpen]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedFile(null);
      setPreviewUrl(initialData?.iconUrl || null); // Revert to original if file is deselected
    }
  };

  const handleSubmit = async (data: CharacterFormData) => {
    if (!initialData && selectedFile) {
      // This case (new character with file) is disabled for now
      toast({ title: "Info", description: "Please create the character first, then edit to add an icon.", variant: "default" });
      return;
    }

    let finalIconUrl = initialData?.iconUrl;

    if (selectedFile && initialData?.id) { // Only upload if editing and file is selected
      setIsUploading(true);
      setUploadProgress(0);
      const storageRef = ref(storage, `character-icons/${initialData.id}/${selectedFile.name}`);
      const uploadTask = uploadBytesResumable(storageRef, selectedFile);

      try {
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => {
              console.error("Upload failed:", error);
              toast({ title: "Icon Upload Failed", description: error.message, variant: "destructive" });
              setIsUploading(false);
              setUploadProgress(null);
              reject(error);
            },
            async () => {
              finalIconUrl = await getDownloadURL(uploadTask.snapshot.ref);
              setIsUploading(false);
              setUploadProgress(100); // Mark as complete
              resolve();
            }
          );
        });
      } catch (error) {
        // Error already toasted, just ensure we don't proceed with onSubmit if upload failed
        return;
      }
    }
    // If we are here, either upload succeeded, or no new file was selected.
    // isParentSubmitting handles the loader on the submit button itself.
    await onSubmit(data, initialData?.id, finalIconUrl);
    // Dialog closing and form reset are handled by parent or useEffect on isOpen.
  };
  
  const effectiveIsSubmitting = isParentSubmitting || isUploading;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!effectiveIsSubmitting) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">{initialData ? "Edit Character" : "Create Character"}</DialogTitle>
          <DialogDescription>
            {initialData ? "Update your character's details." : "Add a new character to your roster."}
            {initialData && " You can also upload a character icon."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
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

            {initialData && ( // Only show for existing characters
              <FormItem>
                <FormLabel htmlFor="character-icon-upload">Character Icon</FormLabel>
                <Input 
                  id="character-icon-upload" 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                  disabled={effectiveIsSubmitting}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
                {previewUrl && (
                  <div className="mt-2 relative w-24 h-24 rounded-md overflow-hidden border-2 border-primary">
                    <Image src={previewUrl} alt="Icon preview" layout="fill" objectFit="contain" sizes="96px" />
                  </div>
                )}
                {isUploading && uploadProgress !== null && (
                   <div className="mt-2">
                     <Progress value={uploadProgress} className="w-full h-2" />
                     <p className="text-xs text-muted-foreground text-center mt-1">{Math.round(uploadProgress)}% uploaded</p>
                   </div>
                )}
              </FormItem>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={effectiveIsSubmitting}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={effectiveIsSubmitting}>
                {(isParentSubmitting || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isUploading ? "Uploading..." : (initialData ? "Save Changes" : "Create Character")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
