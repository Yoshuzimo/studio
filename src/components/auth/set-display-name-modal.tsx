
// src/components/auth/set-display-name-modal.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SetDisplayNameModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function SetDisplayNameModal({ isOpen, onOpenChange }: SetDisplayNameModalProps) {
  const { updateUserDisplayName, isLoading: isAuthContextLoading } = useAuth();
  const [newDisplayName, setNewDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setNewDisplayName(''); // Reset on open
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newDisplayName.trim().length < 3 || newDisplayName.trim().length > 30) {
      toast({
        title: "Invalid Display Name",
        description: "Display name must be between 3 and 30 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await updateUserDisplayName(newDisplayName);
      if (success) {
        onOpenChange(false); // Close modal on success
      }
      // Toasts for success/failure are handled by updateUserDisplayName
    } catch (error) {
      // Error already toasted by updateUserDisplayName
      console.error("Error setting display name from modal:", error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const pageLoading = isAuthContextLoading || isSubmitting;

  return (
    <Dialog open={isOpen} onOpenChange={(openState) => { if (!pageLoading) onOpenChange(openState); }}>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}> {/* Prevent closing on outside click */}
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Set Your Display Name</DialogTitle>
          <DialogDescription>
            Choose a unique display name. This will be visible to other users and administrators. (3-30 characters)
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="new-display-name">Display Name</Label>
            <Input
              id="new-display-name"
              type="text"
              placeholder="Your Awesome Name"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              required
              minLength={3}
              maxLength={30}
              disabled={pageLoading}
              className="text-base"
            />
          </div>
          <DialogFooter>
            {/* No cancel button to force name setting */}
            <Button type="submit" className="w-full" disabled={pageLoading || newDisplayName.trim().length < 3 || newDisplayName.trim().length > 30}>
              {pageLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <UserCheck className="mr-2 h-5 w-5" />
              )}
              {pageLoading ? 'Saving...' : 'Save Display Name'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
