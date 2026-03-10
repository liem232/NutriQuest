import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { renderIcon } from "@/lib/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 bg-card/60 backdrop-blur border-border/60"
        >
          <span className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0">
            {renderIcon("solar:sun-2-bold-duotone", { className: "text-[18px]" })}
          </span>
          <span className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100">
            {renderIcon("solar:moon-bold-duotone", { className: "text-[18px]" })}
          </span>
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onClick={() => setTheme("light")}
        >
          <span className="mr-2">{renderIcon("solar:sun-2-bold-duotone", { className: "text-[18px]" })}</span> Светлая
          {theme === "light" ? <span className="ml-auto text-xs text-muted-foreground">✓</span> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}
        >
          <span className="mr-2">{renderIcon("solar:moon-bold-duotone", { className: "text-[18px]" })}</span> Тёмная
          {theme === "dark" ? <span className="ml-auto text-xs text-muted-foreground">✓</span> : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme("system")}
        >
          <span className="mr-2">{renderIcon("solar:monitor-smartphone-bold-duotone", { className: "text-[18px]" })}</span> Системная
          {theme === "system" ? <span className="ml-auto text-xs text-muted-foreground">✓</span> : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
