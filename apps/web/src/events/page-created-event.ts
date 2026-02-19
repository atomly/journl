import type { Chat, UIMessage } from "@ai-sdk/react";
import { AppEvent, type AppEventPayload } from "./app-event";

export interface PageCreatedPayload extends AppEventPayload {
  id: string;
  title: string;
  toolName: string;
  toolCallId: string;
  chat: Chat<UIMessage>;
}

export class PageCreatedEvent extends AppEvent<PageCreatedPayload> {
  static readonly eventType = "page-created";
}
