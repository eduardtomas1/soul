import { useLayoutEffect, useState, type RefObject } from "react";

export interface ActiveRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export function useActiveRect(ref: RefObject<HTMLElement | null>, selector: string, key: unknown): ActiveRect | null {
  const [rect, setRect] = useState<ActiveRect | null>(null);
  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return undefined;
    const update = () => {
      const active = container.querySelector<HTMLElement>(selector);
      setRect(active ? { left: active.offsetLeft, top: active.offsetTop, width: active.offsetWidth, height: active.offsetHeight } : null);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    for (const child of Array.from(container.querySelectorAll(":scope > *, :scope > * > *"))) observer.observe(child);
    return () => observer.disconnect();
  }, [ref, selector, key]);
  return rect;
}
