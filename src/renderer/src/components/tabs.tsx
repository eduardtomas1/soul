import { clsx } from "clsx";
import { useRef, type ReactNode } from "react";
import { useActiveRect } from "@/lib/active-rect";

const SELECTED = "[aria-selected=\"true\"]";

interface Option<T extends string> {
  readonly value: T;
  readonly label: ReactNode;
}

export function Tabs<T extends string>({ options, value, onChange, className }: { options: ReadonlyArray<Option<T>>; value: T; onChange: (value: T) => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const indicator = useActiveRect(ref, SELECTED, value);
  return (
    <div ref={ref} className={clsx("relative flex gap-7", className)} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={clsx("h-11 text-[13.5px] font-medium transition-colors", option.value === value ? "text-text" : "text-muted hover:text-text")}
        >
          {option.label}
        </button>
      ))}
      {indicator && <span aria-hidden="true" className="tab-indicator pointer-events-none absolute bottom-[-1px] left-0 h-[2px] rounded-full bg-text" style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }} />}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, size = "md", className }: { options: ReadonlyArray<Option<T>>; value: T; onChange: (value: T) => void; size?: "sm" | "md"; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const thumb = useActiveRect(ref, SELECTED, value);
  return (
    <div ref={ref} className={clsx("relative inline-flex self-start rounded-[7px] border border-border bg-surface-2 p-0.5", className)} role="tablist">
      {thumb && <span aria-hidden="true" className="tab-indicator pointer-events-none absolute top-0.5 bottom-0.5 left-0 rounded-[5px] border border-border bg-surface shadow-[0_1px_2px_rgba(16,16,24,0.08)]" style={{ width: thumb.width, transform: `translateX(${thumb.left}px)` }} />}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={clsx(
            "relative rounded-[5px] font-medium transition-colors",
            size === "sm" ? "h-7 px-3 text-[12px]" : "h-[30px] px-3.5 text-[12.5px]",
            option.value === value ? "text-text" : "text-muted hover:text-text",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
