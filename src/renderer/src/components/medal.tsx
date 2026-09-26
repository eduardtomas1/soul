import { CalendarCheck, CalendarStar, Flag, ListChecks, PiggyBank, SealCheck, ShieldCheck, type Icon } from "@phosphor-icons/react";
import { clsx } from "clsx";
import type { Medal, MedalKind } from "@shared/contracts/habits";
import { MEDAL_LABELS } from "@shared/icons";
import { formatMonth, formatShortDate, formatTimestamp } from "@/lib/format";

const MARKS: Record<MedalKind, Icon | string> = {
  "first-step": Flag,
  "streak-7": "7",
  "streak-30": "30",
  "streak-100": "100",
  "streak-365": "365",
  "perfect-week": CalendarCheck,
  "perfect-month": CalendarStar,
  "routine-week": ListChecks,
  "routine-month": SealCheck,
  saver: PiggyBank,
  "budget-keeper": ShieldCheck,
};

export function medalSubjectLabel(medal: Medal): string | null {
  if (medal.subjectName) return medal.subjectName;
  if (/^\d{4}-\d{2}-\d{2}$/u.test(medal.subjectId)) return `Week of ${formatShortDate(medal.subjectId)}`;
  if (/^\d{4}-\d{2}$/u.test(medal.subjectId)) return formatMonth(medal.subjectId);
  return null;
}

export function MilestoneMark({ kind, size = 28, muted }: { kind: MedalKind; size?: number; muted?: boolean }) {
  const mark = MARKS[kind];
  return (
    <span className={clsx("inline-flex shrink-0 items-center justify-center rounded-[6px] border font-semibold tabular-nums", muted ? "border-dashed border-border-strong text-faint" : "border-accent bg-accent text-accent-text")} style={{ width: size, height: size, fontSize: Math.round(size * (typeof mark === "string" && mark.length > 2 ? 0.34 : 0.42)) }}>
      <MarkContent mark={mark} size={Math.round(size * 0.55)} />
    </span>
  );
}

function MarkContent({ mark, size }: { mark: Icon | string; size: number }) {
  if (typeof mark === "string") return <>{mark}</>;
  const Glyph = mark;
  return <Glyph size={size} />;
}

export function MedalBadge({ medal, size = 28, className, showLabel = true }: { medal: Medal; size?: number; className?: string; showLabel?: boolean }) {
  const label = MEDAL_LABELS[medal.kind];
  const subject = medalSubjectLabel(medal);
  return (
    <div className={clsx("flex min-w-0 items-center gap-2.5", className)} title={`${label.title}${subject ? ` · ${subject}` : ""} · ${formatTimestamp(medal.earnedAt)}`}>
      <MilestoneMark kind={medal.kind} size={size} />
      {showLabel && (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium leading-tight">{label.title}</div>
          {subject && <div className="truncate text-[12px] text-muted">{subject}</div>}
        </div>
      )}
    </div>
  );
}

export function earnedOn(medal: Medal): string {
  return formatShortDate(medal.earnedAt.slice(0, 10));
}
