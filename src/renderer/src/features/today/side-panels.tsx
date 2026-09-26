import { Gauge, Plus } from "@phosphor-icons/react";
import { useState } from "react";
import type { Today } from "@shared/contracts/today";
import { MEDAL_LABELS } from "@shared/icons";
import { formatRelativeDay } from "@/lib/format";
import { Button, EmptyState, Panel } from "@/components/primitives";
import { Amount } from "@/components/pickers";
import { MilestoneMark, earnedOn, medalSubjectLabel } from "@/components/medal";
import { ActivityList } from "@/features/journal/activity-list";
import { JournalEditor, SaveStatus, type SaveState } from "@/features/journal/journal-editor";
import { MeasureLogList } from "@/features/measures/measure-log-list";

export function JournalPanel({ today, onOpen }: { today: Today; onOpen: () => void }) {
  const [saved, setSaved] = useState<{ date: string; state: SaveState } | null>(null);
  return (
    <Panel title="Journal" meta={<SaveStatus state={saved?.date === today.date ? saved.state : "idle"} />} actions={<Button variant="ghost" size="sm" onClick={onOpen}>Open journal</Button>} bodyClassName="p-5">
      <JournalEditor key={today.date} date={today.date} entry={today.log.entry} rows={4} onStateChange={(state, day) => setSaved({ date: day, state })} />
    </Panel>
  );
}

export function MeasuresPanel({ today, onOpen }: { today: Today; onOpen: () => void }) {
  return (
    <Panel title="Measures" actions={<Button variant="ghost" size="sm" onClick={onOpen}>{today.measures.length === 0 ? "Set up" : "View all"}</Button>}>
      {today.measures.length === 0 ? (
        <EmptyState icon={<Gauge size={20} />} title="Track any number" description="Weight, sleep, steps or anything else you want to follow over time." action={<Button onClick={onOpen}>Add a measure</Button>} />
      ) : (
        <MeasureLogList measures={today.measures} entries={today.measureEntries} date={today.date} />
      )}
    </Panel>
  );
}

export function DayLogPanel({ today, onLog }: { today: Today; onLog: () => void }) {
  const { activity, summary } = today.log;
  const net = summary.incomeCents - summary.expenseCents;
  return (
    <Panel
      title="Logged this day"
      meta={activity.length > 0 ? String(activity.length) : undefined}
      actions={<Button variant="ghost" size="sm" icon={<Plus size={13} />} onClick={onLog}>Log</Button>}
    >
      <ActivityList key={today.date} items={activity} limit={6} empty="Nothing logged yet. Tick a routine, check in a habit or log an expense." />
      {summary.transactions > 0 && (
        <div className="flex items-center justify-between border-t border-border bg-surface-2 px-5 py-3 text-[12px] text-muted">
          <span>Money in and out, transfers excluded</span>
          <Amount cents={net} signed className="font-semibold" />
        </div>
      )}
    </Panel>
  );
}

export function UpcomingPanel({ today, onOpen }: { today: Today; onOpen: () => void }) {
  return (
    <Panel title="Upcoming payments" meta="next 14 days" actions={<Button variant="ghost" size="sm" onClick={onOpen}>Recurring</Button>}>
      {today.upcoming.length === 0 ? (
        <div className="px-5 py-5 text-[12.5px] text-muted">No recurring payments in the next two weeks.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Payment</th><th>Due</th><th className="num">Amount</th></tr>
          </thead>
          <tbody>
            {today.upcoming.map((item) => (
              <tr key={`${item.ruleId}-${item.dueOn}`}>
                <td className="truncate font-medium">{item.name}</td>
                <td className="text-muted">{formatRelativeDay(item.dueOn, today.date)}</td>
                <td className="num"><Amount cents={item.amountCents} signed /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

export function MilestonesPanel({ today, onOpen }: { today: Today; onOpen: () => void }) {
  return (
    <Panel title="Recent milestones" actions={<Button variant="ghost" size="sm" onClick={onOpen}>View all</Button>}>
      {today.recentMedals.length === 0 ? (
        <div className="px-5 py-5 text-[12.5px] text-muted">Keep a habit going for a week to reach the first milestone.</div>
      ) : (
        <ul className="divide-y divide-border">
          {today.recentMedals.map((medal) => (
            <li key={medal.id} className="flex items-center gap-3 px-5 py-3">
              <MilestoneMark kind={medal.kind} size={28} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{MEDAL_LABELS[medal.kind].title}</div>
                <div className="truncate text-[12px] text-muted">{medalSubjectLabel(medal) ?? MEDAL_LABELS[medal.kind].description}</div>
              </div>
              <span className="text-[12px] text-muted tabular-nums">{earnedOn(medal)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
