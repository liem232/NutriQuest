import { Icon } from "@iconify/react";

import { cn } from "@/lib/utils";

type Props = {
  name: string;
  className?: string;
  size?: number;
  color?: string;
};

export function AppIcon({ name, className, size = 20, color }: Props) {
  return (
    <Icon
      icon={name}
      width={size}
      height={size}
      color={color}
      className={cn(
        "shrink-0 transition-transform duration-200 will-change-transform",
        className
      )}
    />
  );
}
