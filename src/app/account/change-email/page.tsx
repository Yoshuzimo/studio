
// src/app/account/change-email/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, UserCog, KeyRound, Mail, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

type Step = 'reauth' | 'newEmail' | 'success';

export default function ChangeEmailPage() {
  const { currentUser, isLoading: authIsLoading, reauthenticateWithPassword, updateUserEmail } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState<Step>('reauth');
  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router]);

  const handleReauthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsProcessing(true);
    try {
      await reauthenticateWithPassword(password);
      setCurrentStep('newEmail');
      setPassword(''); // Clear password field
    } catch (error) {
      // Error toast is handled in AuthContext
      console.error("Re-authentication failed on page:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
        return;
    }
    setIsProcessing(true);
    try {
      await updateUserEmail(newEmail);
      setCurrentStep('success');
      // Toast for success is handled in AuthContext
    } catch (error) {
      // Error toast is handled in AuthContext
      console.error("Email update failed on page:", error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const pageOverallLoading = authIsLoading || isProcessing;

  if (authIsLoading && !currentUser) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="mr-2 h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) {
     return (
      <div className="container mx-auto py-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Please log in to change your email address.</p>
        <Button onClick={() => router.push('/login')} className="mt-6">Log In</Button>
      </div>
    );
  }

  return (
    <div className="py-8 space-y-6 flex justify-center items-start">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex items-center">
            <UserCog className="mr-3 h-7 w-7 text-primary" /> Change Your Email Address
          </CardTitle>
          {currentStep === 'reauth' && (
            <CardDescription>
              For security, please re-enter your current password to continue.
            </CardDescription>
          )}
          {currentStep === 'newEmail' && (
            <CardDescription>
              Enter your new email address. A verification link will be sent to it.
            </CardDescription>
          )}
          {currentStep === 'success' && (
            <CardDescription>
              Your email update process has started!
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {currentStep === 'reauth' && (
            <form onSubmit={handleReauthSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={pageOverallLoading}
                  className="text-base"
                  placeholder="Enter your current password"
                />
              </div>
              <Button type="submit" className="w-full text-lg py-3" disabled={pageOverallLoading || !password}>
                {pageOverallLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <KeyRound className="mr-2 h-5 w-5" />}
                Verify Password
              </Button>
            </form>
          )}

          {currentStep === 'newEmail' && (
            <form onSubmit={handleNewEmailSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="new-email">New Email Address</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  disabled={pageOverallLoading}
                  className="text-base"
                  placeholder="you@example.com"
                />
              </div>
              <Button type="submit" className="w-full text-lg py-3" disabled={pageOverallLoading || !newEmail}>
                {pageOverallLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Mail className="mr-2 h-5 w-5" />}
                Update Email
              </Button>
               <Button variant="outline" onClick={() => setCurrentStep('reauth')} className="w-full mt-2" disabled={pageOverallLoading}>
                Cancel
              </Button>
            </form>
          )}

          {currentStep === 'success' && (
            <div className="text-center space-y-4 py-4">
              <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
              <p className="text-lg font-medium">Email Change Initiated</p>
              <p className="text-muted-foreground">
                Your request to change your email to <strong>{newEmail}</strong> has been processed.
                A verification email has been sent to this new address. Please click the link in that email to complete the change and verify your new email.
              </p>
              <p className="text-sm text-muted-foreground">
                You may need to log in again after verifying your new email address.
              </p>
              <Button onClick={() => router.push('/')} className="mt-4">
                Back to Homepage
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
