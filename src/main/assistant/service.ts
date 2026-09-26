import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { AssistantEvent, AssistantSend, ProviderId, ProviderStatus } from "@shared/contracts/assistant";
import { newId } from "../database/ids";
import type { AssistantRepository } from "../repositories/assistant";
import type { SettingsRepository } from "../repositories/settings";
import { runClaude } from "./claude";
import { runCodex } from "./codex";
import { contextPack, type AssistantData } from "./context";
import { detectProviders } from "./discovery";
import { providerEnvironment, type ProviderRun } from "./provider";

export interface AssistantService {
  readonly providers: (refresh: boolean) => Promise<ProviderStatus[]>;
  readonly send: (request: AssistantSend) => Promise<{ runId: string; conversationId: string }>;
  readonly cancel: (runId: string) => void;
  readonly forget: (conversationId: string) => void;
  readonly dispose: () => void;
}

export interface AssistantServiceDependencies {
  readonly appVersion: string;
  readonly dataDirectory: string;
  readonly repository: AssistantRepository;
  readonly settings: SettingsRepository;
  readonly data: AssistantData;
  readonly emit: (event: AssistantEvent) => void;
}

const SESSION_KEY_PREFIX = "assistant.session.";
const TRANSCRIPT_MESSAGES = 8;

export function createAssistantService(deps: AssistantServiceDependencies): AssistantService {
  const runs = new Map<string, { readonly run: ProviderRun; readonly conversationId: string }>();
  let cached: ProviderStatus[] | null = null;
  const workspace = join(deps.dataDirectory, "assistant-workspace");
  mkdirSync(workspace, { recursive: true });

  async function providers(refresh: boolean): Promise<ProviderStatus[]> {
    if (!refresh && cached) return cached;
    cached = await detectProviders();
    return cached;
  }

  function titleFor(prompt: string): string {
    const firstLine = prompt.split("\n")[0]?.trim() ?? "";
    return firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine || "New conversation";
  }

  function transcript(conversationId: string): string {
    const messages = deps.repository.messages(conversationId).slice(-TRANSCRIPT_MESSAGES);
    if (messages.length === 0) return "";
    return `Earlier in this conversation:\n${messages.map((message) => `${message.role === "user" ? "Person" : "Assistant"}: ${message.content}`).join("\n\n")}\n\n`;
  }

  return {
    providers,
    async send(request) {
      const status = (await providers(false)).find((provider) => provider.id === request.provider);
      if (!status?.installed || !status.executable) throw new Error(`${status?.name ?? request.provider} is not installed.`);
      const conversation = request.conversationId
        ? deps.repository.conversation(request.conversationId)
        : deps.repository.createConversation(request.provider, titleFor(request.prompt));
      if (!conversation) throw new Error("Conversation not found.");
      const sessionKey = `${SESSION_KEY_PREFIX}${conversation.id}`;
      const sessionId = request.provider === "claude" ? deps.settings.getRaw(sessionKey) : null;
      const priorTranscript = sessionId === null ? transcript(conversation.id) : "";
      const userMessage = deps.repository.appendMessage(conversation.id, "user", request.prompt);
      const runId = newId();
      deps.emit({ kind: "started", runId, conversationId: conversation.id, userMessage });

      const detailed = request.provider === "codex";
      const prompt = `${contextPack(deps.data, detailed)}\n\n${priorTranscript}${request.prompt}`;
      const model = deps.settings.get().assistantModel.trim();
      const runOptions = {
        executable: status.executable,
        cwd: workspace,
        env: providerEnvironment(deps.appVersion),
        prompt,
        model: model.length > 0 ? model : null,
        sessionId,
        onDelta: (text: string) => deps.emit({ kind: "delta", runId, text }),
        onActivity: (label: string) => deps.emit({ kind: "activity", runId, label }),
        onSession: (id: string) => deps.settings.setRaw(sessionKey, id),
      };
      const run: ProviderRun = request.provider === "claude" ? runClaude(runOptions, deps.data) : runCodex(runOptions);
      runs.set(runId, { run, conversationId: conversation.id });
      void run.finished
        .then((text) => {
          const content = text.trim().length > 0 ? text.trim() : "(no answer)";
          const message = deps.repository.appendMessage(conversation.id, "assistant", content);
          deps.emit({ kind: "completed", runId, message });
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "The assistant failed.";
          if (message === "cancelled" || message.includes("abort")) deps.emit({ kind: "cancelled", runId });
          else deps.emit({ kind: "failed", runId, message });
        })
        .finally(() => runs.delete(runId));
      return { runId, conversationId: conversation.id };
    },
    cancel(runId) {
      runs.get(runId)?.run.cancel();
    },
    forget(conversationId) {
      for (const entry of runs.values()) if (entry.conversationId === conversationId) entry.run.cancel();
      deps.settings.setRaw(`${SESSION_KEY_PREFIX}${conversationId}`, null);
    },
    dispose() {
      for (const entry of runs.values()) entry.run.cancel();
      runs.clear();
    },
  };
}

export type { ProviderId };
