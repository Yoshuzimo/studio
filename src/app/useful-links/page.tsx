// src/app/useful-links/page.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Link as LinkIcon, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { QuestWikiPopover } from '@/components/shared/quest-wiki-popover';
import { cn } from '@/lib/utils';


interface UsefulLink {
  name: string;
  url: string;
  description: string;
}

const links: UsefulLink[] = [
  {
    name: 'Cannith Crafting',
    url: 'https://ccplanner.byethost14.com/?i=1',
    description: "A Webbased tool for Cannith Crafting",
  },
  {
    name: 'DDOBuilder',
    url: 'https://github.com/Maetrim/DDOBuilder',
    description: "A tool for planning your character's gear, sentient weapons, filigree, feats, ect. Please don't ask me how to work it, I'm still figureing it out, lol.",
  },
];

export default function UsefulLinksPage() {
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const router = useRouter();

  const [openInOverlay, setOpenInOverlay] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<UsefulLink | null>(null);

  useEffect(() => {
    if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router]);

  const handleLinkClick = (link: UsefulLink) => {
    if (openInOverlay) {
      setSelectedLink(link);
      setIsOverlayOpen(true);
    } else {
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
  };

  if (authIsLoading || (!currentUser && !authIsLoading)) {
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
        <p className="text-muted-foreground mt-2">Please log in to view useful links.</p>
        <Button onClick={() => router.push('/login')} className="mt-6">Log In</Button>
      </div>
    );
  }


  return (
    <div className="py-8 space-y-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-headline text-3xl font-bold flex items-center">
          <LinkIcon className="mr-3 h-8 w-8 text-primary" /> Useful Links
        </h1>
        <div className="flex items-center space-x-2">
            <Checkbox
              id="open-in-overlay"
              checked={openInOverlay}
              onCheckedChange={(checked) => setOpenInOverlay(!!checked)}
              disabled
            />
            <Label htmlFor="open-in-overlay" className="cursor-pointer">
              Open In This Window
            </Label>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Community Resources</CardTitle>
          <CardDescription>A collection of helpful tools and websites for DDO players.</CardDescription>
        </CardHeader>
        <CardContent>
          {links.length > 0 ? (
            <ul className="space-y-6">
              {links.map((link) => (
                <li key={link.name}>
                  <div
                    onClick={() => handleLinkClick(link)}
                    className="block p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleLinkClick(link)}
                    aria-label={`Open link for ${link.name}`}
                  >
                    <h3 className={cn(
                        "text-lg font-semibold text-destructive",
                        !openInOverlay && "group-hover:underline"
                      )}>
                        {link.name}
                      </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {link.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>No links available at the moment. Check back later!</p>
          )}
        </CardContent>
      </Card>
      
      {selectedLink && (
        <QuestWikiPopover
          isOpen={isOverlayOpen}
          onOpenChange={setIsOverlayOpen}
          questName={selectedLink.name}
          wikiUrl={selectedLink.url}
        />
      )}
    </div>
  );
}
