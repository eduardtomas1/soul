import { Archive, PencilSimple, Plus, Repeat, Trash } from "@phosphor-icons/react";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import type { Habit, HabitEntry, HabitStats, Medal } from "@shared/contracts/habits";
import { addDays, isScheduledOn, localDateOf, weekdaysToMask } from "@shared/dates";
import { MEDAL_LABELS } from "@shared/icons";
import { medalKindSchema } from "@shared/contracts/habits";
import { invoke } from "@/lib/bridge";
import { useToday } from "@/lib/clock";
import { useQuery } from "@/lib/query";
import { useNavigation } from "@/lib/navigation";
import { formatShortDate, pluralize } from "@/lib/format";
import { Button, Columns, EmptyState, IconButton, Metrics, Panel, RowButton, Stack, Tabs } from "@/components/primitives";
import { IconBadge } from "@/components/glyph";
import { ArchivedPanel } from "@/components/archived-panel";
import { ColumnChart, DayStrip, Heatmap } from "@/components/charts";
import { ConfirmDelete } from "@/components/sheet";
import { MilestoneMark, earnedOn, medalSubjectLabel } from "@/components/medal";
import { Page } from "@/features/shell/page";
import { HabitControl } from "./habit-control";
import { HabitEditor } from "./habit-editor";
import { describeHabit, formatPeriods, groupEntries, isHabitDone, weekTotal } from "./habit-schedule";
import { HabitSummary } from "./habit-summary";
import { weeklyRates } from "./habit-weeks";

type Tab = "habits" | "medals";

