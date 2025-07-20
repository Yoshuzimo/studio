// src/components/character/character-form.tsx
"use client";

import React, { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { Character, Account } from '@/types';
import { Loader2, ImagePlus } from 'lucide-react';
import Script from 'next/script';

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
});

export type CharacterFormData = z.infer<typeof characterFormSchema>;

interface CharacterFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: CharacterFormData, id?: string, iconUrl?: string | null) => Promise<void>;
  initialData?: Character;
  isSubmitting?: boolean;
}

declare global {
    interface Window {
        cloudinary: any;
    }
}


export function CharacterForm({ isOpen, onOpenChange, onSubmit, initialData, isSubmitting: isParentSubmitting = false }: CharacterFormProps) {
  const { currentUser } = useAuth();
  const { accounts, activeAccountId } = useAppData();
  
  const form = useForm<CharacterFormData>({
    resolver: zodResolver(characterFormSchema),
    defaultValues: initialData ? { name: initialData.name, level: initialData.level, accountId: initialData.accountId } : { name: "", level: 1, accountId: activeAccountId || undefined },
  });
  
  const [isCloudinaryScriptLoaded, setIsCloudinaryScriptLoaded] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  const { toast } = useToast();
  
  const uniqueId = React.useId();
  const imageUploadButtonId = `image-upload-button-${uniqueId}`;

  useEffect(() => {
    if (isOpen) {
      if (window.cloudinary) {
        setIsCloudinaryScriptLoaded(true);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      form.reset(initialData ? { name: initialData.name, level: initialData.level, accountId: initialData.accountId } : { name: "", level: 1, accountId: activeAccountId || undefined });
      setUploadedImageUrl(initialData?.iconUrl || null);
    }
  }, [initialData, form, isOpen, activeAccountId]);

  const openCloudinaryWidget = async () => {
    if (!isCloudinaryScriptLoaded || !currentUser) {
      toast({ title: "Widget not ready", description: "The image upload widget is not loaded yet or you are not logged in.", variant: "destructive" });
      return;
    }
    
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;

    if (!cloudName || !uploadPreset || !apiKey) {
      toast({ title: "Client Configuration Error", description: "Cloudinary settings are missing.", variant: "destructive" });
      return;
    }

    try {
        const idToken = await currentUser.getIdToken();
        const widget = window.cloudinary.createUploadWidget({
        cloudName: cloudName,
        uploadPreset: uploadPreset,
        apiKey: apiKey, 
        folder: "ddo_toolkit/characters",
        cropping: true,
        croppingAspectRatio: 4 / 3,
        showAdvancedOptions: true,
        sources: ['local', 'url', 'camera'],
        uploadSignature: async (callback: (signature: string) => void, paramsToSign: Record<string, any>) => {
            try {
                const response = await fetch('/api/cloudinary/signature', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                    body: JSON.stringify(paramsToSign),
                });

                if (!response.ok) {
                    const errorBody = await response.json();
                    throw new Error(errorBody.error || 'Failed to fetch signature.');
                }

                const { signature } = await response.json();
                callback(signature);
            } catch (error) {
                console.error("[Cloudinary Widget] Error fetching signature:", error);
                toast({ title: "Signature Error", description: (error as Error).message, variant: "destructive" });
            }
        },
        styles: {
            palette: {
                window: "#283593", windowBorder: "#3F51B5", tabIcon: "#FFFFFF", menuIcons: "#FFFFFF",
                textDark: "#000000", textLight: "#FFFFFF", link: "#FF9800", action: "#FF9800",
                inactiveTabIcon: "#BDBDBD", error: "#F44336", inProgress: "#0078FF",
                complete: "#4CAF50", sourceBg: "#303F9F"
            },
        }
        }, (error: any, result: any) => {
        if (error) {
            console.error("[Cloudinary Widget] Upload Error:", error);
            toast({ title: "Image Upload Error", description: error.message || "An unknown error occurred.", variant: "destructive" });
            return;
        }

        if (result && result.event === "success") {
            setUploadedImageUrl(result.info.secure_url);
            toast({ title: "Image Ready", description: "Your new image is ready to be saved with the character." });
        }
        });

        widget.open();
    } catch(error) {
        toast({ title: "Authentication Error", description: "Could not get authentication token for upload.", variant: "destructive" });
    }
  };

  const handleSubmit = async (data: CharacterFormData) => {
    await onSubmit(data, initialData?.id, uploadedImageUrl);
  };
  
  const effectiveIsSubmitting = isParentSubmitting || form.formState.isSubmitting;

  return (
    <>
     <Script
        id={`cloudinary-widget-script-${uniqueId}`}
        src="https://upload-widget.cloudinary.com/global/all.js"
        type="text/javascript"
        onLoad={() => {
          setIsCloudinaryScriptLoaded(true);
        }}
        onError={() => {
           console.error("Failed to load Cloudinary Upload Widget script.");
           toast({ title: "Error", description: "Could not load image uploader. Please refresh the page.", variant: "destructive" });
        }}
      />
      <Dialog open={isOpen} onOpenChange={(open) => { if (!effectiveIsSubmitting) onOpenChange(open); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-headline">{initialData ? "Edit Character" : "Create Character"}</DialogTitle>
            <DialogDescription>
              {initialData ? "Update this character's name, level, or background image." : "Create a new character for your trackers."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8 pt-4">
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
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={effectiveIsSubmitting}>
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
                <FormLabel htmlFor={imageUploadButtonId}>Card Background Image</FormLabel>
                <div className="flex items-center gap-4">
                  <Button
                    id={imageUploadButtonId}
                    type="button"
                    variant="outline"
                    onClick={openCloudinaryWidget}
                    disabled={!isCloudinaryScriptLoaded || effectiveIsSubmitting}
                  >
                     <ImagePlus className="mr-2 h-4 w-4" />
                    Upload & Edit Image
                  </Button>
                  {uploadedImageUrl && (
                      <img src={uploadedImageUrl} alt="Thumbnail preview" className="h-10 w-10 rounded-md object-cover border" />
                  )}
                </div>
                 <FormDescription>
                    Click to open the uploader. You can crop, resize, and edit your image before saving.
                </FormDescription>
              </FormItem>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={effectiveIsSubmitting}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={effectiveIsSubmitting}>
                  {isParentSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {initialData ? "Save Changes" : "Create Character"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
