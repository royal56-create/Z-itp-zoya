import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  User as FirebaseUser,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Optional App Check: set VITE_RECAPTCHA_SITE_KEY in the hosting environment.
// This reference client is not production-ready until App Check is configured in Firebase Console.
const appCheckSiteKey = (import.meta.env.VITE_RECAPTCHA_SITE_KEY || "").trim();
if (appCheckSiteKey) {
  try {
    initializeAppCheck(app, { provider: new ReCaptchaV3Provider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
  } catch {
    // Fail closed at the backend via Firestore rules when App Check is unavailable.
  }
}

// Auth & Google Provider
export const auth = getAuth(app);

// Configure multi-tiered persistence to prevent Database is closing/hidden in popups or mobile iframes
try {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    try {
      setPersistence(auth, browserSessionPersistence).catch(() => {
        try {
          setPersistence(auth, inMemoryPersistence);
        } catch {}
      });
    } catch {}
  });
} catch {
  // Ignored in non-browser contexts
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Firestore instance using explicit database ID from config
export const db = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId || "(default)"
);

export type { FirebaseUser };

export interface AppUserProfile {
  uid: string;
  email?: string;
  phoneNumber?: string;
  displayName: string;
  photoURL?: string;
  provider: "google" | "password" | "mobile";
  createdAt: string;
  lastLogin: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "Royal";
  text: string;
  timestamp: string;
  userId: string;
  createdAt?: number;
}

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn("Firestore Operation Notice:", JSON.stringify(errInfo));
}

const LOCAL_AUTH_USER_KEY = "zoya_authenticated_user";
const LOCAL_ACCOUNTS_KEY = "zoya_local_registered_accounts";

/**
 * Hash password securely using Web Crypto API SHA-256
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + "_zoya_salt_2026");
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    // Fallback basic hashing if subtle crypto restricted in insecure origin
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      hash = (hash << 5) - hash + password.charCodeAt(i);
      hash |= 0;
    }
    return `fb_${Math.abs(hash).toString(16)}`;
  }
}

/**
 * Local Account Backup helpers for resilient offline/mobile login
 */
function getLocalAccounts(): Record<string, any> {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalAccount(key: string, data: any) {
  try {
    const current = getLocalAccounts();
    current[key] = data;
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(current));
  } catch {}
}

/**
 * Gets currently persisted user from localStorage
 */
export function getPersistedUser(): AppUserProfile | null {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Strict requirement: Reject any legacy guest profile
    if (!parsed || parsed.provider === "guest" || (typeof parsed.uid === "string" && parsed.uid.startsWith("guest_"))) {
      localStorage.removeItem(LOCAL_AUTH_USER_KEY);
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

/**
 * Saves user profile to persistent storage
 */
export function persistUser(user: AppUserProfile | null): void {
  if (user) {
    try {
      localStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(user));
    } catch {}
  } else {
    try {
      localStorage.removeItem(LOCAL_AUTH_USER_KEY);
    } catch {}
  }
}

/**
 * Sign in with Google Popup
 */
export async function signInWithGoogle(): Promise<AppUserProfile> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    const profile: AppUserProfile = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || user.email?.split("@")[0] || "User",
      photoURL: user.photoURL || "",
      provider: "google",
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };

    // Save to Firestore in background without blocking login
    try {
      const userRef = doc(db, "users", user.uid);
      setDoc(userRef, profile, { merge: true }).catch(() => {});
    } catch {}

    persistUser(profile);
    return profile;
  } catch (err: any) {
    const msg = err?.message || "";
    // If popup closed or closing error occurred but user is authenticated in auth instance
    if (auth.currentUser) {
      const u = auth.currentUser;
      const profile: AppUserProfile = {
        uid: u.uid,
        email: u.email || "",
        displayName: u.displayName || u.email?.split("@")[0] || "User",
        photoURL: u.photoURL || "",
        provider: "google",
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      persistUser(profile);
      return profile;
    }
    
    if (err?.code === "auth/unauthorized-domain" || msg.includes("auth/unauthorized-domain") || msg.includes("unauthorized-domain")) {
      const hostname = typeof window !== "undefined" ? window.location.hostname : "current-domain";
      const customErr: any = new Error(
        `Firebase domain unauthorized: "${hostname}" is not in your Firebase Authorized Domains list. Please add "${hostname}" in Firebase Console > Authentication > Settings > Authorized domains, or use Email / Mobile login.`
      );
      customErr.code = "auth/unauthorized-domain";
      customErr.domain = hostname;
      throw customErr;
    }
    if (err?.code === "auth/popup-closed-by-user" || msg.includes("popup-closed-by-user")) {
      throw new Error("Google sign-in popup was closed.");
    }
    if (err?.code === "auth/popup-blocked") {
      throw new Error("Sign-in popup was blocked by your browser. Please allow popups or use Email/Mobile login.");
    }
    throw err;
  }
}

