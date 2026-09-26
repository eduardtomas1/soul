import type { IpcRouter } from "../ipc";
import { buildDayLog, summarizeDays, type LogSources } from "../services/days";
import { daysBetween } from "@shared/dates";

const MAX_RANGE_DAYS = 400;
const SEARCH_LIMIT = 60;

function checkRange(from: string, to: string): void {
  const span = daysBetween(from, to);
  if (span < 0) throw new Error("The range ends before it starts.");
  if (span > MAX_RANGE_DAYS) throw new Error(`Choose a range of at most ${MAX_RANGE_DAYS} days.`);
}

export function registerLogHandlers(router: IpcRouter, sources: LogSources): void {
  const { journal, measures } = sources;

  router.handle("journal.day", ({ date }) => buildDayLog(sources, date));
  router.handle("journal.range", ({ from, to }) => {
    checkRange(from, to);
    return summarizeDays(sources, from, to);
  });
  router.handle("journal.save", (input) => journal.save(input), "journal");
  router.handle("journal.search", ({ text }) => journal.search(text, SEARCH_LIMIT));

  router.handle("measures.overview", ({ from, to }) => {
    checkRange(from, to);
    return { measures: measures.list(), entries: measures.entries(from, to) };
  });
  router.handle("measures.create", (input) => measures.create(input), "measures");
  router.handle("measures.update", ({ id, input }) => measures.update(id, input), "measures");
  router.handle("measures.archive", ({ id, archived }) => measures.setArchived(id, archived), "measures");
  router.handle("measures.delete", ({ id }) => {
    measures.remove(id);
  }, "measures");
  router.handle("measures.setEntry", (input) => measures.setEntry(input), "measures");
}
