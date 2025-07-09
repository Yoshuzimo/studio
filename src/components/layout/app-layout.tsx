
// src/components/layout/app-layout.tsx
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarTrigger,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
} from '@/components/ui/sidebar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { Users, Package, ShieldCheck, ScrollText, Sun, Moon, Link as LinkIcon, Lightbulb, Mail, LogOut, MailCheck, Loader2, UserCog, Book, ListOrdered, BarChartHorizontalBig, Skull } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTheme } from 'next-themes';
import * as React from 'react';
import { useAuth } from '@/context/auth-context';
import { useAppData } from '@/context/app-data-context';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from '@/lib/utils';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';


const navItemsBase = [
  { href: '/adventure-packs', label: 'Adventure Packs', icon: Package, protected: true },
  { href: '/messages', label: 'Messages', icon: Mail, protected: true },
  { href: '/account/change-email', label: 'Change Email', icon: UserCog, protected: true },
  { href: '/useful-links', label: 'Useful Links', icon: LinkIcon, protected: true },
  { href: '/guide', label: 'Guide', icon: Book, protected: true },
  { href: '/suggestions', label: 'Suggestions', icon: Lightbulb, protected: true },
];

const adminNavItem = { href: '/admin', label: 'Admin Panel', icon: ShieldCheck, adminOnly: true, protected: true };

