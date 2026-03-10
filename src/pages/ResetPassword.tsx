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
      const oobCode = new URLSearchParams(window.location.search).get("oobCode");
      if (!oobCode) {
        toast({ variant: "destructive", title: "Ошибка", description: "Отсутствует код восстановления (oobCode)" });
        setLoading(false);
        return;
      }
      await confirmPasswordReset(auth, oobCode, password);
      toast({ title: "Пароль обновлён!" });
      navigate("/dashboard");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e?.message ?? "Ошибка" });
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
