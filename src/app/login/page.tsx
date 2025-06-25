
// src/app/login/page.tsx
"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LogIn, MailQuestion, Send } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const { login, isLoading: isAuthLoading, sendPasswordReset } = useAuth();
  const [identifier, setIdentifier] = useState(''); // Changed from email to identifier
  const [password, setPassword] = useState('');
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  const { toast } = useToast();

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmittingLogin(true);
    try {
      await login(identifier, password); // Pass identifier
    } catch (error) {
      // Error is toasted in auth context
      console.error("Login page submission error:", error);
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const handlePasswordResetRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetEmail) {
      toast({ title: "Email Required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    setIsSubmittingReset(true);
    try {
      await sendPasswordReset(resetEmail);
    } catch (error) {
      console.error("Password reset request error from page:", error);
    } finally {
      setIsSubmittingReset(false);
    }
  };
  
  const pageLoading = isAuthLoading || isSubmittingLogin || isSubmittingReset;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4 py-8">
      <Card className="w-full max-w-md shadow-2xl">
        {!showResetForm ? (
          <>
            <CardHeader className="text-center">
              <LogIn className="mx-auto h-12 w-12 text-primary mb-4" />
              <CardTitle className="font-headline text-3xl">Welcome Back!</CardTitle>
              <CardDescription>Log in to access your DDO Toolkit.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLoginSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="identifier">Email or Display Name</Label> {/* Changed label */}
                  <Input
                    id="identifier" // Kept id as identifier for simplicity, though it was 'email'
                    type="text" // Changed type to text
                    placeholder="you@example.com or YourDisplayName" // Updated placeholder
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    disabled={pageLoading}
                    className="text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={pageLoading}
                    className="text-base"
                  />
                </div>
                <Button type="submit" className="w-full text-lg py-6" disabled={pageLoading}>
                  {isSubmittingLogin ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
                  {isSubmittingLogin ? 'Logging in...' : 'Log In'}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <Button variant="link" onClick={() => setShowResetForm(true)} className="text-sm text-destructive hover:underline" disabled={pageLoading}>
                  Forgot Password?
                </Button>
              </div>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="font-medium text-destructive hover:underline">
                  Sign up
                </Link>
              </p>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="text-center">
              <MailQuestion className="mx-auto h-12 w-12 text-primary mb-4" />
              <CardTitle className="font-headline text-2xl">Reset Your Password</CardTitle>
              <CardDescription>Enter your email address below. If an account exists, we&apos;ll send you a link to reset your password.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordResetRequest} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email Address</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    disabled={pageLoading}
                    className="text-base"
                  />
                </div>
                <Button type="submit" className="w-full text-lg py-6" disabled={pageLoading}>
                  {isSubmittingReset ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                  {isSubmittingReset ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <Button variant="link" onClick={() => { setShowResetForm(false); setResetEmail(''); }} className="text-sm text-primary hover:underline" disabled={pageLoading}>
                  Back to Login
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
