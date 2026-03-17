import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { renderIcon } from "@/lib/icons";

export default function Blocked() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
            {renderIcon("solar:ban-bold-duotone", { className: "text-[32px] text-destructive" })}
          </div>
          <CardTitle className="text-2xl font-display">Аккаунт заблокирован</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            Ваш аккаунт был заблокирован администратором. Обратитесь в поддержку для разблокировки.
          </p>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <span className="mr-2">{renderIcon("solar:logout-3-bold-duotone", { className: "text-[18px]" })}</span>
            Выйти
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