function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) return <Button variant="ghost" size="icon" className="w-8 h-8" disabled><Sun className="h-4 w-4" /></Button>;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="w-8 h-8"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { currentUser, userData, logout, isLoading: authIsLoading, sendVerificationEmail } = useAuth();
  const { characters } = useAppData();
  const [isSendingVerification, setIsSendingVerification] = React.useState(false);

  const [isCharacterMenuOpen, setIsCharacterMenuOpen] = React.useState(false);

  const getVisibleNavItems = () => {
    let items = [...navItemsBase];
    if (currentUser && userData?.isAdmin) {
      items.push(adminNavItem);
    }
    return items.sort((a,b) => (a.href === '/admin' ? 1 : b.href === '/admin' ? -1 : 0));
  };

  const visibleNavItems = getVisibleNavItems();
  const sortedCharacters = React.useMemo(() => [...characters].sort((a, b) => a.name.localeCompare(b.name)), [characters]);

  if (authIsLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-background">
        {children}
      </div>
    );
  }

  const isPublicPage = ['/login', '/signup'].includes(pathname);
  if (isPublicPage) {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await logout();
  };

  const userDisplayName = userData?.displayName || currentUser?.email?.split('@')[0] || 'User';
  const userAvatarFallback = userDisplayName ? userDisplayName.charAt(0).toUpperCase() : 'U';

  const handleResendVerification = async () => {
    setIsSendingVerification(true);
    try {
      await sendVerificationEmail();
    } catch (error) {
    } finally {
      setIsSendingVerification(false);
    }
  };

  const isAccountPage = pathname.startsWith('/account');

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar variant="sidebar" collapsible="icon" className="border-r">
        <SidebarHeader className="p-4 flex flex-col items-center group-data-[collapsible=icon]:items-center">
            <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
                <ScrollText className="h-8 w-8 text-primary" />
                <span className="font-headline text-xl font-semibold group-data-[collapsible=icon]:hidden">DDO Toolkit</span>
            </Link>
        </SidebarHeader>

        <SidebarContent className="p-2">
            <SidebarMenu>
                 <SidebarMenuItem>
                    <DropdownMenu open={isCharacterMenuOpen} onOpenChange={setIsCharacterMenuOpen}>
                      <DropdownMenuTrigger asChild>
                        <div onMouseEnter={() => setIsCharacterMenuOpen(true)} onMouseLeave={() => setIsCharacterMenuOpen(false)}>
                           <Link href="/" passHref>
                             <SidebarMenuButton
                               asChild={false}
                               variant="ghost"
                               className="w-full justify-start"
                               isActive={pathname === '/' || pathname.startsWith('/favor-tracker') || pathname.startsWith('/leveling-guide') || pathname.startsWith('/reaper-rewards')}
                               tooltip="Characters"
                             >
                                <Users className="h-5 w-5" />
                                <span>Characters</span>
                             </SidebarMenuButton>
                           </Link>
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuContent side="right" align="start" sideOffset={8} onMouseEnter={() => setIsCharacterMenuOpen(true)} onMouseLeave={() => setIsCharacterMenuOpen(false)}>
                           {sortedCharacters.map((char) => (
                             <DropdownMenuSub key={char.id}>
                               <DropdownMenuSubTrigger>
                                 <Avatar className="mr-2 h-5 w-5">
                                   <AvatarImage src={char.iconUrl || undefined} alt={char.name} />
                                   <AvatarFallback>{char.name.charAt(0)}</AvatarFallback>
                                 </Avatar>
                                 <span>{char.name}</span>
                               </DropdownMenuSubTrigger>
                               <DropdownMenuPortal>
                                 <DropdownMenuSubContent sideOffset={8}>
                                   <Link href={`/favor-tracker/${char.id}`} passHref>
                                     <DropdownMenuItem asChild><Link href={`/favor-tracker/${char.id}`} className="w-full h-full flex items-center"><ListOrdered className="mr-2 h-4 w-4"/>Favor Tracker</Link></DropdownMenuItem>
                                   </Link>
                                    <Link href={`/leveling-guide/${char.id}`} passHref>
                                     <DropdownMenuItem asChild><Link href={`/leveling-guide/${char.id}`} className="w-full h-full flex items-center"><BarChartHorizontalBig className="mr-2 h-4 w-4"/>Leveling Guide</Link></DropdownMenuItem>
                                   </Link>
                                   <Link href={`/reaper-rewards/${char.id}`} passHref>
                                     <DropdownMenuItem asChild><Link href={`/reaper-rewards/${char.id}`} className="w-full h-full flex items-center"><Skull className="mr-2 h-4 w-4"/>Reaper Rewards</Link></DropdownMenuItem>
                                   </Link>
                                 </DropdownMenuSubContent>
                               </DropdownMenuPortal>
                             </DropdownMenuSub>
                           ))}
                        </DropdownMenuContent>
                      </DropdownMenuPortal>
                    </DropdownMenu>
                 </SidebarMenuItem>

                 {visibleNavItems.map((item) => (
                      <SidebarMenuItem key={item.label}>
                        <Link href={item.href}>
                          <SidebarMenuButton
                            isActive={
                                pathname === item.href ||
                                (item.href === "/account/change-email" && isAccountPage)
                            }
                            tooltip={{ children: item.label, className: "group-data-[collapsible=icon]:visible" }}
                            className="justify-start"
                          >
                            <item.icon className="h-5 w-5" />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                    ))}
            </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="p-4 flex flex-col items-center gap-2 group-data-[collapsible=icon]:items-center">
            <div className="group-data-[collapsible=icon]:hidden flex items-center gap-2">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={currentUser?.photoURL || "https://placehold.co/40x40.png"} alt="User Avatar" data-ai-hint="user avatar" />
                    <AvatarFallback>{userAvatarFallback}</AvatarFallback>
                </Avatar>
                <span className="text-sm truncate max-w-[100px]">{userDisplayName}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:aspect-square group-data-[collapsible=icon]:p-2">
                <LogOut className="h-4 w-4 group-data-[collapsible=icon]:m-0" />
                <span className="ml-2 group-data-[collapsible=icon]:hidden">Logout</span>
            </Button>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex flex-col z-[15]">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 lg:h-[60px] lg:px-6">
            <SidebarTrigger className="md:hidden" />
            <div className="flex-1">
                <h1 className="font-headline text-lg font-semibold">
                {visibleNavItems.find(item => item.href === "/account/change-email" && isAccountPage ? true : pathname === item.href || pathname.startsWith(item.href + '/'))?.label || 'Characters'}
                </h1>
            </div>
            <div className="flex items-center gap-2">
                <ThemeToggle />
            </div>
        </header>

        {currentUser && !currentUser.emailVerified && !isPublicPage && (
          <Alert variant="default" className="m-4 border-yellow-500 bg-yellow-50 text-yellow-700 dark:border-yellow-400 dark:bg-yellow-900/30 dark:text-yellow-300 rounded-md shadow-md">
            <MailCheck className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <AlertTitle className="font-semibold text-yellow-800 dark:text-yellow-200">Verify Your Email Address</AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-300">
              Your email address is not verified. Please check your inbox for a verification link.
              <Button
                variant="link"
                className="p-0 h-auto ml-2 text-yellow-700 dark:text-yellow-300 hover:underline font-semibold disabled:opacity-70"
                onClick={handleResendVerification}
                disabled={isSendingVerification || authIsLoading}
              >
                {isSendingVerification && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Resend Verification Email
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <main className="flex-1 p-4 sm:p-6 overflow-auto bg-transparent">
          {children}
        </main>
        <Toaster />
      </SidebarInset>
    </SidebarProvider>
  );
}
