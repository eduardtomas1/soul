import { ArrowDownRight, ArrowUpRight, Gauge, Plus } from "@phosphor-icons/react";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import type { Measure, MeasureInput } from "@shared/contracts/measures";
import { addDays } from "@shared/dates";
import { changeIsGood, formatMeasure, formatMeasureValue } from "@shared/measures";
import { invoke } from "@/lib/bridge";
import { useToday } from "@/lib/clock";
import { useQuery } from "@/lib/query";
import { useNavigation } from "@/lib/navigation";
import { formatRelativeDay, pluralize } from "@/lib/format";
import { useToasts } from "@/lib/toasts";
import { Button, Columns, EmptyState, Panel, RowButton, Skeleton, Stack } from "@/components/primitives";
import { IconBadge } from "@/components/glyph";
import { ArchivedPanel } from "@/components/archived-panel";
import { Sparkline } from "@/components/charts";
import { ConfirmDelete } from "@/components/sheet";
import { Page } from "@/features/shell/page";
import { MeasureDetail } from "./measure-detail";
import { MeasureEditor } from "./measure-editor";
import { groupByMeasure, statsFor } from "./measure-stats";
import { WeekGrid } from "./week-grid";

const PRESETS: readonly MeasureInput[] = [
  { name: "Weight", unit: "kg", icon: "scale", color: "sky", decimals: 1, target: null, direction: "down" },
  { name: "Sleep", unit: "h", icon: "bed", color: "iris", decimals: 1, target: 8, direction: "up" },
  { name: "Steps", unit: null, icon: "footprints", color: "mint", decimals: 0, target: 10_000, direction: "up" },
  { name: "Resting heart rate", unit: "bpm", icon: "pulse", color: "rose", decimals: 0, target: null, direction: "down" },
];

export function MeasuresView() {
  const today = useToday();
  const { route } = useNavigation();
  const { push } = useToasts();
  const overview = useQuery("measures.overview", { from: addDays(today, -364), to: today }, ["measures"]);
  const [selectedId, setSelectedId] = useState<string | null>(route.focusId ?? null);
  const [editing, setEditing] = useState<{ measure: Measure | null } | null>(route.tab === "new" ? { measure: null } : null);
  const [confirmDelete, setConfirmDelete] = useState<Measure | null>(null);

  const data = overview.data;
  const active = useMemo(() => (data?.measures ?? []).filter((measure) => measure.archivedAt === null), [data]);
  const archived = useMemo(() => (data?.measures ?? []).filter((measure) => measure.archivedAt !== null), [data]);
  const byMeasure = useMemo(() => groupByMeasure(data?.entries ?? []), [data]);
  const selected = active.find((measure) => measure.id === selectedId) ?? active[0] ?? null;

  const createPreset = async (input: MeasureInput) => {
    try {
      const created = await invoke("measures.create", input);
      setSelectedId(created.id);
    } catch (error) {
      push({ title: "Could not create the measure", description: error instanceof Error ? error.message : undefined, tone: "danger" });
    }
  };

  return (
    <Page
      title="Measures"
      subtitle={active.length > 0 ? `${pluralize(active.length, "measure")} · one value per day` : "Numbers you follow over time, like weight, sleep or steps."}
      actions={<Button variant="primary" icon={<Plus size={14} weight="bold" />} onClick={() => setEditing({ measure: null })}>New measure</Button>}
      wide
    >
      {!data ? (
        <Skeleton height={240} />
      ) : active.length === 0 ? (
        <Panel>
          <EmptyState icon={<Gauge size={20} />} title="Track any number" description="Pick a common one to start, or create your own. Log a value a day from here, the Overview or the Log window." action={<Button variant="primary" onClick={() => setEditing({ measure: null })}>Create your own</Button>} />
          <div className="grid grid-cols-2 gap-3 border-t border-border p-4 min-[1100px]:grid-cols-4">
            {PRESETS.map((preset) => (
              <button key={preset.name} type="button" onClick={() => void createPreset(preset)} className="flex items-center gap-3 rounded-[8px] border border-border p-3 text-left transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-faint">
                <IconBadge name={preset.icon} tone={preset.color} size={32} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{preset.name}</span>
                  <span className="block truncate text-[12px] text-muted">{preset.unit ?? "count"}{preset.target !== null ? ` · target ${formatMeasure(preset.target, preset.decimals, preset.unit)}` : ""}</span>
                </span>
              </button>
            ))}
          </div>
        </Panel>
      ) : (
        <>
          <WeekGrid measures={active} entries={data.entries} today={today} />
          <Columns main>
            <Stack>
              <Panel title="Your measures" meta={String(active.length)}>
                <table className="data-table">
                  <thead>
                    <tr><th>Measure</th><th className="num">Latest</th><th className="num">30 days</th><th className="hidden w-[120px] min-[1260px]:table-cell">Trend</th></tr>
                  </thead>
                  <tbody>
                    {active.map((measure) => {
                      const entries = byMeasure.get(measure.id) ?? [];
                      const stats = statsFor(entries, today);
                      const good = stats.change30 === null ? null : changeIsGood(measure, stats.change30);
                      const Arrow = (stats.change30 ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight;
                      return (
                        <tr key={measure.id} className={clsx("row-link", selected?.id === measure.id && "row-selected")} onClick={() => setSelectedId(measure.id)}>
                          <td>
                            <RowButton onClick={() => setSelectedId(measure.id)}>
                              <IconBadge name={measure.icon} tone={measure.color} size={28} />
                              <span className="min-w-0">
                                <span className="block truncate font-medium">{measure.name}</span>
                                <span className="block truncate text-[12px] text-muted">{stats.latest ? formatRelativeDay(stats.latest.date, today) : "No value yet"}</span>
                              </span>
                            </RowButton>
                          </td>
                          <td className="num font-medium">{stats.latest ? formatMeasure(stats.latest.value, measure.decimals, measure.unit) : "—"}</td>
                          <td className={clsx("num", good === null ? "text-muted" : good ? "text-success" : "text-danger")}>
                            {stats.change30 === null || stats.change30 === 0 ? "—" : <span className="inline-flex items-center gap-0.5"><Arrow size={12} weight="bold" />{formatMeasureValue(Math.abs(stats.change30), measure.decimals)}</span>}
                          </td>
                          <td className="hidden min-[1260px]:table-cell"><Sparkline points={entries.filter((entry) => entry.date >= addDays(today, -29)).map((entry) => entry.value)} color={`var(--tone-${measure.color})`} height={26} area={false} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>
              <ArchivedPanel items={archived} onRestore={(measure) => void invoke("measures.archive", { id: measure.id, archived: false })} onDelete={setConfirmDelete} />
            </Stack>
            {selected && (
              <MeasureDetail
                key={selected.id}
                measure={selected}
                entries={byMeasure.get(selected.id) ?? []}
                today={today}
                onEdit={() => setEditing({ measure: selected })}
                onArchive={() => void invoke("measures.archive", { id: selected.id, archived: true })}
                onDelete={() => setConfirmDelete(selected)}
              />
            )}
          </Columns>
        </>
      )}
      {editing && <MeasureEditor key={editing.measure?.id ?? "new"} measure={editing.measure} open onClose={() => setEditing(null)} />}
      <ConfirmDelete name={confirmDelete?.name ?? null} detail="Every value logged for it will be removed. Archiving keeps the history instead." onConfirm={() => { if (confirmDelete) void invoke("measures.delete", { id: confirmDelete.id }); }} onClose={() => setConfirmDelete(null)} />
    </Page>
  );
}
