import { Outlet, useLocation } from "react-router-dom";
import { AppTopNav } from "@/components/AppTopNav";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { renderIcon } from "@/lib/icons";
import { useAuth } from "@/contexts/AuthContext";
import confetti from "canvas-confetti";

const TITLE_ORDER = [
  "Новичок",
  "Любитель",
  "Спортсмен",
  "Профи",
  "Эксперт",
  "Легенда",
  "Абсолютный чемпион",
];

function titleRank(title: string | null | undefined) {
  const idx = TITLE_ORDER.findIndex((t) => t === title);
  return idx >= 0 ? idx : 0;
}

type Rarity = "обычный" | "редкий" | "эпический" | "легендарный" | "мифический";

function rarityByRank(rank: number): Rarity {
  if (rank >= 6) return "мифический";
  if (rank >= 5) return "легендарный";
  if (rank >= 4) return "эпический";
  if (rank >= 2) return "редкий";
  return "обычный";
}

function rarityTheme(rarity: Rarity) {
  switch (rarity) {
    case "мифический":
      return { titleClass: "text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-pink-400", glow: "rgba(245,158,11,.45)", colors: ["#FCD34D", "#FB923C", "#F472B6"], ring: "ring-1 ring-amber-400/25", label: "Мифический", accent: "#FCD34D" };
    case "легендарный":
      return { titleClass: "text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-red-400", glow: "rgba(168,85,247,.45)", colors: ["#A78BFA", "#F472B6", "#F87171"], ring: "ring-1 ring-purple-400/25", label: "Легендарный", accent: "#A78BFA" };
    case "эпический":
      return { titleClass: "text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400", glow: "rgba(59,130,246,.45)", colors: ["#60A5FA", "#A78BFA", "#F472B6"], ring: "ring-1 ring-blue-400/25", label: "Эпический", accent: "#60A5FA" };
    case "редкий":
      return { titleClass: "text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-blue-400 to-purple-400", glow: "rgba(34,197,94,.45)", colors: ["#4ADE80", "#60A5FA", "#A78BFA"], ring: "ring-1 ring-green-400/25", label: "Редкий", accent: "#4ADE80" };
    default:
      return { titleClass: "text-transparent bg-clip-text bg-gradient-to-r from-gray-400 via-gray-300 to-gray-200", glow: "rgba(156,163,175,.45)", colors: ["#9CA3AF", "#D1D5DB", "#E5E7EB"], ring: "ring-1 ring-slate-400/25", label: "Обычный", accent: "#9CA3AF" };
  }
}

function titleTheme(title: string) {
  if (title === "Администратор") {
    return { titleClass: "text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-red-600 to-rose-600", glow: "rgba(239,68,68,.45)", colors: ["#EF4444", "#DC2626", "#E11D48"], ring: "ring-1 ring-red-500/25", label: "Администратор", accent: "#EF4444" };
  }
  const rank = titleRank(title);
  const rarity = rarityByRank(rank);
  return rarityTheme(rarity);
}

