import { AppIcon } from "@/components/AppIcon";

const EMOJI_TO_ICONIFY: Record<string, string> = {
  "🥗": "mdi:bowl-mix-outline",
  "🍗": "mdi:food-drumstick-outline",
  "🍫": "mdi:candy-outline",
  "🚶‍♂️": "mdi:walk",
  "🚶": "mdi:walk",
  "🥩": "mdi:food-steak",
  "🥛": "mdi:cup-water",
  "🌾": "mdi:wheat",
  "🍎": "mdi:fruit-apple",
  "🥦": "mdi:food-broccoli",
  "🏆": "mdi:trophy",
  "🖼️": "mdi:image-outline",
  "🔥": "mdi:fire",
};

type RenderIconOptions = {
  className?: string;
  size?: number;
};

export function normalizeIconName(icon: unknown): string | null {
  if (!icon) return null;
  if (typeof icon !== "string") return null;

  if (icon.includes(":")) return icon;
  return EMOJI_TO_ICONIFY[icon] ?? null;
}

export function renderIcon(icon: unknown, opts?: RenderIconOptions) {
  const size = opts?.size ?? 20;
  const className = opts?.className;

  if (typeof icon === "string") {
    const mapped = EMOJI_TO_ICONIFY[icon];
    if (icon.includes(":")) {
      return <AppIcon name={icon} className={className} size={size} />;
    }
    if (mapped) {
      return <AppIcon name={mapped} className={className} size={size} />;
    }
    return <span className={className}>{icon}</span>;
  }

  return icon as any;
}
