// src/context/auth-context.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  type User as FirebaseUser,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification as firebaseSendEmailVerification,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  updateEmail as firebaseUpdateEmail,
  updateProfile,
  onIdTokenChanged, // Import onIdTokenChanged
} from 'firebase/auth';
import { auth, db, EmailAuthProvider, reauthenticateWithCredential } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, type Timestamp as FirestoreTimestampType, type FieldValue } from 'firebase/firestore'; // Removed writeBatch for now
import type { User as AppUser, PublicUserProfile, PublicUserProfileFirebaseData, Character } from '@/types';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export const DISPLAY_NAME_PLACEHOLDER_SUFFIX = "_NEEDS_SETUP";

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: AppUser | null;
  isLoading: boolean;
  login: (identifier: string, password_login: string) => Promise<void>;
  signup: (email_signup: string, password_signup: string) => Promise<void>;
  logout: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  reauthenticateWithPassword: (password: string) => Promise<void>;
  updateUserEmail: (newEmail: string) => Promise<void>;
  updateUserDisplayName: (newDisplayName: string, newIconUrl?: string | null) => Promise<boolean>;
  updateUserAdminStatus: (targetUserId: string, isAdmin: boolean) => Promise<void>;
  updateUserOwnerStatus: (targetUserId: string, isOwner: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getPermissionLevel = (user: AppUser | null): number => {
  if (!user) return -1;
  if (user.isCreator) return 3;
  if (user.isOwner) return 2;
  if (user.isAdmin) return 1;
  return 0;
};

const getUserTierString = (user: AppUser | null): string => {
  if (!user) return "(No User)";
  if (user.isCreator) return "(Creator)";
  if (user.isOwner) return "(Owner)";
  if (user.isAdmin) return "(Admin)";
  return "(User)";
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const fetchAndSetUserData = useCallback(async (user: FirebaseUser) => {
    const userDocRef = doc(db, 'users', user.uid);
    try {
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const dbData = userDocSnap.data();
        const appUserData: AppUser = {
          id: user.uid, email: dbData.email || user.email, displayName: dbData.displayName || (user.uid + DISPLAY_NAME_PLACEHOLDER_SUFFIX),
          isAdmin: dbData.isAdmin || false, isOwner: dbData.isOwner || false, isCreator: dbData.isCreator || false,
          createdAt: dbData.createdAt as FirestoreTimestampType, emailVerified: user.emailVerified, iconUrl: dbData.iconUrl ?? null,
        } as AppUser;
        setUserData(appUserData);
      } else {
        console.log('[AuthContext] User document does not exist for UID:', user.uid, 'Attempting to create one.');
        const placeholderDisplayName = user.uid + DISPLAY_NAME_PLACEHOLDER_SUFFIX;
        const mainUserDocData: Omit<AppUser, 'createdAt' | 'iconUrl' | 'preferences'> & { createdAt: FieldValue, iconUrl: null, preferences: {} } = {
          id: user.uid, email: user.email, displayName: placeholderDisplayName,
          isAdmin: false, isOwner: false, isCreator: false, emailVerified: user.emailVerified, 
          accountId: '', level: 0, name: '', userId: '', preferences: {},
          createdAt: serverTimestamp(), iconUrl: null,
        };
        const publicProfileData: PublicUserProfileFirebaseData = { displayName: placeholderDisplayName, iconUrl: null, updatedAt: serverTimestamp() };
        await setDoc(doc(db, 'users', user.uid), mainUserDocData);
        await setDoc(doc(db, 'publicProfiles', user.uid), publicProfileData);
        const newUserDocSnap = await getDoc(userDocRef);
        if (newUserDocSnap.exists()) setUserData({ ...newUserDocSnap.data(), id: user.uid } as AppUser);
      }
    } catch (firestoreError) {
      console.error('[AuthContext] Error fetching/creating Firestore user document:', firestoreError);
      setUserData(null);
      toast({ title: "Profile Sync Issue", description: "Could not load full profile details.", variant: "default" });
    }
  }, [toast]);
  
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        if (!userData || user.uid !== userData.id) {
           await fetchAndSetUserData(user);
        }
      } else {
        if (currentUser) {
            await fetch('/api/auth/session', { method: 'DELETE' });
        }
        setCurrentUser(null);
        setUserData(null);
      }
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [fetchAndSetUserData, userData, currentUser]);

  const login = useCallback(async (identifier: string, password_login: string) => {
    let emailToLogin = identifier;
    try {
      if (!EMAIL_REGEX.test(identifier)) {
        const publicProfilesRef = collection(db, 'publicProfiles');
        const q = query(publicProfilesRef, where("displayName", "==", identifier));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          throw new Error("User not found with that display name.");
        }
        if (querySnapshot.size > 1) {
          throw new Error("Multiple users found with that display name. Please use email to log in.");
        }
        const publicProfileDoc = querySnapshot.docs[0];
        const userDocRef = doc(db, 'users', publicProfileDoc.id);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists() || !userDocSnap.data()?.email) {
          throw new Error("User account issue. Please contact support.");
        }
        emailToLogin = userDocSnap.data()!.email;
      }
      const userCredential = await signInWithEmailAndPassword(auth, emailToLogin, password_login);
      const idToken = await userCredential.user.getIdToken(true);
      await fetch('/api/auth/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }),
      });
      toast({ title: "Login Successful", description: "Welcome back!" });
      router.push('/');
    } catch (error: any) {
      console.error('[AuthContext] Login error:', error);
      let title = "Login Failed";
      let description = "An unknown error occurred. Please try again.";

      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/invalid-email':
          description = "No account found with that email or display name.";
          break;
        case 'auth/wrong-password':
          description = "Incorrect password. Please try again.";
          break;
        case 'auth/too-many-requests':
          description = "Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.";
          break;
        default:
          description = error.message;
          break;
      }
      toast({ title, description, variant: "destructive" });
      throw error;
    }
  }, [router, toast]);

  const signup = useCallback(async (email_signup: string, password_signup: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email_signup, password_signup);
      const user = userCredential.user;
      
      const placeholderDisplayName = user.uid + DISPLAY_NAME_PLACEHOLDER_SUFFIX;
      
      const mainUserDocData: Omit<AppUser, 'createdAt' | 'iconUrl' | 'preferences'> & { createdAt: FieldValue, iconUrl: null, preferences: {} } = { 
        id: user.uid, email: user.email, displayName: placeholderDisplayName,
        isAdmin: false, isOwner: false, isCreator: false, 
        emailVerified: user.emailVerified || false,
        accountId: '', level: 0, name: '', userId: '', preferences: {},
        createdAt: serverTimestamp(),
        iconUrl: null,
      };
      await setDoc(doc(db, 'users', user.uid), mainUserDocData);

      const publicProfileData: PublicUserProfileFirebaseData = {
        displayName: placeholderDisplayName, 
        iconUrl: null, 
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'publicProfiles', user.uid), publicProfileData);
      
      await firebaseSendEmailVerification(user);
      
      const idToken = await user.getIdToken(true);
      await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });

      toast({ title: "Signup Successful!", description: "Welcome! A verification email has been sent." });
    } catch (error: any) {
      console.error('[AuthContext] Signup error:', error);
      let errorMessage = "An unknown error occurred.";
      if (error.code === 'auth/email-already-in-use') {
          errorMessage = "This email is already registered. Please log in or use a different email.";
      } else if (error instanceof Error) {
          errorMessage = error.message;
      }
      toast({ title: "Signup Failed", description: errorMessage, variant: "destructive" });
      throw error;
    }
  }, [toast]);
  
  const logout = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push('/login'); 
    } catch (error) {
      console.error('[AuthContext] Logout error:', error);
      toast({ title: "Logout Failed", description: (error as Error).message, variant: "destructive" });
    }
  }, [router, toast]);

  const sendVerificationEmail = useCallback(async () => {
    const userToVerify = auth.currentUser;
    if (userToVerify) {
      try {
        await firebaseSendEmailVerification(userToVerify);
        toast({ title: "Verification Email Sent", description: "Please check your inbox." });
      } catch (error) {
        console.error('[AuthContext] Error sending verification email:', error);
        toast({ title: "Error Sending Email", description: (error as Error).message, variant: "destructive" });
        throw error;
      }
    } else {
        toast({ title: "Not Logged In", description: "Cannot send verification email.", variant: "destructive" });
        throw new Error("User is not logged in.");
    }
  }, [toast]);
  
  const sendPasswordReset = useCallback(async (email: string) => {
    try {
      await firebaseSendPasswordResetEmail(auth, email);
      toast({ title: "Password Reset Email Sent", description: "If an account exists for this email, a password reset link was sent." });
    } catch (error) {
      toast({ title: "Request Processed", description: "If an account exists for this email, a password reset link has been sent.", variant: "default" });
    }
  }, [toast]);

  const reauthenticateWithPassword = useCallback(async (password: string) => {
    const userToReauth = auth.currentUser;
    if (!userToReauth || !userToReauth.email) {
      toast({ title: "Re-authentication Error", description: "User not found or email missing. Please log in again.", variant: "destructive" });
      throw new Error("User not found or email is missing for re-authentication.");
    }
    try {
      const credential = EmailAuthProvider.credential(userToReauth.email, password);
      await reauthenticateWithCredential(userToReauth, credential);
      toast({ title: "Re-authentication Successful" });
    } catch (error) {
      toast({ title: "Re-authentication Failed", description: (error as Error).message, variant: "destructive" });
      throw error;
    }
  }, [toast]);

  const updateUserEmail = useCallback(async (newEmail: string) => {
    const userToUpdate = auth.currentUser;
    if (!userToUpdate) {
      toast({ title: "Update Error", description: "You must be logged in to update your email.", variant: "destructive" });
      throw new Error("User not logged in.");
    }
    try {
      await firebaseUpdateEmail(userToUpdate, newEmail); 
      
      const userDocRef = doc(db, 'users', userToUpdate.uid);
      await updateDoc(userDocRef, { email: newEmail, emailVerified: false });
      
      await userToUpdate.reload(); 
      await sendVerificationEmail(); 
      toast({ title: "Email Update Initiated", description: `Your email has been changed to ${newEmail}. Please check your new email address for a verification link.` });
      
      setUserData(prev => prev ? ({...prev, email: newEmail, emailVerified: false }) : null);

    } catch (error) {
      console.error('[AuthContext] Email update error:', error);
      toast({ title: "Email Update Failed", description: (error as Error).message, variant: "destructive" });
      throw error;
    }
  }, [toast, sendVerificationEmail]);

  const updateUserDisplayName = useCallback(async (newDisplayName: string, newIconUrl?: string | null): Promise<boolean> => {
    const userToUpdate = auth.currentUser;
    if (!userToUpdate) {
      toast({ title: "Update Error", description: "User not logged in.", variant: "destructive" });
      return false;
    }
     if (newDisplayName.trim().length < 3 || newDisplayName.trim().length > 30) {
      toast({ title: "Invalid Display Name", description: "Must be 3-30 characters.", variant: "destructive" });
      return false;
    }

    try {
      const displayNameQuery = query(collection(db, "publicProfiles"), where("displayName", "==", newDisplayName));
      const displayNameSnapshot = await getDocs(displayNameQuery);
      
      if (!displayNameSnapshot.empty) {
        const isSelf = displayNameSnapshot.docs.some(docSnap => docSnap.id === userToUpdate.uid);
        if (!isSelf) {
          toast({ title: "Display Name Taken", description: "This display name is already in use. Please choose another.", variant: "destructive" });
          return false;
        }
      }
      
      await updateProfile(userToUpdate, { displayName: newDisplayName, photoURL: newIconUrl === undefined ? userToUpdate.photoURL : newIconUrl });
      
      const userDocUpdatePayload: Partial<AppUser> = { displayName: newDisplayName };
      const publicProfileUpdatePayload: Partial<PublicUserProfileFirebaseData> = { displayName: newDisplayName, updatedAt: serverTimestamp() };
      
      if (newIconUrl !== undefined) {
          userDocUpdatePayload.iconUrl = newIconUrl;
          publicProfileUpdatePayload.iconUrl = newIconUrl;
      }
      
      await updateDoc(doc(db, 'users', userToUpdate.uid), userDocUpdatePayload);
      await setDoc(doc(db, 'publicProfiles', userToUpdate.uid), publicProfileUpdatePayload, { merge: true });
      
      setUserData(prev => prev ? ({ ...prev, ...userDocUpdatePayload }) : null);

      toast({ title: "Profile Updated!", description: `Your profile has been updated.` });
      return true;
    } catch (error: any) {
      console.error("[AuthContext] updateUserDisplayName: Error during overall operation:", error);
      toast({ title: "Profile Update Failed", description: error.message || "An unknown error occurred.", variant: "destructive" });
      return false; 
    }
  }, [toast]);

 const updateUserAdminStatus = useCallback(async (targetUserId: string, makeAdmin: boolean): Promise<void> => {
    const actingUser = auth.currentUser; 
    const actingUserDataSnapshot = userData;

    if (!actingUserDataSnapshot || !actingUser) {
      toast({ title: "Authentication Error", description: "Current user data unavailable for permission change.", variant: "destructive" });
      throw new Error("Current user data not available to perform this action.");
    }
    const targetUserDocRef = doc(db, 'users', targetUserId);
    const logCollectionRef = collection(db, 'Logs', 'roleChanges', 'entries');
    const logDocRef = doc(logCollectionRef);
    let targetUserDataBeforeChange: AppUser | null = null;

    try {
      const targetUserSnap = await getDoc(targetUserDocRef);
      if (!targetUserSnap.exists()) throw new Error("Target user document not found.");
      const targetDbData = targetUserSnap.data();
      targetUserDataBeforeChange = { ...targetDbData, id: targetUserSnap.id } as AppUser;
      
      const currentUserLevel = getPermissionLevel(actingUserDataSnapshot);
      const targetUserLvl = getPermissionLevel(targetUserDataBeforeChange);
      
      if (targetUserId === actingUser.uid && !makeAdmin && !actingUserDataSnapshot.isCreator) {
        throw new Error("You cannot remove your own Administrator role unless you are a Creator.");
      }
      if (targetUserDataBeforeChange.isCreator && !actingUserDataSnapshot.isCreator && targetUserDataBeforeChange.isAdmin !== makeAdmin) {
        throw new Error("Only a Creator can modify another Creator's Administrator status.");
      }
      if (!actingUserDataSnapshot.isCreator && currentUserLevel <= targetUserLvl && targetUserDataBeforeChange.isAdmin !== makeAdmin && !(currentUserLevel === targetUserLvl && !makeAdmin)) {
          throw new Error("You do not have sufficient permissions to change this user's Administrator status.");
      }
      if (makeAdmin && currentUserLevel < 1 ) { 
        throw new Error("You are not authorized to grant Administrator status.");
      }

      await setDoc(logDocRef, {
        changerId: actingUser.uid, changerDisplayName: actingUserDataSnapshot.displayName || actingUser.email, changerTier: getUserTierString(actingUserDataSnapshot),
        targetUserId, targetUserDisplayName: targetUserDataBeforeChange.displayName || targetUserDataBeforeChange.email, targetUserOriginalRole: getUserTierString(targetUserDataBeforeChange),
        requestedChange: { action: 'updateAdmin', makeAdmin }, status: "requested", timestampRequested: serverTimestamp() as FieldValue,
      });

      const updatePayload: Partial<AppUser> = { isAdmin: makeAdmin };
      if (!makeAdmin && targetUserDataBeforeChange.isOwner && !targetUserDataBeforeChange.isCreator) {
        updatePayload.isOwner = false; 
      }
      await updateDoc(targetUserDocRef, updatePayload);
      
      const targetUserSnapAfter = await getDoc(targetUserDocRef);
      const targetUserDataAfterChange = targetUserSnapAfter.exists() ? { ...targetUserSnapAfter.data(), id: targetUserSnapAfter.id } as AppUser : null;
      
      await updateDoc(logDocRef, { status: "successful", newRoleApplied: getUserTierString(targetUserDataAfterChange), timestampFinalized: serverTimestamp() as FieldValue });
      toast({ title: "Admin Status Updated Successfully" });

      if (targetUserId === actingUser.uid && targetUserDataAfterChange) {
        setUserData(targetUserDataAfterChange); 
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      await updateDoc(logDocRef, { status: "failed", errorDetails: errorMessage, timestampFinalized: serverTimestamp() as FieldValue }).catch(logError => console.error("Failed to update failure log:", logError));
      toast({ title: "Admin Status Update Failed", description: errorMessage, variant: "destructive" });
      throw error;
    }
  }, [toast, userData]);

  const updateUserOwnerStatus = useCallback(async (targetUserId: string, makeOwner: boolean): Promise<void> => {
    const actingUser = auth.currentUser;
    const actingUserDataSnapshot = userData; 

    if (!actingUserDataSnapshot || !actingUser) {
      toast({ title: "Authentication Error", description: "Current user data unavailable for permission change.", variant: "destructive" });
      throw new Error("Current user data not available to perform this action.");
    }
    const targetUserDocRef = doc(db, 'users', targetUserId);
    const logCollectionRef = collection(db, 'Logs', 'roleChanges', 'entries');
    const logDocRef = doc(logCollectionRef);
    let targetUserDataBeforeChange: AppUser | null = null;
    
    try {
      const targetUserSnap = await getDoc(targetUserDocRef);
      if (!targetUserSnap.exists()) throw new Error("Target user document not found.");
      targetUserDataBeforeChange = { ...targetUserSnap.data(), id: targetUserSnap.id } as AppUser;

      const currentUserLevel = getPermissionLevel(actingUserDataSnapshot);

      if (targetUserId === actingUser.uid && !makeOwner && !actingUserDataSnapshot.isCreator) {
        throw new Error("You cannot remove your own Owner status unless you are a Creator.");
      }
      if (targetUserDataBeforeChange.isCreator && !actingUserDataSnapshot.isCreator && targetUserDataBeforeChange.isOwner !== makeOwner) {
        throw new Error("Only a Creator can modify another Creator's Owner status.");
      }
      if (makeOwner && currentUserLevel < 2) { 
        throw new Error("You are not authorized to grant Owner status.");
      }
      if (!makeOwner && currentUserLevel < 3 && actingUserDataSnapshot.id !== targetUserId) { 
         throw new Error("You are not authorized to remove Owner status from other users.");
      }
      
      await setDoc(logDocRef, {
        changerId: actingUser.uid, changerDisplayName: actingUserDataSnapshot.displayName || actingUser.email, changerTier: getUserTierString(actingUserDataSnapshot),
        targetUserId, targetUserDisplayName: targetUserDataBeforeChange.displayName || targetUserDataBeforeChange.email, targetUserOriginalRole: getUserTierString(targetUserDataBeforeChange),
        requestedChange: { action: 'updateOwner', makeOwner }, status: "requested", timestampRequested: serverTimestamp() as FieldValue,
      });
      
      const updatePayload: Partial<AppUser> = { isOwner: makeOwner };
      if (makeOwner) { 
        updatePayload.isAdmin = true;
      } else if (!makeOwner && targetUserDataBeforeChange.isOwner && !targetUserDataBeforeChange.isCreator) {
        updatePayload.isAdmin = false;
      } else if (!makeOwner && targetUserDataBeforeChange.isCreator) {
        updatePayload.isAdmin = true;
      }
        
      await updateDoc(targetUserDocRef, updatePayload);
      
      const targetUserSnapAfter = await getDoc(targetUserDocRef);
      const targetUserDataAfterChange = targetUserSnapAfter.exists() ? { ...targetUserSnapAfter.data(), id: targetUserSnapAfter.id } as AppUser : null;

      await updateDoc(logDocRef, { status: "successful", newRoleApplied: getUserTierString(targetUserDataAfterChange), timestampFinalized: serverTimestamp() as FieldValue });
      toast({ title: "Owner Status Updated Successfully" });

      if (targetUserId === actingUser.uid && targetUserDataAfterChange) {
        setUserData(targetUserDataAfterChange); 
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      await updateDoc(logDocRef, { status: "failed", errorDetails: errorMessage, timestampFinalized: serverTimestamp() as FieldValue }).catch(logError => console.error("Failed to update failure log:", logError));
      toast({ title: "Owner Status Update Failed", description: errorMessage, variant: "destructive" });
      throw error;
    }
  }, [toast, userData]);


  return (
    <AuthContext.Provider value={{
      currentUser,
      userData: userData,
      isLoading,
      login,
      signup,
      logout,
      sendVerificationEmail,
      sendPasswordReset,
      reauthenticateWithPassword,
      updateUserEmail,
      updateUserDisplayName,
      updateUserAdminStatus,
      updateUserOwnerStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
