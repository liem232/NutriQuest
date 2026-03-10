import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, TrendingUp, Star, ChevronRight, Zap, Trophy, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { checkAndUpdateStreak, getRecommendations } from "@/lib/gamification";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageBanner } from "@/components/PageBanner";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const anim = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.04 } } },
  item: { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } },
};

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

function titleTheme(title: string) {
  if (title === "Администратор") {
    return { titleClass: "text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-red-600 to-rose-600", glow: "rgba(239,68,68,.45)" };
  }
  const rank = titleRank(title);
  const rarity = rarityByRank(rank);
  return rarityTheme(rarity);
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
      return { titleClass: "text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-orange-400", glow: "rgba(245,158,11,.4)" };
    case "эпический":
      return { titleClass: "text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-purple-400 to-sky-400", glow: "rgba(168,85,247,.45)" };
    case "редкий":
      return { titleClass: "text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-green-400 to-cyan-300", glow: "rgba(34,197,94,.4)" };
    default:
      return { titleClass: "text-accent", glow: "rgba(148,163,184,.25)" };
  }
}

const Dashboard = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [todayData, setTodayData] = useState({ calories: 0, protein: 0, fat: 0, carbs: 0 });
  const [weekData, setWeekData] = useState<{ day: string; pct: number }[]>([]);
  const [monthData, setMonthData] = useState<{ day: number; cal: number }[]>([]);
  const [recentAchievements, setRecentAchievements] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedRec, setSelectedRec] = useState<any>(null);
  const [fact, setFact] = useState<string>("");
  const [selectedTip, setSelectedTip] = useState<any>(null);

  useEffect(() => {
    if (!user || !profile) return;

    const facts = [
      "Белок лучше усваивается, если распределить его равномерно по приёмам пищи.",
      "Даже 10 минут ходьбы после еды помогают сгладить скачок сахара в крови.",
      "Клетчатка — это не про «диету», а про стабильную энергию и сытость.",
      "Сон влияет на аппетит: недосып повышает тягу к сладкому.",
      "Вода не «сжигает» жир, но помогает контролировать чувство голода.",
      "Норма — это коридор. Важнее тренд за неделю, чем один день.",
    ];
    const todayKey = new Date().toISOString().slice(0, 10);
    const factIdx = Math.abs(
      (user.uid + todayKey)
        .split("")
        .reduce((s, ch) => s + ch.charCodeAt(0), 0)
    ) % facts.length;
    const picked = facts[factIdx];
    setFact(picked);

    const toastKey = `cc_fact_shown_${todayKey}`;
    if (typeof window !== "undefined" && !sessionStorage.getItem(toastKey)) {
      sessionStorage.setItem(toastKey, "1");
      toast({
        title: `С возвращением, ${profile.display_name}!`,
        description: picked,
      });
    }

    checkAndUpdateStreak(user.uid)
      .then(() => refreshProfile())
      .catch(() => {
        // ignore
      });

    // Fetch today's data
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      try {
        const q = query(
          collection(db, "food_diary"),
          where("user_id", "==", user.uid),
          where("date", "==", today)
        );
        const snap = await getDocs(q);
        let cal = 0,
          p = 0,
          f = 0,
          c = 0;
        snap.forEach((docSnap) => {
          const entry: any = docSnap.data();
          const grams = Number(entry.grams ?? 0);
          const product = entry.product ?? entry.products ?? entry.product_snapshot ?? {};
          const mult = grams / 100;
          cal += Number(product.calories_per_100g ?? 0) * mult;
          p += Number(product.protein_per_100g ?? 0) * mult;
          f += Number(product.fat_per_100g ?? 0) * mult;
          c += Number(product.carbs_per_100g ?? 0) * mult;
        });
        setTodayData({
          calories: Math.round(cal),
          protein: Math.round(p),
          fat: Math.round(f),
          carbs: Math.round(c),
        });
        const recs = getRecommendations(profile as any, Math.round(p), Math.round(f), Math.round(c), Math.round(cal));
        setRecommendations(recs);
      } catch {
        setTodayData({ calories: 0, protein: 0, fat: 0, carbs: 0 });
        const recs = getRecommendations(profile as any, 0, 0, 0, 0);
        setRecommendations(recs);
      }
    })();

    // Week data
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });

    Promise.all(
      weekDays.map(async (date) => {
        try {
          const q = query(
            collection(db, "food_diary"),
            where("user_id", "==", user.uid),
            where("date", "==", date)
          );
          const snap = await getDocs(q);
          let total = 0;
          snap.forEach((docSnap) => {
            const e: any = docSnap.data();
            const grams = Number(e.grams ?? 0);
            const product = e.product ?? e.products ?? e.product_snapshot ?? {};
            total += (grams / 100) * Number(product.calories_per_100g ?? 0);
          });
          return {
            day: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"][
              new Date(date).getDay() === 0 ? 6 : new Date(date).getDay() - 1
            ],
            pct: Math.min(100, Math.round((total / ((profile as any).daily_calories || 2200)) * 100)),
          };
        } catch {
          return {
            day: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"][
              new Date(date).getDay() === 0 ? 6 : new Date(date).getDay() - 1
            ],
            pct: 0,
          };
        }
      })
    ).then(setWeekData);

    // Month data
    const monthDays = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().slice(0, 10);
    });

    Promise.all(
      monthDays.map(async (date, i) => {
        try {
          const q = query(
            collection(db, "food_diary"),
            where("user_id", "==", user.uid),
            where("date", "==", date)
          );
          const snap = await getDocs(q);
          let total = 0;
          snap.forEach((docSnap) => {
            const e: any = docSnap.data();
            const grams = Number(e.grams ?? 0);
            const product = e.product ?? e.products ?? e.product_snapshot ?? {};
            total += (grams / 100) * Number(product.calories_per_100g ?? 0);
          });
          return { day: i + 1, cal: Math.round(total) };
        } catch {
          return { day: i + 1, cal: 0 };
        }
      })
    ).then(setMonthData);

    // Recent achievements
    (async () => {
      try {
        const [uaSnap, achSnap] = await Promise.all([
          getDocs(query(collection(db, "user_achievements"), where("user_id", "==", user.uid), limit(50))),
          getDocs(query(collection(db, "achievements"))),
        ]);

        const achById = new Map<string, any>();
        achSnap.forEach((d) => achById.set(d.id, { id: d.id, ...d.data() }));

        const rows = uaSnap.docs.map((d) => {
          const data: any = d.data();
          const aid = String(data.achievement_id ?? "");
          const meta = achById.get(aid) ?? null;
          return { id: d.id, ...data, achievement: meta };
        });

        rows.sort((a: any, b: any) => {
          const aT = (a.earned_at?.toMillis?.() ?? 0) as number;
          const bT = (b.earned_at?.toMillis?.() ?? 0) as number;
          return bT - aT;
        });

        setRecentAchievements(rows.slice(0, 3));
      } catch {
        setRecentAchievements([]);
      }
    })();
  }, [user?.uid, (profile as any)?.user_id]);

  if (!profile) return null;

  const titleRarity = rarityByRank(titleRank(profile.title));
  const titleThemeValue = titleTheme(profile.title ?? "Новичок");

  const goal = profile.daily_calories || 2200;
  const pct = Math.min(100, Math.round((todayData.calories / goal) * 100));
  const weekAvg = weekData.length ? Math.round(weekData.reduce((s, d) => s + d.pct, 0) / weekData.filter(d => d.pct > 0).length || 1) : 0;

  const bju = [
    { name: "Белки", value: todayData.protein || 1, color: "hsl(210 80% 55%)" },
    { name: "Жиры", value: todayData.fat || 1, color: "hsl(38 92% 55%)" },
    { name: "Углеводы", value: todayData.carbs || 1, color: "hsl(152 68% 45%)" },
  ];

  const insightCards = [
    {
      title: "Калории",
      value: `${todayData.calories} / ${goal}`,
      meta: `${pct}% от нормы`,
      accent: "from-emerald-500/18 via-sky-500/10 to-transparent",
      href: "/diary",
      icon: <Flame className="h-5 w-5 text-foreground" />,
    },
    {
      title: "Серия дней",
      value: `${profile.streak_days} 🔥`,
      meta: "Не сбивай темп", 
      accent: "from-amber-500/18 via-emerald-500/10 to-transparent",
      href: "/achievements",
      icon: <Zap className="h-5 w-5 text-foreground" />,
    },
    {
      title: "Титул",
      value: profile.title,
      meta: `${profile.xp} XP`,
      accent: "from-violet-500/18 via-amber-500/10 to-transparent",
      href: "/achievements",
      icon: <Trophy className="h-5 w-5 text-foreground" />,
    },
    {
      title: "Каталог",
      value: "Найди продукт",
      meta: "Или добавь свой", 
      accent: "from-sky-500/18 via-emerald-500/10 to-transparent",
      href: "/products",
      icon: <Search className="h-5 w-5 text-foreground" />,
    },
  ];

  const tips = [
    {
      title: "Тарелка без перегруза",
      badge: "База",
      accent: "from-emerald-500/16 via-amber-500/10 to-transparent",
      desc: "Собери тарелку: 1/2 овощи, 1/4 белок, 1/4 сложные углеводы.",
      details:
        "Быстрый ориентир без подсчётов: овощи дают объём и сытость, белок поддерживает мышцы, сложные углеводы — энергию. Добавь 1–2 ч.л. жиров (оливковое масло/орехи), чтобы вкус и насыщение были лучше.",
      icon: "🥗",
    },
    {
      title: "Белок — равномерно",
      badge: "Мышцы",
      accent: "from-sky-500/16 via-emerald-500/10 to-transparent",
      desc: "Раздели белок на 3–4 приёма — так легче добирать норму.",
      details:
        "Практика: добавь белковый якорь к каждому приёму пищи (йогурт/творог, яйца, курица/рыба, бобовые). Это снижает тягу к сладкому и помогает восстановлению.",
      icon: "🍗",
    },
    {
      title: "Сладкое без откатов",
      badge: "Баланс",
      accent: "from-amber-500/16 via-violet-500/10 to-transparent",
      desc: "Если хочется сладкого — сначала белок/клетчатка, потом десерт.",
      details:
        "Лайфхак: десерт после основного приёма пищи обычно даёт меньший скачок сахара. Альтернатива: фрукт + йогурт/творог.",
      icon: "🍫",
    },
    {
      title: "Шаги после еды",
      badge: "Энергия",
      accent: "from-emerald-500/16 via-sky-500/10 to-transparent",
      desc: "10 минут прогулки после еды — простая «суперсила».",
      details:
        "Не нужно кардио: лёгкая ходьба помогает пищеварению и управлению энергией. Особенно полезно после плотного ужина.",
      icon: "🚶‍♂️",
    },
  ];

  return (
    <motion.div variants={anim.container} initial="hidden" animate="show" className="space-y-6 pb-36 md:pb-24">
      <motion.div variants={anim.item} className="flex items-center gap-3">
        <div>
          <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">Привет, {profile.display_name}! 👋</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm bg-accent/20 text-accent px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <Star className="h-3 w-3" />
              <span
                className={titleThemeValue.titleClass}
                style={{ filter: `drop-shadow(0 0 10px ${titleThemeValue.glow})` }}
              >
                {profile.title}
              </span>
            </span>
            <span className="text-sm text-muted-foreground">{profile.xp} XP • {profile.streak_days} 🔥</span>
          </div>
          {fact && (
            <div className="mt-3 inline-flex items-start gap-2 rounded-2xl border border-border/60 bg-card/60 backdrop-blur px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">Факт дня</span>
              <span className="text-xs text-foreground/90">{fact}</span>
            </div>
          )}
        </div>
      </motion.div>

      <motion.div variants={anim.item}>
        <PageBanner
          eyebrow="Сегодня"
          title="Фокус дня"
          description="Доведи день до красивого результата: следи за нормой и сохрани streak. Всё под рукой."
          icon={<Flame className="h-5 w-5 text-primary-foreground" />}
        />
      </motion.div>

      <motion.div variants={anim.item}>
        <Carousel opts={{ align: "start", loop: true }} className="relative">
          <CarouselContent>
            {insightCards.map((c) => (
              <CarouselItem key={c.title} className="sm:basis-1/2 lg:basis-1/3">
                <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 320, damping: 18 }}>
                  <Card className="card-hover overflow-hidden">
                  <CardContent className="p-4 relative">
                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${c.accent}`} />
                    <div className="relative">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">{c.title}</p>
                          <p className="mt-2 font-display font-bold text-lg truncate">{c.value}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{c.meta}</p>
                        </div>
                        <div className="h-10 w-10 rounded-2xl bg-card/60 border border-border/60 backdrop-blur flex items-center justify-center shrink-0">
                          {c.icon}
                        </div>
                      </div>
                      <div className="mt-4">
                        <Button variant="outline" className="w-full bg-card/60 backdrop-blur border-border/60" asChild>
                          <Link to={c.href}>Открыть</Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                  </Card>
                </motion.div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden lg:flex -left-10 bg-card/70 border-border/60 backdrop-blur" />
          <CarouselNext className="hidden lg:flex -right-10 bg-card/70 border-border/60 backdrop-blur" />
        </Carousel>
      </motion.div>

      <motion.div variants={anim.item}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-display font-semibold">Советы по питанию</h2>
          <span className="text-xs text-muted-foreground">Нажми на карточку</span>
        </div>
        <Carousel opts={{ align: "start", loop: true }} className="relative">
          <CarouselContent>
            {tips.map((t) => (
              <CarouselItem key={t.title} className="sm:basis-1/2 lg:basis-1/3">
                <motion.div
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 320, damping: 18 }}
                  onClick={() => setSelectedTip(t)}
                  className="cursor-pointer"
                >
                  <Card className="card-hover overflow-hidden">
                    <CardContent className="p-4 relative">
                      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${t.accent}`} />
                      <div className="relative">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">{t.badge}</p>
                            <p className="mt-2 font-display font-bold text-lg truncate">{t.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.desc}</p>
                          </div>
                          <div className="h-10 w-10 rounded-2xl bg-card/60 border border-border/60 backdrop-blur flex items-center justify-center shrink-0">
                            <span className="text-lg">{t.icon}</span>
                          </div>
                        </div>
                        <div className="mt-4">
                          <Button variant="outline" className="w-full bg-card/60 backdrop-blur border-border/60">Подробнее</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden lg:flex -left-10 bg-card/70 border-border/60 backdrop-blur" />
          <CarouselNext className="hidden lg:flex -right-10 bg-card/70 border-border/60 backdrop-blur" />
        </Carousel>
      </motion.div>

      {/* Today + BJU */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div variants={anim.item} className="lg:col-span-2">
          <Card className="card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Flame className="h-5 w-5 text-primary" /> Сегодня
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-4xl font-display font-bold">{todayData.calories}</p>
                  <p className="text-muted-foreground text-sm">из {goal} ккал</p>
                </div>
                <p className="text-3xl font-display font-bold text-primary">{pct}%</p>
              </div>
              <div className="relative h-4 rounded-full bg-muted overflow-hidden">
                <motion.div className="absolute inset-y-0 left-0 rounded-full gradient-primary" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1 }} />
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="font-medium">{todayData.protein}г <span className="text-xs text-muted-foreground">/ {profile.protein_goal}</span></p>
                  <p className="text-muted-foreground text-xs">Белки</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="font-medium">{todayData.fat}г <span className="text-xs text-muted-foreground">/ {profile.fat_goal}</span></p>
                  <p className="text-muted-foreground text-xs">Жиры</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="font-medium">{todayData.carbs}г <span className="text-xs text-muted-foreground">/ {profile.carbs_goal}</span></p>
                  <p className="text-muted-foreground text-xs">Углеводы</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={anim.item}>
          <Card className="card-hover h-full">
            <CardHeader className="pb-2"><CardTitle className="text-lg">БЖУ</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={bju} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" strokeWidth={0}>
                    {bju.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Week */}
      <motion.div variants={anim.item}>
        <Card className="card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-lg">
              <span className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Неделя</span>
              <span className="text-sm text-muted-foreground">Средний: {weekAvg}%</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {weekData.map((d) => (
              <div key={d.day} className="flex items-center gap-3">
                <span className="text-sm w-6 text-muted-foreground">{d.day}</span>
                <div className="flex-1 relative h-3 rounded-full bg-muted overflow-hidden">
                  <motion.div className="absolute inset-y-0 left-0 rounded-full gradient-primary" initial={{ width: 0 }} animate={{ width: `${d.pct}%` }} transition={{ duration: 0.8 }} />
                </div>
                <span className="text-sm font-medium w-10 text-right">{d.pct}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Month */}
      <motion.div variants={anim.item}>
        <Card className="card-hover">
          <CardHeader className="pb-2"><CardTitle className="text-lg">Месяц</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 90%)" />
                <XAxis dataKey="day" fontSize={12} /><YAxis fontSize={12} /><Tooltip />
                <Line type="monotone" dataKey="cal" stroke="hsl(152 68% 45%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <motion.div variants={anim.item}>
          <h2 className="text-lg font-display font-semibold mb-3">Рекомендации</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {recommendations.map((r, i) => (
              <Card key={i} className="card-hover min-w-[200px] cursor-pointer shrink-0" onClick={() => setSelectedRec(r)}>
                <CardContent className="p-4">
                  <span className="text-2xl">{r.icon}</span>
                  <p className="font-medium mt-2 text-sm">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Rec modal */}
      <Dialog open={!!selectedRec} onOpenChange={() => setSelectedRec(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{selectedRec?.icon}</span> {selectedRec?.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{selectedRec?.desc}</p>
          {selectedRec?.products?.length > 0 && (
            <div>
              <p className="font-medium text-sm mt-2 mb-1">Рекомендуемые продукты:</p>
              <ul className="text-sm space-y-1">
                {selectedRec?.products.map((p: string) => <li key={p}>• {p}</li>)}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTip} onOpenChange={() => setSelectedTip(null)}>
        <DialogContent className="left-0 right-0 top-auto bottom-24 md:bottom-8 translate-x-0 translate-y-0 mx-auto w-[calc(100%-1.5rem)] max-w-md rounded-2xl p-5 data-[state=closed]:slide-out-to-bottom-6 data-[state=open]:slide-in-from-bottom-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{selectedTip?.icon}</span> {selectedTip?.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{selectedTip?.details}</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" asChild>
              <Link to="/diary">Перейти в дневник</Link>
            </Button>
            <Button variant="hero" asChild>
              <Link to="/products">Подобрать продукты</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recent achievements */}
      <motion.div variants={anim.item}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-display font-semibold">Последние достижения</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/achievements">Все <ChevronRight className="h-4 w-4 ml-1" /></Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {recentAchievements.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-3">Пока нет достижений. Начните заполнять дневник!</p>
          ) : (
            recentAchievements.map((a) => (
              <Card key={a.id} className="card-hover">
                <CardContent className="p-4 flex items-center gap-3">
                  <span className="text-3xl">{a.achievement?.image_url ? "🖼️" : (a.achievement?.icon ?? "🏆")}</span>
                  <div>
                    <p className="font-medium text-sm">{a.achievement?.name ?? "Достижение"}</p>
                    <p className="text-xs text-muted-foreground">
                      {typeof a.earned_at?.toDate === "function"
                        ? a.earned_at.toDate().toLocaleDateString("ru")
                        : ""}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </motion.div>

      <div className="fixed left-0 right-0 z-40 bottom-20 md:bottom-6">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 md:px-6">
          <div className="glass-surface elevated border border-border/60 rounded-2xl p-3">
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex h-10 w-10 rounded-2xl bg-card/60 border border-border/60 backdrop-blur items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Сегодня</p>
                <p className="text-sm font-medium truncate">
                  {todayData.calories} / {goal} ккал • {pct}% • среднее недели {weekAvg}%
                </p>
              </div>

              <Button variant="hero" className="h-11 px-4 rounded-xl" asChild>
                <Link to="/diary">Добавить еду</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
