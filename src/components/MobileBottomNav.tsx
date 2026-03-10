import { NavLink } from "react-router-dom";
import { LayoutDashboard, BookOpen, Search, Trophy, User } from "lucide-react";

const items = [
  { to: "/dashboard", label: "Дом", icon: LayoutDashboard },
  { to: "/diary", label: "Дневник", icon: BookOpen },
  { to: "/products", label: "Поиск", icon: Search },
  { to: "/achievements", label: "Титулы", icon: Trophy },
  { to: "/profile", label: "Я", icon: User },
] as const;

export function MobileBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 md:px-6 pb-[max(env(safe-area-inset-bottom),0px)]">
        <div className="glass-surface border border-border/60 rounded-2xl mb-3">
          <div className="grid grid-cols-5">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-xs transition-all active:scale-95 " +
                  (isActive
                    ? "text-primary bg-primary/8"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/40")
                }
              >
                <item.icon className="h-5 w-5" />
                <span className="leading-none">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