/**
 * Sign in with Email / Mobile and Password
 */
export async function signInWithEmailOrMobile(
  identifier: string,
  passwordPlain: string
): Promise<AppUserProfile> {
  const trimmed = identifier.trim();
  const isEmail = trimmed.includes("@");

  if (isEmail) {
    try {
      const res = await signInWithEmailAndPassword(auth, trimmed, passwordPlain);
      const user = res.user;
      const profile: AppUserProfile = {
        uid: user.uid,
        email: user.email || trimmed,
        displayName: user.displayName || trimmed.split("@")[0] || "User",
        photoURL: user.photoURL || "",
        provider: "password",
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      
      try {
        const userRef = doc(db, "users", user.uid);
        setDoc(userRef, profile, { merge: true }).catch(() => {});
      } catch {}

      persistUser(profile);
      return profile;
    } catch (fbErr: any) {
      if (fbErr.code === "auth/wrong-password" || fbErr.code === "auth/invalid-credential") {
        throw new Error("Incorrect password. Please verify your password and try again.");
      }
      console.warn("Firebase email auth checking custom records:", fbErr.message);
    }
  }

  // Check custom Firestore account or local storage account backup
  const hashed = await hashPassword(passwordPlain);
  const accountDocId = isEmail 
    ? `email_${trimmed.toLowerCase().replace(/[^a-z0-9]/g, "_")}`
    : `mob_${trimmed.replace(/[^0-9]/g, "")}`;

  // 1. Try Firestore
  let foundData: any = null;
  try {
    const accountRef = doc(db, "accounts", accountDocId);
    const snap = await getDoc(accountRef);
    if (snap.exists()) {
      foundData = snap.data();
    }
  } catch (err: any) {
    console.warn("Firestore query notice, checking local cache:", err?.message);
  }

  // 2. Fallback to Local Storage Mirror if Firestore is offline / closing
  if (!foundData) {
    const localAccounts = getLocalAccounts();
    if (localAccounts[accountDocId]) {
      foundData = localAccounts[accountDocId];
    }
  }

  if (foundData) {
    if (foundData.passwordHash === hashed) {
      const profile: AppUserProfile = {
        uid: foundData.uid,
        email: foundData.email || (isEmail ? trimmed : ""),
        phoneNumber: foundData.phoneNumber || (!isEmail ? trimmed : ""),
        displayName: foundData.displayName || "User",
        photoURL: foundData.photoURL || "",
        provider: isEmail ? "password" : "mobile",
        createdAt: foundData.createdAt || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };

      try {
        const userRef = doc(db, "users", profile.uid);
        setDoc(userRef, profile, { merge: true }).catch(() => {});
      } catch {}

      persistUser(profile);
      return profile;
    } else {
      throw new Error("Incorrect password. Please verify and try again.");
    }
  }

  throw new Error("No account found with these details. Please create an account first.");
}

export interface LiveAppStats {
  totalUsers: number;
  googleUsers: number;
  customAccounts: number;
  recentUsersList: { name: string; provider: string; date: string }[];
  timestamp: string;
}

/**
 * Queries real-time user database in Firestore for accurate live counts
 */
export async function getLiveAppUserStats(): Promise<LiveAppStats> {
  let totalUsers = 0;
  let googleUsers = 0;
  let customAccounts = 0;
  const recentUsersList: { name: string; provider: string; date: string }[] = [];
  const uniqueUids = new Set<string>();

  try {
    // 1. Query Firestore users collection
    const usersCol = collection(db, "users");
    const userSnapshot = await getDocs(usersCol);
    
    userSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const uid = data.uid || docSnap.id;
      // Skip legacy guest users in stats if any
      if (data.provider === "guest" || uid.startsWith("guest_")) {
        return;
      }
      uniqueUids.add(uid);

      if (data.provider === "google") {
        googleUsers++;
      } else {
        customAccounts++;
      }

      if (recentUsersList.length < 5) {
        recentUsersList.push({
          name: data.displayName || "User",
          provider: data.provider || "password",
          date: data.createdAt || data.lastLogin || new Date().toISOString(),
        });
      }
    });
  } catch (err) {
    console.warn("Firestore users query notice during stats:", err);
  }

  try {
    // 2. Query Firestore accounts collection
    const accountsCol = collection(db, "accounts");
    const accountsSnapshot = await getDocs(accountsCol);
    accountsSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const uid = data.uid || docSnap.id;
      if (!uniqueUids.has(uid)) {
        uniqueUids.add(uid);
        customAccounts++;
        if (recentUsersList.length < 5) {
          recentUsersList.push({
            name: data.displayName || "User",
            provider: "account",
            date: data.createdAt || new Date().toISOString(),
          });
        }
      }
    });
  } catch (err) {
    console.warn("Firestore accounts query notice during stats:", err);
  }

  // 3. Fallback / Merge with Local Registered Accounts & Persistent User
  try {
    const localAccounts = getLocalAccounts();
    Object.values(localAccounts).forEach((acc: any) => {
      if (acc && acc.uid && !uniqueUids.has(acc.uid)) {
        uniqueUids.add(acc.uid);
        customAccounts++;
      }
    });

    const persisted = getPersistedUser();
    if (persisted && persisted.uid && !uniqueUids.has(persisted.uid)) {
      uniqueUids.add(persisted.uid);
      if (persisted.provider === "google") googleUsers++;
      else customAccounts++;
    }
  } catch {}

  totalUsers = uniqueUids.size;

  return {
    totalUsers: Math.max(totalUsers, 1),
    googleUsers,
    customAccounts,
    recentUsersList,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Sign up with Email / Mobile, Name and Password
 */
export async function signUpWithEmailOrMobile(
  identifier: string,
  passwordPlain: string,
  name: string
): Promise<AppUserProfile> {
  const trimmed = identifier.trim();
  const isEmail = trimmed.includes("@");
  const displayName = name.trim() || (isEmail ? trimmed.split("@")[0] : "User");

  if (isEmail) {
    try {
      const res = await createUserWithEmailAndPassword(auth, trimmed, passwordPlain);
      const user = res.user;
      if (displayName) {
        try {
          await updateProfile(user, { displayName });
        } catch {}
      }

      const profile: AppUserProfile = {
        uid: user.uid,
        email: trimmed,
        displayName,
        photoURL: "",
        provider: "password",
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };

      try {
        const userRef = doc(db, "users", user.uid);
        setDoc(userRef, profile, { merge: true }).catch(() => {});
      } catch {}

      persistUser(profile);
      return profile;
    } catch (fbErr: any) {
      if (fbErr.code === "auth/email-already-in-use") {
        throw new Error("An account already exists with this email address. Please sign in instead.");
      }
      console.warn("Firebase create user with email notice, using custom account fallback:", fbErr.message);
    }
  }

  // Create custom account with dual-write to Firestore and Local Mirror
  const hashed = await hashPassword(passwordPlain);
  const accountDocId = isEmail 
    ? `email_${trimmed.toLowerCase().replace(/[^a-z0-9]/g, "_")}`
    : `mob_${trimmed.replace(/[^0-9]/g, "")}`;
  const customUid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // Check if exists locally
  const localAccounts = getLocalAccounts();
  if (localAccounts[accountDocId]) {
    throw new Error("An account already exists with this email or mobile number. Please sign in.");
  }

  const now = new Date().toISOString();
  const accountData = {
    uid: customUid,
    email: isEmail ? trimmed : "",
    phoneNumber: !isEmail ? trimmed : "",
    displayName,
    passwordHash: hashed,
    createdAt: now,
    lastLogin: now,
  };

  // Save to Local Mirror immediately
  saveLocalAccount(accountDocId, accountData);

  // Dual-write to Firestore
  try {
    const accountRef = doc(db, "accounts", accountDocId);
    setDoc(accountRef, accountData).catch(() => {});
  } catch {}

  const profile: AppUserProfile = {
    uid: customUid,
    email: isEmail ? trimmed : "",
    phoneNumber: !isEmail ? trimmed : "",
    displayName,
    photoURL: "",
    provider: isEmail ? "password" : "mobile",
    createdAt: now,
    lastLogin: now,
  };

  try {
    const userRef = doc(db, "users", customUid);
    setDoc(userRef, profile, { merge: true }).catch(() => {});
  } catch {}

  persistUser(profile);
  return profile;
}

/**
 * Sign out current user
 */
export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("Firebase signout error:", e);
  }
  persistUser(null);
}

