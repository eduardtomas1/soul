import { ArrowRight, ArrowUp, ChatCircleText, Stop } from "@phosphor-icons/react";
import { clsx } from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AssistantEvent, AssistantMessage, ProviderId } from "@shared/contracts/assistant";
import { invoke, subscribe } from "@/lib/bridge";
import { useQuery } from "@/lib/query";
import { useSettings } from "@/lib/settings";
import { useNavigation } from "@/lib/navigation";
import { Button, EmptyState, InlineError, Segmented, TextArea } from "@/components/primitives";
import { Page } from "@/features/shell/page";
import { ConversationList } from "./conversation-list";
import { LiveEntry, TranscriptEntry } from "./transcript";

interface LiveRun {
  readonly runId: string;
  readonly conversationId: string;
  text: string;
  activity: string | null;
}

const SUGGESTIONS = [
  "How did my spending this month compare with last month?",
  "Which habit am I most consistent with, and which one slips?",
  "Will I stay above zero over the next six months?",
  "Where could I realistically save 100 € a month?",
  "Is my mood better on the days I run or sleep more?",
];

export function AssistantView() {
  const { settings, update } = useSettings();
  const { navigate } = useNavigation();
  const providers = useQuery("assistant.providers", { refresh: false }, []);
  const conversations = useQuery("assistant.conversations", undefined, ["assistant"]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messages = useQuery("assistant.messages", conversationId ? { conversationId } : { conversationId: "none" }, ["assistant"]);
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState<LiveRun | null>(null);
  const [arrived, setArrived] = useState<AssistantMessage[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const provider = settings.assistantProvider;
  const status = providers.data?.find((entry) => entry.id === provider);

  useEffect(() => subscribe<AssistantEvent>("assistant.event", (event) => {
    if (event.kind === "started") {
      setConversationId(event.conversationId);
      setLive({ runId: event.runId, conversationId: event.conversationId, text: "", activity: null });
      setFailure(null);
      return;
    }
    setLive((current) => {
      if (!current || current.runId !== event.runId) return current;
      if (event.kind === "delta") return { ...current, text: current.text + event.text, activity: null };
      if (event.kind === "activity") return { ...current, activity: event.label };
      return current;
    });
    if (event.kind === "completed") setArrived((current) => [...current, event.message]);
    if (event.kind === "completed" || event.kind === "cancelled") setLive((current) => (current?.runId === event.runId ? null : current));
    if (event.kind === "failed") {
      setLive((current) => (current?.runId === event.runId ? null : current));
      setFailure(event.message);
    }
  }), []);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.data, live?.text, live?.activity]);

  const send = async () => {
    const prompt = draft.trim();
    if (prompt.length === 0 || live) return;
    setDraft("");
    setFailure(null);
    try {
      await invoke("assistant.send", { conversationId, provider, prompt });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Could not start the assistant.");
      setDraft(prompt);
    }
  };

  const visibleMessages: AssistantMessage[] = useMemo(() => {
    if (!conversationId) return [];
    const loaded = messages.data ?? [];
    const known = new Set(loaded.map((message) => message.id));
    return [...loaded, ...arrived.filter((message) => message.conversationId === conversationId && !known.has(message.id))];
  }, [conversationId, messages.data, arrived]);
  const installedProviders = providers.data?.filter((entry) => entry.installed) ?? [];

  return (
    <Page
      title="Assistant"
      subtitle="Ask about your journal, routines, habits, measures and money."
      actions={
        <Segmented
          value={provider}
          onChange={(next: ProviderId) => void update({ assistantProvider: next })}
          options={(providers.data ?? []).map((entry) => ({ value: entry.id, label: <span className="inline-flex items-center gap-1.5">{entry.name}<span className={clsx("h-1.5 w-1.5 rounded-full", entry.installed ? "bg-success" : "bg-faint")} /></span> }))}
        />
      }
      wide
    >
      <div className="grid min-h-0 grid-cols-[220px_minmax(0,1fr)] gap-5" style={{ height: "calc(100vh - 146px)" }}>
        <ConversationList
          conversations={conversations.data ?? []}
          selectedId={conversationId}
          onSelect={setConversationId}
          onNew={() => { setConversationId(null); setFailure(null); }}
          onDelete={(id) => { void invoke("assistant.deleteConversation", { conversationId: id }); if (id === conversationId) setConversationId(null); }}
        />
        <section className="card flex min-h-0 flex-col overflow-hidden">
          <div ref={scrollRef} className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            {providers.data && installedProviders.length === 0 && (
              <EmptyState
                icon={<ChatCircleText size={22} />}
                title="No assistant found on this computer"
                description="Soul uses Claude Code or Codex through their command line tools and your existing sign-in. Install one, sign in, then come back."
                action={<div className="flex gap-2"><Button onClick={() => void invoke("app.openExternal", { url: "https://docs.anthropic.com/en/docs/claude-code/overview" })}>Claude Code</Button><Button onClick={() => void invoke("app.openExternal", { url: "https://github.com/openai/codex" })}>Codex</Button><Button variant="ghost" onClick={() => providers.reload()}>Check again</Button></div>}
              />
            )}
            {installedProviders.length > 0 && visibleMessages.length === 0 && !live && (
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-[14px] font-semibold">Ask about your data</div>
                  <div className="mt-0.5 text-[12.5px] text-muted">{status?.installed ? `${status.name} ${status.version ?? ""} is ready.` : `${status?.name ?? "This provider"} is not installed. Choose another one above.`}</div>
                </div>
                <ul className="card divide-y divide-border">
                  {SUGGESTIONS.map((suggestion) => (
                    <li key={suggestion}>
                      <button type="button" onClick={() => setDraft(suggestion)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-[13px] hover:bg-surface-2">
                        {suggestion}
                        <ArrowRight size={13} className="shrink-0 text-faint" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {visibleMessages.map((message, index) => <TranscriptEntry key={message.id} message={message} first={index === 0} />)}
            {live && live.conversationId === conversationId && <LiveEntry text={live.text} activity={live.activity} />}
            <InlineError message={failure} />
          </div>
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <TextArea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={status?.installed ? `Ask ${status.name}…` : "Install a provider to start"}
                disabled={!status?.installed}
                rows={1}
                className="max-h-[160px] min-h-[34px] flex-1"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              {live ? (
                <Button variant="danger" icon={<Stop size={13} weight="fill" />} onClick={() => void invoke("assistant.cancel", { runId: live.runId })}>Stop</Button>
              ) : (
                <Button variant="primary" icon={<ArrowUp size={14} weight="bold" />} onClick={() => void send()} disabled={!status?.installed || draft.trim().length === 0} aria-label="Send" />
              )}
            </div>
            <p className="mt-2 text-[11.5px] text-muted">Answers come from the provider you chose and can be wrong. Soul only gives it read access to your data. <button type="button" className="underline decoration-border-strong hover:text-text" onClick={() => navigate({ view: "settings", tab: "assistant" })}>Assistant settings</button></p>
          </div>
        </section>
      </div>
    </Page>
  );
}
