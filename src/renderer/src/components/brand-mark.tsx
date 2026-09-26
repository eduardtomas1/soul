import { clsx } from "clsx";

export function BrandMark({ size = 20, inverse = false }: { size?: number; inverse?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="96 96 832 832" aria-hidden="true" className="shrink-0">
      <rect x="96" y="96" width="832" height="832" rx="188" className={clsx(inverse ? "fill-side-text" : "fill-accent")} />
      <path d="M607.3 347A110 110 0 1 0 512 512A110 110 0 1 1 416.7 677" fill="none" strokeWidth="84" strokeLinecap="round" className={clsx(inverse ? "stroke-side" : "stroke-accent-text")} />
    </svg>
  );
}
