import { AppEvent, type AppEventPayload } from "./app-event";

export interface PageCreatedPayload extends AppEventPayload {
  id: string;
  title: string;
}

export class PageCreatedEvent extends AppEvent<PageCreatedPayload> {
  static readonly eventType = "page-created";
}
