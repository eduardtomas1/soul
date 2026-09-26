import { CaretDown, CheckCircle, CircleHalf } from "@phosphor-icons/react";
import { useState } from "react";
import type { ActivityItem, ActivityKind } from "@shared/contracts/journal";
import { IconBadge } from "@/components/glyph";
import { MilestoneMark } from "@/components/medal";
import { Amount } from "@/components/pickers";

const KIND_LABELS: Record<ActivityKind, string> = {
  routine: "Routine",
  habit: "Habit",
  measure: "Measure",
  transaction: "Money",
  milestone: "Milestone",
};

export function ActivityList({ items, empty, limit }: { items: readonly ActivityItem[]; empty: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return <div className="px-5 py-6 text-[12.5px] text-muted">{empty}</div>;
  const hidden = limit !== undefined && !expanded && items.length > limit + 1 ? items.length - limit : 0;
  const shown = hidden > 0 ? items.slice(0, limit) : items;
  return (
    <>
      <ul className="divide-y divide-border">
        {shown.map((item) => (
          <li key={`${item.kind}-${item.id}`} className="flex min-h-[58px] items-center gap-3.5 px-5 py-3">
            {item.kind === "milestone" && item.medalKind ? <MilestoneMark kind={item.medalKind} size={26} /> : <IconBadge name={item.icon} tone={item.color} size={26} />}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-[13px] font-medium">{item.title}</span>
                <span className="shrink-0 text-[10.5px] font-semibold tracking-[0.05em] text-faint uppercase">{KIND_LABELS[item.kind]}</span>
              </div>
              <div className="truncate text-[12px] text-muted">{item.detail}</div>
            </div>
            {item.amountCents !== null ? (
              <Amount cents={item.amountCents} signed className="text-[13px] font-medium" />
            ) : item.done === true ? (
              <CheckCircle size={18} weight="fill" className="shrink-0 text-success" aria-label="Done" />
            ) : item.done === false ? (
              <CircleHalf size={18} className="shrink-0 text-faint" aria-label="Partly done" />
            ) : null}
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button type="button" onClick={() => setExpanded(true)} className="flex w-full items-center justify-center gap-1.5 border-t border-border py-2 text-[12.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text">
          Show {hidden} more
          <CaretDown size={12} weight="bold" />
        </button>
      )}
    </>
  );
}
