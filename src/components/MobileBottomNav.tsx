import { NavLink } from "react-router-dom";
import { renderIcon } from "@/lib/icons";

const items = [
  { to: "/dashboard", label: "Дом", icon: "solar:home-2-bold-duotone" },
  { to: "/diary", label: "Дневник", icon: "solar:notebook-bold-duotone" },
  { to: "/products", label: "Поиск", icon: "solar:magnifer-bold-duotone" },
  { to: "/achievements", label: "Титулы", icon: "solar:cup-star-bold-duotone" },
  { to: "/profile", label: "Я", icon: "solar:user-bold-duotone" },
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
                {renderIcon(item.icon, { className: "text-[20px]" })}
                <span className="leading-none">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
