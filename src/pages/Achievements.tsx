import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { renderIcon } from "@/lib/icons";

const titleFromXp = (xp: number, isAdmin?: boolean): string => {
  const thresholds = [
    { xp: 0, title: "Новичок" },
    { xp: 30, title: "Любитель" },
    { xp: 150, title: "Знаток" },
    { xp: 300, title: "Мастер" },
    { xp: 800, title: "Гуру" },
    { xp: 1200, title: "Эксперт" },
    { xp: 5000, title: "Легенда" },
    { xp: 10000, title: "Абсолютный чемпион" },
  ];
  if (isAdmin && xp >= 1000000) return "Администратор";
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (xp >= thresholds[i].xp) return thresholds[i].title;
  }
  return thresholds[0].title;
};

const TITLE_THRESHOLDS = [
  { title: "Новичок", xp: 0 },
  { title: "Любитель", xp: 200 },
  { title: "Спортсмен", xp: 800 },
  { title: "Профи", xp: 2500 },
  { title: "Эксперт", xp: 6000 },
  { title: "Легенда", xp: 15000 },
  { title: "Абсолютный чемпион", xp: 30000 },
];

const TITLE_ORDER = [
  "Новичок",
  "Любитель",
  "Спортсмен",
  "Профи",
  "Эксперт",
  "Легенда",
  "Абсолютный чемпион",
];

type Rarity = "обычный" | "редкий" | "эпический" | "легендарный" | "мифический";

function titleRank(title: string | null | undefined) {
  const idx = TITLE_ORDER.findIndex((t) => t === title);
  return idx >= 0 ? idx : 0;
}

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
      return { titleClass: "text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-pink-400", glow: "rgba(245,158,11,.45)" };
    case "легендарный":
      return { titleClass: "text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-red-400", glow: "rgba(168,85,247,.45)" };
    case "эпический":
      return { titleClass: "text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400", glow: "rgba(59,130,246,.45)" };
    case "редкий":
      return { titleClass: "text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-blue-400 to-purple-400", glow: "rgba(34,197,94,.45)" };
    default:
      return { titleClass: "text-transparent bg-clip-text bg-gradient-to-r from-gray-400 via-gray-300 to-gray-200", glow: "rgba(156,163,175,.45)" };
  }
}

function titleTheme(title: string) {
  if (title === "Администратор") {
    return { titleClass: "text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-red-600 to-rose-600", glow: "rgba(239,68,68,.45)" };
  }
  const rank = titleRank(title);
  const rarity = rarityByRank(rank);
  return rarityTheme(rarity);
}

function currentTitleIndexByXp(xp: number) {
  const val = Number.isFinite(xp) ? xp : 0;
  let idx = 0;
  for (let i = 0; i < TITLE_THRESHOLDS.length; i++) {
    if (val >= TITLE_THRESHOLDS[i].xp) idx = i;
  }
  return idx;
}

const anim = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.035 } } },
  item: { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } },
};

