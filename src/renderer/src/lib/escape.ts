import { useEffect, useRef } from "react";

interface Layer {
  readonly id: number;
  readonly close: () => void;
}

const layers: Layer[] = [];
let nextId = 0;

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  const top = layers[layers.length - 1];
  if (!top) return;
  event.preventDefault();
  top.close();
}

export function useEscape(close: () => void, active = true): void {
  const latest = useRef(close);
  useEffect(() => {
    latest.current = close;
  }, [close]);
  useEffect(() => {
    if (!active) return undefined;
    const id = ++nextId;
    layers.push({ id, close: () => latest.current() });
    if (layers.length === 1) window.addEventListener("keydown", onKeyDown);
    return () => {
      const index = layers.findIndex((layer) => layer.id === id);
      if (index >= 0) layers.splice(index, 1);
      if (layers.length === 0) window.removeEventListener("keydown", onKeyDown);
    };
  }, [active]);
}
