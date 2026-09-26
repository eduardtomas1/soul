import Database from "better-sqlite3";
import { join } from "node:path";

export function isoDay(offsetDays) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekday(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return (new Date(year, month - 1, day).getDay() + 6) % 7;
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [0, 1, 2, 3, 4];
const WEEKEND = [5, 6];

const SPENDING = [
  { category: "Groceries", note: "Weekly shop", days: [4], chance: 0.95, from: 5_500, to: 8_500 },
  { category: "Groceries", note: "Bakery", days: EVERY_DAY, chance: 0.18, from: 180, to: 600 },
  { category: "Groceries", note: "Fruit stand", days: WEEKDAYS, chance: 0.1, from: 400, to: 900 },
  { category: "Groceries", note: "Saturday market", days: [5], chance: 0.6, from: 1_200, to: 2_400 },
  { category: "Eating out", note: "Coffee", days: WEEKDAYS, chance: 0.25, from: 180, to: 350 },
  { category: "Eating out", note: "Lunch with a colleague", days: WEEKDAYS, chance: 0.08, from: 1_200, to: 1_800 },
  { category: "Eating out", note: "Brunch", days: WEEKEND, chance: 0.35, from: 1_400, to: 2_600 },
  { category: "Eating out", note: "Tapas", days: [4, 5], chance: 0.3, from: 1_800, to: 3_400 },
  { category: "Eating out", note: "Pizza night", days: [5], chance: 0.25, from: 1_600, to: 2_800 },
  { category: "Eating out", note: "Ramen", days: [6], chance: 0.15, from: 1_300, to: 1_900 },
  { category: "Leisure", note: "Cinema", days: WEEKEND, chance: 0.12, from: 900, to: 1_200 },
  { category: "Leisure", note: "Climbing session", days: [1, 3], chance: 0.15, from: 1_200, to: 1_500 },
  { category: "Leisure", note: "Books", days: EVERY_DAY, chance: 0.03, from: 1_200, to: 2_400 },
  { category: "Leisure", note: "Concert tickets", days: [5], chance: 0.05, from: 2_800, to: 5_500 },
  { category: "Leisure", note: "Board game", days: [6], chance: 0.05, from: 1_800, to: 3_500 },
  { category: "Transport", note: "Metro top-up", days: [0], chance: 0.5, from: 1_000, to: 2_000 },
  { category: "Transport", note: "Taxi home", days: WEEKEND, chance: 0.08, from: 900, to: 1_800 },
  { category: "Transport", note: "Train to the coast", days: [6], chance: 0.06, from: 1_400, to: 2_400 },
  { category: "Transport", note: "Bike repair", days: EVERY_DAY, chance: 0.01, from: 1_800, to: 4_000 },
  { category: "Health", note: "Pharmacy", days: EVERY_DAY, chance: 0.03, from: 500, to: 2_200 },
  { category: "Health", note: "Vitamins", days: EVERY_DAY, chance: 0.01, from: 1_200, to: 2_000 },
  { category: "Health", note: "Dentist", days: WEEKDAYS, chance: 0.005, from: 4_500, to: 8_000 },
  { category: "Other", note: "Haircut", days: EVERY_DAY, chance: 0.03, from: 1_400, to: 2_200 },
  { category: "Other", note: "Birthday present", days: EVERY_DAY, chance: 0.012, from: 2_000, to: 4_500 },
  { category: "Other", note: "Plant pots", days: WEEKEND, chance: 0.02, from: 800, to: 2_000 },
];

const EXTRA_INCOME = [
  { note: "Sold a secondhand lamp", from: 2_500, to: 6_000 },
  { note: "Sold old books", from: 1_000, to: 3_000 },
  { note: "Paid back for dinner", from: 1_200, to: 3_000 },
];

const BUDGETS = { Groceries: 40_000, "Eating out": 20_000, Leisure: 10_000, Transport: 7_000 };

const NOTES = [
  "Long walk after work, felt clear-headed afterwards.",
  "Slow morning. Read on the balcony before breakfast.",
  "Busy day at work and skipped the evening routine. Early night instead.",
  "Ran 5 km in the park. Legs felt heavy at first, then good.",
  "Cooked a big pot of lentil soup for the week.",
  "Coffee with an old friend, lots of laughing.",
  "Slept badly, too much screen time before bed.",
  "Finished the book and started a new one.",
  "Rainy Sunday. Cleaned the flat and planned the week.",
  "Tried the climbing gym again, much better this time.",
  "Felt scattered in the afternoon. A short walk helped.",
  "Market in the morning, then a nap.",
  "Worked from the library, very focused.",
  "Called family in the evening.",
  "Bike ride along the coast. Tired but happy.",
  "Meditated before lunch and the afternoon felt calmer.",
];

const TODAY_NOTE = "Good start: water, stretching and ten minutes of reading before work. Want to get to bed earlier tonight.";

const euroFormatter = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
const euros = (cents) => euroFormatter.format(cents / 100).replace(/\u00a0/gu, " ");
const wholeEuros = (cents) => euros(cents).replace(",00 €", " €");

function largest(totals) {
  return [...totals.entries()].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
}

function daysLeftInMonth(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month, 0).getDate() - day;
}

