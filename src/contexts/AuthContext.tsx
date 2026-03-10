import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut as firebaseSignOut, getIdTokenResult } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, onSnapshot, query, setDoc, updateDoc, where } from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";

export type Profile = {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  gender: "male" | "female";
  age: number;
  weight: number;
  height: number;
  activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal: "lose" | "maintain" | "gain";
  daily_calories: number;
  protein_goal: number;
  fat_goal: number;
  carbs_goal: number;
  streak_days: number;
  total_days: number;
  last_active_date?: string | null;
  title: string;
  xp: number;
  best_streak?: number;
  is_blocked?: boolean;
  created_at?: string;
  updated_at?: string;
};

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const TITLE_THRESHOLDS: { title: string; xp: number }[] = [
  { xp: 0, title: "Новичок" },
  { xp: 30, title: "Любитель" },
  { xp: 150, title: "Знаток" },
  { xp: 300, title: "Мастер" },
  { xp: 800, title: "Гуру" },
  { xp: 1200, title: "Эксперт" },
  { xp: 5000, title: "Легенда" },
  { xp: 10000, title: "Абсолютный чемпион" },
];
const adminTitle = { xp: 1000000, title: "Администратор" };

function titleFromXp(xp: number, isAdmin?: boolean) {
  const val = Number.isFinite(xp) ? xp : 0;
  if (isAdmin && val >= 1000000) return "Администратор";
  let best: string = TITLE_THRESHOLDS[0]?.title ?? "Новичок";
  for (const t of TITLE_THRESHOLDS) {
    if (val >= t.xp) best = t.title;
  }
  return best;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const fetchProfile = async (userId: string) => {
    try {
      const directRef = doc(db, "profiles", userId);

      // Registration race: auth state can fire before the app writes profiles/{uid}.
      // Retry a few times briefly before deciding the profile doesn't exist.
      for (let attempt = 0; attempt < 4; attempt++) {
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) {
          setProfile((directSnap.data() as Profile) ?? null);
          return;
        }
        if (attempt < 3) await sleep(300);
      }

      // Fallback for legacy data: profile stored under another doc id with field user_id
      const legacyQ = query(collection(db, "profiles"), where("user_id", "==", userId), limit(1));
      const legacySnap = await getDocs(legacyQ);
      const legacyDoc = legacySnap.docs[0];
      if (legacyDoc) {
        const data = legacyDoc.data() as any;
        const normalized: Profile = {
          user_id: userId,
          display_name: data.display_name ?? "",
          avatar_url: data.avatar_url ?? null,
          gender: data.gender ?? "male",
          age: Number(data.age ?? 25),
          weight: Number(data.weight ?? 70),
          height: Number(data.height ?? 175),
          activity_level: data.activity_level ?? "moderate",
          goal: data.goal ?? "maintain",
          daily_calories: Number(data.daily_calories ?? 2200),
          protein_goal: Number(data.protein_goal ?? 120),
          fat_goal: Number(data.fat_goal ?? 70),
          carbs_goal: Number(data.carbs_goal ?? 250),
          streak_days: Number(data.streak_days ?? 0),
          total_days: Number(data.total_days ?? 0),
          last_active_date: data.last_active_date ?? null,
          title: data.title ?? "Новичок",
          xp: Number(data.xp ?? 0),
          best_streak: Number(data.best_streak ?? 0),
          is_blocked: Boolean(data.is_blocked ?? false),
          created_at: data.created_at,
          updated_at: data.updated_at,
        };

        // Migrate to canonical doc id so other code works consistently
        await setDoc(directRef, normalized as any, { merge: true });
        setProfile(normalized);
        return;
      }

      // No profile exists yet. Create a minimal default profile so UI can proceed.
      const fallbackName =
        auth.currentUser?.displayName ||
        (auth.currentUser?.email ? auth.currentUser.email.split("@")[0] : null) ||
        "Пользователь";
      const defaults: Profile = {
        user_id: userId,
        display_name: fallbackName,
        avatar_url: null,
        gender: "male",
        age: 25,
        weight: 70,
        height: 175,
        activity_level: "moderate",
        goal: "maintain",
        daily_calories: 2200,
        protein_goal: 120,
        fat_goal: 70,
        carbs_goal: 250,
        streak_days: 0,
        total_days: 0,
        last_active_date: null,
        title: "Новичок",
        xp: 0,
        best_streak: 0,
        is_blocked: false,
      };

      await setDoc(directRef, defaults as any, { merge: true });
      setProfile(defaults);
    } catch {
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
  };

  useEffect(() => {
    if (!user) return;

    const directRef = doc(db, "profiles", user.uid);
    let inFlightTitleUpdate = false;

    const unsub = onSnapshot(
      directRef,
      async (snap) => {
        if (!snap.exists()) return;
        const next = (snap.data() as Profile) ?? null;
        setProfile(next);

        // Keep title consistent with XP thresholds.
        // This is safe without Cloud Functions, because Security Rules allow admin or self update.
        const oldTitle = next?.title;
        const newTitle = titleFromXp(next?.xp ?? 0, isAdmin);
        if (newTitle !== oldTitle) {
          await updateDoc(directRef, { title: newTitle });
        }
      },
      () => {
        // ignore
      }
    );

    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      try {
        if (nextUser) {
          const token = await getIdTokenResult(nextUser, true);
          setIsAdmin(Boolean((token.claims as any)?.admin));
          await fetchProfile(nextUser.uid);
        } else {
          setProfile(null);
          setIsAdmin(false);
        }
      } catch {
        setProfile(null);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
