import { useEffect, useRef, useState } from "react";

export function motionAllowed(): boolean {
  if (document.documentElement.dataset.motion === "reduced") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

export function useCountUp(value: number, duration = 750): number {
  const [display, setDisplay] = useState(() => (motionAllowed() ? 0 : value));
  const shown = useRef(display);

  useEffect(() => {
    if (!motionAllowed() || shown.current === value) {
      shown.current = value;
      setDisplay(value);
      return undefined;
    }
    const from = shown.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const next = progress >= 1 ? value : from + (value - from) * easeOutCubic(progress);
      shown.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return display;
}