export default function AppLayout() {
  const location = useLocation();
  const { user, profile } = useAuth();
  const [showSplash, setShowSplash] = useState(false);
  const lastTitleRef = useRef<string | null>(null);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [levelUpTitle, setLevelUpTitle] = useState<string>("");
  const [levelUpPrevTitle, setLevelUpPrevTitle] = useState<string>("");
  const [levelUpRarity, setLevelUpRarity] = useState<Rarity>("обычный");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "cc_splash_shown";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    setShowSplash(true);
    const t = window.setTimeout(() => setShowSplash(false), 950);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!user?.uid || !profile?.title) return;

    const prev = lastTitleRef.current;
    lastTitleRef.current = profile.title;
    if (!prev) return;
    if (prev === profile.title) return;
    if (titleRank(profile.title) <= titleRank(prev)) return;

    const key = `cc_title_seen_${user.uid}_${profile.title}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    setLevelUpPrevTitle(prev);
    setLevelUpTitle(profile.title);
    setLevelUpRarity(rarityByRank(titleRank(profile.title)));
    setLevelUpOpen(true);

    try {
      const theme = rarityTheme(rarityByRank(titleRank(profile.title)));
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.65 } });
      window.setTimeout(() => {
        confetti({ particleCount: 80, spread: 110, origin: { y: 0.4 }, colors: theme.colors });
      }, 450);
      window.setTimeout(() => {
        confetti({ particleCount: 30, spread: 65, origin: { y: 0.2 }, colors: theme.colors });
      }, 900);
    } catch {
      // ignore
    }
  }, [user?.uid, profile?.title]);

  return (
    <div className="min-h-screen w-full page-shell">
      <AppTopNav />

      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 grid place-items-center"
          >
            <div className="absolute inset-0 bg-background/90 backdrop-blur" />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -6 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="relative"
            >
              <motion.div
                initial={{ scale: 0.65, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.9, ease: "easeInOut" }}
                className="h-16 w-16 rounded-3xl gradient-primary flex items-center justify-center shadow-[var(--shadow-elevated)]"
              >
                {renderIcon("solar:leaf-bold-duotone", { className: "text-[28px] text-primary-foreground" })}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {levelUpOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 grid place-items-center"
          >
            <div className="absolute inset-0 bg-background/80 backdrop-blur" />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  levelUpRarity === "мифический"
                    ? "radial-gradient(800px circle at 50% 35%, rgba(245,158,11,.18), transparent 55%), radial-gradient(700px circle at 20% 60%, rgba(236,72,153,.12), transparent 55%), radial-gradient(650px circle at 80% 65%, rgba(59,130,246,.10), transparent 55%)"
                    : levelUpRarity === "легендарный"
                      ? "radial-gradient(800px circle at 50% 35%, rgba(245,158,11,.16), transparent 55%), radial-gradient(650px circle at 20% 70%, rgba(251,146,60,.10), transparent 55%)"
                      : levelUpRarity === "эпический"
                        ? "radial-gradient(800px circle at 50% 35%, rgba(168,85,247,.16), transparent 55%), radial-gradient(650px circle at 20% 70%, rgba(236,72,153,.10), transparent 55%)"
                        : levelUpRarity === "редкий"
                          ? "radial-gradient(800px circle at 50% 35%, rgba(34,197,94,.14), transparent 55%), radial-gradient(650px circle at 20% 70%, rgba(96,165,250,.10), transparent 55%)"
                          : "radial-gradient(800px circle at 50% 35%, rgba(148,163,184,.10), transparent 55%)",
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className={`relative w-[min(560px,92vw)] overflow-hidden rounded-3xl border border-border/60 bg-card/70 backdrop-blur p-6 shadow-[var(--shadow-elevated)] ${rarityTheme(levelUpRarity).ring}`}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/18 via-transparent to-primary/16" />
              <motion.div
                aria-hidden
                className="pointer-events-none absolute -inset-20 opacity-50"
                animate={{ rotate: [0, 2, -2, 0], scale: [1, 1.02, 1] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  background:
                    levelUpRarity === "мифический"
                      ? "conic-gradient(from 90deg, rgba(245,158,11,.18), rgba(236,72,153,.14), rgba(59,130,246,.12), rgba(245,158,11,.18))"
                      : levelUpRarity === "легендарный"
                        ? "conic-gradient(from 90deg, rgba(245,158,11,.16), rgba(251,146,60,.12), rgba(253,230,138,.10), rgba(245,158,11,.16))"
                        : levelUpRarity === "эпический"
                          ? "conic-gradient(from 90deg, rgba(168,85,247,.16), rgba(236,72,153,.12), rgba(96,165,250,.10), rgba(168,85,247,.16))"
                          : levelUpRarity === "редкий"
                            ? "conic-gradient(from 90deg, rgba(34,197,94,.14), rgba(96,165,250,.10), rgba(52,211,153,.10), rgba(34,197,94,.14))"
                            : "conic-gradient(from 90deg, rgba(148,163,184,.10), rgba(96,165,250,.08), rgba(167,139,250,.08), rgba(148,163,184,.10))",
                  filter: "blur(32px)",
                }}
              />
              <div className="relative text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-muted-foreground">Новый титул</span>
                  <motion.span
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 }}
                    className="text-[10px] px-2 py-1 rounded-full bg-background/40 border border-border/60"
                  >
                    {rarityTheme(levelUpRarity).label}
                  </motion.span>
                </div>
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className={`mt-3 text-3xl sm:text-4xl font-display font-bold tracking-tight ${rarityTheme(levelUpRarity).titleClass}`}
                >
                  {levelUpTitle}
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mt-3 text-sm text-muted-foreground"
                >
                  {levelUpPrevTitle ? `Ты поднялся с титула “${levelUpPrevTitle}”.` : ""}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 18 }}
                  className="mt-5 mx-auto h-16 w-16 rounded-3xl gradient-gold flex items-center justify-center shadow-[var(--shadow-soft)] relative"
                >
                  <motion.div
                    aria-hidden
                    className="absolute -inset-3 rounded-[28px]"
                    animate={{ opacity: [0.2, 0.55, 0.2], scale: [1, 1.06, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      background: `radial-gradient(circle at 50% 50%, ${rarityTheme(levelUpRarity).accent}33, transparent 60%)`,
                      filter: "blur(6px)",
                    }}
                  />
                  <span className="text-3xl">👑</span>
                </motion.div>

                <div className="mt-6">
                  <button
                    className="w-full h-11 rounded-2xl gradient-primary text-primary-foreground font-medium shadow-[var(--shadow-soft)]"
                    onClick={() => setLevelUpOpen(false)}
                  >
                    Продолжить
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mx-auto w-full max-w-6xl px-3 sm:px-4 md:px-6 pt-5 sm:pt-6 pb-24 md:pb-10">
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            style={{ willChange: "opacity" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <MobileBottomNav />
    </div>
  );
}
