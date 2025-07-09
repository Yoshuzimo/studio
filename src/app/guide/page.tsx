
// src/app/guide/page.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Book, Users, Package, ListOrdered, BarChartHorizontalBig, Skull, ShieldCheck, LifeBuoy, AlertTriangle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function GuidePage() {
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const router = useRouter();

  if (authIsLoading) {
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
        <p className="text-muted-foreground mt-2">Please log in to view the user guide.</p>
        <Button onClick={() => router.push('/login')} className="mt-6">Log In</Button>
      </div>
    );
  }

  return (
    <div className="py-8 space-y-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-headline text-3xl font-bold flex items-center">
          <Book className="mr-3 h-8 w-8 text-primary" /> User Guide
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">How to Use the DDO Toolkit</CardTitle>
          <CardDescription>A step-by-step walkthrough of the main features available in the toolkit.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="characters">
              <AccordionTrigger className="text-lg"><Users className="mr-2 h-5 w-5 text-primary"/>Characters Page</AccordionTrigger>
              <AccordionContent className="space-y-2 pl-2">
                <p>This is your main dashboard where you manage all your DDO characters.</p>
                <ul className="list-disc list-inside space-y-1 pl-4 text-muted-foreground">
                  <li><strong>Add a Character:</strong> Click the "Add New Character" button to open a form. Enter your character's name and level. The icon can be added after creation by editing the character.</li>
                  <li><strong>View Trackers:</strong> Clicking on a character card will take you to their Favor Tracker page.</li>
                  <li><strong>Edit/Delete:</strong> Use the "Edit" and "Delete" buttons on each card to manage your characters.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="adventure-packs">
              <AccordionTrigger className="text-lg"><Package className="mr-2 h-5 w-5 text-primary"/>Adventure Packs Page</AccordionTrigger>
              <AccordionContent className="space-y-2 pl-2">
                <p>This page allows you to manage which adventure packs and expansions you own. This information is used to filter quests in the various tracker pages.</p>
                <ul className="list-disc list-inside space-y-1 pl-4 text-muted-foreground">
                  <li><strong>Marking Ownership:</strong> Simply check the box next to a pack you own. Changes are saved automatically to your account.</li>
                  <li><strong>"Free to Play" Pack:</strong> This is automatically marked as owned and cannot be changed, as it represents all free quests.</li>
                  <li><strong>CSV Upload:</strong> For bulk updates, you can upload a CSV file with pack names and an "Owned" column. This is useful for quickly importing your collection.</li>
                  <li><strong>How to Check Ownership:</strong> If you are not sure if you own a pack or expansion, open the DDO Store in-game and look for it. If it shows up in the store, you don't own it.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="favor-tracker">
              <AccordionTrigger className="text-lg"><ListOrdered className="mr-2 h-5 w-5 text-primary"/>Favor Tracker Page</AccordionTrigger>
              <AccordionContent className="space-y-2 pl-2">
                <p>This is a powerful tool to help you find the best quests to run for favor on a specific character.</p>
                <ul className="list-disc list-inside space-y-1 pl-4 text-muted-foreground">
                  <li><strong>Quest List:</strong> The table shows all quests your character can run for favor, based on their level and your owned adventure packs.</li>
                  <li><strong>Tracking Completions:</strong> Check the boxes (C/S, N, H, E) for the difficulties you've completed. Checking a higher difficulty automatically checks the lower ones.</li>
                  <li><strong>Favor & Score:</strong> The "Favor" column shows remaining favor for a quest. The "Score" column adjusts this favor based on quest length (customizable in Options) to help you find the most efficient quests.</li>
                  <li><strong>Options & Filters:</strong> Use the options at the top and in the settings menu (gear icon) to toggle completed quests, filter by pack ownership, show raids, and customize which columns are visible.</li>
                  <li><strong>CSV Upload/Download:</strong> You can download a backup of your completions or upload a CSV to update them in bulk.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="leveling-guide">
              <AccordionTrigger className="text-lg"><BarChartHorizontalBig className="mr-2 h-5 w-5 text-primary"/>Leveling Guide Page</AccordionTrigger>
              <AccordionContent className="space-y-2 pl-2">
                <p>This guide helps you find the quests that give the most experience for your character's current level.</p>
                 <ul className="list-disc list-inside space-y-1 pl-4 text-muted-foreground">
                  <li><strong>Experience Calculation:</strong> The table automatically calculates the experience for each difficulty (C/S, N, H, E) based on your character's level, including any over-level penalties.</li>
                  <li><strong>Max EXP & Score:</strong> "Max EXP" shows the highest possible experience you can get from any single difficulty. "Score" adjusts this value based on quest length to find efficient quests.</li>
                  <li><strong>Options & Filters:</strong> Use the options to filter by pack ownership, include/exclude raids, and customize the table columns.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="reaper-rewards">
              <AccordionTrigger className="text-lg"><Skull className="mr-2 h-5 w-5 text-primary"/>Reaper Rewards Page</AccordionTrigger>
              <AccordionContent className="space-y-2 pl-2">
                <p>This page estimates the Reaper Experience (RXP) you can earn from quests, helping you plan your reaper point farming.</p>
                 <ul className="list-disc list-inside space-y-1 pl-4 text-muted-foreground">
                  <li><strong>RXP Calculation:</strong> The table shows estimated RXP for 1 through 10 skulls, adjusted for quest level and length.</li>
                  <li><strong>Filtering:</strong> The list is automatically filtered to show only quests that are eligible for RXP based on your character's level.</li>
                  <li><strong>Options:</strong> Use the options to customize column visibility and filter by pack ownership or raids.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

             <AccordionItem value="useful-links">
              <AccordionTrigger className="text-lg"><LifeBuoy className="mr-2 h-5 w-5 text-primary"/>Other Pages</AccordionTrigger>
              <AccordionContent className="space-y-2 pl-2">
                 <ul className="list-disc list-inside space-y-1 pl-4 text-muted-foreground">
                  <li><strong>Useful Links:</strong> A curated list of helpful third-party DDO websites and tools.</li>
                  <li><strong>Suggestions:</strong> Have an idea for the toolkit? Submit it here for administrators to review.</li>
                  <li><strong>Messages:</strong> An inbox where you can receive replies to your suggestions from administrators.</li>
                 </ul>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
