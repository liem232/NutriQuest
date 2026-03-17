import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { renderIcon } from "@/lib/icons";
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
  container: { hidden: {}, show: { transition: { staggerChildren: 0.035 } } },
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
      } catch (err) {
        console.error("[Dashboard] food_diary today query failed:", err);
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
        } catch (err) {
          console.error("[Dashboard] food_diary week query failed:", err);
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
        } catch (err) {
          console.error("[Dashboard] food_diary month query failed:", err);
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
      } catch (err) {
        console.error("[Dashboard] user_achievements query failed:", err);
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
    { name: "Б", value: todayData.protein || 1, color: "hsl(210 80% 55%)" },
    { name: "Ж", value: todayData.fat || 1, color: "hsl(38 92% 55%)" },
    { name: "У", value: todayData.carbs || 1, color: "hsl(152 68% 45%)" },
  ];

  const tips = [
    {
      title: "Тарелка без перегруза",
      badge: "База",
      accent: "from-emerald-500/16 via-amber-500/10 to-transparent",
      desc: "Собери тарелку: 1/2 овощи, 1/4 белок, 1/4 сложные углеводы.",
      details:
        "Быстрый ориентир без подсчётов: овощи дают объём и сытость, белок поддерживает мышцы, сложные углеводы — энергию. Добавь 1–2 ч.л. жиров (оливковое масло/орехи), чтобы вкус и насыщение были лучше.",
      icon: "mdi:bowl-mix-outline",
    },
    {
      title: "Белок — равномерно",
      badge: "Мышцы",
      accent: "from-sky-500/16 via-emerald-500/10 to-transparent",
      desc: "Раздели белок на 3–4 приёма — так легче добирать норму.",
      details:
        "Практика: добавь белковый якорь к каждому приёму пищи (йогурт/творог, яйца, курица/рыба, бобовые). Это снижает тягу к сладкому и помогает восстановлению.",
      icon: "mdi:food-drumstick-outline",
    },
    {
      title: "Сладкое без откатов",
      badge: "Баланс",
      accent: "from-amber-500/16 via-violet-500/10 to-transparent",
      desc: "Если хочется сладкого — сначала белок/клетчатка, потом десерт.",
      details:
        "Лайфхак: десерт после основного приёма пищи обычно даёт меньший скачок сахара. Альтернатива: фрукт + йогурт/творог.",
      icon: "mdi:candy-outline",
    },
    {
      title: "Шаги после еды",
      badge: "Энергия",
      accent: "from-emerald-500/16 via-sky-500/10 to-transparent",
      desc: "10 минут прогулки после еды — простая «суперсила».",
      details:
        "Не нужно кардио: лёгкая ходьба помогает пищеварению и управлению энергией. Особенно полезно после плотного ужина.",
      icon: "mdi:walk",
    },
  ];

  return (
    <motion.div variants={anim.container} initial="hidden" animate="show" className="space-y-6 pb-36 md:pb-24">
      <motion.div variants={anim.item} className="flex items-center gap-3">
        <div>
          <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">Привет, {profile.display_name}!</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm bg-accent/20 text-accent px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              {renderIcon("solar:star-bold-duotone", { className: "text-[14px]" })}
              <span
                className={titleThemeValue.titleClass}
                style={{ filter: `drop-shadow(0 0 10px ${titleThemeValue.glow})` }}
              >
                {profile.title}
              </span>
            </span>
            <span className="text-sm text-muted-foreground">{profile.xp} XP • {profile.streak_days}</span>
          </div>
          {fact && (
            <div className="mt-3 inline-flex items-start gap-2 rounded-2xl border border-border/60 bg-card/60 backdrop-blur px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">Факт дня</span>
              <span className="text-xs text-foreground/90">{fact}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Советы - компактный слайдер с явными стрелками */}
      <motion.div variants={anim.item} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-display font-semibold">Советы по питанию</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">{tips.length} шт.</span>
        </div>
        <Carousel opts={{ align: "start", loop: true }} className="relative">
          <CarouselContent>
            {tips.map((t) => (
              <CarouselItem key={t.title} className="basis-full sm:basis-1/2 lg:basis-1/3">
                <Card 
                  className="card-hover overflow-hidden border-l-4 border-l-primary cursor-pointer h-full" 
                  onClick={() => setSelectedTip(t)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        {renderIcon(t.icon, { className: "text-lg" })}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{t.title}</p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="flex justify-center gap-2 mt-3">
            <CarouselPrevious className="static translate-y-0 bg-card border-border h-9 w-9" />
            <CarouselNext className="static translate-y-0 bg-card border-border h-9 w-9" />
          </div>
        </Carousel>
      </motion.div>

      {/* Today + БЖУ */}
      <div>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {renderIcon("solar:fire-bold-duotone", { className: "text-[18px] text-primary" })}
                <span className="font-medium">Сегодня</span>
              </div>
              <span className="text-sm text-muted-foreground">{todayData.calories} / {goal} ккал</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative h-3 flex-1 rounded-full bg-muted overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full gradient-primary" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xl font-bold text-primary w-12 text-right">{pct}%</span>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-border/50">
              <div className="text-center">
                <p className="text-lg font-bold">{todayData.protein}</p>
                <p className="text-[10px] text-muted-foreground">Белки</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">{todayData.fat}</p>
                <p className="text-[10px] text-muted-foreground">Жиры</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">{todayData.carbs}</p>
                <p className="text-[10px] text-muted-foreground">Углев</p>
              </div>
              <div className="text-center">
                <div className="h-10 w-10 mx-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={bju} cx="50%" cy="50%" innerRadius={15} outerRadius={20} paddingAngle={2} dataKey="value" strokeWidth={0}>
                        {bju.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Week */}
      <div>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {renderIcon("solar:graph-up-bold-duotone", { className: "text-[16px] text-primary" })}
                <span className="text-sm font-medium">Неделя</span>
              </div>
              <span className="text-xs text-muted-foreground">ср. {weekAvg}%</span>
            </div>
            <div className="flex items-end gap-1 h-16">
              {weekData.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-muted rounded-t-sm relative overflow-hidden" style={{ height: `${Math.max(4, d.pct * 0.6)}px` }}>
                    <div className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-sm" style={{ height: `${d.pct}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Month */}
      <div>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              {renderIcon("solar:chart-square-bold-duotone", { className: "text-[16px] text-primary" })}
              <span className="text-sm font-medium">Месяц</span>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={monthData}>
                <Line type="monotone" dataKey="cal" stroke="hsl(152 68% 45%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-display font-semibold">Рекомендации</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {recommendations.map((r, i) => (
              <Card key={i} className="min-w-[260px] cursor-pointer shrink-0 border-l-4 border-l-primary" onClick={() => setSelectedRec(r)}>
                <CardContent className="p-4">
                  <p className="font-medium text-sm">{r.title}</p>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{r.desc}</p>
                  {r.products.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-border/50">
                      <p className="text-xs text-muted-foreground">{r.products.slice(0, 3).join(" • ")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Rec modal */}
      <Dialog open={!!selectedRec} onOpenChange={() => setSelectedRec(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {renderIcon(selectedRec?.icon, { className: "text-2xl" })} {selectedRec?.title}
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
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {renderIcon(selectedTip?.icon, { className: "text-2xl" })} {selectedTip?.title}
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
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-display font-semibold">Последние достижения</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/achievements">Все <span className="ml-1">{renderIcon("solar:alt-arrow-right-bold-duotone", { className: "text-[18px]" })}</span></Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {recentAchievements.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-3">Пока нет достижений. Начните заполнять дневник!</p>
          ) : (
            recentAchievements.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  {a.achievement?.name.includes("Первый") ? (
                    <div className="text-3xl">{renderIcon("solar:footprints-bold-duotone", { className: "text-[26px] text-green-500" })}</div>
                  ) : a.achievement?.name.includes("Неделя") ? (
                    <div className="text-3xl">{renderIcon("solar:fire-bold-duotone", { className: "text-[26px] text-orange-500" })}</div>
                  ) : a.achievement?.name.includes("Две недели") ? (
                    <div className="text-3xl">{renderIcon("solar:bolt-bold-duotone", { className: "text-[26px] text-yellow-500" })}</div>
                  ) : a.achievement?.name.includes("Месяц") ? (
                    <div className="text-3xl">{renderIcon("solar:medal-ribbon-bold-duotone", { className: "text-[26px] text-purple-500" })}</div>
                  ) : a.achievement?.name.includes("Сотка") ? (
                    <div className="text-3xl">{renderIcon("solar:medal-bold-duotone", { className: "text-[26px] text-blue-500" })}</div>
                  ) : a.achievement?.name.includes("Год") ? (
                    <div className="text-3xl">{renderIcon("solar:trophy-bold-duotone", { className: "text-[26px] text-amber-500" })}</div>
                  ) : a.achievement?.name.includes("Белковый") ? (
                    <div className="text-3xl">{renderIcon("solar:bone-bold-duotone", { className: "text-[26px] text-red-500" })}</div>
                  ) : a.achievement?.name.includes("Балансир") ? (
                    <div className="text-3xl">{renderIcon("solar:scale-bold-duotone", { className: "text-[26px] text-cyan-500" })}</div>
                  ) : a.achievement?.name.includes("Коллекционер") ? (
                    <div className="text-3xl">{renderIcon("solar:box-minimalistic-bold-duotone", { className: "text-[26px] text-indigo-500" })}</div>
                  ) : a.achievement?.name.includes("Шеф-повар") ? (
                    <div className="text-3xl">{renderIcon("solar:chef-hat-bold-duotone", { className: "text-[26px] text-pink-500" })}</div>
                  ) : a.achievement?.name.includes("Лаборатория") ? (
                    <div className="text-3xl">{renderIcon("solar:test-tube-bold-duotone", { className: "text-[26px] text-teal-500" })}</div>
                  ) : (
                    <div className="text-3xl">{renderIcon("solar:star-bold-duotone", { className: "text-[26px] text-primary" })}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{a.achievement?.name ?? "Достижение"}</p>
                    <p className="text-xs text-muted-foreground">
                      +{a.achievement?.xp_reward ?? 0} XP
                    </p>
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
      </div>

      <div className="fixed left-0 right-0 z-40 bottom-20 md:bottom-6">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 md:px-6">
          <div className="glass-surface elevated border border-border/60 rounded-2xl p-3">
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex h-10 w-10 rounded-2xl bg-card/60 border border-border/60 backdrop-blur items-center justify-center">
                {renderIcon("solar:graph-up-bold-duotone", { className: "text-[20px] text-primary" })}
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
