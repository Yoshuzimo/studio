
// src/app/messages/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail, Inbox, UserCircle, CalendarDays, Reply, AlertTriangle } from 'lucide-react'; // Added AlertTriangle
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import type { Message } from '@/types';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/auth-context'; // Added
import { Button } from '@/components/ui/button';

export default function MessagesPage() {
  const { currentUser, isLoading: authIsLoading } = useAuth(); // Use auth context
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  useEffect(() => {
    if (authIsLoading) return; // Wait for auth state

    if (currentUser) {
      const fetchMessages = async () => {
        setIsLoadingMessages(true);
        try {
          const messagesQuery = query(
            collection(db, 'messages'),
            where('receiverId', '==', currentUser.uid), // Use authenticated user's ID
            orderBy('timestamp', 'desc')
          );
          const querySnapshot = await getDocs(messagesQuery);
          const fetchedMessages: Message[] = querySnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              senderId: data.senderId,
              senderName: data.senderName,
              receiverId: data.receiverId,
              receiverName: data.receiverName,
              text: data.text,
              timestamp: data.timestamp as FirestoreTimestamp,
              isRead: data.isRead,
              relatedSuggestionId: data.relatedSuggestionId,
            } as Message;
          });
          setMessages(fetchedMessages);
        } catch (error) {
          console.error("Failed to fetch messages:", error);
        } finally {
          setIsLoadingMessages(false);
        }
      };
      fetchMessages();
    } else {
      // No user, clear messages and stop loading
      setMessages([]);
      setIsLoadingMessages(false);
    }
  }, [currentUser, authIsLoading]);

  if (authIsLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!currentUser) {
     return (
      <div className="container mx-auto py-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Please log in to view your messages.</p>
        <Button onClick={() => window.location.href = '/login'} className="mt-6">Log In</Button>
      </div>
    );
  }

  return (
    <div className="py-8 space-y-8"> {/* Removed container mx-auto */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-headline text-3xl font-bold flex items-center">
          <Mail className="mr-3 h-8 w-8 text-primary" /> Your Messages
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center">
            <Inbox className="mr-2 h-6 w-6 text-primary" /> Inbox
          </CardTitle>
          <CardDescription>Messages sent to you, including replies to your suggestions.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingMessages ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10">
              <img src="https://i.imgflip.com/2adszq.jpg" alt="Empty inbox placeholder" data-ai-hint="sad spongebob" className="mx-auto rounded-lg shadow-md max-w-xs" />
              <p className="text-xl text-muted-foreground mt-4">You have no messages.</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <ul className="space-y-4">
                {messages.map((message, index) => (
                  <li key={message.id}>
                    <Card className="shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-lg font-medium flex items-center">
                                <UserCircle className="mr-2 h-5 w-5 text-muted-foreground" />
                                From: {message.senderName}
                            </CardTitle>
                            {!message.isRead && <Badge variant="destructive">New</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center pt-1">
                            <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                            {message.timestamp ? format(message.timestamp.toDate(), 'MMM d, yyyy HH:mm') : 'No date'}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                        {message.relatedSuggestionId && (
                            <p className="text-xs text-muted-foreground mt-2 flex items-center">
                                <Reply className="mr-1.5 h-3.5 w-3.5"/> 
                                In reply to your suggestion.
                            </p>
                        )}
                      </CardContent>
                    </Card>
                    {index < messages.length - 1 && <Separator className="my-4 opacity-0" />}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
