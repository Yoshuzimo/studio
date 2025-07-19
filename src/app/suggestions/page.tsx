
// src/app/suggestions/page.tsx
"use client";

import React, { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input'; // Import Input
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lightbulb, Send, Loader2, AlertTriangle, MessageSquarePlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { submitSuggestion, type SubmitSuggestionInput } from '@/ai/flows/submit-suggestion-flow';
import { useAuth } from '@/context/auth-context';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Suggestion, SuggestionConversationItem } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { addReplyToSuggestion } from '@/ai/flows/add-reply-to-suggestion-flow';

function SuggestionItem({ suggestion, onReply }: { suggestion: Suggestion; onReply: (suggestionId: string, replyText: string) => Promise<void>; }) {
  const { currentUser } = useAuth();
  const [replyText, setReplyText] = useState('');
  const [isReplying, startTransition] = useTransition();

  const handleReply = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!replyText.trim()) return;
      startTransition(async () => {
          await onReply(suggestion.id, replyText);
          setReplyText('');
      });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="font-headline">{suggestion.title}</CardTitle>
          <div
            className={cn(
              "px-2 py-1 text-xs font-semibold rounded-full",
              suggestion.status === 'open' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            )}
          >
            {suggestion.status}
          </div>
        </div>
        <CardDescription>
          Submitted {formatDistanceToNow(suggestion.createdAt.toDate(), { addSuffix: true })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48 mb-4 border rounded-md p-2">
          <div className="space-y-4">
            {suggestion.conversation.map((item, index) => (
              <div key={index} className={cn("flex flex-col", item.senderId === currentUser?.uid ? "items-end" : "items-start")}>
                <div className={cn(
                  "p-2 rounded-lg max-w-xs md:max-w-md",
                  item.senderId === currentUser?.uid ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <p className="text-xs font-semibold mb-1">{item.senderName}</p>
                  <p className="text-sm whitespace-pre-wrap">{item.text}</p>
                  <p className="text-xs text-right mt-1 opacity-70">
                    {formatDistanceToNow((item.timestamp as any).toDate(), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        {suggestion.status === 'open' && (
          <form onSubmit={handleReply} className="space-y-2">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your reply..."
              rows={2}
              disabled={isReplying}
            />
            <Button type="submit" size="sm" disabled={isReplying || !replyText.trim()}>
              {isReplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send Reply
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}


export default function SuggestionsPage() {
  const { currentUser, userData, isLoading: authIsLoading } = useAuth();
  const [title, setTitle] = useState('');
  const [suggestionText, setSuggestionText] = useState('');
  const [isSubmitting, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const [mySuggestions, setMySuggestions] = useState<Suggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);

  const fetchSuggestions = React.useCallback(async () => {
    if (!currentUser) return;
    setIsLoadingSuggestions(true);
    try {
      const q = query(collection(db, 'suggestions'), where('suggesterId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const suggestions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Suggestion));
      setMySuggestions(suggestions);
    } catch (e) {
      console.error("Failed to fetch suggestions", e);
      toast({ title: "Error", description: "Could not fetch your suggestions.", variant: "destructive" });
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [currentUser, toast]);

  React.useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleAddReply = async (suggestionId: string, replyText: string) => {
    if (!currentUser || !userData) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    try {
      const idToken = await currentUser.getIdToken();
      await addReplyToSuggestion({
        suggestionId,
        replyText,
        senderId: currentUser.uid,
        senderName: userData.displayName || "User",
      }, { headers: { Authorization: `Bearer ${idToken}` } });
      toast({ title: "Reply Sent", description: "Your reply has been added." });
      fetchSuggestions(); // Re-fetch to show the new reply
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      toast({ title: "Reply Failed", description: errorMessage, variant: "destructive" });
    }
  };


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!currentUser || !userData) {
      toast({ title: "Not Authenticated", description: "You must be logged in to submit a suggestion.", variant: "destructive" });
      setError("Please log in to submit a suggestion.");
      return;
    }

    if (title.trim().length < 5 || title.trim().length > 100) {
      setError("Title must be between 5 and 100 characters.");
      return;
    }

    if (suggestionText.trim().length < 10 || suggestionText.trim().length > 5000) {
      setError("Suggestion must be between 10 and 5000 characters.");
      return;
    }

    startTransition(async () => {
      try {
        const input: SubmitSuggestionInput = {
          title,
          suggestionText,
          suggesterId: currentUser.uid,
          suggesterName: userData.displayName || currentUser.email || "Anonymous User"
        };
        
        const idToken = await currentUser.getIdToken();
        await submitSuggestion(input, { headers: { Authorization: `Bearer ${idToken}` } } as any);

        toast({
          title: "Suggestion Submitted!",
          description: "Thank you! Your suggestion has been received.",
        });
        setTitle('');
        setSuggestionText('');
        fetchSuggestions(); // Refresh the list
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
        toast({
          title: "Submission Failed",
          description: `Could not submit your suggestion: ${errorMessage}`,
          variant: "destructive",
        });
        setError(`Submission failed: ${errorMessage}`);
        console.error("Suggestion submission error:", e);
      }
    });
  };

  if (authIsLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!currentUser) {
    return (
      <div className="container mx-auto py-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Please log in to submit or view suggestions.</p>
        <Button onClick={() => window.location.href = '/login'} className="mt-6">Log In</Button>
      </div>
    );
  }


  return (
    <div className="py-8 space-y-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-headline text-3xl font-bold flex items-center">
          <Lightbulb className="mr-3 h-8 w-8 text-primary" /> Suggestions & Feedback
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><MessageSquarePlus className="mr-2 h-5 w-5"/>Submit a New Suggestion</CardTitle>
          <CardDescription>
            Have an idea to improve this website? Let us know! Your suggestion will create a new ticket that admins can reply to.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="suggestion-title">Title</Label>
              <Input
                id="suggestion-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="A brief summary of your idea"
                maxLength={100}
                disabled={isSubmitting}
              />
            </div>
            <div>
              <Label htmlFor="suggestion-text">
                Your Suggestion (10-5000 characters)
              </Label>
              <Textarea
                id="suggestion-text"
                value={suggestionText}
                onChange={(e) => {
                  setSuggestionText(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Describe your suggestion in detail..."
                rows={6}
                className="w-full"
                disabled={isSubmitting}
                maxLength={5000}
              />
              {error && <p className="text-sm text-destructive mt-1">{error}</p>}
              <p className="text-xs text-muted-foreground mt-1">{suggestionText.length}/5000</p>
            </div>
            <Button type="submit" disabled={isSubmitting || !title.trim() || !suggestionText.trim()} className="w-full sm:w-auto">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Submitting...' : 'Submit Suggestion'}
            </Button>
          </form>
        </CardContent>
      </Card>
       
      <Separator />

      <div>
        <h2 className="font-headline text-2xl font-bold mb-4">My Suggestions</h2>
        {isLoadingSuggestions ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : mySuggestions.length === 0 ? (
          <p className="text-muted-foreground">You haven't submitted any suggestions yet.</p>
        ) : (
          <div className="space-y-4">
            {mySuggestions.map(suggestion => (
              <SuggestionItem key={suggestion.id} suggestion={suggestion} onReply={handleAddReply} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