/**
 * Subscribe to auth state changes
 */
export function subscribeAuthStatus(
  callback: (user: AppUserProfile | null) => void
) {
  return onAuthStateChanged(auth, (fbUser) => {
    if (fbUser) {
      const profile: AppUserProfile = {
        uid: fbUser.uid,
        email: fbUser.email || "",
        displayName: fbUser.displayName || fbUser.email?.split("@")[0] || "User",
        photoURL: fbUser.photoURL || "",
        provider: fbUser.providerData[0]?.providerId === "google.com" ? "google" : "password",
        createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      persistUser(profile);
      callback(profile);
    } else {
      const persisted = getPersistedUser();
      callback(persisted);
    }
  });
}

/**
 * Save a single message to user's Firestore messages collection with debug logging
 */
export async function saveMessageToFirestore(
  userId: string,
  message: ChatMessage
): Promise<void> {
  if (!userId) return;
  console.log(`[Zoya Firestore] 💾 Saving message (${message.sender}) for User ${userId}: "${message.text.substring(0, 40)}..."`);
  try {
    const msgRef = doc(db, "users", userId, "messages", message.id);
    await setDoc(msgRef, {
      id: message.id,
      sender: message.sender,
      text: message.text,
      timestamp: message.timestamp,
      userId: userId,
      createdAt: message.createdAt || Date.now(),
    });
    console.log(`[Zoya Firestore] ✅ Message ${message.id} successfully written to users/${userId}/messages`);
  } catch (error) {
    console.warn(`[Zoya Firestore] ⚠️ Failed to write message ${message.id} to Firestore:`, error);
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/messages/${message.id}`);
  }
}

/**
 * Real-time listener for user's chat messages in Firestore with debug logging
 */
export function subscribeUserChatHistory(
  userId: string,
  callback: (messages: ChatMessage[]) => void
) {
  if (!userId) {
    callback([]);
    return () => {};
  }

  console.log(`[Zoya Firestore] 📡 Subscribing to real-time chat history for User: ${userId}`);
  try {
    const messagesRef = collection(db, "users", userId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    return onSnapshot(
      q,
      (snapshot) => {
        const msgs: ChatMessage[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: data.id || doc.id,
            sender: data.sender || "user",
            text: data.text || "",
            timestamp: data.timestamp || "",
            userId: data.userId || userId,
            createdAt: data.createdAt || 0,
          };
        });
        console.log(`[Zoya Firestore] 📥 Received ${msgs.length} messages from Firestore stream for User: ${userId}`);
        callback(msgs);
      },
      (error) => {
        console.warn(`[Zoya Firestore] ⚠️ Real-time listener error for User: ${userId}:`, error);
        handleFirestoreError(error, OperationType.LIST, `users/${userId}/messages`);
      }
    );
  } catch (err) {
    console.warn(`[Zoya Firestore] ⚠️ Error creating listener for User: ${userId}:`, err);
    callback([]);
    return () => {};
  }
}

/**
 * Clear all chat messages for a user in Firestore with debug logging
 */
export async function clearUserChatHistoryInFirestore(
  userId: string
): Promise<void> {
  if (!userId) return;
  console.log(`[Zoya Firestore] 🗑️ Deleting all messages for User ${userId}...`);
  try {
    const messagesRef = collection(db, "users", userId, "messages");
    const snapshot = await getDocs(messagesRef);
    if (snapshot.empty) {
      console.log(`[Zoya Firestore] ℹ️ No messages to delete in Firestore for User ${userId}`);
      return;
    }

    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`[Zoya Firestore] ✅ Successfully deleted ${snapshot.size} messages from Firestore for User ${userId}`);
  } catch (error) {
    console.warn(`[Zoya Firestore] ⚠️ Error clearing messages for User ${userId}:`, error);
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/messages`);
  }
}

