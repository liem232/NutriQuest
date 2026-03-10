import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, BookOpen, Search, Trophy, User, Shield, Leaf,
  type LucideIcon 
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

const mainItems: NavItem[] = [
  { title: "Дашборд", url: "/dashboard", icon: LayoutDashboard },
  { title: "Дневник", url: "/diary", icon: BookOpen },
  { title: "Продукты", url: "/products", icon: Search },
  { title: "Достижения", url: "/achievements", icon: Trophy },
  { title: "Профиль", url: "/profile", icon: User },
];

const adminItems: NavItem[] = [
  { title: "Админ-панель", url: "/admin", icon: Shield },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isAdmin } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border/60 bg-sidebar/70 backdrop-blur-xl"
    >
      <SidebarContent>
        <div className="p-4">
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-sm">
                <Leaf className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-display font-bold leading-none">
                  NutriQuest
                </h1>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  Трекер питания и прогресса
                </p>
              </div>
            </div>
          ) : (
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-sm">
              <Leaf className="h-5 w-5 text-primary-foreground" />
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Меню</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <RouterNavLink
                      to={item.url}
                      className={
                        `group flex items-center gap-3 px-3 py-2 rounded-xl transition-all ` +
                        (isActive(item.url)
                          ? "bg-primary/10 text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-sidebar-accent/80 hover:text-foreground")
                      }
                    >
                      <item.icon className={
                        `h-5 w-5 shrink-0 transition-colors ` +
                        (isActive(item.url) ? "text-primary" : "text-muted-foreground group-hover:text-primary")
                      } />
                      {!collapsed && (
                        <span className={isActive(item.url) ? "font-medium" : ""}>
                          {item.title}
                        </span>
                      )}
                    </RouterNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Управление</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <RouterNavLink
                        to={item.url}
                        className={
                          `group flex items-center gap-3 px-3 py-2 rounded-xl transition-all ` +
                          (isActive(item.url)
                            ? "bg-primary/10 text-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-sidebar-accent/80 hover:text-foreground")
                        }
                      >
                        <item.icon className={
                          `h-5 w-5 shrink-0 transition-colors ` +
                          (isActive(item.url) ? "text-primary" : "text-muted-foreground group-hover:text-primary")
                        } />
                        {!collapsed && (
                          <span className={isActive(item.url) ? "font-medium" : ""}>
                            {item.title}
                          </span>
                        )}
                      </RouterNavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
