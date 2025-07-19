
// src/app/suggestions/page.tsx
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lightbulb, Send, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { submitSuggestion, type SubmitSuggestionInput } from '@/ai/flows/submit-suggestion-flow';
import { useAuth } from '@/context/auth-context'; // Added
import { withAuth } from '@genkit-ai/next/client';

export default function SuggestionsPage() {
  const { currentUser, userData, isLoading: authIsLoading } = useAuth(); // Use auth context
  const [suggestionText, setSuggestionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!currentUser) {
      toast({ title: "Not Authenticated", description: "You must be logged in to submit a suggestion.", variant: "destructive" });
      setError("Please log in to submit a suggestion.");
      return;
    }

    if (suggestionText.trim().length < 10) {
      setError("Suggestion must be at least 10 characters long.");
      return;
    }
    if (suggestionText.trim().length > 5000) {
      setError("Suggestion cannot exceed 5000 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const input: SubmitSuggestionInput = { 
        suggestionText,
        suggesterId: currentUser.uid,
        suggesterName: userData?.displayName || currentUser.email || "Anonymous User"
      };
      // Wrap the flow call with the withAuth helper
      const result = await withAuth(submitSuggestion)(input);
      toast({
        title: "Suggestion Submitted!",
        description: result.message,
      });
      setSuggestionText(''); 
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      toast({
        title: "Submission Failed",
        description: `Could not submit your suggestion: ${errorMessage}`,
        variant: "destructive",
      });
      setError(`Submission failed: ${errorMessage}`);
      console.error("Suggestion submission error:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authIsLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!currentUser) {
    return (
      <div className="container mx-auto py-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Please log in to submit suggestions.</p>
        <Button onClick={() => window.location.href = '/login'} className="mt-6">Log In</Button>
      </div>
    );
  }


  return (
    <div className="py-8 space-y-8"> {/* Removed container mx-auto */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-headline text-3xl font-bold flex items-center">
          <Lightbulb className="mr-3 h-8 w-8 text-primary" /> Share Your Suggestions
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">We Value Your Feedback!</CardTitle>
          <CardDescription>
            Have an idea to improve this website? Let us know! Your suggestions will be saved and reviewed by the administrators on the Admin Panel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="suggestion-text" className="block text-sm font-medium mb-1">
                Your Suggestion (10-5000 characters)
              </Label>
              <Textarea
                id="suggestion-text"
                value={suggestionText}
                onChange={(e) => {
                  setSuggestionText(e.target.value);
                  if (error) setError(null); 
                }}
                placeholder="Type your suggestion here..."
                rows={6}
                className="w-full"
                disabled={isSubmitting}
                maxLength={5000}
              />
              {error && <p className="text-sm text-destructive mt-1">{error}</p>}
              <p className="text-xs text-muted-foreground mt-1">{suggestionText.length}/5000 characters</p>
            </div>
            <Button type="submit" disabled={isSubmitting || suggestionText.trim().length < 10 || suggestionText.trim().length > 5000} className="w-full sm:w-auto">
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Submitting...' : 'Submit Suggestion'}
            </Button>
          </form>
        </CardContent>
      </Card>
       <Card className="mt-8">
        <CardHeader>
          <CardTitle className="font-headline text-xl">How Suggestions are Handled</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>When you submit a suggestion through this form:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Your suggestion text and user ID are sent to a secure backend flow.</li>
            <li>The flow saves your suggestion to our database.</li>
            <li>Administrators can view submitted suggestions on the Admin Panel.</li>
            <li>You will receive a confirmation message on this page if the submission is successful.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
