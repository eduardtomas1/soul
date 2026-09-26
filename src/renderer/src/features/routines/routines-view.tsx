import { Archive, DotsThree, ListChecks, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import type { Routine, RoutineDay } from "@shared/contracts/routines";
import { addDays, isScheduledOn, weekdaysToMask } from "@shared/dates";
import { invoke } from "@/lib/bridge";
import { useToday } from "@/lib/clock";
import { useQuery } from "@/lib/query";
import { useNavigation } from "@/lib/navigation";
import { describeWeekdays, pluralize } from "@/lib/format";
import { Button, EmptyState, IconButton, Panel } from "@/components/primitives";
import { IconBadge } from "@/components/glyph";
import { ArchivedPanel } from "@/components/archived-panel";
import { DayStrip, ProgressRing } from "@/components/charts";
import { ConfirmDelete } from "@/components/sheet";
import { Page } from "@/features/shell/page";
import { RoutineChecklist } from "./routine-checklist";
import { RoutineEditor } from "./routine-editor";
import { RoutineSummary } from "./routine-summary";

export function RoutinesView() {
  const { route } = useNavigation();
  const date = useToday();
  const routines = useQuery("routines.list", undefined, ["routines"]);
  const days = useQuery("routines.day", { date }, ["routines"]);
  const month = useQuery("journal.range", { from: addDays(date, -29), to: date }, ["routines"]);
  const [editing, setEditing] = useState<{ routine: Routine | null } | null>(route.tab === "new" ? { routine: null } : null);
  const [confirmDelete, setConfirmDelete] = useState<Routine | null>(null);

  const dayByRoutine = useMemo(() => new Map((days.data ?? []).map((day) => [day.routineId, day])), [days.data]);
  const active = (routines.data ?? []).filter((routine) => routine.archivedAt === null);
  const archived = (routines.data ?? []).filter((routine) => routine.archivedAt !== null);
  const scheduledToday = active.filter((routine) => isScheduledOn(weekdaysToMask(routine.weekdays), date)).length;

  return (
    <Page
      title="Routines"
      subtitle={active.length > 0 ? `${pluralize(active.length, "routine")} · ${scheduledToday} scheduled today` : "Checklists for set times of the day."}
      actions={<Button variant="primary" icon={<Plus size={14} weight="bold" />} onClick={() => setEditing({ routine: null })}>New routine</Button>}
      wide
    >
      {routines.data && active.length === 0 && (
        <Panel>
          <EmptyState icon={<ListChecks size={22} />} title="No routines yet" description="A routine is a checklist for a time of day, like your morning." action={<Button variant="primary" onClick={() => setEditing({ routine: null })}>Create your first routine</Button>} />
        </Panel>
      )}
      {active.length > 0 && month.data && <RoutineSummary routines={active} days={month.data} dayStates={dayByRoutine} date={date} />}
      <div className="columns no-enter grid items-start gap-6 min-[1180px]:grid-cols-2">
        {active.map((routine) => (
          <RoutineCard key={routine.id} routine={routine} date={date} day={dayByRoutine.get(routine.id)} highlighted={route.focusId === routine.id} onEdit={() => setEditing({ routine })} onArchive={() => void invoke("routines.archive", { id: routine.id, archived: true })} onDelete={() => setConfirmDelete(routine)} />
        ))}
      </div>
      <ArchivedPanel items={archived} onRestore={(routine) => void invoke("routines.archive", { id: routine.id, archived: false })} onDelete={setConfirmDelete} />
      {editing && <RoutineEditor key={editing.routine?.id ?? "new"} routine={editing.routine} open onClose={() => setEditing(null)} />}
      <ConfirmDelete name={confirmDelete?.name ?? null} detail="Its steps and every day you completed it will be removed. Archiving keeps the history instead." onConfirm={() => { if (confirmDelete) void invoke("routines.delete", { id: confirmDelete.id }); }} onClose={() => setConfirmDelete(null)} />
    </Page>
  );
}

function RoutineCard({ routine, date, day, highlighted, onEdit, onArchive, onDelete }: { routine: Routine; date: string; day: RoutineDay | undefined; highlighted: boolean; onEdit: () => void; onArchive: () => void; onDelete: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const history = useQuery("routines.history", { routineId: routine.id, from: addDays(date, -13), to: date }, ["routines"]);
  const scheduledToday = isScheduledOn(weekdaysToMask(routine.weekdays), date);
  const done = day?.completedStepIds.length ?? 0;
  const total = routine.steps.length;
  const scheduledDays = (history.data ?? []).filter((entry) => entry.scheduled && entry.date < date);
  const completedDays = scheduledDays.filter((entry) => entry.totalSteps > 0 && entry.completedSteps >= entry.totalSteps).length;

  return (
    <section className={clsx("card overflow-hidden", `tone-${routine.color}`, highlighted && "border-signal shadow-[0_0_0_1px_var(--signal)]")}>
      <header className="flex h-14 items-center gap-3 border-b border-border pl-5 pr-3">
        <IconBadge name={routine.icon} tone={routine.color} size={26} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold leading-tight">{routine.name}</div>
          <div className="truncate text-[12px] text-muted">{routine.timeOfDay ?? "Any time"} · {describeWeekdays(routine.weekdays)}</div>
        </div>
        {scheduledToday && (
          <ProgressRing value={total > 0 ? done / total : 0} size={28} stroke={3.5} tone={routine.color} className="mr-1">
            <span className="text-[9.5px] font-semibold tabular-nums text-muted">{done}/{total}</span>
          </ProgressRing>
        )}
        <div className="relative">
          <IconButton label="More" size="sm" onClick={() => setMenuOpen((value) => !value)} active={menuOpen}><DotsThree size={18} weight="bold" /></IconButton>
          {menuOpen && (
            <>
              <button type="button" aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} />
              <div className="scale-in card absolute right-0 top-8 z-20 flex w-40 flex-col p-1 shadow-[var(--shadow-lg)]">
                <MenuItem icon={<PencilSimple size={14} />} onClick={() => { setMenuOpen(false); onEdit(); }}>Edit</MenuItem>
                <MenuItem icon={<Archive size={14} />} onClick={() => { setMenuOpen(false); onArchive(); }}>Archive</MenuItem>
                <MenuItem icon={<Trash size={14} />} danger onClick={() => { setMenuOpen(false); onDelete(); }}>Delete</MenuItem>
              </div>
            </>
          )}
        </div>
      </header>
      <div className="px-3 py-2.5">
        {scheduledToday ? <RoutineChecklist routine={routine} day={day} date={date} compact /> : <div className="px-2 py-2 text-[12.5px] text-muted">Not scheduled today · {pluralize(total, "step")}</div>}
      </div>
      <footer className="flex h-11 items-center gap-3 border-t border-border px-5">
        <span className="text-[12px] text-muted">Last 14 days</span>
        <DayStrip tone={routine.color} days={(history.data ?? []).map((entry) => ({ date: entry.date, level: entry.totalSteps > 0 ? entry.completedSteps / entry.totalSteps : 0, scheduled: entry.scheduled }))} />
        {scheduledDays.length > 0 && <span className="ml-auto text-[12px] text-muted tabular-nums">{completedDays} of {scheduledDays.length} days complete</span>}
      </footer>
    </section>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={clsx("flex h-8 items-center gap-2 rounded-[4px] px-2.5 text-left text-[13px] hover:bg-surface-2", danger ? "text-danger" : "text-text")}>
      {icon}
      {children}
    </button>
  );
}
