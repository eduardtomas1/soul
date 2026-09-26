import type { IpcRouter } from "../ipc";
import type { AssistantRepository } from "../repositories/assistant";
import type { AssistantService } from "../assistant/service";

export function registerAssistantHandlers(router: IpcRouter, service: AssistantService, repository: AssistantRepository): void {
  router.handle("assistant.providers", ({ refresh }) => service.providers(refresh));
  router.handle("assistant.conversations", () => repository.conversations());
  router.handle("assistant.messages", ({ conversationId }) => repository.messages(conversationId));
  router.handle("assistant.send", (request) => service.send(request), "assistant");
  router.handle("assistant.cancel", ({ runId }) => {
    service.cancel(runId);
  });
  router.handle("assistant.deleteConversation", ({ conversationId }) => {
    service.forget(conversationId);
    repository.deleteConversation(conversationId);
  }, "assistant");
}
