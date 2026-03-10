import { motion, useReducedMotion } from "framer-motion";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
};

export function PageBanner({ eyebrow, title, description, icon, right }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="glass-surface rounded-3xl p-4 sm:p-5 overflow-hidden relative"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/8" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-primary/12 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.32]"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0px, rgba(255,255,255,.06) 1px, transparent 1px, transparent 4px)",
          mixBlendMode: "overlay",
        }}
      />
      {!reduceMotion ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -left-1/2 top-0 h-full w-[180%] opacity-25"
          animate={{ x: ["-20%", "20%", "-20%"] }}
          transition={{ duration: 5.5, repeat: Infinity }}
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(38 92% 55% / 0.22), transparent)",
            willChange: "transform",
          }}
        />
      ) : null}
      <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="text-xs text-muted-foreground">{eyebrow}</p>}
          <h1 className="mt-2 text-2xl sm:text-3xl font-display font-bold tracking-tight">{title}</h1>
          {description && <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">{description}</p>}
        </div>

        {(right || icon) && (
          <div className="flex items-center gap-3 shrink-0 sm:justify-end">
            {right ? <div className="w-full sm:w-auto">{right}</div> : null}
            {icon ? (
              <div className="h-11 w-11 rounded-2xl gradient-primary flex items-center justify-center shrink-0 shadow-[var(--shadow-soft)] ring-1 ring-white/20">
                {icon}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </motion.div>
  );
}
