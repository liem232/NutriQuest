import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { renderIcon } from "@/lib/icons";
import { confirmPasswordReset } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const urlParams = new URLSearchParams(window.location.search);
      const oobCode = urlParams.get("oobCode");
      
      console.log("Reset attempt - oobCode present:", !!oobCode);
      console.log("Current URL:", window.location.href);
      
      if (!oobCode) {
        toast({ variant: "destructive", title: "Ошибка", description: "Неверная или устаревшая ссылка для сброса пароля" });
        setLoading(false);
        return;
      }
      
      console.log("Calling confirmPasswordReset...");
      await confirmPasswordReset(auth, oobCode, password);
      console.log("Password reset successful!");
      
      toast({ title: "Пароль обновлён!", description: "Войдите с новым паролем" });
      
      // Delay navigation to ensure toast is shown
      setTimeout(() => {
        navigate("/?login=true");
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
              <p className="text-xs text-muted-foreground mt-1">Придумай надёжный пароль и сохрани изменения</p>
            </div>
          </div>

          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label>Новый пароль</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Подтверждение</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
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
