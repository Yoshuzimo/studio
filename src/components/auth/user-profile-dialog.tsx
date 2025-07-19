// src/components/auth/user-profile-dialog.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { User as AppUser } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, User, Mail, Image as ImageIcon, KeyRound, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Progress } from '../ui/progress';

const profileFormSchema = z.object({
  displayName: z.string().min(3, "Must be 3-30 characters.").max(30, "Must be 3-30 characters."),
  email: z.string().email("Please enter a valid email address."),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

interface UserProfileDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  user: AppUser;
}

export function UserProfileDialog({ isOpen, onOpenChange, user }: UserProfileDialogProps) {
  const { 
    currentUser, 
    updateUserDisplayName, 
    updateUserEmail, 
    reauthenticateWithPassword,
    isLoading: isAuthLoading 
  } = useAuth();
  
  const { toast } = useToast();
  const { control, handleSubmit, reset, watch } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { displayName: user.displayName || '', email: user.email || '' }
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.iconUrl);
  
  const [reauthStep, setReauthStep] = useState(false);
  const [password, setPassword] = useState('');
  const [newEmailToConfirm, setNewEmailToConfirm] = useState('');
  const [emailChangeSuccess, setEmailChangeSuccess] = useState(false);
  const [confirmEmailChangeOpen, setConfirmEmailChangeOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      reset({ displayName: user.displayName || '', email: user.email || '' });
      setPreviewUrl(user.iconUrl);
      setSelectedFile(null);
      setIsUploading(false);
      setUploadProgress(null);
      setReauthStep(false);
      setPassword('');
      setNewEmailToConfirm('');
      setEmailChangeSuccess(false);
    }
  }, [isOpen, user, reset]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const uploadToCloudinary = async (file: File): Promise<string | null> => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset || !currentUser) return null;

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const timestamp = Math.round(Date.now() / 1000);
      const idToken = await currentUser.getIdToken();
      
      const signatureResponse = await fetch('/api/cloudinary/signature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ timestamp, upload_preset: uploadPreset })
      });

      if (!signatureResponse.ok) {
        throw new Error('Failed to get upload signature from server.');
      }
      const signatureData = await signatureResponse.json();
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);
      formData.append("timestamp", String(signatureData.timestamp));
      formData.append("api_key", signatureData.api_key);
      formData.append("signature", signatureData.signature);
      
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: formData });
      if (!response.ok) throw new Error((await response.json()).error.message);
      
      setUploadProgress(100);
      return (await response.json()).secure_url;
    } catch (error) {
      toast({ title: "Image Upload Failed", description: (error as Error).message, variant: "destructive" });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    setIsProcessing(true);
    let changesMade = false;

    // Handle Icon Change
    if (selectedFile) {
      const uploadedUrl = await uploadToCloudinary(selectedFile);
      if (uploadedUrl) {
        await updateUserDisplayName(data.displayName, uploadedUrl); // Assume updateUserDisplayName can handle iconUrl
        changesMade = true;
      } else {
        setIsProcessing(false);
        return; 
      }
    } else if (data.displayName !== user.displayName) {
      // Handle Display Name only change
      await updateUserDisplayName(data.displayName, user.iconUrl);
      changesMade = true;
    }

    // Handle Email Change
    if (data.email !== user.email) {
      setNewEmailToConfirm(data.email);
      setConfirmEmailChangeOpen(true);
      // The rest is handled by confirmation dialogs
    } else if (changesMade) {
        toast({ title: "Profile Updated", description: "Your profile details have been saved." });
        onOpenChange(false);
    } else {
        toast({ title: "No Changes", description: "No changes were made to your profile." });
        onOpenChange(false);
    }
    
    setIsProcessing(false);
  };

  const proceedWithEmailChange = async () => {
    setConfirmEmailChangeOpen(false);
    setReauthStep(true);
  };
  
  const handleReauthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsProcessing(true);
    try {
      await reauthenticateWithPassword(password);
      await updateUserEmail(newEmailToConfirm);
      setReauthStep(false);
      setEmailChangeSuccess(true);
    } catch (error) {
       // Errors are toasted in AuthContext
    } finally {
      setIsProcessing(false);
    }
  };
  
  const isWatchedEmailDifferent = watch('email') !== user.email;
  const pageOverallLoading = isAuthLoading || isProcessing;

  const renderContent = () => {
    if (emailChangeSuccess) {
      return (
        <div className="text-center space-y-4 py-4">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
          <p className="text-lg font-medium">Email Change Initiated</p>
          <p className="text-muted-foreground">
            Your request to change your email to <strong>{newEmailToConfirm}</strong> has been processed.
            A verification email has been sent to this new address. Please click the link in that email to complete the change.
          </p>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      );
    }

    if (reauthStep) {
      return (
        <form onSubmit={handleReauthSubmit} className="space-y-6">
           <DialogHeader>
            <DialogTitle>Re-authenticate to Change Email</DialogTitle>
            <DialogDescription>For security, please enter your current password to change your email to <strong>{newEmailToConfirm}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-4">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              disabled={pageOverallLoading} className="text-base" placeholder="Enter your current password"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReauthStep(false)} disabled={pageOverallLoading}>Back</Button>
            <Button type="submit" className="text-lg py-3" disabled={pageOverallLoading || !password}>
              {pageOverallLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <KeyRound className="mr-2 h-5 w-5" />}
              Verify and Update
            </Button>
          </DialogFooter>
        </form>
      );
    }

    return (
       <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="font-headline">Edit Your Profile</DialogTitle>
            <DialogDescription>Update your display name, email, and avatar. Changes are saved below.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24">
                  <AvatarImage src={previewUrl || undefined} alt="User Avatar Preview"/>
                  <AvatarFallback><User className="h-12 w-12 text-muted-foreground" /></AvatarFallback>
              </Avatar>
              <Input id="avatar-upload" type="file" accept="image/*" onChange={handleFileChange} disabled={pageOverallLoading} className="text-xs w-auto"/>
              {isUploading && <Progress value={uploadProgress} className="w-full h-2" />}
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Controller name="displayName" control={control} render={({ field }) => <Input id="displayName" {...field} disabled={pageOverallLoading} />} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Account Email</Label>
            <Controller name="email" control={control} render={({ field }) => <Input id="email" type="email" {...field} disabled={pageOverallLoading} />} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" disabled={pageOverallLoading}>Cancel</Button></DialogClose>
            <Button type="submit" disabled={pageOverallLoading}>
              {pageOverallLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isWatchedEmailDifferent ? "Continue..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {renderContent()}
        <AlertDialog open={confirmEmailChangeOpen} onOpenChange={setConfirmEmailChangeOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Email Change</AlertDialogTitle>
                    <AlertDialogDescription>
                        You are about to change your login email to <strong>{newEmailToConfirm}</strong>. A verification email will be sent to this new address, and you must click the link inside it to finalize the change. Are you sure you want to proceed?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setConfirmEmailChangeOpen(false)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={proceedWithEmailChange}>Proceed</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