function weekendAnswer({ weekdays, weekend, monthSpend, today }) {
  const perDay = (bucket, name) => (bucket.byCategory.get(name) ?? 0) / bucket.days;
  const weekdayAverage = weekdays.total / weekdays.days;
  const weekendAverage = weekend.total / weekend.days;
  const percent = Math.round((weekendAverage / weekdayAverage - 1) * 100);
  const names = new Set([...weekdays.byCategory.keys(), ...weekend.byCategory.keys()]);
  const driver = largest(new Map([...names].map((name) => [name, perDay(weekend, name) - perDay(weekdays, name)])));
  const opening = percent >= 40 ? "They are." : percent >= 10 ? "They are, but not dramatically." : percent > -10 ? "Not really." : "Actually, no.";
  const comparison = percent >= 5
    ? `Weekend days cost about **${percent} % more**, mostly from ${driver.toLowerCase()}.`
    : percent <= -5 ? `Weekend days cost about **${-percent} % less** than weekdays.` : "Weekend days cost about the same as weekdays.";
  const groceries = perDay(weekend, "Groceries") < perDay(weekdays, "Groceries")
    ? " Groceries are actually cheaper at the weekend because the big weekly shop lands on Fridays."
    : "";
  const daysLeft = daysLeftInMonth(today);
  const remaining = daysLeft === 0 ? "on the last day of the month" : daysLeft === 1 ? "with one day to go" : `with ${daysLeft} days to go`;
  const eatingOut = monthSpend.get("Eating out") ?? 0;
  const budgetLine = eatingOut <= BUDGETS["Eating out"]
    ? `Your *Eating out* budget is ${wholeEuros(BUDGETS["Eating out"])} and you are at ${euros(eatingOut)} ${remaining}. Skipping one Saturday dinner out keeps it green.`
    : `Your *Eating out* budget is ${wholeEuros(BUDGETS["Eating out"])} and you are already at ${euros(eatingOut)}. One Saturday dinner at home next month would keep it green.`;
  const leisure = monthSpend.get("Leisure") ?? 0;
  const leisureLine = leisure < BUDGETS.Leisure * 0.8
    ? `Leisure is fine. You are well under the ${wholeEuros(BUDGETS.Leisure)} limit, so this is not where to cut.`
    : `Leisure is close to its ${wholeEuros(BUDGETS.Leisure)} limit too, so it is worth a look.`;
  return [
    `${opening} Looking at the last three months:`,
    "",
    "| | Weekdays | Weekends |",
    "|---|---|---|",
    `| Average day | ${euros(Math.round(weekdayAverage))} | ${euros(Math.round(weekendAverage))} |`,
    `| Biggest category | ${largest(weekdays.byCategory)} | ${largest(weekend.byCategory)} |`,
    "",
    `${comparison}${groceries}`,
    "",
    "Two things that would move the needle:",
    "",
    `1. ${budgetLine}`,
    `2. ${leisureLine}`,
    "",
    "Want me to compare the same period last year?",
  ].join("\n");
}

