import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { renderIcon } from "@/lib/icons";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("oobCode");
    const emailParam = urlParams.get("email");
    
    console.log("ResetPassword mounted");
    console.log("URL:", window.location.href);
    console.log("oobCode present:", !!code);
    console.log("email present:", !!emailParam);
    
    if (!code) {
      setError("Неверная или устаревшая ссылка. Запросите новую ссылку для сброса пароля.");
      return;
    }
    
    // Verify the code is valid before showing the form
    verifyPasswordResetCode(auth, code)
      .then((email) => {
        console.log("Code verified for email:", email);
        setOobCode(code);
        setEmail(email);
      })
      .catch((err) => {
        console.error("Code verification failed:", err);
        const code = String(err?.code ?? "");
        if (code === "auth/expired-action-code") {
          setError("Ссылка устарела. Запросите новую ссылку.");
        } else if (code === "auth/invalid-action-code") {
          setError("Неверная ссылка. Запросите новую.");
        } else {
          setError("Ошибка проверки ссылки. Попробуйте запросить новую.");
        }
      });
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) {
      toast({ variant: "destructive", title: "Ошибка", description: "Неверная ссылка" });
      return;
    }
    if (password !== confirm) {
      toast({ variant: "destructive", title: "Пароли не совпадают" });
      return;
    }
    if (password.length < 8) {
      toast({ variant: "destructive", title: "Минимум 8 символов" });
      return;
    }
    setLoading(true);
    try {
      console.log("Calling confirmPasswordReset...");
      await confirmPasswordReset(auth, oobCode, password);
      console.log("Password reset successful!");
      
      toast({ title: "Пароль обновлён!", description: "Войдите с новым паролем" });
      
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (e: any) {
      console.error("Password reset error:", e);
      const code = String(e?.code ?? "");
      let message = "Не удалось обновить пароль. Попробуйте снова";
      if (code === "auth/weak-password") message = "Пароль слишком слабый";
      if (code === "auth/expired-action-code") message = "Ссылка устарела. Запросите новую";
      if (code === "auth/invalid-action-code") message = "Неверная или использованная ссылка";
      toast({ variant: "destructive", title: "Ошибка", description: message });
    } finally {
      setLoading(false);
    }
  };

  // Error state - invalid/missing link
  if (error) {
    return (
      <div className="min-h-screen page-shell flex items-center justify-center px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="glass-surface elevated rounded-3xl p-6 text-center">
            <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              {renderIcon("solar:shield-warning-bold-duotone", { className: "text-[24px] text-destructive" })}
            </div>
            <h1 className="text-lg font-display font-bold">Ошибка ссылки</h1>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
            <Button 
              variant="hero" 
              className="w-full mt-4" 
              onClick={() => navigate("/")}
            >
              На главную
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Loading state - verifying code
  if (!oobCode && !error) {
    return (
      <div className="min-h-screen page-shell flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="glass-surface elevated rounded-3xl p-6">
            <div className="h-10 w-10 rounded-2xl gradient-primary flex items-center justify-center mx-auto animate-pulse">
              {renderIcon("solar:refresh-bold-duotone", { className: "text-[20px] text-primary-foreground" })}
            </div>
            <p className="text-sm text-muted-foreground mt-4">Проверка ссылки...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-shell flex items-center justify-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="glass-surface elevated rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl gradient-primary flex items-center justify-center shadow-sm">
              {renderIcon("solar:key-minimalistic-square-bold-duotone", { className: "text-[20px] text-primary-foreground" })}
            </div>
            <div>
              <h1 className="text-lg font-display font-bold leading-none">Новый пароль</h1>
              {email && (
                <p className="text-xs text-muted-foreground mt-1">Для: {email}</p>
              )}
            </div>
          </div>

          <form onSubmit={handleReset} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Новый пароль</Label>
              <Input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Минимум 8 символов"
                required 
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label>Подтверждение</Label>
              <Input 
                type="password" 
                value={confirm} 
                onChange={(e) => setConfirm(e.target.value)} 
                placeholder="Повторите пароль"
                required 
              />
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={loading}>
              {loading ? "Сохранение..." : "Обновить пароль"}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
