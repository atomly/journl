import type { AppEvent, AppEventPayload } from "./app-event";
import { AppEventBuffer } from "./app-event-buffer";

type AppEventListener<T extends AppEventPayload = AppEventPayload> = (
  event: AppEvent<T>,
) => void;

export class AppEventEmitter<T extends AppEventPayload = AppEventPayload> {
  private eventBuffer = new AppEventBuffer<T>();

  private eventListeners = new Map<string, AppEventListener<T>[]>();

  /**
   * Emits an event to all registered listeners and stores it in the buffer.
   * Use this when you want to notify current listeners AND buffer for future listeners.
   */
  emit<E extends AppEvent<T>>(event: E): void {
    const eventListeners = this.eventListeners.get(event.eventType) || [];
    eventListeners.forEach((listener) => {
      listener(event);
    });
    this.eventBuffer.store(event);
  }

  /**
   * Buffers for later consumption.
   * Use this to handle race conditions where listeners might not be registered yet.
   */
  buffer<E extends AppEvent<T>>(event: E): void {
    this.eventBuffer.store(event);
  }

  /**
   * Drains a buffered event by delivering it to all current listeners,
   * then consuming it from the buffer.
   *
   * This is useful for orchestrated "sticky event" delivery where
   * buffered events should only be played once, but fan out to all
   * listeners that are currently mounted.
   *
   * Returns the drained event if found, otherwise null.
   */
  drain<E extends AppEvent<T>>(eventType: string, id: string): E | null {
    const bufferedEvent = this.eventBuffer.flush<E>(eventType, id);
    if (!bufferedEvent) {
      return null;
    }

    const eventListeners = this.eventListeners.get(eventType) || [];
    eventListeners.forEach((listener) => {
      listener(bufferedEvent);
    });

    return bufferedEvent;
  }

  /**
   * Retrieves and removes a buffered event from storage.
   * Returns null if no matching event is found.
   */
  flush<E extends AppEvent<T>>(eventType: string, id: string): E | null {
    return this.eventBuffer.flush<E>(eventType, id);
  }

  /**
   * Registers a listener for events of the specified type.
   * Multiple listeners can be registered for the same event type.
   */
  addEventListener(eventType: string, listener: AppEventListener<T>): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    const eventListeners = this.eventListeners.get(eventType);
    if (eventListeners) {
      eventListeners.push(listener);
    }
  }

  /**
   * Removes a specific listener for the given event type.
   * Automatically cleans up empty listener arrays.
   */
  removeEventListener(eventType: string, listener: AppEventListener<T>): void {
    const eventListeners = this.eventListeners.get(eventType);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
      if (eventListeners.length === 0) {
        this.eventListeners.delete(eventType);
      }
    }
  }
}
