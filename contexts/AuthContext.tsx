"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { resetGuestPlayCount } from '@/lib/preferences';
import { UserRole, checkAndExpireSubscription } from '@/lib/subscription';
import NameInputModal from '@/reusable/ui/modals/NameInputModal';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAdmin: boolean;
  isPro: boolean;
  proExpiryDate: Date | null;
  proAdminMessage: string | null;
  proGivenBy: string | null;
  subscriptionNotified: boolean;
  loading: boolean;
  userName: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isLoginModalOpen: boolean;
  setLoginModalOpen: (open: boolean) => void;
  signInWithGoogle: () => Promise<void>;
  markSubscriptionNotified: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || '';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);

  // Firestore-driven role state
  const [dbRole, setDbRole] = useState<UserRole>('normal');
  const [proExpiryDate, setProExpiryDate] = useState<Date | null>(null);
  const [proAdminMessage, setProAdminMessage] = useState<string | null>(null);
  const [proGivenBy, setProGivenBy] = useState<string | null>(null);
  const [subscriptionNotified, setSubscriptionNotified] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [isDbBlocked, setIsDbBlocked] = useState(false);
  // Tracks whether we've done the initial Firestore read for the user's name.
  // Prevents the name modal from flashing before the DB response arrives.
  const [nameChecked, setNameChecked] = useState(false);
  // Tracks whether the name modal has been dismissed (persists across sessions via localStorage).
  const [nameModalDismissed, setNameModalDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('muse_name_submitted') === 'true';
    }
    return false;
  });

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Reset nameChecked on fresh auth — we haven't read Firestore yet
        setNameChecked(false);
        try {
          // Sync profile to Firestore
          const getDevicePlatform = () => {
            if (typeof window === 'undefined') return 'Web';
            const ua = navigator.userAgent || '';
            if (/android/i.test(ua)) return 'Android';
            if (/iPad|iPhone|iPod/.test(ua)) return 'iOS';
            if (/Macintosh|Mac OS X/.test(ua)) return 'macOS';
            if (/Windows/.test(ua)) return 'Windows';
            return 'Web';
          };

          await setDoc(doc(db, 'users', firebaseUser.uid), {
             uid: firebaseUser.uid,
             displayName: firebaseUser.displayName,
             email: firebaseUser.email,
             photoURL: firebaseUser.photoURL,
             lastLogin: serverTimestamp(),
             device: getDevicePlatform(),
          }, { merge: true });

          // Server-side expiry check on login
          checkAndExpireSubscription(firebaseUser.uid).catch(() => {});

          // Real-time listener for all role & subscription fields
          const { onSnapshot, getDoc } = await import('firebase/firestore');
          
          // Initial fetch to avoid flash — this is the authoritative first read
          const initialSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (initialSnap.exists()) {
            const data = initialSnap.data();
            const name = data.name || null;
            setUserName(name);
            setDbRole(data.role || 'normal');
            // If the user already has a name in Firestore, permanently dismiss the modal
            if (name) {
              setNameModalDismissed(true);
              try { localStorage.setItem('muse_name_submitted', 'true'); } catch {}
            }
          }
          // Mark that we've completed the initial name check
          setNameChecked(true);

          unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
            const data = snap.data();
            setIsDbBlocked(!!data?.isBlocked);
            setDbRole(data?.role ?? 'normal');
            setSubscriptionNotified(!!data?.subscription_notified);
            setProAdminMessage(data?.pro_admin_message ?? null);
            setProGivenBy(data?.pro_given_by ?? null);
            // Only update userName from snapshot if it has a real value.
            // This prevents a transient null from snapshot re-triggering the modal.
            const snapName = data?.name ?? null;
            if (snapName) {
              setUserName(snapName);
              // Also ensure dismissed flag is synced
              setNameModalDismissed(true);
              try { localStorage.setItem('muse_name_submitted', 'true'); } catch {}
            }

            // Parse pro_expiry_date
            const expiry = data?.pro_expiry_date as Timestamp | null;
            if (expiry) {
              const expiryDate = expiry.toDate();
              setProExpiryDate(expiryDate);
            } else {
              setProExpiryDate(null);
            }
          });

        } catch (e) {
          console.error("Profile sync/listener failed", e);
          // Even on error, mark as checked so the app doesn't hang
          setNameChecked(true);
        }
      } else {
        setIsDbBlocked(false);
        setDbRole('normal');
        setProExpiryDate(null);
        setProAdminMessage(null);
        setProGivenBy(null);
        setSubscriptionNotified(false);
        setUserName(null);
        setNameChecked(false);
        // Don't clear nameModalDismissed on logout — if they already submitted a name,
        // it's still in Firestore and will be read back on re-login.
        if (unsubscribeProfile) unsubscribeProfile();
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const login = async () => {
    setLoginModalOpen(true);
  };

  const signInWithGoogle = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setLoginModalOpen(false);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      resetGuestPlayCount();
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error("Login failed", error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const markSubscriptionNotified = async () => {
    if (!user) return;
    try {
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', user.uid), { subscription_notified: true });
      setSubscriptionNotified(true);
    } catch (e) {
      console.error('Failed to mark subscription notified', e);
    }
  };

  // Derived role values
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() || dbRole === 'admin';
  const isProActive = proExpiryDate ? proExpiryDate > new Date() : false;
  const isPro = isAdmin || (dbRole === 'pro' && isProActive);
  // Effective role exposed to consumers
  const role: UserRole = isAdmin ? 'admin' : (dbRole === 'pro' && isProActive ? 'pro' : 'normal');

  const BLOCKED_EMAILS: string[] = [];
  const isBlocked = (user?.email && BLOCKED_EMAILS.includes(user.email)) || isDbBlocked;

  if (isBlocked) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6 text-center">
            <h1 className="text-3xl font-bold text-red-600 mb-4">Access Denied</h1>
            <p className="text-lg text-gray-400 mb-6 font-medium">User has been blocked by Abhiyank.</p>
            <p className="text-sm text-gray-600 mb-8 max-w-md">Your account has been restricted. If you believe this is an error, please contact the administrator.</p>
            <button 
                onClick={logout}
                className="px-8 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-500 border border-red-600/50 rounded-xl transition-all font-semibold"
            >
                Logout
            </button>
        </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      role,
      isAdmin,
      isPro,
      proExpiryDate,
      proAdminMessage,
      proGivenBy,
      subscriptionNotified,
      loading,
      userName,
      login,
      logout,
      isLoginModalOpen,
      setLoginModalOpen,
      signInWithGoogle,
      markSubscriptionNotified,
    }}>
      {children}
      {user && !loading && nameChecked && !userName && !nameModalDismissed && (
        <NameInputModal 
          isOpen={true} 
          userId={user.uid} 
          onSuccess={(name) => {
            setUserName(name);
            setNameModalDismissed(true);
            try { localStorage.setItem('muse_name_submitted', 'true'); } catch {}
          }} 
        />
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
