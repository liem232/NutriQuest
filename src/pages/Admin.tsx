import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  increment,
  where,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { renderIcon } from "@/lib/icons";

const Admin = () => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [adminWish, setAdminWish] = useState<string>("");
  const [searchUsers, setSearchUsers] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [pendingProducts, setPendingProducts] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [searchProducts, setSearchProducts] = useState("");
  const [achievements, setAchievements] = useState<any[]>([]);
  const [stats, setStats] = useState({ users: 0, products: 0, achievements: 0, blocked: 0 });
  const [newAch, setNewAch] = useState({ name: "", description: "", icon: "solar:trophy-bold-duotone", image_url: "", condition_type: "total_days", condition_value: "1", xp_reward: "50" });
  const [achDialogOpen, setAchDialogOpen] = useState(false);
  const [titleFilter, setTitleFilter] = useState("all");

  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [grantUserId, setGrantUserId] = useState<string>("");
  const [grantAchievementId, setGrantAchievementId] = useState<string>("");
  const [grantUserAchievements, setGrantUserAchievements] = useState<any[]>([]);
  const [revokeRollbackXp, setRevokeRollbackXp] = useState(true);

  const [setXpDialogOpen, setSetXpDialogOpen] = useState(false);
  const [setXpUserId, setSetXpUserId] = useState<string>("");
  const [setXpValue, setSetXpValue] = useState<string>("");

  useEffect(() => {
    if (!currentUser?.uid) return;

    const wishes = [
      "Пусть модерация будет быстрой, а пользователи — счастливыми.",
      "Сделаем сегодня панель админа ещё мощнее.",
      "Сегодня отличный день, чтобы закрыть пару важных задач.",
      "Меньше слов - больше дела",
      "Пусть всё работает с первого раза.",
      "Прокачаем продукт так, чтобы им гордиться.",
    ];

    const todayKey = new Date().toISOString().slice(0, 10);
    const idx =
      Math.abs(
        (currentUser.uid + todayKey)
          .split("")
          .reduce((s, ch) => s + ch.charCodeAt(0), 0)
      ) % wishes.length;
    const wish = wishes[idx];
    setAdminWish(wish);

    const toastKey = `cc_admin_wish_${todayKey}`;
    if (typeof window !== "undefined" && !sessionStorage.getItem(toastKey)) {
      sessionStorage.setItem(toastKey, "1");
      toast({
        title: "Админ-панель",
        description: wish,
      });
    }
  }, [currentUser?.uid]);

  const seedAchievements = async () => {
    const seeds = [
      { name: "Первый шаг", description: "Заполни дневник впервые", icon: "solar:footprints-bold-duotone", condition_type: "total_days", condition_value: 1, xp_reward: 30 },
      { name: "Неделя в деле", description: "7 дней подряд", icon: "solar:fire-bold-duotone", condition_type: "streak", condition_value: 7, xp_reward: 150 },
      { name: "Две недели", description: "14 дней подряд", icon: "solar:bolt-bold-duotone", condition_type: "streak", condition_value: 14, xp_reward: 300 },
      { name: "Месяц дисциплины", description: "30 дней подряд", icon: "solar:medal-ribbon-bold-duotone", condition_type: "streak", condition_value: 30, xp_reward: 800 },
      { name: "Сотка", description: "100 дней всего", icon: "solar:medal-bold-duotone", condition_type: "total_days", condition_value: 100, xp_reward: 1200 },
      { name: "Легендарный год", description: "365 дней всего", icon: "solar:trophy-bold-duotone", condition_type: "total_days", condition_value: 365, xp_reward: 5000 },

      { name: "Белковый режим", description: "Попади в цель по белку 3 раза", icon: "solar:bone-bold-duotone", condition_type: "perfect_bju", condition_value: 3, xp_reward: 220 },
      { name: "Балансир", description: "Идеальный БЖУ 10 раз", icon: "solar:scale-bold-duotone", condition_type: "perfect_bju", condition_value: 10, xp_reward: 700 },
      { name: "Коллекционер", description: "Добавь 3 продукта", icon: "solar:box-minimalistic-bold-duotone", condition_type: "products_added", condition_value: 3, xp_reward: 120 },
      { name: "Шеф-повар", description: "Добавь 10 продуктов", icon: "solar:chef-hat-bold-duotone", condition_type: "products_added", condition_value: 10, xp_reward: 450 },
      { name: "Лаборатория вкуса", description: "Добавь 25 продуктов", icon: "solar:test-tube-bold-duotone", condition_type: "products_added", condition_value: 25, xp_reward: 1200 },
    ];

    let existingNames = new Set<string>();
    try {
      const snap = await getDocs(query(collection(db, "achievements")));
      existingNames = new Set(snap.docs.map((d) => String((d.data() as any)?.name ?? "")));
    } catch {
      existingNames = new Set();
    }
    const toInsert = seeds.filter((s) => !existingNames.has(s.name));

    if (toInsert.length === 0) {
      toast({ title: "Набор уже добавлен", description: "Все достижения из набора уже есть." });
      return;
    }

    try {
      await Promise.all(
        toInsert.map((a) =>
          addDoc(collection(db, "achievements"), {
            ...a,
            created_at: serverTimestamp(),
          } as any)
        )
      );
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message ?? "Ошибка" });
      return;
    }

    toast({ title: "Готово!", description: `Добавлено достижений: ${toInsert.length}` });
    fetchData();
  };

  const fetchData = async () => {
    try {
      const profilesQ = query(collection(db, "profiles"), orderBy("xp", "desc"));
      const profilesSnap = await getDocs(profilesQ);
      const profiles = profilesSnap.docs.map((d) => {
        const data: any = d.data();
        return { user_id: data.user_id ?? d.id, ...data };
      });
      setUsers(profiles);
      const blockedCount = profiles.filter((p: any) => p.is_blocked).length;
      setStats((prev) => ({ ...prev, users: profiles.length, blocked: blockedCount }));
    } catch {
      setUsers([]);
      setStats((prev) => ({ ...prev, users: 0, blocked: 0 }));
    }

    try {
      // Avoid composite-index requirement (where + orderBy). Sort client-side.
      const pendingQ = query(collection(db, "products"), where("is_approved", "==", false), limit(100));
      const pendingSnap = await getDocs(pendingQ);
      const rows = pendingSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      rows.sort((a, b) => {
        const aT = (a.created_at?.toMillis?.() ?? 0) as number;
        const bT = (b.created_at?.toMillis?.() ?? 0) as number;
        return bT - aT;
      });
      setPendingProducts(rows);
    } catch (e: any) {
      setPendingProducts([]);
      toast({
        variant: "destructive",
        title: "Не удалось загрузить модерацию",
        description: e?.message ?? "Ошибка",
      });
    }

    try {
      const approvedCount = await getCountFromServer(query(collection(db, "products"), where("is_approved", "==", true)));
      setStats((prev) => ({ ...prev, products: approvedCount.data().count }));
    } catch {
      setStats((prev) => ({ ...prev, products: 0 }));
    }

    try {
      const allQ = query(collection(db, "products"), limit(500));
      const snap = await getDocs(allQ);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      rows.sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "ru"));
      setAllProducts(rows);
    } catch {
      setAllProducts([]);
    }

    try {
      const achQ = query(collection(db, "achievements"));
      const achSnap = await getDocs(achQ);
      const rows = achSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAchievements(rows);
      setStats((prev) => ({ ...prev, achievements: rows.length }));
    } catch {
      setAchievements([]);
      setStats((prev) => ({ ...prev, achievements: 0 }));
    }
  };

  const setUserXp = async () => {
    const uid = String(setXpUserId || "");
    const xp = Number(setXpValue);
    if (!uid || !Number.isFinite(xp)) {
      toast({ variant: "destructive", title: "Ошибка", description: "Укажи корректные uid и XP" });
      return;
    }

    try {
      await updateDoc(doc(db, "profiles", uid), { xp } as any);
      toast({ title: "Готово", description: "XP обновлён." });
      setSetXpDialogOpen(false);
      setSetXpUserId("");
      setSetXpValue("");
      fetchData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message ?? "Ошибка" });
    }
  };

  useEffect(() => { fetchData(); }, []);

  const fetchUserAchievementsForGrant = async (uid: string) => {
    if (!uid) {
      setGrantUserAchievements([]);
      return;
    }
    try {
      const uaQ = query(
        collection(db, "user_achievements"),
        where("user_id", "==", uid),
        limit(200)
      );
      const uaSnap = await getDocs(uaQ);
      const rows = uaSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      rows.sort((a, b) => {
        const aT = (a.earned_at?.toMillis?.() ?? 0) as number;
        const bT = (b.earned_at?.toMillis?.() ?? 0) as number;
        return bT - aT;
      });
      setGrantUserAchievements(rows);
    } catch {
      setGrantUserAchievements([]);
    }
  };

  useEffect(() => {
    if (!grantDialogOpen) return;
    fetchUserAchievementsForGrant(grantUserId);
  }, [grantDialogOpen, grantUserId]);

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.display_name?.toLowerCase().includes(searchUsers.toLowerCase());
    const matchesTitle = titleFilter === "all" || u.title === titleFilter;
    return matchesSearch && matchesTitle;
  });

  const approveProduct = async (id: string) => {
    try {
      await updateDoc(doc(db, "products", id), { is_approved: true, approved_at: serverTimestamp() } as any);
      toast({ title: "Продукт одобрен!" });
      fetchData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message ?? "Ошибка" });
    }
  };

  const rejectProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, "products", id));
      toast({ title: "Продукт отклонён" });
      fetchData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message ?? "Ошибка" });
    }
  };

  const updateTitle = async (userId: string, title: string) => {
    try {
      await updateDoc(doc(db, "profiles", userId), { title } as any);
      toast({ title: "Титул обновлён" });
      fetchData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message ?? "Ошибка" });
    }
  };

  const toggleBlock = async (userId: string, isBlocked: boolean) => {
    try {
      await updateDoc(doc(db, "profiles", userId), { is_blocked: !isBlocked } as any);
      toast({ title: isBlocked ? "Пользователь разблокирован" : "Пользователь заблокирован" });
      fetchData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message ?? "Ошибка" });
    }
  };

  const createAchievement = async () => {
    try {
      await addDoc(collection(db, "achievements"), {
        name: newAch.name,
        description: newAch.description,
        icon: newAch.icon,
        image_url: newAch.image_url || null,
        condition_type: newAch.condition_type,
        condition_value: parseInt(newAch.condition_value),
        xp_reward: parseInt(newAch.xp_reward),
        created_at: serverTimestamp(),
      } as any);
      toast({ title: "Достижение создано!" });
      setAchDialogOpen(false);
      setNewAch({ name: "", description: "", icon: "solar:trophy-bold-duotone", image_url: "", condition_type: "total_days", condition_value: "1", xp_reward: "50" });
      fetchData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message ?? "Ошибка" });
    }
  };

  const grantAchievement = async () => {
    const uid = grantUserId;
    const achId = grantAchievementId;
    if (!uid || !achId) return;

    const ach = achievements.find((a) => String(a.id) === String(achId));
    if (!ach) {
      toast({ variant: "destructive", title: "Достижение не найдено" });
      return;
    }

    try {
      const existingQ = query(
        collection(db, "user_achievements"),
        where("user_id", "==", uid),
        where("achievement_id", "==", achId),
        limit(1)
      );
      const existingSnap = await getDocs(existingQ);
      if (!existingSnap.empty) {
        toast({ title: "Уже выдано", description: "Это достижение уже есть у пользователя." });
        return;
      }
    } catch {
      // ignore
    }

    try {
      await addDoc(collection(db, "user_achievements"), {
        user_id: uid,
        achievement_id: achId,
        earned_at: serverTimestamp(),
        granted_by: currentUser?.uid ?? null,
      } as any);

      await updateDoc(doc(db, "profiles", uid), {
        xp: increment(Number(ach.xp_reward ?? 0)),
      } as any);

      toast({ title: "Готово", description: "Достижение выдано." });
      setGrantDialogOpen(false);
      setGrantUserId("");
      setGrantAchievementId("");
      setGrantUserAchievements([]);
      fetchData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message ?? "Ошибка" });
    }
  };

  const revokeAchievement = async (uid: string, uaDocId: string, achievementId: string) => {
    if (!uid || !uaDocId || !achievementId) return;
    const ach = achievements.find((a) => String(a.id) === String(achievementId));
    const reward = Number((ach as any)?.xp_reward ?? 0) || 0;

    try {
      await deleteDoc(doc(db, "user_achievements", uaDocId));
      if (revokeRollbackXp && reward > 0) {
        await updateDoc(doc(db, "profiles", uid), { xp: increment(-reward) } as any);
      }
      toast({ title: "Готово", description: "Достижение забрано." });
      fetchUserAchievementsForGrant(uid);
      fetchData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message ?? "Ошибка" });
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, "products", id));
      toast({ title: "Продукт удалён" });
      fetchData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message ?? "Ошибка" });
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="glass-surface rounded-3xl p-4 sm:p-5 overflow-hidden relative">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Админ</p>
            <h1 className="mt-2 text-2xl font-display font-bold">Панель управления</h1>
            <p className="mt-2 text-sm text-muted-foreground">Пользователи, модерация продуктов и достижения — всё в одном месте.</p>
            {adminWish && (
              <div className="mt-3 inline-flex items-start gap-2 rounded-2xl border border-border/60 bg-card/60 backdrop-blur px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">Пожелание дня</span>
                <span className="text-xs text-foreground/90">{adminWish}</span>
              </div>
            )}
          </div>
          <div className="h-11 w-11 rounded-2xl bg-card/60 border border-border/60 backdrop-blur flex items-center justify-center shrink-0">
            {renderIcon("solar:shield-check-bold-duotone", { className: "text-[20px] text-primary" })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: renderIcon("solar:users-group-rounded-bold-duotone", { className: "text-[20px]" }), label: "Пользователей", value: stats.users },
          { icon: renderIcon("solar:box-bold-duotone", { className: "text-[20px]" }), label: "Продуктов", value: stats.products },
          { icon: renderIcon("solar:medal-ribbon-star-bold-duotone", { className: "text-[20px]" }), label: "Достижений", value: stats.achievements },
          { icon: renderIcon("solar:ban-bold-duotone", { className: "text-[20px]" }), label: "Заблокировано", value: stats.blocked },
        ].map((s, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4 relative">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/10" />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-2xl bg-card/60 border border-border/60 backdrop-blur flex items-center justify-center shrink-0">
                    {s.icon}
                  </div>
                  <span className="text-xs text-muted-foreground truncate">{s.label}</span>
                </div>
                <div className="h-8 w-8 rounded-xl bg-card/60 border border-border/60 backdrop-blur flex items-center justify-center shrink-0">
                  <span className="text-xs">#{i + 1}</span>
                </div>
              </div>
              <p className="mt-2 text-2xl font-display font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="users">
        <TabsList className="w-full overflow-x-auto whitespace-nowrap justify-start">
          <TabsTrigger value="users">Пользователи</TabsTrigger>
          <TabsTrigger value="products">Модерация ({pendingProducts.length})</TabsTrigger>
          <TabsTrigger value="catalog">Все продукты ({allProducts.length})</TabsTrigger>
          <TabsTrigger value="achievements">Достижения</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {renderIcon("solar:magnifer-bold-duotone", { className: "text-[18px]" })}
              </div>
              <Input placeholder="Поиск..." className="pl-10" value={searchUsers} onChange={(e) => setSearchUsers(e.target.value)} />
            </div>
            <Select value={titleFilter} onValueChange={setTitleFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Фильтр" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все титулы</SelectItem>
                {["Новичок", "Любитель", "Спортсмен", "Профи", "Эксперт", "Легенда", "Абсолютный чемпион"].map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            {filteredUsers.map((u) => (
              <Card key={u.user_id} className={`${(u as any).is_blocked ? "opacity-60" : ""}`}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {u.display_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                    <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{u.display_name}</p>
                      <span className="text-[10px] text-muted-foreground font-mono">({u.user_id?.slice(0, 8)}...)</span>
                      {(u as any).is_blocked && <Badge variant="destructive" className="text-xs">Заблокирован</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{u.xp} XP • {u.total_days} дн. • {u.streak_days}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Select defaultValue={u.title} onValueChange={(v) => updateTitle(u.user_id, v)}>
                      <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Новичок", "Любитель", "Спортсмен", "Профи", "Эксперт", "Легенда", "Абсолютный чемпион"].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant={(u as any).is_blocked ? "secondary" : "destructive"}
                      size="sm"
                      className="text-xs"
                      onClick={() => toggleBlock(u.user_id, (u as any).is_blocked)}
                    >
                      {(u as any).is_blocked
                        ? <span className="mr-1">{renderIcon("solar:check-circle-bold-duotone", { className: "text-[14px]" })}</span>
                        : <span className="mr-1">{renderIcon("solar:ban-bold-duotone", { className: "text-[14px]" })}</span>}
                      {(u as any).is_blocked ? "Разблок." : "Блок."}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setSetXpUserId(String(u.user_id));
                        setSetXpValue(String(u.xp ?? 0));
                        setSetXpDialogOpen(true);
                      }}
                    >
                      XP
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setGrantUserId(String(u.user_id));
                        setGrantAchievementId("");
                        setGrantDialogOpen(true);
                      }}
                    >
                      Выдать
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4 mt-4">
          {pendingProducts.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Нет продуктов на модерации</p>}
          {pendingProducts.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.calories_per_100g} ккал • Б{p.protein_per_100g} Ж{p.fat_per_100g} У{p.carbs_per_100g}</p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button variant="hero" size="sm" className="text-xs" onClick={() => approveProduct(p.id)}>Одобрить</Button>
                  <Button variant="destructive" size="sm" className="text-xs" onClick={() => rejectProduct(p.id)}>Отклонить</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="catalog" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {renderIcon("solar:magnifer-bold-duotone", { className: "text-[18px]" })}
              </div>
              <Input
                placeholder="Поиск продукта..."
                className="pl-10"
                value={searchProducts}
                onChange={(e) => setSearchProducts(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            {allProducts
              .filter((p) => String(p.name ?? "").toLowerCase().includes(searchProducts.toLowerCase()))
              .slice(0, 200)
              .map((p) => (
                <Card key={p.id}>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{p.name}</p>
                        {p.is_approved ? (
                          <Badge className="text-xs">approved</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">pending</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{p.calories_per_100g} ккал • Б{p.protein_per_100g} Ж{p.fat_per_100g} У{p.carbs_per_100g}</p>
                    </div>
                    <Button variant="destructive" size="sm" className="text-xs" onClick={() => deleteProduct(p.id)}>
                      Удалить
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="font-display font-semibold">Все достижения ({achievements.length})</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={seedAchievements}>
                + Набор
              </Button>

              <Dialog open={achDialogOpen} onOpenChange={setAchDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="hero" size="sm">+ Создать</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Создать достижение</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="space-y-2 sm:col-span-1">
                        <Label>Иконка</Label>
                        <Input value={newAch.icon} onChange={(e) => setNewAch({ ...newAch, icon: e.target.value })} />
                      </div>
                      <div className="space-y-2 sm:col-span-3">
                        <Label>Название</Label>
                        <Input value={newAch.name} onChange={(e) => setNewAch({ ...newAch, name: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Картинка (URL)</Label>
                      <Input value={newAch.image_url} onChange={(e) => setNewAch({ ...newAch, image_url: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Описание</Label>
                      <Input value={newAch.description} onChange={(e) => setNewAch({ ...newAch, description: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>Тип</Label>
                        <Select value={newAch.condition_type} onValueChange={(v) => setNewAch({ ...newAch, condition_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="streak">Серия дней</SelectItem>
                            <SelectItem value="total_days">Всего дней</SelectItem>
                            <SelectItem value="products_added">Продуктов</SelectItem>
                            <SelectItem value="perfect_bju">Идеальный БЖУ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Значение</Label>
                        <Input type="number" value={newAch.condition_value} onChange={(e) => setNewAch({ ...newAch, condition_value: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>XP</Label>
                        <Input type="number" value={newAch.xp_reward} onChange={(e) => setNewAch({ ...newAch, xp_reward: e.target.value })} />
                      </div>
                    </div>
                    <Button variant="hero" className="w-full" onClick={createAchievement}>Создать</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="space-y-2">
            {achievements.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  {a.name.includes("Первый") ? (
                    <div className="text-xl">{renderIcon("solar:footprints-bold-duotone", { className: "text-[20px] text-green-500" })}</div>
                  ) : a.name.includes("Неделя") ? (
                    <div className="text-xl">{renderIcon("solar:fire-bold-duotone", { className: "text-[20px] text-orange-500" })}</div>
                  ) : a.name.includes("Две недели") ? (
                    <div className="text-xl">{renderIcon("solar:bolt-bold-duotone", { className: "text-[20px] text-yellow-500" })}</div>
                  ) : a.name.includes("Месяц") ? (
                    <div className="text-xl">{renderIcon("solar:medal-ribbon-bold-duotone", { className: "text-[20px] text-purple-500" })}</div>
                  ) : a.name.includes("Сотка") ? (
                    <div className="text-xl">{renderIcon("solar:medal-bold-duotone", { className: "text-[20px] text-blue-500" })}</div>
                  ) : a.name.includes("Год") ? (
                    <div className="text-xl">{renderIcon("solar:trophy-bold-duotone", { className: "text-[20px] text-amber-500" })}</div>
                  ) : a.name.includes("Белковый") ? (
                    <div className="text-xl">{renderIcon("solar:bone-bold-duotone", { className: "text-[20px] text-red-500" })}</div>
                  ) : a.name.includes("Балансир") ? (
                    <div className="text-xl">{renderIcon("solar:scale-bold-duotone", { className: "text-[20px] text-cyan-500" })}</div>
                  ) : a.name.includes("Коллекционер") ? (
                    <div className="text-xl">{renderIcon("solar:box-minimalistic-bold-duotone", { className: "text-[20px] text-indigo-500" })}</div>
                  ) : a.name.includes("Шеф-повар") ? (
                    <div className="text-xl">{renderIcon("solar:chef-hat-bold-duotone", { className: "text-[20px] text-pink-500" })}</div>
                  ) : a.name.includes("Лаборатория") ? (
                    <div className="text-xl">{renderIcon("solar:test-tube-bold-duotone", { className: "text-[20px] text-teal-500" })}</div>
                  ) : (
                    <div className="text-xl">{renderIcon("solar:star-bold-duotone", { className: "text-[20px] text-primary" })}</div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.description} • {a.condition_type}≥{a.condition_value} • +{a.xp_reward}XP</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Выдать достижение</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Пользователь</Label>
              <Input value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)} placeholder="uid" />
            </div>
            <div className="space-y-2">
              <Label>Достижение</Label>
              <Select value={grantAchievementId} onValueChange={setGrantAchievementId}>
                <SelectTrigger><SelectValue placeholder="Выбери достижение" /></SelectTrigger>
                <SelectContent>
                  {achievements.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.image_url ? renderIcon("solar:gallery-wide-bold-duotone", { className: "text-[14px]" }) : renderIcon(a.icon, { className: "text-[14px]" })} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="hero" className="w-full" onClick={grantAchievement}>Выдать</Button>

            <div className="pt-2 border-t border-border/60" />

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Достижения пользователя</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => fetchUserAchievementsForGrant(grantUserId)}
                  disabled={!grantUserId}
                >
                  Обновить
                </Button>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={revokeRollbackXp}
                  onChange={(e) => setRevokeRollbackXp(e.target.checked)}
                />
                Откатывать XP при снятии
              </label>
            </div>

            <div className="space-y-2 max-h-72 overflow-auto pr-1">
              {grantUserId && grantUserAchievements.length === 0 && (
                <p className="text-xs text-muted-foreground">Пока достижений нет.</p>
              )}
              {grantUserAchievements.map((ua) => {
                const ach = achievements.find((a) => String(a.id) === String((ua as any).achievement_id));
                const name = String((ach as any)?.name ?? (ua as any).achievement_id ?? "");
                const icon = (ach as any)?.name.includes("Первый") ? renderIcon("solar:footprints-bold-duotone", { className: "text-[20px] text-green-500" }) :
                (ach as any)?.name.includes("Неделя") ? renderIcon("solar:fire-bold-duotone", { className: "text-[20px] text-orange-500" }) :
                (ach as any)?.name.includes("Две недели") ? renderIcon("solar:bolt-bold-duotone", { className: "text-[20px] text-yellow-500" }) :
                (ach as any)?.name.includes("Месяц") ? renderIcon("solar:medal-ribbon-bold-duotone", { className: "text-[20px] text-purple-500" }) :
                (ach as any)?.name.includes("Сотка") ? renderIcon("solar:medal-bold-duotone", { className: "text-[20px] text-blue-500" }) :
                (ach as any)?.name.includes("Год") ? renderIcon("solar:trophy-bold-duotone", { className: "text-[20px] text-amber-500" }) :
                (ach as any)?.name.includes("Белковый") ? renderIcon("solar:bone-bold-duotone", { className: "text-[20px] text-red-500" }) :
                (ach as any)?.name.includes("Балансир") ? renderIcon("solar:scale-bold-duotone", { className: "text-[20px] text-cyan-500" }) :
                (ach as any)?.name.includes("Коллекционер") ? renderIcon("solar:box-minimalistic-bold-duotone", { className: "text-[20px] text-indigo-500" }) :
                (ach as any)?.name.includes("Шеф-повар") ? renderIcon("solar:chef-hat-bold-duotone", { className: "text-[20px] text-pink-500" }) :
                (ach as any)?.name.includes("Лаборатория") ? renderIcon("solar:test-tube-bold-duotone", { className: "text-[20px] text-teal-500" }) :
                renderIcon("solar:star-bold-duotone", { className: "text-[20px] text-primary" });
                const xpReward = Number((ach as any)?.xp_reward ?? 0) || 0;
                const earnedAt = (ua as any)?.earned_at;
                const earnedDate = typeof earnedAt?.toDate === "function" ? earnedAt.toDate() : null;

                return (
                  <Card key={String((ua as any).id)}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="text-xl w-8 text-center shrink-0">{icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          +{xpReward} XP
                          {earnedDate ? ` • ${earnedDate.toLocaleDateString("ru")}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="text-xs"
                        onClick={() => revokeAchievement(grantUserId, String((ua as any).id), String((ua as any).achievement_id))}
                      >
                        Забрать
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={setXpDialogOpen} onOpenChange={setSetXpDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Установить XP</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Пользователь</Label>
              <Input value={setXpUserId} onChange={(e) => setSetXpUserId(e.target.value)} placeholder="uid" />
            </div>
            <div className="space-y-2">
              <Label>XP</Label>
              <Input type="number" value={setXpValue} onChange={(e) => setSetXpValue(e.target.value)} placeholder="например 800" />
            </div>
            <Button variant="hero" className="w-full" onClick={setUserXp}>Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default Admin;
