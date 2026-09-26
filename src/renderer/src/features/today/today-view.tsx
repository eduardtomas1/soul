import { Plus } from "@phosphor-icons/react";
import { usePickedDay, useToday } from "@/lib/clock";
import { useQuery } from "@/lib/query";
import { useNavigation } from "@/lib/navigation";
import { formatLongDate } from "@/lib/format";
import { Button, Columns, Skeleton, Stack } from "@/components/primitives";
import { DayNav } from "@/components/day-nav";
import { Page } from "@/features/shell/page";
import { useQuickLog } from "@/features/log/quick-log-context";
import { HabitsPanel, RoutinesPanel } from "./day-panels";
import { DayLogPanel, JournalPanel, MeasuresPanel, MilestonesPanel, UpcomingPanel } from "./side-panels";
import { Summary } from "./summary";
import { TrendsPanel } from "./trends-panel";

const SCOPES = ["routines", "habits", "journal", "measures", "finances"] as const;

export function TodayView() {
  const today = useToday();
  const { route, navigate } = useNavigation();
  const openLog = useQuickLog();
  const [date, setDate] = usePickedDay(route.focusId);
  const { data } = useQuery("today.get", { date }, SCOPES);
  const past = date !== today;

  return (
    <Page
      title="Overview"
      subtitle={`${formatLongDate(date)}${past ? " · you are logging a past day" : ""}`}
      actions={
        <>
          <DayNav date={date} today={today} onChange={setDate} />
          <Button variant="primary" icon={<Plus size={14} weight="bold" />} onClick={() => openLog({ date })}>Log</Button>
        </>
      }
      wide
    >
      {!data ? (
        <>
          <div className="grid grid-cols-2 gap-5 min-[1100px]:grid-cols-4">{[0, 1, 2, 3].map((index) => <Skeleton key={index} height={132} />)}</div>
          <Columns main>
            <div className="flex flex-col gap-6"><Skeleton height={260} /><Skeleton height={220} /></div>
            <div className="flex flex-col gap-6"><Skeleton height={220} /><Skeleton height={180} /></div>
          </Columns>
        </>
      ) : (
        <>
          <Summary today={data} />
          <Columns main>
            <Stack>
              <RoutinesPanel today={data} onOpen={() => navigate({ view: "routines" })} />
              <HabitsPanel today={data} onOpen={() => navigate({ view: "habits" })} />
              <TrendsPanel days={data.days} />
              <MilestonesPanel today={data} onOpen={() => navigate({ view: "habits", tab: "medals" })} />
            </Stack>
            <Stack>
              <JournalPanel today={data} onOpen={() => navigate({ view: "journal", focusId: data.date })} />
              <MeasuresPanel today={data} onOpen={() => navigate({ view: "measures" })} />
              <DayLogPanel today={data} onLog={() => openLog({ date: data.date })} />
              <UpcomingPanel today={data} onOpen={() => navigate({ view: "finances", tab: "recurring" })} />
            </Stack>
          </Columns>
        </>
      )}
    </Page>
  );
}
