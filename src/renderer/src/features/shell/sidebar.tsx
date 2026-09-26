import { MagnifyingGlass, Plus, type Icon } from "@phosphor-icons/react";
import { clsx } from "clsx";
import { useRef } from "react";
import { useActiveRect } from "@/lib/active-rect";
import { platform } from "@/lib/bridge";
import { useNavigation } from "@/lib/navigation";
import { BrandMark } from "@/components/brand-mark";
import { Kbd } from "@/components/primitives";
import { NAV_ITEMS, SETTINGS_ITEM } from "./nav-items";

const SECTIONS = [null, "Modules", "Tools"] as const;
const CURRENT = "[aria-current=\"page\"]";

export function Sidebar({ onOpenPalette, onQuickLog }: { onOpenPalette: () => void; onQuickLog: () => void }) {
  const { route, navigate } = useNavigation();
  const isMac = platform === "darwin";
  const modifier = isMac ? "⌘" : "Ctrl";
  const ref = useRef<HTMLElement>(null);
  const active = useActiveRect(ref, CURRENT, route.view);
  return (
    <aside ref={ref} className={clsx("titlebar-drag relative flex h-full w-[236px] shrink-0 flex-col border-r border-side-border bg-side px-3.5 pb-4 text-side-text", isMac ? "pt-[46px]" : "pt-5")}>
      {active && (
        <span aria-hidden="true" className="tab-indicator pointer-events-none absolute left-0 top-0 rounded-[7px] bg-side-3" style={{ width: active.width, height: active.height, transform: `translate(${active.left}px, ${active.top}px)` }}>
          <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-signal" />
        </span>
      )}
      <div className="mb-6 flex items-center gap-2.5 px-1.5">
        <BrandMark size={22} inverse />
        <span className="text-[14px] font-semibold tracking-[-0.01em]">Soul</span>
      </div>
      <button type="button" onClick={onQuickLog} className="mb-2.5 flex h-10 items-center gap-2 rounded-[8px] bg-side-text px-3 text-[13px] font-semibold text-side transition-[opacity,transform] duration-150 hover:opacity-90 active:translate-y-px">
        <Plus size={14} weight="bold" />
        <span className="flex-1 text-left">Log</span>
        <kbd className="inline-flex h-[18px] items-center rounded-[4px] bg-side/10 px-1 font-sans text-[10.5px] font-medium text-side/70">{modifier} L</kbd>
      </button>
      <button type="button" onClick={onOpenPalette} className="mb-4 flex h-9 items-center gap-2 rounded-[8px] border border-side-border bg-side-2 px-2.5 text-[12.5px] text-side-muted transition-colors hover:text-side-text">
        <MagnifyingGlass size={13} />
        <span className="flex-1 truncate text-left">Search</span>
        <Kbd inverse>{modifier} K</Kbd>
      </button>
      <nav className="flex flex-col" aria-label="Main">
        {SECTIONS.map((section) => (
          <div key={section ?? "home"} className="flex flex-col gap-0.5">
            {section && <div className="mt-6 mb-2 px-2 text-[10.5px] font-semibold tracking-[0.08em] text-side-faint uppercase">{section}</div>}
            {NAV_ITEMS.filter((item) => item.section === section).map((item) => (
              <NavButton key={item.view} icon={item.icon} label={item.label} active={route.view === item.view} onClick={() => navigate({ view: item.view })} />
            ))}
          </div>
        ))}
      </nav>
      <div className="mt-auto">
        <NavButton icon={SETTINGS_ITEM.icon} label={SETTINGS_ITEM.label} active={route.view === SETTINGS_ITEM.view} onClick={() => navigate({ view: SETTINGS_ITEM.view })} />
      </div>
    </aside>
  );
}

function NavButton({ icon: Glyph, label, active, onClick }: { icon: Icon; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={clsx("relative flex h-9 w-full items-center gap-3 rounded-[7px] px-2.5 text-[13.5px] transition-colors", active ? "font-medium text-side-text" : "text-side-muted hover:bg-side-2 hover:text-side-text")}
    >
      <Glyph size={16} weight={active ? "fill" : "regular"} />
      {label}
    </button>
  );
}
