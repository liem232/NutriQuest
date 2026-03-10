import { motion } from "framer-motion";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
};

export function PageBanner({ eyebrow, title, description, icon, right }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="glass-surface rounded-3xl p-4 sm:p-5 overflow-hidden relative"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
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
              <div className="h-11 w-11 rounded-2xl gradient-primary flex items-center justify-center shrink-0">
                {icon}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </motion.div>
  );
}