export interface VoiceHistoryRecord {
  id: string;
  sender: "user" | "Royal";
  transcript: string;
  timestamp: string;
  userId: string;
  type?: "voice_input" | "voice_response" | "voice_call";
  createdAt: number;
  durationSeconds?: number;
}

/**
 * Save a single voice interaction to user's Firestore voiceHistory collection
 */
export async function saveVoiceHistory(
  userId: string,
  record: {
    sender: "user" | "Royal";
    transcript: string;
    timestamp?: string;
    type?: "voice_input" | "voice_response" | "voice_call";
    durationSeconds?: number;
    createdAt?: number;
  }
): Promise<string> {
  if (!userId || !record.transcript?.trim()) return "";
  const voiceId = "vh_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const now = Date.now();
  const timeStr = record.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const fullRecord: VoiceHistoryRecord = {
    id: voiceId,
    sender: record.sender,
    transcript: record.transcript.trim(),
    timestamp: timeStr,
    userId: userId,
    type: record.type || (record.sender === "user" ? "voice_input" : "voice_response"),
    createdAt: record.createdAt || now,
    durationSeconds: record.durationSeconds,
  };

  console.log(`[Zoya Firestore] 🎙️ Saving voice interaction (${fullRecord.sender}) for User ${userId}: "${fullRecord.transcript.substring(0, 40)}..."`);
  
  // Local storage cache for instant offline responsiveness
  try {
    const localKey = `zoya_voice_history_${userId}`;
    const cached: VoiceHistoryRecord[] = JSON.parse(localStorage.getItem(localKey) || "[]");
    cached.unshift(fullRecord);
    localStorage.setItem(localKey, JSON.stringify(cached.slice(0, 100)));
  } catch {}

  try {
    const voiceRef = doc(db, "users", userId, "voiceHistory", voiceId);
    await setDoc(voiceRef, fullRecord);
    console.log(`[Zoya Firestore] ✅ Voice interaction ${voiceId} written to users/${userId}/voiceHistory`);
  } catch (error) {
    console.warn(`[Zoya Firestore] ⚠️ Failed to write voice history to Firestore:`, error);
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/voiceHistory/${voiceId}`);
  }

  return voiceId;
}

/**
 * Real-time listener for user's voice history in Firestore
 */
export function subscribeUserVoiceHistory(
  userId: string,
  callback: (records: VoiceHistoryRecord[]) => void
) {
  if (!userId) {
    callback([]);
    return () => {};
  }

  console.log(`[Zoya Firestore] 📡 Subscribing to real-time voice history for User: ${userId}`);
  
  // Deliver cached items first for zero-latency
  try {
    const localKey = `zoya_voice_history_${userId}`;
    const cached: VoiceHistoryRecord[] = JSON.parse(localStorage.getItem(localKey) || "[]");
    if (cached.length > 0) {
      callback(cached);
    }
  } catch {}

  try {
    const voiceRef = collection(db, "users", userId, "voiceHistory");
    const q = query(voiceRef, orderBy("createdAt", "desc"));

    return onSnapshot(
      q,
      (snapshot) => {
        const records: VoiceHistoryRecord[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: data.id || doc.id,
            sender: data.sender || "user",
            transcript: data.transcript || "",
            timestamp: data.timestamp || "",
            userId: data.userId || userId,
            type: data.type || "voice_input",
            createdAt: data.createdAt || 0,
            durationSeconds: data.durationSeconds,
          };
        });
        console.log(`[Zoya Firestore] 📥 Received ${records.length} voice records from Firestore stream for User: ${userId}`);
        
        // Cache to local storage
        try {
          localStorage.setItem(`zoya_voice_history_${userId}`, JSON.stringify(records));
        } catch {}

        callback(records);
      },
      (error) => {
        console.warn(`[Zoya Firestore] ⚠️ Real-time voice listener error for User: ${userId}:`, error);
        handleFirestoreError(error, OperationType.LIST, `users/${userId}/voiceHistory`);
      }
    );
  } catch (err) {
    console.warn(`[Zoya Firestore] ⚠️ Error creating voice listener for User: ${userId}:`, err);
    callback([]);
    return () => {};
  }
}

/**
 * Clear all voice history for a user in Firestore
 */
export async function clearUserVoiceHistoryInFirestore(
  userId: string
): Promise<void> {
  if (!userId) return;
  console.log(`[Zoya Firestore] 🗑️ Deleting all voice history for User ${userId}...`);
  try {
    localStorage.removeItem(`zoya_voice_history_${userId}`);
  } catch {}

  try {
    const voiceRef = collection(db, "users", userId, "voiceHistory");
    const snapshot = await getDocs(voiceRef);
    if (snapshot.empty) {
      console.log(`[Zoya Firestore] ℹ️ No voice history to delete in Firestore for User ${userId}`);
      return;
    }

    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`[Zoya Firestore] ✅ Successfully deleted ${snapshot.size} voice records from Firestore for User ${userId}`);
  } catch (error) {
    console.warn(`[Zoya Firestore] ⚠️ Error clearing voice records for User ${userId}:`, error);
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/voiceHistory`);
  }
}

