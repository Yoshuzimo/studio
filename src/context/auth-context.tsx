
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
} from 'firebase/auth';
import { auth, db, EmailAuthProvider, reauthenticateWithCredential } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, type Timestamp as FirestoreTimestampType, type FieldValue } from 'firebase/firestore'; // Removed writeBatch for now
import type { User as AppUser, PublicUserProfile, PublicUserProfileFirebaseData } from '@/types';
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
  updateUserDisplayName: (newDisplayName: string) => Promise<boolean>;
  getAllUsers: () => Promise<AppUser[]>;
  updateUserAdminStatus: (targetUserId: string, isAdmin: boolean) => Promise<void>;
  updateUserOwnerStatus: (targetUserId: string, isOwner: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isFirestoreTimestamp(obj: any): obj is FirestoreTimestampType {
    return obj && typeof obj.toDate === 'function' && typeof obj.seconds === 'number' && typeof obj.nanoseconds === 'number';
}

function deepCompareAppUserData(obj1: AppUser | null, obj2: AppUser | null): boolean {
    if (obj1 === obj2) return true;
    if (!obj1 || !obj2) return false;

    const keys1 = Object.keys(obj1) as Array<keyof AppUser>;
    const keys2 = Object.keys(obj2) as Array<keyof AppUser>;

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
        if (!obj2.hasOwnProperty(key)) return false;
        const val1 = obj1[key];
        const val2 = obj2[key];

        if (key === 'createdAt') {
            if (val1 === val2) continue; 
            if (isFirestoreTimestamp(val1) && isFirestoreTimestamp(val2)) {
                if (!val1.isEqual(val2)) return false;
            } else if (val1 !== val2) { 
                return false;
            }
        } else if (val1 !== val2) {
            return false;
        }
    }
    return true;
}


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
  const [userDataState, setUserDataStateInternal] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const lastUserDataRef = useRef<AppUser | null>(null);

  const setUserData = useCallback((newUserData: AppUser | null) => {
    if (!deepCompareAppUserData(lastUserDataRef.current, newUserData)) {
      console.log('[AuthContext] setUserData: Data changed, updating state. Prev Snapshot:', lastUserDataRef.current, 'New Snapshot:', newUserData);
      setUserDataStateInternal(newUserData);
      lastUserDataRef.current = newUserData ? JSON.parse(JSON.stringify(newUserData, (key, value) => {
        if (value && typeof value === 'object' && value.hasOwnProperty('seconds') && value.hasOwnProperty('nanoseconds') && typeof (value as any).toDate === 'function') {
            return { _firestoreTimestamp: true, seconds: value.seconds, nanoseconds: value.nanoseconds };
        }
        return value;
      })) : null;
    } else {
      console.log('[AuthContext] setUserData: New data is same as previous, skipping state update.');
    }
  }, []);


  useEffect(() => {
    setIsLoading(true);
    console.log('[AuthContext] onAuthStateChanged listener setup effect running.');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[AuthContext] onAuthStateChanged triggered. User:', user?.uid || null);
      if (user) {
        try { await user.reload(); console.log('[AuthContext] User reloaded successfully.'); } 
        catch (reloadError: any) { 
            console.error('[AuthContext] User reload failed:', reloadError);
            if (['auth/user-token-expired', 'auth/user-disabled', 'auth/invalid-user-token', 'auth/network-request-failed'].includes(reloadError.code)) {
                try { await firebaseSignOut(auth); console.log('[AuthContext] Signed out user due to reload error.'); } catch (signOutError) { console.error('[AuthContext] Error signing out after reload failure:', signOutError); }
            }
        }
        
        const freshUser = auth.currentUser;
        if (!freshUser) {
            console.log('[AuthContext] No Firebase user after reload. Clearing states.');
            setCurrentUser(null);
            setUserData(null);
        } else {
            console.log('[AuthContext] setCurrentUser called for:', freshUser.uid);
            setCurrentUser(freshUser);
            const userDocRef = doc(db, 'users', freshUser.uid);
            try {
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const dbData = userDocSnap.data();
                     console.log('[AuthContext] Fetched Firestore data for user:', freshUser.uid, dbData);
                    const appUserData: AppUser = {
                        id: freshUser.uid, 
                        email: dbData.email || freshUser.email, 
                        displayName: dbData.displayName || (freshUser.uid + DISPLAY_NAME_PLACEHOLDER_SUFFIX),
                        isAdmin: dbData.isAdmin || false, 
                        isOwner: dbData.isOwner || false, 
                        isCreator: dbData.isCreator || false,
                        createdAt: dbData.createdAt as FirestoreTimestampType,
                        emailVerified: freshUser.emailVerified, 
                        iconUrl: dbData.iconUrl === undefined ? null : dbData.iconUrl,
                    };
                    setUserData(appUserData);
                } else {
                    console.log('[AuthContext] User document does not exist for UID:', freshUser.uid, 'Attempting to create one.');
                    const placeholderDisplayName = freshUser.uid + DISPLAY_NAME_PLACEHOLDER_SUFFIX;
                    
                    const mainUserDocData: Omit<AppUser, 'createdAt'> & { createdAt: FieldValue } = { 
                        id: freshUser.uid, email: freshUser.email, displayName: placeholderDisplayName,
                        isAdmin: false, isOwner: false, isCreator: false, 
                        emailVerified: freshUser.emailVerified, 
                        iconUrl: null, 
                        createdAt: serverTimestamp(),
                    };
                    const publicProfileData: PublicUserProfileFirebaseData = {
                        displayName: placeholderDisplayName, 
                        iconUrl: null, 
                        updatedAt: serverTimestamp(),
                    };

                    try {
                        // Using individual sets instead of batch for creation to ensure data is available immediately
                        await setDoc(doc(db, 'users', freshUser.uid), mainUserDocData);
                        await setDoc(doc(db, 'publicProfiles', freshUser.uid), publicProfileData);

                        console.log('[AuthContext] Created Firestore user and publicProfile documents for UID:', freshUser.uid);
                        const newUserDocSnap = await getDoc(userDocRef); 
                        if (newUserDocSnap.exists()) {
                            const newDbData = newUserDocSnap.data();
                            setUserData({
                                id: freshUser.uid, email: newDbData.email, displayName: newDbData.displayName,
                                isAdmin: newDbData.isAdmin || false, 
                                isOwner: newDbData.isOwner || false, 
                                isCreator: newDbData.isCreator || false,
                                createdAt: newDbData.createdAt as FirestoreTimestampType,
                                emailVerified: newDbData.emailVerified || false, 
                                iconUrl: newDbData.iconUrl === undefined ? null : newDbData.iconUrl,
                            });
                        } else {
                             console.warn('[AuthContext] Firestore user doc still not found after attempting create.');
                             setUserData(null); 
                        }
                    } catch (dbError) {
                        console.error('[AuthContext] Error creating Firestore user/publicProfile documents:', dbError);
                        setUserData(null);  
                    }
                }
            } catch (firestoreError) {
                console.error('[AuthContext] Error fetching Firestore user document:', firestoreError);
                setUserData({ 
                    id: freshUser.uid, email: freshUser.email, 
                    displayName: freshUser.displayName || freshUser.uid + DISPLAY_NAME_PLACEHOLDER_SUFFIX, 
                    isAdmin: false, isOwner: false, isCreator: false, 
                    emailVerified: freshUser.emailVerified, 
                    iconUrl: null, 
                    createdAt: undefined, 
                });
                toast({ title: "Profile Sync Issue", description: "Could not load full profile details.", variant: "default" });
            }
        }
      } else {
        console.log('[AuthContext] No Firebase user from onAuthStateChanged. States cleared.');
        setCurrentUser(null);
        setUserData(null);
      }
      setIsLoading(false);
      console.log('[AuthContext] onAuthStateChanged: setIsLoading(false) at the very end.');
    });
    return () => {
      console.log('[AuthContext] Unsubscribing from onAuthStateChanged.');
      unsubscribe();
    }
  }, [setUserData, toast]);

  const login = useCallback(async (identifier: string, password_login: string) => {
    let emailToLogin = identifier;
    console.log('[AuthContext] login attempt for identifier:', identifier);
    try {
      if (!EMAIL_REGEX.test(identifier)) {
        console.log('[AuthContext] Identifier is not email, querying publicProfiles for display name:', identifier);
        const publicProfilesRef = collection(db, 'publicProfiles');
        const q = query(publicProfilesRef, where("displayName", "==", identifier));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          console.warn('[AuthContext] Display name not found in publicProfiles:', identifier);
          throw new Error("User not found with that display name.");
        }
        if (querySnapshot.size > 1) {
          console.warn('[AuthContext] Multiple users found for display name in publicProfiles:', identifier);
          throw new Error("Multiple users found with that display name. Please use email to log in.");
        }
        const publicProfileDoc = querySnapshot.docs[0];
        const userDocRef = doc(db, 'users', publicProfileDoc.id);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists() || !userDocSnap.data()?.email) {
          console.error('[AuthContext] publicProfile found, but main user doc or email is missing for ID:', publicProfileDoc.id);
          throw new Error("User account issue. Please contact support.");
        }
        emailToLogin = userDocSnap.data()!.email;
        console.log('[AuthContext] Found email for display name:', emailToLogin);
      }
      await signInWithEmailAndPassword(auth, emailToLogin, password_login);
      toast({ title: "Login Successful", description: "Welcome back!" });
      router.push('/');
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      toast({ title: "Login Failed", description: (error as Error).message, variant: "destructive" });
      throw error;
    }
  }, [router, toast]);

  const signup = useCallback(async (email_signup: string, password_signup: string) => {
    console.log('[AuthContext] signup attempt for email:', email_signup);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email_signup, password_signup);
      const user = userCredential.user;
      console.log('[AuthContext] Firebase user created:', user.uid);
      
      const placeholderDisplayName = user.uid + DISPLAY_NAME_PLACEHOLDER_SUFFIX;
      
      const mainUserDocData: Omit<AppUser, 'createdAt'> & { createdAt: FieldValue } = { 
        id: user.uid, email: user.email, displayName: placeholderDisplayName,
        isAdmin: false, isOwner: false, isCreator: false, 
        emailVerified: user.emailVerified || false, 
        iconUrl: null,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'users', user.uid), mainUserDocData);

      const publicProfileData: PublicUserProfileFirebaseData = {
        displayName: placeholderDisplayName, 
        iconUrl: null, 
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'publicProfiles', user.uid), publicProfileData);
      
      console.log('[AuthContext] Firestore user and publicProfile documents created for UID:', user.uid);
      
      await firebaseSendEmailVerification(user);
      console.log('[AuthContext] Verification email sent to:', user.email);

      toast({ title: "Signup Successful!", description: "Welcome! A verification email has been sent." });
    } catch (error) {
      console.error('[AuthContext] Signup error:', error);
      toast({ title: "Signup Failed", description: (error as Error).message, variant: "destructive" });
      throw error;
    }
  }, [toast]);
  
  const logout = useCallback(async () => {
    console.log('[AuthContext] logout called.');
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
      console.log('[AuthContext] Sending verification email to:', userToVerify.email);
      try {
        await firebaseSendEmailVerification(userToVerify);
        toast({ title: "Verification Email Sent", description: "Please check your inbox." });
      } catch (error) {
        console.error('[AuthContext] Error sending verification email:', error);
        toast({ title: "Error Sending Email", description: (error as Error).message, variant: "destructive" });
        throw error;
      }
    } else {
        console.warn('[AuthContext] sendVerificationEmail called but no user is logged in.');
        toast({ title: "Not Logged In", description: "Cannot send verification email.", variant: "destructive" });
        throw new Error("User is not logged in.");
    }
  }, [toast]);
  
  const sendPasswordReset = useCallback(async (email: string) => {
    console.log('[AuthContext] Password reset attempt for:', email);
    try {
      await firebaseSendPasswordResetEmail(auth, email);
      toast({ title: "Password Reset Email Sent", description: "If an account exists for this email, a password reset link was sent." });
    } catch (error) {
      console.error('[AuthContext] Password reset error:', error);
      toast({ title: "Request Processed", description: "If an account exists for this email, a password reset link has been sent.", variant: "default" });
    }
  }, [toast]);

  const reauthenticateWithPassword = useCallback(async (password: string) => {
    const userToReauth = auth.currentUser;
    if (!userToReauth || !userToReauth.email) {
      console.error('[AuthContext] reauthenticateWithPassword: User not found or email missing.');
      toast({ title: "Re-authentication Error", description: "User not found or email missing. Please log in again.", variant: "destructive" });
      throw new Error("User not found or email is missing for re-authentication.");
    }
    console.log('[AuthContext] Re-authentication attempt for:', userToReauth.email);
    try {
      const credential = EmailAuthProvider.credential(userToReauth.email, password);
      await reauthenticateWithCredential(userToReauth, credential);
      toast({ title: "Re-authentication Successful" });
    } catch (error) {
      console.error('[AuthContext] Re-authentication error:', error);
      toast({ title: "Re-authentication Failed", description: (error as Error).message, variant: "destructive" });
      throw error;
    }
  }, [toast]);

  const updateUserEmail = useCallback(async (newEmail: string) => {
    const userToUpdate = auth.currentUser;
    if (!userToUpdate) {
      console.error('[AuthContext] updateUserEmail: User not logged in.');
      toast({ title: "Update Error", description: "You must be logged in to update your email.", variant: "destructive" });
      throw new Error("User not logged in.");
    }
    console.log('[AuthContext] Attempting to update email for', userToUpdate.uid, 'to', newEmail);
    try {
      await firebaseUpdateEmail(userToUpdate, newEmail); 
      
      const userDocRef = doc(db, 'users', userToUpdate.uid);
      await updateDoc(userDocRef, { email: newEmail, emailVerified: false });
      
      await userToUpdate.reload(); 
      await sendVerificationEmail(); 
      toast({ title: "Email Update Initiated", description: `Your email has been changed to ${newEmail}. Please check your new email address for a verification link.` });
      
      const updatedUserDocSnap = await getDoc(userDocRef);
      if (updatedUserDocSnap.exists()) {
        const dbData = updatedUserDocSnap.data();
        const updatedAppUserData: AppUser = {
          id: userToUpdate.uid,
          email: dbData.email || newEmail,
          displayName: dbData.displayName || (userToUpdate.uid + DISPLAY_NAME_PLACEHOLDER_SUFFIX),
          isAdmin: dbData.isAdmin || false,
          isOwner: dbData.isOwner || false,
          isCreator: dbData.isCreator || false,
          createdAt: dbData.createdAt as FirestoreTimestampType,
          emailVerified: userToUpdate.emailVerified, 
          iconUrl: dbData.iconUrl === undefined ? null : dbData.iconUrl,
        };
        setUserData(updatedAppUserData);
      }
    } catch (error) {
      console.error('[AuthContext] Email update error:', error);
      toast({ title: "Email Update Failed", description: (error as Error).message, variant: "destructive" });
      throw error;
    }
  }, [toast, sendVerificationEmail, setUserData]);

  const updateUserDisplayName = useCallback(async (newDisplayName: string): Promise<boolean> => {
    const userToUpdate = auth.currentUser;
    console.log('[AuthContext] updateUserDisplayName: Attempting for user:', userToUpdate?.uid, 'to:', newDisplayName);

    if (!userToUpdate) {
      toast({ title: "Update Error", description: "User not logged in.", variant: "destructive" });
      return false;
    }
     if (newDisplayName.trim().length < 3 || newDisplayName.trim().length > 30) {
      toast({ title: "Invalid Display Name", description: "Must be 3-30 characters.", variant: "destructive" });
      return false;
    }

    let currentIconUrlFromDB: string | null = null;
    const userDocRef = doc(db, 'users', userToUpdate.uid);
    try {
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            currentIconUrlFromDB = userDocSnap.data().iconUrl || null;
        } else {
            console.warn("[AuthContext] updateUserDisplayName: User document not found in Firestore for iconUrl pre-fetch. Using null.");
        }
    } catch (e) {
        console.error("[AuthContext] Failed to fetch current user data for iconUrl, proceeding with null:", e);
    }

    try {
      console.log('[AuthContext] updateUserDisplayName: Checking uniqueness for:', newDisplayName, 'in publicProfiles. Current user ID:', userToUpdate.uid);
      const displayNameQuery = query(collection(db, "publicProfiles"), where("displayName", "==", newDisplayName));
      const displayNameSnapshot = await getDocs(displayNameQuery);
      
      if (!displayNameSnapshot.empty) {
        const isSelf = displayNameSnapshot.docs.some(docSnap => docSnap.id === userToUpdate.uid);
        if (!isSelf) {
          toast({ title: "Display Name Taken", description: "This display name is already in use. Please choose another.", variant: "destructive" });
          return false;
        }
      }
      console.log('[AuthContext] updateUserDisplayName: Display name unique or belongs to current user. Proceeding with operations.');

      // Operation 1: Update /users/{uid} document
      const userDocUpdatePayload = { displayName: newDisplayName };
      console.log('[AuthContext] updateUserDisplayName: Updating Firestore document /users/', userToUpdate.uid, 'with payload:', JSON.stringify(userDocUpdatePayload, null, 2));
      await updateDoc(userDocRef, userDocUpdatePayload);
      console.log('[AuthContext] updateUserDisplayName: Firestore document /users/ update SUCCEEDED.');

      // Operation 2: Update /publicProfiles/{uid} document
      const publicProfileDocRef = doc(db, 'publicProfiles', userToUpdate.uid);
      const publicProfileUpdatePayload: PublicUserProfileFirebaseData = {
        displayName: newDisplayName,
        iconUrl: currentIconUrlFromDB, 
        updatedAt: serverTimestamp()
      };
      console.log('[AuthContext] updateUserDisplayName: Setting/Updating Firestore document /publicProfiles/', userToUpdate.uid, 'with payload:', JSON.stringify(publicProfileUpdatePayload, null, 2));
      await setDoc(publicProfileDocRef, publicProfileUpdatePayload, { merge: true });
      console.log('[AuthContext] updateUserDisplayName: Firestore document /publicProfiles/ update SUCCEEDED.');
      
      await updateProfile(userToUpdate, { displayName: newDisplayName });
      console.log('[AuthContext] updateUserDisplayName: Firebase Auth profile updated.');
      
      const updatedUserDocSnap = await getDoc(userDocRef); 
      if (updatedUserDocSnap.exists()) {
          const dbData = updatedUserDocSnap.data();
          const updatedAppUserData: AppUser = {
              id: userToUpdate.uid,
              email: dbData.email,
              displayName: newDisplayName, 
              isAdmin: dbData.isAdmin || false,
              isOwner: dbData.isOwner || false,
              isCreator: dbData.isCreator || false,
              createdAt: dbData.createdAt as FirestoreTimestampType,
              emailVerified: userToUpdate.emailVerified,
              iconUrl: dbData.iconUrl === undefined ? null : dbData.iconUrl,
          };
          setUserData(updatedAppUserData);
      }

      toast({ title: "Display Name Updated!", description: `Your display name is now ${newDisplayName}.` });
      return true;
    } catch (error: any) {
      console.error("[AuthContext] updateUserDisplayName: Error during overall operation:", error);
      toast({ title: "Display Name Update Failed", description: error.message || "An unknown error occurred.", variant: "destructive" });
      return false; 
    }
  }, [toast, setUserData]);

  const getAllUsers = useCallback(async (): Promise<AppUser[]> => {
    console.log('[AuthContext] getAllUsers called.');
    try {
      const usersCollectionRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollectionRef);
      const allUsers = usersSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          email: data.email,
          displayName: data.displayName,
          isAdmin: data.isAdmin || false,
          isOwner: data.isOwner || false,
          isCreator: data.isCreator || false,
          createdAt: data.createdAt as FirestoreTimestampType,
          emailVerified: data.emailVerified || false,
          iconUrl: data.iconUrl === undefined ? null : data.iconUrl,
        } as AppUser;
      });
      console.log('[AuthContext] Fetched all users:', allUsers.length);
      return allUsers;
    } catch (error) {
      console.error('[AuthContext] Error fetching all users:', error);
      toast({ title: "Error Fetching Users", description: (error as Error).message, variant: "destructive" });
      return [];
    }
  }, [toast]);

 const updateUserAdminStatus = useCallback(async (targetUserId: string, makeAdmin: boolean): Promise<void> => {
    const actingUser = auth.currentUser; 
    const actingUserDataSnapshot = lastUserDataRef.current;

    console.log(`[AuthContext] updateUserAdminStatus: Target UID: ${targetUserId}, Make Admin: ${makeAdmin}, Acting UID: ${actingUser?.uid}`);

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
      targetUserDataBeforeChange = { 
        id: targetUserSnap.id, 
        email: targetDbData.email,
        displayName: targetDbData.displayName,
        isAdmin: targetDbData.isAdmin || false,
        isOwner: targetDbData.isOwner || false,
        isCreator: targetDbData.isCreator || false,
        emailVerified: targetDbData.emailVerified || false,
        iconUrl: targetDbData.iconUrl === undefined ? null : targetDbData.iconUrl, 
        createdAt: targetDbData.createdAt as FirestoreTimestampType,
       };
      console.log('[AuthContext] Target user data before change:', targetUserDataBeforeChange);
      
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
        console.log('[AuthContext] Also removing Owner status as Admin is being removed for non-Creator Owner.');
        updatePayload.isOwner = false; 
      }
      await updateDoc(targetUserDocRef, updatePayload);
      console.log('[AuthContext] Firestore update for admin status successful.');
      
      const targetUserSnapAfter = await getDoc(targetUserDocRef);
      const targetUserDataAfterChange = targetUserSnapAfter.exists() ? { 
        id: targetUserSnapAfter.id, 
        email: targetUserSnapAfter.data()?.email,
        displayName: targetUserSnapAfter.data()?.displayName,
        isAdmin: targetUserSnapAfter.data()?.isAdmin || false,
        isOwner: targetUserSnapAfter.data()?.isOwner || false,
        isCreator: targetUserSnapAfter.data()?.isCreator || false,
        emailVerified: targetUserSnapAfter.data()?.emailVerified || false,
        iconUrl: targetUserSnapAfter.data()?.iconUrl === undefined ? null : targetUserSnapAfter.data().iconUrl,
        createdAt: targetUserSnapAfter.data()?.createdAt as FirestoreTimestampType,
      } as AppUser : null;
      console.log('[AuthContext] Target user data after change:', targetUserDataAfterChange);
      
      await updateDoc(logDocRef, { status: "successful", newRoleApplied: getUserTierString(targetUserDataAfterChange), timestampFinalized: serverTimestamp() as FieldValue });
      toast({ title: "Admin Status Updated Successfully" });

      if (targetUserId === actingUser.uid && targetUserDataAfterChange) {
        console.log('[AuthContext] Current user roles changed, updating local userData.');
        setUserData(targetUserDataAfterChange); 
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('[AuthContext] Error updating admin status:', error);
      await updateDoc(logDocRef, { status: "failed", errorDetails: errorMessage, timestampFinalized: serverTimestamp() as FieldValue }).catch(logError => console.error("Failed to update failure log:", logError));
      toast({ title: "Admin Status Update Failed", description: errorMessage, variant: "destructive" });
      throw error;
    }
  }, [toast, setUserData]);

  const updateUserOwnerStatus = useCallback(async (targetUserId: string, makeOwner: boolean): Promise<void> => {
    const actingUser = auth.currentUser;
    const actingUserDataSnapshot = lastUserDataRef.current; 

    console.log(`[AuthContext] updateUserOwnerStatus: Target UID: ${targetUserId}, Make Owner: ${makeOwner}, Acting UID: ${actingUser?.uid}`);

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
      targetUserDataBeforeChange = { 
        id: targetUserSnap.id, 
        email: targetUserSnap.data()?.email,
        displayName: targetUserSnap.data()?.displayName,
        isAdmin: targetUserSnap.data()?.isAdmin || false,
        isOwner: targetUserSnap.data()?.isOwner || false,
        isCreator: targetUserSnap.data()?.isCreator || false,
        emailVerified: targetUserSnap.data()?.emailVerified || false,
        iconUrl: targetUserSnap.data()?.iconUrl === undefined ? null : targetUserSnap.data().iconUrl,
        createdAt: targetUserSnap.data()?.createdAt as FirestoreTimestampType,
       };
      console.log('[AuthContext] Target user data before change (owner):', targetUserDataBeforeChange);

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
        console.log('[AuthContext] Making user Admin because they are being made Owner.');
      } else if (!makeOwner && targetUserDataBeforeChange.isOwner && !targetUserDataBeforeChange.isCreator) {
        updatePayload.isAdmin = false;
        console.log('[AuthContext] Removing Admin status as Owner is being removed for non-Creator.');
      } else if (!makeOwner && targetUserDataBeforeChange.isCreator) {
        updatePayload.isAdmin = true;
        console.log('[AuthContext] Creator is losing Owner status but remains Admin.');
      }
        
      await updateDoc(targetUserDocRef, updatePayload);
      console.log('[AuthContext] Firestore update for owner status successful.');
      
      const targetUserSnapAfter = await getDoc(targetUserDocRef);
      const targetUserDataAfterChange = targetUserSnapAfter.exists() ? { 
        id: targetUserSnapAfter.id, 
        email: targetUserSnapAfter.data()?.email,
        displayName: targetUserSnapAfter.data()?.displayName,
        isAdmin: targetUserSnapAfter.data()?.isAdmin || false,
        isOwner: targetUserSnapAfter.data()?.isOwner || false,
        isCreator: targetUserSnapAfter.data()?.isCreator || false,
        emailVerified: targetUserSnapAfter.data()?.emailVerified || false,
        iconUrl: targetUserSnapAfter.data()?.iconUrl === undefined ? null : targetUserSnapAfter.data().iconUrl,
        createdAt: targetUserSnapAfter.data()?.createdAt as FirestoreTimestampType,
      } as AppUser : null;
      console.log('[AuthContext] Target user data after change (owner):', targetUserDataAfterChange);

      await updateDoc(logDocRef, { status: "successful", newRoleApplied: getUserTierString(targetUserDataAfterChange), timestampFinalized: serverTimestamp() as FieldValue });
      toast({ title: "Owner Status Updated Successfully" });

      if (targetUserId === actingUser.uid && targetUserDataAfterChange) {
        console.log('[AuthContext] Current user roles changed, updating local userData (owner).');
        setUserData(targetUserDataAfterChange); 
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('[AuthContext] Error updating owner status:', error);
      await updateDoc(logDocRef, { status: "failed", errorDetails: errorMessage, timestampFinalized: serverTimestamp() as FieldValue }).catch(logError => console.error("Failed to update failure log:", logError));
      toast({ title: "Owner Status Update Failed", description: errorMessage, variant: "destructive" });
      throw error;
    }
  }, [toast, setUserData]);


  return (
    <AuthContext.Provider value={{
      currentUser,
      userData: userDataState,
      isLoading,
      login,
      signup,
      logout,
      sendVerificationEmail,
      sendPasswordReset,
      reauthenticateWithPassword,
      updateUserEmail,
      updateUserDisplayName,
      getAllUsers,
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

    