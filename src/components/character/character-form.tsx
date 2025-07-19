// src/components/character/character-form.tsx
"use client";

import React, { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { Character } from '@/types';
import { Loader2 } from 'lucide-react';
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
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { runFlow } from '@genkit-ai/next/client';
import { generateCloudinarySignature } from "@/ai/flows/generate-cloudinary-signature-flow";
import { useAuth } from "@/context/auth-context";


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
  isSubmitting?: boolean;
}

export function CharacterForm({ isOpen, onOpenChange, onSubmit, initialData, isSubmitting: isParentSubmitting = false }: CharacterFormProps) {
  const { currentUser } = useAuth();
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
      setPreviewUrl(initialData?.iconUrl || null);
    }
  };

  const uploadToCloudinary = async (file: File): Promise<string | null> => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      toast({ title: "Client Configuration Error", description: "Cloudinary settings are missing.", variant: "destructive" });
      return null;
    }
    if (!currentUser) {
      toast({ title: "Authentication Error", description: "You must be logged in to upload.", variant: "destructive" });
      return null;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const timestamp = Math.round(Date.now() / 1000);
      const idToken = await currentUser.getIdToken();

      const signatureResponse = await runFlow(generateCloudinarySignature, {
          timestamp,
          upload_preset: uploadPreset,
      }, { auth: idToken });
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);
      formData.append("timestamp", String(signatureResponse.timestamp));
      formData.append("api_key", signatureResponse.api_key);
      formData.append("signature", signatureResponse.signature);
      
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || "Cloudinary upload failed.");
      }
      
      const data = await response.json();
      setUploadProgress(100);
      return data.secure_url;

    } catch (error) {
      console.error("Upload failed:", error);
      toast({ title: "Icon Upload Failed", description: (error as Error).message, variant: "destructive" });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (data: CharacterFormData) => {
    let finalIconUrl = initialData?.iconUrl || null;

    if (selectedFile) {
      const uploadedUrl = await uploadToCloudinary(selectedFile);
      if (uploadedUrl) {
        finalIconUrl = uploadedUrl;
      } else {
        // Upload failed, so we shouldn't proceed with the character form submission if an icon change was intended
        toast({ title: "Submission Halted", description: "Icon upload failed, so character details were not saved.", variant: "destructive" });
        return;
      }
    }
    
    await onSubmit(data, initialData?.id, finalIconUrl);
  };
  
  const effectiveIsSubmitting = isParentSubmitting || isUploading;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!effectiveIsSubmitting) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">{initialData ? "Edit Character" : "Create Character"}</DialogTitle>
          <DialogDescription>
            {initialData ? "Update your character's details and icon." : "Add a new character to your roster."}
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
