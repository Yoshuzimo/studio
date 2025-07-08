// Cache-busting comment to force rebuild of dependents: V2
import type { Timestamp as FirestoreTimestampType, FieldValue } from 'firebase/firestore';

export interface User {
  id: string;
  email: string | null;
  displayName?: string | null;
  isAdmin?: boolean;
  isOwner?: boolean;
  isCreator?: boolean;
  createdAt?: FirestoreTimestampType | FieldValue;
  emailVerified: boolean;
  iconUrl: string | null;
}

export interface PublicUserProfile {
  displayName: string | null;
  iconUrl: string | null;
  updatedAt: FirestoreTimestampType | FieldValue;
}

export interface PublicUserProfileFirebaseData {
  displayName: string | null;
  iconUrl: string | null;
  updatedAt: FieldValue;
}

export interface Character {
  id:string;
  userId: string;
  name: string;
  level: number;
  iconUrl: string | null;
}

export interface AdventurePack {
  id: string;
  name: string;
  pointsCost?: number | null;
  totalFavor?: number | null;
}

export interface Quest {
  id: string;
  name: string;
  level: number; // Represents Heroic Base Level
  adventurePackName?: string | null;
  location?: string | null;
  questGiver?: string | null;
  
  // Heroic Tier EXP
  casualExp?: number | null;
  normalExp?: number | null;
  hardExp?: number | null;
  eliteExp?: number | null;
  
  duration?: string | null;
  baseFavor?: number | null; // Universal base favor for the quest concept
  patron?: string | null;
  
  // Heroic Tier Availability
  casualNotAvailable?: boolean;
  normalNotAvailable?: boolean;
  hardNotAvailable?: boolean;
  eliteNotAvailable?: boolean;

  // Epic Tier Details
  epicBaseLevel?: number | null;
  epicCasualExp?: number | null;
  epicNormalExp?: number | null;
  epicHardExp?: number | null;
  epicEliteExp?: number | null;
  epicCasualNotAvailable?: boolean;
  epicNormalNotAvailable?: boolean;
  epicHardNotAvailable?: boolean;
  epicEliteNotAvailable?: boolean;

  // New fields for wiki and maps
  wikiUrl?: string | null;
  mapUrls?: string[];
}

export interface UserQuestCompletionData {
  questName?: string; 
  casualCompleted?: boolean;
  normalCompleted?: boolean;
  hardCompleted?: boolean;
  eliteCompleted?: boolean;
  lastUpdatedAt?: FirestoreTimestampType | FieldValue;
}


export interface CSVQuest {
  id?: string;
  name: string;
  location?: string;
  level: string; // Heroic base level
  questGiver?: string;
  
  // Heroic EXP
  casualSoloExp?: string; // Assumed to be Heroic Casual
  normalExp?: string;     // Assumed to be Heroic Normal
  hardExp?: string;       // Assumed to be Heroic Hard
  eliteExp?: string;      // Assumed to be Heroic Elite
  
  duration?: string;
  baseFavor?: string;
  adventurePack?: string;
  patron?: string;

  // Heroic Availability
  casualNotAvailable?: string;
  normalNotAvailable?: string;
  hardNotAvailable?: string;
  eliteNotAvailable?: string;

  // Epic Tier - New CSV Columns Needed
  epicBaseLevel?: string;
  epicCasualExp?: string;
  epicNormalExp?: string;
  epicHardExp?: string;
  epicEliteExp?: string;
  epicCasualNotAvailable?: string;
  epicNormalNotAvailable?: string;
  epicHardNotAvailable?: string;
  epicEliteNotAvailable?: string;

  // New fields for wiki and maps
  wikiUrl?: string;
  mapUrl1?: string;
  mapUrl2?: string;
  mapUrl3?: string;
  mapUrl4?: string;
  mapUrl5?: string;
  mapUrl6?: string;
  mapUrl7?: string;
}

export interface CSVAdventurePack {
  id?: string;
  name: string;
  pointsCost?: string;
  totalFavor?: string;
}

export interface Suggestion {
  id: string;
  text: string;
  createdAt: FirestoreTimestampType;
  suggesterId: string;
  suggesterName: string;
}

export interface SuggestionFirebaseData {
  text: string;
  createdAt: FieldValue; // For writing
  suggesterId: string;
  suggesterName: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  text: string;
  timestamp: FirestoreTimestampType;
  isRead: boolean;
  relatedSuggestionId?: string;
}

export interface MessageFirebaseData {
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  text: string;
  timestamp: FieldValue; // For writing
  isRead: boolean;
  relatedSuggestionId?: string;
}

export interface PermissionSettings {
    isAdmin: boolean;
    isOwner: boolean;
    isCreator?: boolean; // Optional for updates, but part of User type
}

export interface RoleChangeLog {
  id: string;
  changerId: string;
  changerDisplayName: string;
  changerTier: string; // e.g., "Admin", "Owner", "Creator"
  targetUserId: string;
  targetUserDisplayName: string;
  targetUserOriginalRole: string;
  requestedChange: {
    action: 'updateAdmin' | 'updateOwner';
    makeAdmin?: boolean;
    makeOwner?: boolean;
  };
  newRoleApplied?: string; // New role after change
  status: "requested" | "successful" | "failed";
  timestampRequested: FirestoreTimestampType;
  timestampFinalized?: FirestoreTimestampType;
  errorDetails?: string;
}

export interface RoleChangeLogFirebaseData {
  changerId: string;
  changerDisplayName: string;
  changerTier: string;
  targetUserId: string;
  targetUserDisplayName: string;
  targetUserOriginalRole: string;
  requestedChange: {
    action: 'updateAdmin' | 'updateOwner';
    makeAdmin?: boolean;
    makeOwner?: boolean;
  };
  newRoleApplied?: string;
  status: "requested" | "successful" | "failed";
  timestampRequested: FieldValue;
  timestampFinalized?: FieldValue;
  errorDetails?: string;
}