/**
 * Delete a single voice history record
 */
export async function deleteSingleVoiceRecord(
  userId: string,
  recordId: string
): Promise<void> {
  if (!userId || !recordId) return;
  try {
    const recordRef = doc(db, "users", userId, "voiceHistory", recordId);
    await deleteDoc(recordRef);
    console.log(`[Zoya Firestore] ✅ Deleted voice record ${recordId} for User ${userId}`);
  } catch (error) {
    console.warn(`[Zoya Firestore] ⚠️ Error deleting voice record:`, error);
  }
}

// ─────────────────────────────────────────────────────────────
// Session-Based Topics Architecture (Unified Voice & Text History)
// ─────────────────────────────────────────────────────────────

export interface HistoryMessage {
  id: string;
  sender: "user" | "Royal" | "zoya";
  text: string;
  timestamp: string;
  createdAt: number;
  mode: "voice" | "text";
}

export interface VoiceTopicSession {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  mode: "voice" | "text" | "mixed";
  messageCount: number;
  messages: HistoryMessage[];
}

/**
 * Generates a clean, human-readable title from the first message
 */
export function generateTopicTitle(firstText: string, mode: "voice" | "text" | "mixed"): string {
  const trimmed = firstText.trim();
  if (!trimmed) {
    return mode === "voice"
      ? `Voice Call • ${new Date().toLocaleDateString([], { month: "short", day: "numeric" })}`
      : "New Conversation";
  }

  // Remove common polite filler prefixes if present
  let clean = trimmed
    .replace(/^(can you please|can you|could you|please|hey zoya|hi zoya|hello zoya|zoya|tell me about|what is|how to)\s+/i, "")
    .trim();
  if (!clean) clean = trimmed;

  // Capitalize first letter
  clean = clean.charAt(0).toUpperCase() + clean.slice(1);

  // Truncate cleanly at word boundary around 40-48 chars
  if (clean.length > 48) {
    const truncated = clean.substring(0, 48);
    const lastSpace = truncated.lastIndexOf(" ");
    clean = (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + "...";
  }

  return clean;
}

/**
 * Add a message to an active topic (session), creating the topic if it doesn't exist yet
 */
export async function addMessageToTopic(
  userId: string,
  topicId: string,
  message: {
    sender: "user" | "Royal" | "zoya";
    text: string;
    mode: "voice" | "text";
    timestamp?: string;
    createdAt?: number;
  }
): Promise<VoiceTopicSession> {
  const text = (message.text || "").trim();
  if (!userId || !text) {
    throw new Error("userId and non-empty text are required to add message to topic");
  }

  const now = message.createdAt || Date.now();
  const timeStr = message.timestamp || new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const histMsg: HistoryMessage = {
    id: "msg_" + now + "_" + Math.random().toString(36).substring(2, 6),
    sender: message.sender,
    text,
    timestamp: timeStr,
    createdAt: now,
    mode: message.mode,
  };

  const localKey = `zoya_topics_${userId}`;
  let topics: VoiceTopicSession[] = [];
  try {
    topics = JSON.parse(localStorage.getItem(localKey) || "[]");
  } catch {}

  let existingIndex = topics.findIndex((t) => t.id === topicId);
  let updatedTopic: VoiceTopicSession;

  if (existingIndex >= 0) {
    const current = topics[existingIndex];
    const newMessages = [...current.messages, histMsg];
    let mode = current.mode;
    if (mode !== message.mode) {
      mode = "mixed";
    }

    // If initial title was generic (e.g., started with simple "hello"), refine if this user message is better
    let title = current.title;
    if (
      message.sender === "user" &&
      (title.startsWith("Voice Call") || title.startsWith("New Conversation") || title.length < 8) &&
      text.length > 8
    ) {
      title = generateTopicTitle(text, mode);
    }

    updatedTopic = {
      ...current,
      title,
      updatedAt: now,
      mode,
      messageCount: newMessages.length,
      messages: newMessages,
    };

    topics[existingIndex] = updatedTopic;
  } else {
    const title = generateTopicTitle(text, message.mode);
    updatedTopic = {
      id: topicId,
      userId,
      title,
      createdAt: now,
      updatedAt: now,
      mode: message.mode,
      messageCount: 1,
      messages: [histMsg],
    };
    topics.unshift(updatedTopic);
  }

  // Sort by updatedAt descending
  topics.sort((a, b) => b.updatedAt - a.updatedAt);

  // Save to localStorage immediately for instant UI response
  try {
    localStorage.setItem(localKey, JSON.stringify(topics.slice(0, 50)));
  } catch {}

  // Dual-write topic to Firestore
  try {
    const topicRef = doc(db, "users", userId, "topics", topicId);
    await setDoc(topicRef, updatedTopic, { merge: true });
    console.log(`[Zoya Firestore] ✅ Saved message to Topic ${topicId} ("${updatedTopic.title}")`);
  } catch (error) {
    console.warn(`[Zoya Firestore] ⚠️ Failed to save topic ${topicId} to Firestore:`, error);
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/topics/${topicId}`);
  }

  return updatedTopic;
}

/**
 * Subscribe to user's conversation topics in real-time
 * Includes automatic migration of legacy flat voice/chat records if no topics exist yet
 */
export function subscribeUserTopics(
  userId: string,
  callback: (topics: VoiceTopicSession[]) => void
) {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const localKey = `zoya_topics_${userId}`;

  // 1. Deliver local cache if available
  try {
    const cached: VoiceTopicSession[] = JSON.parse(localStorage.getItem(localKey) || "[]");
    if (cached.length > 0) {
      callback(cached);
    } else {
      // Check legacy voice records for backwards compatibility
      const legacyVoice: VoiceHistoryRecord[] = JSON.parse(
        localStorage.getItem(`zoya_voice_history_${userId}`) || "[]"
      );
      if (legacyVoice.length > 0) {
        const migrated: VoiceTopicSession = {
          id: "topic_legacy_voice_" + userId,
          userId,
          title: "Archived Voice Calls",
          createdAt: legacyVoice[legacyVoice.length - 1]?.createdAt || Date.now(),
          updatedAt: legacyVoice[0]?.createdAt || Date.now(),
          mode: "voice",
          messageCount: legacyVoice.length,
          messages: legacyVoice.map((v) => ({
            id: v.id,
            sender: v.sender,
            text: v.transcript,
            timestamp: v.timestamp,
            createdAt: v.createdAt,
            mode: "voice",
          })),
        };
        callback([migrated]);
      }
    }
  } catch {}

  // 2. Subscribe to Firestore topics collection
  try {
    const topicsRef = collection(db, "users", userId, "topics");
    const q = query(topicsRef, orderBy("updatedAt", "desc"));

    return onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const remoteTopics: VoiceTopicSession[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: data.id || d.id,
              userId: data.userId || userId,
              title: data.title || "Voice Session",
              createdAt: data.createdAt || 0,
              updatedAt: data.updatedAt || 0,
              mode: data.mode || "voice",
              messageCount: data.messageCount || (data.messages?.length ?? 0),
              messages: Array.isArray(data.messages) ? data.messages : [],
            };
          });

          try {
            localStorage.setItem(localKey, JSON.stringify(remoteTopics));
          } catch {}

          callback(remoteTopics);
        } else {
          // If no topics in Firestore yet, check if there's legacy voice history to synthesize
          try {
            const cached: VoiceTopicSession[] = JSON.parse(localStorage.getItem(localKey) || "[]");
            if (cached.length > 0) {
              callback(cached);
              return;
            }
          } catch {}
          callback([]);
        }
      },
      (error) => {
        console.warn(`[Zoya Firestore] ⚠️ Error subscribing to topics for User: ${userId}:`, error);
        handleFirestoreError(error, OperationType.LIST, `users/${userId}/topics`);
      }
    );
  } catch (err) {
    console.warn(`[Zoya Firestore] ⚠️ Error creating topic listener:`, err);
    callback([]);
    return () => {};
  }
}

/**
 * Delete a single topic session
 */
export async function deleteSingleTopic(userId: string, topicId: string): Promise<void> {
  if (!userId || !topicId) return;
  const localKey = `zoya_topics_${userId}`;
  try {
    const cached: VoiceTopicSession[] = JSON.parse(localStorage.getItem(localKey) || "[]");
    const updated = cached.filter((t) => t.id !== topicId);
    localStorage.setItem(localKey, JSON.stringify(updated));
  } catch {}

  try {
    const topicRef = doc(db, "users", userId, "topics", topicId);
    await deleteDoc(topicRef);
    console.log(`[Zoya Firestore] ✅ Deleted topic ${topicId} for User ${userId}`);
  } catch (error) {
    console.warn(`[Zoya Firestore] ⚠️ Error deleting topic ${topicId}:`, error);
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/topics/${topicId}`);
  }
}

/**
 * Clear all topics for a user
 */
export async function clearUserTopicsInFirestore(userId: string): Promise<void> {
  if (!userId) return;
  const localKey = `zoya_topics_${userId}`;
  try {
    localStorage.removeItem(localKey);
  } catch {}

  try {
    const topicsRef = collection(db, "users", userId, "topics");
    const snapshot = await getDocs(topicsRef);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`[Zoya Firestore] ✅ Cleared ${snapshot.size} topics for User ${userId}`);
  } catch (error) {
    console.warn(`[Zoya Firestore] ⚠️ Error clearing topics:`, error);
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/topics`);
  }
}

