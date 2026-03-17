import { AppIcon } from "@/components/AppIcon";

type RenderIconOptions = {
  className?: string;
  size?: number;
};

export function normalizeIconName(icon: unknown): string | null {
  if (!icon) return null;
  if (typeof icon !== "string") return null;
  if (icon.includes(":")) return icon;
  return null;
}

export function renderIcon(icon: unknown, opts?: RenderIconOptions) {
  const size = opts?.size ?? 20;
  const className = opts?.className;

  if (typeof icon === "string" && icon.includes(":")) {
    return <AppIcon name={icon} className={className} size={size} />;
  }

  return icon as any;
}