const Achievements = () => {
  const { user, profile, isAdmin } = useAuth();
  const [allAchievements, setAllAchievements] = useState<any[]>([]);
  const [userAchievements, setUserAchievements] = useState<Set<string>>(new Set());
  const [earnedDates, setEarnedDates] = useState<Record<string, string>>({});
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [progressAnim, setProgressAnim] = useState(0);
  const [progressKey, setProgressKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const achQ = query(collection(db, "achievements"));
        const achSnap = await getDocs(achQ);
        const rows: any[] = [];
        achSnap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
        setAllAchievements(rows);
      } catch {
        setAllAchievements([]);
      }
    })();

    (async () => {
      if (!user) {
        setUserAchievements(new Set());
        setEarnedDates({});
        return;
      }
      try {
        const uaQ = query(collection(db, "user_achievements"), where("user_id", "==", user.uid));
        const uaSnap = await getDocs(uaQ);
        const earned = new Set<string>();
        const dates: Record<string, string> = {};
        uaSnap.forEach((d) => {
          const data: any = d.data();
          const id = String(data.achievement_id ?? "");
          if (id) earned.add(id);
          if (id && data.earned_at) {
            const ts: any = data.earned_at;
            if (typeof ts?.toDate === "function") {
              dates[id] = ts.toDate().toISOString();
            } else if (typeof ts === "string") {
              dates[id] = ts;
            }
          }
        });
        setUserAchievements(earned);
        setEarnedDates(dates);
      } catch {
        setUserAchievements(new Set());
        setEarnedDates({});
      }
    })();

    (async () => {
      try {
        const lbQ = query(collection(db, "profiles"), orderBy("xp", "desc"), limit(10));
        const lbSnap = await getDocs(lbQ);
        const rows: any[] = [];
        lbSnap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
        setLeaderboard(rows);
      } catch {
        setLeaderboard([]);
      }
    })();
  }, [user?.uid]);

  const currentIdx = currentTitleIndexByXp(Number(profile?.xp ?? 0));
  const currentTitle = titleFromXp(profile?.xp ?? 0, isAdmin);
  const nextTitle = TITLE_THRESHOLDS[Math.min(currentIdx + 1, TITLE_THRESHOLDS.length - 1)];
  const currentTitleData = TITLE_THRESHOLDS[currentIdx];
  const denom = nextTitle.xp - currentTitleData.xp;
  const progressToNext =
    !profile || nextTitle === currentTitleData || denom <= 0
      ? 0
      : Math.max(0, Math.min(100, Math.round(((profile.xp - currentTitleData.xp) / denom) * 100)));

  useEffect(() => {
    if (!profile) return;
    // Animate once per page entry (and when user changes): 0 -> actual.
    setProgressAnim(0);
    setProgressKey((k) => k + 1);
    const t = setTimeout(() => setProgressAnim(progressToNext), 60);
    return () => clearTimeout(t);
  }, [user?.uid, profile?.xp]);

  useEffect(() => {
    if (!profile) return;
    // If XP changes while staying on the page, animate smoothly to new value.
    setProgressAnim(progressToNext);
  }, [progressToNext, profile?.xp]);

  const titleRarity = rarityByRank(titleRank(profile?.title));
  const titleTheme = rarityTheme(titleRarity);

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <motion.div variants={anim.container} initial="hidden" animate="show" className="space-y-8 pb-36 md:pb-24">
      <motion.div variants={anim.item} className="glass-surface rounded-3xl p-4 sm:p-5 overflow-hidden relative">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/12 via-transparent to-primary/10" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Достижения</p>
            <h1 className="mt-2 text-2xl font-display font-bold">Титулы, XP и прогресс</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Открывай достижения, прокачивай титул и поднимайся в рейтинге.
            </p>
          </div>
          <div className="h-11 w-11 rounded-2xl gradient-gold flex items-center justify-center shrink-0">
            {renderIcon("solar:medal-ribbon-star-bold-duotone", { className: "text-[20px] text-primary-foreground" })}
          </div>
        </div>
      </motion.div>

      {/* Current title */}
      <motion.div variants={anim.item} className="text-center">
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.26 }}
          className="inline-flex relative"
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-3 rounded-3xl"
            animate={{ opacity: [0.45, 0.8, 0.45], scale: [1, 1.03, 1] }}
            transition={{ duration: 2.2, repeat: Infinity }}
            style={{
              background:
                "radial-gradient(600px 180px at 50% 50%, hsl(38 92% 55% / 0.20), transparent 60%), radial-gradient(520px 160px at 40% 40%, hsl(162 72% 48% / 0.14), transparent 62%)",
              filter: "blur(10px)",
            }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-1 rounded-3xl"
            animate={{ opacity: [0.2, 0.45, 0.2] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            style={{
              background:
                "linear-gradient(135deg, hsl(38 92% 55% / 0.35), transparent 45%, hsl(162 72% 48% / 0.22))",
            }}
          />

          <div className="relative inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-card border border-border overflow-hidden">
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -left-1/2 top-0 h-full w-[180%] opacity-40"
              animate={{ x: ["-20%", "20%", "-20%"] }}
              transition={{ duration: 4.5, repeat: Infinity }}
              style={{
                background:
                  "linear-gradient(90deg, transparent, hsl(38 92% 55% / 0.28), transparent)",
              }}
            />

            <motion.div
              whileHover={{ scale: 1.04, rotate: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 16 }}
              className="relative h-12 w-12 rounded-2xl gradient-gold flex items-center justify-center shadow-[var(--shadow-soft)]"
            >
              {renderIcon("solar:crown-bold-duotone", { className: "text-[28px] text-primary-foreground" })}
            </motion.div>

            <div className="relative text-left">
              <p className="text-sm text-muted-foreground">Текущий титул</p>
              <p
                className={`text-2xl sm:text-3xl font-display font-bold tracking-tight ${titleTheme.titleClass}`}
                style={{ filter: `drop-shadow(0 0 14px ${titleTheme.glow})` }}
              >
                {profile.title}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {profile.xp} XP
                {nextTitle !== currentTitleData ? ` • до ${nextTitle.title}: ${Math.max(0, nextTitle.xp - profile.xp)} XP` : ""}
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Progress */}
      <motion.div variants={anim.item}>
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between text-sm mb-2">
              <span>{currentTitle}</span>
              <span className="text-muted-foreground">
                {nextTitle === currentTitleData ? `${profile.xp} XP` : `${profile.xp} / ${nextTitle.xp} XP`}
              </span>
              <span>{nextTitle.title}</span>
            </div>
            <div className="relative h-4 rounded-full bg-muted overflow-hidden">
              <motion.div
                key={progressKey}
                className="absolute inset-y-0 left-0 rounded-full gradient-gold"
                initial={{ width: 0 }}
                animate={{ width: `${progressAnim}%` }}
                transition={{ duration: 1.2 }}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Achievements grid */}
      <motion.div variants={anim.item}>
        <h2 className="text-xl font-display font-semibold mb-4">Достижения</h2>
        <Carousel opts={{ align: "start" }} className="relative">
          <CarouselContent>
            {allAchievements.map((a) => {
              const unlocked = userAchievements.has(a.id);
              return (
                <CarouselItem key={a.id} className="sm:basis-1/2 lg:basis-1/3">
                  <motion.div variants={anim.item}>
                    <Card className={`${unlocked ? "achievement-unlocked card-hover" : "achievement-locked"} overflow-hidden`}>
                      <CardContent className="p-4 flex items-start gap-3 relative">
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/10" />
                        {a.image_url ? (
                          <img
                            src={String(a.image_url)}
                            alt={String(a.name ?? "Achievement")}
                            className="h-12 w-12 rounded-xl object-cover relative border border-border/60"
                            loading="lazy"
                          />
                        ) : (
                          <div className="text-3xl relative">{renderIcon(a.icon, { className: "text-[28px]" })}</div>
                        )}
                        <div className="flex-1 relative">
                          <p className="font-medium">{a.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                          <p className="text-xs mt-1">+{a.xp_reward} XP</p>
                          {unlocked && earnedDates[a.id] && (
                            <p className="text-xs text-primary mt-1">✓ {new Date(earnedDates[a.id]).toLocaleDateString("ru")}</p>
                          )}
                          {!unlocked && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              {renderIcon("solar:lock-keyhole-bold-duotone", { className: "text-[14px]" })} Заблокировано
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      </motion.div>

      {/* Leaderboard */}
      <motion.div variants={anim.item}>
        <h2 className="text-xl font-display font-semibold mb-4">Рейтинг</h2>
        <Card>
          <CardContent className="p-0">
            {leaderboard.map((u, i) => (
              <div
                key={u.user_id}
                className={`flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 ${
                  (u.user_id ?? u.id) === user?.uid ? "bg-primary/5" : ""
                }`}
              >
                <span className={`text-lg font-display font-bold w-8 ${i < 3 ? "text-accent" : "text-muted-foreground"}`}>#{i + 1}</span>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {u.display_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-sm">{u.display_name}</p>
                  <p className="text-xs text-muted-foreground">{u.title} • {u.total_days} дн.</p>
                </div>
                <span className="text-sm font-medium">{u.xp} XP</span>
              </div>
            ))}
            {leaderboard.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Пока нет участников</p>}
          </CardContent>
        </Card>
      </motion.div>

      <div className="fixed left-0 right-0 z-40 bottom-20 md:bottom-6">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 md:px-6">
          <div className="glass-surface elevated border border-border/60 rounded-2xl p-3">
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex h-10 w-10 rounded-2xl bg-card/60 border border-border/60 backdrop-blur items-center justify-center">
                {renderIcon("solar:crown-bold-duotone", { className: "text-[20px] text-accent" })}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Следующий титул</p>
                <p className="text-sm font-medium truncate">
                  {nextTitle.title} • прогресс {progressToNext}%
                </p>
              </div>

              <Button variant="hero" className="h-11 px-4 rounded-xl" asChild>
                <Link to="/diary">Продолжить</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Achievements;
