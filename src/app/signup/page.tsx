
// src/app/signup/page.tsx
"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function SignupPage() {
  const { signup, isLoading: isAuthLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Removed displayName state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please ensure both password fields are identical.", variant: "destructive" });
      return;
    }
    // Removed displayName client-side validation

    setIsSubmitting(true);
    try {
      await signup(email, password); // Removed displayName from signup call
      // Navigation is handled within auth context or by RouteGuard
    } catch (error) {
      // Error is toasted in auth context
      console.error("Signup page submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const pageLoading = isAuthLoading || isSubmitting;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <UserPlus className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="font-headline text-3xl">Create Your Account</CardTitle>
          <CardDescription>Join the DDO Toolkit community.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Removed Display Name FormField */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                placeholder="•••••••• (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={pageLoading}
                className="text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={pageLoading}
                className="text-base"
              />
            </div>
            <Button type="submit" className="w-full text-lg py-6" disabled={pageLoading}>
              {pageLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
              {pageLoading ? 'Creating Account...' : 'Sign Up'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-destructive hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
