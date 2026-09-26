import { ArrowCounterClockwise, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import type { ColorToken } from "@shared/contracts/common";
import { IconBadge } from "./glyph";
import { Button, IconButton, Panel } from "./primitives";

interface ArchivedItem {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly color: ColorToken;
}

export function ArchivedPanel<T extends ArchivedItem>({ items, onRestore, onDelete }: { items: readonly T[]; onRestore: (item: T) => void; onDelete: (item: T) => void }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <Panel title="Archived" meta={String(items.length)} actions={<Button size="sm" variant="ghost" onClick={() => setOpen((value) => !value)}>{open ? "Hide" : "Show"}</Button>}>
      {open && (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-5 py-3">
              <IconBadge name={item.icon} tone={item.color} size={24} />
              <span className="flex-1 truncate text-[13px] font-medium">{item.name}</span>
              <Button size="sm" variant="ghost" icon={<ArrowCounterClockwise size={13} />} onClick={() => onRestore(item)}>Restore</Button>
              <IconButton label="Delete" size="sm" onClick={() => onDelete(item)}><Trash size={14} /></IconButton>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
