import { useEffect, useState, type RefObject } from "react";

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]):not([type=\"hidden\"]):not([tabindex=\"-1\"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])";

interface Trap {
  readonly id: number;
  readonly container: () => HTMLElement | null;
}

const traps: Trap[] = [];
let nextId = 0;

function focusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => element.getClientRects().length > 0);
}

function focusedElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Tab") return;
  const container = traps[traps.length - 1]?.container();
  if (!container) return;
  const items = focusables(container);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) {
    event.preventDefault();
    return;
  }
  const current = document.activeElement;
  const inside = current instanceof Node && container.contains(current);
  if (event.shiftKey && (!inside || current === first)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (!inside || current === last)) {
    event.preventDefault();
    first.focus();
  }
}

export function useFocusTrap(ref: RefObject<HTMLElement | null>, active = true): void {
  const [opener, setOpener] = useState(() => ({ active, element: active ? focusedElement() : null }));
  if (opener.active !== active) setOpener({ active, element: active ? focusedElement() : null });
  const restoreTo = opener.active === active ? opener.element : null;

  useEffect(() => {
    if (!active) return undefined;
    const id = ++nextId;
    traps.push({ id, container: () => ref.current });
    if (traps.length === 1) document.addEventListener("keydown", onKeyDown);
    const settle = window.setTimeout(() => {
      const container = ref.current;
      if (container && !container.contains(document.activeElement)) focusables(container)[0]?.focus();
    }, 0);
    return () => {
      window.clearTimeout(settle);
      const index = traps.findIndex((trap) => trap.id === id);
      if (index >= 0) traps.splice(index, 1);
      if (traps.length === 0) document.removeEventListener("keydown", onKeyDown);
      if (restoreTo?.isConnected) restoreTo.focus();
    };
  }, [ref, active, restoreTo]);
}
