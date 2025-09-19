import type { AppEvent, AppEventPayload } from "./app-event";

export class AppEventBuffer<T extends AppEventPayload = AppEventPayload> {
  private buffer = new Map<string, Map<string, AppEvent<T>>>();

  /**
   * Stores an event in the buffer for later consumption.
   * Events are organized by eventType and keyed by their payload ID.
   */
  store<E extends AppEvent<T>>(event: E): void {
    if (!this.buffer.has(event.eventType)) {
      this.buffer.set(event.eventType, new Map());
    }
    const eventMap = this.buffer.get(event.eventType);
    if (eventMap) {
      eventMap.set(event.payload.id, event);
    }
  }

  /**
   * Removes and optionally returns a buffered event if it exists.
   * Automatically cleans up empty event type maps.
   */
  flush<E extends AppEvent<T>>(eventType: string, id: string): E | null {
    const events = this.buffer.get(eventType);
    if (!events) return null;

    const event = events.get(id);
    if (event) {
      events.delete(id);
      if (events.size === 0) {
        this.buffer.delete(eventType);
      }
      return event as E;
    }
    return null;
  }
}
