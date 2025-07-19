
"use client";

import React, { useState, useTransition } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { replyToSuggestion, type ReplyToSuggestionInput } from '@/ai/flows/reply-to-suggestion-flow';
import type { Suggestion, User as AppUser } from '@/types';
import { useAuth } from '@/context/auth-context';

interface ReplyToSuggestionFormProps {
  suggestion: Suggestion;
  adminUser: AppUser | null;
}

export function ReplyToSuggestionForm({ suggestion, adminUser }: ReplyToSuggestionFormProps) {
  const [replyText, setReplyText] = useState('');
  const [isReplying, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { currentUser } = useAuth(); // Get the Firebase user object

  const handleReplySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!adminUser || !currentUser) { // Check for both admin data and Firebase user
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
        const input: ReplyToSuggestionInput = {
          suggestionId: suggestion.id,
          replyText: replyText,
          suggesterId: suggestion.suggesterId,
          suggesterName: suggestion.suggesterName,
          adminId: adminUser.id,
          adminName: adminUser.displayName || adminUser.email || "Admin",
        };

        const idToken = await currentUser.getIdToken();
        const result = await replyToSuggestion(input, { headers: { Authorization: `Bearer ${idToken}` } } as any);
        
        toast({
          title: "Reply Sent!",
          description: result.message,
        });
        setReplyText('');
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

  return (
    <form onSubmit={handleReplySubmit} className="mt-3 space-y-2 border-t border-border pt-3">
      <div>
        <Label htmlFor={`reply-text-${suggestion.id}`} className="block text-xs font-medium mb-1 text-muted-foreground">
          Send a reply to {suggestion.suggesterName || 'the suggester'}:
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
          disabled={isReplying || !adminUser}
          maxLength={5000}
        />
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
      <Button type="submit" disabled={isReplying || !adminUser || replyText.trim().length === 0 || replyText.trim().length > 5000} size="sm" variant="outline">
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
