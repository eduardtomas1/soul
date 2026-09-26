import { createSdkMcpServer, query, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { daysBetween, todayIso } from "@shared/dates";
import { ASSISTANT_INSTRUCTIONS, financeSummary, habitsOverview, journalAndMeasures, recurringAndProjection, routinesOverview, transactionsBetween, type AssistantData } from "./context";
import type { ProviderRun, ProviderRunOptions } from "./provider";

const MCP_NAME = "soul";

function asResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

export function soulTools(data: AssistantData) {
  return [
    tool(
      "finance_summary",
      "Income, expenses, spending by category with budgets, account balances and net worth for one month (YYYY-MM). Defaults to the current month.",
      { month: z.string().regex(/^\d{4}-\d{2}$/u).optional() },
      async ({ month }) => asResult(financeSummary(data, month ?? todayIso().slice(0, 7))),
    ),
    tool(
      "list_transactions",
      "Transactions between two dates (YYYY-MM-DD), newest first, optionally filtered by a search word in the note.",
      {
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
        search: z.string().max(80).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      },
      async ({ from, to, search, limit }) => asResult(transactionsBetween(data, from, to, {
        ...(search ? { search } : {}),
        ...(limit ? { limit } : {}),
      })),
    ),
    tool(
      "recurring_and_projection",
      "Recurring incomes and expenses, average other spending, savings goals, and a month by month cash-flow projection.",
      { months: z.number().int().min(1).max(24).optional() },
      async ({ months }) => asResult(recurringAndProjection(data, months ?? 6)),
    ),
    tool(
      "habits_overview",
      "Every active habit with its target, current and best streak, and completion over the last 30 days.",
      {},
      async () => asResult(habitsOverview(data)),
    ),
    tool(
      "routines_overview",
      "Every active routine with its steps, how many steps are done today and how often it was fully completed in the last two weeks.",
      { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional() },
      async ({ date }) => asResult(routinesOverview(data, date ?? todayIso())),
    ),
    tool(
      "journal_and_measures",
      "Journal entries (mood and energy from 1 to 5, and the written note) and personal measure values between two dates (YYYY-MM-DD), at most 92 days apart.",
      {
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
      },
      async ({ from, to }) => {
        const span = daysBetween(from, to);
        if (span < 0 || span > 92) return asResult({ error: "Choose a range of at most 92 days." });
        return asResult(journalAndMeasures(data, from, to, true));
      },
    ),
  ];
}

export function createSoulTools(data: AssistantData) {
  return createSdkMcpServer({
    name: MCP_NAME,
    version: "1.0.0",
    instructions: "Read-only access to the person's Soul data: finances, habits, routines, journal and measures. Amounts are already formatted in euros.",
    alwaysLoad: true,
    tools: soulTools(data),
  });
}

export function runClaude(options: ProviderRunOptions, data: AssistantData): ProviderRun {
  const abortController = new AbortController();
  const server = createSoulTools(data);
  const allowed = new Set(soulTools(data).map((entry) => `mcp__${MCP_NAME}__${entry.name}`));

  const finished = (async (): Promise<string> => {
    const stream = query({
      prompt: options.prompt,
      options: {
        abortController,
        cwd: options.cwd,
        env: options.env,
        pathToClaudeCodeExecutable: options.executable,
        includePartialMessages: true,
        settingSources: [],
        systemPrompt: { type: "custom", prompt: ASSISTANT_INSTRUCTIONS, snapshot: true },
        tools: [],
        mcpServers: { [MCP_NAME]: server },
        strictMcpConfig: true,
        permissionMode: "default",
        maxTurns: 12,
        canUseTool: async (toolName) =>
          allowed.has(toolName)
            ? { behavior: "allow" as const }
            : { behavior: "deny" as const, message: "Soul only allows its read-only data tools." },
        ...(options.sessionId ? { resume: options.sessionId } : {}),
        ...(options.model ? { model: options.model } : {}),
      },
    });

    let finalText = "";
    let streamed = "";
    let sessionReported = false;
    for await (const message of stream) {
      if (!sessionReported && "session_id" in message && typeof message.session_id === "string") {
        sessionReported = true;
        options.onSession(message.session_id);
      }
      if (message.type === "stream_event") {
        const event = message.event;
        if (event.type === "content_block_delta" && event.delta.type === "text_delta" && message.parent_tool_use_id === null) {
          streamed += event.delta.text;
          options.onDelta(event.delta.text);
        }
        continue;
      }
      if (message.type === "assistant" && message.parent_tool_use_id === null) {
        for (const block of message.message.content) {
          if (block.type === "tool_use") options.onActivity(`Reading ${block.name.replace(`mcp__${MCP_NAME}__`, "").replace(/_/gu, " ")}`);
        }
        continue;
      }
      if (message.type === "result") {
        if (message.subtype === "success") {
          finalText = message.result;
        } else {
          const detail = "errors" in message && Array.isArray(message.errors) ? message.errors.join(" ") : message.subtype;
          throw new Error(`Claude stopped: ${detail}`);
        }
      }
    }
    return finalText.length > 0 ? finalText : streamed;
  })();

  return {
    finished,
    cancel() {
      abortController.abort();
    },
  };
}
