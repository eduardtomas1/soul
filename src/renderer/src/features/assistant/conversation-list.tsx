import { Plus, Trash } from "@phosphor-icons/react";
import { clsx } from "clsx";
import type { AssistantConversation } from "@shared/contracts/assistant";
import { formatTimestamp } from "@/lib/format";
import { Button, IconButton } from "@/components/primitives";

export function ConversationList({ conversations, selectedId, onSelect, onNew, onDelete }: { conversations: readonly AssistantConversation[]; selectedId: string | null; onSelect: (id: string) => void; onNew: () => void; onDelete: (id: string) => void }) {
  return (
    <aside className="flex min-h-0 flex-col gap-3">
      <Button size="sm" icon={<Plus size={13} />} onClick={onNew}>New conversation</Button>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {conversations.length > 0 && <div className="px-2 pb-1 text-[11.5px] text-faint">Conversations</div>}
        {conversations.map((conversation) => (
          <div key={conversation.id} className={clsx("group flex items-center rounded-[6px]", conversation.id === selectedId ? "bg-surface-2" : "hover:bg-surface-2/60")}>
            <button type="button" onClick={() => onSelect(conversation.id)} className="min-w-0 flex-1 px-2 py-1.5 text-left">
              <div className="truncate text-[13px]">{conversation.title}</div>
              <div className="text-[11.5px] text-muted">{formatTimestamp(conversation.updatedAt)} · {conversation.provider === "claude" ? "Claude Code" : "Codex"}</div>
            </button>
            <IconButton label="Delete conversation" size="sm" className="mr-1 opacity-0 group-hover:opacity-100" onClick={() => onDelete(conversation.id)}><Trash size={13} /></IconButton>
          </div>
        ))}
      </div>
    </aside>
  );
}
