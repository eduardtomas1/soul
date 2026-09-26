import { clsx } from "clsx";
import type { ReactNode } from "react";
import { platform } from "@/lib/bridge";

export function Page({ title, subtitle, actions, tabs, children, className, wide }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; tabs?: ReactNode; children: ReactNode; className?: string; wide?: boolean }) {
  const width = wide ? "max-w-[1240px]" : "max-w-[1040px]";
  return (
    <div className="flex min-h-full flex-col">
      <header className={clsx("titlebar-drag border-b border-border bg-surface", platform === "darwin" ? "pt-10" : "pt-8")}>
        <div className={clsx("mx-auto px-8 min-[1200px]:px-10", width)}>
          <div className={clsx("flex items-end justify-between gap-5", tabs ? "pb-2" : "pb-6")}>
            <div className="enter min-w-0">
              <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
              {subtitle && <div className="mt-1.5 truncate text-[13px] text-muted">{subtitle}</div>}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
          {tabs}
        </div>
      </header>
      <div className={clsx("stagger mx-auto flex w-full flex-col gap-6 px-8 py-8 min-[1200px]:px-10", width, className)}>{children}</div>
    </div>
  );
}
