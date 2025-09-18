export interface AppEventPayload {
  id: string;
}

export abstract class AppEvent<
  T extends AppEventPayload = AppEventPayload,
> extends CustomEvent<T> {
  static readonly eventType: string;
  readonly eventType: string;
  readonly payload: T;

  constructor(payload: T) {
    const { eventType } = new.target;
    super(eventType, { detail: payload });
    this.eventType = eventType;
    this.payload = payload;
  }
}

export type AppEventClass<
  P extends AppEventPayload = AppEventPayload,
  T extends AppEvent<P> = AppEvent<P>,
> = {
  eventType: string;
  new (payload: P): T;
};
