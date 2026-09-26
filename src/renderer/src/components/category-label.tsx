import { clsx } from "clsx";
import type { Category } from "@shared/contracts/finances";

export function CategoryLabel({ category, fallback = "—", className }: { category: Category | undefined; fallback?: string; className?: string }) {
  if (!category) return <span className={className}>{fallback}</span>;
  return (
    <span className={clsx("flex min-w-0 items-center gap-2", `tone-${category.color}`, className)}>
      <span className="dot" />
      <span className="truncate">{category.name}</span>
    </span>
  );
}