export function HabitsView() {
  const { route } = useNavigation();
  const today = useToday();
  const yearAgo = addDays(today, -364);
  const overview = useQuery("habits.overview", { from: yearAgo, to: today }, ["habits", "routines", "finances"]);
  const month = useQuery("journal.range", { from: addDays(today, -29), to: today }, ["habits"]);
  const [tab, setTab] = useState<Tab>(route.tab === "medals" ? "medals" : "habits");
  const [selectedId, setSelectedId] = useState<string | null>(route.focusId ?? null);
  const [editing, setEditing] = useState<{ habit: Habit | null } | null>(route.tab === "new" ? { habit: null } : null);
  const [confirmDelete, setConfirmDelete] = useState<Habit | null>(null);

  const data = overview.data;
  const active = useMemo(() => (data?.habits ?? []).filter((habit) => habit.archivedAt === null), [data]);
  const archived = useMemo(() => (data?.habits ?? []).filter((habit) => habit.archivedAt !== null), [data]);
  const statsById = useMemo(() => new Map((data?.stats ?? []).map((entry) => [entry.habitId, entry])), [data]);
  const entriesByHabit = useMemo(() => groupEntries(data?.entries ?? []), [data]);
  const selected = active.find((habit) => habit.id === selectedId) ?? active[0] ?? null;

  return (
    <Page
      title="Habits"
      subtitle={active.length > 0 ? `${pluralize(active.length, "habit")} · ${pluralize((data?.medals ?? []).length, "milestone")} reached` : "Things you want to do regularly, with streaks and milestones."}
      actions={<Button variant="primary" icon={<Plus size={14} weight="bold" />} onClick={() => setEditing({ habit: null })}>New habit</Button>}
      tabs={<Tabs value={tab} onChange={setTab} options={[{ value: "habits", label: "Habits" }, { value: "medals", label: "Milestones" }]} />}
      wide
    >
      {tab === "medals" ? (
        <MilestonesTable medals={data?.medals ?? []} />
      ) : data && active.length === 0 ? (
        <Panel><EmptyState icon={<Repeat size={22} />} title="No habits yet" description="Add something you want to do regularly, like reading or a daily walk. Soul counts your streak." action={<Button variant="primary" onClick={() => setEditing({ habit: null })}>Create a habit</Button>} /></Panel>
      ) : (
        <>
          {data && month.data && <HabitSummary habits={active} stats={statsById} medals={data.medals} days={month.data} />}
          <Columns main>
            <Stack>
              <Panel title="Active habits" meta={String(active.length)}>
                <table className="data-table">
                  <thead>
                    <tr><th>Habit</th><th className="num">Streak</th><th className="hidden min-[1400px]:table-cell">Last 14 days</th><th className="num">Today</th></tr>
                  </thead>
                  <tbody>
                    {active.map((habit) => {
                      const counts = entriesByHabit.get(habit.id) ?? new Map<string, number>();
                      const streak = statsById.get(habit.id)?.currentStreak ?? 0;
                      const isSelected = selected?.id === habit.id;
                      return (
                        <tr key={habit.id} className={clsx("row-link", isSelected && "row-selected")} onClick={() => setSelectedId(habit.id)}>
                          <td>
                            <RowButton onClick={() => setSelectedId(habit.id)}>
                              <IconBadge name={habit.icon} tone={habit.color} size={26} />
                              <span className="min-w-0">
                                <span className="block truncate font-medium">{habit.name}</span>
                                <span className="block truncate text-[12px] text-muted">{describeHabit(habit)}</span>
                              </span>
                            </RowButton>
                          </td>
                          <td className="num text-muted">{streak > 0 ? formatPeriods(habit, streak) : "—"}</td>
                          <td className="hidden min-[1400px]:table-cell"><MiniHistory habit={habit} counts={counts} today={today} /></td>
                          <td className="num" onClick={(event) => event.stopPropagation()}><HabitControl habit={habit} date={today} count={counts.get(today) ?? 0} weekTotal={weekTotal(counts, today)} size="sm" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>
              <ArchivedPanel items={archived} onRestore={(habit) => void invoke("habits.archive", { id: habit.id, archived: false })} onDelete={setConfirmDelete} />
            </Stack>
            {selected && (
              <HabitDetail
                key={selected.id}
                habit={selected}
                stats={statsById.get(selected.id)}
                counts={entriesByHabit.get(selected.id) ?? new Map()}
                medals={(data?.medals ?? []).filter((medal) => medal.subjectKind === "habit" && medal.subjectId === selected.id)}
                today={today}
                onEdit={() => setEditing({ habit: selected })}
                onArchive={() => void invoke("habits.archive", { id: selected.id, archived: true })}
                onDelete={() => setConfirmDelete(selected)}
              />
            )}
          </Columns>
        </>
      )}
      {editing && <HabitEditor key={editing.habit?.id ?? "new"} habit={editing.habit} open onClose={() => setEditing(null)} />}
      <ConfirmDelete name={confirmDelete?.name ?? null} detail="Every check-in and the milestones reached with it will be removed. Archiving keeps the history instead." onConfirm={() => { if (confirmDelete) void invoke("habits.delete", { id: confirmDelete.id }); }} onClose={() => setConfirmDelete(null)} />
    </Page>
  );
}

function MiniHistory({ habit, counts, today }: { habit: Habit; counts: ReadonlyMap<string, number>; today: string }) {
  const mask = weekdaysToMask(habit.weekdays);
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = addDays(today, index - 13);
    const count = counts.get(date) ?? 0;
    const level = isHabitDone(habit, count, weekTotal(counts, date)) ? 1 : count > 0 ? 0.5 : 0;
    return { date, level, scheduled: habit.cadence === "weekly" || isScheduledOn(mask, date) };
  });
  return <DayStrip days={days} tone={habit.color} compact />;
}

function HabitDetail({ habit, stats, counts, medals, today, onEdit, onArchive, onDelete }: { habit: Habit; stats: HabitStats | undefined; counts: ReadonlyMap<string, number>; medals: readonly Medal[]; today: string; onEdit: () => void; onArchive: () => void; onDelete: () => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const levels = useMemo(() => {
    const map = new Map<string, number>();
    for (const [date, count] of counts) map.set(date, Math.min(1, count / habit.targetCount));
    return map;
  }, [counts, habit.targetCount]);
  const rate = stats && stats.scheduledLast30 > 0 ? Math.round((stats.completedLast30 / stats.scheduledLast30) * 100) : 0;
  const since = useMemo(() => {
    let start = localDateOf(habit.createdAt);
    for (const date of counts.keys()) if (date < start) start = date;
    return start;
  }, [habit.createdAt, counts]);
  const weeks = useMemo(() => weeklyRates(habit, counts, today, 12, since), [habit, counts, today, since]);
  const hoveredCount = hovered ? counts.get(hovered) ?? 0 : null;

  return (
    <Panel
      className="min-[1180px]:sticky min-[1180px]:top-6"
      title={<span className="flex items-center gap-2"><IconBadge name={habit.icon} tone={habit.color} size={22} />{habit.name}</span>}
      actions={
        <>
          <IconButton label="Edit" size="sm" onClick={onEdit}><PencilSimple size={15} /></IconButton>
          <IconButton label="Archive" size="sm" onClick={onArchive}><Archive size={15} /></IconButton>
          <IconButton label="Delete" size="sm" onClick={onDelete}><Trash size={15} /></IconButton>
        </>
      }
      bodyClassName="flex flex-col gap-5 p-5"
    >
      <div className="text-[12.5px] text-muted">{describeHabit(habit)}{habit.remindAt ? ` · reminder at ${habit.remindAt}` : ""}</div>
      <Metrics
        items={[
          { label: "Current streak", value: formatPeriods(habit, stats?.currentStreak ?? 0) },
          { label: "Best streak", value: formatPeriods(habit, stats?.bestStreak ?? 0) },
          { label: "Last 30 days", value: `${rate}%` },
          { label: habit.cadence === "weekly" ? "Weeks completed" : "Days completed", value: stats?.totalCompleted ?? 0 },
        ]}
      />
      <div>
        <div className="mb-1 label-caps">By week</div>
        <ColumnChart
          axisStep={1}
          labels={weeks.map((week) => formatShortDate(week.start))}
          titles={weeks.map((week) => `Week of ${formatShortDate(week.start)}`)}
          height={150}
          max={100}
          ariaLabel={`${habit.name} completion by week`}
          format={(value) => `${value}%`}
          series={[{ name: "Done", color: `var(--tone-${habit.color})`, values: weeks.map((week) => Math.round(week.rate * 100)) }]}
        />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="label-caps">Last 12 months</span>
          <span className="h-4 text-[12px] text-muted tabular-nums">{hovered ? `${hovered} · ${hoveredCount}${habit.unit ? ` ${habit.unit}` : ""}` : ""}</span>
        </div>
        <Heatmap from={addDays(today, -364)} to={today} values={levels} tone={habit.color} cell={9} gap={2} onHover={setHovered} />
      </div>
      <div>
        <div className="mb-2 label-caps">Milestones</div>
        {medals.length === 0 ? (
          <div className="text-[12.5px] text-muted">None yet. The first one comes with the first check-in.</div>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {medals.map((medal) => (
              <li key={medal.id} className="flex items-center gap-2 rounded-[6px] border border-border py-1 pr-2.5 pl-1" title={MEDAL_LABELS[medal.kind].description}>
                <MilestoneMark kind={medal.kind} size={22} />
                <span className="text-[12.5px] font-medium">{MEDAL_LABELS[medal.kind].title}</span>
                <span className="text-[12px] text-muted tabular-nums">{earnedOn(medal)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function MilestonesTable({ medals }: { medals: readonly Medal[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, Medal[]>();
    for (const medal of medals) {
      const bucket = map.get(medal.kind) ?? [];
      bucket.push(medal);
      map.set(medal.kind, bucket);
    }
    return map;
  }, [medals]);
  return (
    <Panel title="Milestones" meta={`${medals.length} reached`}>
      <table className="data-table">
        <thead>
          <tr><th>Milestone</th><th>Requirement</th><th className="num">Times</th><th>Latest</th></tr>
        </thead>
        <tbody>
          {medalKindSchema.options.map((kind) => {
            const earned = [...(grouped.get(kind) ?? [])].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
            const latest = earned[0];
            return (
              <tr key={kind} className={clsx(earned.length === 0 && "text-muted")}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <MilestoneMark kind={kind} size={24} muted={earned.length === 0} />
                    <span className="font-medium">{MEDAL_LABELS[kind].title}</span>
                  </div>
                </td>
                <td className="text-muted">{MEDAL_LABELS[kind].description}</td>
                <td className="num">{earned.length > 0 ? earned.length : "—"}</td>
                <td className="text-muted">{latest ? `${medalSubjectLabel(latest) ?? "—"} · ${earnedOn(latest)}` : "Not yet"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

export type { HabitEntry };
