import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, BookOpen, Search, Trophy, User, Shield, LogOut } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { to: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { to: "/diary", label: "Дневник", icon: BookOpen },
  { to: "/products", label: "Продукты", icon: Search },
  { to: "/achievements", label: "Достижения", icon: Trophy },
  { to: "/profile", label: "Профиль", icon: User },
] as const;

export function AppTopNav() {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 glass-surface">
      <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 md:px-6">
        <div className="h-14 flex items-center gap-2">
          <NavLink to="/dashboard" className="flex items-center gap-2 min-w-0">
            <div className="h-9 w-9 rounded-2xl gradient-primary flex items-center justify-center shrink-0">
              <span className="sr-only">NutriQuest</span>
            </div>
            <div className="hidden sm:block min-w-0">
              <p className="text-sm font-display font-semibold leading-none">NutriQuest</p>
              <p className="text-xs text-muted-foreground mt-1 leading-none">Трекер питания</p>
            </div>
          </NavLink>

          <nav className="ml-2 hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  "px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-2 " +
                  (isActive
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground")
                }
              >
                <item.icon className="h-4 w-4" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}

            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  "px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-2 " +
                  (isActive
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground")
                }
              >
                <Shield className="h-4 w-4" />
                <span className="font-medium">Админ</span>
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {user && (
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 bg-card/60 backdrop-blur border-border/60"
                onClick={async () => {
                  await signOut();
                  navigate("/", { replace: true });
                }}
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Выйти</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
