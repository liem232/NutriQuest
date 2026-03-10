import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Leaf, LineChart, BookOpen, Trophy, Search } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";
import { calculateDailyCalories } from "@/lib/calculateDailyCalories";

const activityLabels: Record<string, string> = {
  sedentary: "Сидячий образ жизни",
  light: "Лёгкая активность",
  moderate: "Умеренная активность",
  active: "Активный образ жизни",
  very_active: "Очень активный",
};

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [regStep, setRegStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regName, setRegName] = useState("");
  const [regGender, setRegGender] = useState<"male" | "female">("male");
  const [regAge, setRegAge] = useState("25");
  const [regWeight, setRegWeight] = useState("70");
  const [regHeight, setRegHeight] = useState("175");
  const [regActivity, setRegActivity] = useState("moderate");
  const [regGoal, setRegGoal] = useState("maintain");

  const slides = [
    {
      title: "Прогресс без перегруза",
      desc: "Калории и БЖУ — одним взглядом. Видно, что делать дальше.",
      badge: "Дашборд",
      accent: "from-emerald-500/15 via-sky-500/10 to-transparent",
      icon: <LineChart className="h-5 w-5 text-foreground" />,
    },
    {
      title: "Дневник питания",
      desc: "Добавляй продукты, регулируй граммы — всё быстро и удобно с телефона.",
      badge: "Дневник",
      accent: "from-amber-500/15 via-emerald-500/10 to-transparent",
      icon: <BookOpen className="h-5 w-5 text-foreground" />,
    },
    {
      title: "Достижения и серия дней",
      desc: "XP, титулы и streak делают привычку устойчивой — хочется возвращаться.",
      badge: "Геймификация",
      accent: "from-violet-500/15 via-amber-500/10 to-transparent",
      icon: <Trophy className="h-5 w-5 text-foreground" />,
    },
    {
      title: "Каталог продуктов",
      desc: "Ищи, фильтруй, добавляй свои продукты на модерацию.",
      badge: "Продукты",
      accent: "from-sky-500/15 via-emerald-500/10 to-transparent",
      icon: <Search className="h-5 w-5 text-foreground" />,
    },
  ];

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user]);

  const validatePassword = (pw: string) => {
    if (pw.length < 8) return "Минимум 8 символов";
    if (!/[A-ZА-Я]/.test(pw)) return "Нужна заглавная буква";
    if (!/\d/.test(pw)) return "Нужна цифра";
    return null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка входа", description: e?.message ?? "Ошибка входа" });
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      toast({ variant: "destructive", title: "Введите email" });
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, forgotEmail, {
        url: `${window.location.origin}/reset-password`,
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message ?? "Ошибка" });
      setLoading(false);
      return;
    }
    setLoading(false);
    toast({ title: "Письмо отправлено!", description: "Проверьте почту для сброса пароля." });
    setShowForgot(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (regStep === 1) {
      if (!regEmail || !regPassword || !regName) {
        toast({ variant: "destructive", title: "Заполните все поля" });
        return;
      }
      const pwErr = validatePassword(regPassword);
      if (pwErr) {
        toast({ variant: "destructive", title: "Пароль", description: pwErr });
        return;
      }
      if (regPassword !== regConfirm) {
        toast({ variant: "destructive", title: "Пароли не совпадают" });
        return;
      }
      setRegStep(2);
      return;
    }

    if (regStep === 2) {
      const age = parseInt(regAge);
      const weight = parseFloat(regWeight);
      const height = parseFloat(regHeight);
      if (age < 14 || age > 100) { toast({ variant: "destructive", title: "Возраст от 14 до 100" }); return; }
      if (weight < 30 || weight > 250) { toast({ variant: "destructive", title: "Вес от 30 до 250 кг" }); return; }
      if (height < 120 || height > 220) { toast({ variant: "destructive", title: "Рост от 120 до 220 см" }); return; }
      setRegStep(3);
      return;
    }

    // Step 3: final submit
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      const uid = cred.user.uid;

      const calc = calculateDailyCalories({
        weight: parseFloat(regWeight),
        height: parseFloat(regHeight),
        age: parseInt(regAge),
        gender: regGender,
        activity: regActivity as any,
        goal: regGoal as any,
      });

      await setDoc(
        doc(db, "profiles", uid),
        {
          user_id: uid,
          display_name: regName,
          avatar_url: null,
          gender: regGender,
          age: parseInt(regAge),
          weight: parseFloat(regWeight),
          height: parseFloat(regHeight),
          activity_level: regActivity,
          goal: regGoal,
          daily_calories: calc.calories,
          protein_goal: calc.protein,
          fat_goal: calc.fat,
          carbs_goal: calc.carbs,
          streak_days: 0,
          total_days: 0,
          last_active_date: null,
          title: "Новичок",
          xp: 0,
          best_streak: 0,
          is_blocked: false,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(doc(db, "user_roles", uid), { user_id: uid, role: "user" }, { merge: true });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка регистрации", description: e?.message ?? "Ошибка регистрации" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden page-shell">
      <div className="absolute inset-0 overflow-hidden">
        <div className="wave-bg absolute -bottom-24 -left-24 w-[160%] h-[62%] rounded-[40%] bg-primary/10" />
        <div className="wave-bg-slow absolute -bottom-48 -right-24 w-[160%] h-[52%] rounded-[45%] bg-primary/5" />
        <div className="wave-bg absolute -top-48 -right-48 w-[90%] h-[55%] rounded-[50%] bg-accent/5" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="relative z-10 mx-auto w-full max-w-6xl px-4 py-10 sm:py-14"
      >
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Быстрый старт • Персональные нормы • Геймификация
            </div>

            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight">
              NutriQuest
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
              Трекер питания, который выглядит как премиум-приложение и помогает держать курс: калории, БЖУ,
              цели и достижения — всё в одном месте.
            </p>

            <div className="mt-6">
              <Carousel
                opts={{ align: "start", loop: true }}
                className="relative"
              >
                <CarouselContent>
                  {slides.map((s) => (
                    <CarouselItem key={s.title} className="sm:basis-1/2">
                      <div className={`glass-surface rounded-3xl p-4 sm:p-5 overflow-hidden relative`}>
                        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${s.accent}`} />
                        <div className="relative">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="inline-flex items-center gap-2 rounded-full bg-card/60 backdrop-blur border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                {s.badge}
                              </div>
                              <p className="mt-3 text-base font-display font-semibold leading-tight">
                                {s.title}
                              </p>
                              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                                {s.desc}
                              </p>
                            </div>
                            <div className="h-10 w-10 rounded-2xl bg-card/60 border border-border/60 backdrop-blur flex items-center justify-center shrink-0">
                              {s.icon}
                            </div>
                          </div>

                          <div className="mt-4 flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-muted/60 overflow-hidden">
                              <div className="h-full w-2/3 gradient-primary rounded-full" />
                            </div>
                            <span className="text-xs text-muted-foreground">живой UI</span>
                          </div>
                        </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>

                <CarouselPrevious className="hidden lg:flex -left-10 bg-card/70 border-border/60 backdrop-blur" />
                <CarouselNext className="hidden lg:flex -right-10 bg-card/70 border-border/60 backdrop-blur" />
              </Carousel>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Button variant="hero" className="h-11 px-6" onClick={() => setShowForgot(false)}>
                Начать сейчас
              </Button>
              <Button
                variant="outline"
                className="h-11 px-6 bg-card/60 backdrop-blur border-border/60"
                onClick={() => {
                  setShowForgot(false);
                  setRegStep(1);
                }}
              >
                Создать аккаунт
              </Button>
            </div>
          </div>

          <div className="w-full max-w-md mx-auto lg:mx-0">
            <div className="glass-surface elevated rounded-3xl p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-2xl gradient-primary flex items-center justify-center shadow-sm">
                  <Leaf className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-display font-semibold leading-none">Добро пожаловать</p>
                  <p className="text-xs text-muted-foreground mt-1">Войдите или зарегистрируйтесь за минуту</p>
                </div>
              </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register" onClick={() => setRegStep(1)}>Регистрация</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              {!showForgot ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="you@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Пароль</Label>
                    <Input type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                    {loading ? "Вход..." : "Войти"}
                  </Button>
                  <button type="button" className="text-sm text-primary hover:underline w-full text-center" onClick={() => setShowForgot(true)}>
                    Забыли пароль?
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Введите email для восстановления пароля</p>
                  <Input type="email" placeholder="you@example.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
                  <Button variant="hero" className="w-full" onClick={handleForgotPassword} disabled={loading}>
                    {loading ? "Отправка..." : "Отправить ссылку"}
                  </Button>
                  <button type="button" className="text-sm text-muted-foreground hover:underline w-full text-center" onClick={() => setShowForgot(false)}>
                    Назад ко входу
                  </button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="flex items-center justify-center gap-2 mb-4">
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        step === regStep ? "w-8 bg-primary" : step < regStep ? "w-6 bg-primary/50" : "w-6 bg-muted"
                      }`}
                    />
                  ))}
                </div>

                {regStep === 1 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Имя</Label>
                      <Input placeholder="Ваше имя" value={regName} onChange={(e) => setRegName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" placeholder="you@example.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Пароль (мин. 8 символов, цифра, заглавная)</Label>
                      <Input type="password" placeholder="••••••••" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Подтверждение пароля</Label>
                      <Input type="password" placeholder="••••••••" value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)} required />
                    </div>
                  </motion.div>
                )}

                {regStep === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <p className="text-sm text-muted-foreground text-center">Параметры тела</p>
                    <div className="space-y-2">
                      <Label>Пол</Label>
                      <Select value={regGender} onValueChange={(v) => setRegGender(v as "male" | "female")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Мужской</SelectItem>
                          <SelectItem value="female">Женский</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>Возраст</Label>
                        <Input type="number" value={regAge} onChange={(e) => setRegAge(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Вес (кг)</Label>
                        <Input type="number" value={regWeight} onChange={(e) => setRegWeight(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Рост (см)</Label>
                        <Input type="number" value={regHeight} onChange={(e) => setRegHeight(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Уровень активности</Label>
                      <Select value={regActivity} onValueChange={setRegActivity}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(activityLabels).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </motion.div>
                )}

                {regStep === 3 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <p className="text-sm text-muted-foreground text-center">Ваша цель</p>
                    <div className="grid gap-3">
                      {([["lose", "Похудение"], ["maintain", "Поддержание веса"], ["gain", "Набор массы"]] as const).map(([val, label]) => (
                        <label
                          key={val}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            regGoal === val ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                          }`}
                        >
                          <input type="radio" name="goal" checked={regGoal === val} onChange={() => setRegGoal(val)} className="accent-primary" />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-2">
                  {regStep > 1 && (
                    <Button type="button" variant="outline" onClick={() => setRegStep(regStep - 1)} className="flex-1">
                      Назад
                    </Button>
                  )}
                  <Button type="submit" variant="hero" className="flex-1" disabled={loading}>
                    {loading ? "Загрузка..." : regStep < 3 ? "Далее" : "Начать"}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Landing;
