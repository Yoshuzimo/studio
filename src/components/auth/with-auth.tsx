
// src/components/auth/with-auth.tsx
"use client";

import React, { useEffect, type ComponentType } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const publicPaths = ['/login', '/signup'];

export function withAuth<P extends object>(WrappedComponent: ComponentType<P>) {
  const ComponentWithAuth = (props: P) => {
    const { currentUser, isLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
      if (!isLoading && !currentUser && !publicPaths.includes(pathname)) {
        router.replace('/login');
      }
      if (!isLoading && currentUser && publicPaths.includes(pathname)) {
        router.replace('/'); // Redirect to home if logged in and on a public page
      }
    }, [currentUser, isLoading, router, pathname]);

    if (isLoading || (!currentUser && !publicPaths.includes(pathname))) {
      return (
        <div className="flex justify-center items-center h-screen bg-background">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
    }
    
    // If on a public path and not logged in, or logged in and on an app path
    return <WrappedComponent {...props} />;
  };
  ComponentWithAuth.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return ComponentWithAuth;
}


// Component to be used in layout to handle initial route guarding logic
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return; // Wait until auth state is resolved

    const isPublicPath = publicPaths.includes(pathname);

    if (!currentUser && !isPublicPath) {
      // Not logged in and trying to access a protected page
      router.replace(`/login?redirect=${pathname}`);
    } else if (currentUser && isPublicPath) {
      // Logged in and trying to access login/signup
      router.replace('/');
    }
  }, [currentUser, isLoading, router, pathname]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  // If user is loaded and trying to access a protected route without being logged in,
  // this will briefly show before redirect. The main protection is in the individual pages.
  // Or, if conditions are met, show children.
  if (!currentUser && !publicPaths.includes(pathname)) {
     // Still loading or will be redirected by individual page HOC
    return (
      <div className="flex justify-center items-center h-screen bg-background">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-2">Redirecting...</p>
        </div>
    );
  }


  return <>{children}</>;
}
