import { Notification, type BrowserWindow } from "electron";
import type { IsoDate } from "@shared/contracts/common";
import type { ReminderFired } from "@shared/ipc";
import { addDays, isScheduledOn, localDateOf, localTimestamp, todayIso, weekdaysToMask } from "@shared/dates";
import type { HabitsRepository } from "../repositories/habits";
import type { RoutinesRepository } from "../repositories/routines";
import type { SettingsRepository } from "../repositories/settings";
import { isHabitDoneOn } from "@shared/streaks";

interface DueReminder {
  readonly key: string;
  readonly at: number;
  readonly payload: ReminderFired;
  readonly body: string;
}

export interface ReminderScheduler {
  readonly reschedule: () => void;
  readonly dispose: () => void;
}

const MAX_TIMER_MS = 6 * 60 * 60_000;

export function createReminderScheduler(
  routines: RoutinesRepository,
  habits: HabitsRepository,
  settings: SettingsRepository,
  focusWindow: () => BrowserWindow | null,
  emit: (payload: ReminderFired) => void,
): ReminderScheduler {
  let timer: NodeJS.Timeout | null = null;
  const fired = new Set<string>();

  function candidates(now: Date): DueReminder[] {
    const list: DueReminder[] = [];
    const today = todayIso(now);
    for (const day of [today, addDays(today, 1)]) {
      for (const routine of routines.withReminders()) {
        if (!isScheduledOn(weekdaysToMask(routine.weekdays), day) || routine.remindAt === null) continue;
        list.push({
          key: `routine:${routine.id}:${day}`,
          at: localTimestamp(day, routine.remindAt),
          payload: { kind: "routine", targetId: routine.id, name: routine.name },
          body: routine.steps.length === 1 ? "One step is waiting for you." : `${routine.steps.length} steps are waiting for you.`,
        });
      }
      for (const habit of habits.withReminders()) {
        if (habit.remindAt === null) continue;
        if (habit.cadence === "daily" && !isScheduledOn(weekdaysToMask(habit.weekdays), day)) continue;
        list.push({
          key: `habit:${habit.id}:${day}`,
          at: localTimestamp(day, habit.remindAt),
          payload: { kind: "habit", targetId: habit.id, name: habit.name },
          body: habit.kind === "count" ? `Aim for ${habit.targetCount}${habit.unit ? ` ${habit.unit}` : ""} today.` : "A small check-in keeps the streak alive.",
        });
      }
    }
    return list.filter((entry) => !fired.has(entry.key)).sort((a, b) => a.at - b.at);
  }

  function alreadyDone(reminder: DueReminder, day: IsoDate): boolean {
    if (reminder.payload.kind === "routine") {
      const state = routines.dayStates(day).find((entry) => entry.routineId === reminder.payload.targetId);
      const routine = routines.get(reminder.payload.targetId);
      return !!routine && !!state && routine.steps.length > 0 && state.completedStepIds.length >= routine.steps.length;
    }
    const habit = habits.get(reminder.payload.targetId);
    if (!habit) return true;
    return isHabitDoneOn({
      cadence: habit.cadence,
      weekdayMask: weekdaysToMask(habit.weekdays),
      targetCount: habit.targetCount,
      counts: habits.countsFor(habit.id),
      createdOn: localDateOf(habit.createdAt),
      today: day,
    }, day);
  }

  function fire(reminder: DueReminder): void {
    fired.add(reminder.key);
    const day = reminder.key.split(":")[2] ?? todayIso();
    if (alreadyDone(reminder, day)) return;
    if (!Notification.isSupported()) return;
    const notification = new Notification({ title: reminder.payload.name, body: reminder.body, silent: false });
    notification.on("click", () => {
      const window = focusWindow();
      if (window) {
        if (window.isMinimized()) window.restore();
        window.show();
        window.focus();
      }
      emit(reminder.payload);
    });
    notification.show();
  }

  function reschedule(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!settings.get().remindersEnabled) return;
    const now = new Date();
    const upcoming = candidates(now);
    const graceStart = now.getTime() - 60_000;
    for (const reminder of upcoming) {
      if (reminder.at <= now.getTime()) {
        if (reminder.at >= graceStart) fire(reminder);
        else fired.add(reminder.key);
      }
    }
    const next = candidates(now).find((entry) => entry.at > now.getTime());
    const delay = next ? Math.min(next.at - now.getTime(), MAX_TIMER_MS) : MAX_TIMER_MS;
    timer = setTimeout(() => {
      pruneFired();
      reschedule();
    }, Math.max(1_000, delay));
    timer.unref();
  }

  function pruneFired(): void {
    const yesterday = addDays(todayIso(), -1);
    for (const key of fired) {
      const day = key.split(":")[2];
      if (day && day < yesterday) fired.delete(key);
    }
  }

  return {
    reschedule,
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
