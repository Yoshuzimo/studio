
// src/app/messages/page.tsx
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MessagesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/suggestions');
  }, [router]);

  return null; // This component will not render anything
}
