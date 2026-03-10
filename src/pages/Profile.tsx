import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Calendar, Flame, ChevronRight, LogOut, Zap, User as UserIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { collection, doc, getCountFromServer, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { calculateDailyCalories } from "@/lib/calculateDailyCalories";

const activityLabels: Record<string, string> = {
  sedentary: "Сидячий образ жизни",
  light: "Лёгкая активность",
  moderate: "Умеренная активность",
  active: "Активный образ жизни",
  very_active: "Очень активный",
};

const Profile = () => {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [achievementCount, setAchievementCount] = useState(0);

  const [name, setName] = useState(profile?.display_name ?? "");
  const [weight, setWeight] = useState(profile?.weight ?? 70);
  const [height, setHeight] = useState(profile?.height ?? 175);
  const [age, setAge] = useState(profile?.age ?? 25);
  const [gender, setGender] = useState(profile?.gender ?? "male");
  const [activity, setActivity] = useState(profile?.activity_level ?? "moderate");
  const [goal, setGoal] = useState(profile?.goal ?? "maintain");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      (async () => {
        try {
          const q = query(collection(db, "user_achievements"), where("user_id", "==", user.uid));
          const snap = await getCountFromServer(q);
          setAchievementCount(snap.data().count);
        } catch {
          setAchievementCount(0);
        }
      })();
    }
  }, [user?.uid]);

  useEffect(() => {
    setName(profile?.display_name ?? "");
    setWeight(profile?.weight ?? 70);
    setHeight(profile?.height ?? 175);
    setAge(profile?.age ?? 25);
    setGender(profile?.gender ?? "male");
    setActivity(profile?.activity_level ?? "moderate");
    setGoal(profile?.goal ?? "maintain");
  }, [profile?.user_id]);

  if (!profile || !user) return null;

  const initials = profile.display_name?.split(" ").map(n => n[0]).join("").slice(0, 2) || "?";

  const handleSave = async () => {
    setSaving(true);
    try {
      const calc = calculateDailyCalories({
        weight: Number(weight),
        height: Number(height),
        age: Number(age),
        gender: gender as any,
        activity: activity as any,
        goal: goal as any,
      });

      await updateDoc(doc(db, "profiles", user.uid), {
        display_name: name,
        weight,
        height,
        age,
        gender,
        activity_level: activity,
        goal,
        daily_calories: calc.calories,
        protein_goal: calc.protein,
        fat_goal: calc.fat,
        carbs_goal: calc.carbs,
      } as any);

      await refreshProfile();
      toast({ title: "Профиль обновлён!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message ?? "Ошибка" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="glass-surface rounded-3xl p-4 sm:p-5 overflow-hidden relative">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Профиль</p>
            <h1 className="mt-2 text-2xl font-display font-bold">Твои параметры и прогресс</h1>
            <p className="mt-2 text-sm text-muted-foreground">Обновляй данные — нормы пересчитаются автоматически.</p>
          </div>
          <div className="h-11 w-11 rounded-2xl gradient-primary flex items-center justify-center shrink-0">
            <UserIcon className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
      </div>

      <Card className="card-hover">
        <CardContent className="p-6 flex items-center gap-6">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-2xl bg-primary/10 text-primary font-display">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-display font-bold">{profile.display_name}</h2>
            <p className="text-sm text-accent font-medium">⭐ {profile.title} • {profile.xp} XP</p>
          </div>
        </CardContent>
      </Card>

      <Carousel opts={{ align: "start" }} className="relative">
        <CarouselContent>
          {[
            { icon: <Flame className="h-5 w-5 text-primary" />, value: profile.streak_days.toString(), label: "Дней подряд" },
            { icon: <Zap className="h-5 w-5 text-accent" />, value: ((profile as any).best_streak ?? 0).toString(), label: "Лучшая серия" },
            { icon: <Calendar className="h-5 w-5 text-primary" />, value: profile.total_days.toString(), label: "Всего дней" },
            { icon: <Trophy className="h-5 w-5 text-accent" />, value: achievementCount.toString(), label: "Достижений" },
          ].map((s, i) => (
            <CarouselItem key={i} className="basis-1/2 sm:basis-1/3">
              <Card className="card-hover">
                <CardContent className="p-4 text-center">
                  <div className="flex justify-center mb-2">{s.icon}</div>
                  <p className="text-2xl font-display font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <Card>
        <CardHeader><CardTitle className="text-lg">Личные данные</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Имя</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Пол</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as "male" | "female")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Мужской</SelectItem>
                  <SelectItem value="female">Женский</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Активность</Label>
              <Select value={activity} onValueChange={(v) => setActivity(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(activityLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Вес (кг)</Label>
              <Input type="number" value={weight} onChange={(e) => setWeight(parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Рост (см)</Label>
              <Input type="number" value={height} onChange={(e) => setHeight(parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Возраст</Label>
              <Input type="number" value={age} onChange={(e) => setAge(parseInt(e.target.value))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Цель</Label>
            <Select value={goal} onValueChange={(v) => setGoal(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lose">Похудение</SelectItem>
                <SelectItem value="maintain">Поддержание</SelectItem>
                <SelectItem value="gain">Набор массы</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Рассчитанные нормы</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm">
            <Label>Калории: {profile.daily_calories} ккал/день</Label>
          </div>
          <div className="flex justify-between text-sm">
            <Label>Белки: {profile.protein_goal}г • Жиры: {profile.fat_goal}г • Углеводы: {profile.carbs_goal}г</Label>
          </div>
          <p className="text-xs text-muted-foreground">Нормы рассчитываются автоматически по формуле Миффлина-Сан Жеора</p>
        </CardContent>
      </Card>

      <Button variant="hero" className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? "Сохранение..." : "Сохранить и пересчитать нормы"}
      </Button>

      <Button variant="gold" className="w-full" asChild>
        <Link to="/achievements"><Trophy className="h-4 w-4 mr-2" /> Соревноваться <ChevronRight className="h-4 w-4 ml-auto" /></Link>
      </Button>

      <Button variant="outline" className="w-full text-destructive" onClick={handleLogout}>
        <LogOut className="h-4 w-4 mr-2" /> Выйти
      </Button>
    </motion.div>
  );
};

export default Profile;
