import type Database from "better-sqlite3";

export interface Migration {
  readonly version: number;
  readonly sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE routines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        time_of_day TEXT,
        weekdays INTEGER NOT NULL,
        remind_at TEXT,
        sort_order INTEGER NOT NULL,
        archived_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE routine_steps (
        id TEXT PRIMARY KEY,
        routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        duration_minutes INTEGER,
        sort_order INTEGER NOT NULL
      );
      CREATE INDEX routine_steps_routine ON routine_steps(routine_id, sort_order);

      CREATE TABLE routine_step_completions (
        routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
        step_id TEXT NOT NULL REFERENCES routine_steps(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        PRIMARY KEY (step_id, date)
      );
      CREATE INDEX routine_step_completions_date ON routine_step_completions(date, routine_id);

      CREATE TABLE habits (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        kind TEXT NOT NULL,
        target_count INTEGER NOT NULL,
        unit TEXT,
        cadence TEXT NOT NULL,
        weekdays INTEGER NOT NULL,
        remind_at TEXT,
        sort_order INTEGER NOT NULL,
        archived_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE habit_entries (
        habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        count INTEGER NOT NULL,
        PRIMARY KEY (habit_id, date)
      );
      CREATE INDEX habit_entries_date ON habit_entries(date);

      CREATE TABLE medals (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        subject_kind TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        earned_at TEXT NOT NULL,
        UNIQUE (kind, subject_kind, subject_id)
      );

      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        opening_balance_cents INTEGER NOT NULL,
        sort_order INTEGER NOT NULL,
        archived_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        archived_at TEXT
      );

      CREATE TABLE recurring_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        amount_cents INTEGER NOT NULL,
        frequency TEXT NOT NULL,
        interval INTEGER NOT NULL,
        anchor_date TEXT NOT NULL,
        end_date TEXT,
        next_due_on TEXT NOT NULL,
        auto_post INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE transactions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        amount_cents INTEGER NOT NULL,
        occurred_on TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        recurring_rule_id TEXT REFERENCES recurring_rules(id) ON DELETE SET NULL,
        transfer_group_id TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX transactions_occurred_on ON transactions(occurred_on);
      CREATE INDEX transactions_account ON transactions(account_id, occurred_on);
      CREATE INDEX transactions_category ON transactions(category_id, occurred_on);

      CREATE TABLE budgets (
        category_id TEXT PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,
        monthly_limit_cents INTEGER NOT NULL
      );

      CREATE TABLE savings_goals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        target_cents INTEGER NOT NULL,
        saved_cents INTEGER NOT NULL DEFAULT 0,
        target_date TEXT,
        sort_order INTEGER NOT NULL,
        achieved_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE assistant_conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        provider TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE assistant_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX assistant_messages_conversation ON assistant_messages(conversation_id, created_at);
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE journal_entries (
        date TEXT PRIMARY KEY,
        mood INTEGER,
        energy INTEGER,
        note TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE measures (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        unit TEXT,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        decimals INTEGER NOT NULL,
        target REAL,
        sort_order INTEGER NOT NULL,
        archived_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE measure_entries (
        measure_id TEXT NOT NULL REFERENCES measures(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        value REAL NOT NULL,
        PRIMARY KEY (measure_id, date)
      );
      CREATE INDEX measure_entries_date ON measure_entries(date);
    `,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE measures ADD COLUMN direction TEXT NOT NULL DEFAULT 'none';
    `,
  },
];

export const CURRENT_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

export function currentVersion(database: Database.Database): number {
  return database.pragma("user_version", { simple: true }) as number;
}

export function runMigrations(database: Database.Database): void {
  const applied = currentVersion(database);
  if (applied > CURRENT_SCHEMA_VERSION) {
    throw new Error(`This data was created by a newer version of Soul (schema ${applied}).`);
  }
  for (const migration of MIGRATIONS) {
    if (migration.version <= applied) continue;
    database.transaction(() => {
      database.exec(migration.sql);
      database.pragma(`user_version = ${migration.version}`);
    })();
  }
}