function shiftDay(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day + days, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthEnd(isoMonth) {
  const [year, month] = isoMonth.split("-").map(Number);
  return shiftDay(`${isoMonth}-01`, new Date(year, month, 0).getDate() - 1);
}

const STREAK_NEEDED = {
  daily: { "first-step": 1, "streak-7": 7, "streak-30": 30, "streak-100": 100, "streak-365": 365 },
  weekly: { "first-step": 1, "streak-7": 1, "streak-30": 4, "streak-100": 14, "streak-365": 52 },
};

function habitReachedOn(habit, counts, needed, last) {
  const first = [...counts.keys()].sort()[0];
  if (!first) return null;
  let run = 0;
  if (habit.cadence === "weekly") {
    for (let monday = shiftDay(first, -weekday(first)); monday <= last; monday = shiftDay(monday, 7)) {
      let total = 0;
      for (let offset = 0; offset < 7; offset += 1) total += counts.get(shiftDay(monday, offset)) ?? 0;
      run = total >= habit.target_count ? run + 1 : 0;
      if (run >= needed) return shiftDay(monday, 6);
    }
    return null;
  }
  for (let date = first; date <= last; date = shiftDay(date, 1)) {
    if (!(habit.weekdays & (1 << weekday(date)))) continue;
    run = (counts.get(date) ?? 0) >= habit.target_count ? run + 1 : 0;
    if (run >= needed) return date;
  }
  return null;
}

function routineReachedOn(routine, doneDays, span, last) {
  const first = [...doneDays].sort()[0];
  if (!first) return null;
  for (let date = first; date <= last; date = shiftDay(date, 1)) {
    let scheduled = 0;
    let complete = true;
    for (let offset = span - 1; offset >= 0; offset -= 1) {
      const day = shiftDay(date, -offset);
      if (!(routine.weekdays & (1 << weekday(day)))) continue;
      scheduled += 1;
      if (!doneDays.has(day)) {
        complete = false;
        break;
      }
    }
    if (complete && scheduled > 0) return date;
  }
  return null;
}

function backdateMilestones(database, last) {
  const habits = new Map(database.prepare("SELECT id, cadence, target_count, weekdays FROM habits").all().map((row) => [row.id, row]));
  const routines = new Map(database.prepare("SELECT r.id, r.weekdays, (SELECT COUNT(*) FROM routine_steps s WHERE s.routine_id = r.id) AS steps FROM routines r").all().map((row) => [row.id, row]));
  const entries = database.prepare("SELECT date, count FROM habit_entries WHERE habit_id = ?");
  const completions = database.prepare("SELECT date, COUNT(*) AS done FROM routine_step_completions WHERE routine_id = ? GROUP BY date");
  const backdate = database.prepare("UPDATE medals SET earned_at = ? WHERE id = ?");
  for (const medal of database.prepare("SELECT id, kind, subject_kind, subject_id FROM medals").all()) {
    let day = null;
    if (medal.kind === "perfect-week") day = shiftDay(medal.subject_id, 6);
    else if (medal.kind === "perfect-month") day = monthEnd(medal.subject_id);
    else if (medal.kind === "budget-keeper") day = shiftDay(monthEnd(medal.subject_id), 1);
    else if (medal.kind === "saver") day = shiftDay(last, -1);
    else if (medal.subject_kind === "habit" && habits.has(medal.subject_id)) {
      const habit = habits.get(medal.subject_id);
      const counts = new Map(entries.all(habit.id).map((row) => [row.date, row.count]));
      day = habitReachedOn(habit, counts, STREAK_NEEDED[habit.cadence][medal.kind] ?? 1, last);
    } else if (medal.subject_kind === "routine" && routines.has(medal.subject_id)) {
      const routine = routines.get(medal.subject_id);
      const doneDays = new Set(completions.all(routine.id).filter((row) => row.done >= routine.steps).map((row) => row.date));
      day = routineReachedOn(routine, doneDays, medal.kind === "routine-month" ? 30 : 7, last);
    }
    if (day === null || day > last) day = last;
    backdate.run(`${day}T18:00:00.000Z`, medal.id);
  }
}

function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

export async function seedDemoData(call, { dataDirectory }) {
  const random = seeded(7);
  const today = isoDay(0);

  await call("settings.update", { theme: "light", onboardingDone: true });

  const morning = await call("routines.create", {
    name: "Morning", icon: "sunrise", color: "amber", timeOfDay: "07:00", weekdays: [0, 1, 2, 3, 4, 5, 6], remindAt: "07:00",
    steps: [
      { name: "A glass of water", durationMinutes: null },
      { name: "Stretch", durationMinutes: 10 },
      { name: "Journal three lines", durationMinutes: 5 },
      { name: "Shower and get dressed", durationMinutes: 15 },
    ],
  });
  const evening = await call("routines.create", {
    name: "Wind down", icon: "crescent-moon", color: "iris", timeOfDay: "22:00", weekdays: [0, 1, 2, 3, 4, 5, 6], remindAt: null,
    steps: [
      { name: "Tidy the desk", durationMinutes: 5 },
      { name: "Read twenty pages", durationMinutes: 25 },
      { name: "Phone outside the bedroom", durationMinutes: null },
    ],
  });
  const review = await call("routines.create", {
    name: "Weekly review", icon: "notebook", color: "sky", timeOfDay: "18:00", weekdays: [6], remindAt: "18:00",
    steps: [
      { name: "Look back at the week", durationMinutes: 10 },
      { name: "Plan the next one", durationMinutes: 15 },
      { name: "Check the budget", durationMinutes: 5 },
    ],
  });

  for (let offset = -34; offset < 0; offset += 1) {
    const date = isoDay(offset);
    for (const routine of [morning, evening]) {
      const completeness = random();
      const stepsDone = completeness > 0.2 ? routine.steps.length : completeness > 0.1 ? Math.max(1, routine.steps.length - 1) : 0;
      for (let index = 0; index < stepsDone; index += 1) {
        await call("routines.setStep", { routineId: routine.id, stepId: routine.steps[index].id, date, completed: true });
      }
    }
    if (weekday(date) === 6) {
      for (const step of review.steps) await call("routines.setStep", { routineId: review.id, stepId: step.id, date, completed: true });
    }
  }
  for (const step of morning.steps.slice(0, 2)) await call("routines.setStep", { routineId: morning.id, stepId: step.id, date: today, completed: true });

  const read = await call("habits.create", { name: "Read", icon: "books", color: "plum", kind: "count", targetCount: 20, unit: "pages", cadence: "daily", weekdays: [0, 1, 2, 3, 4, 5, 6], remindAt: "21:30" });
  const meditate = await call("habits.create", { name: "Meditate", icon: "person-in-lotus-position", color: "mint", kind: "check", targetCount: 1, unit: null, cadence: "daily", weekdays: [0, 1, 2, 3, 4, 5, 6], remindAt: null });
  const run = await call("habits.create", { name: "Run", icon: "running-shoe", color: "coral", kind: "count", targetCount: 3, unit: "runs", cadence: "weekly", weekdays: [0, 1, 2, 3, 4, 5, 6], remindAt: null });
  const water = await call("habits.create", { name: "Water", icon: "droplet", color: "sky", kind: "count", targetCount: 8, unit: "glasses", cadence: "daily", weekdays: [0, 1, 2, 3, 4, 5, 6], remindAt: null });
  const sugar = await call("habits.create", { name: "No added sugar", icon: "green-apple", color: "lime", kind: "check", targetCount: 1, unit: null, cadence: "daily", weekdays: [0, 1, 2, 3, 4], remindAt: null });

  for (let offset = -150; offset < 0; offset += 1) {
    const date = isoDay(offset);
    const day = weekday(date);
    const recent = offset > -40;
    if (random() < (recent ? 0.97 : 0.82)) await call("habits.setEntry", { habitId: read.id, date, count: 12 + Math.round(random() * 22) });
    if (random() < (recent ? 0.9 : 0.7)) await call("habits.setEntry", { habitId: meditate.id, date, count: 1 });
    if ([0, 2, 4].includes(day) && random() < 0.85) await call("habits.setEntry", { habitId: run.id, date, count: 1 });
    if (random() < 0.8) await call("habits.setEntry", { habitId: water.id, date, count: 5 + Math.round(random() * 4) });
    if (day < 5 && random() < 0.75) await call("habits.setEntry", { habitId: sugar.id, date, count: 1 });
  }
  await call("habits.setEntry", { habitId: read.id, date: today, count: 14 });
  await call("habits.setEntry", { habitId: meditate.id, date: today, count: 1 });
  await call("habits.setEntry", { habitId: water.id, date: today, count: 5 });

  for (let offset = -60; offset <= 0; offset += 1) {
    const date = isoDay(offset);
    const day = weekday(date);
    if (offset < 0 && random() < 0.12) continue;
    const lift = (day >= 5 ? 1 : 0) + ([0, 2, 4].includes(day) ? 0.5 : 0);
    const mood = Math.max(1, Math.min(5, Math.round(2.8 + lift + (random() - 0.45) * 1.6)));
    const energy = Math.max(1, Math.min(5, Math.round(mood - 0.3 + (random() - 0.5) * 1.8)));
    const note = offset === 0 ? TODAY_NOTE : random() < 0.7 ? NOTES[Math.floor(random() * NOTES.length)] : "";
    await call("journal.save", { date, mood, energy, note });
  }

  const weight = await call("measures.create", { name: "Weight", unit: "kg", icon: "scale", color: "sky", decimals: 1, target: 72, direction: "down" });
  const sleep = await call("measures.create", { name: "Sleep", unit: "h", icon: "bed", color: "iris", decimals: 1, target: 8, direction: "up" });
  const steps = await call("measures.create", { name: "Steps", unit: null, icon: "footprints", color: "mint", decimals: 0, target: 10_000, direction: "up" });
  const heart = await call("measures.create", { name: "Resting heart rate", unit: "bpm", icon: "pulse", color: "rose", decimals: 0, target: null, direction: "down" });
  for (let offset = -120; offset < 0; offset += 1) {
    const date = isoDay(offset);
    const day = weekday(date);
    const progress = (offset + 120) / 120;
    if (random() < 0.85) await call("measures.setEntry", { measureId: weight.id, date, value: 76.8 - progress * 2.6 + (random() - 0.5) * 0.7 });
    if (random() < 0.9) await call("measures.setEntry", { measureId: sleep.id, date, value: (day >= 5 ? 7.6 : 6.9) + (random() - 0.5) * 1.4 });
    if (random() < 0.8) await call("measures.setEntry", { measureId: steps.id, date, value: Math.round(([0, 2, 4].includes(day) ? 11_500 : 7_200) + (random() - 0.5) * 4_000) });
    if (random() < 0.6) await call("measures.setEntry", { measureId: heart.id, date, value: Math.round(62 - progress * 4 + (random() - 0.5) * 3) });
  }
  await call("measures.setEntry", { measureId: weight.id, date: today, value: 74.1 });
  await call("measures.setEntry", { measureId: sleep.id, date: today, value: 7.3 });

  const main = await call("finances.accounts.create", { name: "Main account", kind: "checking", icon: "bank", color: "sky", openingBalanceCents: 184_055 });
  const savings = await call("finances.accounts.create", { name: "Savings", kind: "savings", icon: "money-bag", color: "mint", openingBalanceCents: 620_000 });
  await call("finances.accounts.create", { name: "Wallet", kind: "cash", icon: "coin", color: "sand", openingBalanceCents: 4_500 });
  const overview = await call("finances.overview");
  const category = (name) => overview.categories.find((entry) => entry.name === name).id;

  const anchor = isoDay(-95);
  const monthly = (name, categoryName, amountCents, day) => call("finances.recurring.create", {
    name, accountId: main.id, categoryId: category(categoryName), amountCents, frequency: "monthly", interval: 1, anchorDate: `${anchor.slice(0, 8)}${day}`, endDate: null, autoPost: true,
  });
  const payday = String(Math.min(Number(isoDay(-2).slice(8)), 28)).padStart(2, "0");
  await monthly("Salary", "Salary", 245_000, payday);
  await monthly("Rent", "Home", -95_000, "01");
  await monthly("Gym", "Health", -3_900, "05");
  await monthly("Music streaming", "Subscriptions", -1_099, "12");
  await monthly("Phone", "Subscriptions", -1_800, "15");
  await monthly("Electricity", "Home", -6_400, "20");
  await call("finances.recurring.postDue");

  const weekdays = { total: 0, days: 0, byCategory: new Map() };
  const weekend = { total: 0, days: 0, byCategory: new Map() };
  const monthSpend = new Map();
  for (let offset = -92; offset <= 0; offset += 1) {
    const date = isoDay(offset);
    const day = weekday(date);
    const bucket = day >= 5 ? weekend : weekdays;
    bucket.days += 1;
    for (const item of SPENDING) {
      if (!item.days.includes(day) || random() >= item.chance) continue;
      const amountCents = item.from + Math.round(random() * (item.to - item.from));
      await call("finances.transactions.create", { accountId: main.id, categoryId: category(item.category), amountCents: -amountCents, occurredOn: date, note: item.note });
      bucket.total += amountCents;
      bucket.byCategory.set(item.category, (bucket.byCategory.get(item.category) ?? 0) + amountCents);
      if (date.slice(0, 7) === today.slice(0, 7)) monthSpend.set(item.category, (monthSpend.get(item.category) ?? 0) + amountCents);
    }
    if (random() < 0.04) {
      const income = EXTRA_INCOME[Math.floor(random() * EXTRA_INCOME.length)];
      await call("finances.transactions.create", { accountId: main.id, categoryId: category("Other income"), amountCents: income.from + Math.round(random() * (income.to - income.from)), occurredOn: date, note: income.note });
    }
  }
  await call("finances.transfers.create", { fromAccountId: main.id, toAccountId: savings.id, amountCents: 30_000, occurredOn: isoDay(-2), note: "Monthly transfer" });

  for (const [name, monthlyLimitCents] of Object.entries(BUDGETS)) {
    await call("finances.budgets.set", { categoryId: category(name), monthlyLimitCents });
  }

  const trip = await call("finances.goals.create", { name: "Japan in spring", icon: "cherry-blossom", color: "rose", targetCents: 320_000, targetDate: isoDay(200) });
  await call("finances.goals.contribute", { id: trip.id, amountCents: 142_000 });
  const cushion = await call("finances.goals.create", { name: "Six-month cushion", icon: "shield", color: "mint", targetCents: 900_000, targetDate: null });
  await call("finances.goals.contribute", { id: cushion.id, amountCents: 650_000 });
  const bike = await call("finances.goals.create", { name: "Gravel bike", icon: "bicycle", color: "amber", targetCents: 180_000, targetDate: null });
  await call("finances.goals.contribute", { id: bike.id, amountCents: 180_000 });

  const database = new Database(join(dataDirectory, "soul.sqlite"));
  const now = new Date();
  const conversationId = "demo-conversation";
  const at = (minutesAgo) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  database.prepare("INSERT INTO assistant_conversations (id, title, provider, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(conversationId, "Where does the money go on weekends?", "claude", at(9), at(6));
  const insert = database.prepare("INSERT INTO assistant_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)");
  insert.run("demo-question", conversationId, "user", "Where does the money go on weekends? I feel like Saturdays are expensive.", at(9));
  insert.run("demo-answer", conversationId, "assistant", weekendAnswer({ weekdays, weekend, monthSpend, today }), at(7));
  backdateMilestones(database, isoDay(-1));
  database.close();
}
