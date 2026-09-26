import { Circle, type IconWeight } from "@phosphor-icons/react";
import { clsx } from "clsx";
import type { ColorToken } from "@shared/contracts/common";
import type { IconKey } from "@shared/icons";
import { GLYPHS } from "@/lib/glyphs";

export function Glyph({ name, size = 16, weight = "regular", className }: { name: string; size?: number; weight?: IconWeight; className?: string }) {
  const Icon = GLYPHS[name as IconKey] ?? Circle;
  return <Icon size={size} weight={weight} aria-hidden="true" className={clsx("shrink-0", className)} />;
}

export function IconBadge({ name, tone, size = 28, iconSize, className }: { name: string; tone: ColorToken; size?: number; iconSize?: number; className?: string }) {
  return (
    <span className={clsx("inline-flex shrink-0 items-center justify-center rounded-[7px] bg-[color-mix(in_oklab,var(--tone)_13%,var(--surface))] text-[var(--tone)]", `tone-${tone}`, className)} style={{ width: size, height: size }}>
      <Glyph name={name} size={iconSize ?? Math.round(size * 0.56)} />
    </span>
  );
}
