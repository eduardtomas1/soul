import type { SoulDatabase } from "../database/open";
import { newId, nowIso } from "../database/ids";
import type { AssistantConversation, AssistantMessage, ProviderId } from "@shared/contracts/assistant";

interface ConversationRow {
  id: string;
  title: string;
  provider: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface AssistantRepository {
  readonly conversations: () => AssistantConversation[];
  readonly conversation: (id: string) => AssistantConversation | null;
  readonly createConversation: (provider: ProviderId, title: string) => AssistantConversation;
  readonly deleteConversation: (id: string) => void;
  readonly messages: (conversationId: string) => AssistantMessage[];
  readonly appendMessage: (conversationId: string, role: AssistantMessage["role"], content: string) => AssistantMessage;
}

export function createAssistantRepository(database: SoulDatabase): AssistantRepository {
  const selectConversations = database.prepare<[], ConversationRow>("SELECT * FROM assistant_conversations ORDER BY updated_at DESC");
  const selectConversation = database.prepare<[string], ConversationRow>("SELECT * FROM assistant_conversations WHERE id = ?");
  const insertConversation = database.prepare<[string, string, string, string, string]>(
    "INSERT INTO assistant_conversations (id, title, provider, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  );
  const touchConversation = database.prepare<[string, string]>("UPDATE assistant_conversations SET updated_at = ? WHERE id = ?");
  const deleteConversation = database.prepare<[string]>("DELETE FROM assistant_conversations WHERE id = ?");
  const selectMessages = database.prepare<[string], MessageRow>(
    "SELECT * FROM assistant_messages WHERE conversation_id = ? ORDER BY created_at, rowid",
  );
  const selectMessage = database.prepare<[string], MessageRow>("SELECT * FROM assistant_messages WHERE id = ?");
  const insertMessage = database.prepare<[string, string, string, string, string]>(
    "INSERT INTO assistant_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
  );

  function toConversation(row: ConversationRow): AssistantConversation {
    return { id: row.id, title: row.title, provider: row.provider as ProviderId, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  function toMessage(row: MessageRow): AssistantMessage {
    return { id: row.id, conversationId: row.conversation_id, role: row.role as AssistantMessage["role"], content: row.content, createdAt: row.created_at };
  }

  return {
    conversations: () => selectConversations.all().map(toConversation),
    conversation(id) {
      const row = selectConversation.get(id);
      return row ? toConversation(row) : null;
    },
    createConversation(provider, title) {
      const id = newId();
      const now = nowIso();
      insertConversation.run(id, title, provider, now, now);
      return toConversation(selectConversation.get(id) as ConversationRow);
    },
    deleteConversation(id) {
      deleteConversation.run(id);
    },
    messages: (conversationId) => selectMessages.all(conversationId).map(toMessage),
    appendMessage(conversationId, role, content) {
      const id = newId();
      const now = nowIso();
      insertMessage.run(id, conversationId, role, content, now);
      touchConversation.run(now, conversationId);
      return toMessage(selectMessage.get(id) as MessageRow);
    },
  };
}
