import { ArrowRight, DownloadSimple, Gauge, Leaf, ListChecks, MagnifyingGlass, Moon, NotePencil, Plus, Receipt, Repeat, TrendUp, type Icon } from "@phosphor-icons/react";
import { clsx } from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@/lib/bridge";
import { useEscape } from "@/lib/escape";
import { useFocusTrap } from "@/lib/focus-trap";
import { useNavigation } from "@/lib/navigation";
import { useSettings } from "@/lib/settings";
import { useToasts } from "@/lib/toasts";
import { Kbd } from "@/components/primitives";
import type { QuickLogOptions } from "@/features/log/quick-log-context";
import { NAV_ITEMS, SETTINGS_ITEM } from "./nav-items";

interface Command {
  readonly id: string;
  readonly label: string;
  readonly group: string;
  readonly keywords?: string;
  readonly icon: Icon;
  readonly run: () => void | Promise<void>;
}

export function CommandPalette({ onClose, onQuickLog }: { onClose: () => void; onQuickLog: (options?: QuickLogOptions) => void }) {
  const { navigate } = useNavigation();
  const { settings, update } = useSettings();
  const { push } = useToasts();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useFocusTrap(dialog);
  useEscape(onClose);

  const commands = useMemo<Command[]>(() => [
    { id: "log-expense", label: "Log an expense", group: "Log", keywords: "spend money pay bought", icon: Receipt, run: () => onQuickLog({ mode: "expense" }) },
    { id: "log-income", label: "Log income", group: "Log", keywords: "earn money salary refund", icon: TrendUp, run: () => onQuickLog({ mode: "income" }) },
    { id: "log-habits", label: "Check in habits", group: "Log", keywords: "habit done", icon: Repeat, run: () => onQuickLog({ mode: "habits" }) },
    { id: "log-routines", label: "Tick off routine steps", group: "Log", keywords: "routine checklist", icon: ListChecks, run: () => onQuickLog({ mode: "routines" }) },
    { id: "log-measures", label: "Record measures", group: "Log", keywords: "weight sleep steps", icon: Gauge, run: () => onQuickLog({ mode: "measures" }) },
    { id: "log-journal", label: "Write in the journal", group: "Log", keywords: "note mood energy diary", icon: NotePencil, run: () => onQuickLog({ mode: "journal" }) },
    ...[...NAV_ITEMS, SETTINGS_ITEM].map((item) => ({ id: `go-${item.view}`, label: item.label, group: "Go to", keywords: item.keywords, icon: item.icon, run: () => navigate({ view: item.view }) })),
    { id: "new-routine", label: "New routine", group: "Create", icon: Plus, run: () => navigate({ view: "routines", tab: "new" }) },
    { id: "new-habit", label: "New habit", group: "Create", icon: Plus, run: () => navigate({ view: "habits", tab: "new" }) },
    { id: "new-measure", label: "New measure", group: "Create", keywords: "tracker weight sleep", icon: Plus, run: () => navigate({ view: "measures", tab: "new" }) },
    { id: "new-transaction", label: "Add transaction", group: "Create", keywords: "expense income money", icon: Plus, run: () => navigate({ view: "finances", tab: "transactions", focusId: "new" }) },
    { id: "new-recurring", label: "Add recurring payment", group: "Create", keywords: "subscription bill", icon: Plus, run: () => navigate({ view: "finances", tab: "recurring", focusId: "new" }) },
    { id: "theme", label: settings.theme === "dark" ? "Switch to light theme" : "Switch to dark theme", group: "Actions", keywords: "appearance", icon: Moon, run: () => update({ theme: settings.theme === "dark" ? "light" : "dark" }) },
    { id: "theme-natural", label: "Switch to the natural theme", group: "Actions", keywords: "appearance brown green calm", icon: Leaf, run: () => update({ theme: "natural" }) },
    {
      id: "export",
      label: "Export a backup file",
      group: "Actions",
      keywords: "save download",
      icon: DownloadSimple,
      run: async () => {
        try {
          const result = await invoke("backup.exportToFile");
          if (result) push({ title: "Backup exported", description: result.path, tone: "success" });
        } catch (error) {
          push({ title: "Could not export the backup", description: error instanceof Error ? error.message : undefined, tone: "danger" });
        }
      },
    },
  ], [navigate, onQuickLog, settings.theme, update, push]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) => `${command.label} ${command.group} ${command.keywords ?? ""}`.toLowerCase().includes(needle));
  }, [commands, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>("[data-active=\"true\"]")?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const run = async (command: Command) => {
    onClose();
    await command.run();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center px-6 pt-[14vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <button type="button" aria-label="Close" className="fade absolute inset-0 bg-black/35" onClick={onClose} />
      <div ref={dialog} className="scale-in card relative w-[560px] max-w-full overflow-hidden shadow-[var(--shadow-lg)]">
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <MagnifyingGlass size={16} className="text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
            }}
            placeholder="Log something, go somewhere or run an action"
            aria-label="Search commands"
            className="h-12 w-full bg-transparent text-[14px] outline-none placeholder:text-faint"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndex((current) => Math.min(filtered.length - 1, current + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndex((current) => Math.max(0, current - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                const command = filtered[index];
                if (command) void run(command);
              }
            }}
          />
          <Kbd>Esc</Kbd>
        </div>
        <div ref={listRef} className="max-h-[380px] overflow-y-auto p-2">
          {filtered.length === 0 && <div className="px-3 py-6 text-center text-[13px] text-muted">Nothing matches.</div>}
          {filtered.map((command, position) => {
            const Glyph = command.icon;
            const active = position === index;
            const showGroup = position === 0 || filtered[position - 1]?.group !== command.group;
            return (
              <div key={command.id}>
                {showGroup && <div className="px-2.5 pt-2.5 pb-1 text-[10.5px] font-semibold tracking-[0.06em] text-faint uppercase">{command.group}</div>}
                <button
                  type="button"
                  data-active={active}
                  onMouseMove={(event) => {
                    const last = pointer.current;
                    if (last && last.x === event.clientX && last.y === event.clientY) return;
                    pointer.current = { x: event.clientX, y: event.clientY };
                    setIndex(position);
                  }}
                  onClick={() => void run(command)}
                  className={clsx("flex h-9 w-full items-center gap-2.5 rounded-[7px] px-2.5 text-left text-[13px] transition-colors", active ? "bg-signal-soft text-text" : "text-text")}
                >
                  <Glyph size={16} className={active ? "text-signal" : "text-muted"} />
                  <span className="flex-1">{command.label}</span>
                  {active && <ArrowRight size={14} className="text-signal" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
