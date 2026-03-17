import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { checkAndUpdateStreak } from "@/lib/gamification";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { PageBanner } from "@/components/PageBanner";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { renderIcon } from "@/lib/icons";

type DiaryEntry = {
  id: string;
  product_id: string;
  meal: string;
  grams: number;
  product_name: string;
  cal_per_100: number;
  p_per_100: number;
  f_per_100: number;
  c_per_100: number;
};

const mealLabels: Record<string, { label: string; icon: string }> = {
  breakfast: { label: "Завтрак", icon: "solar:sunrise-bold-duotone" },
  lunch: { label: "Обед", icon: "solar:sun-2-bold-duotone" },
  dinner: { label: "Ужин", icon: "solar:moon-bold-duotone" },
  snack: { label: "Перекус", icon: "solar:apple-bold-duotone" },
};

const Diary = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [approvedProducts, setApprovedProducts] = useState<any[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [currentMeal, setCurrentMeal] = useState("breakfast");

  useEffect(() => {
    (async () => {
      try {
        let snap;
        try {
          const qApproved = query(collection(db, "products"), where("is_approved", "==", true), limit(500));
          snap = await getDocs(qApproved);
        } catch {
          // Fallback (e.g. security rules): load limited list and filter client-side
          snap = await getDocs(query(collection(db, "products"), limit(500)));
        }

        const rows: any[] = [];
        snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
        const filtered = rows.filter((p) => (p.is_approved ?? true) === true);
        filtered.sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "ru"));
        setApprovedProducts(filtered);
      } catch (e: any) {
        setApprovedProducts([]);
        toast({ variant: "destructive", title: "Не удалось загрузить продукты", description: e?.message ?? "Ошибка" });
      } finally {
        setProductsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      return;
    }

    const q = query(
      collection(db, "food_diary"),
      where("user_id", "==", user.uid),
      where("date", "==", selectedDate)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: DiaryEntry[] = [];
        snap.forEach((d) => {
          const data: any = d.data();
          const product = data.product ?? data.product_snapshot ?? {};
          rows.push({
            id: d.id,
            product_id: String(data.product_id ?? ""),
            meal: String(data.meal ?? "breakfast"),
            grams: Number(data.grams ?? 0),
            product_name: String(product.name ?? ""),
            cal_per_100: Number(product.calories_per_100g ?? 0),
            p_per_100: Number(product.protein_per_100g ?? 0),
            f_per_100: Number(product.fat_per_100g ?? 0),
            c_per_100: Number(product.carbs_per_100g ?? 0),
          });
        });
        setEntries(rows);
      },
      () => setEntries([])
    );

    return () => unsub();
  }, [user?.uid, selectedDate]);

  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    const timeout = setTimeout(async () => {
      try {
        if (!productsLoaded) {
          setSearchResults([]);
          return;
        }
        const qLower = searchQ.toLowerCase();
        const rows = approvedProducts
          .filter((p) => String(p.name ?? "").toLowerCase().includes(qLower))
          .slice(0, 15);
        setSearchResults(rows);
      } catch (e: any) {
        setSearchResults([]);
        toast({ variant: "destructive", title: "Поиск не работает", description: e?.message ?? "Ошибка" });
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQ, approvedProducts, productsLoaded]);

  const addProduct = async (productId: string) => {
    if (!user) return;
    try {
      const productSnap = await getDoc(doc(db, "products", productId));
      if (!productSnap.exists()) {
        toast({ variant: "destructive", title: "Продукт не найден" });
        return;
      }
      const p: any = productSnap.data();
      await addDoc(collection(db, "food_diary"), {
        user_id: user.uid,
        product_id: productId,
        meal: currentMeal,
        grams: 100,
        date: selectedDate,
        product: {
          name: p.name ?? "",
          calories_per_100g: p.calories_per_100g ?? 0,
          protein_per_100g: p.protein_per_100g ?? 0,
          fat_per_100g: p.fat_per_100g ?? 0,
          carbs_per_100g: p.carbs_per_100g ?? 0,
        },
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message ?? "Ошибка" });
      return;
    }
    setAddDialogOpen(false);
    setSearchQ("");
    void checkAndUpdateStreak(user.uid).catch(() => {
      // ignore
    });
    toast({ title: "Продукт добавлен!" });
  };

  const mealTemplates: Record<string, { title: string; items: { name: string; grams: number }[] }[]> = {
    breakfast: [
      { title: "Яичница", items: [{ name: "Яйцо куриное", grams: 200 }, { name: "Сливочное масло", grams: 10 }, { name: "Помидор", grams: 120 }] },
      { title: "Овсянка", items: [{ name: "Овсянка (сухая)", grams: 60 }, { name: "Молоко 2.5%", grams: 200 }, { name: "Банан", grams: 100 }] },
    ],
    lunch: [
      { title: "Курица + гречка", items: [{ name: "Куриная грудка", grams: 180 }, { name: "Гречка (сухая)", grams: 70 }, { name: "Огурец", grams: 150 }] },
    ],
    dinner: [
      { title: "Лосось + овощи", items: [{ name: "Лосось", grams: 160 }, { name: "Брокколи", grams: 200 }] },
      { title: "Треска + картофель", items: [{ name: "Треска", grams: 180 }, { name: "Картофель", grams: 250 }] },
    ],
    snack: [
      { title: "Творог", items: [{ name: "Творог 5%", grams: 200 }, { name: "Мёд", grams: 10 }] },
      { title: "Йогурт + банан", items: [{ name: "Йогурт натуральный", grams: 200 }, { name: "Банан", grams: 120 }] },
    ],
  };

  const addTemplate = async (tplTitle: string) => {
    if (!user) return;
    const tpl = (mealTemplates[currentMeal] ?? []).find((t) => t.title === tplTitle);
    if (!tpl) return;

    try {
      for (const item of tpl.items) {
        const p = approvedProducts.find((x) => String(x.name ?? "").toLowerCase() === item.name.toLowerCase());
        if (!p) continue;
        await addDoc(collection(db, "food_diary"), {
          user_id: user.uid,
          product_id: p.id,
          meal: currentMeal,
          grams: item.grams,
          date: selectedDate,
          product: {
            name: p.name ?? "",
            calories_per_100g: p.calories_per_100g ?? 0,
            protein_per_100g: p.protein_per_100g ?? 0,
            fat_per_100g: p.fat_per_100g ?? 0,
            carbs_per_100g: p.carbs_per_100g ?? 0,
          },
        });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message ?? "Ошибка" });
      return;
    }

    setAddDialogOpen(false);
    setSearchQ("");
    void checkAndUpdateStreak(user.uid).catch(() => {
      // ignore
    });
    toast({ title: `Добавлено: ${tpl.title}` });
  };

  const updateGrams = async (id: string, delta: number) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const newGrams = Math.max(10, entry.grams + delta);
    try {
      await updateDoc(doc(db, "food_diary", id), { grams: newGrams });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message ?? "Ошибка" });
    }
  };

  const removeEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, "food_diary", id));
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message ?? "Ошибка" });
    }
  };

  const totalCal = entries.reduce((s, e) => s + Math.round((e.grams / 100) * e.cal_per_100), 0);
  const totalP = entries.reduce((s, e) => s + Math.round((e.grams / 100) * e.p_per_100), 0);
  const totalF = entries.reduce((s, e) => s + Math.round((e.grams / 100) * e.f_per_100), 0);
  const totalC = entries.reduce((s, e) => s + Math.round((e.grams / 100) * e.c_per_100), 0);
  const goal = profile?.daily_calories ?? 2200;
  const pct = Math.min(100, Math.round((totalCal / goal) * 100));

  const bju = [
    { name: "Б", value: totalP || 1, color: "hsl(210 80% 55%)" },
    { name: "Ж", value: totalF || 1, color: "hsl(38 92% 55%)" },
    { name: "У", value: totalC || 1, color: "hsl(152 68% 45%)" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-36 md:pb-24">
      <PageBanner
        eyebrow="Дневник"
        title="Заполняй день красиво"
        description="Добавляй продукты, контролируй граммы и держи баланс БЖУ."
        icon={renderIcon("solar:calendar-bold-duotone", { className: "text-[20px] text-primary-foreground" })}
        right={
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto bg-card/60 backdrop-blur border-border/60"
          />
        }
      />

      <Carousel opts={{ align: "start" }} className="relative">
        <CarouselContent>
          {[
            { title: "Ккал", value: `${totalCal}`, meta: `из ${goal}`, icon: renderIcon("solar:fire-bold-duotone", { className: "text-[20px] text-foreground" }) },
            { title: "Белки", value: `${totalP}г`, meta: `цель ${profile?.protein_goal ?? 0}г`, icon: renderIcon("solar:bone-bold-duotone", { className: "text-[20px] text-foreground" }) },
            { title: "Жиры", value: `${totalF}г`, meta: `цель ${profile?.fat_goal ?? 0}г`, icon: renderIcon("solar:dropper-bold-duotone", { className: "text-[20px] text-foreground" }) },
            { title: "Углеводы", value: `${totalC}г`, meta: `цель ${profile?.carbs_goal ?? 0}г`, icon: renderIcon("solar:wheat-bold-duotone", { className: "text-[20px] text-foreground" }) },
          ].map((s) => (
            <CarouselItem key={s.title} className="basis-1/2 sm:basis-1/3">
              <Card className="overflow-hidden">
                <CardContent className="p-4 relative">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">{s.title}</p>
                        <p className="mt-2 text-xl font-display font-bold">{s.value}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{s.meta}</p>
                      </div>
                      <div className="h-10 w-10 rounded-2xl bg-card/60 border border-border/60 backdrop-blur flex items-center justify-center shrink-0">
                        {s.icon}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <Tabs defaultValue="breakfast" onValueChange={setCurrentMeal}>
        <TabsList className="relative grid grid-cols-4 w-full p-1 rounded-2xl bg-card/40 border border-border/60 backdrop-blur">
          {Object.entries(mealLabels).map(([key, v]) => (
            <TabsTrigger
              key={key}
              value={key}
              className="relative overflow-hidden rounded-xl py-2 text-xs sm:text-sm text-muted-foreground data-[state=active]:text-foreground active:scale-[0.99] transition-transform"
            >
              {currentMeal === key ? (
                <motion.div
                  aria-hidden
                  layoutId="meal-segment-indicator"
                  className="absolute inset-0 rounded-xl bg-card/70 backdrop-blur border border-border/60 shadow-[var(--shadow-card)] overflow-hidden"
                  transition={{ type: "spring", stiffness: 520, damping: 42 }}
                >
                  <motion.div
                    key={currentMeal}
                    aria-hidden
                    className="absolute -inset-y-4 -left-1/2 w-[200%] opacity-0"
                    initial={{ x: "-30%", opacity: 0 }}
                    animate={{ x: "30%", opacity: [0, 0.35, 0] }}
                    transition={{ duration: 0.42, ease: "easeOut" }}
                    style={{
                      willChange: "transform, opacity",
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent)",
                      transform: "skewX(-18deg)",
                    }}
                  />
                </motion.div>
              ) : null}
              <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
                {renderIcon(v.icon, { className: "text-[16px]" })}
                {v.label}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.keys(mealLabels).map((meal) => (
          <TabsContent key={meal} value={meal} className="space-y-3 mt-4">
            {entries.filter(e => e.meal === meal).map((entry) => (
              <motion.div key={entry.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <Card>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-medium">{entry.product_name}</p>
                      <p className="text-sm text-muted-foreground">{Math.round((entry.grams / 100) * entry.cal_per_100)} ккал</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateGrams(entry.id, -10)}>
                        {renderIcon("solar:minus-square-bold-duotone", { className: "text-[16px]" })}
                      </Button>
                      <span className="w-12 text-center text-sm font-medium">{entry.grams}г</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateGrams(entry.id, 10)}>
                        {renderIcon("solar:add-square-bold-duotone", { className: "text-[16px]" })}
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeEntry(entry.id)}>
                      {renderIcon("solar:trash-bin-trash-bold-duotone", { className: "text-[18px]" })}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            <Dialog open={addDialogOpen && currentMeal === meal} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full" onClick={() => { setCurrentMeal(meal); setAddDialogOpen(true); }}>
                  <span className="mr-2">{renderIcon("solar:add-square-bold-duotone", { className: "text-[18px]" })}</span> Добавить продукт
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Поиск продукта</DialogTitle></DialogHeader>
                {(mealTemplates[currentMeal] ?? []).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Быстрые блюда</p>
                    <div className="flex flex-wrap gap-2">
                      {(mealTemplates[currentMeal] ?? []).map((t) => (
                        <Button key={t.title} variant="outline" size="sm" onClick={() => addTemplate(t.title)}>
                          {t.title}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {renderIcon("solar:magnifer-bold-duotone", { className: "text-[18px]" })}
                  </div>
                  <Input placeholder="Начните вводить..." className="pl-10" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {searchResults.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => addProduct(p.id)}
                    >
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.calories_per_100g} ккал / 100г • Б{p.protein_per_100g} Ж{p.fat_per_100g} У{p.carbs_per_100g}</p>
                      </div>
                      {renderIcon("solar:add-circle-bold-duotone", { className: "text-[18px] text-primary" })}
                    </div>
                  ))}
                  {searchQ && productsLoaded && approvedProducts.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">База продуктов не загружена</p>
                  )}
                  {searchQ && searchResults.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Ничего не найдено</p>}
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>
        ))}
      </Tabs>

      {/* Day summary */}
      <Card className="glow-emerald">
        <CardContent className="p-4 flex items-center gap-6">
          <ResponsiveContainer width={100} height={100}>
            <PieChart>
              <Pie data={bju} cx="50%" cy="50%" innerRadius={30} outerRadius={45} paddingAngle={4} dataKey="value" strokeWidth={0}>
                {bju.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1">
            <p className="text-2xl font-display font-bold">{totalCal} <span className="text-base text-muted-foreground font-normal">/ {goal} ккал</span></p>
            <div className="relative h-3 rounded-full bg-muted overflow-hidden mt-2">
              <motion.div className="absolute inset-y-0 left-0 rounded-full gradient-primary" initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.round((totalCal / goal) * 100))}%` }} transition={{ duration: 0.8 }} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">{Math.round((totalCal / goal) * 100)}% от нормы</p>
          </div>
        </CardContent>
      </Card>

      <div className="fixed left-0 right-0 z-40 bottom-20 md:bottom-6">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 md:px-6">
          <div className="glass-surface elevated border border-border/60 rounded-2xl p-3">
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex h-10 w-10 rounded-2xl bg-card/60 border border-border/60 backdrop-blur items-center justify-center">
                {renderIcon("solar:fire-bold-duotone", { className: "text-[20px] text-primary" })}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Итог дня</p>
                <p className="text-sm font-medium truncate">
                  {totalCal} ккал • {totalP}Б {totalF}Ж {totalC}У • {pct}%
                </p>
              </div>

              <Button
                variant="hero"
                className="h-11 px-4 rounded-xl"
                onClick={() => {
                  setAddDialogOpen(true);
                }}
              >
                <span className="mr-2">{renderIcon("solar:add-square-bold-duotone", { className: "text-[18px]" })}</span> Добавить
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Diary;
