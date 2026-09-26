import { useEffect, useRef } from "react";

const flushers = new Set<() => void>();

function flushAll(): void {
  for (const flush of flushers) flush();
}

window.addEventListener("pagehide", flushAll);
window.addEventListener("beforeunload", flushAll);

export function useFlushOnExit(flush: () => void): void {
  const latest = useRef(flush);
  useEffect(() => {
    latest.current = flush;
  }, [flush]);
  useEffect(() => {
    const entry = () => latest.current();
    flushers.add(entry);
    return () => {
      flushers.delete(entry);
    };
  }, []);
}
