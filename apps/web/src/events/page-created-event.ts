import type { UIMessage, UseChatHelpers } from "@ai-sdk/react";
import { AppEvent, type AppEventPayload } from "./app-event";

export interface PageCreatedPayload extends AppEventPayload {
  id: string;
  title: string;
  toolName: string;
  toolCallId: string;
  chat: UseChatHelpers<UIMessage>;
}

export class PageCreatedEvent extends AppEvent<PageCreatedPayload> {
  static readonly eventType = "page-created";
}
