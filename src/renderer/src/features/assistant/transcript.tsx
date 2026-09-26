import { clsx } from "clsx";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AssistantMessage } from "@shared/contracts/assistant";
import { formatTimestamp } from "@/lib/format";

const MARKDOWN_COMPONENTS: Components = {
  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
};

export function Answer({ text }: { text: string }) {
  return (
    <div className="prose-soul text-[13.5px] leading-relaxed">
      <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>{text}</Markdown>
    </div>
  );
}

export function TranscriptEntry({ message, first }: { message: AssistantMessage; first: boolean }) {
  if (message.role === "user") {
    return (
      <div className={clsx(!first && "mt-2 border-t border-border pt-5")}>
        <div className="text-[11.5px] text-muted">You · {formatTimestamp(message.createdAt)}</div>
        <div className="mt-0.5 select-text whitespace-pre-wrap text-[14px] font-semibold">{message.content}</div>
      </div>
    );
  }
  return (
    <div>
      <Answer text={message.content} />
      <div className="mt-1.5 text-[11.5px] text-muted">{formatTimestamp(message.createdAt)}</div>
    </div>
  );
}

export function LiveEntry({ text, activity }: { text: string; activity: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      {(activity || text.length === 0) && (
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
          {activity ?? "Thinking"}
        </div>
      )}
      {text.length > 0 && <Answer text={text} />}
    </div>
  );
}
