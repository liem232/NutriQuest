import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen page-shell flex items-center justify-center px-4 py-12">
      <div className="glass-surface elevated rounded-3xl p-6 sm:p-8 w-full max-w-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Маршрут</p>
            <p className="text-sm font-medium truncate">{location.pathname}</p>
          </div>
          <div className="h-11 w-11 rounded-2xl gradient-primary flex items-center justify-center">
            <Compass className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>

        <h1 className="mt-6 text-4xl sm:text-5xl font-display font-bold tracking-tight">404</h1>
        <p className="mt-2 text-muted-foreground">
          Такой страницы нет. Но ты можешь вернуться в приложение и продолжить трекать прогресс.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Button variant="hero" className="h-11" asChild>
            <a href="/dashboard">На дашборд</a>
          </Button>
          <Button variant="outline" className="h-11 bg-card/60 backdrop-blur border-border/60" asChild>
            <a href="/">На главную</a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
