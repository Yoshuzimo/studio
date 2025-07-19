
"use client";

import React, { useState, useTransition } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addReplyToSuggestion } from '@/ai/flows/add-reply-to-suggestion-flow';
import type { Suggestion, User as AppUser } from '@/types';
import { useAuth } from '@/context/auth-context';

interface ReplyToSuggestionFormProps {
  suggestion: Suggestion;
}

export function ReplyToSuggestionForm({ suggestion }: ReplyToSuggestionFormProps) {
  const [replyText, setReplyText] = useState('');
  const [isReplying, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { currentUser, userData } = useAuth();

  const handleReplySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!userData || !currentUser) {
      setError("Admin user not identified. Cannot send reply.");
      toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
      return;
    }

    if (replyText.trim().length === 0) {
      setError("Reply cannot be empty.");
      return;
    }
    if (replyText.trim().length > 5000) {
      setError("Reply cannot exceed 5000 characters.");
      return;
    }

    startTransition(async () => {
      try {
        const idToken = await currentUser.getIdToken();
        await addReplyToSuggestion({
            suggestionId: suggestion.id,
            replyText: replyText,
            senderId: currentUser.uid,
            senderName: userData.displayName || 'Admin',
        }, { headers: { Authorization: `Bearer ${idToken}` } });

        toast({
          title: "Reply Sent!",
          description: `Your reply to "${suggestion.title}" has been sent.`,
        });
        setReplyText('');
        // No need to refetch, onSnapshot will update the UI
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
        toast({
          title: "Reply Failed",
          description: `Could not send reply: ${errorMessage}`,
          variant: "destructive",
        });
        setError(`Reply failed: ${errorMessage}`);
        console.error("Reply submission error:", e);
      }
    });
  };

  if (suggestion.status === 'closed') {
    return <p className="text-xs text-muted-foreground italic mt-2">This suggestion is closed. Re-open it to reply.</p>
  }

  return (
    <form onSubmit={handleReplySubmit} className="mt-3 space-y-2">
      <div>
        <Label htmlFor={`reply-text-${suggestion.id}`} className="block text-xs font-medium mb-1 text-muted-foreground">
          Send a reply:
        </Label>
        <Textarea
          id={`reply-text-${suggestion.id}`}
          value={replyText}
          onChange={(e) => {
            setReplyText(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Type your reply here..."
          rows={3}
          className="w-full text-sm"
          disabled={isReplying || !userData}
          maxLength={5000}
        />
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
      <Button type="submit" disabled={isReplying || !userData || replyText.trim().length === 0 || replyText.trim().length > 5000} size="sm" variant="default">
        {isReplying ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-2 h-4 w-4" />
        )}
        {isReplying ? 'Sending...' : 'Send Reply'}
      </Button>
    </form>
  );
}

    